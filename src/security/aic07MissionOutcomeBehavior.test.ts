import { describe, expect, test } from 'bun:test';
import type { CopilotMissionV1 } from '../copilot/mission';
import type { CopilotStateV1 } from '../copilot/state';

async function loadCopilotStateMutation() {
  return import('../persistence/copilotStateMutation');
}

function readyMission(): CopilotMissionV1 {
  return {
    schemaVersion: 1,
    id: 'mission-ready-1',
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
    contextFingerprint: 'aic07:test-ready',
    semanticExpiry: { kind: 'context' },
    status: 'ready'
  };
}

function state(): CopilotStateV1 {
  return {
    schemaVersion: 1,
    missions: [readyMission()],
    deferred: [],
    dismissals: [],
    preferences: { schemaVersion: 1, signals: [] }
  };
}

describe('AIC-07 mission outcome behavior', () => {
  test('discarding a ready mission archives it durably and records the preference signal', async () => {
    const mutation = await loadCopilotStateMutation();
    expect(typeof mutation.recordCopilotMissionOutcome).toBe('function');

    const next = mutation.recordCopilotMissionOutcome(state(), {
      missionId: 'mission-ready-1',
      signal: 'discarded',
      signalId: 'signal-discarded-1',
      occurredAt: '2026-10-28T08:10:00.000Z'
    });

    expect(next.missions[0]?.status).toBe('archived');
    expect(next.preferences.signals).toEqual([{
      id: 'signal-discarded-1',
      opportunityKind: 'prepare-current-lesson',
      signal: 'discarded',
      occurredAt: '2026-10-28T08:10:00.000Z'
    }]);
  });

  test('non-discard outcomes keep the ready mission active while recording learning feedback', async () => {
    const mutation = await loadCopilotStateMutation();
    expect(typeof mutation.recordCopilotMissionOutcome).toBe('function');

    const next = mutation.recordCopilotMissionOutcome(state(), {
      missionId: 'mission-ready-1',
      signal: 'small-edits',
      signalId: 'signal-edit-1',
      occurredAt: '2026-10-28T08:11:00.000Z'
    });

    expect(next.missions[0]?.status).toBe('ready');
    expect(next.preferences.signals[0]?.signal).toBe('small-edits');
  });

  test('App routes the mission-specific outcome through the durable lifecycle mutation', async () => {
    const appSource = await Bun.file(new URL('../App.tsx', import.meta.url)).text();
    expect(appSource).toContain('recordCopilotMissionOutcome');
    expect(appSource).toMatch(/recordCopilotMissionOutcome\(current,\s*\{\s*missionId,\s*signal,\s*signalId:\s*uid\(\),\s*occurredAt:/s);
  });
});
