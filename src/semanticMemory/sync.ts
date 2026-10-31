import type {
  LocalSemanticMemoryPort,
  SemanticMemoryHealthV1,
  SemanticMemoryProjectionV1,
  SemanticMemorySourceRefV1,
} from '../../vendor/contextual-copilot-semantic-memory/index';
import {
  SemanticMemoryHttpError,
  SemanticMemoryRevisionConflictError,
} from './httpClient';
import {
  clearSemanticMemorySyncLedger,
  createEmptySemanticMemorySyncLedger,
  loadSemanticMemorySyncLedger,
  parseSemanticMemorySourceKey,
  saveSemanticMemorySyncLedger,
  semanticMemorySourceKey,
  type SemanticMemorySyncLedgerV1,
} from './syncLedger';

export type SemanticMemorySyncStatus =
  | 'synced'
  | 'reconciliation-required'
  | 'rebuild-required'
  | 'failed';

export interface SemanticMemorySyncCounts {
  inserted: number;
  replaced: number;
  unchanged: number;
  removed: number;
  absent: number;
}

export interface SemanticMemorySyncResult {
  status: SemanticMemorySyncStatus;
  healthStatus: SemanticMemoryHealthV1['status'] | 'unknown';
  indexRevision: string | null;
  counts: SemanticMemorySyncCounts;
  errorCode?: string;
}

export interface SyncRegistroSemanticMemoryInput {
  port: LocalSemanticMemoryPort;
  endpoint: string;
  projections: readonly SemanticMemoryProjectionV1[];
  storage?: Storage;
}

function emptyCounts(): SemanticMemorySyncCounts {
  return { inserted: 0, replaced: 0, unchanged: 0, removed: 0, absent: 0 };
}

function sourceOf(projection: SemanticMemoryProjectionV1): SemanticMemorySourceRefV1 {
  return {
    sourceAppId: projection.sourceAppId,
    sourceType: projection.sourceType,
    sourceId: projection.sourceId,
  };
}

function sameSource(left: SemanticMemorySourceRefV1, right: SemanticMemorySourceRefV1): boolean {
  return left.sourceAppId === right.sourceAppId
    && left.sourceType === right.sourceType
    && left.sourceId === right.sourceId;
}

function errorCode(error: unknown): string {
  if (error instanceof SemanticMemoryRevisionConflictError) return 'REVISION_CONFLICT';
  if (error instanceof SemanticMemoryHttpError) return error.code;
  return 'SYNC_FAILED';
}

function failureResult(
  error: unknown,
  health: SemanticMemoryHealthV1 | null,
  counts: SemanticMemorySyncCounts,
): SemanticMemorySyncResult {
  const code = errorCode(error);
  return {
    status: code === 'REVISION_CONFLICT' ? 'reconciliation-required' : 'failed',
    healthStatus: health?.status ?? 'unknown',
    indexRevision: health?.indexRevision ?? null,
    counts: { ...counts },
    errorCode: code,
  };
}

function saveLedger(ledger: SemanticMemorySyncLedgerV1, storage?: Storage): void {
  saveSemanticMemorySyncLedger({
    schema: ledger.schema,
    endpoint: ledger.endpoint,
    sources: { ...ledger.sources },
  }, storage);
}

export async function syncRegistroSemanticMemory(
  input: SyncRegistroSemanticMemoryInput,
): Promise<SemanticMemorySyncResult> {
  const counts = emptyCounts();
  let health: SemanticMemoryHealthV1 | null = null;

  try {
    health = await input.port.health();
  } catch (error) {
    return failureResult(error, null, counts);
  }

  if (health.status === 'rebuild-required') {
    return {
      status: 'rebuild-required',
      healthStatus: health.status,
      indexRevision: health.indexRevision,
      counts,
    };
  }

  let ledger: SemanticMemorySyncLedgerV1;
  try {
    if (health.indexRevision === '0') {
      clearSemanticMemorySyncLedger(input.endpoint, input.storage);
      ledger = createEmptySemanticMemorySyncLedger(input.endpoint);
    } else {
      ledger = loadSemanticMemorySyncLedger(input.endpoint, input.storage);
    }
  } catch (error) {
    return failureResult(error, health, counts);
  }

  const ordered = [...input.projections].sort((left, right) => {
    return semanticMemorySourceKey(sourceOf(left)).localeCompare(semanticMemorySourceKey(sourceOf(right)));
  });
  const desiredKeys = new Set<string>();
  for (const projection of ordered) {
    const key = semanticMemorySourceKey(sourceOf(projection));
    if (desiredKeys.has(key)) {
      return {
        status: 'failed',
        healthStatus: health.status,
        indexRevision: health.indexRevision,
        counts,
        errorCode: 'DUPLICATE_SOURCE',
      };
    }
    desiredKeys.add(key);
  }

  try {
    for (const projection of ordered) {
      const source = sourceOf(projection);
      const key = semanticMemorySourceKey(source);
      const expectedRevision = ledger.sources[key]?.revision ?? null;
      const receipt = await input.port.upsert({
        schema: 'trama.semantic-memory-upsert-request/v1',
        projection,
        expectedRevision,
      });

      if (!sameSource(receipt.source, source) || receipt.revision !== projection.revision) {
        return {
          status: 'failed',
          healthStatus: health.status,
          indexRevision: health.indexRevision,
          counts: { ...counts },
          errorCode: 'INVALID_RECEIPT',
        };
      }

      counts[receipt.status] += 1;
      ledger.sources[key] = { revision: receipt.revision };
      saveLedger(ledger, input.storage);
    }

    const staleKeys = Object.keys(ledger.sources)
      .filter(key => !desiredKeys.has(key))
      .sort();

    for (const key of staleKeys) {
      const source = parseSemanticMemorySourceKey(key);
      const expectedRevision = ledger.sources[key]?.revision ?? null;
      if (!source || expectedRevision === null) {
        return {
          status: 'failed',
          healthStatus: health.status,
          indexRevision: health.indexRevision,
          counts: { ...counts },
          errorCode: 'INVALID_LEDGER',
        };
      }

      const receipt = await input.port.remove({
        schema: 'trama.semantic-memory-remove-request/v1',
        source,
        expectedRevision,
      });
      if (!sameSource(receipt.source, source)) {
        return {
          status: 'failed',
          healthStatus: health.status,
          indexRevision: health.indexRevision,
          counts: { ...counts },
          errorCode: 'INVALID_RECEIPT',
        };
      }
      if (receipt.status === 'removed' && receipt.revision !== expectedRevision) {
        return {
          status: 'failed',
          healthStatus: health.status,
          indexRevision: health.indexRevision,
          counts: { ...counts },
          errorCode: 'INVALID_RECEIPT',
        };
      }
      if (receipt.status === 'absent' && receipt.revision !== null) {
        return {
          status: 'failed',
          healthStatus: health.status,
          indexRevision: health.indexRevision,
          counts: { ...counts },
          errorCode: 'INVALID_RECEIPT',
        };
      }

      counts[receipt.status] += 1;
      delete ledger.sources[key];
      saveLedger(ledger, input.storage);
    }
  } catch (error) {
    return failureResult(error, health, counts);
  }

  return {
    status: 'synced',
    healthStatus: health.status,
    indexRevision: health.indexRevision,
    counts: { ...counts },
  };
}
