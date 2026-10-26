import { evaluateDataFlow, type DataClassification } from '../security/dataClassification.ts';
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

const STUDENT_IDENTITY_REFERENCE = /\b(?:studente|studentessa|alunno|alunna)\s+[\p{L}'’-]{2,40}(?:\s+[\p{L}'’-]{2,40}){0,2}\b/iu;
const SENSITIVE_STUDENT_RECORD = /\b(?:voto|voti|ha preso|pdp|pei|dsa|bes|diagnosi|dislessia|discalculia|adhd|autismo|comportamento|assenza|assenze|assente|assenti)\b/i;
const EMAIL_ADDRESS = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const ITALIAN_MOBILE = /\b(?:\+39\s*)?3\d{2}[\s.-]?\d{6,7}\b/;
const ITALIAN_FISCAL_CODE = /\b[A-Z]{6}\d{2}[A-EHLMPRST]\d{2}[A-Z]\d{3}[A-Z]\b/i;

function classifyRoutingMessage(message: string): DataClassification {
  const normalized = message.normalize('NFKC');
  if (
    STUDENT_IDENTITY_REFERENCE.test(normalized)
    || SENSITIVE_STUDENT_RECORD.test(normalized)
    || EMAIL_ADDRESS.test(normalized)
    || ITALIAN_MOBILE.test(normalized)
    || ITALIAN_FISCAL_CODE.test(normalized)
  ) {
    return 'STUDENT_PERSONAL';
  }
  return 'TEACHER_PROFESSIONAL';
}

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
    classifyRoutingMessage(request.message),
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
        // Provider absence is a supported offline/fallback state, not an HTTP failure.
        // The client receives a typed non-intent envelope and falls back locally.
        case 'not-configured': return failure('PROVIDER_NOT_CONFIGURED', 200, false);
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
