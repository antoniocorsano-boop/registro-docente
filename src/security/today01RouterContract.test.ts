import { describe, expect, test } from 'bun:test';
import {
  getTodayContinuationOptions,
  resolveTodayRoute,
  type TodayAction
} from '../today/todayRouter';

const ACTIONS: readonly TodayAction[] = ['prepare', 'conduct', 'record', 'review'];

describe('TODAY-01 routing contract', () => {
  test('requires an explicit class for every task when class context is absent', () => {
    for (const action of ACTIONS) {
      expect(resolveTodayRoute(action, null)).toEqual({
        status: 'needs-class',
        action
      });
      expect(resolveTodayRoute(action, undefined)).toEqual({
        status: 'needs-class',
        action
      });
      expect(resolveTodayRoute(action, '   ')).toEqual({
        status: 'needs-class',
        action
      });
    }
  });

  test('uses only the explicitly supplied class and lands on the existing dashboard', () => {
    expect(resolveTodayRoute('review', ' class-2c ')).toEqual({
      status: 'class-entry',
      action: 'review',
      classId: 'class-2c',
      target: 'dashboard'
    });
  });

  test('exposes only existing authoritative continuation surfaces in stable order', () => {
    expect(getTodayContinuationOptions('prepare').map(option => option.tab)).toEqual([
      'uda-gantt',
      'programmazione',
      'biblioteca',
      'verifiche-online'
    ]);
    expect(getTodayContinuationOptions('conduct').map(option => option.tab)).toEqual([
      'uda-gantt',
      'verifiche-online'
    ]);
    expect(getTodayContinuationOptions('record').map(option => option.tab)).toEqual([
      'voti',
      'comportamenti'
    ]);
    expect(getTodayContinuationOptions('review').map(option => option.tab)).toEqual([
      'tabellone',
      'analytics',
      'storico',
      'report'
    ]);
  });

  test('continuation metadata is navigation-only', () => {
    for (const action of ACTIONS) {
      for (const option of getTodayContinuationOptions(action)) {
        expect(Object.keys(option).sort()).toEqual(['label', 'tab']);
        expect(option.label.trim().length).toBeGreaterThan(0);
      }
    }
  });
});