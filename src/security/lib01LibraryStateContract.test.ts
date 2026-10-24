import { describe, expect, test } from 'bun:test';
import type { LibrarySource, LibraryStateV1 } from '../library/types';

const STATE_MODULE = '../library/libraryState.ts';

function source(id: string, capturedAt: string, overrides: Partial<LibrarySource> = {}): LibrarySource {
  return {
    id,
    kind: 'text',
    title: `Fonte ${id}`,
    capturedAt,
    origin: 'Quotidiano scuola',
    sourceUrl: `https://example.org/${id}`,
    payload: { text: `contenuto ${id}` },
    extractedText: `energia ${id}`,
    status: 'ready',
    privacy: 'teacher-professional',
    links: [],
    ...overrides
  };
}

describe('LIB-01A pure library state contract', () => {
  test('adds immutably, rejects duplicate ids and preserves unrelated source fields on update', async () => {
    const { addLibrarySource, updateLibrarySource } = await import(STATE_MODULE);
    const initial: LibraryStateV1 = { schemaVersion: 1, sources: [] };
    const one = source('one', '2026-10-24T09:00:00.000Z');
    const added = addLibrarySource(initial, one);

    expect(initial.sources).toHaveLength(0);
    expect(added.sources).toEqual([one]);
    expect(() => addLibrarySource(added, one)).toThrow(/duplicate|esiste/i);

    const updated = updateLibrarySource(added, 'one', { title: 'Titolo nuovo', notes: 'nota' });
    expect(updated.sources[0]?.title).toBe('Titolo nuovo');
    expect(updated.sources[0]?.payload).toEqual(one.payload);
    expect(updated.sources[0]?.links).toEqual(one.links);
  });

  test('links idempotently, unlinks without deleting the source and removes exactly the target source', async () => {
    const { linkLibrarySource, unlinkLibrarySource, removeLibrarySource } = await import(STATE_MODULE);
    const initial: LibraryStateV1 = { schemaVersion: 1, sources: [
      source('one', '2026-10-24T09:00:00.000Z'),
      source('two', '2026-10-24T10:00:00.000Z')
    ] };
    const link = { targetType: 'uda' as const, targetId: 'uda-energia' };
    const linked = linkLibrarySource(initial, 'one', link);
    const linkedAgain = linkLibrarySource(linked, 'one', link);
    expect(linkedAgain.sources[0]?.links).toEqual([link]);

    const unlinked = unlinkLibrarySource(linkedAgain, 'one', link);
    expect(unlinked.sources.map((item: LibrarySource) => item.id)).toEqual(['one', 'two']);
    expect(unlinked.sources[0]?.links).toEqual([]);

    const removed = removeLibrarySource(unlinked, 'one');
    expect(removed.sources.map((item: LibrarySource) => item.id)).toEqual(['two']);
  });

  test('searches relevant fields case-insensitively and blank search is newest-first', async () => {
    const { searchLibrarySources } = await import(STATE_MODULE);
    const state: LibraryStateV1 = { schemaVersion: 1, sources: [
      source('old', '2026-10-23T09:00:00.000Z', { notes: 'Recupero', links: [{ targetType: 'uda', targetId: 'UDA-ENERGIA' }] }),
      source('new', '2026-10-24T11:00:00.000Z', { title: 'Fotovoltaico' })
    ] };

    expect(searchLibrarySources(state, 'RECUPERO').map((item: LibrarySource) => item.id)).toEqual(['old']);
    expect(searchLibrarySources(state, 'uda-energia').map((item: LibrarySource) => item.id)).toEqual(['old']);
    expect(searchLibrarySources(state, 'example.org/new').map((item: LibrarySource) => item.id)).toEqual(['new']);
    expect(searchLibrarySources(state, '  ').map((item: LibrarySource) => item.id)).toEqual(['new', 'old']);
  });
});
