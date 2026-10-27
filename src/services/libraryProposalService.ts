import {
  parseTeachingProposalV1,
  type LibraryProposalRequestV1,
  type TeachingProposalRuntimeReceiptWire,
  type TeachingProposalV1
} from '../library/teachingProposal';
import {
  LibraryProposalServiceError,
  parseLibraryProposalServiceError
} from './libraryProposalErrors';

export interface LibraryProposalProviderMetadata {
  available: boolean;
  provider: string;
  model: string;
}

export interface LibraryTeachingProposalResponse {
  proposal: TeachingProposalV1;
  receipt: TeachingProposalRuntimeReceiptWire;
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function optionalFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : undefined;
}

function parseBudgetReceipt(value: unknown): TeachingProposalRuntimeReceiptWire['budget'] | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new LibraryProposalServiceError({ code: 'PROVIDER_OUTPUT_INVALID', retriable: false, status: 502 });
  }
  const budget = value as Record<string, unknown>;
  if (
    (budget.tier !== 'remote-low' && budget.tier !== 'remote-expanded') ||
    (budget.profile !== 'economy' && budget.profile !== 'balanced' && budget.profile !== 'quality') ||
    typeof budget.escalated !== 'boolean'
  ) {
    throw new LibraryProposalServiceError({ code: 'PROVIDER_OUTPUT_INVALID', retriable: false, status: 502 });
  }
  return {
    tier: budget.tier,
    profile: budget.profile,
    escalated: budget.escalated
  };
}

function parseReceipt(value: unknown): TeachingProposalRuntimeReceiptWire {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new LibraryProposalServiceError({ code: 'PROVIDER_OUTPUT_INVALID', retriable: false, status: 502 });
  }
  const receipt = value as Record<string, unknown>;
  if (
    !nonEmptyString(receipt.requestId) ||
    !nonEmptyString(receipt.provider) ||
    !nonEmptyString(receipt.model) ||
    optionalFiniteNumber(receipt.durationMs) === undefined ||
    receipt.attemptCount !== 1
  ) {
    throw new LibraryProposalServiceError({ code: 'PROVIDER_OUTPUT_INVALID', retriable: false, status: 502 });
  }

  return {
    requestId: receipt.requestId.trim(),
    provider: receipt.provider.trim(),
    model: receipt.model.trim(),
    ...(nonEmptyString(receipt.modelVersion) ? { modelVersion: receipt.modelVersion.trim() } : {}),
    ...(nonEmptyString(receipt.providerResponseId) ? { providerResponseId: receipt.providerResponseId.trim() } : {}),
    durationMs: receipt.durationMs as number,
    ...(optionalFiniteNumber(receipt.promptTokens) !== undefined ? { promptTokens: receipt.promptTokens as number } : {}),
    ...(optionalFiniteNumber(receipt.outputTokens) !== undefined ? { outputTokens: receipt.outputTokens as number } : {}),
    ...(optionalFiniteNumber(receipt.totalTokens) !== undefined ? { totalTokens: receipt.totalTokens as number } : {}),
    attemptCount: 1,
    ...(parseBudgetReceipt(receipt.budget) ? { budget: parseBudgetReceipt(receipt.budget) } : {})
  };
}

export async function getLibraryProposalProviderMetadata(
  signal?: AbortSignal
): Promise<LibraryProposalProviderMetadata> {
  const response = await fetch('/api/copilot/library-proposal/provider', { signal });
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new LibraryProposalServiceError({ code: 'PROVIDER_ERROR', retriable: false, status: response.status });
  }

  if (!response.ok || !payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new LibraryProposalServiceError({ code: 'PROVIDER_ERROR', retriable: false, status: response.status });
  }

  const metadata = payload as Record<string, unknown>;
  if (
    typeof metadata.available !== 'boolean' ||
    !nonEmptyString(metadata.provider) ||
    !nonEmptyString(metadata.model)
  ) {
    throw new LibraryProposalServiceError({ code: 'PROVIDER_ERROR', retriable: false, status: response.status });
  }

  return {
    available: metadata.available,
    provider: metadata.provider.trim(),
    model: metadata.model.trim()
  };
}

export async function requestLibraryTeachingProposal(
  request: LibraryProposalRequestV1,
  signal?: AbortSignal
): Promise<LibraryTeachingProposalResponse> {
  const response = await fetch('/api/copilot/library-proposal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    signal
  });

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new LibraryProposalServiceError({ code: 'PROVIDER_ERROR', retriable: false, status: response.status });
  }

  if (!response.ok) {
    throw parseLibraryProposalServiceError(payload, response.status);
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new LibraryProposalServiceError({ code: 'PROVIDER_OUTPUT_INVALID', retriable: false, status: response.status });
  }

  const record = payload as Record<string, unknown>;
  return {
    proposal: parseTeachingProposalV1(record.proposal),
    receipt: parseReceipt(record.receipt)
  };
}
