import type {
  LibraryProposalRequestV1,
  TeachingProposalRuntimeReceiptWire,
  TeachingProposalV1
} from '../library/teachingProposal';

export interface MissionRuntimeBindingV1 {
  missionId: string;
  objective: string;
  contextFingerprint: string;
  sourceId: string;
  udaId: string;
  lessonId?: string;
}

export interface MissionProposalReadyEventV1 {
  missionId: string;
  proposal: TeachingProposalV1;
  receipt: TeachingProposalRuntimeReceiptWire;
}

type MissionReadyListener = (event: MissionProposalReadyEventV1) => void;

const bindings = new Map<string, MissionRuntimeBindingV1>();
const listeners = new Set<MissionReadyListener>();

export function bindMissionRuntime(binding: MissionRuntimeBindingV1): void {
  bindings.set(binding.missionId, { ...binding });
}

export function clearMissionRuntime(missionId: string): void {
  bindings.delete(missionId);
}

export function findMissionRuntimeForProposalRequest(
  request: LibraryProposalRequestV1
): MissionRuntimeBindingV1 | null {
  const candidates = [...bindings.values()].reverse();
  return candidates.find(binding => (
    binding.sourceId === request.source.id
    && binding.udaId === request.context.udaId
    && (binding.lessonId ?? null) === (request.context.lessonId ?? null)
  )) ?? null;
}

export function subscribeMissionProposalReady(listener: MissionReadyListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifyMissionProposalReady(
  request: LibraryProposalRequestV1,
  result: {
    proposal: TeachingProposalV1;
    receipt: TeachingProposalRuntimeReceiptWire;
  }
): void {
  const binding = findMissionRuntimeForProposalRequest(request);
  if (!binding) return;

  const event: MissionProposalReadyEventV1 = {
    missionId: binding.missionId,
    proposal: result.proposal,
    receipt: result.receipt
  };
  for (const listener of listeners) listener(event);
}
