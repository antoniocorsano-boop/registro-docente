import {describe,expect,test} from 'bun:test';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import type {AppData,AppSettings,ClassData} from '../types';
import {boardDocument,boardScope} from '../../tests/browser/fixtures/val01-s6c-data';
import {resolveDailyCriterionRecordingContext} from '../assessment/dailyCriterionRecordingContext';
import {previewIndividualObservation} from '../assessment/individualObservation';
import {deriveConfirmedEvidenceMutation} from '../assessment/assessmentEvidenceMutation';
import {DailyCriterionRecorder} from '../components/DailyCriterionRecorder';
import {createDurableMutationCoordinator} from '../persistence/durableMutationCoordinator';

const settings={year:boardScope.schoolYear,subject:boardScope.subjectCode};
const approved=[{classId:boardScope.classId,schoolYear:boardScope.schoolYear,subjectCode:boardScope.subjectCode}];
const fixture=():ClassData=>({
 id:boardScope.classId,name:'Classe fittizia',students:boardScope.studentIds.map(id=>({id,name:'Fittizio '+id})),
 grades:[{id:'grade-old',studentId:'s4',date:'2026-11-20',type:'disegno',period:'Q1',title:'Prova',value:'9'}],
 behaviors:[],assessmentEvidenceV1:{version:1,documents:[{document:boardDocument,bindings:[]}]}
});
const app=():AppData=>({classes:[fixture()],currentClassId:boardScope.classId});
function review(data:AppData=app()){
 const c=data.classes[0],d=c.assessmentEvidenceV1!.documents[0].document;
 const request={evidenceId:'product02-evidence',revisionId:'product02-rev',
  observationEventId:'product02-event',assessmentRevisionId:'a2',
  criterionRevisionId:'c1',studentId:'s4',observedOn:'2026-11-21',
  recordedAt:'2026-11-21T11:00:00.000Z',state:'observed',
  fact:{kind:'product',description:'Schema con relazioni motivate',method:'elaborato'},
  interpretation:{kind:'pending'}};
 const result=previewIndividualObservation(d,boardScope,request);
 if(!result.valid)throw Error('Invalid synthetic preview: '+result.issue);
 return {kind:'new' as const,preview:result.preview};
}
const confirm={confirmedByTeacher:true,confirmedAt:'2026-11-21T11:10:00.000Z'};

describe('VAL-01/PRODUCT-02 — daily criterion recorder and durable authority',()=>{
 test('shows only existing active completed proofs, criteria and exact frozen revision',()=>{
  const context=resolveDailyCriterionRecordingContext(fixture(),settings);
  expect(context.status).toBe('ready');
  if(context.status!=='ready')throw Error('Unexpected context');
  expect(context.assessments.map(a=>a.assessmentRevisionId)).toEqual(['a2']);
  expect(context.assessments[0].criteria.map(c=>c.revisionId)).toEqual(['c1','c2']);
  expect(context.scope.studentIds).toEqual(boardScope.studentIds);
 });
 test('missing archive does not invent a proof from excellent grades',()=>{
  const c=fixture();delete c.assessmentEvidenceV1;
  expect(resolveDailyCriterionRecordingContext(c,settings)).toEqual({status:'absent'});
 });
 test('foreign year, subject or class fail closed',()=>{
  expect(resolveDailyCriterionRecordingContext(fixture(),{...settings,year:'2025/2026'})).toEqual({status:'unverified'});
  expect(resolveDailyCriterionRecordingContext(fixture(),{...settings,subject:'OTHER'})).toEqual({status:'unverified'});
  expect(resolveDailyCriterionRecordingContext({...fixture(),id:'foreign'},settings)).toEqual({status:'unverified'});
 });
 test('only confirmed and valid graphs may be presented',()=>{
  const c=fixture();c.assessmentEvidenceV1={version:1,documents:[{document:{...boardDocument,version:2} as any,bindings:[]}]};
  expect(resolveDailyCriterionRecordingContext(c,settings)).toEqual({status:'unverified'});
 });
 test('verified preview commits only a new individual event; grades and historical data remain identical',()=>{
  const current=app(),old=JSON.stringify(current),reviewed=review(current);
  const next=deriveConfirmedEvidenceMutation(current,approved,boardScope,reviewed,confirm);
  const original=current.classes[0],changed=next.appData.classes[0];
  expect(JSON.stringify(current)).toBe(old);
  expect(changed.grades).toEqual(original.grades);
  expect(changed.behaviors).toEqual(original.behaviors);
  expect(changed.assessmentEvidenceV1!.documents[0].document.evidence.length).toBe(boardDocument.evidence.length+1);
  expect(next.evidence.revisionId).toBe('product02-rev');
  expect(next.evidence.studentId).toBe('s4');
  expect(next.evidence.state).toBe('observed');
 });
 test('replay, stale roster, absent archive and changed session scope are rejected',()=>{
  const current=app(),reviewed=review(current);
  const next=deriveConfirmedEvidenceMutation(current,approved,boardScope,reviewed,confirm);
  expect(()=>deriveConfirmedEvidenceMutation(next.appData,approved,boardScope,reviewed,confirm)).toThrow();
  expect(()=>deriveConfirmedEvidenceMutation(current,approved,{...boardScope,studentIds:['s4']},reviewed,confirm)).toThrow();
  const missing=app();delete missing.classes[0].assessmentEvidenceV1;
  expect(()=>deriveConfirmedEvidenceMutation(missing,approved,boardScope,reviewed,confirm)).toThrow();
  expect(()=>deriveConfirmedEvidenceMutation(current,approved,{...boardScope,subjectCode:'OTHER'},reviewed,confirm)).toThrow();
 });
 test('a failed canonical durable write never publishes, then explicit retry can succeed',async()=>{
  const coordinator=createDurableMutationCoordinator(),reviewed=review();
  let committed=app(),published=0,attempt=0;
  const old=JSON.stringify(committed);
  const apply=()=>coordinator.enqueue({
   getCommitted:()=>committed,
   derive:current=>deriveConfirmedEvidenceMutation(current,approved,boardScope,reviewed,confirm).appData,
   persist:async()=>{attempt++;if(attempt===1)throw Error('synthetic disk failure');},
   publish:candidate=>{committed=candidate;published++;}
  });
  await expect(apply()).rejects.toThrow('synthetic disk failure');
  expect(JSON.stringify(committed)).toBe(old);expect(published).toBe(0);
  await apply();expect(published).toBe(1);
  expect(committed.classes[0].assessmentEvidenceV1?.documents[0].document.evidence.length).toBe(boardDocument.evidence.length+1);
 });
 test('teacher-facing panel exists but does not auto-create proof, and renders privacy-disabled state',()=>{
  const c=fixture();
  const html=renderToStaticMarkup(React.createElement(DailyCriterionRecorder,{
   currentClass:c,settings:settings as AppSettings,date:'2026-11-21',
   isPrivacyShieldActive:false,externalBusy:false,
   onBusyChange:()=>{},onRegisterDraftGuard:()=>{},
   onSave:async()=>({revisionId:'unreachable'})
  }));
  expect(html).toContain('Rileva evidenza per criterio');
  expect(html).toContain('Attiva la protezione dei nominativi');
  expect(html).not.toContain('Schema con relazioni motivate');
  expect(html).not.toContain('Fittizio s1');
 });
 test('real App uses the same durable mutation coordinator and protects pending and draft navigation',()=>{
  const appCode=readFileSync('src/App.tsx','utf8');
  const daily=readFileSync('src/components/DailyMatrixWorkspace.tsx','utf8');
  const ui=readFileSync('src/components/DailyCriterionRecorder.tsx','utf8');
  expect(appCode).toContain('deriveConfirmedEvidenceMutation(current,scopes,scope,reviewed,confirmation).appData');
  expect(appCode).toContain('const result=await commitAppDataMutation(current=>');
  expect(appCode).toContain('onSaveCriterionEvidence={handleSaveCriterionEvidence}');
  expect(daily).toContain('criterionDraftGuardRef.current?.hasUnsavedChanges()');
  expect(daily).toContain('onSave={onSaveCriterionEvidence}');
  expect(ui).toContain('previewIndividualObservation(context.document,context.scope,request)');
  expect(ui).toContain('const receipt=await onSave(context.scope');
  expect(ui).toContain('onBusyChange(true)');
  expect(ui).not.toContain('localStorage');
  expect(ui).not.toContain('fetch(');
 });
});
