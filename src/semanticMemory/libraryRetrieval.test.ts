import { describe, expect, test } from 'bun:test';
import type {
  LocalSemanticMemoryPort,
  SemanticMemoryHealthV1,
  SemanticMemoryRemoveReceiptV1,
  SemanticMemoryRemoveRequestV1,
  SemanticMemorySearchRequestV1,
  SemanticMemorySearchResponseV1,
  SemanticMemoryUpsertReceiptV1,
  SemanticMemoryUpsertRequestV1,
} from '../../vendor/contextual-copilot-semantic-memory/index';
import type { LibrarySource, LibraryStateV1 } from '../library/types';
import { retrieveLibrarySourcesFromSemanticMemory } from './libraryRetrieval';

function source(id: string, title: string, overrides: Partial<LibrarySource> = {}): LibrarySource {
  return {
    id,
    kind: 'text',
    title,
    capturedAt: '2026-10-31T05:30:00.000Z',
    payload: { text: `Contenuto ${id}` },
    status: 'ready',
    privacy: 'teacher-professional',
    links: [],
    ...overrides,
  };
}

function state(sources: LibrarySource[]): LibraryStateV1 {
  return { schemaVersion: 1, sources };
}

function hit(input: {
  sourceId: string;
  score: number;
  chunkId?: string;
  namespace?: string;
  sourceAppId?: string;
  sourceType?: string;
  dataClass?: 'TEACHER_PROFESSIONAL' | 'PUBLIC_APP' | 'CURRICOLO' | 'AGGREGATED_NON_IDENTIFIABLE';
}) {
  return {
    sourceAppId: input.sourceAppId ?? 'registro-docente',
    sourceType: input.sourceType ?? 'library-source',
    sourceId: input.sourceId,
    revision: `rev-${input.sourceId}`,
    namespace: input.namespace ?? 'registro/library',
    canonicalRef: `registro://library/source/${input.sourceId}`,
    chunkId: input.chunkId ?? `${input.sourceId}-chunk`,
    text: `indexed text ${input.sourceId}`,
    score: input.score,
    dataClass: input.dataClass ?? 'TEACHER_PROFESSIONAL',
    metadata: {},
  } as const;
}

class SearchPort implements LocalSemanticMemoryPort {
  readonly mode = 'local' as const;
  readonly searchCalls: SemanticMemorySearchRequestV1[] = [];

  constructor(private readonly response: SemanticMemorySearchResponseV1) {}

  async health(): Promise<SemanticMemoryHealthV1> {
    throw new Error('health must not be called by retrieval');
  }
  async upsert(_request: SemanticMemoryUpsertRequestV1): Promise<SemanticMemoryUpsertReceiptV1> {
    throw new Error('upsert must not be called by retrieval');
  }
  async remove(_request: SemanticMemoryRemoveRequestV1): Promise<SemanticMemoryRemoveReceiptV1> {
    throw new Error('remove must not be called by retrieval');
  }
  async search(request: SemanticMemorySearchRequestV1): Promise<SemanticMemorySearchResponseV1> {
    this.searchCalls.push(request);
    return this.response;
  }
}

describe('LSM-01C-A Library retrieval through canonical state', () => {
  test('uses the bounded Library namespace/class request and deduplicates chunks by top score', async () => {
    const port = new SearchPort({
      schema: 'trama.semantic-memory-search-response/v1',
      hits: [
        hit({ sourceId: 'beta', score: 0.72, chunkId: 'beta-low' }),
        hit({ sourceId: 'alpha', score: 0.91, chunkId: 'alpha-top' }),
        hit({ sourceId: 'beta', score: 0.88, chunkId: 'beta-top' }),
      ],
    });
    const library = state([
      source('alpha', 'Alfa'),
      source('beta', 'Beta'),
    ]);

    const result = await retrieveLibrarySourcesFromSemanticMemory({
      query: 'energia e acqua',
      port,
      library,
    });

    expect(port.searchCalls).toEqual([{
      schema: 'trama.semantic-memory-search-request/v1',
      query: 'energia e acqua',
      namespaces: ['registro/library'],
      allowedDataClasses: ['TEACHER_PROFESSIONAL'],
      limit: 8,
    }]);
    expect(result).toEqual({
      status: 'ranked',
      candidates: [
        { sourceId: 'alpha', similarity: 0.91 },
        { sourceId: 'beta', similarity: 0.88 },
      ],
    });
  });

  test('orders equal top scores deterministically by current canonical title then id', async () => {
    const port = new SearchPort({
      schema: 'trama.semantic-memory-search-response/v1',
      hits: [
        hit({ sourceId: 'zeta', score: 0.8 }),
        hit({ sourceId: 'alpha', score: 0.8 }),
        hit({ sourceId: 'beta', score: 0.8 }),
      ],
    });
    const library = state([
      source('zeta', 'Zeta'),
      source('beta', 'Alfa'),
      source('alpha', 'Alfa'),
    ]);

    const result = await retrieveLibrarySourcesFromSemanticMemory({ query: 'tema', port, library });
    expect(result).toEqual({
      status: 'ranked',
      candidates: [
        { sourceId: 'alpha', similarity: 0.8 },
        { sourceId: 'beta', similarity: 0.8 },
        { sourceId: 'zeta', similarity: 0.8 },
      ],
    });
  });

  test('ignores deleted, privacy-changed, restricted and foreign hits even when their score is higher', async () => {
    const port = new SearchPort({
      schema: 'trama.semantic-memory-search-response/v1',
      hits: [
        hit({ sourceId: 'deleted', score: 0.99 }),
        hit({ sourceId: 'student', score: 0.98 }),
        hit({ sourceId: 'restricted', score: 0.97 }),
        hit({ sourceId: 'foreign-app', score: 0.96, sourceAppId: 'another-app' }),
        hit({ sourceId: 'foreign-type', score: 0.95, sourceType: 'professional-memory-entry' }),
        hit({ sourceId: 'foreign-namespace', score: 0.94, namespace: 'registro/professional-memory' }),
        hit({ sourceId: 'eligible', score: 0.7 }),
      ],
    });
    const library = state([
      source('student', 'Studente', { privacy: 'student-personal' }),
      source('restricted', 'Riservato', { status: 'restricted' }),
      source('foreign-app', 'Foreign app'),
      source('foreign-type', 'Foreign type'),
      source('foreign-namespace', 'Foreign namespace'),
      source('eligible', 'Valido'),
    ]);

    const result = await retrieveLibrarySourcesFromSemanticMemory({ query: 'tema', port, library });
    expect(result).toEqual({
      status: 'ranked',
      candidates: [{ sourceId: 'eligible', similarity: 0.7 }],
    });
  });

  test('empty query and empty or fully stale hits return NO_SEMANTIC_MATCH', async () => {
    const emptyPort = new SearchPort({ schema: 'trama.semantic-memory-search-response/v1', hits: [] });
    const library = state([source('one', 'Uno')]);

    const emptyQuery = await retrieveLibrarySourcesFromSemanticMemory({ query: '   ', port: emptyPort, library });
    expect(emptyQuery).toEqual({ status: 'unavailable', reason: 'NO_SEMANTIC_MATCH', candidates: [] });
    expect(emptyPort.searchCalls).toHaveLength(0);

    const noHits = await retrieveLibrarySourcesFromSemanticMemory({ query: 'tema', port: emptyPort, library });
    expect(noHits).toEqual({ status: 'unavailable', reason: 'NO_SEMANTIC_MATCH', candidates: [] });

    const stalePort = new SearchPort({
      schema: 'trama.semantic-memory-search-response/v1',
      hits: [hit({ sourceId: 'deleted', score: 0.99 })],
    });
    const stale = await retrieveLibrarySourcesFromSemanticMemory({ query: 'tema', port: stalePort, library });
    expect(stale).toEqual({ status: 'unavailable', reason: 'NO_SEMANTIC_MATCH', candidates: [] });
  });
});
