// AUDIT-PRE-01 / AP-03 — synthetic authority and lifecycle regression.
import {describe,expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
import type {AppData,ClassData} from '../types';
import type {PlanningState} from '../planning/types';
import {boardDocument,boardScope} from '../../tests/browser/fixtures/val01-s6c-data';
import {resolveApprovedAssessmentScopes} from '../assessment/approvedAssessmentScopes';
import {canonicalAssessmentSchoolYear} from '../assessment/assessmentSchoolYear';
import {validateAssessmentArchiveV1} from '../assessment/assessmentArchive';
import {previewDailyAssessmentSetup,deriveConfirmedDailyAssessmentSetup,type AssessmentSetupRequest}
 from '../assessment/dailyAssessmentSetup';
import {listDailyPlannedProofs} from '../assessment/dailyPlannedAssessmentCompletion';
import {resolveDailyCriterionRecordingContext} from '../assessment/dailyCriterionRecordingContext';
import {readStudentCriterionEvidence} from '../assessment/studentCriterionReadModel';

const older={classId:boardScope.classId,schoolYear:boardScope.schoolYear,subjectCode:boardScope.subjectCode};
const current={classId:boardScope.classId,schoolYear:'2027/2028',subjectCode:'TECH'};
const settings={year:current.schoolYear,subject:current.subjectCode};
const confirmation={confirmedByTeacher:true as const,confirmedAt:'2027-11-21T10:03:00.000Z'};
const oldDoc=()=>structuredClone(boardDocument);
const classroom=():ClassData=>({
 id:boardScope.classId,name:'Classe sintetica multiennale',
 students:boardScope.studentIds.map(id=>({id,name:'Studente sintetico '+id})),grades:[],behaviors:[],
 assessmentEvidenceV1:{version:1,documents:[{document:oldDoc(),bindings:[]}]}
});
const app=():AppData=>({classes:[classroom()],currentClassId:boardScope.classId});
function planning(status:'approved'|'draft'='approved',instanceClass=boardScope.classId,
 adopted='version-h',subject=boardScope.subjectCode):PlanningState{
 return {profiles:[{id:'profile-h',schoolYear:older.schoolYear,subjectCode:subject}],
  masterPrograms:[{id:'master-h',profileId:'profile-h',status,currentVersionId:'version-h'}],
  classInstances:[{id:'instance-h',classId:instanceClass,masterProgramId:'master-h',adoptedVersionId:adopted}]} as unknown as PlanningState;
}
const request=():AssessmentSetupRequest=>({
 activityId:'ap03-act-new',assessmentId:'ap03-assess-new',
 plannedRevisionId:'ap03-planned-new',completedRevisionId:'ap03-done-new',
 objectiveId:'ap03-obj-new',objectiveRevisionId:'ap03-objrev-new',
 title:'Prova dell’anno corrente',date:'2027-11-21',period:'Q1',purpose:'formative',
 objectiveText:'Rappresentare un sistema',preparedAt:'2027-11-21T10:00:00.000Z',
 criteria:[{criterionId:'ap03-crit-new',revisionId:'ap03-critrev-new',
  description:'Rappresenta relazioni',expected:{kind:'product',description:'Schema originale',method:'Elaborato'}}]
});
describe('AUDIT-PRE-01 / AP-03 — independently approved historical contexts',()=>{

 test('F3-CPL-01 current teacher year is canonical across all four assessment flows',()=>{
  const original=app(),before=JSON.stringify(original),sourcePlanning=planning();
  const savedPlanning=JSON.stringify(sourcePlanning);
  for(const year of ['2027/28','2027-2028','2027/2028','2027 / 2028']){
   const alternative={...settings,year},beforeSettings=JSON.stringify(alternative);
   const approved=resolveApprovedAssessmentScopes(original,sourcePlanning,alternative);
   expect(canonicalAssessmentSchoolYear(year)).toBe('2027/2028');
   expect(approved).toEqual([current,older]);
   expect(validateAssessmentArchiveV1(original,approved)).toEqual({valid:true,state:'present'});
   const preview=previewDailyAssessmentSetup(original.classes[0],alternative,request(),'completed',approved);
   expect(preview.valid).toBe(true);
   if(!preview.valid)throw Error('Current assessment context denied');
   expect(preview.review.scope.schoolYear).toBe(current.schoolYear);
   const next=deriveConfirmedDailyAssessmentSetup(original,approved,preview.review,confirmation);
   expect(validateAssessmentArchiveV1(next,approved)).toEqual({valid:true,state:'present'});
   expect(next.classes[0].assessmentEvidenceV1?.documents[0].document)
    .toEqual(original.classes[0].assessmentEvidenceV1?.documents[0].document);
   expect(next.classes[0].assessmentEvidenceV1?.documents[1].document.schoolYear).toBe(current.schoolYear);
   expect(listDailyPlannedProofs(next.classes[0],alternative,approved).status).toBe('ready');
   expect(resolveDailyCriterionRecordingContext(next.classes[0],alternative,approved).status).toBe('ready');
   expect(readStudentCriterionEvidence(next.classes[0],alternative,'s1',approved).status).toBe('ready');
   expect(JSON.stringify(alternative)).toBe(beforeSettings);
  }
  expect(JSON.stringify(original)).toBe(before);
  expect(JSON.stringify(sourcePlanning)).toBe(savedPlanning);
 });
 test('F3-CPL-01 invalid years or unapproved scopes fail closed without altering source',()=>{
  const original=app(),before=JSON.stringify(original);
  for(const year of ['2027/29','2027-2029','2027/2027','2027-2026','2027','unexpected']){
   expect(canonicalAssessmentSchoolYear(year)).toBeNull();
   const alternative={...settings,year};
   const approved=resolveApprovedAssessmentScopes(original,planning(),alternative);
   expect(approved).toEqual([]);
   expect(previewDailyAssessmentSetup(original.classes[0],alternative,request(),'completed',approved).valid).toBe(false);
   expect(listDailyPlannedProofs(original.classes[0],alternative,approved).status).toBe('unverified');
   expect(resolveDailyCriterionRecordingContext(original.classes[0],alternative,approved).status).toBe('unverified');
   expect(readStudentCriterionEvidence(original.classes[0],alternative,'s1',approved).status).toBe('unverified');
  }
  expect(previewDailyAssessmentSetup(original.classes[0],{...settings,year:'2027/28'},request(),'completed',[]).valid).toBe(false);
  expect(JSON.stringify(original)).toBe(before);
 });
 test('F3-CPL-01 App comparisons use canonical scope year and preserve raw settings-change guard',()=>{
  const source=readFileSync('src/App.tsx','utf8');
  expect(source.split('scope.schoolYear!==canonicalAssessmentSchoolYear(approvedSettings.year)').length-1).toBe(3);
  expect(source.split('settingsRef.current.year!==approvedSettings.year').length-1).toBe(3);
 });

 test('teacher settings and an adopted approved planning profile authorize separate years without reading document scope',()=>{
  const data=app(),before=structuredClone(data);
  const approved=resolveApprovedAssessmentScopes(data,planning(),settings);
  expect(approved).toEqual([current,older]);
  expect(validateAssessmentArchiveV1(data,approved)).toEqual({valid:true,state:'present'});
  expect(data).toEqual(before);
 });
 test('unlinked historical document cannot self-authorize, even if valid, complete and signed by teacher',()=>{
  const data=app();
  const onlyCurrent=resolveApprovedAssessmentScopes(data,planning('draft'),settings);
  expect(onlyCurrent).toEqual([current]);
  expect(validateAssessmentArchiveV1(data,onlyCurrent)).toEqual({valid:false,issue:'INVALID_SCOPE'});
  expect(previewDailyAssessmentSetup(data.classes[0],settings,request(),'completed',onlyCurrent).valid).toBe(false);
  const badClass=resolveApprovedAssessmentScopes(data,planning('approved','foreign'),settings);
  const badAdoption=resolveApprovedAssessmentScopes(data,planning('approved',boardScope.classId,'wrong-version'),settings);
  const wrongDiscipline=resolveApprovedAssessmentScopes(data,planning('approved',boardScope.classId,'version-h','MATH'),settings);
  expect(badClass).toEqual([current]);
  expect(badAdoption).toEqual([current]);
  expect(wrongDiscipline).toEqual([current,{...older,subjectCode:'MATH'}]);
  for(const scopes of [badClass,badAdoption,wrongDiscipline]){
   expect(validateAssessmentArchiveV1(data,scopes).valid).toBe(false);
  }
 });
 test('current setup appends a new document and preserves historical proof byte for byte',()=>{
  const data=app(),oldSnapshot=JSON.stringify(data.classes[0].assessmentEvidenceV1);
  const approved=resolveApprovedAssessmentScopes(data,planning(),settings);
  const preview=previewDailyAssessmentSetup(data.classes[0],settings,request(),'completed',approved);
  expect(preview.valid).toBe(true);
  if(!preview.valid)throw Error('Authorized current preview was rejected');
  expect(preview.review.baseDocument).toBeNull();
  const next=deriveConfirmedDailyAssessmentSetup(data,approved,preview.review,confirmation);
  const docs=next.classes[0].assessmentEvidenceV1?.documents;
  expect(docs).toHaveLength(2);
  expect(JSON.stringify({version:1,documents:[docs![0]]})).toBe(oldSnapshot);
  expect(docs![1].document.schoolYear).toBe(current.schoolYear);
  expect(docs![1].document.assessments.map(a=>a.status)).toEqual(['planned','completed']);
  expect(validateAssessmentArchiveV1(next,approved)).toEqual({valid:true,state:'present'});
  expect(listDailyPlannedProofs(next.classes[0],settings,approved).status).toBe('ready');
  expect(resolveDailyCriterionRecordingContext(next.classes[0],settings,approved).status).toBe('ready');
  expect(readStudentCriterionEvidence(next.classes[0],settings,'s1',approved).status).toBe('ready');
  expect(JSON.stringify(data.classes[0].assessmentEvidenceV1)).toBe(oldSnapshot);
 });
 test('current read surfaces treat fully authorized historical-only archives as absent, not damaged',()=>{
  const c=classroom(),authorized=resolveApprovedAssessmentScopes({classes:[c]},planning(),settings);
  expect(listDailyPlannedProofs(c,settings,authorized)).toEqual({status:'absent'});
  expect(resolveDailyCriterionRecordingContext(c,settings,authorized)).toEqual({status:'absent'});
  expect(readStudentCriterionEvidence(c,settings,'s1',authorized)).toEqual({status:'absent'});
  expect(listDailyPlannedProofs(c,settings,[current]).status).toBe('unverified');
  expect(resolveDailyCriterionRecordingContext(c,settings,[current]).status).toBe('unverified');
 });
 test('scope authority does not change when the historical document forges its subject',()=>{
  const data=app(),authorized=resolveApprovedAssessmentScopes(data,planning(),settings);
  (data.classes[0].assessmentEvidenceV1!.documents[0].document as unknown as {subjectCode:string}).subjectCode='MATH';
  expect(resolveApprovedAssessmentScopes(data,planning(),settings)).toEqual(authorized);
  expect(validateAssessmentArchiveV1(data,authorized).valid).toBe(false);
 });

 test('approved historical planning years normalize slash-short and dash-long formats without rewriting source',()=>{
  const original=app(),before=JSON.stringify(original);
  for(const schoolYear of ['2026/27','2026-2027','2026 / 2027']){
   const source=planning();
   const adapted:PlanningState={...source,
    profiles:source.profiles.map(p=>({...p,schoolYear}))};
   const saved=JSON.stringify(adapted);
   const scopes=resolveApprovedAssessmentScopes(original,adapted,settings);
   expect(scopes).toEqual([current,older]);
   expect(validateAssessmentArchiveV1(original,scopes)).toEqual({valid:true,state:'present'});
   expect(JSON.stringify(adapted)).toBe(saved);
  }
  for(const schoolYear of ['2026/28','2026-2028','2026/2026','2026-2025']){
   const source=planning();
   const adapted:PlanningState={...source,
    profiles:source.profiles.map(p=>({...p,schoolYear}))};
   const scopes=resolveApprovedAssessmentScopes(original,adapted,settings);
   expect(scopes).toEqual([current]); // A malformed profile cannot grant authority.
   expect(validateAssessmentArchiveV1(original,scopes)).toEqual({valid:false,issue:'INVALID_SCOPE'});
  }
  expect(JSON.stringify(original)).toBe(before);
 });
 test('multiple classes retain full-archive validation while all four class readers accept their scoped approvals',()=>{
  const data=app();
  const second:ClassData={id:'class-second',name:'Seconda classe sintetica',
   students:[{id:'other-student',name:'Studente sintetico seconda classe'}],
   grades:[],behaviors:[]};
  data.classes.push(second);
  const approved=resolveApprovedAssessmentScopes(data,planning(),settings);
  expect(approved.some(scope=>scope.classId===second.id)).toBe(true);
  expect(approved.filter(scope=>scope.classId===boardScope.classId)).toEqual([current,older]);
  expect(validateAssessmentArchiveV1(data,approved)).toEqual({valid:true,state:'present'});
  // Reproduce Copilot's original false rejection without relaxing the validator.
  expect(validateAssessmentArchiveV1({classes:[data.classes[0]]},approved))
   .toEqual({valid:false,issue:'INVALID_SCOPE'});
  const preview=previewDailyAssessmentSetup(data.classes[0],settings,request(),'completed',approved);
  expect(preview.valid).toBe(true);
  if(!preview.valid)throw Error('Multi-class preview denied despite independent scopes');
  const updated=deriveConfirmedDailyAssessmentSetup(data,approved,preview.review,confirmation);
  expect(validateAssessmentArchiveV1(updated,approved)).toEqual({valid:true,state:'present'});
  expect(updated.classes[1]).toEqual(second);
  expect(listDailyPlannedProofs(updated.classes[0],settings,approved).status).toBe('ready');
  expect(resolveDailyCriterionRecordingContext(updated.classes[0],settings,approved).status).toBe('ready');
  expect(readStudentCriterionEvidence(updated.classes[0],settings,'s1',approved).status).toBe('ready');
 });
 test('class-scoped filtering cannot grant a foreign scope or bypass a corrupt second class at commit',()=>{
  const data=app();
  data.classes.push({id:'class-second',name:'Altra classe sintetica',
   students:[{id:'other-student',name:'Altro studente'}],grades:[],behaviors:[]});
  const approved=resolveApprovedAssessmentScopes(data,planning(),settings);
  const foreign=approved.filter(scope=>scope.classId==='class-second');
  expect(previewDailyAssessmentSetup(data.classes[0],settings,request(),'completed',foreign).valid).toBe(false);
  expect(listDailyPlannedProofs(data.classes[0],settings,foreign).status).toBe('unverified');
  expect(resolveDailyCriterionRecordingContext(data.classes[0],settings,foreign).status).toBe('unverified');
  expect(readStudentCriterionEvidence(data.classes[0],settings,'s1',foreign).status).toBe('unverified');
  const preview=previewDailyAssessmentSetup(data.classes[0],settings,request(),'completed',approved);
  expect(preview.valid).toBe(true);
  if(!preview.valid)throw Error('Expected authorized synthetic review');
  const damaged=structuredClone(data);
  damaged.classes[1].assessmentEvidenceV1={version:1,documents:[]};
  expect(validateAssessmentArchiveV1(damaged,approved).valid).toBe(false);
  expect(()=>deriveConfirmedDailyAssessmentSetup(damaged,approved,preview.review,confirmation)).toThrow();
 });
});
