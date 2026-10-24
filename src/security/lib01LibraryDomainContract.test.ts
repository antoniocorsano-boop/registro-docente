import { describe, expect, test } from 'bun:test';

const TYPES_PATH = new URL('../library/types.ts', import.meta.url);
const EMPTY_STATE_MODULE = '../library/emptyLibraryState.ts';

describe('LIB-01A private library domain contract', () => {
  test('materializes the versioned private-library domain before it can be persisted', async () => {
    const typesFile = Bun.file(TYPES_PATH);
    expect(await typesFile.exists()).toBe(true);

    const typesSource = await typesFile.text();
    expect(typesSource).toContain('export interface LibrarySource');
    expect(typesSource).toContain('export interface LibraryStateV1');

    for (const value of ['image', 'file', 'web', 'text', 'note', 'concept', 'internal']) {
      expect(typesSource).toContain(`'${value}'`);
    }
    for (const value of ['captured', 'ready', 'needs-review', 'restricted', 'failed']) {
      expect(typesSource).toContain(`'${value}'`);
    }
    for (const value of ['unknown', 'teacher-professional', 'student-personal']) {
      expect(typesSource).toContain(`'${value}'`);
    }
    for (const value of ['uda', 'lesson', 'activity']) {
      expect(typesSource).toContain(`'${value}'`);
    }

    const { createEmptyLibraryState } = await import(EMPTY_STATE_MODULE);
    expect(createEmptyLibraryState()).toEqual({ schemaVersion: 1, sources: [] });
  });
});
