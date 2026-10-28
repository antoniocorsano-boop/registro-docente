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
    rank: {
      contextualRelevance: 100,
      temporalUrgency: 80,
      continuity: 90,
      expectedUtility: 80,
      teacherPreference: 50,
      noisePenalty: 0,
      finalScore: 83.5
    },
    createdAt: NOW
  };
}

function missionInputs() {
  return {
    context: {
      schema: 'registro.copilot-context/v1' as const,
      surface: 'lesson' as const,
      className: '2C',
      udaId: 'uda-1',
      lessonId: 'lesson-1',
      sourceId: 'source-1',
      planningProfileId: 'planning-1'
    },
    uda: {
      id: 'uda-1', title: 'Agricoltura', className: '2C', hours: 8, period: 'Q1' as const,
      startMonth: 1, durationMonths: 2, description: 'Sistema agricolo e ciclo integrato',
      competencies: 'Analizzare sistemi tecnologici',
      lessons: [{ id: 'lesson-1', date: '2026-10-27', topic: 'Ciclo integrato', hours: 1, notes: 'Ripresa operativa' }]
    },
    sources: [{
      id: 'source-1', kind: 'text' as const, title: 'Ciclo integrato',
      capturedAt: '2026-10-26T12:00:00.000Z', payload: { text: 'Agricoltura ciclo integrato e risorse.' },
      status: 'ready' as const, privacy: 'teacher-professional' as const, links: []
    }],
    planningProfileId: 'planning-1',
    missionSettings: { aiBudgetProfile: 'balanced' as const, copilotProactivity: 'balanced' as const }
  };
}

describe('AIC-07 mission contract', () => {
  test('first Play is preceded by an exact five-part human-readable preview', async () => {
    const { buildCopilotMissionPreview } = await loadMission();
    const preview = buildCopilotMissionPreview(opportunity(), missionInputs());
    expect(Object.keys(preview).sort()).toEqual([
      'context', 'goal', 'produces', 'schemaVersion', 'uses', 'willNotDo'
    ]);
    expect(preview.goal).toContain('Ciclo integrato');
    expect(preview.context).toContain('2C');
    expect(preview.uses.length).toBeGreaterThan(0);
    expect(preview.produces.length).toBeGreaterThan(0);
    expect(preview.willNotDo.length).toBeGreaterThan(0);
  });

  test('authorized mission fixes teacher authority boundaries and returns a separate ephemeral grant', async () => {
    const { buildCopilotMissionPreview, authorizeCopilotMission } = await loadMission();
    const preview = buildCopilotMissionPreview(opportunity(), missionInputs());
    const { mission, grant } = authorizeCopilotMission(preview, {
      id: 'mission-1',
      opportunity: opportunity(),
      fingerprintInput: missionInputs(),
      budgetProfile: 'balanced',
      now: NOW
    });

    expect(mission.authority).toEqual({
      persistentProfessionalWrite: false,
      externalAction: false,
      scopeExpansion: false
    });
    expect(mission.status).toBe('authorized');
    expect(mission.contextFingerprint.length).toBeGreaterThan(10);
    expect(JSON.stringify(mission)).not.toContain(grant.token);
    expect(grant.missionId).toBe(mission.id);
    expect(grant.contextFingerprint).toBe(mission.contextFingerprint);
  });

  test('fingerprint contract contains no student, grade or behavior data fields', async () => {
    const sourceText = await Bun.file(new URL('../copilot/mission.ts', import.meta.url)).text();
    expect(sourceText).not.toContain('.students');
    expect(sourceText).not.toContain('.grades');
    expect(sourceText).not.toContain('.behaviors');
    expect(sourceText).not.toContain('fetch(');
  });
});
