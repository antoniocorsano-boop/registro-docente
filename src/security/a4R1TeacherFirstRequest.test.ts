import { describe, expect, test } from 'bun:test';
import { resolveTeacherFirstRequest } from '../copilot/teacherFirstRequest';

describe('A4-R1 teacher-first local request framing', () => {
  test('the authentic first-class phrase asks the teacher to disambiguate matching first-year classes', () => {
    const result = resolveTeacherFirstRequest('Attività per le classi prime', [
      '3E', '3C', '3A', '1A', '2A', '1C', '2C', '1A'
    ]);

    expect(result.goalKind).toBe('prepare');
    expect(result.classCandidates).toEqual(['1A', '1C']);
    expect(result.needsClassChoice).toBe(true);
    expect(result.reason).toBe('MULTIPLE_CLASS_MATCHES');
  });

  test('an explicit class reference resolves only that class', () => {
    const result = resolveTeacherFirstRequest('Prepara un’attività per la 3E', ['3A', '3C', '3E']);

    expect(result.goalKind).toBe('prepare');
    expect(result.classCandidates).toEqual(['3E']);
    expect(result.needsClassChoice).toBe(false);
  });

  test('canonical register class labels remain intact so spaced labels still bind to the stored UDA identity', () => {
    const result = resolveTeacherFirstRequest('Prepara un’attività per la 3ª A', ['3ª A', '3ª  A', '3C']);

    expect(result.goalKind).toBe('prepare');
    expect(result.classCandidates).toEqual(['3ª A']);
    expect(result.needsClassChoice).toBe(false);
    expect(result.reason).toBe('READY');
  });

  test('unknown teacher wording stays local and asks for a goal instead of inventing one', () => {
    const result = resolveTeacherFirstRequest('Vorrei sistemare un po’ di cose', ['1A', '1C']);

    expect(result.goalKind).toBe('unknown');
    expect(result.classCandidates).toEqual([]);
    expect(result.needsClassChoice).toBe(false);
    expect(result.reason).toBe('GOAL_CLARIFICATION_REQUIRED');
  });

  test('a grade cue with no matching class never falls back to an arbitrary class', () => {
    const result = resolveTeacherFirstRequest('Attività per le classi seconde', ['1A', '1C', '3A']);

    expect(result.goalKind).toBe('prepare');
    expect(result.classCandidates).toEqual([]);
    expect(result.reason).toBe('NO_CLASS_MATCH');
  });
});
