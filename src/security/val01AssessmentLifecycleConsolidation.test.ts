// VAL-01/S6-C — end-to-end local synthetic lifecycle. No production persistence.
import {describe,expect,test} from 'bun:test';
import {listAssessmentPreparationOptions} from '../assessment/assessmentPreparationOptions';
import {previewAssessmentDefinition,confirmAssessmentDefinition} from '../assessment/assessmentDefinitionPreparation';
import {previewAssessmentCompletion,confirmAssessmentCompletion} from '../assessment/assessmentCompletion';
import {previewIndividualObservation,confirmIndividualObservation} from '../assessment/individualObservation';
import {previewEvidenceRevision,confirmEvidenceRevision} from '../assessment/individualEvidenceRevision';
import {projectIndividualAssessmentEvidence} from '../assessment/assessmentEvidenceProjection';
import {validateAssessmentEvidenceV1} from '../assessment/assessmentEvidence';
const scope={classId:'synthetic-class',schoolYear:'2026/2027',subjectCode:'TECH',studentIds:['s1','s2','s3']};
const confirm=(confirmedAt:string)=>({confirmedByTeacher:true,confirmedAt});
const source={kind:'local',sourceVersion:'v1'};
const start=confirm('2026-11-18T08:00:00.000Z');
const expected={kind:'product',description:'Schema previsto',method:'elaborato'};
const fact={kind:'product',description:'Schema con relazioni effettivamente osservate',method:'elaborato'};
function fixture():any{return {version:1,classId:scope.classId,schoolYear:scope.schoolYear,subjectCode:scope.subjectCode,
 references:[{...start,referenceId:'o',revisionId:'o1',kind:'specific-objective',text:'Rappresentare la filiera',source}],
 criteria:[{...start,criterionId:'c',revisionId:'c1',description:'Relazioni tra fasi',targetReferenceRevisionIds:['o1'],contextualReferenceRevisionIds:[]}],
 rubrics:[{...start,rubricId:'r',revisionId:'r1',source,criteria:[{criterionRevisionId:'c1',levels:[{levelId:'l1',label:'Coerente',description:'Relazioni motivate'}]}]}],
 assessments:[],evidence:[]};}
function ok<T extends {valid:boolean}>(r:T):Extract<T,{valid:true}>{expect(r.valid).toBe(true);if(!r.valid)throw Error(JSON.stringify(r));return r as Extract<T,{valid:true}>;}
function plan(d:any,withRubric=true,title='Filiera sintetica'){
 const options=ok(listAssessmentPreparationOptions(d,scope,'activity'));
 expect(options.existing).toBeNull();expect(options.criteria).toHaveLength(1);
 const req={activityId:'activity',assessmentId:'a',revisionId:'a1',date:'2026-11-19',period:'Q1',title,purpose:'formative',
 criteria:[{criterionRevisionId:'c1',...(withRubric?{rubricRevisionId:'r1'}:{}),expected}]};
 const preview=ok(previewAssessmentDefinition(d,scope,req)).preview;
 d.assessments.push(ok(confirmAssessmentDefinition(d,scope,preview,confirm('2026-11-18T09:00:00.000Z'))).definition);
}
function complete(d:any){
 const p=ok(previewAssessmentCompletion(d,scope,{assessmentRevisionId:'a1',revisionId:'a2',completedOn:'2026-11-20'})).preview;
 d.assessments.push(ok(confirmAssessmentCompletion(d,scope,p,confirm('2026-11-20T10:00:00.000Z'))).definition);
}
function request(extra:Record<string,unknown>={}):any{return {evidenceId:'e1',revisionId:'e1-r1',observationEventId:'event1',assessmentRevisionId:'a2',studentId:'s1',criterionRevisionId:'c1',observedOn:'2026-11-20',recordedAt:'2026-11-20T10:30:00.000Z',state:'observed',fact,interpretation:{kind:'pending'},...extra};}
function observe(d:any,r=request()){
 const p=ok(previewIndividualObservation(d,scope,r)).preview;
 const e=ok(confirmIndividualObservation(d,scope,p,confirm('2026-11-20T11:00:00.000Z'))).evidence;d.evidence.push(e);return e;
}
function revise(d:any,r:any,at='2026-11-21T10:00:00.000Z'){
 const p=ok(previewEvidenceRevision(d,scope,r)).preview;
 const e=ok(confirmEvidenceRevision(d,scope,p,confirm(at))).evidence;d.evidence.push(e);return e;
}
const project=(d:any,student='s1')=>ok(projectIndividualAssessmentEvidence(d,scope,student));
const valid=(d:any)=>expect(validateAssessmentEvidenceV1(d,scope).valid).toBe(true);
describe('VAL-01/S6-C — ciclo valutativo cumulativo',()=>{
 test('catalogue → planned → completed → observation → correction → withdrawal; historical identity unchanged',()=>{
  const d=fixture();plan(d);valid(d);expect(d.evidence).toEqual([]);
  expect(previewIndividualObservation(d,scope,request({assessmentRevisionId:'a1'}))).toEqual({valid:false,issue:'INVALID_STATUS'});
  complete(d);valid(d);expect(d.assessments.map((a:any)=>a.status)).toEqual(['planned','completed']);
  expect(d.assessments[1].date).toBe('2026-11-19');expect(d.assessments[1].completedOn).toBe('2026-11-20');
  const original=observe(d);const snapshot=structuredClone(original);valid(d);
  const corrected=revise(d,{action:'correct',evidenceRevisionId:'e1-r1',revisionId:'e1-r2',recordedAt:'2026-11-21T09:00:00.000Z',state:'observed',fact,interpretation:{kind:'level',levelId:'l1'}});
  expect(corrected).toMatchObject({evidenceId:'e1',observationEventId:'event1',assessmentRevisionId:'a2',supersedesRevisionId:'e1-r1'});
  expect(d.evidence[0]).toEqual(snapshot);expect(project(d).counts.observed).toBe(1);
  revise(d,{action:'withdraw',evidenceRevisionId:'e1-r2',revisionId:'e1-r3',recordedAt:'2026-11-21T10:30:00.000Z',reason:'Rilevazione da ritirare'},'2026-11-21T11:00:00.000Z');
  valid(d);expect(d.evidence).toHaveLength(3);expect(project(d).entries).toEqual([]);
  expect(previewIndividualObservation(d,scope,request({evidenceId:'e2',revisionId:'e2-r1'}))).toEqual({valid:false,issue:'CONFLICT'});
 });
 test('simulated exam without rubric: observed, explicitly not observed, and absent record stay distinct',()=>{
  const d=fixture();plan(d,false,'Simulazione d’esame sintetica');complete(d);
  observe(d,request({interpretation:{kind:'description',description:'Argomentazione pertinente'}}));
  const missing=request({evidenceId:'e2',revisionId:'e2-r1',studentId:'s2',state:'not_observed'});
  delete missing.fact;delete missing.interpretation;observe(d,missing);valid(d);
  expect(project(d,'s1').counts).toEqual({observed:1,notObserved:0,notApplicable:0});
  expect(project(d,'s2').counts).toEqual({observed:0,notObserved:1,notApplicable:0});
  expect(project(d,'s3').entries).toEqual([]);expect(project(d,'s3').coverage).toBe('undetermined');
 });
 test('historical rubric survives catalogue change; stale competing correction cannot append',()=>{
  const d=fixture();plan(d);complete(d);
  d.references.push({...d.references[0],revisionId:'o2',supersedesRevisionId:'o1'});
  d.rubrics.push({...d.rubrics[0],revisionId:'r2',supersedesRevisionId:'r1'});
  observe(d,request({interpretation:{kind:'level',levelId:'l1'}}));
  const req={action:'correct',evidenceRevisionId:'e1-r1',revisionId:'e1-r2',recordedAt:'2026-11-21T09:00:00.000Z',state:'not_applicable'};
  const stale=ok(previewEvidenceRevision(d,scope,req)).preview;
  revise(d,{...req,revisionId:'e1-other'});valid(d);
  expect(confirmEvidenceRevision(d,scope,stale,confirm('2026-11-21T10:00:00.000Z'))).toEqual({valid:false,issue:'STALE_REVISION'});
  expect(project(d).counts.notApplicable).toBe(1);
 });
});
