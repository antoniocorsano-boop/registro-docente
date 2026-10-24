import { describe, expect, test } from 'bun:test';
import type { LibrarySource, LibraryStateV1 } from './types';
import {
  addLibrarySource,
  linkLibrarySource,
  removeLibrarySource,
  searchLibrarySources,
  unlinkLibrarySource,
  updateLibrarySource
} from './libraryState';

function makeSource(id: string, capturedAt: string, overrides: Partial<LibrarySource> = {}): LibrarySource {
  return {
    id,
    kind: 'text',
    title: `Fonte ${id}`,
    capturedAt,
    origin: 'Archivio docente',
    sourceUrl: `https://example.org/${id}`,
    payload: { text: `contenuto ${id}` },
    extractedText: `estratto ${id}`,
    status: 'ready',
    privacy: 'teacher-professional',
    links: [],
    ...overrides
  };
}

describe('LIB-01A library state helpers', () => {
  test('add is immutable and duplicate ids are rejected', () => {
    const initial: LibraryStateV1 = { schemaVersion: 1, sources: [] };
    const one = makeSource('one', '2026-10-24T09:00:00.000Z');
    const next = addLibrarySource(initial, one);
    expect(initial.sources).toEqual([]);
    expect(next).not.toBe(initial);
    expect(next.sources).toEqual([one]);
    expect(() => addLibrarySource(next, one)).toThrow(/esiste/i);
  });

  test('update changes only allowed metadata and preserves payload and links', () => {
    const link = { targetType: 'uda' as const, targetId: 'uda-1' };
    const one = makeSource('one', '2026-10-24T09:00:00.000Z', { links: [link] });
    const state: LibraryStateV1 = { schemaVersion: 1, sources: [one] };
    const next = updateLibrarySource(state, 'one', { title: 'Nuovo', notes: 'Nota', privacy: 'unknown' });
    expect(next.sources[0]?.title).toBe('Nuovo');
    expect(next.sources[0]?.payload).toEqual(one.payload);
    expect(next.sources[0]?.links).toEqual([link]);
  });

  test('link is idempotent, unlink keeps the source and remove deletes only the selected source', () => {
    const state: LibraryStateV1 = { schemaVersion: 1, sources: [
      makeSource('one', '2026-10-24T09:00:00.000Z'),
      makeSource('two', '2026-10-24T10:00:00.000Z')
    ] };
    const link = { targetType: 'lesson' as const, targetId: 'lesson-1' };
    const linked = linkLibrarySource(state, 'one', link);
    const twice = linkLibrarySource(linked, 'one', link);
    expect(twice.sources[0]?.links).toEqual([link]);

    const unlinked = unlinkLibrarySource(twice, 'one', link);
    expect(unlinked.sources).toHaveLength(2);
    expect(unlinked.sources[0]?.links).toEqual([]);

    const removed = removeLibrarySource(unlinked, 'one');
    expect(removed.sources.map(source => source.id)).toEqual(['two']);
  });

  test('search covers source text and metadata case-insensitively and blank search is newest-first', () => {
    const state: LibraryStateV1 = { schemaVersion: 1, sources: [
      makeSource('old', '2026-10-23T09:00:00.000Z', { notes: 'Recupero', links: [{ targetType: 'uda', targetId: 'UDA-ENERGIA' }] }),
      makeSource('new', '2026-10-24T11:00:00.000Z', { title: 'Fotovoltaico', payload: { text: 'Sole e pannelli' } })
    ] };
    expect(searchLibrarySources(state, 'recupero').map(source => source.id)).toEqual(['old']);
    expect(searchLibrarySources(state, 'UDA-ENERGIA').map(source => source.id)).toEqual(['old']);
    expect(searchLibrarySources(state, 'sole e pannelli').map(source => source.id)).toEqual(['new']);
    expect(searchLibrarySources(state, 'example.org/new').map(source => source.id)).toEqual(['new']);
    expect(searchLibrarySources(state, '').map(source => source.id)).toEqual(['new', 'old']);
  });
});
