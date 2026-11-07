import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const matrix = readFileSync('src/components/MatrixView.tsx', 'utf8');
const row = readFileSync('src/components/CompactStudentDisclosureRow.tsx', 'utf8');
const browser = readFileSync('tests/browser/mobile-density-01-tabellone.spec.cjs', 'utf8');

describe('MOBILE-DENSITY-01 / Tabellone mobile', () => {
  test('mobile list uses exactly one compact row per student and protects names', () => {
    expect(matrix).toContain('data-testid="matrix-compact-list"');
    expect(matrix).toContain('<CompactStudentDisclosureRow');
    expect(matrix).toContain('displayName={formatStudentNameWithPrivacy(s.name, isPrivacyShieldActive)}');
    expect(matrix).toContain("primaryLabel=\"Media\"");
    expect(matrix).toContain('primaryValue={formatGrade(mobileAvg)}');
    expect(matrix).toContain('className="hidden md:block overflow-x-auto');
  });

  test('only one expanded student from the current class is visible', () => {
    expect(matrix).toContain('expandedMobileStudent?.classId === currentClass.id');
    expect(matrix).toContain('expandedMobileStudent.studentId === s.id');
    expect(matrix).toContain('current?.classId === currentClass.id && current.studentId === s.id');
    expect(row).toContain('hidden={!expanded}');
    expect(row).toContain('{expanded && (');
  });

  test('row toggle and report navigation are separate accessible actions', () => {
    expect(row).toContain('aria-expanded={expanded}');
    expect(row).toContain('aria-controls={panelId}');
    expect(row).toContain('onClick={onToggle}');
    expect(row).toContain('onClick={onOpenStudentReport}');
    expect(row).toContain('Apri scheda alunno');
    expect(row).toContain('min-h-[60px]');
    expect(row).toContain('min-h-[48px]');
    expect(row).toContain('focus-visible:outline');
  });

  test('preserve all three view modes, filters and unchanged mathematical helpers', () => {
    for(const token of [
      "viewMode === 'cron'", "viewMode === 'type'", "viewMode === 'avg'",
      'const mobileAvg = calcAvg(mobileGrades)',
      'const proposed = computeProposed(mobileGrades)',
      'calcWeightedAvg(sGrades, weights)',
      'setPeriodFilter', 'showProposedGrade',
      'onOpenStudentReport(s.id)',
      'Voti recenti', 'Medie per tipologia', 'Medie periodo',
    ]) expect(matrix).toContain(token);
    expect(matrix).toContain('/* Chronological Full Table */');
    expect(matrix).toContain('/* Grouped by Evaluation Type Table */');
  });

  test('isolated browser must verify mobile/desktop and private data', () => {
    for (const token of ['320', '390', '1280', 'matrix-compact-list', 'matrix-compact-toggle', 'aria-expanded', 'Persona Fittizia', 'mobile-density-01-tabellone.html']) {
      expect(browser).toContain(token);
    }
  });
});
