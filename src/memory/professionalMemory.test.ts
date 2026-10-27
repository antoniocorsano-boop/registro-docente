import { describe, expect, test } from 'bun:test';
import { createEmptyProfessionalMemoryState } from './emptyProfessionalMemoryState';
import { canPersistProfessionalMemoryCandidate } from './memoryPolicy';

describe('AIC-05 professional memory privacy contract', () => {
  test('starts with every automatic memory category disabled', () => {
    expect(createEmptyProfessionalMemoryState()).toEqual({
      schemaVersion: 1,
      events: [],
      entries: [],
      settings: {
        autoRemember: {
          'format-preference': false,
          'didactic-pattern': false,
          'material-reuse': false,
          'planning-continuity': false,
          'workflow-preference': false
        }
      }
    });
  });

  test('fails closed for student-personal and ambiguous candidates', () => {
    expect(canPersistProfessionalMemoryCandidate({ classification: 'STUDENT_PERSONAL' })).toEqual({
      decision: 'DENY_STUDENT_PERSONAL'
    });
    expect(canPersistProfessionalMemoryCandidate({ classification: 'AMBIGUOUS' })).toEqual({
      decision: 'DENY_AMBIGUOUS'
    });
  });

  test('allows only approved professional classes', () => {
    for (const classification of [
      'TEACHER_PROFESSIONAL',
      'CURRICULUM_PLANNING',
      'PUBLIC_EXTERNAL_CONTENT',
      'AGGREGATED_NON_IDENTIFIABLE'
    ] as const) {
      expect(canPersistProfessionalMemoryCandidate({ classification })).toEqual({ decision: 'ALLOW' });
    }
  });
});
