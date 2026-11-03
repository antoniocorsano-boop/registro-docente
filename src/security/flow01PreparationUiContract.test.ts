import { describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';

async function source(path: string) {
  return Bun.file(path).text();
}

describe('FLOW-01 preparation UI contract', () => {
  test('materializes one dedicated presentation component', async () => {
    expect(existsSync('src/components/PreparationRouterPanel.tsx')).toBe(true);
  });

  test('Dashboard delegates prepare to its dedicated panel while FLOW-04 owns review orchestration', async () => {
    const dashboard = await source('src/components/DashboardView.tsx');

    expect(dashboard).toContain("import { PreparationRouterPanel } from './PreparationRouterPanel';");
    expect(dashboard).toContain("todayAction === 'prepare'");
    expect(dashboard).toContain('<PreparationRouterPanel');
    expect(dashboard).toContain('className={currentClass.name}');
    expect(dashboard).toContain('onNavigateTab={(tab) => onContinueToday?.(tab)}');
    expect(dashboard).toContain('onDismiss={() => onDismissToday?.()}');
    expect(dashboard).toContain("import { ReviewRouterPanel } from './ReviewRouterPanel';");
    expect(dashboard).toContain("todayAction === 'review'");
    expect(dashboard).toContain('<ReviewRouterPanel');
    expect(dashboard).not.toContain('getRecordReviewOptions(reviewEvidenceKind)');
  });

  test('panel renders professional intentions from the single routing table', async () => {
    const panel = await source('src/components/PreparationRouterPanel.tsx');

    expect(panel).toContain("import { getPreparationOptions } from '../preparation/preparationRouter';");
    expect(panel).toContain('Stai preparando per');
    expect(panel).toContain('getPreparationOptions().map');
    expect(panel).toContain("option.destination.kind === 'tab'");
    expect(panel).toContain('onNavigateTab(option.destination.tab)');
    expect(panel).toContain('onOpenCopilot()');
    expect(panel).toContain('Chiudi');
    expect(panel).toContain('min-h-[44px]');
    expect(panel).not.toContain('saveAppData');
    expect(panel).not.toContain('secureStorage');
    expect(panel).not.toContain('commitAppDataMutation');
  });

  test('generic TODAY router owns neither prepare nor conduct nor record options', async () => {
    const router = await source('src/today/todayRouter.ts');

    expect(router).toContain("export type TodayContinuationAction = Extract<TodayAction, 'review'>;");
    expect(router).toContain('Record<TodayContinuationAction, readonly TodayContinuationOption[]>');
    expect(router).not.toContain('prepare: [');
    expect(router).not.toContain('conduct: [');
    expect(router).not.toContain('record: [');
    expect(router).toContain('action: TodayContinuationAction');
  });
});
