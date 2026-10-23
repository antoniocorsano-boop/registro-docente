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
});
