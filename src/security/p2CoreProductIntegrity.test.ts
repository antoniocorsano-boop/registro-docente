import { describe, expect, test } from 'bun:test';

async function source(path: string): Promise<string> {
  return Bun.file(path).text();
}

describe('P2-CORE-01 daily workflow safety and trust', () => {
  test('mobile vault controls stay above the bottom navigation hit area', async () => {
    const controls = await source('src/components/VaultControls.tsx');
    const navbar = await source('src/components/Navbar.tsx');

    expect(navbar).toContain('md:hidden fixed bottom-0');
    expect(controls).toContain('fixed bottom-16 md:bottom-3 right-3 z-50');
    expect(controls).not.toContain('fixed bottom-3 right-3 z-50');
  });

  test('dashboard sufficiency is fail-closed when no valid averages exist', async () => {
    const dashboard = await source('src/components/DashboardView.tsx');

    const suffRateBlock = dashboard.slice(
      dashboard.indexOf('const suffRate'),
      dashboard.indexOf('// Group assessments')
    );

    expect(suffRateBlock).toContain(': null;');
    expect(suffRateBlock).not.toContain(': 0;');
    expect(dashboard).toContain("{suffRate === null ? '—' : `${suffRate}%`}");
    expect(dashboard).toContain("suffRate === null ? 'Nessun dato' : 'Tasso Sufficienze'");
  });

  test('teacher-visible UDA gantt uses activity-index terminology instead of credits', async () => {
    const uda = await source('src/components/UdaGanttView.tsx');

    expect(uda).not.toContain('>Crediti</th>');
    expect(uda).toContain('>Indice attività</th>');
    expect(uda).not.toContain('Crediti Formativi');
    expect(uda).not.toContain('CFS');
  });
});
