// VAL-01/S6b.1 — synthetic observations, no actual student records.
import {describe,expect,test} from 'bun:test';
import {previewIndividualObservation,confirmIndividualObservation} from '../assessment/individualObservation';
import {validateAssessmentEvidenceV1} from '../assessment/assessmentEvidence';
import {projectIndividualAssessmentEvidence} from '../assessment/assessmentEvidenceProjection';
const scope={classId:'class-synthetic',schoolYear:'2026/2027',subjectCode:'TECH',studentIds:['s1','s2']};
const original={confirmedByTeacher:true,confirmedAt:'2026-11-18T09:00:00.000Z'};
const completed={confirmedByTeacher:true,confirmedAt:'2026-11-20T10:00:00.000Z'};
const confirmation={confirmedByTeacher:true,confirmedAt:'2026-11-20T11:00:00.000Z'};
const source={kind:'local',sourceVersion:'v1'};
function fixture():any{
 const a={...original,assessmentId:'a',revisionId:'a1',date:'2026-11-19',period:'Q1',title:'Filiera sintetica',purpose:'formative',status:'planned',source:{kind:'explicit-activity',activityId:'activity1'},
 criteria:[{criterionRevisionId:'c1',rubricRevisionId:'r1',expected:{kind:'product',description:'Schema atteso',method:'elaborato'}}]};
 return {version:1,classId:scope.classId,schoolYear:scope.schoolYear,subjectCode:scope.subjectCode,
 references:[{...original,referenceId:'o',revisionId:'o1',kind:'specific-objective',text:'Rappresentare la filiera',source}],
 criteria:[{...original,criterionId:'c',revisionId:'c1',description:'Relazioni tra fasi',targetReferenceRevisionIds:['o1'],contextualReferenceRevisionIds:[]}],
 rubrics:[{...original,rubricId:'r',revisionId:'r1',source,criteria:[{criterionRevisionId:'c1',levels:[{levelId:'l1',label:'Coerente',description:'Collegamenti motivati'}]}]}],
 assessments:[a,{...a,...completed,revisionId:'a2',supersedesRevisionId:'a1',status:'completed',completedOn:'2026-11-20'}],evidence:[]};
}
const identity=()=>({evidenceId:'e1',revisionId:'e1-r1',observationEventId:'event1',assessmentRevisionId:'a2',studentId:'s1',criterionRevisionId:'c1',observedOn:'2026-11-20',recordedAt:'2026-11-20T10:30:00.000Z'});
const request=():any=>({...identity(),state:'observed',fact:{kind:'product',description:'Collega tre fasi con frecce',method:'elaborato'},interpretation:{kind:'pending'}});
function review(d:any=fixture(),r:any=request(),s:any=scope):any{const p=previewIndividualObservation(d,s,r);if(!p.valid)throw Error(p.issue);return p.preview;}
const confirm=(d:any,p:any=review(d),c:any=confirmation,s:any=scope)=>confirmIndividualObservation(d,s,p,c);
function add(d:any,r:any=request()):any{const c=confirm(d,review(d,r));if(!c.valid)throw Error(c.issue);d.evidence.push(c.evidence);return c.evidence;}
const project=(d:any,student='s1')=>projectIndividualAssessmentEvidence(d,scope,student);
describe('VAL-01/S6b.1 — nuove evidenze individuali',()=>{
 test('explicit fact without grade, pending interpretation and detached preview',()=>{
  const d=fixture(),before=structuredClone(d),r=request(),p=review(d,r);
  expect(p.request).toEqual(r);expect(p.request.confirmedByTeacher).toBeUndefined();expect(p.scope.studentIds).toBeUndefined();
  expect(p.assessment.criteria[0].expected.description).toBe('Schema atteso');
  expect(p.request.fact.description).not.toBe(p.assessment.criteria[0].expected.description);
  const c=confirm(d,p);if(!c.valid)throw Error(c.issue);
  expect(c.evidence).toEqual({...r,...confirmation});expect(c.evidence.state).toBe('observed');
  expect(validateAssessmentEvidenceV1({...d,evidence:[c.evidence]},scope).valid).toBe(true);
  expect(d).toEqual(before);expect(project(d)).toMatchObject({counts:{observed:0,notObserved:0,notApplicable:0}});
 });
 test('explicit compatible level and frozen rubric',()=>{
  const d=fixture(),r=request();r.interpretation={kind:'level',levelId:'l1'};
  const p=review(d,r);expect(p.rubric.revisionId).toBe('r1');const e=add(d,r);expect(e.interpretation).toEqual(r.interpretation);
  expect(project(d)).toMatchObject({counts:{observed:1,notObserved:0,notApplicable:0},coverage:'undetermined'});
 });
 test('pending and descriptive interpretation without rubric; no implied level',()=>{
  const d=fixture();for(const a of d.assessments)delete a.criteria[0].rubricRevisionId;
  const r=request();r.interpretation={kind:'description',description:'Motiva il passaggio principale'};
  expect(review(d,r).rubric).toBeNull();expect(add(d,r).interpretation).toEqual(r.interpretation);
  const r2={...request(),evidenceId:'e2',revisionId:'e2-r1',observationEventId:'event2'};expect(add(d,r2).interpretation).toEqual({kind:'pending'});
 });
 test('rejects unknown level, description with rubric, level without rubric',()=>{
  const d=fixture(),r=request();r.interpretation={kind:'level',levelId:'foreign'};
  expect(previewIndividualObservation(d,scope,r)).toEqual({valid:false,issue:'INVALID_EVIDENCE'});
  r.interpretation={kind:'description',description:'Sintetico'};
  expect(previewIndividualObservation(d,scope,r)).toEqual({valid:false,issue:'INVALID_EVIDENCE'});
  for(const a of d.assessments)delete a.criteria[0].rubricRevisionId;r.interpretation={kind:'level',levelId:'l1'};
  expect(previewIndividualObservation(d,scope,r)).toEqual({valid:false,issue:'INVALID_EVIDENCE'});
 });
 test('not observed and not applicable remain distinct and ungraded',()=>{
  const d=fixture();const n=add(d,{...identity(),state:'not_observed'});
  const a=add(d,{...identity(),evidenceId:'e2',revisionId:'e2-r1',observationEventId:'event2',state:'not_applicable'});
  for(const e of [n,a]){expect(e.fact).toBeUndefined();expect(e.interpretation).toBeUndefined();}
  expect(project(d)).toMatchObject({counts:{observed:0,notObserved:1,notApplicable:1}});
 });
 test('missing states cannot carry outcomes or facts; withdrawn requires separate operation',()=>{
  for(const state of ['not_observed','not_applicable','withdrawn']){
   expect(previewIndividualObservation(fixture(),scope,{...request(),state})).toEqual({valid:false,issue:'INVALID_REQUEST'});
  }
  expect(previewIndividualObservation(fixture(),scope,{...identity(),state:'withdrawn',reason:'Ritiro'})).toEqual({valid:false,issue:'INVALID_REQUEST'});
 });
 test('invalid student, criterion, foreign scope, and uncompleted assessment',()=>{
  const d=fixture();
  expect(previewIndividualObservation(d,scope,{...request(),studentId:'foreign'})).toEqual({valid:false,issue:'INVALID_STUDENT'});
  expect(previewIndividualObservation(d,scope,{...request(),criterionRevisionId:'foreign'})).toEqual({valid:false,issue:'INVALID_CRITERION'});
  expect(previewIndividualObservation(d,{...scope,classId:'foreign'},request())).toEqual({valid:false,issue:'INVALID_DOCUMENT'});
  expect(previewIndividualObservation(d,scope,{...request(),assessmentRevisionId:'a1'})).toEqual({valid:false,issue:'STALE_ASSESSMENT'});
  d.assessments.pop();expect(previewIndividualObservation(d,scope,{...request(),assessmentRevisionId:'a1'})).toEqual({valid:false,issue:'INVALID_STATUS'});
 });
 test('duplicate event, revision and evidence identity are rejected even on retry',()=>{
  const d=fixture(),p=review(d);add(d);
  expect(confirm(d,p)).toEqual({valid:false,issue:'CONFLICT'});
  expect(previewIndividualObservation(d,scope,{...request(),evidenceId:'e2',revisionId:'e2-r1'})).toEqual({valid:false,issue:'CONFLICT'});
  expect(previewIndividualObservation(d,scope,{...request(),observationEventId:'event2',revisionId:'e2-r1'})).toEqual({valid:false,issue:'CONFLICT'});
  expect(previewIndividualObservation(d,scope,{...request(),evidenceId:'e2',observationEventId:'event2'})).toEqual({valid:false,issue:'CONFLICT'});
 });
 test('new same-day event is distinct; common group product never assigns another student',()=>{
  const d=fixture(),r=request();r.fact.productRef='common-product';add(d,r);
  expect(project(d,'s2')).toMatchObject({entries:[],counts:{observed:0,notObserved:0,notApplicable:0}});
  add(d,{...r,evidenceId:'e2',revisionId:'e2-r1',observationEventId:'event2'});
  expect(project(d)).toMatchObject({counts:{observed:2,notObserved:0,notApplicable:0}});
  expect(project(d,'s2')).toMatchObject({entries:[]});
 });
 test('support describes context and does not determine a level',()=>{
  const d=fixture(),r=request();r.fact.support='visual';const e=add(d,r);
  expect(e.fact.support).toBe('visual');expect(e.interpretation).toEqual({kind:'pending'});
 });
 test('later catalogue revision keeps historical criterion, reference and rubric',()=>{
  const d=fixture(),r=request();r.interpretation={kind:'level',levelId:'l1'};const p=review(d,r);
  d.references.push({...d.references[0],revisionId:'o2',supersedesRevisionId:'o1'});
  d.criteria.push({...d.criteria[0],revisionId:'c2',supersedesRevisionId:'c1',targetReferenceRevisionIds:['o2']});
  d.rubrics.push({...d.rubrics[0],revisionId:'r2',supersedesRevisionId:'r1',criteria:[{criterionRevisionId:'c2',levels:[{levelId:'l2',label:'Nuovo',description:'Nuovo descrittore'}]}]});
  const c=confirm(d,p);if(!c.valid)throw Error(c.issue);
  expect(c.evidence.criterionRevisionId).toBe('c1');expect(c.evidence).toMatchObject({interpretation:{kind:'level',levelId:'l1'}});
 });
 test('changed frozen text or superseded assessment invalidates review',()=>{
  const d=fixture(),p=review(d);d.references[0].text='Altro';
  expect(confirm(d,p)).toEqual({valid:false,issue:'STALE_PREVIEW'});
  const d2=fixture(),p2=review(d2);d2.assessments.push({...d2.assessments[1],revisionId:'a3',supersedesRevisionId:'a2'});
  expect(confirm(d2,p2)).toEqual({valid:false,issue:'STALE_ASSESSMENT'});
 });
 test('malformed request, date, chronological and unconfirmed requests fail closed',()=>{
  const d=fixture();
  for(const r of [{...request(),grade:8},{...request(),confirmedByTeacher:true},{...request(),observedOn:'2027-09-01'},{...request(),observedOn:'2026-02-30'}]){
   expect(previewIndividualObservation(d,scope,r)).toEqual({valid:false,issue:'INVALID_REQUEST'});
  }
  expect(previewIndividualObservation(d,scope,{...request(),recordedAt:'2026-11-18T09:00:00.000Z'})).toEqual({valid:false,issue:'INVALID_EVIDENCE'});
  const p=review(d);for(const c of [null,{...confirmation,confirmedByTeacher:false},{...confirmation,confirmedAt:'2026-11-20T10:00:00.000Z'},{...confirmation,extra:true}]){
   expect(confirm(d,p,c)).toEqual({valid:false,issue:'INVALID_CONFIRMATION'});
  }
 });
 test('getter is not invoked; invalid nested fields and missing fact fail closed',()=>{
  const d=fixture(),r=request();let called=false;Object.defineProperty(r,'fact',{enumerable:true,get(){called=true;return {};}});
  expect(previewIndividualObservation(d,scope,r)).toEqual({valid:false,issue:'INVALID_REQUEST'});expect(called).toBe(false);
  const r2=request();r2.fact.description='';expect(previewIndividualObservation(d,scope,r2)).toEqual({valid:false,issue:'INVALID_EVIDENCE'});
  const r3=request();r3.fact.diagnosis='extra';expect(previewIndividualObservation(d,scope,r3)).toEqual({valid:false,issue:'INVALID_EVIDENCE'});
  const p=review(d);p.references[0].text='Changed';expect(d.references[0].text).toBe('Rappresentare la filiera');
  expect(confirm(d,p)).toEqual({valid:false,issue:'STALE_PREVIEW'});
 });
});
