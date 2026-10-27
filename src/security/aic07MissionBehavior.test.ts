import { describe, expect, test } from 'bun:test';
import type { CopilotOpportunityV1 } from '../copilot/opportunityResolver';

async function loadMission() {
  const moduleUrl = new URL('../copilot/mission.ts', import.meta.url);
  expect(await Bun.file(moduleUrl).exists()).toBe(true);
  return import('../copilot/mission');
}

const NOW = '2026-10-27T12:00:00.000Z';

function opportunity(): CopilotOpportunityV1 {
  return {
    schemaVersion: 1,
    id: 'prepare-current-lesson:uda-1:lesson-1:source-1',
    kind: 'prepare-current-lesson',
    scope: 'contextual',
    title: 'Prepara Ciclo integrato — 2C',
    whyNow: 'È il contesto di lavoro corrente e la fonte è pertinente alla lezione.',
    evidence: [{ kind: 'current-context', reason: 'È il contesto di lavoro corrente e la fonte è pertinente alla lezione.' }],
    contextRef: { className: '2C', udaId: 'uda-1', lessonId: 'lesson-1', sourceId: 'source-1' },
    proposedMission: {
      goal: 'Prepara la lezione “Ciclo integrato” per 2C',
      sourceRefs: ['source-1'],
      allowedCapabilities: ['prepare'],
      expectedOutputs: [{ kind: 'activity', label: 'Proposta didattica pronta da controllare' }]
    },
    rank: { contextualRelevance: 100, temporalUrgency: 80, continuity: 90, expectedUtility: 80, teacherPreference: 50, noisePenalty: 0, finalScore: 83.5 },
    createdAt: NOW
  };
}

function inputs() {
  return {
    context: {
      schema: 'registro.copilot-context/v1' as const,
      surface: 'lesson' as const,
      className: '2C', udaId: 'uda-1', lessonId: 'lesson-1', sourceId: 'source-1', planningProfileId: 'planning-1'
    },
    uda: {
      id: 'uda-1', title: 'Agricoltura', className: '2C', hours: 8, period: 'Q1' as const,
      startMonth: 1, durationMonths: 2, description: 'Sistema agricolo e ciclo integrato', competencies: 'Analizzare sistemi tecnologici',
      lessons: [{ id: 'lesson-1', date: '2026-10-27', topic: 'Ciclo integrato', hours: 1, notes: 'Ripresa operativa' }]
    },
    sources: [{
      id: 'source-1', kind: 'text' as const, title: 'Ciclo integrato', capturedAt: '2026-10-26T12:00:00.000Z',
      payload: { text: 'Agricoltura ciclo integrato e risorse.' }, status: 'ready' as const,
      privacy: 'teacher-professional' as const, links: []
    }],
    planningProfileId: 'planning-1',
    missionSettings: { aiBudgetProfile: 'balanced' as const, copilotProactivity: 'balanced' as const }
  };
}

async function authorizedMission() {
  const { buildCopilotMissionPreview, authorizeCopilotMission } = await loadMission();
  const preview = buildCopilotMissionPreview(opportunity(), inputs());
  return authorizeCopilotMission(preview, {
    id: 'mission-1', opportunity: opportunity(), fingerprintInput: inputs(), budgetProfile: 'balanced', now: NOW
  });
}

describe('AIC-07 mission behavior', () => {
  test('execution grant is valid only for the exact mission/fingerprint and expires after 15 minutes', async () => {
    const { isMissionExecutionGrantValid } = await loadMission();
    const { mission, grant } = await authorizedMission();
    expect(isMissionExecutionGrantValid(grant, mission, mission.contextFingerprint, '2026-10-27T12:14:59.000Z')).toBe(true);
    expect(isMissionExecutionGrantValid(grant, mission, mission.contextFingerprint, '2026-10-27T12:15:01.000Z')).toBe(false);
    expect(isMissionExecutionGrantValid(grant, { ...mission, id: 'mission-2' }, mission.contextFingerprint, '2026-10-27T12:05:00.000Z')).toBe(false);
    expect(isMissionExecutionGrantValid(grant, mission, `${mission.contextFingerprint}-changed`, '2026-10-27T12:05:00.000Z')).toBe(false);
  });

  test('material source or UDA changes change the mission context fingerprint while identical inputs stay stable', async () => {
    const { buildMissionContextFingerprint } = await loadMission();
    const initial = inputs();
    const first = buildMissionContextFingerprint(initial);
    expect(buildMissionContextFingerprint(inputs())).toBe(first);

    const sourceChanged = inputs();
    sourceChanged.sources[0]!.payload.text = 'Fonte modificata materialmente.';
    expect(buildMissionContextFingerprint(sourceChanged)).not.toBe(first);

    const udaChanged = inputs();
    udaChanged.uda.description = 'Descrizione UDA modificata.';
    expect(buildMissionContextFingerprint(udaChanged)).not.toBe(first);
  });

  test('unchanged context resumes directly, material change requires re-preview, expired target archives', async () => {
    const { resolveMissionResume } = await loadMission();
    const { mission } = await authorizedMission();
    const suspended = { ...mission, status: 'suspended' as const };
    expect(resolveMissionResume(suspended, mission.contextFingerprint, '2026-10-27T13:00:00.000Z')).toBe('resume');
    expect(resolveMissionResume(suspended, `${mission.contextFingerprint}-changed`, '2026-10-27T13:00:00.000Z')).toBe('repreview');
    expect(resolveMissionResume({ ...suspended, semanticExpiry: { kind: 'date', expiresAt: '2026-10-27T12:30:00.000Z' } }, mission.contextFingerprint, '2026-10-27T13:00:00.000Z')).toBe('archive');
  });

  test('scope enforcement rejects work for another class, UDA, source or unsupported capability', async () => {
    const { assertMissionStepWithinScope } = await loadMission();
    const { mission } = await authorizedMission();
    expect(() => assertMissionStepWithinScope(mission, {
      capability: 'prepare', className: '2C', udaId: 'uda-1', lessonId: 'lesson-1', sourceIds: ['source-1']
    })).not.toThrow();
    expect(() => assertMissionStepWithinScope(mission, {
      capability: 'prepare', className: '2A', udaId: 'uda-1', lessonId: 'lesson-1', sourceIds: ['source-1']
    })).toThrow();
    expect(() => assertMissionStepWithinScope(mission, {
      capability: 'prepare', className: '2C', udaId: 'uda-2', lessonId: 'lesson-1', sourceIds: ['source-1']
    })).toThrow();
    expect(() => assertMissionStepWithinScope(mission, {
      capability: 'prepare', className: '2C', udaId: 'uda-1', lessonId: 'lesson-1', sourceIds: ['source-2']
    })).toThrow();
    expect(() => assertMissionStepWithinScope(mission, {
      capability: 'review', className: '2C', udaId: 'uda-1', lessonId: 'lesson-1', sourceIds: ['source-1']
    })).toThrow();
  });
});
