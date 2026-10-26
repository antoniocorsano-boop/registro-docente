import {
  parseIntentEnvelopeV1,
  type AgentRoutingRequestV1,
  type IntentEnvelopeV1
} from '../library/agentIntent';

export type AgentIntentClientErrorCode =
  | 'REQUEST_FAILED'
  | 'RESPONSE_INVALID'
  | 'ABORTED';

export class AgentIntentClientError extends Error {
  readonly code: AgentIntentClientErrorCode;

  constructor(code: AgentIntentClientErrorCode) {
    super(code);
    this.name = 'AgentIntentClientError';
    this.code = code;
  }
}

export async function interpretCopilotIntent(
  request: AgentRoutingRequestV1,
  signal?: AbortSignal
): Promise<IntentEnvelopeV1> {
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
    throw new AgentIntentClientError('REQUEST_FAILED');
  }

  try {
    return parseIntentEnvelopeV1((payload as { intent: unknown }).intent);
  } catch {
    throw new AgentIntentClientError('RESPONSE_INVALID');
  }
}
