import type { SemanticMemorySourceRefV1 } from '../../vendor/contextual-copilot-semantic-memory/index';

export interface SemanticMemorySyncLedgerV1 {
  schema: 'registro.semantic-memory-sync-ledger/v1';
  endpoint: string;
  sources: Record<string, { revision: string }>;
}

const LEDGER_SCHEMA = 'registro.semantic-memory-sync-ledger/v1' as const;
const STORAGE_PREFIX = 'registro.semantic-memory-sync-ledger.v1:';
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);

function nonBlank(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeEndpoint(rawEndpoint: string): string {
  if (!nonBlank(rawEndpoint)) {
    throw new TypeError('Semantic memory ledger endpoint is required');
  }

  let url: URL;
  try {
    url = new URL(rawEndpoint.trim());
  } catch {
    throw new TypeError('Semantic memory ledger endpoint must be a valid URL');
  }

  if (url.protocol !== 'http:' || !LOOPBACK_HOSTS.has(url.hostname.toLowerCase())) {
    throw new TypeError('Semantic memory ledger endpoint must be HTTP loopback');
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new TypeError('Semantic memory ledger endpoint must not contain credentials, query or fragment');
  }
  if (url.pathname !== '/' && url.pathname !== '') {
    throw new TypeError('Semantic memory ledger endpoint must not contain a path');
  }

  return url.origin;
}

function storageKey(endpoint: string): string {
  return `${STORAGE_PREFIX}${encodeURIComponent(normalizeEndpoint(endpoint))}`;
}

function resolveStorage(storage?: Storage): Storage {
  if (storage) return storage;
  if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  throw new Error('Semantic memory sync ledger storage is unavailable');
}

function hasOnlyKeys(record: Record<string, unknown>, allowed: readonly string[]): boolean {
  const allowedSet = new Set(allowed);
  return Object.keys(record).every(key => allowedSet.has(key));
}

export function semanticMemorySourceKey(source: SemanticMemorySourceRefV1): string {
  if (!nonBlank(source.sourceAppId) || !nonBlank(source.sourceType) || !nonBlank(source.sourceId)) {
    throw new TypeError('Semantic memory source identity must be non-empty');
  }
  return [source.sourceAppId, source.sourceType, source.sourceId]
    .map(value => encodeURIComponent(value))
    .join('|');
}

export function parseSemanticMemorySourceKey(key: string): SemanticMemorySourceRefV1 | null {
  if (!nonBlank(key)) return null;
  const parts = key.split('|');
  if (parts.length !== 3) return null;

  try {
    const [sourceAppId, sourceType, sourceId] = parts.map(part => decodeURIComponent(part));
    if (!nonBlank(sourceAppId) || !nonBlank(sourceType) || !nonBlank(sourceId)) return null;
    return { sourceAppId, sourceType, sourceId };
  } catch {
    return null;
  }
}

export function createEmptySemanticMemorySyncLedger(endpoint: string): SemanticMemorySyncLedgerV1 {
  return {
    schema: LEDGER_SCHEMA,
    endpoint: normalizeEndpoint(endpoint),
    sources: {},
  };
}

function parseLedger(input: unknown, endpoint: string): SemanticMemorySyncLedgerV1 | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const record = input as Record<string, unknown>;
  if (!hasOnlyKeys(record, ['schema', 'endpoint', 'sources'])) return null;
  if (record.schema !== LEDGER_SCHEMA || !nonBlank(record.endpoint)) return null;

  let normalizedStoredEndpoint: string;
  try {
    normalizedStoredEndpoint = normalizeEndpoint(record.endpoint);
  } catch {
    return null;
  }
  const normalizedEndpoint = normalizeEndpoint(endpoint);
  if (normalizedStoredEndpoint !== normalizedEndpoint) return null;

  if (!record.sources || typeof record.sources !== 'object' || Array.isArray(record.sources)) return null;
  const sourcesInput = record.sources as Record<string, unknown>;
  const sources: Record<string, { revision: string }> = {};

  for (const [key, value] of Object.entries(sourcesInput)) {
    if (parseSemanticMemorySourceKey(key) === null) return null;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const revisionRecord = value as Record<string, unknown>;
    if (!hasOnlyKeys(revisionRecord, ['revision']) || !nonBlank(revisionRecord.revision)) return null;
    sources[key] = { revision: revisionRecord.revision };
  }

  return {
    schema: LEDGER_SCHEMA,
    endpoint: normalizedEndpoint,
    sources,
  };
}

export function loadSemanticMemorySyncLedger(
  endpoint: string,
  storage?: Storage,
): SemanticMemorySyncLedgerV1 {
  const empty = createEmptySemanticMemorySyncLedger(endpoint);
  const backing = resolveStorage(storage);
  const raw = backing.getItem(storageKey(endpoint));
  if (raw === null) return empty;

  try {
    return parseLedger(JSON.parse(raw), endpoint) ?? empty;
  } catch {
    return empty;
  }
}

export function saveSemanticMemorySyncLedger(
  ledger: SemanticMemorySyncLedgerV1,
  storage?: Storage,
): void {
  const normalized = parseLedger(ledger, ledger.endpoint);
  if (!normalized) {
    throw new TypeError('Semantic memory sync ledger is invalid');
  }

  resolveStorage(storage).setItem(
    storageKey(normalized.endpoint),
    JSON.stringify(normalized),
  );
}

export function clearSemanticMemorySyncLedger(endpoint: string, storage?: Storage): void {
  resolveStorage(storage).removeItem(storageKey(endpoint));
}
