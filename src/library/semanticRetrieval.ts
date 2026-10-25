import type { LocalEmbeddingConfig } from '../types';
import { cosineSimilarity, getEmbedding } from '../services/embeddingService';
import type { LibrarySource } from './types';

const MIN_SEMANTIC_SIMILARITY = 0.35;
const DEFAULT_MAX_RESULTS = 8;
const HARD_MAX_RESULTS = 8;

export type SemanticLibraryUnavailableReason =
  | 'QUERY_EMPTY'
  | 'LOCAL_EMBEDDING_DISABLED'
  | 'LOCAL_EMBEDDING_REQUIRED'
  | 'NO_ELIGIBLE_SOURCE'
  | 'NO_SEMANTIC_MATCH';

export interface SemanticLibraryCandidate {
  sourceId: string;
  similarity: number;
}

export type SemanticLibraryResolution =
  | {
      status: 'ranked';
      candidates: SemanticLibraryCandidate[];
    }
  | {
      status: 'unavailable';
      reason: SemanticLibraryUnavailableReason;
      candidates: [];
    };

type EmbedFunction = typeof getEmbedding;

function unavailable(reason: SemanticLibraryUnavailableReason): SemanticLibraryResolution {
  return { status: 'unavailable', reason, candidates: [] };
}

function semanticTextForSource(source: LibrarySource): string {
  const payloadText = typeof source.payload.text === 'string' ? source.payload.text : '';
  return [source.title, source.extractedText, payloadText, source.notes]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map(value => value.trim())
    .join(' ');
}

export async function retrieveLibrarySourcesByMeaning(input: {
  query: string;
  sources: LibrarySource[];
  config: LocalEmbeddingConfig;
  maxResults?: number;
  embed?: EmbedFunction;
}): Promise<SemanticLibraryResolution> {
  const { query, sources, config, maxResults = DEFAULT_MAX_RESULTS, embed = getEmbedding } = input;
  const cleanQuery = query.trim();

  if (!cleanQuery) return unavailable('QUERY_EMPTY');
  if (!config.enabled) return unavailable('LOCAL_EMBEDDING_DISABLED');
  if (config.provider !== 'local') return unavailable('LOCAL_EMBEDDING_REQUIRED');

  const eligibleSources = sources
    .filter(source => source.privacy === 'teacher-professional')
    .map(source => ({ source, text: semanticTextForSource(source) }))
    .filter(candidate => candidate.text.length > 0);

  if (eligibleSources.length === 0) return unavailable('NO_ELIGIBLE_SOURCE');

  const context = {
    classification: 'TEACHER_PROFESSIONAL' as const,
    explicitTeacherOptIn: false
  };
  const queryVector = await embed(cleanQuery, config, context);
  if (!Array.isArray(queryVector) || queryVector.length === 0) {
    return unavailable('NO_SEMANTIC_MATCH');
  }

  const ranked: Array<SemanticLibraryCandidate & { title: string }> = [];
  for (const candidate of eligibleSources) {
    const sourceVector = await embed(candidate.text, config, context);
    const similarity = cosineSimilarity(queryVector, sourceVector);
    if (!Number.isFinite(similarity) || similarity < MIN_SEMANTIC_SIMILARITY) continue;
    ranked.push({
      sourceId: candidate.source.id,
      similarity,
      title: candidate.source.title
    });
  }

  if (ranked.length === 0) return unavailable('NO_SEMANTIC_MATCH');

  ranked.sort((left, right) => {
    if (right.similarity !== left.similarity) return right.similarity - left.similarity;
    const titleOrder = left.title.localeCompare(right.title, 'it', { sensitivity: 'base' });
    if (titleOrder !== 0) return titleOrder;
    return left.sourceId.localeCompare(right.sourceId);
  });

  const requestedLimit = Number.isFinite(maxResults) ? Math.trunc(maxResults) : DEFAULT_MAX_RESULTS;
  const limit = Math.min(HARD_MAX_RESULTS, Math.max(1, requestedLimit));
  return {
    status: 'ranked',
    candidates: ranked.slice(0, limit).map(({ sourceId, similarity }) => ({ sourceId, similarity }))
  };
}
