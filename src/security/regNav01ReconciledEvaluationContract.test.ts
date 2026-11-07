import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const source = readFileSync('src/App.tsx', 'utf8');

function section(first: string, last: string): string {
  const a = source.indexOf(first);
  const b = source.indexOf(last, a + first.length);
  expect(a, first).toBeGreaterThanOrEqual(0);
  expect(b, last).toBeGreaterThan(a);
  return source.slice(a, b);
}

describe('REG-NAV-01 reconciled — specialist evaluation navigation', () => {
  test('Storico editing becomes a real class-checked browser-history entry', () => {
    const edit = section('const handleEditBatch =', '// Delete batch');
    expect(edit).toContain("selectedClass?.grades.some(");
    expect(edit).toContain("handleNavigateTab('voti', {");
    expect(edit).toContain('evaluationBatchId: batchId');
    expect(edit).toContain("returnTab: 'storico'");
    expect(edit).toContain('window.history.state?.tab');
  });

  test('Annulla Modifica returns to Storico without writing, and invalidates the editor token', () => {
    const edit = section('const handleCancelEvaluationEdit =', '// Delete batch');
    expect(edit).toContain('forgetSpecialistTarget(');
    expect(edit).toContain('setEditingBatchId(null)');
    expect(edit).toContain('history.replaceState(');
    expect(edit).toContain('history.back()');
    expect(edit).toContain("handleNavigateTab('storico'");
    expect(source).toContain('onCancelEdit={handleCancelEvaluationEdit}');
  });

  test('after successful durable save the current history entry reflects Storico', () => {
    const save = section('const handleSaveEvaluations =', '// Save behavior notes');
    expect(save).toContain('afterCommit:');
    expect(save).toContain('currentClassIdRef.current === classId');
    expect(save).toContain("handleNavigateTab('storico', { navigationMode: 'replace'");
  });

  test('Back/Forward must reject missing or deleted evaluation targets', () => {
    const history = section('const handlePopState = (e: PopStateEvent) => {', "window.addEventListener('popstate', handlePopState)");
    expect(history).toContain('recallSpecialistTarget(');
    expect(history).toContain('selectedClass?.grades.some(');
    expect(history).toContain('forgetSpecialistTarget(');
    expect(history).toContain("setEditingBatchId(nextTab === 'voti' ? restoredBatch : null)");
  });

  test('current student-report and mobile Tabellone history remain authoritative', () => {
    expect(source).toContain("handleNavigateTab('report', { studentId, preserveStudentReturnContext: true })");
    expect(source).toContain('queueMobileMatrixExit(');
    expect(source).toContain('studentReportReturnContextRef.current');
    expect(source).toContain('restoreStudentReportFromHistory(');
    expect(source).toContain('createStudentReportHistoryState(classId, studentId)');
    expect(source).toContain('pendingMobileMatrixExitRef.current');
  });

  test('evaluation batch IDs are kept out of browser URL and state', () => {
    const navigation = section('const handleNavigateTab = useCallback(', 'const handleOpenStudentReport = useCallback(');
    expect(navigation).toContain('[SPECIALIST_TARGET_HISTORY_KEY]: evaluationToken');
    expect(navigation).toContain('rememberSpecialistTarget(');
    expect(navigation).toContain("if (tab !== 'home' && tab !== 'dashboard') params.set('tab', tab)");
    expect(navigation).not.toContain("params.set('batch'");
    expect(navigation).not.toContain("params.set('evaluation'");
  });
});
