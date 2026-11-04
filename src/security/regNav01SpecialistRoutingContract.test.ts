import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const source = readFileSync('src/App.tsx', 'utf8');
const browser = readFileSync('tests/browser/reg-nav-01-specialist-return.spec.cjs', 'utf8');
const workflow = readFileSync('.github/workflows/browser-qualification.yml', 'utf8');

function between(first: string, after: string): string {
  const start = source.indexOf(first);
  expect(start, 'missing ' + first).toBeGreaterThanOrEqual(0);
  const end = source.indexOf(after, start + first.length);
  expect(end, 'missing boundary ' + after).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe('REG-NAV-01 / NAV-S1 — one authority for specialist entry', () => {
  test('Storico uses the history-aware transition for new or edited evaluations', () => {
    expect(between('const handleEditBatch', '// Delete batch'))
      .toContain("handleNavigateTab('voti')");
    expect(between('onNewEvaluation={() => {', '{/* TAB 8:'))
      .toContain("handleNavigateTab('voti')");
  });

  test('both Analisi and Tabellone open a student report through the same navigation path', () => {
    const callbacks = Array.from(source.matchAll(
      /onOpenStudentReport=\{\(studentId\) => \{([\s\S]*?)\}\}/g
    ));
    expect(callbacks).toHaveLength(2);
    for (const callback of callbacks) {
      expect(callback[1]).toContain("handleNavigateTab('report')");
      expect(callback[1]).toContain('setSelectedStudentForReport(studentId)');
      expect(callback[1]).not.toContain("setActiveTab('report')");
    }
  });

  test('Chromium tests browser Back and URL/history agreement on synthetic classes', () => {
    expect(browser).toContain("expectNavigation(page, 'voti')");
    expect(browser).toContain("expectNavigation(page, 'report')");
    expect(browser).toContain('page.goBack(');
    expect(browser).toContain("isMobile: true");
    expect(workflow).toContain('Run REG-NAV-01 specialist return Chromium qualification');
  });
});
