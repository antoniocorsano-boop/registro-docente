import { describe, expect, test } from 'bun:test';
import type {
  LocalSemanticMemoryPort,
  SemanticMemoryHealthV1,
  SemanticMemoryProjectionV1,
  SemanticMemoryRemoveReceiptV1,
  SemanticMemoryRemoveRequestV1,
  SemanticMemorySearchRequestV1,
  SemanticMemorySearchResponseV1,
  SemanticMemoryUpsertReceiptV1,
  SemanticMemoryUpsertRequestV1,
} from '../../vendor/contextual-copilot-semantic-memory/index';
import {
  SemanticMemoryHttpError,
  SemanticMemoryRevisionConflictError,
} from './httpClient';
import {
  loadSemanticMemorySyncLedger,
  saveSemanticMemorySyncLedger,
  semanticMemorySourceKey,
} from './syncLedger';
import { syncRegistroSemanticMemory } from './sync';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return Array.from(this.values.keys())[index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

const ENDPOINT = 'http://127.0.0.1:8765';
const READY: SemanticMemoryHealthV1 = {
  schema: 'trama.semantic-memory-health/v1',
  status: 'ready',
  protocolVersion: 1,
  modelId: 'embeddinggemma-2-local',
  dimensions: 768,
  indexRevision: '4',
};

function projection(sourceId: string, revision: string, text = `professional text sentinel ${sourceId}`): SemanticMemoryProjectionV1 {
  return {
    schema: 'trama.semantic-memory-projection/v1',
    sourceAppId: 'registro-docente',
    sourceType: 'library-source',
    sourceId,
    revision,
    namespace: 'registro/library',
    title: `Source ${sourceId}`,
    text,
    dataClass: 'TEACHER_PROFESSIONAL',
    canonicalRef: `registro://library/source/${sourceId}`,
    updatedAt: '2026-10-31T05:30:00.000Z',
    metadata: { kind: 'text', privacy: 'teacher-professional' },
  };
}

class RecordingPort implements LocalSemanticMemoryPort {
  readonly mode = 'local' as const;
  readonly upsertCalls: SemanticMemoryUpsertRequestV1[] = [];
  readonly removeCalls: SemanticMemoryRemoveRequestV1[] = [];

  constructor(
    private healthValue: SemanticMemoryHealthV1 = READY,
    private readonly upsertImpl: (request: SemanticMemoryUpsertRequestV1, index: number) => Promise<SemanticMemoryUpsertReceiptV1> = async request => ({
      schema: 'trama.semantic-memory-upsert-receipt/v1',
      status: request.expectedRevision === null ? 'inserted' : 'replaced',
      source: {
        sourceAppId: request.projection.sourceAppId,
        sourceType: request.projection.sourceType,
        sourceId: request.projection.sourceId,
      },
      revision: request.projection.revision,
    }),
    private readonly removeImpl: (request: SemanticMemoryRemoveRequestV1, index: number) => Promise<SemanticMemoryRemoveReceiptV1> = async request => ({
      schema: 'trama.semantic-memory-remove-receipt/v1',
      status: 'removed',
      source: request.source,
      revision: request.expectedRevision,
    }),
  ) {}

  async health(): Promise<SemanticMemoryHealthV1> {
    return this.healthValue;
  }

  setHealth(value: SemanticMemoryHealthV1): void {
    this.healthValue = value;
  }

  async upsert(request: SemanticMemoryUpsertRequestV1): Promise<SemanticMemoryUpsertReceiptV1> {
    this.upsertCalls.push(request);
    return this.upsertImpl(request, this.upsertCalls.length - 1);
  }

  async remove(request: SemanticMemoryRemoveRequestV1): Promise<SemanticMemoryRemoveReceiptV1> {
    this.removeCalls.push(request);
    return this.removeImpl(request, this.removeCalls.length - 1);
  }

  async search(_request: SemanticMemorySearchRequestV1): Promise<SemanticMemorySearchResponseV1> {
    return { schema: 'trama.semantic-memory-search-response/v1', hits: [] };
  }
}

describe('LSM-01C-A explicit CAS synchronization', () => {
  test('first upsert uses null CAS, later replacement uses the last observed revision', async () => {
    const storage = new MemoryStorage();
    const port = new RecordingPort();

    const first = await syncRegistroSemanticMemory({
      port,
      endpoint: ENDPOINT,
      projections: [projection('source-1', 'rev-1')],
      storage,
    });
    const second = await syncRegistroSemanticMemory({
      port,
      endpoint: ENDPOINT,
      projections: [projection('source-1', 'rev-2')],
      storage,
    });

    expect(first.status).toBe('synced');
    expect(second.status).toBe('synced');
    expect(port.upsertCalls.map(call => call.expectedRevision)).toEqual([null, 'rev-1']);
    expect(loadSemanticMemorySyncLedger(ENDPOINT, storage).sources[
      semanticMemorySourceKey({ sourceAppId: 'registro-docente', sourceType: 'library-source', sourceId: 'source-1' })
    ]?.revision).toBe('rev-2');
  });

  test('unchanged receipt is accepted and stale desired absence removes with CAS', async () => {
    const storage = new MemoryStorage();
    const source = { sourceAppId: 'registro-docente', sourceType: 'library-source', sourceId: 'source-1' };
    const key = semanticMemorySourceKey(source);
    saveSemanticMemorySyncLedger({
      schema: 'registro.semantic-memory-sync-ledger/v1',
      endpoint: ENDPOINT,
      sources: { [key]: { revision: 'rev-1' } },
    }, storage);

    const unchangedPort = new RecordingPort(READY, async request => ({
      schema: 'trama.semantic-memory-upsert-receipt/v1',
      status: 'unchanged',
      source,
      revision: request.projection.revision,
    }));
    const unchanged = await syncRegistroSemanticMemory({
      port: unchangedPort,
      endpoint: ENDPOINT,
      projections: [projection('source-1', 'rev-1')],
      storage,
    });
    expect(unchanged.counts.unchanged).toBe(1);

    const removePort = new RecordingPort();
    const removed = await syncRegistroSemanticMemory({ port: removePort, endpoint: ENDPOINT, projections: [], storage });
    expect(removed.status).toBe('synced');
    expect(removePort.removeCalls).toEqual([{
      schema: 'trama.semantic-memory-remove-request/v1',
      source,
      expectedRevision: 'rev-1',
    }]);
    expect(loadSemanticMemorySyncLedger(ENDPOINT, storage).sources).toEqual({});
  });

  test('rebuild-required stops before every mutation', async () => {
    const port = new RecordingPort({ ...READY, status: 'rebuild-required' });
    const result = await syncRegistroSemanticMemory({
      port,
      endpoint: ENDPOINT,
      projections: [projection('source-1', 'rev-1')],
      storage: new MemoryStorage(),
    });

    expect(result.status).toBe('rebuild-required');
    expect(port.upsertCalls).toHaveLength(0);
    expect(port.removeCalls).toHaveLength(0);
  });

  test('runtime index revision zero invalidates stale endpoint ledger before first upsert', async () => {
    const storage = new MemoryStorage();
    const source = { sourceAppId: 'registro-docente', sourceType: 'library-source', sourceId: 'source-1' };
    const key = semanticMemorySourceKey(source);
    saveSemanticMemorySyncLedger({
      schema: 'registro.semantic-memory-sync-ledger/v1',
      endpoint: ENDPOINT,
      sources: { [key]: { revision: 'stale-revision' } },
    }, storage);
    const port = new RecordingPort({ ...READY, indexRevision: '0', modelId: null, dimensions: null });

    const result = await syncRegistroSemanticMemory({
      port,
      endpoint: ENDPOINT,
      projections: [projection('source-1', 'rev-new')],
      storage,
    });

    expect(result.status).toBe('synced');
    expect(port.upsertCalls[0]?.expectedRevision).toBeNull();
    expect(loadSemanticMemorySyncLedger(ENDPOINT, storage).sources[key]?.revision).toBe('rev-new');
  });

  test('lost ledger revision conflict surfaces reconciliation-required without retry or overwrite', async () => {
    const port = new RecordingPort(READY, async () => {
      throw new SemanticMemoryRevisionConflictError();
    });

    const result = await syncRegistroSemanticMemory({
      port,
      endpoint: ENDPOINT,
      projections: [projection('source-1', 'rev-1')],
      storage: new MemoryStorage(),
    });

    expect(result.status).toBe('reconciliation-required');
    expect(result.errorCode).toBe('REVISION_CONFLICT');
    expect(port.upsertCalls).toHaveLength(1);
    expect(port.upsertCalls[0]?.expectedRevision).toBeNull();
    expect(port.removeCalls).toHaveLength(0);
  });

  test('partial failure preserves already committed receipts and result exposes no professional text', async () => {
    const storage = new MemoryStorage();
    const port = new RecordingPort(READY, async (request, index) => {
      if (index === 1) throw new SemanticMemoryHttpError('NETWORK_ERROR');
      return {
        schema: 'trama.semantic-memory-upsert-receipt/v1',
        status: 'inserted',
        source: {
          sourceAppId: request.projection.sourceAppId,
          sourceType: request.projection.sourceType,
          sourceId: request.projection.sourceId,
        },
        revision: request.projection.revision,
      };
    });

    const result = await syncRegistroSemanticMemory({
      port,
      endpoint: ENDPOINT,
      projections: [
        projection('a-source', 'rev-a', 'professional text sentinel alpha'),
        projection('b-source', 'rev-b', 'professional text sentinel beta'),
      ],
      storage,
    });

    expect(result.status).toBe('failed');
    expect(result.errorCode).toBe('NETWORK_ERROR');
    expect(result.counts.inserted).toBe(1);
    const ledger = loadSemanticMemorySyncLedger(ENDPOINT, storage);
    expect(ledger.sources[semanticMemorySourceKey({
      sourceAppId: 'registro-docente', sourceType: 'library-source', sourceId: 'a-source',
    })]?.revision).toBe('rev-a');
    expect(ledger.sources[semanticMemorySourceKey({
      sourceAppId: 'registro-docente', sourceType: 'library-source', sourceId: 'b-source',
    })]).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain('professional text sentinel');
  });
});
