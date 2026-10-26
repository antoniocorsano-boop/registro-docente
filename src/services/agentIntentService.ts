import {
  parseIntentEnvelopeV1,
  type AgentRoutingRequestV1,
  type IntentEnvelopeV1
} from '../library/agentIntent';

export type AgentIntentClientErrorCode =
  | 'REQUEST_FAILED'
  | 'RESPONSE_INVALID'
  | 'ABORTED';

export type AgentIntentRouteFailureCode =
  | 'INVALID_REQUEST'
  | 'POLICY_BLOCKED'
  | 'PROVIDER_NOT_CONFIGURED'
  | 'PROVIDER_TIMEOUT'
  | 'PROVIDER_RATE_LIMITED'
  | 'PROVIDER_UNAVAILABLE'
  | 'PROVIDER_BLOCKED'
  | 'PROVIDER_OUTPUT_INVALID'
  | 'PROVIDER_ERROR';

const AGENT_INTENT_ROUTE_FAILURE_CODES = new Set<AgentIntentRouteFailureCode>([
  'INVALID_REQUEST',
  'POLICY_BLOCKED',
  'PROVIDER_NOT_CONFIGURED',
  'PROVIDER_TIMEOUT',
  'PROVIDER_RATE_LIMITED',
  'PROVIDER_UNAVAILABLE',
  'PROVIDER_BLOCKED',
  'PROVIDER_OUTPUT_INVALID',
  'PROVIDER_ERROR'
]);

export class AgentIntentClientError extends Error {
  readonly code: AgentIntentClientErrorCode;
  readonly routeCode?: AgentIntentRouteFailureCode;
  readonly retriable?: boolean;

  constructor(
    code: AgentIntentClientErrorCode,
    diagnostics: { routeCode?: AgentIntentRouteFailureCode; retriable?: boolean } = {}
  ) {
    super(code);
    this.name = 'AgentIntentClientError';
    this.code = code;
    this.routeCode = diagnostics.routeCode;
    this.retriable = diagnostics.retriable;
  }
}

function parseSafeRouteFailure(payload: unknown): {
  routeCode?: AgentIntentRouteFailureCode;
  retriable?: boolean;
} {
  if (!payload || typeof payload !== 'object') return {};
  const error = (payload as { error?: unknown }).error;
  if (!error || typeof error !== 'object') return {};

  const record = error as { code?: unknown; retriable?: unknown };
  if (
    typeof record.code !== 'string'
    || !AGENT_INTENT_ROUTE_FAILURE_CODES.has(record.code as AgentIntentRouteFailureCode)
  ) return {};

  return {
    routeCode: record.code as AgentIntentRouteFailureCode,
    ...(typeof record.retriable === 'boolean' ? { retriable: record.retriable } : {})
  };
}

async function agentIntentProviderIsAvailable(signal?: AbortSignal): Promise<boolean> {
  let response: Response;
  try {
    response = await fetch('/api/copilot/intent/provider', { signal });
  } catch (error) {
    if (signal?.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
      throw new AgentIntentClientError('ABORTED');
    }
    throw new AgentIntentClientError('REQUEST_FAILED');
  }

  if (!response.ok) throw new AgentIntentClientError('REQUEST_FAILED');

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new AgentIntentClientError('RESPONSE_INVALID');
  }

  if (!payload || typeof payload !== 'object' || typeof (payload as { available?: unknown }).available !== 'boolean') {
    throw new AgentIntentClientError('RESPONSE_INVALID');
  }

  return (payload as { available: boolean }).available;
}

export async function interpretCopilotIntent(
  request: AgentRoutingRequestV1,
  signal?: AbortSignal
): Promise<IntentEnvelopeV1> {
  if (!await agentIntentProviderIsAvailable(signal)) {
    throw new AgentIntentClientError('REQUEST_FAILED');
  }

  let response: Response;
  try {
    response = await fetch('/api/copilot/intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal
    });
  } catch (error) {
    if (signal?.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
      throw new AgentIntentClientError('ABORTED');
    }
    throw new AgentIntentClientError('REQUEST_FAILED');
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new AgentIntentClientError('RESPONSE_INVALID');
  }

  if (!response.ok || !payload || typeof payload !== 'object' || !('intent' in payload)) {
    throw new AgentIntentClientError('REQUEST_FAILED', parseSafeRouteFailure(payload));
  }

  try {
    return parseIntentEnvelopeV1((payload as { intent: unknown }).intent);
  } catch {
    throw new AgentIntentClientError('RESPONSE_INVALID');
  }
}
