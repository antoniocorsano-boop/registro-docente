import { evaluateDataFlow } from '../security/dataClassification.ts';
import {
  parseAgentRoutingRequestV1,
  parseIntentEnvelopeV1,
  type IntentEnvelopeV1
} from '../library/agentIntent.ts';
import { AgentIntentProviderError } from './agentIntentProvider.ts';
import { AgentIntentRuntimeError, type AgentIntentRuntime } from './agentIntentRuntime.ts';

export type AgentIntentRouteErrorCode =
  | 'REQUEST_INVALID'
  | 'REMOTE_POLICY_DENIED'
  | 'PROVIDER_NOT_CONFIGURED'
  | 'PROVIDER_RATE_LIMITED'
  | 'PROVIDER_TIMEOUT'
  | 'PROVIDER_BLOCKED'
  | 'PROVIDER_UNAVAILABLE'
  | 'PROVIDER_OUTPUT_INVALID'
  | 'PROVIDER_ERROR';

export interface AgentIntentRouteResult {
  status: number;
  body: { intent: IntentEnvelopeV1 } | {
    error: {
      code: AgentIntentRouteErrorCode;
      message: string;
      retriable: boolean;
    };
  };
}

const COPY: Record<AgentIntentRouteErrorCode, string> = {
  REQUEST_INVALID: 'La richiesta al Copilota non è valida.',
  REMOTE_POLICY_DENIED: 'La richiesta non può essere inviata al servizio di interpretazione.',
  PROVIDER_NOT_CONFIGURED: 'Il servizio di interpretazione del Copilota non è configurato.',
  PROVIDER_RATE_LIMITED: 'Il servizio di interpretazione è temporaneamente occupato.',
  PROVIDER_TIMEOUT: 'Il servizio di interpretazione non ha risposto in tempo.',
  PROVIDER_BLOCKED: 'Il servizio di interpretazione non può elaborare questa richiesta.',
  PROVIDER_UNAVAILABLE: 'Il servizio di interpretazione non è al momento disponibile.',
  PROVIDER_OUTPUT_INVALID: 'Il Copilota non ha restituito un’interpretazione valida.',
  PROVIDER_ERROR: 'Si è verificato un problema durante l’interpretazione della richiesta.'
};

function failure(code: AgentIntentRouteErrorCode, status: number, retriable: boolean): AgentIntentRouteResult {
  return { status, body: { error: { code, message: COPY[code], retriable } } };
}

export async function handleAgentIntentRequest(
  raw: unknown,
  runtime: AgentIntentRuntime,
  options: { signal?: AbortSignal } = {}
): Promise<AgentIntentRouteResult> {
  let request;
  try {
    request = parseAgentRoutingRequestV1(raw);
  } catch {
    return failure('REQUEST_INVALID', 400, false);
  }

  const policy = evaluateDataFlow(
    'TEACHER_PROFESSIONAL',
    'REMOTE_PROVIDER',
    request.explicitTeacherSubmission === true
  );
  if (policy !== 'ALLOW') return failure('REMOTE_POLICY_DENIED', 403, false);

  try {
    const result = await runtime.interpret(request, { signal: options.signal });
    try {
      return { status: 200, body: { intent: parseIntentEnvelopeV1(result.output) } };
    } catch {
      return failure('PROVIDER_OUTPUT_INVALID', 502, false);
    }
  } catch (error) {
    if (error instanceof AgentIntentRuntimeError) {
      return error.code === 'timeout'
        ? failure('PROVIDER_TIMEOUT', 504, true)
        : failure('PROVIDER_ERROR', 499, false);
    }
    if (error instanceof AgentIntentProviderError) {
      switch (error.code) {
        case 'not-configured': return failure('PROVIDER_NOT_CONFIGURED', 503, false);
        case 'rate-limited': return failure('PROVIDER_RATE_LIMITED', 429, true);
        case 'timeout': return failure('PROVIDER_TIMEOUT', 504, true);
        case 'blocked': return failure('PROVIDER_BLOCKED', 422, false);
        case 'unavailable': return failure('PROVIDER_UNAVAILABLE', 503, true);
        case 'output-invalid': return failure('PROVIDER_OUTPUT_INVALID', 502, false);
        default: return failure('PROVIDER_ERROR', 502, false);
      }
    }
    return failure('PROVIDER_ERROR', 502, false);
  }
}
