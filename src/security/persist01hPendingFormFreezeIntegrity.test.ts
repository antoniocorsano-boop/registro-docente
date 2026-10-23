import { describe, expect, test } from 'bun:test';

const source = async (path: string) => Bun.file(path).text();

function sectionBetween(text: string, start: string, end: string): string {
  const startIndex = text.indexOf(start);
  const endIndex = text.indexOf(end, startIndex + start.length);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return text.slice(startIndex, endIndex);
}

describe('PERSIST-01H pending form freeze integrity', () => {
  test('interactive test editor freezes all mutable controls while durable save is pending', async () => {
    const text = await source('src/components/VerificheOnlineView.tsx');
    const editor = sectionBetween(text, '<form onSubmit={handleSaveInteractiveTest}', '</form>');

    expect(editor).toContain('<fieldset disabled={isSavingTest}');
  });

  test('evaluation form freezes all mutable controls while durable save is pending', async () => {
    const text = await source('src/components/EvaluationsView.tsx');
    const form = sectionBetween(text, '<form onSubmit={handleSubmit}', '</form>');

    expect(form).toContain('<fieldset disabled={isSaving}');
  });

  test('behavior status controls freeze while durable save is pending', async () => {
    const text = await source('src/components/BehaviorsView.tsx');
    const statusControls = sectionBetween(text, '<fieldset disabled={isSaving}', '<button\n        onClick={handleSave}');

    expect(statusControls).toContain('{/* Bulk action buttons */}');
    expect(statusControls).toContain('BEHAVIOR_OPTIONS.map');
  });

  test('manual test form freezes title UDA and raw text while durable save is pending', async () => {
    const text = await source('src/components/VerificheOnlineView.tsx');
    const manualForm = sectionBetween(text, '<form onSubmit={handleSaveManualTest}', '</form>');

    expect(manualForm).toContain('<fieldset disabled={isSavingTest}');
  });

  test('test-editor sub-navigation cannot close the retry draft while a save is pending', async () => {
    const text = await source('src/components/VerificheOnlineView.tsx');
    const navigation = sectionBetween(text, '{/* Tab pills */}', '{/* SUB-TAB 1: BACHECA & CONDIVISIONE PADLET */}');
    const frozenTabCount = navigation.match(/disabled=\{isSavingTest\}/g)?.length ?? 0;

    expect(frozenTabCount).toBeGreaterThanOrEqual(4);
  });
});