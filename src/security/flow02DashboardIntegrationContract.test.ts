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

describe('FLOW-02 Dashboard integration contract', () => {
  test('delegates conduct to a dedicated panel and leaves only record/review generic', async () => {
    const dashboard = await source('src/components/DashboardView.tsx');
    const router = await source('src/today/todayRouter.ts');

    expect(dashboard).toContain("import { ConductLessonPanel } from './ConductLessonPanel';");
    expect(dashboard).toContain("import type { ConductContextResolution } from '../conduct/conductSession';");
    expect(dashboard).toContain("todayAction === 'conduct'");
    expect(dashboard).toContain('<ConductLessonPanel');
    expect(dashboard).toContain("todayAction && todayAction !== 'prepare' && todayAction !== 'conduct'");
    expect(router).toContain("export type TodayContinuationAction = Exclude<TodayAction, 'prepare' | 'conduct'>;");
    expect(router).not.toContain('  conduct: [');
  });

  test('remounts the conduct panel when the selected class changes so rapid notes cannot cross classes', async () => {
    const dashboard = await source('src/components/DashboardView.tsx');
    const conductPanel = sectionBetween(
      dashboard,
      "{todayAction === 'conduct' && conductContext && (",
      "{todayAction && todayAction !== 'prepare' && todayAction !== 'conduct' && ("
    );

    expect(conductPanel).toContain('key={currentClass.id}');
  });

  test('routes conduct specialist exits through the canonical session-clearing continuation', async () => {
    const dashboard = await source('src/components/DashboardView.tsx');

    expect(dashboard).toContain('conductContext?: ConductContextResolution | null;');
    expect(dashboard).toContain('privacyShieldActive?: boolean;');
    expect(dashboard).toContain('onTogglePrivacyShield?: () => void;');
    expect(dashboard).toContain('onOpenConductCopilot?: () => void;');
    expect(dashboard).toContain('onGoToRecord?: () => void;');
    expect(dashboard).toContain("onNavigateLibrary={() => onContinueToday?.('biblioteca')}");
    expect(dashboard).toContain("onNavigateAssessment={() => onContinueToday?.('verifiche-online')}");
    expect(dashboard).toContain("onNavigateUda={() => onContinueToday?.('uda-gantt')}");
    expect(dashboard).toContain('onOpenCopilot={() => onOpenConductCopilot?.()}');
    expect(dashboard).toContain('onGoToRecord={() => onGoToRecord?.()}');
    expect(dashboard).toContain('onTogglePrivacyShield={() => onTogglePrivacyShield?.()}');
  });

  test('App supplies conduct context, current Privacy Shield and session-only handoffs', async () => {
    const app = await source('src/App.tsx');
    const render = sectionBetween(
      app,
      "{activeTab === 'dashboard' && currentClass && (",
      '{/* TAB 3: Inserisci Valutazioni */}'
    );

    expect(render).toContain('conductContext={conductContext}');
    expect(render).toContain('privacyShieldActive={isPrivacyShieldActive}');
    expect(render).toContain('onTogglePrivacyShield={handleTogglePrivacyShield}');
    expect(render).toContain('onOpenConductCopilot={handleOpenConductCopilot}');
    expect(render).toContain('onGoToRecord={handleContinueFromConductToRecord}');
    expect(render).toContain('currentClass={currentClass}');
  });

  test('retains expert Dashboard content below the orchestration panels', async () => {
    const dashboard = await source('src/components/DashboardView.tsx');
    const conductIndex = dashboard.indexOf("todayAction === 'conduct'");
    const overviewIndex = dashboard.indexOf('{/* Overview & KPIs */}');

    expect(conductIndex).toBeGreaterThanOrEqual(0);
    expect(overviewIndex).toBeGreaterThan(conductIndex);
    expect(dashboard).toContain('Panoramica Sezione: {currentClass.name}');
  });
});
