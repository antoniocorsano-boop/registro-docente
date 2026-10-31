import { describe, expect, test } from 'bun:test';
import '../semanticMemory/syncLedger.test';
import '../semanticMemory/sync.test';
import '../semanticMemory/libraryRetrieval.test';
import {
  SemanticMemoryHttpError,
  SemanticMemoryRevisionConflictError,
  createSemanticMemoryHttpClient,
} from '../semanticMemory/httpClient';
import {
  buildLibrarySemanticMemoryProjections,
  buildProfessionalMemoryProjections,
} from '../semanticMemory/projections';
import type { LibrarySource } from '../library/types';
import type {
  ProfessionalMemoryAllowedClassification,
  ProfessionalMemoryEntryV1,
  ProfessionalMemoryStateV1,
} from '../memory/types';

const READY_HEALTH = {
  schema: 'trama.semantic-memory-health/v1' as const,
  status: 'ready' as const,
  protocolVersion: 1 as const,
  modelId: 'embeddinggemma-2-local',
  dimensions: 768,
  indexRevision: '3',
};

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function librarySource(overrides: Partial<LibrarySource> = {}): LibrarySource {
  return {
    id: 'source-1',
    kind: 'text',
    title: 'Energia idroelettrica',
    capturedAt: '2026-10-31T05:30:00.000Z',
    payload: { text: 'Payload energia acqua' },
    extractedText: 'Estratto turbine generatori',
    status: 'ready',
    privacy: 'teacher-professional',
    links: [],
    notes: 'Nota professionale',
    ...overrides,
  };
}

function memoryEntry(
  id: string,
  privacyClassification: ProfessionalMemoryAllowedClassification,
  overrides: Partial<ProfessionalMemoryEntryV1> = {},
): ProfessionalMemoryEntryV1 {
  return {
    id,
    category: 'didactic-pattern',
    summary: `Sintesi ${id}`,
    provenance: { kind: 'teacher-explicit' },
    sourceEventIds: [],
    canonicalRefs: [],
    createdAt: '2026-10-31T04:00:00.000Z',
    updatedAt: '2026-10-31T05:00:00.000Z',
    status: 'active',
    context: {},
    privacyClassification,
    ...overrides,
  };
}

function memoryState(entries: ProfessionalMemoryEntryV1[]): ProfessionalMemoryStateV1 {
  return {
    schemaVersion: 1,
    events: [],
    entries,
    settings: {
      autoRemember: {
        'format-preference': false,
        'didactic-pattern': false,
        'material-reuse': false,
        'planning-continuity': false,
        'workflow-preference': false,
      },
    },
  };
}

describe('LSM-01C-A session-only semantic memory HTTP client', () => {
  test('rejects non-loopback and non-http endpoints before any fetch', () => {
    let calls = 0;
    const fetchImpl = async () => {
      calls += 1;
      return jsonResponse(READY_HEALTH);
    };

    expect(() => createSemanticMemoryHttpClient(
      { endpointUrl: 'https://example.com:8765', token: 'test-token' },
      { fetchImpl },
    )).toThrow();
    expect(() => createSemanticMemoryHttpClient(
      { endpointUrl: 'http://192.168.1.10:8765', token: 'test-token' },
      { fetchImpl },
    )).toThrow();
    expect(calls).toBe(0);
  });

  test('constructor performs zero network requests and health is an explicit unauthenticated GET', async () => {
    const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push({ input, init });
      return jsonResponse(READY_HEALTH);
    };

    const client = createSemanticMemoryHttpClient(
      { endpointUrl: 'http://127.0.0.1:8765/', token: 'test-token' },
      { fetchImpl, timeoutMs: 250 },
    );

    expect(calls).toHaveLength(0);
    expect(await client.health()).toEqual(READY_HEALTH);
    expect(calls).toHaveLength(1);
    expect(String(calls[0].input)).toBe('http://127.0.0.1:8765/v1/health');
    expect(calls[0].init?.method).toBe('GET');
    const headers = new Headers(calls[0].init?.headers);
    expect(headers.has('Authorization')).toBe(false);
    expect(calls[0].init?.redirect).toBe('error');
    expect(calls[0].init?.cache).toBe('no-store');
    expect(calls[0].init?.credentials).toBe('omit');
    expect((calls[0].init as RequestInit & { targetAddressSpace?: string })?.targetAddressSpace).toBe('loopback');
    expect(calls[0].init?.signal).toBeInstanceOf(AbortSignal);
  });

  test('POST search validates request, sends bearer only to loopback, and validates response envelope', async () => {
    const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push({ input, init });
      return jsonResponse({
        schema: 'trama.semantic-memory-search-response/v1',
        hits: [],
      });
    };

    const client = createSemanticMemoryHttpClient(
      { endpointUrl: 'http://localhost:8765', token: 'session-secret' },
      { fetchImpl },
    );
    const result = await client.search({
      schema: 'trama.semantic-memory-search-request/v1',
      query: 'energia idroelettrica',
      namespaces: ['registro/library'],
      allowedDataClasses: ['TEACHER_PROFESSIONAL'],
      limit: 8,
    });

    expect(result).toEqual({ schema: 'trama.semantic-memory-search-response/v1', hits: [] });
    expect(calls).toHaveLength(1);
    expect(String(calls[0].input)).toBe('http://localhost:8765/v1/search');
    expect(calls[0].init?.method).toBe('POST');
    const headers = new Headers(calls[0].init?.headers);
    expect(headers.get('Authorization')).toBe('Bearer session-secret');
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(JSON.parse(String(calls[0].init?.body))).toMatchObject({
      schema: 'trama.semantic-memory-search-request/v1',
      namespaces: ['registro/library'],
      limit: 8,
    });
  });

  test('invalid mutation request fails before fetch', async () => {
    let calls = 0;
    const fetchImpl: typeof fetch = async () => {
      calls += 1;
      return jsonResponse({});
    };
    const client = createSemanticMemoryHttpClient(
      { endpointUrl: 'http://127.0.0.1:8765', token: 'session-secret' },
      { fetchImpl },
    );

    await expect(client.upsert({
      schema: 'trama.semantic-memory-upsert-request/v1',
      projection: {
        schema: 'trama.semantic-memory-projection/v1',
        sourceAppId: 'registro-docente',
        sourceType: 'library-source',
        sourceId: 'source-1',
        revision: 'r1',
        namespace: 'registro/library',
        text: 'testo sintetico',
        dataClass: 'TEACHER_PROFESSIONAL',
        canonicalRef: 'registro://library/source/source-1',
        updatedAt: '2026-10-31T05:30:00.000Z',
      },
    } as never)).rejects.toThrow();
    expect(calls).toBe(0);
  });

  test('409 revision conflict is distinct from technical HTTP failures', async () => {
    const conflictClient = createSemanticMemoryHttpClient(
      { endpointUrl: 'http://127.0.0.1:8765', token: 'session-secret' },
      { fetchImpl: async () => jsonResponse({ error: 'revision_conflict' }, 409) },
    );
    await expect(conflictClient.remove({
      schema: 'trama.semantic-memory-remove-request/v1',
      source: { sourceAppId: 'registro-docente', sourceType: 'library-source', sourceId: 'source-1' },
      expectedRevision: 'r1',
    })).rejects.toBeInstanceOf(SemanticMemoryRevisionConflictError);

    const unavailableClient = createSemanticMemoryHttpClient(
      { endpointUrl: 'http://127.0.0.1:8765', token: 'session-secret' },
      { fetchImpl: async () => jsonResponse({ error: 'service_unavailable' }, 503) },
    );
    try {
      await unavailableClient.health();
      throw new Error('expected health to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(SemanticMemoryHttpError);
      expect(error).not.toBeInstanceOf(SemanticMemoryRevisionConflictError);
      expect((error as SemanticMemoryHttpError).code).toBe('HTTP_503');
    }
  });

  test('malformed shared response fails closed', async () => {
    const client = createSemanticMemoryHttpClient(
      { endpointUrl: 'http://[::1]:8765', token: 'session-secret' },
      { fetchImpl: async () => jsonResponse({ ...READY_HEALTH, protocolVersion: 2 }) },
    );

    try {
      await client.health();
      throw new Error('expected validation failure');
    } catch (error) {
      expect(error).toBeInstanceOf(SemanticMemoryHttpError);
      expect((error as SemanticMemoryHttpError).code).toBe('INVALID_RESPONSE');
    }
  });
});

describe('LSM-01C-A governed Registro projections', () => {
  test('Library projection is teacher-professional only and preserves the qualified semantic text order', async () => {
    const eligible = librarySource();
    const projections = await buildLibrarySemanticMemoryProjections([
      eligible,
      librarySource({ id: 'student', privacy: 'student-personal' }),
      librarySource({ id: 'unknown', privacy: 'unknown' }),
      librarySource({ id: 'restricted', status: 'restricted' }),
      librarySource({ id: 'failed', status: 'failed' }),
      librarySource({ id: 'empty', title: ' ', extractedText: ' ', payload: { text: ' ' }, notes: ' ' }),
    ]);

    expect(projections).toHaveLength(1);
    expect(projections[0]).toMatchObject({
      schema: 'trama.semantic-memory-projection/v1',
      sourceAppId: 'registro-docente',
      sourceType: 'library-source',
      sourceId: 'source-1',
      namespace: 'registro/library',
      title: 'Energia idroelettrica',
      text: 'Energia idroelettrica Estratto turbine generatori Payload energia acqua Nota professionale',
      dataClass: 'TEACHER_PROFESSIONAL',
      canonicalRef: 'registro://library/source/source-1',
      updatedAt: eligible.capturedAt,
      metadata: { kind: 'text', privacy: 'teacher-professional' },
    });
    expect(projections[0].revision).toMatch(/^[0-9a-f]{64}$/);
  });

  test('Library revision is deterministic, changes with semantic content, and privacy downgrade removes the projection', async () => {
    const source = librarySource();
    const [first] = await buildLibrarySemanticMemoryProjections([source]);
    const [same] = await buildLibrarySemanticMemoryProjections([{ ...source }]);
    const [changed] = await buildLibrarySemanticMemoryProjections([{ ...source, notes: 'Nota modificata' }]);
    const downgraded = await buildLibrarySemanticMemoryProjections([{ ...source, privacy: 'student-personal' }]);

    expect(first.revision).toBe(same.revision);
    expect(changed.revision).not.toBe(first.revision);
    expect(downgraded).toEqual([]);
  });

  test('Professional Memory projects active entries only with explicit LSM data-class mapping', async () => {
    const state = memoryState([
      memoryEntry('teacher', 'TEACHER_PROFESSIONAL'),
      memoryEntry('curricolo', 'CURRICULUM_PLANNING'),
      memoryEntry('public', 'PUBLIC_EXTERNAL_CONTENT'),
      memoryEntry('aggregate', 'AGGREGATED_NON_IDENTIFIABLE'),
      memoryEntry('stale', 'TEACHER_PROFESSIONAL', { status: 'stale' }),
    ]);

    const projections = await buildProfessionalMemoryProjections(state);
    expect(projections.map(item => [item.sourceId, item.dataClass])).toEqual([
      ['aggregate', 'AGGREGATED_NON_IDENTIFIABLE'],
      ['curricolo', 'CURRICOLO'],
      ['public', 'PUBLIC_APP'],
      ['teacher', 'TEACHER_PROFESSIONAL'],
    ]);
    for (const projection of projections) {
      expect(projection.sourceAppId).toBe('registro-docente');
      expect(projection.sourceType).toBe('professional-memory-entry');
      expect(projection.namespace).toBe('registro/professional-memory');
      expect(projection.canonicalRef).toBe(`registro://professional-memory/entry/${projection.sourceId}`);
      expect(projection.revision).toMatch(/^[0-9a-f]{64}$/);
      expect(projection.metadata).toMatchObject({ category: 'didactic-pattern', provenanceKind: 'teacher-explicit' });
    }
  });
});