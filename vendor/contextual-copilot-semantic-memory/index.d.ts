export type SemanticMemoryDataClass =
  | 'PUBLIC_APP'
  | 'TEACHER_PROFESSIONAL'
  | 'CURRICOLO'
  | 'AGGREGATED_NON_IDENTIFIABLE';

export const SEMANTIC_MEMORY_DATA_CLASSES: readonly SemanticMemoryDataClass[];

export interface SemanticMemoryProjectionV1 {
  schema: 'trama.semantic-memory-projection/v1';
  sourceAppId: string;
  sourceType: string;
  sourceId: string;
  revision: string;
  namespace: string;
  title?: string;
  text: string;
  dataClass: SemanticMemoryDataClass;
  canonicalRef: string;
  updatedAt: string;
  metadata?: Readonly<Record<string, string>>;
}

export interface SemanticMemorySearchRequestV1 {
  schema: 'trama.semantic-memory-search-request/v1';
  query: string;
  namespaces: readonly string[];
  allowedDataClasses: readonly SemanticMemoryDataClass[];
  limit: number;
}

export interface SemanticMemoryHitV1 {
  sourceAppId: string;
  sourceType: string;
  sourceId: string;
  revision: string;
  namespace: string;
  canonicalRef: string;
  chunkId: string;
  text: string;
  score: number;
  dataClass: SemanticMemoryDataClass;
  metadata: Readonly<Record<string, string>>;
}

export interface SemanticMemorySearchResponseV1 {
  schema: 'trama.semantic-memory-search-response/v1';
  hits: readonly SemanticMemoryHitV1[];
}

export interface SemanticMemorySourceRefV1 {
  sourceAppId: string;
  sourceType: string;
  sourceId: string;
}

export interface SemanticMemoryUpsertRequestV1 {
  schema: 'trama.semantic-memory-upsert-request/v1';
  projection: SemanticMemoryProjectionV1;
  expectedRevision: string | null;
}

export interface SemanticMemoryRemoveRequestV1 {
  schema: 'trama.semantic-memory-remove-request/v1';
  source: SemanticMemorySourceRefV1;
  expectedRevision: string | null;
}

export interface SemanticMemoryHealthV1 {
  schema: 'trama.semantic-memory-health/v1';
  status: 'ready' | 'degraded' | 'rebuild-required';
  protocolVersion: 1;
  modelId: string | null;
  dimensions: number | null;
  indexRevision: string;
}

export interface SemanticMemoryUpsertReceiptV1 {
  schema: 'trama.semantic-memory-upsert-receipt/v1';
  status: 'inserted' | 'replaced' | 'unchanged';
  source: SemanticMemorySourceRefV1;
  revision: string;
}

export interface SemanticMemoryRemoveReceiptV1 {
  schema: 'trama.semantic-memory-remove-receipt/v1';
  status: 'removed' | 'absent';
  source: SemanticMemorySourceRefV1;
  revision: string | null;
}

export interface LocalSemanticMemoryPort {
  mode: 'local';
  health(): Promise<SemanticMemoryHealthV1>;
  upsert(request: SemanticMemoryUpsertRequestV1): Promise<SemanticMemoryUpsertReceiptV1>;
  remove(request: SemanticMemoryRemoveRequestV1): Promise<SemanticMemoryRemoveReceiptV1>;
  search(request: SemanticMemorySearchRequestV1): Promise<SemanticMemorySearchResponseV1>;
}

export function validateSemanticMemoryProjection(input: unknown): SemanticMemoryProjectionV1;
export function validateSemanticMemorySearchRequest(input: unknown): SemanticMemorySearchRequestV1;
export function validateSemanticMemoryHit(input: unknown): SemanticMemoryHitV1;
export function validateSemanticMemorySearchResponse(
  input: unknown,
  request?: SemanticMemorySearchRequestV1
): SemanticMemorySearchResponseV1;
export function validateSemanticMemorySourceRef(input: unknown): SemanticMemorySourceRefV1;
export function validateSemanticMemoryUpsertRequest(input: unknown): SemanticMemoryUpsertRequestV1;
export function validateSemanticMemoryRemoveRequest(input: unknown): SemanticMemoryRemoveRequestV1;
export function validateSemanticMemoryHealth(input: unknown): SemanticMemoryHealthV1;
export function validateSemanticMemoryUpsertReceipt(input: unknown): SemanticMemoryUpsertReceiptV1;
export function validateSemanticMemoryRemoveReceipt(input: unknown): SemanticMemoryRemoveReceiptV1;
