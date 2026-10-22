import { describe, expect, test } from 'bun:test';

function sectionBetween(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
}

describe('PERSIST-01 navigation remains independent from in-flight app-data persistence', () => {
  test('Home remains selected when a pending save publishes', async () => {
    const source = await Bun.file('src/App.tsx').text();
    const publishSection = sectionBetween(source, 'publish: candidate => {', 'afterCommit: () => {');

    expect(publishSection).toContain('currentClassIdRef.current === null');
    expect(publishSection).toContain('? null');
  });
});
