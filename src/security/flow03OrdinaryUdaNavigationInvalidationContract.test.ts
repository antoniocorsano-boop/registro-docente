import { describe, expect, test } from 'bun:test';

async function source(path: string) {
  return Bun.file(path).text();
}

function sectionBetween(text: string, start: string, end: string) {
  const startIndex = text.indexOf(start);
  const endIndex = text.indexOf(end, startIndex + start.length);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return text.slice(startIndex, endIndex);
}

describe('FLOW-03 ordinary UDA navigation invalidation contract', () => {
  test('preserves a recording session only when navigation explicitly requests preservation', async () => {
    const app = await source('src/App.tsx');
    const handler = sectionBetween(app, 'const handleNavigateTab', 'const mutationCoordinatorRef');

    expect(handler).toContain('options.preserveRecordSession');
    expect(handler).not.toContain("recordSessionRef.current.evidenceKind === 'lesson-log'");
    expect(handler).not.toContain("recordSessionRef.current?.evidenceKind === 'lesson-log'");
    expect(handler).toContain('publishRecordSession(null)');
  });
});
