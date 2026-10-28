import { describe, expect, test } from 'bun:test';

async function loadMissionBridge() {
  return import('../components/CopilotMissionBridge');
}

describe('AIC-07 mission grant replay behavior', () => {
  test('reusing a launch nonce is blocked only inside the same execution grant, while a fresh Resume grant may reuse it', async () => {
    const bridge = await loadMissionBridge();
    expect(typeof bridge.claimMissionLaunch).toBe('function');

    const claimMissionLaunch = bridge.claimMissionLaunch as (
      missionId: string,
      nonce: number,
      grantToken: string
    ) => boolean;

    expect(claimMissionLaunch('mission-1', 1, 'grant-play')).toBe(true);
    expect(claimMissionLaunch('mission-1', 1, 'grant-play')).toBe(false);

    expect(claimMissionLaunch('mission-1', 1, 'grant-resume')).toBe(true);
    expect(claimMissionLaunch('mission-1', 1, 'grant-resume')).toBe(false);
  });
});
