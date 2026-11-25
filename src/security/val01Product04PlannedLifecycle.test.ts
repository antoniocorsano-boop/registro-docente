import {describe,expect,test} from 'bun:test';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import type {AppData,AppSettings,ClassData} from '../types';
import {previewDailyAssessmentSetup,deriveConfirmedDailyAssessmentSetup,type AssessmentSetupRequest} from '../assessment/dailyAssessmentSetup';
import {listDailyPlannedProofs,previewDailyPlannedCompletion,deriveConfirmedDailyPlannedCompletion} from '../assessment/dailyPlannedAssessmentCompletion';
import {resolveDailyCriterionRecordingContext} from '../assessment/dailyCriterionRecordingContext';
import {readStudentCriterionEvidence} from '../assessment/studentCriterionReadModel';
import {DailyAssessmentSetupPanel} from '../components/DailyAssessmentSetupPanel';
import {validateAssessmentArchiveV1} from '../assessment/assessmentArchive';
import {createDurableMutationCoordinator} from '../persistence/durableMutationCoordinator';
import {boardScope,boardDocument} from '../../tests/browser/fixtures/val01-s6c-data';

const settings={year:boardScope.schoolYear,subject:boardScope.subjectCode};
const scopes=[{classId:boardScope.classId,schoolYear:boardScope.schoolYear,subjectCode:boardScope.subjectCode}];
const planning={confirmedByTeacher:true as const,confirmedAt:'2026-11-21T10:05:00.000Z'};
const performed={confirmedByTeacher:true as const,confirmedAt:'2026-12-02T12:00:00.000Z'};
function room():ClassData{
 return {id:boardScope.classId,name:'Classe sintetica',
  students:boardScope.studentIds.map(id=>({id,name:'Alunno sintetico '+id})),
  grades:[{id:'old-vote',studentId:'s1',date:'2026-11-19',type:'disegno',period:'Q1',title:'Prova precedente',value:'9'}],
  behaviors:[]};
}
const app=():AppData=>({classes:[room()],currentClassId:boardScope.classId});
function request():AssessmentSetupRequest{
 return {activityId:'plan04-activity',assessmentId:'plan04-assessment',
  plannedRevisionId:'plan04-planned',completedRevisionId:'plan04-future-completion',
  objectiveId:'plan04-objective',objectiveRevisionId:'plan04-objective-rev',
  title:'Disegno tecnico programmato',date:'2026-12-02',period:'Q1',purpose:'formative',
  objectiveText:'Rappresentare un oggetto in proiezione ortogonale',
  preparedAt:'2026-11-21T10:00:00.000Z',
  criteria:[{criterionId:'plan04-criterion',revisionId:'plan04-criterion-rev',
   description:'Correttezza delle viste',
   expected:{kind:'product',description:'Tre viste coerenti',method:'Disegno tecnico'}}]};
}
function schedule(){
 const current=app();
 const p=previewDailyAssessmentSetup(current.classes[0],settings,request(),'planned');
 if(!p.valid)throw Error('Preview failed '+p.issue);
 return deriveConfirmedDailyAssessmentSetup(current,scopes,p.review,planning);
}
function completion(current:AppData){
 const result=previewDailyPlannedCompletion(current.classes[0],settings,{
  assessmentRevisionId:request().plannedRevisionId,revisionId:'plan04-completed',
  completedOn:'2026-12-02'});
 if(!result.valid)throw Error('Synthetic completion unavailable');
 return result.review;
}
describe('VAL-01/PRODUCT-04 — teacher-scheduled proof and separate S6a completion',()=>{
 test('first planned proof builds S5b only in an absent archive, without evidence from old grades',()=>{
  const original=app(),before=JSON.stringify(original);
  const preview=previewDailyAssessmentSetup(original.classes[0],settings,request(),'planned');
  expect(preview.valid).toBe(true);
  if(!preview.valid)throw Error('Unexpected preview');
  expect(preview.review.mode).toBe('planned');
  expect(JSON.stringify(original)).toBe(before);
  const result=deriveConfirmedDailyAssessmentSetup(original,scopes,preview.review,planning);
  expect(result.classes[0].grades).toEqual(original.classes[0].grades);
  expect(result.classes[0].behaviors).toEqual(original.classes[0].behaviors);
  expect(validateAssessmentArchiveV1(result,scopes)).toEqual({valid:true,state:'present'});
  const doc=result.classes[0].assessmentEvidenceV1!.documents[0].document;
  expect(doc.assessments).toHaveLength(1);
  expect(doc.assessments[0].status).toBe('planned');
  expect(doc.evidence).toEqual([]);
 });
 test('adding and concluding a planned proof preserves prior completed proofs and personal evidence',()=>{
  const initial=app();
  initial.classes[0].assessmentEvidenceV1={version:1,documents:[{document:boardDocument,bindings:[]}]};
  const oldDocument=structuredClone(boardDocument),oldMarks=structuredClone(initial.classes[0].grades);
  const preview=previewDailyAssessmentSetup(initial.classes[0],settings,request(),'planned');
  expect(preview.valid).toBe(true);
  if(!preview.valid)throw Error('Existing archive denies planning');
  const scheduled=deriveConfirmedDailyAssessmentSetup(initial,scopes,preview.review,planning);
  const beforeCompletion=resolveDailyCriterionRecordingContext(scheduled.classes[0],settings);
  expect(beforeCompletion.status).toBe('ready');
  if(beforeCompletion.status==='ready')expect(beforeCompletion.assessments.map(a=>a.assessmentRevisionId)).toEqual(['a2']);
  const completed=deriveConfirmedDailyPlannedCompletion(scheduled,scopes,completion(scheduled),performed);
  const source=completed.classes[0].assessmentEvidenceV1!.documents[0].document;
  expect(source.evidence).toEqual(oldDocument.evidence);
  expect(source.assessments.slice(0,oldDocument.assessments.length)).toEqual(oldDocument.assessments);
  expect(source.references.slice(0,oldDocument.references.length)).toEqual(oldDocument.references);
  expect(source.criteria.slice(0,oldDocument.criteria.length)).toEqual(oldDocument.criteria);
  expect(completed.classes[0].grades).toEqual(oldMarks);
  const now=resolveDailyCriterionRecordingContext(completed.classes[0],settings);
  expect(now.status).toBe('ready');
  if(now.status==='ready')expect(now.assessments.map(a=>a.assessmentRevisionId)).toEqual(['a2','plan04-completed']);
 });
 test('planned proof cannot be used to register evidence until explicitly concluded',()=>{
  const initial=schedule();
  const list=listDailyPlannedProofs(initial.classes[0],settings);
  expect(list.status).toBe('ready');
  if(list.status==='ready'){
   expect(list.proofs.map(p=>p.revisionId)).toEqual(['plan04-planned']);
   expect(list.proofs[0].criteriaCount).toBe(1);
  }
  const board=resolveDailyCriterionRecordingContext(initial.classes[0],settings);
  expect(board.status).toBe('ready');
  if(board.status==='ready')expect(board.assessments).toEqual([]);
  const dossier=readStudentCriterionEvidence(initial.classes[0],settings,'s1');
  expect(dossier.status).toBe('ready');
  if(dossier.status==='ready')expect(dossier.rows).toEqual([]);
 });
 test('later actual completion preserves original planned revision and frozen criterion',()=>{
  const planned=schedule(),before=JSON.stringify(planned);
  const reviewed=completion(planned);
  expect(reviewed.preview.planned.status).toBe('planned');
  const result=deriveConfirmedDailyPlannedCompletion(planned,scopes,reviewed,performed);
  expect(JSON.stringify(planned)).toBe(before);
  expect(result.classes[0].grades).toEqual(planned.classes[0].grades);
  const orig=planned.classes[0].assessmentEvidenceV1!.documents[0].document;
  const doc=result.classes[0].assessmentEvidenceV1!.documents[0].document;
  expect(doc.assessments.map(a=>a.status)).toEqual(['planned','completed']);
  expect(doc.assessments[1].supersedesRevisionId).toBe('plan04-planned');
  expect(doc.criteria).toEqual(orig.criteria);
  expect(doc.references).toEqual(orig.references);
  expect(doc.evidence).toEqual([]);
  expect(validateAssessmentArchiveV1(result,scopes).valid).toBe(true);
  expect(listDailyPlannedProofs(result.classes[0],settings).status).toBe('ready');
  const ready=resolveDailyCriterionRecordingContext(result.classes[0],settings);
  expect(ready.status).toBe('ready');
  if(ready.status==='ready'){
   expect(ready.assessments).toHaveLength(1);
   expect(ready.assessments[0].assessmentRevisionId).toBe('plan04-completed');
   expect(ready.assessments[0].criteria.map(c=>c.revisionId)).toEqual(['plan04-criterion-rev']);
  }
 });
 test('replay of the same confirmation is rejected, with original archive left untouched',()=>{
  const planned=schedule(),review=completion(planned);
  const next=deriveConfirmedDailyPlannedCompletion(planned,scopes,review,performed);
  const prev=JSON.stringify(next);
  expect(()=>deriveConfirmedDailyPlannedCompletion(next,scopes,review,performed)).toThrow();
  expect(JSON.stringify(next)).toBe(prev);
 });
 test('changed roster, foreign scope, invalid confirmation and premature completion fail closed',()=>{
  const planned=schedule(),review=completion(planned);
  const modified=structuredClone(planned);modified.classes[0].students.reverse();
  expect(()=>deriveConfirmedDailyPlannedCompletion(modified,scopes,review,performed)).toThrow();
  expect(()=>deriveConfirmedDailyPlannedCompletion(planned,[],review,performed)).toThrow();
  expect(()=>deriveConfirmedDailyPlannedCompletion(planned,scopes,review,
   {confirmedByTeacher:true,confirmedAt:'invalid'})).toThrow();
  expect(()=>deriveConfirmedDailyPlannedCompletion(planned,scopes,review,
   {confirmedByTeacher:true,confirmedAt:'2026-11-21T09:00:00.000Z'})).toThrow();
  expect(previewDailyPlannedCompletion(planned.classes[0],{...settings,subject:'OTHER'},{
   assessmentRevisionId:'plan04-planned',revisionId:'another',completedOn:'2026-12-02'}).valid).toBe(false);
 });
 test('a dated completion rejects a revision of the wrong or already completed proof',()=>{
  const planned=schedule();
  expect(previewDailyPlannedCompletion(planned.classes[0],settings,{
   assessmentRevisionId:'other',revisionId:'plan04-completed',completedOn:'2026-12-02'}).valid).toBe(false);
  const complete=deriveConfirmedDailyPlannedCompletion(planned,scopes,completion(planned),performed);
  expect(previewDailyPlannedCompletion(complete.classes[0],settings,{
   assessmentRevisionId:'plan04-planned',revisionId:'another',completedOn:'2026-12-02'}).valid).toBe(false);
 });
 test('the original already-succeeded PRODUCT-03 immediate-completion route remains unchanged',()=>{
  const current=app(),short={...request(),date:'2026-11-21'};
  const preview=previewDailyAssessmentSetup(current.classes[0],settings,short);
  expect(preview.valid).toBe(true);
  if(!preview.valid)throw Error('Legacy preview denied');
  expect(preview.review.mode).toBeUndefined();
  const completed=deriveConfirmedDailyAssessmentSetup(current,scopes,preview.review,planning);
  expect(completed.classes[0].assessmentEvidenceV1!.documents[0].document.assessments
   .map(a=>a.status)).toEqual(['planned','completed']);
 });
 test('failed durable completion cannot publish or acknowledge, retry requires fresh explicit action',async()=>{
  const planned=schedule(),review=completion(planned),prior=JSON.stringify(planned);
  const coordinator=createDurableMutationCoordinator();
  let committed=planned,published=0,attempts=0;
  const perform=()=>coordinator.enqueue({
   getCommitted:()=>committed,
   derive:current=>deriveConfirmedDailyPlannedCompletion(current,scopes,review,performed),
   persist:async()=>{attempts++;if(attempts===1)throw Error('synthetic transaction abort');},
   publish:next=>{published++;committed=next;}
  });
  await expect(perform()).rejects.toThrow('synthetic transaction abort');
  expect(JSON.stringify(committed)).toBe(prior);expect(published).toBe(0);
  await perform();expect(published).toBe(1);
  expect(committed.classes[0].assessmentEvidenceV1!.documents[0].document.assessments.at(-1)?.status).toBe('completed');
 });
 test('mobile panel exposes explicit planned and completed actions without exposing student names',()=>{
  const planned=schedule(),ui=renderToStaticMarkup(React.createElement(DailyAssessmentSetupPanel,{
   currentClass:planned.classes[0],settings:settings as AppSettings,date:'2026-12-02',
   isPrivacyShieldActive:true,externalBusy:false,onBusyChange:()=>{},
   onRegisterDraftGuard:()=>{},onSave:async()=>({revisionId:'not-called'}),
   onComplete:async()=>({revisionId:'not-called'})
  }));
  expect(ui).toContain('Da svolgere');
  expect(ui).toContain('Già svolta');
  expect(ui).toContain('Concludi una prova programmata');
  expect(ui).toContain('Disegno tecnico programmato');
  expect(ui).toContain('Esamina conclusione della prova');
  expect(ui).not.toContain('Alunno sintetico');
 });
 test('new real production handler uses the same encrypted App commit and guards',()=>{
  const source=readFileSync('src/App.tsx','utf8');
  const panel=readFileSync('src/components/DailyAssessmentSetupPanel.tsx','utf8');
  const daily=readFileSync('src/components/DailyMatrixWorkspace.tsx','utf8');
  expect(source).toContain('deriveConfirmedDailyPlannedCompletion(current,approved,reviewed,confirmation)');
  expect(source).toContain('onCompletePlannedAssessment={handleCompletePlannedAssessment}');
  expect(source).toContain('const result=await commitAppDataMutation(current=>');
  expect(panel).toContain('previewDailyPlannedCompletion(currentClass,settings,');
  expect(panel).toContain('setCompletion(freshCompletion(date))');
  expect(daily).toContain('onComplete={onCompletePlannedAssessment}');
  expect(panel).not.toContain('localStorage');
  expect(panel).not.toContain('fetch(');
 });
});
