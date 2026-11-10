import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const view = readFileSync('src/components/VerificheOnlineView.tsx', 'utf8');
const css = readFileSync('src/styles/lsm01cBMobilePrimaryActionDock.css', 'utf8');
const printCss = readFileSync('src/index.css', 'utf8');
const browser = readFileSync('tests/browser/int-02-s1-library-assessment.spec.cjs', 'utf8');

describe('UX-PRINT-01 — readable mobile Verifiche and neutral printable sheet', () => {
  test('mobile launcher yields only while print/analysis are active', () => {
    expect(view).toContain("{activeSubTab === 'stampa' && (\n        <div data-testid=\"assessment-read-panel\"");
    expect(view).toContain("{activeSubTab === 'analisi' && (\n        <div data-testid=\"assessment-read-panel\"");
    expect(css).toContain('body:has([data-testid="assessment-read-panel"]) [data-testid="library-copilot-trigger"]');
    expect(css).toContain('display: none;');
    expect(browser).toContain("await expect(page.getByTestId('library-copilot-trigger')).toBeHidden();");
    expect(browser).toContain("await expect(page.getByTestId('library-copilot-trigger')).toBeVisible();");
  });

  test('print has teacher-defined title, neutral subtitle and no promotional/legal overclaim', () => {
    expect(view).toContain('{currentSelectedTest.title}');
    expect(view).toContain('<span>Scheda di verifica</span>');
    expect(view).not.toContain('Verifica Formativa delle Competenze (D.M. 221/2025)');
    expect(view).not.toContain('Generato con Registro Docente & Flashcards Pro Neon');
    expect(view).not.toContain('Barrare una sola risposta per ogni quesito.');
    expect(view).toContain('Indicazioni: segui le istruzioni del docente per ciascun quesito.');
    // Narrow screen preview: instructions keep full available width and signature moves below.
    expect(view).toContain('data-testid="assessment-print-footer"');
    expect(view).toContain('data-testid="assessment-print-instructions"');
    expect(view).toContain('data-testid="assessment-print-signature"');
    expect(view).toContain('flex flex-col gap-5');
    expect(view).toContain('sm:flex-row');
    expect(view).toContain('print:flex-row');
    expect(browser).toContain('expectFooterLayout(page, true)');
    expect(browser).toContain("ux-print-01-stampa-beta-a4.pdf");
    // On paper only the selected assessment is visible against a white background.
    expect(view).toContain('data-testid="assessment-print-sheet"');
    expect(printCss).toContain('UX-PRINT-01: isolate only the explicitly selected assessment on paper');
    expect(printCss).toContain('body:has([data-testid="assessment-print-sheet"]) #root *');
    expect(printCss).toContain('visibility: hidden !important;');
    expect(printCss).toContain('visibility: visible !important;');
    expect(printCss).toContain('background: #ffffff !important;');
    expect(printCss).toContain('color-scheme: light !important;');
    expect(browser).toContain("await expect(page.locator('html')).toHaveCSS('color-scheme', 'light');");
    expect(browser).toContain("Verifiche sulle Lezioni & Flashcards Formative");
    expect(browser).toContain("await expect(page.getByTestId('assessment-print-sheet')).toBeVisible();");
  });

  test('existing explicit selection and fail-closed print gate remain unchanged', () => {
    expect(view).toContain("const [selectedTestId, setSelectedTestId] = useState<string>('');");
    expect(view).toContain('disabled={!currentSelectedTest}');
    expect(view).toContain('if (!currentSelectedTest) return;');
  });
});
