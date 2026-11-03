import { describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROUTER_MODULE_URL = new URL('../today/todayRouter.ts', import.meta.url);
const ROUTER_MODULE_PATH = fileURLToPath(ROUTER_MODULE_URL);
const ACTIONS = ['prepare', 'conduct', 'record', 'review'] as const;
const CONTINUATION_ACTIONS = ['review'] as const;

const routerExists = () => existsSync(ROUTER_MODULE_PATH);

const loadRouter = async () => {
  if (!routerExists()) return null;
  return import('../today/todayRouter');
};

describe('TODAY-01 routing contract', () => {
  test('materializes the dedicated session-only routing module', () => {
    expect(routerExists()).toBe(true);
  });

  test('requires an explicit class for every task when class context is absent', async () => {
    const router = await loadRouter();
    if (!router) return;

    for (const action of ACTIONS) {
      expect(router.resolveTodayRoute(action, null)).toEqual({
        status: 'needs-class',
        action
      });
      expect(router.resolveTodayRoute(action, undefined)).toEqual({
        status: 'needs-class',
        action
      });
      expect(router.resolveTodayRoute(action, '   ')).toEqual({
        status: 'needs-class',
        action
      });
    }
  });

  test('uses only the explicitly supplied class and lands on the existing dashboard', async () => {
    const router = await loadRouter();
    if (!router) return;

    expect(router.resolveTodayRoute('review', ' class-2c ')).toEqual({
      status: 'class-entry',
      action: 'review',
      classId: 'class-2c',
      target: 'dashboard'
    });
  });

  test('keeps only the non-orchestrated review continuation surface authoritative and stable', async () => {
    const router = await loadRouter();
    if (!router) return;

    expect(router.getTodayContinuationOptions('review').map(option => option.tab)).toEqual([
      'tabellone',
      'analytics',
      'storico',
      'report'
    ]);
  });

  test('remaining continuation metadata stays navigation-only', async () => {
    const router = await loadRouter();
    if (!router) return;

    for (const action of CONTINUATION_ACTIONS) {
      for (const option of router.getTodayContinuationOptions(action)) {
        expect(Object.keys(option).sort()).toEqual(['label', 'tab']);
        expect(option.label.trim().length).toBeGreaterThan(0);
      }
    }
  });
});
