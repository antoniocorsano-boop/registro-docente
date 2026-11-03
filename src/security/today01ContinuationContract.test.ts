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
  test('requires the dedicated FLOW-03 recording-session module before record delegation changes', async () => {
    expect(await Bun.file('src/recording/recordSession.ts').exists()).toBe(true);
  });

  test('extends Dashboard with dedicated prepare/conduct/record/review panels and navigation-only continuation props', async () => {
    const dashboard = await source('src/components/DashboardView.tsx');

    expect(dashboard).toContain("import { PreparationRouterPanel } from './PreparationRouterPanel';");
    expect(dashboard).toContain("import { ConductLessonPanel } from './ConductLessonPanel';");
    expect(dashboard).toContain("import { RecordLessonPanel } from './RecordLessonPanel';");
    expect(dashboard).toContain("import { ReviewRouterPanel } from './ReviewRouterPanel';");
    expect(dashboard).toContain("import { type TodayAction } from '../today/todayRouter';");
    expect(dashboard).toContain("import type { ReviewSessionContext, ReviewSurface } from '../review/reviewSession';");
    expect(dashboard).toContain('todayAction?: TodayAction | null;');
    expect(dashboard).toContain('reviewSession?: ReviewSessionContext | null;');
    expect(dashboard).toContain('onContinueToday?: (tab: ActiveTab) => void;');
    expect(dashboard).toContain('onOpenReviewSurface?: (surface: ReviewSurface) => void;');
    expect(dashboard).toContain('onCloseReview?: () => void;');
    expect(dashboard).toContain('onDismissToday?: () => void;');
    expect(dashboard).toContain('onOpenPreparationCopilot?: () => void;');
    expect(dashboard).toContain('onOpenConductCopilot?: () => void;');
    expect(dashboard).toContain('onGoToRecord?: (stagedNote?: string) => void;');
    expect(dashboard).not.toContain('onSaveToday');
    expect(dashboard).not.toContain('onCreateToday');
  });

  test('delegates prepare, conduct, record and review without duplicating review analysis in Dashboard', async () => {
    const dashboard = await source('src/components/DashboardView.tsx');

    expect(dashboard).toContain("todayAction === 'prepare'");
    expect(dashboard).toContain('<PreparationRouterPanel');
    expect(dashboard).toContain("todayAction === 'conduct'");
    expect(dashboard).toContain('<ConductLessonPanel');
    expect(dashboard).toContain("todayAction === 'record' && recordSession");
    expect(dashboard).toContain('<RecordLessonPanel');
    expect(dashboard).toContain("todayAction === 'review' && reviewSession");
    expect(dashboard).toContain('<ReviewRouterPanel');
    expect(dashboard).toContain('onNavigateSurface={(surface) => onOpenReviewSurface?.(surface)}');
    expect(dashboard).toContain('onDismiss={() => onCloseReview?.()}');
    expect(dashboard).not.toContain('getRecordReviewOptions(');
    expect(dashboard).not.toContain('Prima destinazione consigliata');
  });

  test('App routes an active FLOW-04 review through its dedicated handler while generic continuations still close intent', async () => {
    const app = await source('src/App.tsx');
    const continuation = sectionBetween(app, 'const handleContinueToday', 'const handleCancelTodayAction');

    expect(continuation).toContain('const activeReviewSession = keepReviewSessionForClass(');
    expect(continuation).toContain('reviewSessionRef.current,');
    expect(continuation).toContain('currentClassIdRef.current');
    expect(continuation).toContain('isReviewSurface(tab)');
    expect(continuation).toContain('handleOpenReviewSurface(tab);');
    expect(continuation).toContain('setTodayAction(null)');
    expect(continuation).toContain('publishReviewSession(null)');
    expect(continuation).toContain('handleNavigateTab(tab)');
    expect(continuation).not.toContain('setAppData(');
    expect(continuation).not.toContain('currentClassIdRef.current =');
  });

  test('App passes session intent and dedicated review handlers to Dashboard without changing class authority', async () => {
    const app = await source('src/App.tsx');
    const dashboardRender = sectionBetween(app, "{activeTab === 'dashboard' && currentClass && (", "{/* TAB 3: Inserisci Valutazioni */}");

    expect(dashboardRender).toContain('todayAction={todayAction}');
    expect(dashboardRender).toContain('reviewSession={reviewSession}');
    expect(dashboardRender).toContain('onOpenReviewSurface={handleOpenReviewSurface}');
    expect(dashboardRender).toContain('onCloseReview={handleCloseReview}');
    expect(dashboardRender).toContain('onContinueToday={handleContinueToday}');
    expect(dashboardRender).toContain('onDismissToday={handleCancelTodayAction}');
    expect(dashboardRender).toContain('conductContext={conductContext}');
    expect(dashboardRender).toContain('onOpenConductCopilot={handleOpenConductCopilot}');
    expect(dashboardRender).toContain('onGoToRecord={handleContinueFromConductToRecord}');
    expect(dashboardRender).toContain('currentClass={currentClass}');
  });
});