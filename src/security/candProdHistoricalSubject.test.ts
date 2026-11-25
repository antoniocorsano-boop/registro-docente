import {describe,expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
import type {AppData,ClassData} from '../types';
import {boardDocument,boardScope} from '../../tests/browser/fixtures/val01-s6c-data';
import {resolveApprovedAssessmentScopes} from '../assessment/approvedAssessmentScopes';
import {validateAssessmentArchiveV1} from '../assessment/assessmentArchive';
import {readStudentCriterionEvidence} from '../assessment/studentCriterionReadModel';
import {resolveDailyCriterionRecordingContext} from '../assessment/dailyCriterionRecordingContext';
import {previewIndividualObservation} from '../assessment/individualObservation';
import {deriveConfirmedEvidenceMutation} from '../assessment/assessmentEvidenceMutation';
import {previewDailyAssessmentSetup,deriveConfirmedDailyAssessmentSetup,type AssessmentSetupRequest} from '../assessment/dailyAssessmentSetup';
import {listDailyPlannedProofs,previewDailyPlannedCompletion,deriveConfirmedDailyPlannedCompletion} from '../assessment/dailyPlannedAssessmentCompletion';

const settings={year:boardScope.schoolYear,subject:'Tecnologia'};
const planning={profiles:[],masterPrograms:[],classInstances:[]};
const canonical={classId:boardScope.classId,schoolYear:boardScope.schoolYear,subjectCode:'tecnologia'};
const historical={...canonical,subjectCode:'Tecnologia'};
const confirmation={confirmedByTeacher:true as const,confirmedAt:'2026-11-21T11:10:00.000Z'};
const completionConfirmation={...confirmation,confirmedAt:'2026-11-21T11:20:00.000Z'};
const request:AssessmentSetupRequest={
 activityId:'r3a-activity',assessmentId:'r3a-proof',plannedRevisionId:'r3a-planned',
 completedRevisionId:'r3a-completed',objectiveId:'r3a-objective',objectiveRevisionId:'r3a-objective-rev',
 title:'Prova sintetica',date:'2026-11-21',period:'Q1',purpose:'formative',
 objectiveText:'Rappresentare un sistema',preparedAt:'2026-11-21T11:00:00.000Z',
 criteria:[{criterionId:'r3a-criterion',revisionId:'r3a-criterion-rev',description:'Descrivere le relazioni',
 expected:{kind:'product',description:'Schema',method:'Elaborato'}}]
};
const observation={
 evidenceId:'r3a-evidence',revisionId:'r3a-revision',observationEventId:'r3a-event',
 assessmentRevisionId:'a2',criterionRevisionId:'c1',studentId:'s4',
 observedOn:'2026-11-21',recordedAt:'2026-11-21T11:00:00.000Z',state:'observed',
 fact:{kind:'product',description:'Schema sintetico',method:'Elaborato'},interpretation:{kind:'pending'}
};
function app(codes:readonly string[]=['Tecnologia']):AppData{
 const c:ClassData={id:boardScope.classId,name:'Classe sintetica',
 students:boardScope.studentIds.map(id=>({id,name:'Alunno sintetico '+id})),grades:[],behaviors:[]};
 if(codes.length)c.assessmentEvidenceV1={version:1,documents:codes.map(subjectCode=>({
  document:{...structuredClone(boardDocument),subjectCode},bindings:[]}))};
 return {classes:[c],currentClassId:c.id};
}
const scopes=(data:AppData)=>resolveApprovedAssessmentScopes(data,planning,settings);
function plannedReview(data:AppData){
 const p=previewDailyAssessmentSetup(data.classes[0],settings,request,'planned',scopes(data));
 if(!p.valid)throw Error('Preview rejected');
 return p.review;
}
function completedReview(data:AppData){
 const p=previewDailyPlannedCompletion(data.classes[0],settings,{
 assessmentRevisionId:request.plannedRevisionId,revisionId:request.completedRevisionId,
 completedOn:request.date},scopes(data));
 if(!p.valid)throw Error('Completion preview rejected');
 return p.review;
}
function observationReview(data:AppData){
 const context=resolveDailyCriterionRecordingContext(data.classes[0],settings,scopes(data));
 if(context.status!=='ready')throw Error('Recording context rejected');
 const p=previewIndividualObservation(context.document,context.scope,observation);
 if(!p.valid)throw Error('Observation preview rejected');
 return {scope:context.scope,reviewed:{kind:'new' as const,preview:p.preview}};
}
describe('CAND-PROD-01/R3a — exact historical identity in the current discipline',()=>{
 test('validated historical dossier and completed-proof selection remain visible without rewriting',()=>{
  const data=app(),before=structuredClone(data),approved=scopes(data);
  expect(approved).toEqual([canonical,historical]);
  expect(validateAssessmentArchiveV1(data,approved).valid).toBe(true);
  const dossier=readStudentCriterionEvidence(data.classes[0],settings,'s1',approved);
  expect(dossier.status).toBe('ready');
  if(dossier.status!=='ready')throw Error('Historical dossier hidden');
  expect(dossier.rows.map(row=>row.revisionId)).toEqual(['r-1']);
  const context=resolveDailyCriterionRecordingContext(data.classes[0],settings,approved);
  expect(context.status).toBe('ready');
  if(context.status!=='ready')throw Error('Historical recording context hidden');
  expect(context.scope.subjectCode).toBe('Tecnologia');
  expect(context.assessments.map(a=>a.assessmentRevisionId)).toEqual(['a2']);
  expect(readStudentCriterionEvidence(data.classes[0],settings,'s1').status).toBe('ready');
  expect(resolveDailyCriterionRecordingContext(data.classes[0],settings).status).toBe('ready');
  expect(data).toEqual(before);
 });
 test('confirmed criterion observation appends only to the original historical document',()=>{
  const data=app(),before=structuredClone(data),r=observationReview(data);
  const next=deriveConfirmedEvidenceMutation(data,scopes(data),r.scope,r.reviewed,confirmation).appData;
  const documents=next.classes[0].assessmentEvidenceV1!.documents;
  expect(documents).toHaveLength(1);
  expect(documents[0].document.subjectCode).toBe('Tecnologia');
  expect(documents[0].document.evidence.slice(0,-1)).toEqual(boardDocument.evidence);
  expect(documents[0].document.evidence.at(-1)?.revisionId).toBe('r3a-revision');
  expect(next.classes[0].grades).toEqual(data.classes[0].grades);
  expect(data).toEqual(before);
 });
 test('preparation and completion reuse the historical identity, preserving the original graph',()=>{
  const data=app(),before=structuredClone(data),review=plannedReview(data);
  expect(review.scope.subjectCode).toBe('Tecnologia');
  const scheduled=deriveConfirmedDailyAssessmentSetup(data,scopes(data),review,confirmation);
  const list=listDailyPlannedProofs(scheduled.classes[0],settings,scopes(scheduled));
  expect(list.status).toBe('ready');
  if(list.status!=='ready')throw Error('Historical planned proof hidden');
  expect(list.scope.subjectCode).toBe('Tecnologia');
  expect(list.proofs.map(p=>p.revisionId)).toEqual([request.plannedRevisionId]);
  const completed=deriveConfirmedDailyPlannedCompletion(scheduled,scopes(scheduled),completedReview(scheduled),completionConfirmation);
  const documents=completed.classes[0].assessmentEvidenceV1!.documents;
  expect(documents).toHaveLength(1);
  const d=documents[0].document;
  expect(d.subjectCode).toBe('Tecnologia');
  expect(d.evidence).toEqual(boardDocument.evidence);
  expect(d.assessments.slice(0,boardDocument.assessments.length)).toEqual(boardDocument.assessments);
  expect(d.assessments.at(-1)?.revisionId).toBe(request.completedRevisionId);
  expect(d.assessments.at(-1)?.status).toBe('completed');
  expect(d.references.slice(0,boardDocument.references.length)).toEqual(boardDocument.references);
  expect(d.criteria.slice(0,boardDocument.criteria.length)).toEqual(boardDocument.criteria);
  expect(d.rubrics).toEqual(boardDocument.rubrics);
  expect(data).toEqual(before);
 });
 test('a historical planned proof is selectable before any new proof is created',()=>{
  const data=app();
  data.classes[0].assessmentEvidenceV1={version:1,documents:[{document:{
   ...boardDocument,subjectCode:'Tecnologia',assessments:[boardDocument.assessments[0]],evidence:[]
  },bindings:[]}]};
  const approved=scopes(data);
  expect(validateAssessmentArchiveV1(data,approved).valid).toBe(true);
  const list=listDailyPlannedProofs(data.classes[0],settings,approved);
  expect(list.status).toBe('ready');
  if(list.status==='ready')expect(list.proofs.map(p=>p.revisionId)).toEqual(['a1']);
 });
 test('a genuinely absent archive creates a canonical document; a canonical archive stays canonical',()=>{
  const initial=app([]),review=plannedReview(initial);
  expect(review.scope.subjectCode).toBe('tecnologia');
  expect(review.baseDocument).toBeNull();
  const next=deriveConfirmedDailyAssessmentSetup(initial,scopes(initial),review,confirmation);
  expect(next.classes[0].assessmentEvidenceV1!.documents[0].document.subjectCode).toBe('tecnologia');
  const canonicalData=app(['tecnologia']);
  expect(readStudentCriterionEvidence(canonicalData.classes[0],settings,'s1',scopes(canonicalData)).status).toBe('ready');
  expect(plannedReview(canonicalData).scope.subjectCode).toBe('tecnologia');
 });
 test('two individually valid aliases are ambiguous; no selection or new proof is authorized',()=>{
  const data=app(['Tecnologia','tecnologia']),approved=scopes(data),before=structuredClone(data);
  expect(validateAssessmentArchiveV1(data,approved).valid).toBe(true);
  expect(readStudentCriterionEvidence(data.classes[0],settings,'s1',approved).status).toBe('unverified');
  expect(resolveDailyCriterionRecordingContext(data.classes[0],settings,approved).status).toBe('unverified');
  expect(listDailyPlannedProofs(data.classes[0],settings,approved).status).toBe('unverified');
  expect(previewDailyAssessmentSetup(data.classes[0],settings,request,'planned',approved).valid).toBe(false);
  expect(data).toEqual(before);
 });
 test('exact independent approval is mandatory; other opaque codes and years are not aliases',()=>{
  const data=app(),klass=data.classes[0];
  expect(readStudentCriterionEvidence(klass,settings,'s1',[canonical]).status).toBe('unverified');
  expect(resolveDailyCriterionRecordingContext(klass,settings,[canonical]).status).toBe('unverified');
  expect(listDailyPlannedProofs(klass,settings,[canonical]).status).toBe('unverified');
  expect(previewDailyAssessmentSetup(klass,settings,request,'planned',[canonical]).valid).toBe(false);
  const opaque=app(['TECH']),opaqueApproved=[canonical,{...canonical,subjectCode:'TECH'}];
  expect(readStudentCriterionEvidence(opaque.classes[0],settings,'s1',opaqueApproved).status).toBe('absent');
  expect(resolveDailyCriterionRecordingContext(opaque.classes[0],settings,opaqueApproved).status).toBe('absent');
  expect(listDailyPlannedProofs(opaque.classes[0],settings,opaqueApproved).status).toBe('absent');
  expect(readStudentCriterionEvidence(klass,{...settings,year:'2027/2028'},'s1',[canonical,historical]).status).toBe('unverified');
 });
 test('ambiguity added between preview and confirmation blocks each durable derive without mutation',()=>{
  const data=app(),review=plannedReview(data),ob=observationReview(data);
  const ambiguous=app(['Tecnologia','tecnologia']),before=structuredClone(ambiguous);
  expect(()=>deriveConfirmedDailyAssessmentSetup(ambiguous,scopes(ambiguous),review,confirmation)).toThrow();
  expect(()=>deriveConfirmedEvidenceMutation(ambiguous,scopes(ambiguous),ob.scope,ob.reviewed,confirmation)).toThrow();
  expect(ambiguous).toEqual(before);
  const scheduled=deriveConfirmedDailyAssessmentSetup(data,scopes(data),review,confirmation);
  const planned=completedReview(scheduled);
  const envelope=scheduled.classes[0].assessmentEvidenceV1!;
  scheduled.classes[0].assessmentEvidenceV1={...envelope,documents:[...envelope.documents,{document:{...boardDocument,subjectCode:'tecnologia'},bindings:[]}]};
  const snapshot=structuredClone(scheduled);
  expect(()=>deriveConfirmedDailyPlannedCompletion(scheduled,scopes(scheduled),planned,completionConfirmation)).toThrow();
  expect(scheduled).toEqual(snapshot);
 });
 test('App current-context checks recognize the explicit alias but receipt lookup retains exact identity',()=>{
  const source=readFileSync('src/App.tsx','utf8');
  expect(source.split('!sameAssessmentSubject(scope.subjectCode,subjectCode)').length-1).toBe(3);
  expect(source.split('subjectCode===scope.subjectCode').length-1).toBeGreaterThanOrEqual(3);
 });
});
