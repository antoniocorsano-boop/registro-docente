import React, { useEffect, useRef } from 'react';
import type { CopilotMissionExecutionGrantV1, CopilotMissionV1 } from '../copilot/mission';
import type { CopilotMissionLaunchV1, LibraryCopilotLaunchRequest } from '../library/copilotLaunchContext';

export function bindMissionRuntime(
  mission: CopilotMissionV1,
  grant: CopilotMissionExecutionGrantV1
): CopilotMissionLaunchV1 {
  if (grant.missionId !== mission.id || grant.contextFingerprint !== mission.contextFingerprint) {
    throw new Error('Grant della missione non coerente con il mandato autorizzato.');
  }
  return { missionId: mission.id, objective: mission.goal };
}

export const CopilotMissionBridge: React.FC<{
  launchRequest: LibraryCopilotLaunchRequest | null;
  message: string;
}> = ({ launchRequest, message }) => {
  const submittedNonceRef = useRef<number | null>(null);

  useEffect(() => {
    const mission = launchRequest?.mission;
    if (!mission || submittedNonceRef.current === launchRequest.nonce) return;
    if (message.trim() !== mission.objective.trim()) return;
    const control = document.getElementById('copilot-message') as HTMLTextAreaElement | null;
    const form = control?.form;
    if (!form) return;
    submittedNonceRef.current = launchRequest.nonce;
    form.requestSubmit();
  }, [launchRequest?.nonce, launchRequest?.mission, message]);

  return null;
};
