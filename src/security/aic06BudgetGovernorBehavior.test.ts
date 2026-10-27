import { describe, expect, test } from 'bun:test';
import {
  buildAiBudgetActivityKey,
  createAiBudgetAuthorization,
  isAiBudgetAuthorizationValid,
  normalizeAiBudgetProfile,
  resolvePrepareBudget
} from '../copilot/aiBudgetGovernor';

describe('AIC-06 dynamic AI budget governor behavior', () => {
  test('normalizes missing or unknown profiles to balanced', () => {
    expect(normalizeAiBudgetProfile(undefined)).toBe('balanced');
    expect(normalizeAiBudgetProfile('unexpected')).toBe('balanced');
    expect(normalizeAiBudgetProfile('economy')).toBe('economy');
    expect(normalizeAiBudgetProfile('quality')).toBe('quality');
  });

  test('keeps routine text on the low tier with profile-specific thresholds', () => {
    const now = '2026-10-27T18:00:00.000Z';
    const activityKey = buildAiBudgetActivityKey('uda-1', 'lesson-1');
    const cases = [
      { profile: 'economy' as const, textBytes: 16 * 1024, memoryItems: 1 },
      { profile: 'balanced' as const, textBytes: 64 * 1024, memoryItems: 3 },
      { profile: 'quality' as const, textBytes: 128 * 1024, memoryItems: 5 }
    ];

    for (const item of cases) {
      expect(resolvePrepareBudget({
        ...item,
        inlineBytes: 0,
        activityKey,
        now
      })).toEqual({
        kind: 'allow',
        tier: 'remote-low',
        maxOutputTokens: 1024,
        escalated: false
      });
    }
  });

  test('requires escalation for binary, large and rich-context requests', () => {
    const base = {
      profile: 'balanced' as const,
      activityKey: buildAiBudgetActivityKey('uda-1'),
      now: '2026-10-27T18:00:00.000Z'
    };

    expect(resolvePrepareBudget({ ...base, textBytes: 1, inlineBytes: 4, memoryItems: 0 })).toMatchObject({
      kind: 'escalation-required', reason: 'BINARY_SOURCE'
    });
    expect(resolvePrepareBudget({ ...base, textBytes: 64 * 1024 + 1, inlineBytes: 0, memoryItems: 0 })).toMatchObject({
      kind: 'escalation-required', reason: 'LARGE_SOURCE'
    });
    expect(resolvePrepareBudget({ ...base, textBytes: 1, inlineBytes: 0, memoryItems: 4 })).toMatchObject({
      kind: 'escalation-required', reason: 'RICH_CONTEXT'
    });
  });

  test('allows an expensive request only with a valid authorization bound to the same activity', () => {
    const issuedAt = '2026-10-27T18:00:00.000Z';
    const activityKey = buildAiBudgetActivityKey('uda-1', 'lesson-1');
    const authorization = createAiBudgetAuthorization({
      scope: 'activity',
      activityKey,
      issuedAt
    });

    expect(isAiBudgetAuthorizationValid({
      authorization,
      activityKey,
      now: '2026-10-27T18:29:59.000Z'
    })).toBe(true);
    expect(isAiBudgetAuthorizationValid({
      authorization,
      activityKey,
      now: '2026-10-27T18:30:01.000Z'
    })).toBe(false);
    expect(isAiBudgetAuthorizationValid({
      authorization,
      activityKey: buildAiBudgetActivityKey('uda-2', 'lesson-1'),
      now: '2026-10-27T18:10:00.000Z'
    })).toBe(false);

    expect(resolvePrepareBudget({
      profile: 'balanced',
      textBytes: 1,
      inlineBytes: 4,
      memoryItems: 0,
      activityKey,
      authorization,
      now: '2026-10-27T18:10:00.000Z'
    })).toEqual({
      kind: 'allow',
      tier: 'remote-expanded',
      maxOutputTokens: 2048,
      escalated: true
    });
  });

  test('operation authorization is short lived and cannot be reused across activities', () => {
    const activityKey = buildAiBudgetActivityKey('uda-1');
    const authorization = createAiBudgetAuthorization({
      scope: 'operation',
      activityKey,
      issuedAt: '2026-10-27T18:00:00.000Z'
    });

    expect(isAiBudgetAuthorizationValid({ authorization, activityKey, now: '2026-10-27T18:04:59.000Z' })).toBe(true);
    expect(isAiBudgetAuthorizationValid({ authorization, activityKey, now: '2026-10-27T18:05:01.000Z' })).toBe(false);
    expect(isAiBudgetAuthorizationValid({
      authorization,
      activityKey: buildAiBudgetActivityKey('uda-1', 'lesson-2'),
      now: '2026-10-27T18:01:00.000Z'
    })).toBe(false);
  });
});
