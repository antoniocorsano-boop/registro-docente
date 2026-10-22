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

  test('navigation changes synchronously advance a navigation version', async () => {
    const source = await Bun.file('src/App.tsx').text();
    const navigationState = sectionBetween(source, '// 6. Navigation and UI state', '// Metadata for backup tracking');

    expect(navigationState).toContain('navigationVersionRef');
    expect(navigationState).toContain('setActiveTabState');
    expect(navigationState).toContain('navigationVersionRef.current += 1');
    expect(navigationState).toContain('setActiveTabState(tab)');
  });

  test('post-commit redirects run only when no newer navigation occurred', async () => {
    const source = await Bun.file('src/App.tsx').text();

    const addClass = sectionBetween(source, '// Add new class', '// Delete class');
    expect(addClass).toContain('const navigationVersionAtSave = navigationVersionRef.current;');
    expect(addClass).toContain('if (navigationVersionRef.current === navigationVersionAtSave)');

    const evaluations = sectionBetween(source, '// Save evaluations batch', '// Save behavior notes');
    expect(evaluations).toContain('const navigationVersionAtSave = navigationVersionRef.current;');
    expect(evaluations).toContain('if (navigationVersionRef.current === navigationVersionAtSave)');
    expect(evaluations).toContain("setActiveTab('storico')");

    const behaviors = sectionBetween(source, '// Save behavior notes', '// Edit batch');
    expect(behaviors).toContain('const navigationVersionAtSave = navigationVersionRef.current;');
    expect(behaviors).toContain('if (navigationVersionRef.current === navigationVersionAtSave)');
    expect(behaviors).toContain("setActiveTab('dashboard')");
  });
});
