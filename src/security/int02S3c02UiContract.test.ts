import {describe, expect, test} from 'bun:test';
import {readFile} from 'node:fs/promises';
import path from 'node:path';

const ROOT=path.resolve(import.meta.dir,'../..');
const read=(p:string)=>readFile(path.join(ROOT,p),'utf8');

describe('INT-02/S3c-02 — Copilota, anteprima e editor senza salvataggi automatici',()=>{
  test('introduce il pannello con fonte e classe autorizzate, richiesta esplicita e anteprima',async()=>{
    const panel=await read('src/components/AssessmentCopilotPanel.tsx');
    expect(panel).toContain('prepareAssessmentGenerationSession');
    expect(panel).toContain('requestAssessmentDraftFromCopilot');
    expect(panel).toContain('explicitTeacherOptIn: true');
    expect(panel).toContain('authorizedClassId:');
    expect(panel).toContain('classIsUnambiguous');
    expect(panel).toContain('CLIENT_GENERATION_TIMEOUT_MS');
    expect(panel).toContain('Annulla richiesta');
    expect(panel).toContain('getLiveContext');
    expect(panel).toContain('Crea la proposta');
    expect(panel).toContain('Apri e modifica');
    expect(panel).toContain('Controlla le risposte prima di salvare.');
    expect(panel).toContain('Che cosa vuoi verificare?');
    expect(panel).toContain('Come funziona l\'invio');
    expect(panel).toContain('int02-assessment-questions-details');
    expect(panel).toContain('role="alert" data-testid="int02-assessment-error"');
    expect(panel).toContain('objectiveRef.current?.focus()');
    expect(panel).toContain('previewHeadingRef.current?.focus()');
    expect(panel).toContain('Confermo l\'invio del materiale e dell\'obiettivo');
    expect(panel).not.toContain('onSaveNewTest');
  });
  test('ricollega il pannello al Copilota esistente, senza sostituirne le altre azioni',async()=>{
    const composer=await read('src/components/LibraryCopilotComposer.tsx');
    expect(composer).toContain('AssessmentCopilotPanel');
    expect(composer).toContain('onAcceptAssessmentDraft');
    expect(composer).toContain('isAssessmentClassUnambiguous');
    expect(composer).toContain('currentClassId');
    expect(composer).toContain('Creare una verifica');
    expect(composer).toContain('selectedSource');
    expect(composer).toContain('!isAssessmentOpen && (');
    expect(composer).toContain('!isAssessmentOpen && !isBoundMissionFlow && teacherFirstResolution');
    expect(composer).toContain('Cambia attività');
    expect(composer).toContain('assessmentSourceSelectRef.current?.focus()');
    expect(composer).toContain('assessmentGoalButtonRef.current?.focus()');
    expect(composer).not.toContain('setSelectedSourceId(event.target.value);\n              setIsAssessmentOpen(false);');
    expect(composer).toContain('showMaterialControls && !isAssessmentOpen');
    expect(composer).toContain('if(!isOpen)setIsAssessmentOpen(false)');
    expect(composer).toContain('isAssessmentOpen ? \'Materiale\' : \'Fonte della Biblioteca\'');
  });
  test('usa uno stato effimero in App e ricontrolla il contesto prima della navigazione',async()=>{
    const app=await read('src/App.tsx');
    expect(app).toContain('prepareAssessmentEditorTransfer');
    expect(app).toContain('checkAssessmentEditorTransferContext');
    expect(app).toContain('canAcceptAssessmentEditorTransfer');
    expect(app).toContain('onAcceptAssessmentDraft=');
    expect(app).toContain('assessmentEditorTransfer=');
    expect(app).toContain("handleNavigateTab('verifiche-online')");
    expect(app).not.toContain('localStorage.setItem(\'assessmentEditorTransfer');
  });
  test('precompila solo il nuovo editor, con UDA vuota, senza id, voto o salvataggio',async()=>{
    const view=await read('src/components/VerificheOnlineView.tsx');
    expect(view).toContain('assessmentEditorTransfer');
    expect(view).toContain('canAcceptAssessmentEditorTransfer');
    expect(view).toContain("setEditorUdaId('')");
    expect(view).toContain('setConfirmSourceForAssessment(false)');
    expect(view).toContain('editorBaselineRef.current = null');
    expect(view).toContain('onAssessmentTransferResult');
    expect(view).not.toContain('onSaveNewTest(assessmentEditorTransfer');
  });
});
