import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';

const source = async (path: string) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

describe('UX-TRUST-01 Option B integrity', () => {
  test('UXT-A delegates READY-state vault controls to a compact responsive component without changing shell clearance', async () => {
    const root = await source('components/SecureRegistroRoot.tsx');
    const app = await source('App.tsx');

    expect(app).toContain('pb-36 md:pb-20');
    expect(root).toContain("import { VaultControls } from './VaultControls';");
    expect(root).toContain('<VaultControls');
    expect(root).not.toContain('fixed bottom-16 md:bottom-3 right-3 z-50 flex items-center gap-2');
  });

  test('UXT-A uses separate compact mobile and desktop Vault presentations with touch-safe mobile controls', async () => {
    const controls = await source('components/VaultControls.tsx');

    expect(controls).toContain('md:hidden');
    expect(controls).toContain('hidden md:flex');
    expect(controls).toContain('min-h-11');
    expect(controls).toContain('min-w-11');
    expect(controls).toContain('aria-label="Blocca Registro"');
    expect(controls).not.toContain('fixed bottom-16 md:bottom-3');
  });

  test('UXT-A reuses one mobile touch-target contract on audited high-impact operational controls', async () => {
    const evaluations = await source('components/EvaluationsView.tsx');
    const behaviors = await source('components/BehaviorsView.tsx');
    const history = await source('components/HistoryView.tsx');

    for (const view of [evaluations, behaviors, history]) {
      expect(view).toContain("import { MOBILE_TOUCH_TARGET_CLASS } from './mobileTouch';");
      expect(view).toContain('MOBILE_TOUCH_TARGET_CLASS');
    }

    expect(evaluations).toContain('MOBILE_TOUCH_TARGET_CLASS} px-2 py-0.5');
    expect(evaluations).toContain('MOBILE_TOUCH_TARGET_CLASS} p-1.5');
    expect(behaviors).toContain('MOBILE_TOUCH_TARGET_CLASS} px-2.5 py-1');
    expect(history).toContain('MOBILE_TOUCH_TARGET_CLASS} p-2');
  });

  test('UXT-B uses one encrypted-backup vocabulary on every teacher-facing shortcut', async () => {
    const home = await source('components/HomeView.tsx');
    const navbar = await source('components/Navbar.tsx');
    const settings = await source('components/SettingsView.tsx');
    const app = await source('App.tsx');

    for (const view of [home, navbar, settings]) {
      expect(view).not.toContain('Esporta Backup JSON');
      expect(view).not.toContain('Ultimo backup JSON');
      expect(view).not.toContain('Esporta File Backup (.json)');
      expect(view).not.toContain('Ripristina Registro da File JSON');
      expect(view).not.toContain('Ripristina da JSON');
      expect(view).toContain('backup cifrato');
    }

    expect(app).toContain("const handleExportBackup = () => {\n    setActiveTab('privacy');");
    expect(app).toContain("const handleImportBackup = () => {\n    setActiveTab('privacy');");
  });

  test('UXT-B exposes the sufficiency numerator and valid-average denominator without changing the rate formula', async () => {
    const dashboard = await source('components/DashboardView.tsx');

    expect(dashboard).toContain('const validAverageCount = studentAvgs.length;');
    expect(dashboard).toContain('const sufficientStudentCount = studentAvgs.filter(v => v >= 6.0).length;');
    expect(dashboard).toContain('(sufficientStudentCount / validAverageCount) * 100');
    expect(dashboard).toContain('con media disponibile');
    expect(dashboard).toContain("suffRate === null ? 'Nessun dato' : 'Tasso Sufficienze'");
  });

  test('UXT-C exposes evidence coverage and distinguishes absolute consolidation from relative growth', async () => {
    const semanticsUrl = new URL('../analytics/competencySemantics.ts', import.meta.url);
    let semanticsSource: string | null = null;
    try {
      semanticsSource = await readFile(semanticsUrl, 'utf8');
    } catch {
      semanticsSource = null;
    }

    expect(semanticsSource).not.toBeNull();
    if (semanticsSource === null) return;

    const semantics = await import(semanticsUrl.href);
    const coverage = semantics.getCompetencyEvidenceCoverage(3, 6);
    expect(coverage).toEqual({
      evaluatedCount: 3,
      totalCount: 6,
      label: '3/6 con evidenze',
      reliable: true,
    });

    const strong = semantics.getGrowthRecommendation(
      [
        { label: 'STEM', score: 9.4 },
        { label: 'Digitale', score: 9.1 },
        { label: 'Comunicazione', score: 9.0 },
      ],
      6,
    );
    expect(strong.kind).toBe('relative');
    expect(strong.item).toEqual({ label: 'Comunicazione', score: 9.0 });

    const weak = semantics.getGrowthRecommendation(
      [
        { label: 'STEM', score: 5.4 },
        { label: 'Digitale', score: 7.1 },
        { label: 'Comunicazione', score: 7.4 },
      ],
      6,
    );
    expect(weak.kind).toBe('absolute');
    expect(weak.item).toEqual({ label: 'STEM', score: 5.4 });

    const report = await source('components/StudentReportView.tsx');
    expect(report).toContain('const evaluatedCompetencyData = competencyRadarData.filter(c => c.studentScore !== null);');
    expect(report).toContain('getCompetencyEvidenceCoverage');
    expect(report).toContain('getGrowthRecommendation');
    expect(report).toContain('competencyEvidenceCoverage.label');
    expect(report).toContain('Area di crescita relativa:');
    expect(report).toContain('Area da Consolidare:');
    expect(report).toContain('Dati insufficienti per costruire un profilo attendibile');
  });

  test('UXT-D derives UDA gap severity from the real school calendar and prioritizes evidence planning', async () => {
    const semanticsUrl = new URL('../analytics/udaSemantics.ts', import.meta.url);
    let semanticsSource: string | null = null;
    try {
      semanticsSource = await readFile(semanticsUrl, 'utf8');
    } catch {
      semanticsSource = null;
    }

    expect(semanticsSource).not.toBeNull();
    if (semanticsSource === null) return;

    const semantics = await import(semanticsUrl.href);

    const monthCases = [
      { date: new Date('2026-09-15T12:00:00Z'), expected: 0 },
      { date: new Date('2026-11-15T12:00:00Z'), expected: 2 },
      { date: new Date('2027-02-15T12:00:00Z'), expected: 5 },
      { date: new Date('2027-06-15T12:00:00Z'), expected: 9 },
    ];
    for (const { date, expected } of monthCases) {
      expect(semantics.getSchoolMonthIndex(date)).toBe(expected);
    }

    const severityCases = [
      {
        input: { currentMonthIndex: 1, startMonthIndex: 3, endMonthIndex: 4, gapCount: 2, formalEvidenceCount: 0 },
        expected: 'planning',
      },
      {
        input: { currentMonthIndex: 2, startMonthIndex: 1, endMonthIndex: 4, gapCount: 2, formalEvidenceCount: 0 },
        expected: 'watch',
      },
      {
        input: { currentMonthIndex: 4, startMonthIndex: 1, endMonthIndex: 4, gapCount: 1, formalEvidenceCount: 0 },
        expected: 'due',
      },
      {
        input: { currentMonthIndex: 5, startMonthIndex: 1, endMonthIndex: 4, gapCount: 1, formalEvidenceCount: 0 },
        expected: 'critical',
      },
      {
        input: { currentMonthIndex: 2, startMonthIndex: 1, endMonthIndex: 4, gapCount: 0, formalEvidenceCount: 2 },
        expected: 'clear',
      },
    ];
    for (const { input, expected } of severityCases) {
      expect(semantics.getUdaGapSeverity(input)).toBe(expected);
    }

    expect(semantics.getUdaRemediationCopy('planning').toLowerCase()).toContain('pianifica');
    expect(semantics.getUdaRemediationCopy('watch').toLowerCase()).toContain('evidenz');
    expect(semantics.getUdaRemediationCopy('due').toLowerCase()).not.toContain('voto');

    const uda = await source('components/UdaGanttView.tsx');
    expect(uda).toContain('getSchoolMonthIndex');
    expect(uda).toContain('getUdaGapSeverity');
    expect(uda).toContain('getUdaRemediationCopy');
    expect(uda).not.toContain('const currentSchoolMonthIndex = 1;');
    expect(uda).toContain('const evalBonus = uniqueBatches * 1.0;');
    expect(uda).toContain('totalWeightedHours += evalBonus;');
  });

});