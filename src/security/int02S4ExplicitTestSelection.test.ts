import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

// S4b causal contract: opening Stampa/Analisi must never implicitly choose
// the first catalog entry (catalogue order is not a teacher decision).
const view = readFileSync('src/components/VerificheOnlineView.tsx', 'utf8');

describe('INT-02/S4b — explicit print and item-analysis test identity', () => {
  test('a newly opened view has no implicit selected test', () => {
    expect(view).toContain("const [selectedTestId, setSelectedTestId] = useState<string>('');");
    expect(view).not.toContain("Object.keys(tests)[0] || 'energia'");
    expect(view).not.toContain('Object.values(tests)[0]');
  });
  test('an explicitly chosen test must remain present and identity-matched', () => {
    expect(view).toContain("Object.prototype.hasOwnProperty.call(tests, selectedTestId)");
    expect(view).toContain("tests[selectedTestId]?.id === selectedTestId");
    expect(view).toContain("setSelectedTestId('');");
  });
  test('print and item-analysis prompt instead of rendering an unchosen test', () => {
    expect(view).toContain('Seleziona una verifica');
    expect(view).toContain('Test da Stampare');
    expect(view).toContain('Analizza Test:');
    expect(view).toContain('value=""');
  });
});
