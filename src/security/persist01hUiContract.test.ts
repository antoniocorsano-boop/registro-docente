import { describe, expect, test } from 'bun:test';

const appSource = await Bun.file('src/App.tsx').text();

function sectionBetween(start: string, end: string): string {
  const startIndex = appSource.indexOf(start);
  const endIndex = appSource.indexOf(end, startIndex + start.length);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return appSource.slice(startIndex, endIndex);
}

describe('PERSIST-01H App mutation boundary contract', () => {
  test('settings UDA tests and submissions commit domain plus backup meta atomically', () => {
    expect(appSource).toContain("import { incrementBackupChanges");

    const settings = sectionBetween('const commitSettingsMutation', 'const commitUdasMutation');
    expect(settings).toContain('metaRef.current');
    expect(settings).toContain('incrementBackupChanges');
    expect(settings).toContain('secureStorage.saveSettingsAndMeta');
    expect(settings).toContain('setMeta');

    const udas = sectionBetween('const commitUdasMutation', 'const commitTestsMutation');
    expect(udas).toContain('metaRef.current');
    expect(udas).toContain('incrementBackupChanges');
    expect(udas).toContain('secureStorage.saveUdasAndMeta');
    expect(udas).toContain('setMeta');

    const tests = sectionBetween('const commitTestsMutation', 'const commitSubmissionsMutation');
    expect(tests).toContain('metaRef.current');
    expect(tests).toContain('incrementBackupChanges');
    expect(tests).toContain('secureStorage.saveCustomTestsAndMeta');
    expect(tests).toContain('setMeta');

    const submissions = sectionBetween('const commitSubmissionsMutation', '// Privacy Shield');
    expect(submissions).toContain('metaRef.current');
    expect(submissions).toContain('incrementBackupChanges');
    expect(submissions).toContain('secureStorage.saveSubmissionsAndMeta');
    expect(submissions).toContain('setMeta');
  });

  test('settings mutations are execution-time patches rather than stale full replacements', () => {
    expect(appSource).toContain("import { applySettingsPatch");
    const settings = sectionBetween('const commitSettingsMutation', 'const commitUdasMutation');
    expect(settings).toContain('derive: current =>');
    expect(settings).toContain('applySettingsPatch(current.settings, patch)');

    const handler = sectionBetween('// Save Settings', '// Backup actions are routed');
    expect(handler).toContain('const handleUpdateSettings = (patch: Partial<AppSettings>): Promise<void> =>');
    expect(handler).toContain('return commitSettingsMutation(patch).then(() => undefined);');
    expect(handler).not.toContain('void commitSettingsMutation');
  });

  test('teacher mutation handlers expose durable promises instead of swallowing rejection', () => {
    const addClass = sectionBetween('// Add new class', '// Delete class');
    expect(addClass).toContain('const handleAddClass = (): Promise<void> =>');
    expect(addClass).toContain('return commitAppDataMutation');
    expect(addClass).not.toContain('void commitAppDataMutation');

    const deleteClass = sectionBetween('// Delete class', '// Save evaluations batch');
    expect(deleteClass).toContain('const handleDeleteClass = (classId: string): Promise<void> =>');
    expect(deleteClass).toContain('return commitAppDataMutation');

    const evaluations = sectionBetween('// Save evaluations batch', '// Save behavior notes');
    expect(evaluations).toContain('): Promise<void> =>');
    expect(evaluations).toContain('return commitAppDataMutation');
    expect(evaluations).not.toContain('void commitAppDataMutation');

    const behaviors = sectionBetween('// Save behavior notes', '// Edit batch');
    expect(behaviors).toContain('const handleSaveBehaviors = (newRecords: any[]): Promise<void> =>');
    expect(behaviors).toContain('return commitAppDataMutation');

    const students = sectionBetween('// Add single student', '// Save new test');
    expect(students).toContain('const handleAddStudent = (name: string): Promise<void> =>');
    expect(students).toContain('const handleRemoveStudent = (studentId: string): Promise<void> =>');
    expect(students).toContain('const handleBulkAddStudents = (newStudents: Student[]): Promise<void> =>');
    expect(students).toContain('const handleInvertNames = (): Promise<void> =>');
    expect(students).not.toContain('void commitAppDataMutation');

    const deleteSubmission = sectionBetween('// Delete submission', 'const handleSaveStudentSubmission');
    expect(deleteSubmission).toContain('const handleDeleteSubmission = (submissionId: string): Promise<void> =>');
    expect(deleteSubmission).toContain('return commitSubmissionsMutation');
  });

  test('submission import is Promise-returning and reconciles deterministic submission grades at execution time', () => {
    expect(appSource).toContain("import { reconcileSubmissionGrades");
    const importSection = sectionBetween('// Import submissions into class grades', '// Save UDAs');
    expect(importSection).toContain('const handleImportSubmissionsToRegister = (targetUdaId?: string): Promise<void> =>');
    expect(importSection).toContain('return commitAppDataMutation(current =>');
    expect(importSection).toContain('reconcileSubmissionGrades(current.classes, submissionsRef.current, targetUdaId)');
    expect(importSection).not.toContain('batchId: `online_${uid()}`');
    expect(importSection).not.toContain('void commitAppDataMutation');
  });
});
