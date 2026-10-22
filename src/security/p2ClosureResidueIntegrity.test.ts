import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';

const source = async (path: string) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

describe('P2 closure residue remediation', () => {
  test('student report uses the canonical UDA label', async () => {
    const report = await source('components/StudentReportView.tsx');

    expect(report).toContain('Vai alla sezione "UDA" per pianificare le unità curricolari.');
    expect(report).not.toContain('UDA & Gantt');
  });

  test('primary UDA workflow hides provider and embedding implementation vocabulary', async () => {
    const uda = await source('components/UdaGanttView.tsx');

    for (const technicalLabel of [
      'llama.cpp Termux',
      'Gemini Cloud',
      'ricerca concettuale vettoriale basata su embedding',
      'Vettori...',
      'modello di embedding locale',
      'Analisi vettori...',
      'Suggerisci Propedeuticità con Embedding',
      'UDA Correlate Suggerite tramite Embedding',
      "embeddingConfig.modelName || 'Termux/llama-server'",
    ]) {
      expect(uda).not.toContain(technicalLabel);
    }

    expect(uda).toContain('Ricerca semantica attiva');
    expect(uda).toContain('Attiva la ricerca concettuale');
    expect(uda).toContain('Suggerisci propedeuticità');
    expect(uda).toContain('UDA correlate suggerite');
  });
});
