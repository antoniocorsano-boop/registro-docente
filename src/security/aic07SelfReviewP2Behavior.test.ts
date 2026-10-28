import { describe, expect, test } from 'bun:test';
import type { CopilotOpportunityV1 } from '../copilot/opportunityResolver';

function fixture() {
  return {
    profile: 'present' as const,
    now: '2026-10-28T12:00:00.000Z',
    today: '2026-10-28',
    context: {
      schema: 'registro.copilot-context/v1' as const,
      surface: 'lesson' as const,
      className: '2C',
      udaId: 'uda-1',
      lessonId: 'lesson-1'
    },
    udas: [{
      id: 'uda-1', title: 'Agricoltura', className: '2C', hours: 8, period: 'Q1' as const,
      startMonth: 1, durationMonths: 2, description: 'Ciclo integrato e risorse agricole.',
      lessons: [{ id: 'lesson-1', date: '2026-10-28', topic: 'Ciclo integrato', hours: 1 }]
    }],
    library: {
      schemaVersion: 1 as const,
      sources: [{
        id: 'source-1', kind: 'text' as const, title: 'Ciclo integrato',
        capturedAt: '2026-10-27T12:00:00.000Z', payload: { text: 'Ciclo integrato agricoltura risorse.' },
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

describe('AIC-07 self-review P2 regressions', () => {
  test('Ignore is bound to material opportunity context and material change permits reconsideration', async () => {
    const resolver = await import('../copilot/opportunityResolver');
    const buildMaterial = (resolver as any).buildCopilotOpportunityMaterialFingerprint as undefined | ((input: any) => string);
    const buildDismissal = (resolver as any).buildCopilotOpportunityDismissalFingerprint as undefined | ((input: any) => string);
    expect(typeof buildMaterial).toBe('function');
    expect(typeof buildDismissal).toBe('function');

    const input = fixture();
    const initial = resolver.resolveCopilotOpportunities(input);
    const opportunity = initial.primary.find(item => item.kind === 'prepare-current-lesson') as CopilotOpportunityV1 | undefined;
    expect(opportunity).toBeDefined();

    const materialBefore = buildMaterial!({ opportunity: opportunity!, udas: input.udas, library: input.library });
    const dismissalBefore = buildDismissal!({ opportunity: opportunity!, context: input.context, udas: input.udas, library: input.library });
    const suppressed = resolver.resolveCopilotOpportunities({
      ...input,
      dismissed: [{ opportunityId: opportunity!.id, contextFingerprint: dismissalBefore }]
    });
    expect([...suppressed.primary, ...suppressed.overflow].some(item => item.id === opportunity!.id)).toBe(false);

    const changed = fixture();
    changed.library.sources[0]!.title = 'Ciclo integrato aggiornato';
    changed.library.sources[0]!.payload.text = 'Ciclo integrato agricoltura risorse aggiornate.';
    const materialAfter = buildMaterial!({ opportunity: opportunity!, udas: changed.udas, library: changed.library });
    expect(materialAfter).not.toBe(materialBefore);

    const reconsidered = resolver.resolveCopilotOpportunities({
      ...changed,
      dismissed: [{ opportunityId: opportunity!.id, contextFingerprint: dismissalBefore }]
    });
    expect([...reconsidered.primary, ...reconsidered.overflow].some(item => item.id === opportunity!.id)).toBe(true);
  });

  test('Play compares the previewed mission fingerprint with current committed authority inputs before authorization', async () => {
    const [experience, app] = await Promise.all([
      Bun.file(new URL('../components/CopilotExperience.tsx', import.meta.url)).text(),
      Bun.file(new URL('../App.tsx', import.meta.url)).text()
    ]);
    expect(experience).toContain('buildMissionContextFingerprint');
    expect(experience).toContain('buildCopilotOpportunityDismissalFingerprint');
    const start = app.indexOf('const handleStartCopilotMission');
    const end = app.indexOf('const handleResumeCopilotMission', start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const fragment = app.slice(start, end);
    expect(fragment).not.toContain('void contextFingerprint');
    expect(fragment).toContain('buildMissionContextFingerprint');
    expect(fragment).toContain('currentContextFingerprint');
    expect(fragment).toContain('materialFingerprint');
    expect(fragment).toContain('Il contesto della missione è cambiato');
  });

  test('discard keeps the ready result visible until durable mission archival succeeds', async () => {
    const panel = await Bun.file(new URL('../components/LibraryProposalPanel.tsx', import.meta.url)).text();
    const start = panel.indexOf('const leaveProposal');
    const end = panel.indexOf('const startEditing', start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const fragment = panel.slice(start, end);
    expect(fragment).toContain('const leaveProposal = async');
    const awaitIndex = fragment.indexOf('await');
    const clearIndex = fragment.indexOf('setProposal(null)');
    expect(awaitIndex).toBeGreaterThan(-1);
    expect(clearIndex).toBeGreaterThan(awaitIndex);
    expect(fragment).toContain('catch');
  });
});
