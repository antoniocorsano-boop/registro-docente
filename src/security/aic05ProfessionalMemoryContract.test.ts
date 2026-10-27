import { describe, expect, test } from 'bun:test';

const EMPTY_STATE = new URL('../memory/emptyProfessionalMemoryState.ts', import.meta.url);
const POLICY = new URL('../memory/memoryPolicy.ts', import.meta.url);
const TYPES = new URL('../memory/types.ts', import.meta.url);

describe('AIC-05 professional memory foundation contract', () => {
  test('defines the memory domain with every automatic category disabled by default', async () => {
    const [emptyState, types] = await Promise.all([
      Bun.file(EMPTY_STATE).text(),
      Bun.file(TYPES).text()
    ]);

    expect(types).toContain("'format-preference'");
    expect(types).toContain("'didactic-pattern'");
    expect(types).toContain("'material-reuse'");
    expect(types).toContain("'planning-continuity'");
    expect(types).toContain("'workflow-preference'");
    expect(emptyState).toContain('createEmptyProfessionalMemoryState');
    expect(emptyState).toContain("'format-preference': false");
    expect(emptyState).toContain("'didactic-pattern': false");
    expect(emptyState).toContain("'material-reuse': false");
    expect(emptyState).toContain("'planning-continuity': false");
    expect(emptyState).toContain("'workflow-preference': false");
  });

  test('fails closed for student-personal and ambiguous memory candidates', async () => {
    const [policy, types] = await Promise.all([
      Bun.file(POLICY).text(),
      Bun.file(TYPES).text()
    ]);

    expect(policy).toContain('DENY_STUDENT_PERSONAL');
    expect(policy).toContain('DENY_AMBIGUOUS');
    expect(types).toContain('TEACHER_PROFESSIONAL');
    expect(types).toContain('CURRICULUM_PLANNING');
    expect(types).toContain('PUBLIC_EXTERNAL_CONTENT');
    expect(types).toContain('AGGREGATED_NON_IDENTIFIABLE');
  });
});
