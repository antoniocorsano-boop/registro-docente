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
    expect(appSource).toContain('commitMetaMutation');
    expect(appSource).toContain('saveAppDataAndMeta');
    expect(appSource).not.toContain('Promise.all([\n      secureStorage.saveAppData');
    expect(appSource).not.toContain('persistAppData(');
    expect(appSource).not.toContain('void secureStorage.saveMeta(nextMeta)');
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

  test('submission import reads the latest committed submissions when queued work begins', () => {
    const importSection = sectionBetween('// Import submissions into class grades', '// Save UDAs');
    const deriveStart = importSection.indexOf('void commitAppDataMutation(current => {');
    const afterCommitStart = importSection.indexOf('afterCommit:', deriveStart);
    const preDeriveSection = importSection.slice(0, deriveStart);
    const deriveSection = importSection.slice(deriveStart, afterCommitStart);

    expect(deriveStart).toBeGreaterThanOrEqual(0);
    expect(afterCommitStart).toBeGreaterThan(deriveStart);
    expect(preDeriveSection).not.toContain('const submissionSnapshot = submissionsRef.current;');
    expect(deriveSection).toContain('const submissionSnapshot = submissionsRef.current;');
  });

  test('keeps committed refs for settings, UDA, tests and submissions', () => {
    expect(appSource).toContain('settingsRef');
    expect(appSource).toContain('udasRef');
    expect(appSource).toContain('testsRef');
    expect(appSource).toContain('submissionsRef');
    expect(appSource).toContain('commitSettingsMutation');
    expect(appSource).toContain('commitUdasMutation');
    expect(appSource).toContain('commitTestsMutation');
    expect(appSource).toContain('commitSubmissionsMutation');
  });

  test('custom tests and submissions no longer publish before persistence', () => {
    const testSection = sectionBetween('// Save new test', '// Delete submission');
    expect(testSection).toContain('commitTestsMutation');
    expect(testSection).not.toContain('setTests(updatedTests)');
    expect(testSection).not.toContain('secureStorage.saveCustomTests(updatedTests)');

    const deleteSection = sectionBetween('// Delete submission', '// Import submissions into class grades');
    expect(deleteSection).toContain('commitSubmissionsMutation');
    expect(deleteSection).not.toContain('setSubmissions(updated)');
    expect(deleteSection).not.toContain('setSubmissions(previous)');
    expect(deleteSection).not.toContain('secureStorage.saveSubmissions(updated)');
  });

  test('UDA and settings publish only through durable domain helpers', () => {
    const udaSection = sectionBetween('// Save UDAs', '// Save Settings');
    expect(udaSection).toContain('commitUdasMutation');
    expect(udaSection).not.toContain('setUdas(newUdas)');
    expect(udaSection).not.toContain('secureStorage.saveUdas(newUdas)');

    const settingsSection = sectionBetween('// Save Settings', '// Backup actions are routed');
    expect(settingsSection).toContain('commitSettingsMutation');
    expect(settingsSection).not.toContain('setSettings(newSettings)');
    expect(settingsSection).not.toContain('secureStorage.saveSettings(newSettings)');
  });
});
