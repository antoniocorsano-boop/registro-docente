import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';

const source = async (path: string) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const disclosureContaining = (text: string, marker: string) => {
  const markerIndex = text.indexOf(marker);
  expect(markerIndex).toBeGreaterThanOrEqual(0);

  const startIndex = text.lastIndexOf('<details', markerIndex);
  const endIndex = text.indexOf('</details>', markerIndex);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(markerIndex);

  return text.slice(startIndex, endIndex + '</details>'.length);
};

describe('P2-ADVANCED-01 teacher-first settings separation', () => {
  test('technical provider configuration is behind one closed advanced disclosure', async () => {
    const settings = await source('components/SettingsView.tsx');
    const advanced = disclosureContaining(settings, 'Impostazioni avanzate e integrazioni');
    const openingTag = advanced.slice(0, advanced.indexOf('>') + 1);

    expect(advanced).toContain('Impostazioni avanzate e integrazioni');
    expect(openingTag).not.toMatch(/\bopen\b/);

    for (const technicalLabel of [
      'Termux',
      'llama.cpp',
      'URL Endpoint Vettoriale',
      'Nome Modello GGUF / Identificativo',
      'API Key',
    ]) {
      expect(advanced).toContain(technicalLabel);
    }

    expect(advanced).toContain('handleTestEmbedding');
    expect(advanced).toContain('handleRunPlayground');
    expect(advanced).toContain('embeddingConfig');
  });

  test('primary teacher-facing settings do not expose technical provider vocabulary', async () => {
    const settings = await source('components/SettingsView.tsx');
    const advanced = disclosureContaining(settings, 'Impostazioni avanzate e integrazioni');
    const primary = settings.replace(advanced, '');

    expect(primary).toContain("Aspetto dell'interfaccia");
    expect(primary).not.toContain('Theme Engine');

    for (const technicalLabel of [
      'Termux',
      'llama.cpp',
      'URL Endpoint Vettoriale',
      'Nome Modello GGUF / Identificativo',
      'API Key',
    ]) {
      expect(primary).not.toContain(technicalLabel);
    }
  });
});
