import {
  aiBudgetEscalationMessage,
  type AiBudgetEscalationReason
} from '../copilot/aiBudgetGovernor';
import type { LibraryProposalErrorCode } from '../library/teachingProposal';

const ERROR_CODES = new Set<LibraryProposalErrorCode>([
  'REMOTE_POLICY_DENIED',
  'REQUEST_INVALID',
  'SOURCE_TOO_LARGE',
  'AI_BUDGET_ESCALATION_REQUIRED',
  'PROVIDER_NOT_CONFIGURED',
  'PROVIDER_RATE_LIMITED',
  'PROVIDER_TIMEOUT',
  'PROVIDER_BLOCKED',
  'PROVIDER_UNAVAILABLE',
  'PROVIDER_OUTPUT_INVALID',
  'PROVIDER_ERROR'
]);

const BUDGET_REASONS = new Set<AiBudgetEscalationReason>([
  'BINARY_SOURCE',
  'LARGE_SOURCE',
  'RICH_CONTEXT'
]);

export class LibraryProposalServiceError extends Error {
  readonly code: LibraryProposalErrorCode;
  readonly retriable: boolean;
  readonly requestId?: string;
  readonly status: number;
  readonly budgetReason?: AiBudgetEscalationReason;

  constructor(input: {
    code: LibraryProposalErrorCode;
    retriable: boolean;
    status: number;
    requestId?: string;
    budgetReason?: AiBudgetEscalationReason;
  }) {
    super(libraryProposalErrorMessage(input.code, input.budgetReason));
    this.name = 'LibraryProposalServiceError';
    this.code = input.code;
    this.retriable = input.retriable;
    this.status = input.status;
    this.requestId = input.requestId;
    this.budgetReason = input.budgetReason;
  }
}

export function libraryProposalErrorMessage(
  code: LibraryProposalErrorCode,
  budgetReason?: AiBudgetEscalationReason
): string {
  switch (code) {
    case 'REMOTE_POLICY_DENIED':
      return 'Questa fonte non può essere inviata al servizio remoto nel contesto corrente.';
    case 'REQUEST_INVALID':
      return 'La richiesta di proposta didattica non è valida.';
    case 'SOURCE_TOO_LARGE':
      return 'La fonte è troppo grande per questa richiesta. Riduci il contenuto e riprova.';
    case 'AI_BUDGET_ESCALATION_REQUIRED':
      return budgetReason
        ? aiBudgetEscalationMessage(budgetReason)
        : 'Questa operazione richiede più capacità. Puoi autorizzarla temporaneamente prima di proseguire.';
    case 'PROVIDER_NOT_CONFIGURED':
      return 'Il servizio remoto non è configurato in questo ambiente.';
    case 'PROVIDER_RATE_LIMITED':
      return 'Il servizio remoto ha raggiunto temporaneamente il proprio limite. Puoi riprovare più tardi.';
    case 'PROVIDER_TIMEOUT':
      return 'Il servizio remoto non ha risposto entro il tempo previsto. Puoi riprovare con una nuova richiesta.';
    case 'PROVIDER_BLOCKED':
      return 'Il servizio remoto non può produrre una proposta per questa fonte o richiesta.';
    case 'PROVIDER_UNAVAILABLE':
      return 'Il servizio remoto è temporaneamente non disponibile. Puoi riprovare più tardi.';
    case 'PROVIDER_OUTPUT_INVALID':
      return 'Il servizio remoto ha restituito una proposta non valida. Nessun contenuto è stato salvato.';
    case 'PROVIDER_ERROR':
    default:
      return 'La proposta didattica non è disponibile in questo momento.';
  }
}

export function parseLibraryProposalServiceError(
  payload: unknown,
  status: number
): LibraryProposalServiceError {
  const fallback = new LibraryProposalServiceError({
    code: 'PROVIDER_ERROR',
    retriable: false,
    status
  });

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return fallback;
  const error = (payload as Record<string, unknown>).error;
  if (!error || typeof error !== 'object' || Array.isArray(error)) return fallback;
  const record = error as Record<string, unknown>;
  const code = record.code;
  if (typeof code !== 'string' || !ERROR_CODES.has(code as LibraryProposalErrorCode)) return fallback;

  const budgetReason = code === 'AI_BUDGET_ESCALATION_REQUIRED' &&
      typeof record.reason === 'string' &&
      BUDGET_REASONS.has(record.reason as AiBudgetEscalationReason)
    ? record.reason as AiBudgetEscalationReason
    : undefined;

  return new LibraryProposalServiceError({
    code: code as LibraryProposalErrorCode,
    retriable: record.retriable === true,
    status,
    ...(typeof record.requestId === 'string' && record.requestId.trim()
      ? { requestId: record.requestId.trim() }
      : {}),
    ...(budgetReason ? { budgetReason } : {})
  });
}
