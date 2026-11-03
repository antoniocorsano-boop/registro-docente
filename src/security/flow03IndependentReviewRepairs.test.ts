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

describe('FLOW-03 independent review repairs', () => {
  test('staged note editing preserves raw spaces and newlines until an explicit handoff boundary', async () => {
    const {
      buildRecordSession,
      updateRecordStagedNote
    } = await import('../recording/recordSession');

    const session = buildRecordSession({ classId: 'class-a', className: '2A' });
    const editing = {
      ...session,
      evidenceKind: 'lesson-log' as const,
      status: 'editing' as const
    };

    expect(updateRecordStagedNote(editing, 'due parole ' ).stagedNote).toBe('due parole ');
    expect(updateRecordStagedNote(editing, 'prima riga\n').stagedNote).toBe('prima riga\n');
  });

  test('record completion is bound to the exact recording session that initiated the mutation', async () => {
    const app = await source('src/App.tsx');
    const completion = sectionBetween(app, 'const completeRecordFlow', 'const handleChooseRecordEvidence');

    expect(completion).toContain('originatingSession: RecordSessionDraft | null');
    expect(completion).toContain('session !== originatingSession');
    expect(completion).toContain('originatingClassId: string');
    expect(completion).toContain('session.context.classId !== originatingClassId');

    const evaluations = sectionBetween(app, 'const handleSaveEvaluations', '// Save behavior notes');
    expect(evaluations).toContain('const recordSessionAtSave = recordSessionRef.current;');
    expect(evaluations).toContain("completeRecordFlow('evaluation', navigationVersionAtSave, recordSessionAtSave, classId)");

    const behaviours = sectionBetween(app, 'const handleSaveBehaviors', '// Edit batch');
    expect(behaviours).toContain('const recordSessionAtSave = recordSessionRef.current;');
    expect(behaviours).toContain("completeRecordFlow('behaviour', navigationVersionAtSave, recordSessionAtSave, classId)");
  });

  test('partial behavior save replaces only submitted student/date pairs', async () => {
    const app = await source('src/App.tsx');
    const behaviours = sectionBetween(app, 'const handleSaveBehaviors', '// Edit batch');

    expect(behaviours).toContain('const submittedBehaviorKeys = new Set(');
    expect(behaviours).toContain('`${record.date}::${record.studentId}`');
    expect(behaviours).toContain('!submittedBehaviorKeys.has(`${record.date}::${record.studentId}`)');
    expect(behaviours).not.toContain('filter(b => b.date !== dateStr)');
  });

  test('submission reconciliation reports imports by canonical class id', async () => {
    const { reconcileSubmissionGrades } = await import('../persistence/submissionGradeImport');

    const classes = [
      {
        id: 'class-a',
        name: '2A',
        students: [{ id: 'student-a', name: 'Anna Rossi' }],
        grades: []
      },
      {
        id: 'class-b',
        name: '2B',
        students: [{ id: 'student-b', name: 'Bruno Bianchi' }],
        grades: []
      }
    ] as any;
    const submissions = [{
      id: 'sub-b',
      class: '2B',
      name: 'Bruno Bianchi',
      score: 8,
      total: 10,
      date: '2026-11-02T10:00:00.000Z',
      testTitle: 'Energia',
      testId: 'test-1'
    }] as any;

    const result = reconcileSubmissionGrades(classes, submissions);
    expect((result as any).importedCountByClassId).toEqual({ 'class-b': 1 });
  });

  test('online recording completes only when the originating class actually imported a grade', async () => {
    const app = await source('src/App.tsx');
    const imports = sectionBetween(app, 'const handleImportSubmissionsToRegister', '// Save UDAs');

    expect(imports).toContain('const recordSessionAtSave = recordSessionRef.current;');
    expect(imports).toContain('const recordingClassId = recordSessionAtSave?.context.classId;');
    expect(imports).toContain('importedCountByClassId = result.importedCountByClassId;');
    expect(imports).toContain('if (recordingClassId && (importedCountByClassId[recordingClassId] || 0) > 0)');
    expect(imports).toContain("completeRecordFlow('online-outcomes', navigationVersionAtSave, recordSessionAtSave, recordingClassId)");
  });

  test('does not repeat the same UDA context twice in Registra', async () => {
    const panel = await source('src/components/RecordLessonPanel.tsx');

    expect(panel).toContain('const udaTitle = session.context.udaTitle?.trim();');
    expect(panel).toContain('const activityLabel = session.context.activityLabel?.trim();');
    expect(panel).toContain('activityLabel !== udaTitle');
    expect(panel).toContain('secondaryActivityLabel');
  });

  test('brings the authoritative UDA lesson form into the viewport after a safe FLOW-03 handoff', async () => {
    const uda = await source('src/components/UdaGanttView.tsx');

    expect(uda).toContain('recordLessonFormRef');
    expect(uda).toContain('scrollIntoView');
    expect(uda).toContain("block: 'center'");
    expect(uda).toContain('preventScroll: true');
    expect(uda).toContain('ref={recordLessonFormRef}');
  });

  test('captures the UDA diary navigation version at lesson submission, not at the original handoff', async () => {
    const app = await source('src/App.tsx');
    const uda = await source('src/components/UdaGanttView.tsx');
    const addLesson = sectionBetween(uda, '// Add lesson to current UDA', '// Remove lesson from UDA');

    expect(uda).toContain('getRecordLessonNavigationVersion?: () => number;');
    expect(addLesson).toContain('const navigationVersionAtSave = getRecordLessonNavigationVersion?.();');
    expect(addLesson.indexOf('const navigationVersionAtSave = getRecordLessonNavigationVersion?.();')).toBeLessThan(
      addLesson.indexOf('void commitUdaViewMutation(nextUdas, () => {')
    );
    expect(addLesson).toContain('navigationVersionAtSave !== undefined');
    expect(addLesson).toContain('onRecordLessonCommitted?.(updatedUda.id, navigationVersionAtSave);');
    expect(addLesson).not.toContain('onRecordLessonCommitted?.(updatedUda.id, recordLessonPrefill.navigationVersion);');

    const committed = sectionBetween(
      app,
      'const handleRecordLessonCommitted = useCallback',
      'const handleUpdateRecordStagedNote = useCallback'
    );
    expect(committed).toContain('navigationVersionAtSave: number');
    expect(committed).toContain(
      "completeRecordFlow('lesson-log', navigationVersionAtSave, session, session.context.classId);"
    );

    const render = sectionBetween(app, "{activeTab === 'uda-gantt' && (", '{/* TAB 12: Impostazioni & Tema */}');
    expect(render).toContain('getRecordLessonNavigationVersion={() => navigationVersionRef.current}');
    expect(render).toContain('onRecordLessonCommitted={handleRecordLessonCommitted}');
  });

  test('forwards the lesson navigation getter through the UDA workspace barrel', async () => {
    const workspace = await source('src/components/UdaWorkspaceView.tsx');

    expect(workspace).toContain('getRecordLessonNavigationVersion?: () => number;');
    expect(workspace).toContain('getRecordLessonNavigationVersion,');

    const planning = sectionBetween(
      workspace,
      "{activeView === 'planning' && (",
      "{activeView === 'analysis' && ("
    );
    expect(planning).toContain('getRecordLessonNavigationVersion={getRecordLessonNavigationVersion}');
  });

  test('applies the UDA workspace handoff only once for the same stable prefill signature', async () => {
    const workspace = await source('src/components/UdaWorkspaceView.tsx');

    expect(workspace).toContain("import React, { useEffect, useMemo, useRef, useState } from 'react';");
    expect(workspace).toContain('const recordLessonPrefillSignatureRef = useRef<string | null>(null);');
    expect(workspace).toContain('const signature = JSON.stringify([');
    expect(workspace).toContain('recordLessonPrefill.navigationVersion');
    expect(workspace).toContain('if (recordLessonPrefillSignatureRef.current === signature) return;');
    expect(workspace).toContain('recordLessonPrefillSignatureRef.current = signature;');
  });

  test('ordinary navigation invalidates a recording session while the explicit Registra entry preserves it', async () => {
    const app = await source('src/App.tsx');
    const navigation = sectionBetween(app, 'const handleNavigateTab = useCallback', 'const mutationCoordinatorRef');

    expect(navigation).toContain('preserveRecordSession?: boolean');
    expect(navigation).toContain('const shouldPreserveRecordSession =');
    expect(navigation).toContain('Boolean(options.preserveRecordSession)');
    expect(navigation).not.toContain("recordSessionRef.current.evidenceKind === 'lesson-log'");
    expect(navigation).toContain('if (!shouldPreserveRecordSession) {');
    expect(navigation).toContain('publishRecordSession(null);');
    expect(navigation).toContain('recordSpecialistNavigationVersionRef.current = null;');

    const start = sectionBetween(app, 'const handleStartTodayAction = useCallback', 'const handleContinueToday');
    expect(start).toContain("handleNavigateTab(decision.target, { preserveRecordSession: action === 'record' });");
  });

  test('carries a staged Registra note only after an explicit same-class UDA selection when no UDA was prebound', async () => {
    const uda = await source('src/components/UdaGanttView.tsx');
    const handoff = sectionBetween(
      uda,
      'useEffect(() => {\n    if (!recordLessonPrefill) return;',
      '// Months full Italian naming'
    );

    expect(handoff).toContain('pendingRecordLessonFocusRef.current = !recordLessonPrefill.udaId;');
    expect(handoff).toContain('setSelectedUdaForDetail(null);');
    expect(handoff).toContain('selectedUdaForDetail.className !== recordLessonPrefill.className');
    expect(handoff).toContain('(recordLessonPrefill.udaId && selectedUdaForDetail.id !== recordLessonPrefill.udaId)');
    expect(handoff).toContain('if (!recordLessonPrefill.udaId) {');
    expect(handoff).toContain("setNewLessonNotes(recordLessonPrefill.notes?.trim() || '');");
  });

  test('FLOW-03 browser journeys fail closed on page errors after their final evidence screenshot', async () => {
    const browser = await source('tests/browser/flow-03-registra.spec.cjs');
    expect(browser).toContain('function installPageErrorCollector(page)');
    expect(browser).toContain("page.on('pageerror'");

    const desktop = sectionBetween(
      browser,
      "test('Registra → Valutazione keeps explicit class/UDA context without writing'",
      "// Conduci → Registra → diario UDA"
    );
    expect(desktop).toContain('const pageErrors = installPageErrorCollector(page);');
    expect(desktop).toContain("page.screenshot({ path: evidencePath('flow-03-desktop-standalone-evaluation.png'), fullPage: true });");
    expect(desktop).toContain('expect(pageErrors).toEqual([]);');
    expect(desktop.indexOf("flow-03-desktop-standalone-evaluation.png")).toBeLessThan(desktop.lastIndexOf('expect(pageErrors).toEqual([]);'));

    const mobile = browser.slice(browser.indexOf("test('records one explicit UDA lesson"));
    expect(mobile).toContain('const pageErrors = installPageErrorCollector(page);');
    expect(mobile).toContain("page.screenshot({ path: evidencePath('flow-03-mobile-final.png'), fullPage: true });");
    expect(mobile).toContain('expect(pageErrors).toEqual([]);');
    expect(mobile.indexOf("flow-03-mobile-final.png")).toBeLessThan(mobile.lastIndexOf('expect(pageErrors).toEqual([]);'));
  });
});