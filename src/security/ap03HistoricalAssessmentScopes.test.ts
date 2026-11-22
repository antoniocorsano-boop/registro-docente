// AUDIT-PRE-01 / AP-03 — synthetic authority and lifecycle regression.
import {describe,expect,test} from 'bun:test';
import type {AppData,ClassData} from '../types';
import type {PlanningState} from '../planning/types';
import {boardDocument,boardScope} from '../../tests/browser/fixtures/val01-s6c-data';
import {resolveApprovedAssessmentScopes} from '../assessment/approvedAssessmentScopes';
import {validateAssessmentArchiveV1} from '../assessment/assessmentArchive';
import {previewDailyAssessmentSetup,deriveConfirmedDailyAssessmentSetup,type AssessmentSetupRequest}
 from '../assessment/dailyAssessmentSetup';
import {listDailyPlannedProofs} from '../assessment/dailyPlannedAssessmentCompletion';
import {resolveDailyCriterionRecordingContext} from '../assessment/dailyCriterionRecordingContext';

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
  for(const scopes of [badClass,badAdoption,wrongDiscipline]){
   expect(scopes).toEqual([current]);
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
  expect(JSON.stringify(data.classes[0].assessmentEvidenceV1)).toBe(oldSnapshot);
 });
 test('current read surfaces treat fully authorized historical-only archives as absent, not damaged',()=>{
  const c=classroom(),authorized=resolveApprovedAssessmentScopes({classes:[c]},planning(),settings);
  expect(listDailyPlannedProofs(c,settings,authorized)).toEqual({status:'absent'});
  expect(resolveDailyCriterionRecordingContext(c,settings,authorized)).toEqual({status:'absent'});
  expect(listDailyPlannedProofs(c,settings,[current]).status).toBe('unverified');
  expect(resolveDailyCriterionRecordingContext(c,settings,[current]).status).toBe('unverified');
 });
 test('scope authority does not change when the historical document forges its subject',()=>{
  const data=app(),authorized=resolveApprovedAssessmentScopes(data,planning(),settings);
  data.classes[0].assessmentEvidenceV1!.documents[0].document.subjectCode='MATH';
  expect(resolveApprovedAssessmentScopes(data,planning(),settings)).toEqual(authorized);
  expect(validateAssessmentArchiveV1(data,authorized).valid).toBe(false);
 });
});
