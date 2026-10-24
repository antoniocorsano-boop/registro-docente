import { describe, expect, test } from 'bun:test';

const TYPES_PATH = new URL('./types.ts', import.meta.url);
const EMPTY_STATE_MODULE = './emptyLibraryState.ts';

describe('LIB-01A private library domain', () => {
  test('defines the versioned empty library state', async () => {
    const typesFile = Bun.file(TYPES_PATH);
    expect(await typesFile.exists()).toBe(true);

    const { createEmptyLibraryState } = await import(EMPTY_STATE_MODULE);
    expect(createEmptyLibraryState()).toEqual({
      schemaVersion: 1,
      sources: []
    });
  });

  test('expresses the required source kinds, states, privacy and link targets', async () => {
    const source = await Bun.file(TYPES_PATH).text();

    for (const value of ['image', 'file', 'web', 'text', 'note', 'concept', 'internal']) {
      expect(source).toContain(`'${value}'`);
    }

    for (const value of ['captured', 'ready', 'needs-review', 'restricted', 'failed']) {
      expect(source).toContain(`'${value}'`);
    }

    for (const value of ['unknown', 'teacher-professional', 'student-personal']) {
      expect(source).toContain(`'${value}'`);
    }

    for (const value of ['uda', 'lesson', 'activity']) {
      expect(source).toContain(`'${value}'`);
    }

    expect(source).toContain('export interface LibrarySource');
    expect(source).toContain('export interface LibraryStateV1');
  });
});
