import { describe, expect, test } from 'bun:test';
import type { CopilotOpportunityV1 } from '../copilot/opportunityResolver';
import { resolveCopilotOpportunities } from '../copilot/opportunityResolver';

async function loadPreferenceLearning() {
  const moduleUrl = new URL('../copilot/preferenceLearning.ts', import.meta.url);
  expect(await Bun.file(moduleUrl).exists()).toBe(true);
  return import('../copilot/preferenceLearning');
}

const NOW = '2026-10-27T12:00:00.000Z';

function baseOpportunity(): CopilotOpportunityV1 {
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
      goal: 'Prepara la lezione',
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

function resolverInput() {
  return {
    profile: 'present' as const,
    now: NOW,
    today: '2026-10-27',
    contextFingerprint: 'lesson|2C|uda-1|lesson-1|source-1',
    context: {
      schema: 'registro.copilot-context/v1' as const,
      surface: 'lesson' as const,
      className: '2C',
      udaId: 'uda-1',
      lessonId: 'lesson-1'
    },
    udas: [{
      id: 'uda-1', title: 'Agricoltura', className: '2C', hours: 8, period: 'Q1' as const,
      startMonth: 1, durationMonths: 2,
      lessons: [{ id: 'lesson-1', date: '2026-10-27', topic: 'Ciclo integrato', hours: 1 }]
    }],
    library: {
      schemaVersion: 1 as const,
      sources: [{
        id: 'source-1', kind: 'text' as const, title: 'Ciclo integrato',
        capturedAt: '2026-10-26T12:00:00.000Z', payload: { text: 'Ciclo integrato agricoltura.' },
        status: 'ready' as const, privacy: 'teacher-professional' as const, links: []
      }]
    },
    planning: { schemaVersion: 1 as const, profiles: [], arenaContexts: [], resources: [], masterPrograms: [], classInstances: [] },
    preferenceFactor: () => 50,
    dismissed: [],
    deferred: [],
    missions: []
  };
}

describe('AIC-07 global preference learning', () => {
  test('starts neutral, learns globally from outcomes, and resets independently', async () => {
    const {
      createEmptyCopilotPreferenceState,
      recordCopilotPreferenceSignal,
      copilotPreferenceFactor,
      resetCopilotPreferences
    } = await loadPreferenceLearning();

    let state = createEmptyCopilotPreferenceState();
    expect(copilotPreferenceFactor(state, 'prepare-current-lesson', NOW)).toBe(50);

    state = recordCopilotPreferenceSignal(state, {
      id: 's1', opportunityKind: 'prepare-current-lesson', signal: 'play', occurredAt: NOW
    });
    state = recordCopilotPreferenceSignal(state, {
      id: 's2', opportunityKind: 'prepare-current-lesson', signal: 'used-as-is', occurredAt: NOW
    });
    expect(copilotPreferenceFactor(state, 'prepare-current-lesson', NOW)).toBeGreaterThan(50);

    const acrossAnotherClass = copilotPreferenceFactor(state, 'prepare-current-lesson', NOW);
    expect(acrossAnotherClass).toBeGreaterThan(50);
    expect(JSON.stringify(state)).not.toContain('className');
    expect(JSON.stringify(state)).not.toContain('student');

    state = recordCopilotPreferenceSignal(state, {
      id: 's3', opportunityKind: 'prepare-current-lesson', signal: 'discarded', occurredAt: NOW
    });
    state = recordCopilotPreferenceSignal(state, {
      id: 's4', opportunityKind: 'prepare-current-lesson', signal: 'discarded', occurredAt: NOW
    });
    expect(copilotPreferenceFactor(state, 'prepare-current-lesson', NOW)).toBeLessThan(acrossAnotherClass);

    expect(resetCopilotPreferences()).toEqual({ schemaVersion: 1, signals: [] });
  });

  test('decays old signals and bounds behavioral history to the newest 200 entries', async () => {
    const {
      createEmptyCopilotPreferenceState,
      recordCopilotPreferenceSignal,
      copilotPreferenceFactor
    } = await loadPreferenceLearning();

    const oldAt = '2026-08-28T12:00:00.000Z';
    let oldState = createEmptyCopilotPreferenceState();
    oldState = recordCopilotPreferenceSignal(oldState, {
      id: 'old', opportunityKind: 'prepare-current-lesson', signal: 'used-as-is', occurredAt: oldAt
    });
    let newState = createEmptyCopilotPreferenceState();
    newState = recordCopilotPreferenceSignal(newState, {
      id: 'new', opportunityKind: 'prepare-current-lesson', signal: 'used-as-is', occurredAt: NOW
    });
    expect(copilotPreferenceFactor(oldState, 'prepare-current-lesson', NOW)).toBeLessThan(
      copilotPreferenceFactor(newState, 'prepare-current-lesson', NOW)
    );

    let bounded = createEmptyCopilotPreferenceState();
    for (let index = 0; index < 205; index += 1) {
      bounded = recordCopilotPreferenceSignal(bounded, {
        id: `signal-${index}`,
        opportunityKind: 'prepare-current-lesson',
        signal: 'play',
        occurredAt: new Date(Date.parse(NOW) + index).toISOString()
      });
    }
    expect(bounded.signals).toHaveLength(200);
    expect(bounded.signals[0]?.id).toBe('signal-5');
  });

  test('same-fingerprint ignore suppresses immediate reappearance but material context change permits reconsideration', () => {
    const input = resolverInput();
    const initial = resolveCopilotOpportunities(input);
    expect(initial.primary.length).toBeGreaterThan(0);
    const id = initial.primary[0]!.id;

    const ignored = resolveCopilotOpportunities({
      ...input,
      dismissed: [{ opportunityId: id, contextFingerprint: input.contextFingerprint }]
    });
    expect(ignored.primary.some(item => item.id === id)).toBe(false);

    const changed = resolveCopilotOpportunities({
      ...input,
      contextFingerprint: 'lesson|2C|uda-1|lesson-1|source-1|changed',
      dismissed: [{ opportunityId: id, contextFingerprint: input.contextFingerprint }]
    });
    expect(changed.primary.some(item => item.id === id)).toBe(true);
  });

  test('put-aside is later-only, evidence-backed, and does not create an execution signal', async () => {
    const { createEmptyCopilotPreferenceState } = await loadPreferenceLearning();
    const opportunity = baseOpportunity();
    const input = resolverInput();
    const result = resolveCopilotOpportunities({
      ...input,
      context: { ...input.context, udaId: undefined, lessonId: undefined },
      deferred: [{ opportunity, contextFingerprint: input.contextFingerprint, deferredAt: NOW }]
    });
    const later = [...result.primary, ...result.overflow].find(item => item.id === opportunity.id);
    expect(later?.scope).toBe('later');
    expect(later?.whyNow).toContain('L’avevi messa da parte');
    expect(later?.evidence.some(item => item.reason === later.whyNow)).toBe(true);
    expect(createEmptyCopilotPreferenceState().signals).toHaveLength(0);
  });
});
