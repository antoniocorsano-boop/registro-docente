import React, { useEffect, useRef } from 'react';
import {
  isMissionExecutionGrantValid,
  type CopilotMissionExecutionGrantV1,
  type CopilotMissionV1
} from '../copilot/mission';
import type { CopilotMissionLaunchV1, LibraryCopilotLaunchRequest } from '../library/copilotLaunchContext';

const consumedMissionLaunches = new Set<string>();
const activeMissionGrants = new Map<string, {
  mission: CopilotMissionV1;
  grant: CopilotMissionExecutionGrantV1;
}>();

function missionLaunchKey(missionId: string, nonce: number): string {
  return `${missionId}:${nonce}`;
}

export function bindMissionRuntime(
  mission: CopilotMissionV1,
  grant: CopilotMissionExecutionGrantV1
): CopilotMissionLaunchV1 {
  if (grant.missionId !== mission.id || grant.contextFingerprint !== mission.contextFingerprint) {
    throw new Error('Grant della missione non coerente con il mandato autorizzato.');
  }
  activeMissionGrants.set(mission.id, { mission, grant });
  return { missionId: mission.id, objective: mission.goal };
}

export const CopilotMissionBridge: React.FC<{
  launchRequest: LibraryCopilotLaunchRequest | null;
  message: string;
  ready: boolean;
}> = ({ launchRequest, message, ready }) => {
  const submittedNonceRef = useRef<number | null>(null);

  useEffect(() => {
    const mission = launchRequest?.mission;
    if (!mission || !ready || submittedNonceRef.current === launchRequest.nonce) return;
    if (message.trim() !== mission.objective.trim()) return;

    const launchKey = missionLaunchKey(mission.missionId, launchRequest.nonce);
    if (consumedMissionLaunches.has(launchKey)) return;

    const activeGrant = activeMissionGrants.get(mission.missionId);
    if (!activeGrant) return;
    if (!isMissionExecutionGrantValid(
      activeGrant.grant,
      activeGrant.mission,
      activeGrant.mission.contextFingerprint,
      new Date().toISOString()
    )) return;

    const control = document.getElementById('copilot-message') as HTMLTextAreaElement | null;
    const form = control?.form;
    if (!form) return;

    submittedNonceRef.current = launchRequest.nonce;
    consumedMissionLaunches.add(launchKey);
    form.requestSubmit();
  }, [launchRequest?.nonce, launchRequest?.mission, message, ready]);

  return null;
};
