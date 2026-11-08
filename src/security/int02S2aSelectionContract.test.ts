import { describe, expect, test } from 'bun:test';

describe('INT-02/S2a — condivisione non è importazione', () => {
  test('lato Padlet: classe/test espliciti, niente prima classe o prima verifica', async () => {
    const view = await Bun.file('src/components/VerificheOnlineView.tsx').text();
    expect(view).toContain("const [selectedClass, setSelectedClass] = useState<string>(assessmentHandoff?.className ?? '');");
    expect(view).toContain("const [shareSelectedTestId, setShareSelectedTestId] = useState<string>('');");
    expect(view).toContain('resolveAssessmentShareTarget({');
    expect(view).toContain('shareTarget.testId');
    expect(view).toContain('shareTarget.className');
    expect(view).toContain('disabled={!shareTarget}');
    expect(view).toContain('data-testid="int02-s2a-share-required"');
    expect(view).toContain('setShareSelectedTestId(\'\');');
    expect(view).not.toContain("classes[0]?.name");
    expect(view).not.toContain('onSimulateTest(selectedTestId, selectedClass)');
    expect(view).not.toContain('?mode=student&test=${selectedTestId}');
  });

  test('non riscrive il dominio esiti o l\'importazione batch da Registra', async () => {
    const view = await Bun.file('src/components/VerificheOnlineView.tsx').text();
    const app = await Bun.file('src/App.tsx').text();
    const reconciler = await Bun.file('src/persistence/submissionGradeImport.ts').text();
    expect(view).toContain('onImportSubmissionsToRegister(currentSelectedTest?.udaId)');
    expect(app).toContain('reconcileSubmissionGrades(current.classes, submissionsRef.current, targetUdaId)');
    expect(reconciler).toContain('submission.testId');
    expect(view).toContain('const [selectedTestId, setSelectedTestId]');
    const submit = view.slice(
      view.indexOf('const handleImportSubmissions = async'),
      view.indexOf('// Save interactive test')
    );
    expect(submit).not.toContain('shareSelectedTestId');
    expect(submit).not.toContain('shareTarget');
  });

  test('S1: il filtro UDA e la bozza editor rimangono presenti', async () => {
    const view = await Bun.file('src/components/VerificheOnlineView.tsx').text();
    expect(view).toContain('isAssessmentUdaSelectionAllowed(editorUdaId');
    expect(view).toContain('const requestLocalEditorExit =');
    expect(view).toContain('onRegisterDraftGuard(guard)');
    expect(view).toContain('data-testid="int02-open-assessment-editor"');
  });
});
