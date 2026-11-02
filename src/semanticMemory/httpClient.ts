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
import {
  validateSemanticMemoryHealth,
  validateSemanticMemoryRemoveReceipt,
  validateSemanticMemoryRemoveRequest,
  validateSemanticMemorySearchRequest,
  validateSemanticMemorySearchResponse,
  validateSemanticMemoryUpsertReceipt,
  validateSemanticMemoryUpsertRequest,
} from '../../vendor/contextual-copilot-semantic-memory/src/index.js';

export interface SemanticMemorySessionConfig {
  endpointUrl: string;
  token: string;
}

export interface SemanticMemoryHttpClientOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

type LoopbackRequestInit = RequestInit & {
  targetAddressSpace?: 'loopback';
};

const DEFAULT_TIMEOUT_MS = 10_000;
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);

export class SemanticMemoryHttpError extends Error {
  readonly code: string;
  readonly status: number | null;

  constructor(code: string, status: number | null = null) {
    super(`Semantic memory request failed: ${code}`);
    this.name = 'SemanticMemoryHttpError';
    this.code = code;
    this.status = status;
  }
}

export class SemanticMemoryRevisionConflictError extends SemanticMemoryHttpError {
  constructor() {
    super('REVISION_CONFLICT', 409);
    this.name = 'SemanticMemoryRevisionConflictError';
  }
}

function normalizeLoopbackEndpoint(rawEndpoint: string): string {
  const trimmed = rawEndpoint.trim();
  if (!trimmed) {
    throw new TypeError('Semantic memory endpoint is required');
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new TypeError('Semantic memory endpoint must be a valid URL');
  }

  if (url.protocol !== 'http:') {
    throw new TypeError('Semantic memory endpoint must use HTTP loopback');
  }
  if (!LOOPBACK_HOSTS.has(url.hostname.toLowerCase())) {
    throw new TypeError('Semantic memory endpoint must be loopback-only');
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new TypeError('Semantic memory endpoint must not contain credentials, query or fragment');
  }
  if (url.pathname !== '/' && url.pathname !== '') {
    throw new TypeError('Semantic memory endpoint must not contain a path');
  }

  return url.origin;
}

function requireToken(token: string): string {
  if (typeof token !== 'string' || token.trim() === '') {
    throw new TypeError('Semantic memory bearer token is required');
  }
  return token;
}

async function validateJsonResponse<T>(
  response: Response,
  validator: (input: unknown) => T,
): Promise<T> {
  if (response.status === 409) {
    throw new SemanticMemoryRevisionConflictError();
  }
  if (!response.ok) {
    throw new SemanticMemoryHttpError(`HTTP_${response.status}`, response.status);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new SemanticMemoryHttpError('INVALID_RESPONSE');
  }

  try {
    return validator(payload);
  } catch {
    throw new SemanticMemoryHttpError('INVALID_RESPONSE');
  }
}

export function createSemanticMemoryHttpClient(
  config: SemanticMemorySessionConfig,
  options: SemanticMemoryHttpClientOptions = {},
): LocalSemanticMemoryPort {
  const endpoint = normalizeLoopbackEndpoint(config.endpointUrl);
  const token = requireToken(config.token);
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new TypeError('Semantic memory timeout must be a positive number');
  }

  const request = async <T>(
    path: string,
    init: LoopbackRequestInit,
    validator: (input: unknown) => T,
  ): Promise<T> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const requestInit: LoopbackRequestInit = {
      ...init,
      redirect: 'error',
      cache: 'no-store',
      credentials: 'omit',
      signal: controller.signal,
      targetAddressSpace: 'loopback',
    };

    try {
      const response = await fetchImpl(`${endpoint}${path}`, requestInit);
      return await validateJsonResponse(response, validator);
    } catch (error) {
      if (error instanceof SemanticMemoryHttpError) {
        throw error;
      }
      if (controller.signal.aborted) {
        throw new SemanticMemoryHttpError('TIMEOUT');
      }
      throw new SemanticMemoryHttpError('NETWORK_ERROR');
    } finally {
      clearTimeout(timer);
    }
  };

  const post = async <T>(
    path: string,
    payload: unknown,
    validator: (input: unknown) => T,
  ): Promise<T> => request(path, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  }, validator);

  return Object.freeze({
    mode: 'local' as const,

    async health(): Promise<SemanticMemoryHealthV1> {
      return request('/v1/health', { method: 'GET' }, validateSemanticMemoryHealth);
    },

    async upsert(requestInput: SemanticMemoryUpsertRequestV1): Promise<SemanticMemoryUpsertReceiptV1> {
      const validated = validateSemanticMemoryUpsertRequest(requestInput);
      return post('/v1/projections/upsert', validated, validateSemanticMemoryUpsertReceipt);
    },

    async remove(requestInput: SemanticMemoryRemoveRequestV1): Promise<SemanticMemoryRemoveReceiptV1> {
      const validated = validateSemanticMemoryRemoveRequest(requestInput);
      return post('/v1/projections/remove', validated, validateSemanticMemoryRemoveReceipt);
    },

    async search(requestInput: SemanticMemorySearchRequestV1): Promise<SemanticMemorySearchResponseV1> {
      const validated = validateSemanticMemorySearchRequest(requestInput);
      return post(
        '/v1/search',
        validated,
        (input) => validateSemanticMemorySearchResponse(input, validated),
      );
    },
  });
}
