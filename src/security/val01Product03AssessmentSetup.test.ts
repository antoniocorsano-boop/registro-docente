import {describe,expect,test} from 'bun:test';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import type {AppData,AppSettings,ClassData} from '../types';
import type {AssessmentSetupRequest} from '../assessment/dailyAssessmentSetup';
import {previewDailyAssessmentSetup,deriveConfirmedDailyAssessmentSetup} from '../assessment/dailyAssessmentSetup';
import {resolveDailyCriterionRecordingContext} from '../assessment/dailyCriterionRecordingContext';
import {validateAssessmentArchiveV1} from '../assessment/assessmentArchive';
import {validateAssessmentEvidenceV1} from '../assessment/assessmentEvidence';
import {DailyAssessmentSetupPanel} from '../components/DailyAssessmentSetupPanel';
import {readStudentCriterionEvidence} from '../assessment/studentCriterionReadModel';
import {resolveAssessmentSubjectCode} from '../assessment/assessmentSubjectScope';
import {DEFAULT_SETTINGS} from '../utils';
import {createDurableMutationCoordinator} from '../persistence/durableMutationCoordinator';
import {boardScope,boardDocument} from '../../tests/browser/fixtures/val01-s6c-data';

const settings={year:boardScope.schoolYear,subject:boardScope.subjectCode};
const scopes=[{classId:boardScope.classId,schoolYear:boardScope.schoolYear,subjectCode:boardScope.subjectCode}];
const confirmation={confirmedByTeacher:true as const,confirmedAt:'2026-11-21T10:02:00.000Z'};
const request=():AssessmentSetupRequest=>({
 activityId:'p03-activity',assessmentId:'p03-assessment',plannedRevisionId:'p03-planned',
 completedRevisionId:'p03-completed',objectiveId:'p03-objective',objectiveRevisionId:'p03-obj-rev',
 date:'2026-11-21',period:'Q1',purpose:'formative',title:'Prova originale della classe',
 objectiveText:'Progettare un processo',
 preparedAt:'2026-11-21T10:00:00.000Z',
 criteria:[
  {criterionId:'p03-criterion-1',revisionId:'p03-criterion-rev-1',
   description:'Descrive correttamente le fasi',
   expected:{kind:'product',description:'Schema delle fasi',method:'Elaborato originale'}},
  {criterionId:'p03-criterion-2',revisionId:'p03-criterion-rev-2',
   description:'Motiva le scelte tecniche',
   expected:{kind:'argumentation',description:'Motivazione orale',method:'Discussione'}}
 ]
});
const classroom=(withArchive=false):ClassData=>({
 id:boardScope.classId,name:'Classe sintetica',
 students:boardScope.studentIds.map(id=>({id,name:'Alunno di prova '+id})),
 grades:[{id:'old-grade',studentId:'s1',date:'2026-11-20',type:'disegno',period:'Q1',title:'Disegno',value:'10'}],
 behaviors:[],...(withArchive?{assessmentEvidenceV1:{version:1 as const,
  documents:[{document:boardDocument,bindings:[]}]}}:{})
});
const app=(withArchive=false):AppData=>({classes:[classroom(withArchive)],currentClassId:boardScope.classId});
function reviewed(c:ClassData,req=request()){
 const p=previewDailyAssessmentSetup(c,settings,req);
 if(!p.valid)throw Error('Unexpected setup preview: '+p.issue);
 return p.review;
}

describe('VAL-01/PRODUCT-03 — initial proof with explicit objective and criteria',()=>{
 test('actual Registro discipline label resolves to valid local scope across setup, recorder and student dossier',()=>{
  expect(DEFAULT_SETTINGS.subject).toBe('Tecnologia & Disegno Tecnico');
  const subjectCode=resolveAssessmentSubjectCode(DEFAULT_SETTINGS.subject);
  expect(subjectCode).toBe('tecnologia');
  expect(resolveAssessmentSubjectCode('TECH')).toBe('TECH');
  expect(resolveAssessmentSubjectCode('Disciplina non riconosciuta')).toBeNull();
  const c=classroom();
  const p=previewDailyAssessmentSetup(c,DEFAULT_SETTINGS,request());
  expect(p.valid).toBe(true);
  if(!p.valid)throw Error('Default local setup denied');
  expect(p.review.scope.subjectCode).toBe(subjectCode);
  const current=app();
  const approved=[{classId:boardScope.classId,schoolYear:DEFAULT_SETTINGS.year,subjectCode:subjectCode!}];
  const next=deriveConfirmedDailyAssessmentSetup(current,approved,p.review,confirmation);
  const record=next.classes[0];
  const result=resolveDailyCriterionRecordingContext(record,DEFAULT_SETTINGS);
  expect(result.status).toBe('ready');
  const dossier=readStudentCriterionEvidence(record,DEFAULT_SETTINGS,'s1');
  expect(dossier.status).toBe('ready');
  if(dossier.status==='ready')expect(dossier.rows).toHaveLength(0);
 });
 test('first-run preview is detached and never invents evidence from existing grades',()=>{
  const c=classroom(),prior=JSON.stringify(c);
  const review=reviewed(c);
  expect(review.baseDocument).toBeNull();
  expect(review.scope.studentIds).toEqual(boardScope.studentIds);
  expect(JSON.stringify(c)).toBe(prior);
  expect(c.assessmentEvidenceV1).toBeUndefined();
 });
 test('atomic confirmation creates one encrypted-eligible V1 archive and S5b/S6a planned/completed chain',()=>{
  const current=app(),before=JSON.stringify(current),review=reviewed(current.classes[0]);
  const result=deriveConfirmedDailyAssessmentSetup(current,scopes,review,confirmation);
  expect(JSON.stringify(current)).toBe(before);
  expect(result.classes[0].grades).toEqual(current.classes[0].grades);
  expect(result.classes[0].behaviors).toEqual(current.classes[0].behaviors);
  expect(validateAssessmentArchiveV1(result,scopes)).toEqual({valid:true,state:'present'});
  const doc=result.classes[0].assessmentEvidenceV1!.documents[0].document;
  expect(validateAssessmentEvidenceV1(doc,boardScope).valid).toBe(true);
  expect(doc.references).toHaveLength(1);
  expect(doc.criteria).toHaveLength(2);
  expect(doc.assessments).toHaveLength(2);
  expect(doc.assessments.map(a=>a.status)).toEqual(['planned','completed']);
  expect(doc.assessments[1].supersedesRevisionId).toBe('p03-planned');
  expect(doc.evidence).toEqual([]);
  const live=resolveDailyCriterionRecordingContext(result.classes[0],settings);
  expect(live.status).toBe('ready');
  if(live.status==='ready'){
   expect(live.assessments).toHaveLength(1);
   expect(live.assessments[0].criteria).toHaveLength(2);
   expect(live.assessments[0].assessmentRevisionId).toBe('p03-completed');
  }
 });
 test('next proof appends without changing previous frozen evidence, criteria or references',()=>{
  const current=app(true),before=JSON.stringify(boardDocument),review=reviewed(current.classes[0]);
  const next=deriveConfirmedDailyAssessmentSetup(current,scopes,review,confirmation);
  const doc=next.classes[0].assessmentEvidenceV1!.documents[0].document;
  expect(JSON.stringify(boardDocument)).toBe(before);
  expect(doc.references.slice(0,boardDocument.references.length)).toEqual(boardDocument.references);
  expect(doc.criteria.slice(0,boardDocument.criteria.length)).toEqual(boardDocument.criteria);
  expect(doc.assessments.slice(0,boardDocument.assessments.length)).toEqual(boardDocument.assessments);
  expect(doc.evidence).toEqual(boardDocument.evidence);
  expect(doc.assessments.at(-1)?.revisionId).toBe('p03-completed');
 });
 test('replay, stale snapshot, changed roster and unknown context fail closed',()=>{
  const first=app(),r=reviewed(first.classes[0]);
  const after=deriveConfirmedDailyAssessmentSetup(first,scopes,r,confirmation);
  expect(()=>deriveConfirmedDailyAssessmentSetup(after,scopes,r,confirmation)).toThrow();
  expect(()=>deriveConfirmedDailyAssessmentSetup(first,[],r,confirmation)).toThrow();
  const changed=app();changed.classes[0].students.reverse();
  expect(()=>deriveConfirmedDailyAssessmentSetup(changed,scopes,r,confirmation)).toThrow();
  expect(previewDailyAssessmentSetup(classroom(),{...settings,year:'2025/2026'},request()).valid).toBe(false);
  expect(previewDailyAssessmentSetup(classroom(),{...settings,subject:'OTHER'},request()).valid).toBe(true);
  // An isolated new scope can be previewed only when actually approved by teacher;
  // replay into the original approved scope must remain denied.
  const wrong=previewDailyAssessmentSetup(classroom(),{...settings,subject:'OTHER'},request());
  if(wrong.valid)expect(()=>deriveConfirmedDailyAssessmentSetup(first,scopes,wrong.review,confirmation)).toThrow();
 });
 test('invalid dates, blank objectives, duplicate criteria IDs and future confirmation are refused',()=>{
  const badDate={...request(),date:'2027-09-01'};
  expect(previewDailyAssessmentSetup(classroom(),settings,badDate).valid).toBe(false);
  const badObjective={...request(),objectiveText:'   '};
  expect(previewDailyAssessmentSetup(classroom(),settings,badObjective).valid).toBe(false);
  const r=request(),badIds={...r,criteria:[r.criteria[0],{...r.criteria[1],revisionId:r.criteria[0].revisionId}]};
  expect(previewDailyAssessmentSetup(classroom(),settings,badIds).valid).toBe(false);
  const p=reviewed(classroom());
  expect(()=>deriveConfirmedDailyAssessmentSetup(app(),scopes,p,
   {confirmedByTeacher:true,confirmedAt:'2026-11-20T00:00:00.000Z'})).toThrow();
 });
 test('invalid foreign or malformed existing envelope is never overwritten',()=>{
  const c=classroom(true);
  c.assessmentEvidenceV1={version:1,documents:[{document:{...boardDocument,schoolYear:'2025/2026'},bindings:[]}]};
  expect(previewDailyAssessmentSetup(c,settings,request()).valid).toBe(false);
  const corrupt=classroom();(corrupt as unknown as Record<string,unknown>).assessmentEvidenceV1={version:1,documents:[]};
  expect(previewDailyAssessmentSetup(corrupt,settings,request()).valid).toBe(false);
 });
 test('atomic persistence failure never publishes candidate; retry is explicit and serialized',async()=>{
  let committed=app(),publishCount=0,persistCount=0;
  const review=reviewed(committed.classes[0]);
  const original=JSON.stringify(committed);
  const coordinator=createDurableMutationCoordinator();
  const write=()=>coordinator.enqueue({
   getCommitted:()=>committed,
   derive:current=>deriveConfirmedDailyAssessmentSetup(current,scopes,review,confirmation),
   persist:async()=>{persistCount++;if(persistCount===1)throw Error('synthetic atomic abort');},
   publish:next=>{committed=next;publishCount++;}
  });
  await expect(write()).rejects.toThrow('synthetic atomic abort');
  expect(JSON.stringify(committed)).toBe(original);expect(publishCount).toBe(0);
  await write();expect(publishCount).toBe(1);
  expect(committed.classes[0].assessmentEvidenceV1?.documents[0].document.assessments.at(-1)?.status).toBe('completed');
 });
 test('teacher-facing panel renders without student names and requires deliberate review',()=>{
  const html=renderToStaticMarkup(React.createElement(DailyAssessmentSetupPanel,{
   currentClass:classroom(),settings:settings as AppSettings,date:'2026-11-21',
   isPrivacyShieldActive:true,externalBusy:false,onBusyChange:()=>{},onRegisterDraftGuard:()=>{},
   onSave:async()=>({revisionId:'never'})
  }));
  expect(html).toContain('Predisponi prova e criteri');
  expect(html).toContain('Esamina prova e criteri');
  expect(html).toContain('Obiettivo di apprendimento');
  expect(html).not.toContain('Alunno di prova');
  const shielded=renderToStaticMarkup(React.createElement(DailyAssessmentSetupPanel,{
   currentClass:classroom(),settings:settings as AppSettings,date:'2026-11-21',
   isPrivacyShieldActive:false,externalBusy:false,onBusyChange:()=>{},onRegisterDraftGuard:()=>{},
   onSave:async()=>({revisionId:'never'})
  }));
  expect(shielded).toContain('Attiva la protezione dei nominativi');
  expect(shielded).not.toContain('Titolo prova con criteri');
 });
 test('the production UI uses the same encrypted coordinator, not a second vault or synthetic host',()=>{
  const appCode=readFileSync('src/App.tsx','utf8');
  const daily=readFileSync('src/components/DailyMatrixWorkspace.tsx','utf8');
  const ui=readFileSync('src/components/DailyAssessmentSetupPanel.tsx','utf8');
  const domain=readFileSync('src/assessment/dailyAssessmentSetup.ts','utf8');
  expect(domain).toContain('previewAssessmentDefinition(');
  expect(domain).toContain('confirmAssessmentDefinition(');
  expect(domain).toContain('previewAssessmentCompletion(');
  expect(domain).toContain('confirmAssessmentCompletion(');
  expect(appCode).toContain('deriveConfirmedDailyAssessmentSetup(current,approved,reviewed,confirmation)');
  expect(appCode).toContain('onSaveAssessmentSetup={handleSaveAssessmentSetup}');
  expect(daily).toContain('setupDraftGuardRef.current?.hasUnsavedChanges()');
  expect(daily).toContain('<DailyAssessmentSetupPanel');
  expect(ui).toContain('previewDailyAssessmentSetup(currentClass,settings,request)');
  expect(ui).toContain('const receipt=await onSave(reviewed');
  expect(ui).not.toContain('localStorage');
  expect(ui).not.toContain('fetch(');
 });
});
