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

describe('TODAY-01 Dashboard continuation contract', () => {
  test('extends Dashboard with dedicated prepare/conduct panels and navigation-only Oggi continuation props', async () => {
    const dashboard = await source('src/components/DashboardView.tsx');

    expect(dashboard).toContain("import { PreparationRouterPanel } from './PreparationRouterPanel';");
    expect(dashboard).toContain("import { ConductLessonPanel } from './ConductLessonPanel';");
    expect(dashboard).toContain("import { getTodayContinuationOptions, type TodayAction, type TodayContinuationAction } from '../today/todayRouter';");
    expect(dashboard).toContain('todayAction?: TodayAction | null;');
    expect(dashboard).toContain('onContinueToday?: (tab: ActiveTab) => void;');
    expect(dashboard).toContain('onDismissToday?: () => void;');
    expect(dashboard).toContain('onOpenPreparationCopilot?: () => void;');
    expect(dashboard).toContain('onOpenConductCopilot?: () => void;');
    expect(dashboard).toContain('onGoToRecord?: () => void;');
    expect(dashboard).not.toContain('onSaveToday');
    expect(dashboard).not.toContain('onCreateToday');
  });

  test('delegates prepare and conduct while keeping compact generic continuations for record/review', async () => {
    const dashboard = await source('src/components/DashboardView.tsx');

    expect(dashboard).toContain("todayAction === 'prepare'");
    expect(dashboard).toContain('<PreparationRouterPanel');
    expect(dashboard).toContain("todayAction === 'conduct'");
    expect(dashboard).toContain('<ConductLessonPanel');
    expect(dashboard).toContain("todayAction && todayAction !== 'prepare' && todayAction !== 'conduct'");
    expect(dashboard).toContain('getTodayContinuationOptions(todayAction)');
    expect(dashboard).toContain('Continua:');
    expect(dashboard).toContain('min-h-[44px]');
    expect(dashboard).toContain('flex-wrap');
    expect(dashboard).toContain('onContinueToday?.(option.tab)');
    expect(dashboard).toContain('onDismissToday?.()');
  });

  test('App clears the session task when one authoritative continuation is chosen', async () => {
    const app = await source('src/App.tsx');
    const continuation = sectionBetween(app, 'const handleContinueToday', 'const handleCancelTodayAction');

    expect(continuation).toContain('setTodayAction(null)');
    expect(continuation).toContain('handleNavigateTab(tab)');
    expect(continuation).not.toContain('setAppData(');
    expect(continuation).not.toContain('currentClassIdRef.current =');
  });

  test('App passes session intent to the existing Dashboard without changing class authority', async () => {
    const app = await source('src/App.tsx');
    const dashboardRender = sectionBetween(app, "{activeTab === 'dashboard' && currentClass && (", "{/* TAB 3: Inserisci Valutazioni */}");

    expect(dashboardRender).toContain('todayAction={todayAction}');
    expect(dashboardRender).toContain('onContinueToday={handleContinueToday}');
    expect(dashboardRender).toContain('onDismissToday={handleCancelTodayAction}');
    expect(dashboardRender).toContain('conductContext={conductContext}');
    expect(dashboardRender).toContain('onOpenConductCopilot={handleOpenConductCopilot}');
    expect(dashboardRender).toContain('onGoToRecord={handleContinueFromConductToRecord}');
    expect(dashboardRender).toContain('currentClass={currentClass}');
  });
});