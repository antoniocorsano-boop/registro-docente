import { describe, expect, test } from 'bun:test';

describe('INT-02/S1 source-to-assessment UI and mutation separation', () => {
  test('App keeps a session-only class and source reference; history and URL remain independent', async () => {
    const app = await Bun.file('src/App.tsx').text();
    expect(app).toContain("import { resolveAssessmentHandoff, type AssessmentHandoffRequest } from './library/assessmentHandoff';");
    expect(app).toContain("const [assessmentHandoffRequest, setAssessmentHandoffRequest] = useState<AssessmentHandoffRequest | null>(null)");
    expect(app).toContain('library: libraryRef.current');
    expect(app).toContain('classes: appDataRef.current.classes');
    expect(app).toContain("handleNavigateTab('verifiche-online')");
    expect(app).toContain('request: assessmentHandoffRequest,');
    expect(app).toContain('library,');
    expect(app).toContain('activeClassId: currentClass?.id');
    expect(app).toContain('assessmentHandoff={activeAssessmentHandoff}');
    expect(app).toContain('setAssessmentHandoffRequest(null)');
    expect(app).not.toContain('params.set(\'source\'');
    expect(app).not.toContain('params.set(\'assessmentHandoff\'');
    expect(app).not.toContain('history.pushState({ assessmentHandoff');
    expect(app).toContain("if (tab !== 'verifiche-online') setAssessmentHandoffRequest(null);");
  });

  test('shared catalogue remains class-reusable while UDA and navigation labels are explicit', async () => {
    const app = await Bun.file('src/App.tsx').text();
    const view = await Bun.file('src/components/VerificheOnlineView.tsx').text();
    const types = await Bun.file('src/types.ts').text();
    const testModel = types.slice(types.indexOf('export interface OnlineTest {'), types.indexOf('export interface OnlineSubmission {'));
    expect(testModel).not.toContain('classId');
    expect(testModel).not.toContain('className');
    expect(view).toContain('Object.values(tests).map(t => {');
    expect(view).toContain('Il catalogo è comune alle classi');
    expect(view).toContain('La classe destinataria si sceglie nella sezione Condivisione Padlet');
    expect(view).toContain('le UDA selezionabili nell’editor appartengono alla classe di lavoro');
    expect(view).toContain("editingTestId ? 'Salva modifiche' : 'Salva Verifica'");
    expect(view).toContain("editingTestId ? 'Salva modifiche e chiudi' : 'Salva verifica e chiudi'");
    expect(app).toContain("planningExitDestination === 'biblioteca' ? 'Biblioteca privata'");
    expect(app).toContain("planningExitDestination === 'verifiche-online' ? 'Verifiche online'");
  });

  test('Library surfaces expose one explicit action, only when teacher source is ready and class exists', async () => {
    const card = await Bun.file('src/components/LibrarySourceCard.tsx').text();
    const library = await Bun.file('src/components/LibraryView.tsx').text();
    expect(card).toContain('data-testid="int02-prepare-assessment"');
    expect(card).toContain("source.privacy === 'teacher-professional'");
    expect(card).toContain("source.status === 'ready'");
    expect(card).toContain('currentClassName && (');
    expect(card).toContain('onPrepareAssessment(source.id)');
    expect(library.split('onPrepareAssessment={onPrepareAssessment}').length - 1).toBe(2);
    expect(applyProofNoWrite(card)).toBe(true);
  });

  test('Verifiche presents a source and class summary without automatically creating a test or assigning the first UDA', async () => {
    const view = await Bun.file('src/components/VerificheOnlineView.tsx').text();
    expect(view).toContain('assessmentHandoff?: ResolvedAssessmentHandoff | null;');
    expect(view).toContain('data-testid="int02-assessment-handoff"');
    expect(view).toContain('data-testid="int02-open-assessment-editor"');
    expect(view).toContain('!isEditingTest ? (');
    expect(view).toContain('Editor già aperto: termina o chiudi la bozza');
    expect(view).toContain('setEditorUdaId(\'\');');
    expect(view).toContain('Fonte professionale:');
    expect(view).toContain('Non è stata creata alcuna verifica');
    expect(view).toContain('onClick={() => handleStartNewInteractiveTest()}');
    expect(view).toContain('await onSaveNewTest(test);');
    const handoff = view.slice(
      view.indexOf('data-testid="int02-assessment-handoff"'),
      view.indexOf('data-testid="int02-open-assessment-editor"')
    );
    expect(handoff).not.toContain('onSaveNewTest(');
    expect(handoff).not.toContain('onImportSubmissionsToRegister(');
    expect(handoff).not.toContain('editorUdaId');
  });
});

function applyProofNoWrite(card: string): boolean {
  const sourceAction = card.slice(
    card.indexOf('data-testid="int02-prepare-assessment"'),
    card.indexOf('data-testid="int02-prepare-assessment"') + 450
  );
  return sourceAction.includes('onPrepareAssessment(source.id)')
    && !sourceAction.includes('onSaveNewTest')
    && !sourceAction.includes('onImportSubmissionsToRegister');
}
