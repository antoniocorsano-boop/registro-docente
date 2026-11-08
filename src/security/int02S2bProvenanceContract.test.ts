import { describe, expect, test } from 'bun:test';

const app = await Bun.file('src/App.tsx').text();
const editor = await Bun.file('src/components/VerificheOnlineView.tsx').text();
const backup = await Bun.file('src/security/backupPayload.ts').text();

describe('INT-02/S2b — teacher-only persistent source contract', () => {
  test('teacher must confirm in the editor and origin is never inferred for imported files', () => {
    expect(editor).toContain('data-testid="int02-s2b-confirm-origin"');
    expect(editor).toContain('checked={confirmSourceForAssessment}');
    expect(editor).toContain('confirmSourceForAssessment && assessmentHandoff');
    expect(editor).toContain('setConfirmSourceForAssessment(false)');
    const interactive = editor.slice(editor.indexOf('// Save interactive test'), editor.indexOf('// Parse questions from DOCX/ZIP text'));
    expect(interactive).toContain("kind: 'library-source'");
    expect(interactive).toContain('confirmedByTeacher: true as const');
    const fileImport = editor.slice(editor.indexOf('const handleFileUpload'), editor.indexOf('const handleSaveManualTest'));
    expect(fileImport).not.toContain('confirmedByTeacher');
    const manual = editor.slice(editor.indexOf('const handleSaveManualTest'), editor.indexOf('const copyPadletLink'));
    expect(manual).not.toContain('confirmedByTeacher');
  });

  test('authoritative commit revalidates class and source, existing metadata is kept', () => {
    const section = app.slice(app.indexOf('// Save new test'), app.indexOf('// Delete submission'));
    expect(section).toContain('prepareAssessmentTestForCommit');
    expect(section).toContain('previousTest: current[newTest.id]');
    expect(section).toContain('library: libraryRef.current');
    expect(section).toContain('activeClassId: currentClassIdRef.current');
    expect(app).toContain('tests={projectAssessmentsForStudent(tests)}');
  });

  test('all backed-up versions validate the optional provenance before restore', () => {
    expect(backup).toContain('&& areAssessmentProvenancesValid(value.customTests)');
    expect(backup).toContain('payload.customTests !== undefined && !areAssessmentProvenancesValid(payload.customTests)');
  });
});
