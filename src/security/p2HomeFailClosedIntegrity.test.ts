import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';

async function source(path: string) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

describe('P2-HOME-01 fail-closed class overview', () => {
  test('global sufficiency stays unavailable when there are no valid student averages', async () => {
    const home = await source('components/HomeView.tsx');

    expect(home).toContain('const instituteSuffRate = allStudentAverages.length > 0');
    expect(home).toContain(': null;');
    expect(home).toContain("instituteSuffRate === null ? '—' : `${instituteSuffRate}%`");
    expect(home).toContain("instituteSuffRate === null ? 'Nessun dato' : 'Sufficienze Totali'");
  });

  test('class comparison does not synthesize zero indicators without valid averages', async () => {
    const home = await source('components/HomeView.tsx');

    expect(home).toContain('const hasClassAverages = cAvgs.length > 0;');
    expect(home).toContain('const cSuff = hasClassAverages');
    expect(home).toContain(': null;');
    expect(home).toContain('const advancedCount = hasClassAverages ? cAvgs.filter(v => v >= 8.5).length : null;');
    expect(home).toContain('const atRiskCount = hasClassAverages ? cAvgs.filter(v => v < 6.0).length : null;');
    expect(home).toContain("{cSuff === null ? '—' : `${cSuff}%`}");
    expect(home).toContain("{advancedCount === null ? '—' : advancedCount}");
    expect(home).toContain("{atRiskCount === null ? '—' : atRiskCount}");
  });

  test('real zero counts remain visible for enrolled students and recorded grades', async () => {
    const home = await source('components/HomeView.tsx');

    expect(home).toContain('{totalStudents}');
    expect(home).toContain('Alunni Iscritti');
    expect(home).toContain('{totalGrades}');
    expect(home).toContain('Valutazioni Registrate');
  });
});
