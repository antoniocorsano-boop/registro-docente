import { describe, expect, test } from 'bun:test';

const source = async (path: string) => Bun.file(path).text();

describe('PERSIST-01H teacher UI pending and draft-preservation contract', () => {
  test('evaluation save is awaited and the form cannot submit twice while pending', async () => {
    const text = await source('src/components/EvaluationsView.tsx');
    expect(text).toContain('}) => Promise<void>;');
    expect(text).toContain('const [isSaving, setIsSaving] = useState(false);');
    expect(text).toContain('const handleSubmit = async (e: React.FormEvent) =>');
    expect(text).toContain('if (isSaving) return;');
    expect(text).toContain('await onSaveEvaluations({');
    expect(text).toContain('finally');
    expect(text).toContain('setIsSaving(false);');
    expect(text).toContain('disabled={isSaving}');
  });

  test('behavior save is awaited and preserves its draft while pending', async () => {
    const text = await source('src/components/BehaviorsView.tsx');
    expect(text).toContain('onSaveBehaviors: (records: BehaviorRecord[]) => Promise<void>;');
    expect(text).toContain('const [isSaving, setIsSaving] = useState(false);');
    expect(text).toContain('const handleSave = async () =>');
    expect(text).toContain('if (isSaving) return;');
    expect(text).toContain('await onSaveBehaviors(newRecords);');
    expect(text).toContain('disabled={isSaving}');
  });

  test('student mutations await persistence before clearing retry-relevant input or reporting import success', async () => {
    const text = await source('src/components/StudentsManagementView.tsx');
    expect(text).toContain('onAddStudent: (name: string) => Promise<void>;');
    expect(text).toContain('onRemoveStudent: (studentId: string) => Promise<void>;');
    expect(text).toContain('onInvertNames: () => Promise<void>;');
    expect(text).toContain('onBulkAddStudents: (students: Student[]) => Promise<void>;');
    expect(text).toContain('const [isStudentMutationPending, setIsStudentMutationPending] = useState(false);');
    expect(text).toContain('const handleAdd = async (e: React.FormEvent) =>');
    expect(text.indexOf('await onAddStudent(sanitizeName(newStudentName));')).toBeLessThan(text.indexOf("setNewStudentName('');"));
    expect(text).toContain('await onBulkAddStudents(imported);');
    expect(text.indexOf('await onBulkAddStudents(imported);')).toBeLessThan(text.indexOf('Importazione completata con successo!'));
    expect(text).toContain('disabled={isStudentMutationPending}');
  });

  test('settings save awaits a top-level diff and theme persists only a theme patch', async () => {
    const text = await source('src/components/SettingsView.tsx');
    expect(text).toContain("import { diffSettings } from '../persistence/settingsMutation';");
    expect(text).toContain('onUpdateSettings: (patch: Partial<AppSettings>) => Promise<void>;');
    expect(text).toContain('const [isSavingSettings, setIsSavingSettings] = useState(false);');
    expect(text).toContain('const handleThemeChange = async (themeId: AppTheme) =>');
    expect(text).toContain('await onUpdateSettings({ theme: themeId });');
    expect(text).not.toContain('onUpdateSettings(updated);');
    expect(text).toContain('const handleSave = async (e: React.FormEvent) =>');
    expect(text).toContain('await onUpdateSettings(diffSettings(settings, formData));');
    expect(text.indexOf('await onUpdateSettings(diffSettings(settings, formData));')).toBeLessThan(text.indexOf('Impostazioni e preferenze salvate con successo!'));
    expect(text).toContain('disabled={isSavingSettings}');
  });

  test('Home class actions are Promise-aware and guarded against repeated pending intent', async () => {
    const text = await source('src/components/HomeView.tsx');
    expect(text).toContain('onAddClass: () => Promise<void>;');
    expect(text).toContain('onDeleteClass: (classId: string) => Promise<void>;');
    expect(text).toContain('const [isClassMutationPending, setIsClassMutationPending] = useState(false);');
    expect(text).toContain('const handleAddClass = async () =>');
    expect(text).toContain('await onAddClass();');
    expect(text).toContain('const handleDeleteClass = async (classId: string) =>');
    expect(text).toContain('await onDeleteClass(classId);');
    expect(text).toContain('disabled={isClassMutationPending}');
  });

  test('UDA mutations share one synchronous in-flight guard around the durable boundary', async () => {
    const text = await source('src/components/UdaGanttView.tsx');
    expect(text).toContain("import React, { useRef, useState } from 'react';");
    expect(text).toContain('const [isSavingUda, setIsSavingUda] = useState(false);');
    expect(text).toContain('const udaMutationPendingRef = useRef(false);');
    expect(text).toContain('if (udaMutationPendingRef.current) return false;');
    expect(text).toContain('udaMutationPendingRef.current = true;');
    expect(text).toContain('await onSaveUdas(nextUdas);');
    expect(text).toContain('udaMutationPendingRef.current = false;');
    expect(text).toContain('setIsSavingUda(false);');
    expect(text).toContain('disabled={isSavingUda}');
  });

  test('all test creation paths share one synchronous durable-save guard', async () => {
    const text = await source('src/components/VerificheOnlineView.tsx');
    expect(text).toContain("import React, { useRef, useState } from 'react';");
    expect(text).toContain('const [isSavingTest, setIsSavingTest] = useState(false);');
    expect(text).toContain('const testSavePendingRef = useRef(false);');
    expect(text).toContain('const commitTestSave = async (test: OnlineTest): Promise<boolean> =>');
    expect(text).toContain('if (testSavePendingRef.current) return false;');
    expect(text).toContain('await onSaveNewTest(test);');
    expect((text.match(/await commitTestSave\(newTest\)/g) || []).length).toBeGreaterThanOrEqual(3);
    expect(text).toContain('disabled={isSavingTest}');
  });

  test('teacher submission delete and import share a Promise-aware in-flight guard', async () => {
    const text = await source('src/components/VerificheOnlineView.tsx');
    expect(text).toContain('onDeleteSubmission: (submissionId: string) => Promise<void>;');
    expect(text).toContain('onImportSubmissionsToRegister: (targetUdaId?: string) => Promise<void>;');
    expect(text).toContain('const [isSubmissionActionPending, setIsSubmissionActionPending] = useState(false);');
    expect(text).toContain('const submissionActionPendingRef = useRef(false);');
    expect(text).toContain('const handleDeleteSubmission = async (submissionId: string) =>');
    expect(text).toContain('await onDeleteSubmission(submissionId);');
    expect(text).toContain('const handleImportSubmissions = async () =>');
    expect(text).toContain('await onImportSubmissionsToRegister(currentSelectedTest?.udaId);');
    expect(text).toContain('disabled={isSubmissionActionPending}');
  });
});
