import React, { useEffect, useRef } from 'react';
import {
  assertMissionStepWithinScope,
  isMissionExecutionGrantValid,
  type CopilotMissionExecutionGrantV1,
  type CopilotMissionStepV1,
  type CopilotMissionV1
} from '../copilot/mission';
import type { CopilotMissionLaunchV1, LibraryCopilotLaunchRequest } from '../library/copilotLaunchContext';

const consumedMissionLaunches = new Set<string>();
const activeMissionGrants = new Map<string, {
  mission: CopilotMissionV1;
  grant: CopilotMissionExecutionGrantV1;
}>();

function missionLaunchKey(missionId: string, nonce: number, grantToken: string): string {
  return `${missionId}:${grantToken}:${nonce}`;
}

export function claimMissionLaunch(
  missionId: string,
  nonce: number,
  grantToken: string
): boolean {
  const launchKey = missionLaunchKey(missionId, nonce, grantToken);
  if (consumedMissionLaunches.has(launchKey)) return false;
  consumedMissionLaunches.add(launchKey);
  return true;
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

export function clearMissionRuntime(missionId: string): void {
  activeMissionGrants.delete(missionId);
}

export function assertMissionRuntimeExecutionAuthorized(
  missionId: string,
  step: CopilotMissionStepV1,
  now = new Date().toISOString()
): void {
  const activeGrant = activeMissionGrants.get(missionId);
  if (!activeGrant) {
    throw new Error('Autorizzazione dell’incarico non disponibile: riprendi esplicitamente la missione.');
  }
  if (!isMissionExecutionGrantValid(
    activeGrant.grant,
    activeGrant.mission,
    activeGrant.mission.contextFingerprint,
    now
  )) {
    activeMissionGrants.delete(missionId);
    throw new Error('Autorizzazione dell’incarico scaduta: riprendi esplicitamente la missione.');
  }
  assertMissionStepWithinScope(activeGrant.mission, step);
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
    if (!claimMissionLaunch(mission.missionId, launchRequest.nonce, activeGrant.grant.token)) return;

    submittedNonceRef.current = launchRequest.nonce;
    form.requestSubmit();
  }, [launchRequest?.nonce, launchRequest?.mission, message, ready]);

  return null;
};
