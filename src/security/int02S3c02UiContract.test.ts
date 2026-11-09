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
    expect(panel).toContain('getLiveContext');
    expect(panel).toContain('Crea una proposta');
    expect(panel).toContain('Apri come bozza in Verifiche');
    expect(panel).toContain('Correttezza da verificare');
    expect(panel).not.toContain('onSaveNewTest');
  });
  test('ricollega il pannello al Copilota esistente, senza sostituirne le altre azioni',async()=>{
    const composer=await read('src/components/LibraryCopilotComposer.tsx');
    expect(composer).toContain('AssessmentCopilotPanel');
    expect(composer).toContain('onAcceptAssessmentDraft');
    expect(composer).toContain('currentClassId');
    expect(composer).toContain('Creare una verifica');
    expect(composer).toContain('selectedSource');
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
