import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { getPreparationOptions } from '../preparation/preparationRouter';
import { routeForRecordEvidence } from '../recording/recordSession';
import { getRecordReviewOptions } from '../recording/reviewRouting';

// S4c verifies the path between existing canonical routes. No new
// assessment/grade mutation or new persistence key is introduced.
const browser = readFileSync('tests/browser/int-02-s4-teacher-cycle.spec.cjs', 'utf8');

describe('INT-02/S4c — teacher assessment cycle across authority boundaries', () => {
  test('Prepara and Registra use the same existing Verifiche destination', () => {
    expect(getPreparationOptions().find(item => item.id === 'assessment')?.destination)
      .toEqual({ kind: 'tab', tab: 'verifiche-online' });
    expect(routeForRecordEvidence('online-outcomes'))
      .toEqual({ kind: 'tab', tab: 'verifiche-online' });
  });

  test('Rivedi retains explicit history and class-scoped review options', () => {
    expect(getRecordReviewOptions('online-outcomes').map(option => option.tab))
      .toEqual(['tabellone', 'storico', 'analytics', 'report']);
    expect(browser).toContain("name: 'Rivedi la classe ' + CLASS_NAME");
    expect(browser).toContain("name: 'Sessione Rivedi per la classe ' + CLASS_NAME");
  });

  test('the Chromium bridge proves the two distinct teacher decisions and denies implicit import', () => {
    expect(browser).toContain("name: 'Prepara', exact: true");
    expect(browser).toContain("name: 'Registra', exact: true");
    expect(browser).toContain("name: 'Esiti verifica online', exact: true");
    expect(browser).toContain("name: 'Copia Link per Studenti'");
    expect(browser).toContain('await expect(importButton).toBeDisabled()');
    expect(browser).toContain("selectOption('none')");
    expect(browser).toContain('await dialog.dismiss()');
    expect(browser).toContain('await importButton.click()');
    expect(browser).toContain('Registrazione completata');
    expect(browser).toContain('Nessuna nuova valutazione importabile');
    expect(browser).toContain('synthetic: true');
    expect(browser).toContain("provider: 'not-called'");
    expect(browser).not.toContain('GEMINI_API_KEY');
  });
});
