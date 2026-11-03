import { describe, expect, test } from 'bun:test';

async function loadReviewModule() {
  return import('../review/reviewSession').catch(() => null);
}

describe('FLOW-04 ReviewSession domain', () => {
  test('builds a session-only review context from Today', async () => {
    const reviewModule = await loadReviewModule();
    expect(reviewModule).not.toBeNull();
    if (!reviewModule) return;

    expect(reviewModule.buildReviewSession({
      classId: ' 2C ',
      className: ' 2C ',
      origin: 'today-review'
    })).toEqual({
      classId: '2C',
      className: '2C',
      origin: 'today-review'
    });
  });

  test('preserves post-record evidence without selecting a surface', async () => {
    const reviewModule = await loadReviewModule();
    expect(reviewModule).not.toBeNull();
    if (!reviewModule) return;

    expect(reviewModule.buildReviewSession({
      classId: '2C',
      className: '2C',
      origin: 'post-record',
      evidenceKind: 'behaviour'
    })).toEqual({
      classId: '2C',
      className: '2C',
      origin: 'post-record',
      evidenceKind: 'behaviour'
    });
  });

  test('rejects an empty class', async () => {
    const reviewModule = await loadReviewModule();
    expect(reviewModule).not.toBeNull();
    if (!reviewModule) return;

    expect(() => reviewModule.buildReviewSession({
      classId: ' ',
      className: '2C',
      origin: 'today-review'
    })).toThrow('REVIEW_CLASS_REQUIRED');
  });

  test('tracks only review surfaces and can return to the router', async () => {
    const reviewModule = await loadReviewModule();
    expect(reviewModule).not.toBeNull();
    if (!reviewModule) return;

    const base = reviewModule.buildReviewSession({
      classId: '2C',
      className: '2C',
      origin: 'today-review'
    });
    const analytics = reviewModule.enterReviewSurface(base, 'analytics');

    expect(analytics.currentSurface).toBe('analytics');
    expect(reviewModule.returnToReviewRouter(analytics)).toEqual(base);
    expect(reviewModule.isReviewSurface('tabellone')).toBe(true);
    expect(reviewModule.isReviewSurface('settings')).toBe(false);
  });

  test('fails closed across classes', async () => {
    const reviewModule = await loadReviewModule();
    expect(reviewModule).not.toBeNull();
    if (!reviewModule) return;

    const session = reviewModule.buildReviewSession({
      classId: '2C',
      className: '2C',
      origin: 'today-review'
    });

    expect(reviewModule.keepReviewSessionForClass(session, '2C')).toEqual(session);
    expect(reviewModule.keepReviewSessionForClass(session, '3C')).toBeNull();
    expect(reviewModule.keepReviewSessionForClass(session, null)).toBeNull();
  });
});
