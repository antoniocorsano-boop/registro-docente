import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const view = readFileSync('src/components/VerificheOnlineView.tsx', 'utf8');

describe('INT-02/S4b — scelta esplicita per stampa e analisi', () => {
  test('non assume la prima verifica del catalogo quando manca una scelta', () => {
    expect(view).toContain("const [selectedTestId, setSelectedTestId] = useState<string>('');");
    expect(view).not.toContain("Object.keys(tests)[0] || 'energia'");
    expect(view).not.toContain("Object.values(tests)[0]");
    expect(view).toContain('const currentSelectedTest = selectedTestId');
  });

  test('Stampa e Analisi spiegano la scelta mancante anziché mostrare un test casuale', () => {
    expect(view).toContain('Seleziona una verifica da stampare');
    expect(view).toContain('Seleziona una verifica da analizzare');
    expect(view).toContain('aria-label="Test da stampare"');
    expect(view).toContain('aria-label="Test da analizzare"');
  });

  test('salvataggio e azione esplicita sul catalogo possono selezionare una verifica', () => {
    expect(view).toContain('setSelectedTestId(savedTest.id);');
    expect(view).toContain('setSelectedTestId(t.id);');
    expect(view).toContain("setSelectedTestId('');");
  });

  test('condivisione e importazione restano indipendenti dalla selezione di stampa', () => {
    expect(view).toContain('resolveAssessmentShareTarget({');
    expect(view).toContain('testId: shareSelectedTestId');
    expect(view).toContain('classId: importClassId, testId: importTestId');
    expect(view).toContain('targetUdaId:');
  });
});
