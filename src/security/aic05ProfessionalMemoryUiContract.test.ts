import { describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dir, '..');

async function readSource(relativePath: string): Promise<string> {
  const path = resolve(ROOT, relativePath);
  return existsSync(path) ? Bun.file(path).text() : '';
}

describe('AIC-05 Task 6 progressive professional memory controls', () => {
  test('keeps professional memory secondary and closed by default inside the single Copilot surface', async () => {
    const [composer, panel] = await Promise.all([
      readSource('components/LibraryCopilotComposer.tsx'),
      readSource('components/ProfessionalMemoryPanel.tsx')
    ]);

    expect(panel).not.toBe('');
    expect(composer).toContain("import { ProfessionalMemoryPanel } from './ProfessionalMemoryPanel';");
    expect(composer).toContain('<ProfessionalMemoryPanel');
    expect(panel).toContain('<details');
    expect(panel).toContain('data-testid="copilot-memory-trigger"');
    expect(panel).toContain('data-testid="copilot-memory-panel"');
    expect(panel).not.toMatch(/<details[^>]*\sopen(?:=|\s|>)/);

    const primarySubmit = composer.indexOf('type="submit"');
    const memoryPanel = composer.indexOf('<ProfessionalMemoryPanel');
    expect(primarySubmit).toBeGreaterThanOrEqual(0);
    expect(memoryPanel).toBeGreaterThan(primarySubmit);
  });

  test('exposes Ricorda questo only for an eligible professional candidate and requires explicit confirmation', async () => {
    const [composer, panel] = await Promise.all([
      readSource('components/LibraryCopilotComposer.tsx'),
      readSource('components/ProfessionalMemoryPanel.tsx')
    ]);

    expect(composer).toContain("selectedSource?.privacy === 'teacher-professional'");
    expect(composer).toContain("privacyClassification: 'TEACHER_PROFESSIONAL'");
    expect(composer).toContain('rememberCandidate={rememberCandidate}');
    expect(panel).toContain('rememberCandidate &&');
    expect(panel).toContain('data-testid="copilot-memory-remember-this"');
    expect(panel).toContain('data-testid="copilot-memory-confirm"');
    expect(panel).toContain('Conferma');
    expect(panel).toContain('onRemember');
  });

  test('keeps inspect edit and remove operations explicit and memory-only', async () => {
    const [app, composer, panel] = await Promise.all([
      readSource('App.tsx'),
      readSource('components/LibraryCopilotComposer.tsx'),
      readSource('components/ProfessionalMemoryPanel.tsx')
    ]);

    expect(panel).toContain('data-testid={`copilot-memory-entry-${entry.id}`}');
    expect(panel).toContain('onCorrectEntry');
    expect(panel).toContain('onRemoveEntry');
    expect(panel).toContain('Modifica');
    expect(panel).toContain('Rimuovi');
    expect(app).toContain('correctProfessionalMemoryEntry');
    expect(app).toContain('removeProfessionalMemoryEntry');
    expect(composer).toContain('onCorrectMemoryEntry=');
    expect(composer).toContain('onRemoveMemoryEntry=');
  });

  test('separates category enablement from confirmed bulk deletion', async () => {
    const [app, panel] = await Promise.all([
      readSource('App.tsx'),
      readSource('components/ProfessionalMemoryPanel.tsx')
    ]);

    expect(panel).toContain('data-testid={`copilot-memory-category-${category}`}');
    expect(panel).toContain('onSetCategory');
    expect(panel).toContain('onRemoveCategory');
    expect(panel).toContain('window.confirm');
    expect(app).toContain('setAutoRememberCategory');
    expect(app).toContain('removeProfessionalMemoryCategory');
  });

  test('persists manual memory mutations truthfully and shows only the bounded relevant working set', async () => {
    const [app, composer, panel] = await Promise.all([
      readSource('App.tsx'),
      readSource('components/LibraryCopilotComposer.tsx'),
      readSource('components/ProfessionalMemoryPanel.tsx')
    ]);

    expect(app).toContain('commitProfessionalMemoryMutation');
    expect(app).toContain('secureStorage.saveProfessionalMemoryAndMeta');
    expect(app).toContain('rememberProfessionalItem');
    expect(composer).toContain('relevantMemory={professionalMemoryWorkingSet}');
    expect(panel).toContain('data-testid="copilot-memory-relevant"');
    expect(panel).toContain('relevantMemory.items');
  });
});
