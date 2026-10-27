import { describe, expect, test } from 'bun:test';

async function loadResolver() {
  const moduleUrl = new URL('../copilot/opportunityResolver.ts', import.meta.url);
  expect(await Bun.file(moduleUrl).exists()).toBe(true);
  return import('../copilot/opportunityResolver');
}

function baseInput(sourcePrivacy: 'teacher-professional' | 'student-personal' | 'unknown' = 'teacher-professional') {
  return {
    profile: 'present' as const,
    now: '2026-10-27T08:00:00.000Z',
    today: '2026-10-27',
    context: {
      schema: 'registro.copilot-context/v1' as const,
      surface: 'lesson' as const,
      className: '2C',
      udaId: 'uda-1',
      lessonId: 'lesson-1'
    },
    udas: [{
      id: 'uda-1',
      title: 'Agricoltura come sistema tecnologico',
      className: '2C',
      hours: 8,
      period: 'Q1' as const,
      startMonth: 1,
      durationMonths: 2,
      description: 'Agricoltura, risorse e ciclo integrato.',
      lessons: [
        { id: 'lesson-1', date: '2026-10-27', topic: 'Ciclo integrato', hours: 1 },
        { id: 'lesson-2', date: '2026-10-27', topic: 'Risorse agricole', hours: 1 }
      ]
    }],
    library: {
      schemaVersion: 1 as const,
      sources: [{
        id: 'source-1',
        kind: 'text' as const,
        title: 'Ciclo integrato in agricoltura',
        capturedAt: '2026-10-26T18:00:00.000Z',
        payload: { text: 'Ciclo integrato agricoltura risorse agricole.' },
        status: 'ready' as const,
        privacy: sourcePrivacy,
        links: []
      }]
    },
    planning: { schemaVersion: 1 as const, profiles: [], arenaContexts: [], resources: [], masterPrograms: [], classInstances: [] },
    preferenceFactor: () => 50,
    dismissed: [],
    deferred: [],
    missions: []
  };
}

describe('AIC-07 opportunity resolver behavior', () => {
  test('proposes current lesson PREPARE only from a ready teacher-professional relevant source', async () => {
    const { resolveCopilotOpportunities } = await loadResolver();
    const result = resolveCopilotOpportunities(baseInput());
    expect(result.primary.some((item: { kind: string; scope: string }) => item.kind === 'prepare-current-lesson' && item.scope === 'contextual')).toBe(true);
  });

  test('does not propose generative work from student-personal or unknown sources', async () => {
    const { resolveCopilotOpportunities } = await loadResolver();
    expect(resolveCopilotOpportunities(baseInput('student-personal')).primary).toHaveLength(0);
    expect(resolveCopilotOpportunities(baseInput('unknown')).primary).toHaveLength(0);
  });

  test('does not invent an opportunity without positive relevance evidence', async () => {
    const { resolveCopilotOpportunities } = await loadResolver();
    const input = baseInput();
    input.library.sources[0]!.title = 'Geometria descrittiva';
    input.library.sources[0]!.payload.text = 'Proiezioni ortogonali e assonometria.';
    expect(resolveCopilotOpportunities(input).primary).toHaveLength(0);
  });

  test('can surface a different lesson dated today only when relevance binds to that exact target', async () => {
    const { resolveCopilotOpportunities } = await loadResolver();
    const input = baseInput();
    input.library.sources[0]!.title = 'Risorse agricole';
    input.library.sources[0]!.payload.text = 'Risorse agricole coltivazioni.';
    const result = resolveCopilotOpportunities(input);
    expect(result.primary.some((item: { kind: string; contextRef: { lessonId?: string } }) => item.kind === 'prepare-today-lesson' && item.contextRef.lessonId === 'lesson-2')).toBe(true);
  });

  test('is stable for identical inputs and keeps whyNow backed by evidence', async () => {
    const { resolveCopilotOpportunities } = await loadResolver();
    const first = resolveCopilotOpportunities(baseInput());
    const second = resolveCopilotOpportunities(baseInput());
    expect(first).toEqual(second);
    for (const item of [...first.primary, ...first.overflow]) {
      expect(item.evidence.some((evidence: { reason: string }) => evidence.reason === item.whyNow)).toBe(true);
    }
  });

  test('applies the approved profile thresholds and bounded primary density', async () => {
    const { resolveCopilotOpportunities } = await loadResolver();
    const present = resolveCopilotOpportunities({ ...baseInput(), profile: 'present' });
    const balanced = resolveCopilotOpportunities({ ...baseInput(), profile: 'balanced' });
    const essential = resolveCopilotOpportunities({ ...baseInput(), profile: 'essential' });
    expect(present.primary.length).toBeLessThanOrEqual(3);
    expect(balanced.primary.length).toBeLessThanOrEqual(3);
    expect(essential.primary.length).toBeLessThanOrEqual(2);
    expect(present.primary.length + present.overflow.length).toBeGreaterThanOrEqual(balanced.primary.length);
  });
});
