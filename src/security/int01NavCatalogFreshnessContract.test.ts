import { describe, expect, test } from 'bun:test';

describe('INT-01 / NAV-S1 merged history authority', () => {
  test('Back and Forward validate teaching focus against the live UDA catalog', async () => {
    const app = await Bun.file('src/App.tsx').text();
    expect(app).toContain('const teachingUdaCatalogRef = useRef(teachingUdaCatalog)');
    expect(app).toContain('teachingUdaCatalogRef.current = teachingUdaCatalog');
    expect(app).toContain(
      'transitionTeachingFocusForTab(previous, currentClassIdRef.current, tab, teachingUdaCatalogRef.current)'
    );
    expect(app).not.toContain(
      'transitionTeachingFocusForTab(previous, currentClassIdRef.current, tab, teachingUdaCatalog)'
    );
    // The old mount-only handler retained a stale navigation callback. Rebinding
    // when its dependencies change preserves the browser history contracts.
    expect(app).toContain(
      '}, [hasUnsavedActiveDraft, publishRecordSession, publishReviewSession, requestPlanningDeparture, setActiveTab, traceHpr]);'
    );
  });

  test('retains both specialist Back stacks and their class-bound target checks', async () => {
    const app = await Bun.file('src/App.tsx').text();
    expect(app).toContain('pendingEvaluationCancelRef.current');
    expect(app).toContain('pendingMobileMatrixExitRef.current');
    expect(app).toContain('recallSpecialistTarget(');
    expect(app).toContain('restoreStudentReportFromHistory(');
    expect(app).toContain('keepTeachingFocusForClass(previous, appData.currentClassId, teachingUdaCatalog)');
  });
});
