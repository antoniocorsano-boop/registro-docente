import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import type { StudentReportReturnContext } from '../navigation/studentReportReturnContext';
import { resolveStudentReportReturnContext } from '../navigation/studentReportReturnContext';

const students = [
  { id: 'studente-a1', name: 'Persona Fittizia A1' },
  { id: 'studente-a2', name: 'Persona Fittizia A2' },
];
const classes = [
  { id: 'classe-a', students },
  { id: 'classe-b', students: [{ id: 'studente-b1', name: 'Persona Fittizia B1' }] },
];

const tabelloneContext: StudentReportReturnContext = {
  classId: 'classe-a',
  studentId: 'studente-a1',
  originTab: 'tabellone',
  scrollY: 620,
  ui: {
    periodFilter: 'Q1',
    viewMode: 'type',
    showProposedGrade: false,
    expandedStudentId: 'studente-a1',
  },
};
const analyticsContext: StudentReportReturnContext = {
  classId: 'classe-a',
  studentId: 'studente-a1',
  originTab: 'analytics',
  scrollY: 1090,
  ui: {
    periodFilter: 'Q2',
    useWeighted: true,
    studentSearch: '',
    studentSort: 'average',
    studentDetailOpen: true,
    expandedAnalyticsStudentId: 'studente-a1',
  },
};

describe('NAV-CONTEXT-01 — return to the exact mobile consulting state', () => {
  test('only the right class and the exact originating view can restore', () => {
    expect(resolveStudentReportReturnContext(tabelloneContext, 'classe-a', 'tabellone', classes))
      .toBe(tabelloneContext);
    expect(resolveStudentReportReturnContext(analyticsContext, 'classe-a', 'analytics', classes))
      .toBe(analyticsContext);
    expect(resolveStudentReportReturnContext(tabelloneContext, 'classe-a', 'analytics', classes))
      .toBeNull();
    expect(resolveStudentReportReturnContext(analyticsContext, 'classe-b', 'analytics', classes))
      .toBeNull();
    expect(resolveStudentReportReturnContext(tabelloneContext, null, 'tabellone', classes))
      .toBeNull();
    expect(resolveStudentReportReturnContext(null, 'classe-a', 'tabellone', classes))
      .toBeNull();
  });

  test('a removed or cross-class student cannot revive a closed disclosure', () => {
    expect(resolveStudentReportReturnContext(
      { ...tabelloneContext, studentId: 'studente-b1' },
      'classe-a', 'tabellone', classes
    )).toBeNull();
    expect(resolveStudentReportReturnContext(
      { ...tabelloneContext, ui: { ...tabelloneContext.ui, expandedStudentId: 'studente-b1' } },
      'classe-a', 'tabellone', classes
    )).toBeNull();
    expect(resolveStudentReportReturnContext(
      { ...analyticsContext, ui: { ...analyticsContext.ui, expandedAnalyticsStudentId: 'studente-b1' } },
      'classe-a', 'analytics', classes
    )).toBeNull();
    expect(resolveStudentReportReturnContext(
      analyticsContext, 'classe-a', 'analytics',
      [{ id: 'classe-a', students: [] }]
    )).toBeNull();
  });

  test('application maintains context in memory only, and only for browser Back', () => {
    const app = readFileSync('src/App.tsx', 'utf8');
    expect(app).toContain('studentReportReturnContextRef = useRef<StudentReportReturnContext | null>(null)');
    expect(app).toContain('resolveStudentReportReturnContext(');
    expect(app).toContain('setReturningToStudentOrigin(returningContext)');
    expect(app).toContain("if (!options.preserveStudentReturnContext) {");
    expect(app).toContain('studentReportReturnContextRef.current = null;');
    expect(app).toContain("safeOriginContext?.studentId === studentId");
    expect(app).toContain("pendingInlineCollapse && originContext?.originTab === 'tabellone'");
    expect(app).toContain("expandedStudentId: null");
    expect(app).toContain('returnContext={returningToStudentOrigin?.originTab');
    expect(app).toContain('const current = studentReportReturnContextRef.current;');
    expect(app).toContain("ui: { ...current.ui, studentSearch: '' }");
    expect(app).toContain("ui: { ...previous.ui, studentSearch: '' }");
    const navCode = app.slice(app.indexOf('const handleNavigateTab ='), app.indexOf('const handleOpenStudentReport ='));
    expect(navCode).toContain('setActiveTab(tab, { preserveStudentReturnContext: options.preserveStudentReturnContext })');
    expect(navCode).not.toContain('scrollY');
    expect(navCode).not.toContain('studentSearch');
    expect(navCode).not.toContain("params.set('student'");
  });

  test('Tabellone returns to one expanded row without changing math or desktop table', () => {
    const matrix = readFileSync('src/components/MatrixView.tsx', 'utf8');
    expect(matrix).toContain('restored?.ui.expandedStudentId');
    expect(matrix).toContain('restored?.ui.periodFilter');
    expect(matrix).toContain('restored?.ui.viewMode');
    expect(matrix).toContain('restored?.ui.showProposedGrade');
    expect(matrix).toContain('previousClassIdRef.current !== currentClass.id');
    expect(matrix).toContain("originTab: 'tabellone'");
    expect(matrix).toContain('onOpenStudentReport(s.id, {');
    expect(matrix).toContain('displayName={formatStudentNameWithPrivacy(s.name, isPrivacyShieldActive)}');
    expect(matrix).toContain('className="hidden md:block overflow-x-auto');
  });

  test('Analisi reopens the mobile detail, but never restores a name search under privacy', () => {
    const analytics = readFileSync('src/components/AnalyticsView.tsx', 'utf8');
    expect(analytics).toContain('useLayoutEffect(() => {');
    expect(analytics).toContain("() => restored?.ui.studentDetailOpen === true ? 'students' : 'summary'");
    expect(analytics).not.toContain('open={mobileStudentDetailsOpen}');
    expect(analytics).not.toContain('onToggle={event => setMobileStudentDetailsOpen');
    expect(analytics).toContain("originTab: 'analytics'");
    expect(analytics).toContain("studentDetailOpen: mobileView === 'students'");
    expect(analytics).toContain("studentSearch: isPrivacyShieldActive ? '' : studentSearch");
    expect(analytics).toContain("if (isPrivacyShieldActive) setStudentSearch('')");
    expect(analytics).toContain("() => !isPrivacyShieldActive ? (restored?.ui.studentSearch ?? '') : ''");
    expect(analytics).toContain('formatStudentNameWithPrivacy(m.student.name, isPrivacyShieldActive)');
  });

  test('scroll restoration applies only on mobile when a real return context is present', () => {
    const hook = readFileSync('src/navigation/useRestoreStudentReturnScroll.ts', 'utf8');
    expect(hook).toContain("scrollY === null || restoreKey === null");
    expect(hook).toContain("window.matchMedia('(max-width: 767px)')");
    expect(hook).toContain('window.requestAnimationFrame');
    expect(hook).toContain('window.scrollTo(');
  });
});
