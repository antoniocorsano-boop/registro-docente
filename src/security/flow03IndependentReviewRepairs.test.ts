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
    const recording = await source('src/recording/recordSession.ts');
    const panel = await source('src/components/RecordLessonPanel.tsx');

    const updater = sectionBetween(recording, 'export function updateRecordStagedNote', 'export function markRecordSessionSaved');
    expect(updater).toContain('const normalized = note.length > 0 ? note : undefined;');
    expect(updater).not.toContain('note.trim()');
    expect(panel).toContain('onChange={(event) => onChangeStagedNote(event.target.value)}');
  });

  test('record completion is bound to the exact recording session that initiated the mutation', async () => {
    const app = await source('src/App.tsx');
    const completion = sectionBetween(app, 'const completeRecordFlow = useCallback', 'const handleChooseRecordEvidence');

    expect(completion).toContain('originatingSession: RecordSessionDraft | null');
    expect(completion).toContain('originatingClassId: string');
    expect(completion).toContain('session !== originatingSession');
    expect(completion).toContain('session.context.classId !== originatingClassId');
    expect(completion).toContain('currentClassIdRef.current !== originatingClassId');
    expect(completion).toContain('navigationVersionRef.current !== navigationVersionAtSave');
    expect(completion.indexOf('navigationVersionRef.current !== navigationVersionAtSave')).toBeLessThan(
      completion.indexOf('publishRecordSession(markRecordSessionSaved(session));')
    );

    const evaluations = sectionBetween(app, 'const handleSaveEvaluations', '// Save behaviors');
    expect(evaluations).toContain('const recordSessionAtSave = recordSessionRef.current;');
    expect(evaluations).toContain("completeRecordFlow('evaluation', navigationVersionAtSave, recordSessionAtSave, classId)");

    const behaviors = sectionBetween(app, 'const handleSaveBehaviors', '// Import online submissions');
    expect(behaviors).toContain('const recordSessionAtSave = recordSessionRef.current;');
    expect(behaviors).toContain("completeRecordFlow('behaviour', navigationVersionAtSave, recordSessionAtSave, classId)");
  });

  test('partial behavior save replaces only submitted student/date pairs', async () => {
    const app = await source('src/App.tsx');
    const behaviors = sectionBetween(app, 'const handleSaveBehaviors', '// Import online submissions');

    expect(behaviors).toContain('const submittedKeys = new Set(');
    expect(behaviors).toContain('`${entry.date}::${entry.studentId}`');
    expect(behaviors).toContain('const remaining = (targetClass.behaviors || []).filter');
    expect(behaviors).toContain('!submittedKeys.has(`${entry.date}::${entry.studentId}`)');
    expect(behaviors).not.toContain("filter(b => b.date !== entries[0].date)");
  });

  test('submission reconciliation reports imports by canonical class id', async () => {
    const reconciliation = await source('src/persistence/submissionGradeImport.ts');

    expect(reconciliation).toContain('importedCountByClassId: Record<string, number>');
    expect(reconciliation).toContain('importedCountByClassId[classData.id] =');
    expect(reconciliation).toContain('return { nextAppData, importedCountByClassId };');
  });

  test('online recording completes only when the originating class actually imported a grade', async () => {
    const app = await source('src/App.tsx');
    const importHandler = sectionBetween(app, 'const handleImportSubmissions', '// Clear imported submissions');

    expect(importHandler).toContain('const recordSessionAtSave = recordSessionRef.current;');
    expect(importHandler).toContain('const importedForOriginatingClass = reconciliation.importedCountByClassId[classId] ?? 0;');
    expect(importHandler).toContain('if (importedForOriginatingClass > 0) {');
    expect(importHandler).toContain("completeRecordFlow('online-outcomes', navigationVersionAtSave, recordSessionAtSave, classId)");
  });

  test('does not repeat the same UDA context twice in Registra', async () => {
    const panel = await source('src/components/RecordLessonPanel.tsx');
    const context = sectionBetween(panel, 'const contextLine', 'return (');

    expect(context).toContain('activityLabel || session.context.udaTitle');
    expect(context).not.toContain('[session.context.udaTitle, session.context.activityLabel]');
  });

  test('brings the authoritative UDA lesson form into the viewport after a safe FLOW-03 handoff', async () => {
    const uda = await source('src/components/UdaGanttView.tsx');
    const handoff = sectionBetween(
      uda,
      'useEffect(() => {\n    if (!recordLessonPrefill) return;',
      '// Months full Italian naming'
    );

    expect(uda).toContain('const recordLessonFormRef = useRef<HTMLFormElement | null>(null);');
    expect(handoff).toContain('pendingRecordLessonFocusRef.current = true;');
    expect(handoff).toContain('recordLessonFormRef.current?.scrollIntoView({ behavior: \'smooth\', block: \'center\' });');
    expect(uda).toContain('ref={recordLessonFormRef} onSubmit={handleAddLesson}');
  });

  test('captures the UDA diary navigation version at lesson submission, not at the original handoff', async () => {
    const uda = await source('src/components/UdaGanttView.tsx');
    const addLesson = sectionBetween(uda, 'const handleAddLesson', '// Remove lesson from UDA');

    expect(addLesson).toContain('const navigationVersionAtSave = getRecordLessonNavigationVersion?.();');
    expect(addLesson).toContain('navigationVersionAtSave !== undefined');
    expect(addLesson).toContain('onRecordLessonCommitted?.(updatedUda.id, navigationVersionAtSave);');
  });

  test('forwards the lesson navigation getter through the UDA workspace barrel', async () => {
    const workspace = await source('src/components/UdaWorkspaceView.tsx');

    expect(workspace).toContain('getRecordLessonNavigationVersion?: () => number;');
    expect(workspace).toContain('getRecordLessonNavigationVersion,');
    expect(workspace).toContain('getRecordLessonNavigationVersion={getRecordLessonNavigationVersion}');
  });

  test('applies the UDA workspace handoff only once for the same stable prefill signature', async () => {
    const workspace = await source('src/components/UdaWorkspaceView.tsx');
    const handoff = sectionBetween(workspace, 'useEffect(() => {\n    if (!recordLessonPrefill) return;', 'const filteredUdas');

    expect(workspace).toContain('const recordLessonPrefillSignatureRef = useRef<string | null>(null);');
    expect(handoff).toContain('const signature = JSON.stringify([');
    expect(handoff).toContain('recordLessonPrefill.navigationVersion');
    expect(handoff).toContain('if (recordLessonPrefillSignatureRef.current === signature) return;');
    expect(handoff).toContain('recordLessonPrefillSignatureRef.current = signature;');
  });

  test('ordinary navigation invalidates a recording session while the explicit Registra entry preserves it', async () => {
    const app = await source('src/App.tsx');
    const navigation = sectionBetween(app, 'const handleNavigateTab = useCallback', 'const resetSessionState');

    expect(navigation).toContain('const shouldPreserveRecordSession = options.preserveRecordSession === true;');
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