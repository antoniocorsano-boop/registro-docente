import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import {
  createStudentReportHistoryState,
  restoreStudentReportFromHistory
} from '../navigation/studentReportHistory';

const classes = [
  { id: 'classe-fittizia-a', students: [{ id: 'studente-a1', name: 'Persona Fittizia A1' }, { id: 'studente-a2', name: 'Persona Fittizia A2' }] },
  { id: 'classe-fittizia-b', students: [{ id: 'studente-b1', name: 'Persona Fittizia B1' }] }
];

describe('NAV-BACK-01 — cronologia professionale Scheda alunno', () => {
  test('crea stato report esplicito senza alcun nominativo e con la classe corretta', () => {
    expect(createStudentReportHistoryState('classe-fittizia-a', 'studente-a1')).toEqual({
      classId: 'classe-fittizia-a', tab: 'report', studentId: 'studente-a1'
    });
  });

  test('Indietro e Avanti mantengono alunno solo quando appartiene alla classe', () => {
    expect(restoreStudentReportFromHistory(
      createStudentReportHistoryState('classe-fittizia-a', 'studente-a2'),
      'classe-fittizia-a',
      classes
    )).toBe('studente-a2');
  });

  test('history state cross-class, eliminato, incompleto o manipolato fallisce chiuso', () => {
    for (const candidate of [
      createStudentReportHistoryState('classe-fittizia-b', 'studente-b1'),
      createStudentReportHistoryState('classe-fittizia-a', 'studente-b1'),
      createStudentReportHistoryState('classe-fittizia-a', 'studente-eliminato'),
      { tab: 'report', classId: 'classe-fittizia-a', studentId: 17 },
      { tab: 'report', classId: 'classe-fittizia-a' },
      { tab: 'dashboard', classId: 'classe-fittizia-a', studentId: 'studente-a1' },
      null, undefined
    ]) expect(restoreStudentReportFromHistory(candidate, 'classe-fittizia-a', classes)).toBeNull();
    expect(restoreStudentReportFromHistory(
      createStudentReportHistoryState('classe-fittizia-a', 'studente-a1'),
      null, classes
    )).toBeNull();
  });

  test('due sorgenti reali condividono un handler registrato in browser history', () => {
    const app = readFileSync('src/App.tsx', 'utf8');
    expect(app.split('onOpenStudentReport={handleOpenStudentReport}')).toHaveLength(3);
    expect(app).toContain("handleNavigateTab('report', { studentId })");
    expect(app).toContain('history.pushState(state');
    expect(app).toContain("createStudentReportHistoryState(classId, studentId)");
    expect(app).toContain("setSelectedStudentForReport(restoredStudentId)");
    expect(app).toContain('restoreStudentReportFromHistory(');
    expect(app).toContain("nextTab === 'report' && !restoredStudentId");
    expect(app).toContain("onSelectStudent={handleSelectStudentInReport}");
    expect(app).toContain('history.replaceState(');
    expect(app).not.toContain("setSelectedStudentForReport(studentId);\n              setActiveTab('report');");
  });

  test('URL conserva solo classe/sezione: ID alunno esclusivamente in history.state', () => {
    const app = readFileSync('src/App.tsx', 'utf8');
    const navigation = app.slice(app.indexOf('const handleNavigateTab ='), app.indexOf('const handleOpenStudentReport ='));
    expect(navigation).toContain("if (classId) params.set('class', classId)");
    expect(navigation).toContain("if (tab !== 'home' && tab !== 'dashboard') params.set('tab', tab)");
    expect(navigation).not.toContain("params.set('student");
    expect(navigation).toContain("createStudentReportHistoryState(classId, studentId)");
  });

  test('controllo storico di integrità e navigazione mantiene versioning', () => {
    const app = readFileSync('src/App.tsx', 'utf8');
    expect(app).toContain('navigationVersionRef.current += 1;');
    expect(app).toContain('publishRecordSession(null);');
    expect(app).toContain('publishReviewSession(null);');
    expect(app).toContain("setActiveTab(nextTab === 'report' && !restoredStudentId");
  });
});
