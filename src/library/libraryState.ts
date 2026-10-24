import type { LibrarySource, LibrarySourceLink, LibraryStateV1 } from './types';

type LibrarySourcePatch = Partial<Pick<
  LibrarySource,
  'title' | 'notes' | 'status' | 'privacy' | 'extractedText'
>>;

function sourceIndex(state: LibraryStateV1, sourceId: string): number {
  const index = state.sources.findIndex(source => source.id === sourceId);
  if (index < 0) throw new Error(`Fonte di biblioteca non trovata: ${sourceId}.`);
  return index;
}

function sameLink(left: LibrarySourceLink, right: LibrarySourceLink): boolean {
  return left.targetType === right.targetType && left.targetId === right.targetId;
}

function replaceSource(
  state: LibraryStateV1,
  sourceId: string,
  replace: (source: LibrarySource) => LibrarySource
): LibraryStateV1 {
  const index = sourceIndex(state, sourceId);
  const sources = [...state.sources];
  sources[index] = replace(state.sources[index]!);
  return { ...state, sources };
}

export function addLibrarySource(state: LibraryStateV1, source: LibrarySource): LibraryStateV1 {
  if (state.sources.some(existing => existing.id === source.id)) {
    throw new Error(`Esiste già una fonte con identificatore ${source.id}.`);
  }
  return { ...state, sources: [...state.sources, source] };
}

export function updateLibrarySource(
  state: LibraryStateV1,
  sourceId: string,
  patch: LibrarySourcePatch
): LibraryStateV1 {
  return replaceSource(state, sourceId, source => ({ ...source, ...patch }));
}

export function removeLibrarySource(state: LibraryStateV1, sourceId: string): LibraryStateV1 {
  const index = sourceIndex(state, sourceId);
  return {
    ...state,
    sources: state.sources.filter((_source, currentIndex) => currentIndex !== index)
  };
}

export function linkLibrarySource(
  state: LibraryStateV1,
  sourceId: string,
  link: LibrarySourceLink
): LibraryStateV1 {
  return replaceSource(state, sourceId, source => {
    if (source.links.some(existing => sameLink(existing, link))) return source;
    return { ...source, links: [...source.links, link] };
  });
}

export function unlinkLibrarySource(
  state: LibraryStateV1,
  sourceId: string,
  link: LibrarySourceLink
): LibraryStateV1 {
  return replaceSource(state, sourceId, source => ({
    ...source,
    links: source.links.filter(existing => !sameLink(existing, link))
  }));
}

function newestFirst(left: LibrarySource, right: LibrarySource): number {
  return right.capturedAt.localeCompare(left.capturedAt);
}

export function searchLibrarySources(state: LibraryStateV1, query: string): LibrarySource[] {
  const normalized = query.trim().toLocaleLowerCase('it');
  const ordered = [...state.sources].sort(newestFirst);
  if (!normalized) return ordered;

  return ordered.filter(source => {
    const searchable = [
      source.title,
      source.extractedText,
      source.notes,
      source.origin,
      source.sourceUrl,
      source.payload.text,
      source.kind,
      ...source.links.map(link => link.targetId)
    ]
      .filter((value): value is string => typeof value === 'string')
      .join('
')
      .toLocaleLowerCase('it');

    return searchable.includes(normalized);
  });
}
