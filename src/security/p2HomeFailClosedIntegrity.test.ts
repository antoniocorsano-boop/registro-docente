import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';

async function source(path: string) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

describe('P2-HOME-01 fail-closed class overview', () => {
  test('global sufficiency stays unavailable when there are no valid student averages', async () => {
    const home = await source('components/HomeView.tsx');

    expect(home).toContain('const instituteSufficiency = allAverages.length > 0');
    expect(home).toContain(': null;');
    expect(home).toContain("instituteSufficiency === null ? '—' : `${instituteSufficiency}%`");
    expect(home).toContain("instituteSufficiency === null ? 'Nessun dato' : 'Sufficienze Totali'");
  });

  test('class comparison does not synthesize zero indicators without valid averages', async () => {
    const home = await source('components/HomeView.tsx');

    expect(home).toContain('const sufficiency = averages.length > 0');
    expect(home).toContain(': null;');
    expect(home).toContain('advancedCount: averages.length > 0 ? averages.filter(value => value >= 8.5).length : null');
    expect(home).toContain('atRiskCount: averages.length > 0 ? averages.filter(value => value < 6).length : null');
    expect(home).toContain("{item.sufficiency === null ? '—' : `${item.sufficiency}%`}");
    expect(home).toContain("{item.advancedCount === null ? '—' : item.advancedCount}");
    expect(home).toContain("{item.atRiskCount === null ? '—' : item.atRiskCount}");
  });

  test('real zero counts remain visible for enrolled students and recorded grades', async () => {
    const home = await source('components/HomeView.tsx');

    expect(home).toContain('{totalStudents}');
    expect(home).toContain('Alunni Iscritti');
    expect(home).toContain('{totalGrades}');
    expect(home).toContain('Valutazioni Registrate');
  });
});
