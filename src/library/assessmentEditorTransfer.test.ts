import { describe, expect, test } from 'bun:test';
import type { ClassData } from '../types';
import type { LibraryStateV1, LibrarySource } from './types';
import { prepareAssessmentGenerationSession } from './assessmentGeneration';

const SOURCE: LibrarySource = {
  id:'source-s3c',title:'Trasformazioni di energia',kind:'note',
  capturedAt:'2026-11-09T00:00:00.000Z',
  payload:{text:'Una centrale elettrica trasforma energia primaria in energia elettrica.'},
  privacy:'teacher-professional',status:'ready',links:[]
};
const CLASSES=[{id:'class-3c',name:'3C',students:[],grades:[],behaviors:[]},
{id:'class-2c',name:'2C',students:[],grades:[],behaviors:[]}] satisfies ClassData[];
const LIBRARY:LibraryStateV1={schemaVersion:1,sources:[SOURCE]};
const DRAFT={
  schemaVersion:1,kind:'assessment-draft',
  title:'Energia elettrica',description:'Proposta da rivedere',
  questions:[{q:'Quale grandezza si misura in watt?',type:'multiple_choice',
    options:['Energia','Potenza','Tensione'],correct:1,
    explanation:'Il watt è l’unità della potenza.'}]
} as const;
const SESSION=prepareAssessmentGenerationSession({
  source:SOURCE,confirmedSourceId:SOURCE.id,activeClassName:'3C',
  confirmedClassName:'3C',objective:'Conoscere la trasformazione dell’energia',
  explicitTeacherOptIn:true
});
const base=()=>({
  session:SESSION,draft:DRAFT,library:LIBRARY,classes:CLASSES,
  activeClassId:'class-3c',teacherConfirmedAdoption:true
});

describe('INT-02/S3c-01 — trasferimento solo in editor di verifica',()=>{
  test('materializza un gestore puro, distinto dal salvataggio del Registro',async()=>{
    const module = await import('./assessmentEditorTransfer');
    expect(typeof module.prepareAssessmentEditorTransfer).toBe('function');
    expect(typeof module.checkAssessmentEditorTransferContext).toBe('function');
  });
  test('richiede conferma umana, classe autorizzata e fonte ancora valida',async()=>{
    const {prepareAssessmentEditorTransfer}=await import('./assessmentEditorTransfer');
    expect(prepareAssessmentEditorTransfer(base()).status).toBe('ready');
    expect(prepareAssessmentEditorTransfer({...base(),teacherConfirmedAdoption:false}).status).toBe('blocked');
    expect(prepareAssessmentEditorTransfer({...base(),activeClassId:'class-2c'}).status).toBe('blocked');
    expect(prepareAssessmentEditorTransfer({...base(),library:{...LIBRARY,sources:[{...SOURCE,status:'restricted'}]}}).status).toBe('blocked');
    expect(prepareAssessmentEditorTransfer({...base(),library:{...LIBRARY,sources:[{...SOURCE,id:'replacement',title:SOURCE.title}]}}).status).toBe('blocked');
    expect(prepareAssessmentEditorTransfer({...base(),classes:[...CLASSES,{...CLASSES[0],id:'duplicate'}]}).status).toBe('blocked');
  });
  test('proietta soltanto campi modificabili, senza id o attribuzioni implicite',async()=>{
    const {prepareAssessmentEditorTransfer}=await import('./assessmentEditorTransfer');
    const result=prepareAssessmentEditorTransfer(base());
    expect(result.status).toBe('ready');
    if(result.status!=='ready')return;
    expect(result.transfer).toMatchObject({
      schemaVersion:1,kind:'copilot-assessment-prefill',classId:'class-3c',
      className:'3C',sourceId:SOURCE.id,prefill:{
        title:DRAFT.title,description:DRAFT.description
      }
    });
    expect(result.transfer.prefill.questions).toEqual(DRAFT.questions);
    for (const key of ['id','udaId','provenance','saved','grades','submission','durationMinutes']){
      expect(JSON.stringify(result.transfer.prefill)).not.toContain('"' + key + '"');
    }
    expect(result.transfer.prefill.questions[0]).not.toBe(DRAFT.questions[0]);
    expect(result.transfer.prefill.questions[0].options).not.toBe(DRAFT.questions[0].options);
  });
  test('non accetta una proposta del provider con metadati non autorizzati',async()=>{
    const {prepareAssessmentEditorTransfer}=await import('./assessmentEditorTransfer');
    expect(prepareAssessmentEditorTransfer({...base(),draft:{...DRAFT,udaId:'inventata'}}).status).toBe('blocked');
    expect(prepareAssessmentEditorTransfer({...base(),draft:{...DRAFT,questions:[{...DRAFT.questions[0],correct:9}]}}).status).toBe('blocked');
  });
  test('blocca la sostituzione di una bozza sporca o un salvataggio in corso',async()=>{
    const {canAcceptAssessmentEditorTransfer}=await import('./assessmentEditorTransfer');
    expect(canAcceptAssessmentEditorTransfer({hasUnsavedChanges:false,isSaving:false})).toBe(true);
    expect(canAcceptAssessmentEditorTransfer({hasUnsavedChanges:true,isSaving:false})).toBe(false);
    expect(canAcceptAssessmentEditorTransfer({hasUnsavedChanges:false,isSaving:true})).toBe(false);
  });
  test('ricontrolla la fonte e la classe al momento dell’apertura in editor',async()=>{
    const {prepareAssessmentEditorTransfer,checkAssessmentEditorTransferContext}=await import('./assessmentEditorTransfer');
    const ready=prepareAssessmentEditorTransfer(base());
    expect(ready.status).toBe('ready');
    if(ready.status!=='ready')return;
    expect(checkAssessmentEditorTransferContext(ready.transfer,{
      ...base(),teacherConfirmedAdoption:true
    })).toBe(true);
    expect(checkAssessmentEditorTransferContext(ready.transfer,{
      ...base(),activeClassId:'class-2c'
    })).toBe(false);
    expect(checkAssessmentEditorTransferContext(ready.transfer,{
      ...base(),library:{...LIBRARY,sources:[{...SOURCE,id:'replacement'}]}
    })).toBe(false);
  });
});
