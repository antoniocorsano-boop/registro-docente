import { describe, expect, test } from 'bun:test';

async function source(path: string) {
  return Bun.file(path).text();
}

function sectionBetween(text: string, start: string, end: string) {
  const startIndex = text.indexOf(start);
  const endIndex = text.indexOf(end, startIndex + start.length);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return text.slice(startIndex, endIndex);
}

describe('FLOW-01 App integration contract', () => {
  test('derives Copilota preparation launch context from the explicit current class', async () => {
    const app = await source('src/App.tsx');

    expect(app).toContain("import { buildPreparationCopilotLaunchContext } from './preparation/preparationRouter';");
    expect(app).toContain('const handleOpenPreparationCopilot = useCallback(() => {');

    const handler = sectionBetween(
      app,
      'const handleOpenPreparationCopilot = useCallback(() => {',
      'const handleStartTodayAction'
    );
    expect(handler).toContain('buildPreparationCopilotLaunchContext(currentClass)');
    expect(handler).toContain('if (!launchContext) return;');
    expect(handler).toContain('openLibraryCopilot(launchContext)');
    expect(handler).not.toContain('students');
    expect(handler).not.toContain('grades');
    expect(handler).not.toContain('behaviors');
    expect(handler).not.toContain('commitAppDataMutation');
    expect(handler).not.toContain('commitCopilotStateMutation');
  });

  test('passes only an explicit preparation Copilota callback into the existing Dashboard', async () => {
    const app = await source('src/App.tsx');

    expect(app).toContain('onOpenPreparationCopilot={handleOpenPreparationCopilot}');
    expect(app).toContain('todayAction={todayAction}');
    expect(app).toContain('onContinueToday={handleContinueToday}');
    expect(app).toContain('onDismissToday={handleCancelTodayAction}');
  });

  test('keeps tab handoff session-only and preserves explicit class authority', async () => {
    const app = await source('src/App.tsx');
    const continuation = sectionBetween(app, 'const handleContinueToday', 'const handleCancelTodayAction');

    expect(continuation).toContain('setTodayAction(null)');
    expect(continuation).toContain('handleNavigateTab(tab)');
    expect(continuation).not.toContain('currentClassIdRef.current =');
    expect(continuation).not.toContain('setAppData(');
  });

  test('does not persist FLOW-01 preparation intent into durable state contracts', async () => {
    const app = await source('src/App.tsx');
    const router = await source('src/preparation/preparationRouter.ts');

    expect(app).not.toContain('PreparationContext');
    expect(app).not.toContain('preparationContext');
    expect(router).not.toContain('secureStorage');
    expect(router).not.toContain('AppData');
    expect(router).not.toContain('PlanningState');
    expect(router).not.toContain('ProfessionalMemoryState');
    expect(router).not.toContain('CopilotState');
  });
});
