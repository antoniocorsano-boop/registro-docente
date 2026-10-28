import { describe, expect, test } from 'bun:test';
import type { CopilotMissionStatus, CopilotMissionV1 } from '../copilot/mission';

async function loadMissionModule() {
  return import('../copilot/mission');
}

function mission(status: CopilotMissionStatus): CopilotMissionV1 {
  return {
    schemaVersion: 1,
    id: `mission-${status}`,
    opportunityId: 'prepare-current-lesson:uda-1:lesson-1:source-1',
    kind: 'prepare-current-lesson',
    goal: 'Prepara la lezione',
    contextRef: {
      className: '2C',
      udaId: 'uda-1',
      lessonId: 'lesson-1',
      sourceId: 'source-1'
    },
    sourceRefs: ['source-1'],
    allowedCapabilities: ['prepare'],
    expectedOutputs: [{ kind: 'activity', label: 'Proposta pronta da controllare' }],
    authority: {
      persistentProfessionalWrite: false,
      externalAction: false,
      scopeExpansion: false
    },
    budgetProfile: 'balanced',
    createdAt: '2026-10-28T08:00:00.000Z',
    contextFingerprint: 'aic07:test-interruption',
    semanticExpiry: { kind: 'context' },
    status
  };
}

describe('AIC-07 interrupted mission behavior', () => {
  test('only unfinished authorized/running missions become suspended when preparation is interrupted', async () => {
    const missionModule = await loadMissionModule();
    expect(typeof missionModule.suspendCopilotMission).toBe('function');

    expect(missionModule.suspendCopilotMission(mission('authorized')).status).toBe('suspended');
    expect(missionModule.suspendCopilotMission(mission('running')).status).toBe('suspended');
    expect(missionModule.suspendCopilotMission(mission('ready')).status).toBe('ready');
    expect(missionModule.suspendCopilotMission(mission('archived')).status).toBe('archived');
  });

  test('App persists interruption and revokes the execution grant before exposing Resume', async () => {
    const appSource = await Bun.file(new URL('../App.tsx', import.meta.url)).text();
    expect(appSource).toContain('suspendCopilotMission');
    expect(appSource).toContain('const handleMissionInterrupted = useCallback');
    expect(appSource).toMatch(/missionExecutionGrantsRef\.current\.delete\(missionId\);/);
    expect(appSource).toMatch(/updateCopilotMission\([\s\S]*?missionId,[\s\S]*?suspendCopilotMission/);
    expect(appSource).toContain('onMissionInterrupted={handleMissionInterrupted}');
  });

  test('closing either the preparation disclosure or the Composer reports the bound unfinished mission interruption', async () => {
    const composerSource = await Bun.file(new URL('../components/LibraryCopilotComposer.tsx', import.meta.url)).text();
    expect(composerSource).toContain('onMissionInterrupted?: (input: { missionId: string }) => Promise<void> | void;');
    expect(composerSource).toContain('const interruptBoundMission = () =>');
    const calls = composerSource.match(/interruptBoundMission\(\);/g) ?? [];
    expect(calls.length).toBeGreaterThanOrEqual(2);
  });
});
