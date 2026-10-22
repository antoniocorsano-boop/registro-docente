import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';

const source = async (path: string) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

describe('P2 closure residue remediation', () => {
  test('student report uses the canonical UDA label', async () => {
    const report = await source('components/StudentReportView.tsx');

    expect(report).toContain('Vai alla sezione "UDA" per pianificare le unità curricolari.');
    expect(report).not.toContain('UDA & Gantt');
  });

  test('primary UDA workflow hides provider, model and embedding implementation vocabulary', async () => {
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
      'Verifica llama-server su Termux',
      'tramite embedding locale',
      'Controlla llama-server',
      'modello vettoriale',
      'Gemini API in corso',
      'con Gemini AI',
      'API Gemini',
      'traccia completa con Gemini',
      "usando l'embedding locale",
      'Analisi vettoriale...',
    ]) {
      expect(uda).not.toContain(technicalLabel);
    }

    expect(uda).toContain('Ricerca semantica attiva');
    expect(uda).toContain('Attiva la ricerca concettuale');
    expect(uda).toContain('Suggerisci propedeuticità');
    expect(uda).toContain('UDA correlate suggerite');
    expect(uda).toContain('Generazione traccia UDA con assistenza AI in corso');
    expect(uda).toContain('Genera traccia testuale completa dell\'UDA con assistenza AI');
    expect(uda).toContain('Analisi semantica...');
  });

  test('AI generation failure guidance distinguishes server configuration from retryable errors', async () => {
    const uda = await source('components/UdaGanttView.tsx');
    const start = uda.indexOf('const handleGenerateUdaDescription');
    const end = uda.indexOf('// Synchronize master class filter', start);
    const generation = uda.slice(start, end);

    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    expect(generation).toContain('serverConfigurationMissing');
    expect(generation).toContain("Servizio AI non configurato sul server. Contatta l'amministratore.");
    expect(generation).toContain('Generazione non riuscita. Riprova.');
    expect(generation).not.toContain('Generazione non riuscita. Riprova o verifica le impostazioni avanzate.');
  });
});
