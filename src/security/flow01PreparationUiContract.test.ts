import { describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';

async function source(path: string) {
  return Bun.file(path).text();
}

describe('FLOW-01 preparation UI contract', () => {
  test('materializes one dedicated presentation component', async () => {
    expect(existsSync('src/components/PreparationRouterPanel.tsx')).toBe(true);
  });

  test('Dashboard delegates prepare to the dedicated panel and preserves generic TODAY continuations', async () => {
    const dashboard = await source('src/components/DashboardView.tsx');

    expect(dashboard).toContain("import { PreparationRouterPanel } from './PreparationRouterPanel';");
    expect(dashboard).toContain("todayAction === 'prepare'");
    expect(dashboard).toContain('<PreparationRouterPanel');
    expect(dashboard).toContain('className={currentClass.name}');
    expect(dashboard).toContain('onNavigateTab={(tab) => onContinueToday?.(tab)}');
    expect(dashboard).toContain('onDismiss={() => onDismissToday?.()}');
    expect(dashboard).toContain("todayAction && todayAction !== 'prepare'");
    expect(dashboard).toContain('getTodayContinuationOptions(todayAction)');
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

  test('generic TODAY router no longer owns preparation options', async () => {
    const router = await source('src/today/todayRouter.ts');

    expect(router).toContain("export type TodayContinuationAction = Exclude<TodayAction, 'prepare'>;");
    expect(router).toContain('Record<TodayContinuationAction, readonly TodayContinuationOption[]>');
    expect(router).not.toContain('prepare: [');
    expect(router).toContain("action: TodayContinuationAction");
  });
});
