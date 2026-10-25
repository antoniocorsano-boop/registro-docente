import {
  parseTeachingProposalV1,
  type LibraryProposalRequestV1,
  type TeachingProposalV1
} from '../library/teachingProposal';

export async function requestLibraryTeachingProposal(
  request: LibraryProposalRequestV1,
  signal?: AbortSignal
): Promise<TeachingProposalV1> {
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
    throw new Error('Il server non ha restituito una proposta didattica valida.');
  }

  if (!response.ok) {
    const error = payload && typeof payload === 'object' && !Array.isArray(payload)
      ? (payload as Record<string, unknown>).error
      : undefined;
    throw new Error(
      typeof error === 'string' && error.trim()
        ? error
        : 'La proposta didattica non è disponibile in questo momento.'
    );
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Il server non ha restituito una proposta didattica valida.');
  }

  return parseTeachingProposalV1((payload as Record<string, unknown>).proposal);
}
