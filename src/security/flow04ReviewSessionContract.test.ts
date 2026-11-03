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

  test('applies one review lifecycle to specialist-driven tab transitions', async () => {
    const reviewModule = await loadReviewModule();
    expect(reviewModule).not.toBeNull();
    if (!reviewModule) return;

    const base = reviewModule.buildReviewSession({
      classId: '2C',
      className: '2C',
      origin: 'today-review'
    });
    const tabellone = reviewModule.transitionReviewSessionForTab(base, '2C', 'tabellone');
    expect(tabellone?.currentSurface).toBe('tabellone');

    const report = reviewModule.transitionReviewSessionForTab(tabellone, '2C', 'report');
    expect(report?.currentSurface).toBe('report');

    expect(reviewModule.transitionReviewSessionForTab(report, '2C', 'dashboard')).toEqual(base);
    expect(reviewModule.transitionReviewSessionForTab(report, '2C', 'voti')).toBeNull();
    expect(reviewModule.transitionReviewSessionForTab(report, '3C', 'report')).toBeNull();
  });
});

describe('FLOW-04 App lifecycle contract', () => {
  test('replaces the isolated evidence flag with one session-only ReviewSession state', async () => {
    const app = await source('src/App.tsx');

    expect(app).toContain("from './review/reviewSession';");
    expect(app).toContain('const [reviewSession, setReviewSession] = useState<ReviewSessionContext | null>(null);');
    expect(app).toContain('const reviewSessionRef = useRef<ReviewSessionContext | null>(null);');
    expect(app).toContain('const publishReviewSession = useCallback((next: ReviewSessionContext | null) => {');
    expect(app).not.toContain('const [reviewEvidenceKind, setReviewEvidenceKind]');
  });

  test('constructs review context only after explicit class resolution for both canonical origins', async () => {
    const app = await source('src/App.tsx');
    const start = sectionBetween(app, 'const handleStartTodayAction', 'const handleContinueToday');
    const postRecord = sectionBetween(app, 'const handleContinueRecordToReview', 'const handleStartTodayAction');

    expect(start).toContain("origin: 'today-review'");
    expect(start).toContain('buildReviewSession({');
    expect(start.indexOf("decision.status === 'needs-class'")).toBeLessThan(start.indexOf("origin: 'today-review'"));
    expect(postRecord).toContain("origin: 'post-record'");
    expect(postRecord).toContain('evidenceKind: session.evidenceKind ?? null');
    expect(postRecord).toContain('publishReviewSession(buildReviewSession({');
  });

  test('applies review lifecycle at the shared tab setter so specialist callbacks cannot bypass it', async () => {
    const app = await source('src/App.tsx');
    const tabSetter = sectionBetween(app, 'const setActiveTab = useCallback', 'const [editingBatchId');
    const navigation = sectionBetween(app, 'const handleNavigateTab = useCallback', 'const mutationCoordinatorRef');

    expect(tabSetter).toContain('const storedReviewSession = reviewSessionRef.current;');
    expect(tabSetter).toContain('transitionReviewSessionForTab(');
    expect(tabSetter).toContain('currentClassIdRef.current');
    expect(tabSetter).toContain('publishReviewSession(nextReviewSession);');
    expect(tabSetter).toContain('if (storedReviewSession && !nextReviewSession)');
    expect(tabSetter).toContain('setTodayAction(null);');

    expect(navigation).toContain('const hadReviewSession = reviewSessionRef.current !== null;');
    expect(navigation).toContain('setActiveTab(tab);');
    expect(navigation).toContain("if (!hadReviewSession && tab !== 'dashboard')");
    expect(navigation).not.toContain('enterReviewSurface(activeReviewSession, tab)');
    expect(navigation).not.toContain('returnToReviewRouter(activeReviewSession)');

    expect(app).toContain('const handleOpenReviewSurface = useCallback');
    expect(app).toContain('const handleReturnToReview = useCallback');
    expect(app).toContain('const handleCloseReview = useCallback');
  });

  test('distinguishes pending class selection from a class switch during an active review', async () => {
    const app = await source('src/App.tsx');
    const classSelection = sectionBetween(app, '// Handle Class selection', 'const handleNavigateHome');
    const home = sectionBetween(app, 'const handleNavigateHome', '// Add new class');

    expect(classSelection).toContain('const shouldStartPendingReview =');
    expect(classSelection).toContain("todayAction === 'review'");
    expect(classSelection).toContain('reviewSessionRef.current === null');
    expect(classSelection).toContain('publishReviewSession(null)');
    expect(classSelection).toContain("origin: 'today-review'");
    expect(classSelection).toContain('setTodayAction(null)');
    expect(home).toContain('publishReviewSession(null)');
  });

  test('popstate invalidates transient review context instead of hydrating it from history or snapshot', async () => {
    const app = await source('src/App.tsx');
    const popState = sectionBetween(app, 'const handlePopState', "window.addEventListener('popstate'");

    expect(popState).toContain('publishReviewSession(null)');
    expect(app).not.toContain('initialSnapshot.reviewSession');
    expect(app).not.toContain('reviewSession: initialSnapshot');
  });
});
