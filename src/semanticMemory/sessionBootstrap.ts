import type { SemanticMemoryHealthV1 } from '../../vendor/contextual-copilot-semantic-memory/index';
import { validateSemanticMemoryHealth } from '../../vendor/contextual-copilot-semantic-memory/src/index.js';
import { normalizeLoopbackEndpoint } from './httpClient';

export interface SemanticMemorySessionBootstrapResult {
  token: string;
  expiresAt: string;
  health: SemanticMemoryHealthV1;
}

export interface SemanticMemorySessionBootstrapInput {
  endpointUrl: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

type LoopbackRequestInit = RequestInit & {
  targetAddressSpace?: 'loopback';
};

const DEFAULT_TIMEOUT_MS = 10_000;
const SESSION_SCHEMA = 'trama.semantic-memory-session/v1';

export class SemanticMemorySessionBootstrapError extends Error {
  readonly code: string;
  readonly status: number | null;

  constructor(code: string, status: number | null = null) {
    super(`Semantic memory session bootstrap failed: ${code}`);
    this.name = 'SemanticMemorySessionBootstrapError';
    this.code = code;
    this.status = status;
  }
}

function validateSessionPayload(input: unknown): SemanticMemorySessionBootstrapResult {
  if (!input || typeof input !== 'object') {
    throw new SemanticMemorySessionBootstrapError('INVALID_RESPONSE');
  }
  const candidate = input as Record<string, unknown>;
  if (candidate.schema !== SESSION_SCHEMA) {
    throw new SemanticMemorySessionBootstrapError('INVALID_RESPONSE');
  }
  if (typeof candidate.token !== 'string' || candidate.token.trim() === '') {
    throw new SemanticMemorySessionBootstrapError('INVALID_RESPONSE');
  }
  if (typeof candidate.expiresAt !== 'string') {
    throw new SemanticMemorySessionBootstrapError('INVALID_RESPONSE');
  }
  const expiresAtMs = Date.parse(candidate.expiresAt);
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
    throw new SemanticMemorySessionBootstrapError('INVALID_RESPONSE');
  }

  let health: SemanticMemoryHealthV1;
  try {
    health = validateSemanticMemoryHealth(candidate.health);
  } catch {
    throw new SemanticMemorySessionBootstrapError('INVALID_RESPONSE');
  }

  return {
    token: candidate.token,
    expiresAt: candidate.expiresAt,
    health,
  };
}

export async function activateSemanticMemorySession({
  endpointUrl,
  fetchImpl = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: SemanticMemorySessionBootstrapInput): Promise<SemanticMemorySessionBootstrapResult> {
  const endpoint = normalizeLoopbackEndpoint(endpointUrl);
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new TypeError('Semantic memory timeout must be a positive number');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const requestInit: LoopbackRequestInit = {
    method: 'POST',
    redirect: 'error',
    cache: 'no-store',
    credentials: 'omit',
    signal: controller.signal,
    targetAddressSpace: 'loopback',
  };

  try {
    const response = await fetchImpl(`${endpoint}/v1/session`, requestInit);
    if (!response.ok) {
      throw new SemanticMemorySessionBootstrapError(`HTTP_${response.status}`, response.status);
    }
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new SemanticMemorySessionBootstrapError('INVALID_RESPONSE');
    }
    return validateSessionPayload(payload);
  } catch (error) {
    if (error instanceof SemanticMemorySessionBootstrapError) {
      throw error;
    }
    if (controller.signal.aborted) {
      throw new SemanticMemorySessionBootstrapError('TIMEOUT');
    }
    throw new SemanticMemorySessionBootstrapError('NETWORK_ERROR');
  } finally {
    clearTimeout(timer);
  }
}
