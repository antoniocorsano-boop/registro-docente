import { describe, expect, test } from 'bun:test';

const appSource = await Bun.file('src/App.tsx').text();
const udaSource = await Bun.file('src/components/UdaGanttView.tsx').text();
const verificheSource = await Bun.file('src/components/VerificheOnlineView.tsx').text();

function sourceSection(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
}

function sectionBetween(start: string, end: string): string {
  return sourceSection(appSource, start, end);
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

describe('PERSIST-01H pending intent boundaries', () => {
  test('UDA mutations share one immediate in-flight guard and preserve post-commit success sequencing', () => {
    expect(udaSource).toContain("import React, { useRef, useState } from 'react';");
    expect(udaSource).toContain('const [isSavingUda, setIsSavingUda] = useState(false);');
    expect(udaSource).toContain('const udaMutationPendingRef = useRef(false);');

    const boundary = sourceSection(udaSource, 'const commitUdaViewMutation', '// Embedding configuration');
    expect(boundary).toContain('if (udaMutationPendingRef.current) return false;');
    expect(boundary).toContain('udaMutationPendingRef.current = true;');
    expect(boundary).toContain('setIsSavingUda(true);');
    expect(boundary).toContain('await onSaveUdas(nextUdas);');
    expect(boundary).toContain('afterCommit?.();');
    expect(boundary).toContain('finally');
    expect(boundary).toContain('udaMutationPendingRef.current = false;');
    expect(boundary).toContain('setIsSavingUda(false);');
    expect(udaSource.match(/commitUdaViewMutation\(/g)?.length ?? 0).toBeGreaterThan(6);
  });

  test('interactive manual and file-created tests share one synchronous save guard', () => {
    expect(verificheSource).toContain("import React, { useRef, useState } from 'react';");
    expect(verificheSource).toContain('const [isSavingTest, setIsSavingTest] = useState(false);');
    expect(verificheSource).toContain('const testSavePendingRef = useRef(false);');
    expect(verificheSource).toContain('const commitTestSave = async (test: OnlineTest): Promise<boolean> =>');

    const saveBoundary = sourceSection(verificheSource, 'const commitTestSave', '// Save interactive test');
    expect(saveBoundary).toContain('if (testSavePendingRef.current) return false;');
    expect(saveBoundary).toContain('testSavePendingRef.current = true;');
    expect(saveBoundary).toContain('setIsSavingTest(true);');
    expect(saveBoundary).toContain('await onSaveNewTest(test);');
    expect(saveBoundary).toContain('finally');
    expect(saveBoundary).toContain('testSavePendingRef.current = false;');
    expect(saveBoundary).toContain('setIsSavingTest(false);');
    expect((verificheSource.match(/await commitTestSave\(newTest\)/g) || []).length).toBeGreaterThanOrEqual(3);
  });

  test('teacher submission delete and register import are Promise-aware and share an in-flight guard', () => {
    expect(verificheSource).toContain('onDeleteSubmission: (submissionId: string) => Promise<void>;');
    expect(verificheSource).toContain('onImportSubmissionsToRegister: (targetUdaId?: string) => Promise<void>;');
    expect(verificheSource).toContain('const [isSubmissionActionPending, setIsSubmissionActionPending] = useState(false);');
    expect(verificheSource).toContain('const submissionActionPendingRef = useRef(false);');
    expect(verificheSource).toContain('const handleDeleteSubmission = async (submissionId: string) =>');
    expect(verificheSource).toContain('await onDeleteSubmission(submissionId);');
    expect(verificheSource).toContain('const handleImportSubmissions = async () =>');
    expect(verificheSource).toContain('await onImportSubmissionsToRegister(currentSelectedTest?.udaId);');
    expect(verificheSource).toContain('disabled={isSubmissionActionPending}');
  });
});
