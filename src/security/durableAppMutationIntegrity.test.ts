import { describe, expect, test } from 'bun:test';

const appSource = await Bun.file('src/App.tsx').text();

function sectionBetween(start: string, end: string): string {
  const startIndex = appSource.indexOf(start);
  const endIndex = appSource.indexOf(end, startIndex + start.length);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return appSource.slice(startIndex, endIndex);
}

describe('PERSIST-01 durable App mutation integrity', () => {
  test('routes appData and meta through the durable commit boundary', () => {
    expect(appSource).toContain('createDurableMutationCoordinator');
    expect(appSource).toContain('commitAppDataMutation');
    expect(appSource).toContain('saveAppDataAndMeta');
    expect(appSource).not.toContain('Promise.all([\n      secureStorage.saveAppData');
    expect(appSource).not.toContain('persistAppData(');
    expect(appSource).toContain('Salvataggio non riuscito. La modifica non è stata applicata.');
  });

  test('evaluation and behavior navigation is post-commit', () => {
    const evaluations = sectionBetween('// Save evaluations batch', '// Save behavior notes');
    expect(evaluations).toContain('commitAppDataMutation');
    expect(evaluations).toContain('afterCommit');
    expect(evaluations.indexOf("setActiveTab('storico')")).toBeGreaterThan(evaluations.indexOf('afterCommit'));

    const behaviors = sectionBetween('// Save behavior notes', '// Edit batch');
    expect(behaviors).toContain('commitAppDataMutation');
    expect(behaviors).toContain('afterCommit');
    expect(behaviors.indexOf("setActiveTab('dashboard')")).toBeGreaterThan(behaviors.indexOf('afterCommit'));
  });

  test('submission import success is emitted only after durable commit', () => {
    const importSection = sectionBetween('// Import submissions into class grades', '// Save UDAs');
    expect(importSection).toContain('commitAppDataMutation');
    expect(importSection).toContain('afterCommit');
    expect(importSection.indexOf('Importazione completata con successo!')).toBeGreaterThan(importSection.indexOf('afterCommit'));
  });
});
