import { describe, expect, test } from 'bun:test';
import { DEFAULT_EVALUATION_WEIGHTS, DEFAULT_SETTINGS } from '../utils';

async function source(path: string): Promise<string> {
  return Bun.file(path).text();
}

describe('VAL-02 bounded valuation semantics', () => {
  test('default evaluation math is neutral until the teacher explicitly configures weighting', () => {
    expect(DEFAULT_EVALUATION_WEIGHTS).toEqual({
      verifica: 100,
      orale: 100,
      disegno: 100,
      test: 100,
      osserv: 100
    });
    expect(DEFAULT_SETTINGS.useWeightedAverage).toBe(false);
  });

  test('settings present weighting as a configurable professional criterion, never a ministerial preset', async () => {
    const settings = await source('src/components/SettingsView.tsx');

    expect(settings).not.toContain('Standard D.M. 221');
    expect(settings).not.toContain('Pesi Valutazioni per Media Ponderata (D.M. 221/2025)');
    expect(settings).not.toContain("attribuzione dei livelli D.M. 221/2025");
    expect(settings).toContain('Ponderazione configurabile');
    expect(settings).toContain('Preset docente');
  });

  test('analytics distinguish mathematical indicators from ministerial levels and scrutiny decisions', async () => {
    const analytics = await source('src/components/AnalyticsView.tsx');
    const comparisonChart = await source('src/components/ClassComparisonBarChart.tsx');

    expect(analytics).not.toContain('D.M. 221');
    expect(comparisonChart).not.toContain('D.M. 221');
    expect(analytics).not.toContain('conforme alle linee guida ministeriali');
    expect(analytics).not.toContain('livelli ministeriali');
    expect(analytics).not.toContain('A Rischio (PA)');
    expect(analytics).not.toContain("'Regolare'");
    expect(analytics).toContain('Fasce analitiche');
    expect(analytics).toContain('Media < 6');
    expect(analytics).toContain('Media ≥ 6');
    expect(analytics).toContain('Prospetto di lavoro docente');
    expect(analytics).not.toContain('Firma del Dirigente Scolastico');
    expect(analytics).not.toContain('Firma del Docente Coordinatore');
  });

  test('student report is an internal evidence profile, not an automatic competence certification', async () => {
    const report = await source('src/components/StudentReportView.tsx');

    expect(report).not.toContain('D.M. 221');
    expect(report).not.toContain('Certificazione curricolare');
    expect(report).not.toContain('Soglia Base Ministeriale');
    expect(report).not.toContain('Prima Acquisizione');
    expect(report).toContain('Profilo interno di evidenze');
    expect(report).toContain('Fascia analitica');
    expect(report).toContain('Soglia analitica 6/10');
  });

  test('class matrix exposes a mathematical indicator instead of an automatically proposed scrutiny grade', async () => {
    const matrix = await source('src/components/MatrixView.tsx');

    expect(matrix).not.toContain('D.M. 221');
    expect(matrix).not.toContain('Voto Proposto');
    expect(matrix).not.toContain('VOTO PROP.');
    expect(matrix).not.toContain('rounded: Math.round(avg)');
    expect(matrix).not.toContain("'Insufficienza'");
    expect(matrix).not.toContain("'Idoneo'");
    expect(matrix).not.toContain("'A Rischio'");
    expect(matrix).toContain('Indicatore media');
    expect(matrix).toContain('Media < 6');
    expect(matrix).toContain('Media ≥ 6');
  });

  test('UDA weighting remains an internal planning index while D.M. 221 stays only as curricular context', async () => {
    const uda = await source('src/components/UdaGanttView.tsx');

    expect(uda).toContain('D.M. 221/2025');
    expect(uda).not.toContain('Crediti Formativi');
    expect(uda).not.toContain('CFS');
    expect(uda).not.toContain('Ore di Competenza Ponderate Certificate');
    expect(uda).toContain('Indice Attività UDA');
    expect(uda).toContain('indice interno');
  });

  test('navigation and public metadata do not market automatic analytics as D.M. 221 levels', async () => {
    const navbar = await source('src/components/Navbar.tsx');
    const index = await source('index.html');
    const metadata = await source('metadata.json');

    expect(navbar).not.toContain('Analytics D.M. 221');
    expect(navbar).not.toContain('Analisi & Soglie (D.M. 221)');
    expect(index).not.toContain('livelli di competenza D.M. 221/2025');
    expect(metadata).not.toContain('livelli di competenza D.M. 221/2025');
  });

  test('teacher working-sheet export uses the currently selected analytical mode consistently', async () => {
    const analytics = await source('src/components/AnalyticsView.tsx');

    expect(analytics).toContain('const exportQ1 = useWeighted ? m.q1WeightedAvg : m.q1SimpleAvg;');
    expect(analytics).toContain('const exportQ2 = useWeighted ? m.q2WeightedAvg : m.q2SimpleAvg;');
    expect(analytics).toContain('const exportTotal = useWeighted ? m.totalWeightedAvg : m.totalSimpleAvg;');
    expect(analytics).toContain("exportTotal === null ? 'Non disponibile' : exportTotal >= 6 ? 'Media ≥ 6' : 'Media < 6'");
    expect(analytics).not.toContain("m.totalWeightedAvg === null ? 'Non disponibile' : m.totalWeightedAvg >= 6");
  });

  test('cross-class summary and item analysis keep analytical labels distinct from ministerial status', async () => {
    const home = await source('src/components/HomeView.tsx');
    const online = await source('src/components/VerificheOnlineView.tsx');

    expect(home).not.toContain('Avanzato (AV)');
    expect(home).not.toContain('A Rischio (PA)');
    expect(home).toContain('Fascia alta (≥ 8,5)');
    expect(home).toContain('Media &lt; 6');
    expect(online).not.toContain('Item Analysis Formativa per Domanda (D.M. 221/2025)');
    expect(online).toContain('Item Analysis Formativa per Domanda');
  });

});
