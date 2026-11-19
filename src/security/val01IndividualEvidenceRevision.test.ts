// VAL-01/S6b.2 — corrections and withdrawals of synthetic observations.
import {describe,expect,test} from 'bun:test';
import {previewEvidenceRevision,confirmEvidenceRevision} from '../assessment/individualEvidenceRevision';
import {projectIndividualAssessmentEvidence} from '../assessment/assessmentEvidenceProjection';
import {validateAssessmentEvidenceV1} from '../assessment/assessmentEvidence';
const scope={classId:'class-synthetic',schoolYear:'2026/2027',subjectCode:'TECH',studentIds:['s1','s2']};
const stamp='2026-11-20T10:00:00.000Z',recordedAt='2026-11-21T09:00:00.000Z';
const original={confirmedByTeacher:true,confirmedAt:stamp},confirmation={confirmedByTeacher:true,confirmedAt:'2026-11-21T09:30:00.000Z'};
const source={kind:'local',sourceVersion:'v1'};
const fact={kind:'product',description:'Schema delle fasi',method:'elaborato'};
function fixture():any{
 const a={...original,assessmentId:'a',revisionId:'a1',date:'2026-11-20',period:'Q1',title:'Prova sintetica',purpose:'formative',status:'completed',completedOn:'2026-11-20',source:{kind:'explicit-activity',activityId:'activity'},
 criteria:[{criterionRevisionId:'c1',rubricRevisionId:'r1',expected:fact}]};
 const e={...original,evidenceId:'e1',revisionId:'e1-r1',observationEventId:'event1',assessmentRevisionId:'a1',studentId:'s1',criterionRevisionId:'c1',observedOn:'2026-11-20',recordedAt:stamp,state:'observed',fact:{...fact},interpretation:{kind:'pending'}};
 return {version:1,classId:scope.classId,schoolYear:scope.schoolYear,subjectCode:scope.subjectCode,
 references:[{...original,referenceId:'o',revisionId:'o1',kind:'specific-objective',text:'Rappresentare le fasi',source}],
 criteria:[{...original,criterionId:'c',revisionId:'c1',description:'Relazioni',targetReferenceRevisionIds:['o1'],contextualReferenceRevisionIds:[]}],
 rubrics:[{...original,rubricId:'r',revisionId:'r1',source,criteria:[{criterionRevisionId:'c1',levels:[{levelId:'l1',label:'Coerente',description:'Relazioni motivate'}]}]}],
 assessments:[a],evidence:[e]};
}
const request=():any=>({action:'correct',evidenceRevisionId:'e1-r1',revisionId:'e1-r2',recordedAt,state:'observed',fact:{...fact,description:'Schema con tre relazioni'},interpretation:{kind:'level',levelId:'l1'}});
const withdraw=():any=>({action:'withdraw',evidenceRevisionId:'e1-r1',revisionId:'e1-r2',recordedAt,reason:'Rilevazione attribuita erroneamente'});
const preview=(d:any,r:any=request(),s:any=scope)=>previewEvidenceRevision(d,s,r);
function review(d:any,r:any=request()):any{const p=preview(d,r);if(!p.valid)throw Error(p.issue);return p.preview;}
const confirm=(d:any,p:any=review(d),c:any=confirmation,s:any=scope)=>confirmEvidenceRevision(d,s,p,c);
function append(d:any,r:any=request()):any{const c=confirm(d,review(d,r));if(!c.valid)throw Error(c.issue);d.evidence.push(c.evidence);return c.evidence;}
const project=(d:any)=>projectIndividualAssessmentEvidence(d,scope,'s1');
describe('VAL-01/S6b.2 — correzione e ritiro espliciti',()=>{
 test('corrects content with same identity and an append-only revision',()=>{
  const d=fixture(),before=structuredClone(d),p=review(d);const c=confirm(d,p);if(!c.valid)throw Error(c.issue);
  expect(c.evidence).toEqual({...d.evidence[0],...confirmation,revisionId:'e1-r2',supersedesRevisionId:'e1-r1',recordedAt,fact:request().fact,interpretation:request().interpretation});
  expect(d).toEqual(before);expect(validateAssessmentEvidenceV1({...d,evidence:[...d.evidence,c.evidence]},scope).valid).toBe(true);
  expect(p.scope.studentIds).toBeUndefined();expect(p.request.confirmedByTeacher).toBeUndefined();
 });
 test('projection counts only the active revision and keeps historical record unchanged',()=>{
  const d=fixture(),old=structuredClone(d.evidence[0]);append(d);
  expect(d.evidence[0]).toEqual(old);expect(project(d)).toMatchObject({entries:[{evidenceRevisionId:'e1-r2',state:'observed'}],counts:{observed:1,notObserved:0,notApplicable:0}});
 });
 test('motivated withdrawal excludes the active evidence without deleting history',()=>{
  const d=fixture(),old=structuredClone(d.evidence[0]),e=append(d,withdraw());
  expect(e).toMatchObject({state:'withdrawn',reason:withdraw().reason,evidenceId:'e1',supersedesRevisionId:'e1-r1'});
  expect(e.fact).toBeUndefined();expect(e.interpretation).toBeUndefined();expect(d.evidence[0]).toEqual(old);
  expect(project(d)).toMatchObject({entries:[],counts:{observed:0,notObserved:0,notApplicable:0}});
 });
 test('withdrawn revision is terminal; old revision is stale',()=>{
  const d=fixture();append(d,withdraw());
  expect(preview(d)).toEqual({valid:false,issue:'STALE_REVISION'});
  expect(preview(d,{...request(),evidenceRevisionId:'e1-r2',revisionId:'e1-r3'})).toEqual({valid:false,issue:'WITHDRAWN'});
 });
 test('no-op correction is rejected even with reordered nested fields',()=>{
  const d=fixture(),r=request();r.fact={method:fact.method,description:fact.description,kind:fact.kind};r.interpretation={kind:'pending'};
  expect(preview(d,r)).toEqual({valid:false,issue:'INVALID_CHANGE'});
 });
 test('non-observed and non-applicable are separate, carry no interpretation',()=>{
  const d=fixture(),base={action:'correct',evidenceRevisionId:'e1-r1',revisionId:'e1-r2',recordedAt};
  const n=append(d,{...base,state:'not_observed'});expect(n.fact).toBeUndefined();expect(n.interpretation).toBeUndefined();
  expect(project(d)).toMatchObject({counts:{observed:0,notObserved:1,notApplicable:0}});
  append(d,{...base,evidenceRevisionId:'e1-r2',revisionId:'e1-r3',recordedAt:'2026-11-21T09:30:00.000Z',state:'not_applicable'});
  expect(project(d)).toMatchObject({counts:{observed:0,notObserved:0,notApplicable:1}});
 });
 test('a missing observation can be corrected only with explicit fact and interpretation',()=>{
  const d=fixture();d.evidence[0].state='not_observed';delete d.evidence[0].fact;delete d.evidence[0].interpretation;
  expect(preview(d,{...request(),fact:undefined})).toEqual({valid:false,issue:'INVALID_CHANGE'});
  const e=append(d);expect(e.state).toBe('observed');expect(e.fact.description).toBe(request().fact.description);
 });
 test('rejects incompatible levels and descriptive interpretations with rubric',()=>{
  const d=fixture();for(const interpretation of [{kind:'level',levelId:'foreign'},{kind:'description',description:'Descrizione'}]){
   expect(preview(d,{...request(),interpretation})).toEqual({valid:false,issue:'INVALID_CHANGE'});
  }
  delete d.assessments[0].criteria[0].rubricRevisionId;
  expect(preview(d,{...request(),interpretation:{kind:'description',description:'Descrizione esplicita'}}).valid).toBe(true);
 });
 test('same historical criterion/rubric remains in force after new curriculum and assessment revision',()=>{
  const d=fixture(),p=review(d);
  d.references.push({...d.references[0],revisionId:'o2',supersedesRevisionId:'o1'});
  d.rubrics.push({...d.rubrics[0],revisionId:'r2',supersedesRevisionId:'r1'});
  d.assessments.push({...d.assessments[0],revisionId:'a2',supersedesRevisionId:'a1'});
  const c=confirm(d,p);if(!c.valid)throw Error(c.issue);expect(c.evidence.assessmentRevisionId).toBe('a1');expect(p.rubric.revisionId).toBe('r1');
 });
 test('rejects stale review after competing correction or altered frozen content',()=>{
  const d=fixture(),p=review(d);append(d);expect(confirm(d,p)).toEqual({valid:false,issue:'STALE_REVISION'});
  const d2=fixture(),p2=review(d2);d2.rubrics[0].criteria[0].levels[0].label='Diverso';
  expect(confirm(d2,p2)).toEqual({valid:false,issue:'STALE_PREVIEW'});
 });
 test('rejects scope changes and duplicated revision IDs',()=>{
  const d=fixture(),p=review(d),other={...scope,classId:'other'};
  expect(preview(d,request(),other)).toEqual({valid:false,issue:'INVALID_DOCUMENT'});
  expect(confirm({...d,classId:'other'},p,confirmation,other)).toEqual({valid:false,issue:'STALE_PREVIEW'});
  for(const revisionId of ['o1','c1','r1','a1','e1-r1'])expect(preview(d,{...request(),revisionId})).toEqual({valid:false,issue:'CONFLICT'});
 });
 test('rejects changes to identity, observation date, grade, missing-state outcome or withdrawal with no reason',()=>{
  const d=fixture();for(const extra of [{studentId:'s2'},{observationEventId:'another'},{observedOn:'2026-11-21'},{grade:8},{assessmentRevisionId:'a2'}]){
   expect(preview(d,{...request(),...extra})).toEqual({valid:false,issue:'INVALID_REQUEST'});
  }
  expect(preview(d,{...request(),state:'not_observed'})).toEqual({valid:false,issue:'INVALID_REQUEST'});
  expect(preview(d,{...withdraw(),reason:' '})).toEqual({valid:false,issue:'INVALID_CHANGE'});
 });
 test('explicit confirmation and monotonic correction chronology required',()=>{
  const d=fixture(),p=review(d);
  expect(preview(d,{...request(),recordedAt:'2026-11-19T10:00:00.000Z'})).toEqual({valid:false,issue:'INVALID_CHANGE'});
  for(const c of [null,{...confirmation,confirmedByTeacher:false},{...confirmation,confirmedAt:stamp},{...confirmation,extra:true}]){
   expect(confirm(d,p,c)).toEqual({valid:false,issue:'INVALID_CONFIRMATION'});
  }
 });
 test('rejects getter without invoking; detached result cannot alter source',()=>{
  const d=fixture(),r=request();let invoked=false;Object.defineProperty(r,'fact',{enumerable:true,get(){invoked=true;return fact;}});
  expect(preview(d,r)).toEqual({valid:false,issue:'INVALID_REQUEST'});expect(invoked).toBe(false);
  const p=review(d);p.previous.fact.description='Altro';expect(d.evidence[0].fact.description).toBe(fact.description);
  expect(confirm(d,p)).toEqual({valid:false,issue:'STALE_PREVIEW'});
 });
});
