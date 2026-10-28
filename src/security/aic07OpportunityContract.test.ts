import { describe, expect, test } from 'bun:test';

async function loadProactivity() {
  const moduleUrl = new URL('../copilot/proactivity.ts', import.meta.url);
  expect(await Bun.file(moduleUrl).exists()).toBe(true);
  return import('../copilot/proactivity');
}

async function loadResolver() {
  const moduleUrl = new URL('../copilot/opportunityResolver.ts', import.meta.url);
  expect(await Bun.file(moduleUrl).exists()).toBe(true);
  return import('../copilot/opportunityResolver');
}

describe('AIC-07 opportunity contract', () => {
  test('defaults proactivity to balanced and exposes the three governed profiles', async () => {
    const { normalizeCopilotProactivity, COPILOT_PROACTIVITY_POLICIES } = await loadProactivity();
    expect(normalizeCopilotProactivity(undefined)).toBe('balanced');
    expect(normalizeCopilotProactivity('invalid')).toBe('balanced');
    expect(Object.keys(COPILOT_PROACTIVITY_POLICIES).sort()).toEqual(['balanced', 'essential', 'present']);
  });

  test('keeps opportunity detection local and reuses the qualified relevance resolver', async () => {
    const sourceText = await Bun.file(new URL('../copilot/opportunityResolver.ts', import.meta.url)).text();
    expect(sourceText).not.toContain('fetch(');
    expect(sourceText).not.toContain('requestLibraryTeachingProposal');
    expect(sourceText).toContain('resolveLibraryRelevanceTarget');
  });

  test('emits inspectable evidence, whyNow and all governed rank factors', async () => {
    const { resolveCopilotOpportunities } = await loadResolver();
    const result = resolveCopilotOpportunities({
      profile: 'present',
      now: '2026-10-27T08:00:00.000Z',
      today: '2026-10-27',
      context: {
        schema: 'registro.copilot-context/v1',
        surface: 'lesson',
        className: '2C',
        udaId: 'uda-1',
        lessonId: 'lesson-1'
      },
      udas: [{
        id: 'uda-1',
        title: 'Agricoltura come sistema tecnologico',
        className: '2C',
        hours: 8,
        period: 'Q1',
        startMonth: 1,
        durationMonths: 2,
        lessons: [{ id: 'lesson-1', date: '2026-10-27', topic: 'Ciclo integrato', hours: 1 }]
      }],
      library: {
        schemaVersion: 1,
        sources: [{
          id: 'source-1',
          kind: 'text',
          title: 'Ciclo integrato in agricoltura',
          capturedAt: '2026-10-26T18:00:00.000Z',
          payload: { text: 'Ciclo integrato agricoltura coltivazioni risorse.' },
          status: 'ready',
          privacy: 'teacher-professional',
          links: []
        }]
      },
      planning: { schemaVersion: 1, profiles: [], arenaContexts: [], resources: [], masterPrograms: [], classInstances: [] },
      preferenceFactor: () => 50,
      dismissed: [],
      deferred: [],
      missions: []
    });

    expect(result.primary.length).toBeGreaterThan(0);
    const opportunity = result.primary[0]!;
    expect(opportunity.whyNow.trim().length).toBeGreaterThan(0);
    expect(opportunity.evidence.length).toBeGreaterThan(0);
    expect(opportunity.evidence.some((item: { reason: string }) => item.reason === opportunity.whyNow)).toBe(true);
    expect(opportunity.rank).toEqual(expect.objectContaining({
      contextualRelevance: expect.any(Number),
      temporalUrgency: expect.any(Number),
      continuity: expect.any(Number),
      expectedUtility: expect.any(Number),
      teacherPreference: expect.any(Number),
      noisePenalty: expect.any(Number),
      finalScore: expect.any(Number)
    }));
  });
});
