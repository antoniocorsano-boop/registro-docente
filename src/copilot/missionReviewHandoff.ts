import type { CopilotMissionV1 } from './mission';

export interface MissionReviewHandoffV1 {
  missionId: string;
  goal: string;
  contextRef: CopilotMissionV1['contextRef'];
  sourceRefs: string[];
  result: NonNullable<CopilotMissionV1['result']>;
}

let stagedMissionReview: MissionReviewHandoffV1 | null = null;

export function stageMissionReview(mission: CopilotMissionV1): void {
  if (mission.status !== 'ready' || !mission.result) {
    throw new Error('Il risultato della missione non è pronto per la revisione.');
  }
  stagedMissionReview = {
    missionId: mission.id,
    goal: mission.goal,
    contextRef: { ...mission.contextRef },
    sourceRefs: [...mission.sourceRefs],
    result: {
      proposal: mission.result.proposal,
      receipt: mission.result.receipt
    }
  };
}

export function consumeStagedMissionReview(): MissionReviewHandoffV1 | null {
  const review = stagedMissionReview;
  stagedMissionReview = null;
  return review;
}
