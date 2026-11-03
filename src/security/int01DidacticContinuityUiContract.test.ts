import { describe, expect, test } from 'bun:test';

describe('INT-01 bidirectional didactic continuity', () => {
  test('uses a compact, navigation-only continuity bar without duplicating specialist decisions', async () => {
    const bar = await Bun.file('src/components/DidacticContinuityBar.tsx').text();
    expect(bar).toContain('DidacticContinuityBar');
    expect(bar).toContain('Classe');
    expect(bar).toContain('Cornice');
    expect(bar).toContain('UDA');
    expect(bar).toContain('Apri UDA');
    expect(bar).toContain('Apri Programmazione');
    expect(bar).toContain('min-h-[44px]');
    expect(bar).not.toMatch(/onSave|calcola\w*Media|vot[io]|percentual|\bKPI\b/);
  });

  test('Programmazione focalizza il profilo coerente, senza fallback al primo per classe ambigua', async () => {
    const view = await Bun.file('src/components/planning/PlanningProfileView.tsx').text();
    expect(view).toContain('focusedProfileId');
    expect(view).toContain('DidacticContinuityBar');
    expect(view).toContain('hasClassContext');
    expect(view).not.toContain(': profiles[0]?.id ?? null;');
    expect(view).toContain('onOpenUda');
  });

  test('UDA espone focus, classe e selezione esplicita senza generare una nuova UDA', async () => {
    const view = await Bun.file('src/components/UdaGanttView.tsx').text();
    expect(view).toContain('DidacticContinuityBar');
    expect(view).toContain('onTeachingFocusChange');
    expect(view).toContain('currentClassName');
    expect(view).toContain('teachingFocus');
    expect(view).toContain('onOpenPlanning');
  });

  test('App routes Programmazione and UDA through one current class and focus', async () => {
    const app = await Bun.file('src/App.tsx').text();
    expect(app).toContain('focusedProfileId={planningFrame.status');
    expect(app).toContain('onOpenUda={() => setActiveTab(');
    expect(app).toContain('onOpenPlanning={() => setActiveTab(');
    expect(app).toContain('onTeachingFocusChange={');
  });

  test('does not change the projected UDA write boundary', async () => {
    const view = await Bun.file('src/components/UdaGanttView.tsx').text();
    expect(view).not.toContain('assertTeachingUdaWritableByRegistro(');
    expect(view).toContain('onSaveUdas');
    expect(view).toContain('onTeachingFocusChange');
  });
});
