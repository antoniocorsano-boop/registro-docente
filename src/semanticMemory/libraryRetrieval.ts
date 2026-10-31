import type {
  LocalSemanticMemoryPort,
  SemanticMemoryHitV1,
} from '../../vendor/contextual-copilot-semantic-memory/index';
import type {
  SemanticLibraryResolution,
} from '../library/semanticRetrieval';
import type {
  LibrarySource,
  LibraryStateV1,
} from '../library/types';
import { buildLibrarySemanticMemoryProjections } from './projections';

const LIBRARY_NAMESPACE = 'registro/library';
const LIBRARY_SOURCE_APP_ID = 'registro-docente';
const LIBRARY_SOURCE_TYPE = 'library-source';
const LIBRARY_DATA_CLASS = 'TEACHER_PROFESSIONAL';
const SEARCH_LIMIT = 8;

function unavailable(): SemanticLibraryResolution {
  return {
    status: 'unavailable',
    reason: 'NO_SEMANTIC_MATCH',
    candidates: [],
  };
}

function nonBlank(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function semanticTextForSource(source: LibrarySource): string {
  const payloadText = typeof source.payload.text === 'string' ? source.payload.text : '';
  return [source.title, source.extractedText, payloadText, source.notes]
    .filter(nonBlank)
    .map(value => value.trim())
    .join(' ');
}

function sourceIsCurrentlyEligible(source: LibrarySource): boolean {
  return source.privacy === 'teacher-professional'
    && source.status !== 'restricted'
    && source.status !== 'failed'
    && semanticTextForSource(source).length > 0;
}

function hitMatchesCanonicalLibraryBoundary(hit: SemanticMemoryHitV1): boolean {
  return hit.sourceAppId === LIBRARY_SOURCE_APP_ID
    && hit.sourceType === LIBRARY_SOURCE_TYPE
    && hit.namespace === LIBRARY_NAMESPACE
    && hit.dataClass === LIBRARY_DATA_CLASS
    && hit.canonicalRef === `registro://library/source/${hit.sourceId}`
    && Number.isFinite(hit.score);
}

export async function retrieveLibrarySourcesFromSemanticMemory(input: {
  query: string;
  port: LocalSemanticMemoryPort;
  library: LibraryStateV1;
}): Promise<SemanticLibraryResolution> {
  const query = input.query.trim();
  if (!query) return unavailable();

  const response = await input.port.search({
    schema: 'trama.semantic-memory-search-request/v1',
    query,
    namespaces: [LIBRARY_NAMESPACE],
    allowedDataClasses: [LIBRARY_DATA_CLASS],
    limit: SEARCH_LIMIT,
  });

  if (response.hits.length === 0) return unavailable();

  const currentSources = new Map(input.library.sources.map(source => [source.id, source]));
  const currentProjections = await buildLibrarySemanticMemoryProjections(input.library.sources);
  const currentProjectionBySource = new Map(
    currentProjections.map(projection => [projection.sourceId, projection]),
  );
  const bestScoreBySource = new Map<string, number>();

  for (const hit of response.hits) {
    if (!hitMatchesCanonicalLibraryBoundary(hit)) continue;

    const source = currentSources.get(hit.sourceId);
    const currentProjection = currentProjectionBySource.get(hit.sourceId);
    if (!source || !currentProjection || !sourceIsCurrentlyEligible(source)) continue;
    if (hit.revision !== currentProjection.revision) continue;

    const previous = bestScoreBySource.get(source.id);
    if (previous === undefined || hit.score > previous) {
      bestScoreBySource.set(source.id, hit.score);
    }
  }

  if (bestScoreBySource.size === 0) return unavailable();

  const candidates = Array.from(bestScoreBySource.entries())
    .map(([sourceId, similarity]) => ({
      sourceId,
      similarity,
      title: currentSources.get(sourceId)?.title ?? '',
    }))
    .sort((left, right) => {
      if (right.similarity !== left.similarity) return right.similarity - left.similarity;
      const titleOrder = left.title.localeCompare(right.title, 'it', { sensitivity: 'base' });
      if (titleOrder !== 0) return titleOrder;
      return left.sourceId.localeCompare(right.sourceId);
    })
    .slice(0, SEARCH_LIMIT)
    .map(({ sourceId, similarity }) => ({ sourceId, similarity }));

  return candidates.length > 0
    ? { status: 'ranked', candidates }
    : unavailable();
}
