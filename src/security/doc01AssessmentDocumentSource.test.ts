import {describe,expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {createAssessmentDocumentReview} from '../documents/assessmentDocumentSource';
import type {AssessmentEvidenceV1,AssessmentDefinitionRevision} from '../assessment/assessmentEvidence';

const timestamp='2026-11-01T10:00:00.000Z';
const confirmation={confirmedByTeacher:true as const,confirmedAt:timestamp};
const make=(grade=2,purpose='disciplinary-plan')=>{
 const scope={institutionRef:'demo-school',siteRef:'demo-site',classId:'demo-class',cohortRef:'demo-cohort',schoolYear:'2026/2027',schoolOrder:'lower_secondary',gradeLevel:grade,subjectCode:'tecnologia',regimeRef:'demo-regime',purpose};
 const model=purpose==='council-contribution'?'council-contribution':grade===1?'disciplinary-first':'disciplinary-second-third';
 const binding={model,version:'2026-27-map-v1',institutionRef:scope.institutionRef,siteRef:scope.siteRef,cohortRef:scope.cohortRef,schoolYear:scope.schoolYear,schoolOrder:scope.schoolOrder,gradeLevel:grade,regimeRef:scope.regimeRef,referenceStatus:'reviewed-reference'};
 const period={from:'2026-09-01',to:'2027-08-31'};
 const expected={kind:'product' as const,description:'Prodotto dimostrativo atteso',method:'Analisi della rappresentazione'};
 const planned:AssessmentDefinitionRevision={...confirmation,revisionId:'demo-planned',assessmentId:'demo-assessment-one',date:'2026-11-15',period:'Q1',title:'Verifica dimostrativa',purpose:'formative',status:'planned',source:{kind:'explicit-activity',activityId:'demo-activity-one'},criteria:[{criterionRevisionId:'demo-criterion-rev',rubricRevisionId:'demo-rubric-rev',expected}]};
 const completed:AssessmentDefinitionRevision={...confirmation,confirmedAt:'2026-11-17T10:00:00.000Z',revisionId:'demo-completed',supersedesRevisionId:'demo-planned',assessmentId:planned.assessmentId,date:planned.date,period:planned.period,title:planned.title,purpose:planned.purpose,status:'completed',completedOn:'2026-11-17',source:planned.source,criteria:planned.criteria};
 const other:AssessmentDefinitionRevision={...planned,revisionId:'demo-other',assessmentId:'demo-assessment-two',title:'Seconda verifica dimostrativa',source:{kind:'explicit-activity',activityId:'demo-activity-two'},date:'2027-03-01',period:'Q2'};
 const cancelled:AssessmentDefinitionRevision={...planned,revisionId:'demo-cancelled',assessmentId:'demo-assessment-three',source:{kind:'explicit-activity',activityId:'demo-activity-three'},status:'cancelled'};
 const graph:Omit<AssessmentEvidenceV1,'evidence'>={version:1,classId:scope.classId,schoolYear:scope.schoolYear,subjectCode:scope.subjectCode,references:[{...confirmation,revisionId:'demo-reference-rev',referenceId:'demo-reference',kind:'specific-objective',text:'Obiettivo locale dimostrativo',source:{kind:'local',sourceVersion:'demo-version'}}],criteria:[{...confirmation,revisionId:'demo-criterion-rev',criterionId:'demo-criterion',description:'Criterio dimostrativo',targetReferenceRevisionIds:['demo-reference-rev'],contextualReferenceRevisionIds:[]}],rubrics:[{...confirmation,revisionId:'demo-rubric-rev',rubricId:'demo-rubric',source:{kind:'local',sourceVersion:'demo-version'},criteria:[{criterionRevisionId:'demo-criterion-rev',levels:[{levelId:'demo-level',label:'Livello dimostrativo',description:'Descrizione riservata al criterio'}]}]}],assessments:[planned,completed,other,cancelled]};
 const selection={confirmedByTeacher:true,scope,period,expectedRevisionIds:['demo-completed','demo-other'],completedRevisionIds:['demo-completed']};
 return {mode:'SYNTHETIC_ONLY',scope,classes:[{id:scope.classId,name:grade+'C'}],bindings:[binding],modelSelection:{confirmedByTeacher:true,scope,model,version:binding.version},period,graph,selection};
};
const review=(input:unknown=make())=>createAssessmentDocumentReview(input);
describe('DOC-01/D3a professional assessment definitions, never individual evidence',()=>{
 test('separates expected definitions from explicitly completed assessment and actual dates',()=>{
  const r=review();expect(r.valid).toBe(true);if(!r.valid)throw Error('review');
  const p=r.review.presentation;
  expect(p).toMatchObject({official:false,complete:false,coverage:'selected-only',labOnly:true,expected:[{title:'Verifica dimostrativa',purpose:'formative',criteria:[{criterion:'Criterio dimostrativo',kind:'product',description:'Prodotto dimostrativo atteso',method:'Analisi della rappresentazione'}]},{title:'Seconda verifica dimostrativa'}],completed:[{title:'Verifica dimostrativa',purpose:'formative',completedOn:'2026-11-17'}]});
  expect(p.completed[0]).not.toHaveProperty('plannedDate');
  expect(p.completed[0]).not.toHaveProperty('criteria');
  expect(JSON.stringify(p)).not.toMatch(/demo-|Livello dimostrativo|Descrizione riservata|Obiettivo locale|studentId|observation|grade|recordedHours/);
  expect(p.lessonLink).toBe('not-established');
  expect(p.assessmentMethods).toBe('teacher-review-required');
  expect(p.institutionalDescriptors).toBe('reference-only');
 });
 test('first, second/third and council are support only, never institution criteria or decisions',()=>{
  for(const [grade,purpose] of [[1,'disciplinary-plan'],[2,'disciplinary-plan'],[3,'disciplinary-plan'],[2,'council-contribution']] as const){
   const r=review(make(grade,purpose));if(!r.valid)throw Error('review');
   expect(r.review.presentation.institutionalDescriptors).toBe(grade>1&&purpose==='disciplinary-plan'?'reference-only':'not-in-model');
   expect(r.review.presentation.assessmentMethods).toBe('teacher-review-required');
   expect(r.review.presentation.official).toBe(false);
  }
 });
 test('rejects an entire individual evidence graph, roster or non-lab input before content is read',()=>{
  const input=make();
  for(const x of [{...input,mode:'PRODUCTION'},{...input,graph:{...input.graph,evidence:[]}},{...input,graph:{...input.graph,studentIds:[]}},{...input,students:[]}])expect(review(x).valid).toBe(false);
  let accessed=false;const graph={...input.graph};Object.defineProperty(graph,'evidence',{enumerable:true,get(){accessed=true;return [];}});
  expect(review({...input,graph}).valid).toBe(false);expect(accessed).toBe(false);
 });
 test('requires exact context, model, year and explicit selection; graph must pass native validation',()=>{
  const input=make();
  for(const x of [{...input,bindings:[]},{...input,graph:{...input.graph,subjectCode:'matematica'}},{...input,graph:{...input.graph,schoolYear:'2027/2028'}},{...input,graph:{...input.graph,criteria:[]}},{...input,selection:{...input.selection,confirmedByTeacher:false}},{...input,selection:{...input.selection,scope:{...input.scope,cohortRef:'other'}}}])expect(review(x).valid).toBe(false);
 });
 test('rejects stale planned revisions, cancelled assessment, duplicate or planned-as-completed',()=>{
  const input=make();
  for(const patch of [{expectedRevisionIds:['demo-planned']},{expectedRevisionIds:['demo-cancelled']},{expectedRevisionIds:['demo-other','demo-other']},{completedRevisionIds:['demo-other']},{completedRevisionIds:['demo-planned']},{completedRevisionIds:['demo-cancelled']}])expect(review({...input,selection:{...input.selection,...patch}}).valid).toBe(false);
 });
 test('uses explicit dates, not inferred terms; actual and planned dates may differ',()=>{
  const input=make();const period={from:'2026-11-17',to:'2026-11-17'};
  const r=review({...input,period,selection:{...input.selection,period,expectedRevisionIds:[]}});
  if(!r.valid)throw Error('review');
  expect(r.review.presentation.completed.length).toBe(1);expect(r.review.presentation.expected).toEqual([]);
  expect(review({...input,period,selection:{...input.selection,period}}).valid).toBe(false);
  const invalidPeriod={from:'2026-01-01',to:'2026-11-30'};
  expect(review({...input,period:invalidPeriod,selection:{...input.selection,period:invalidPeriod}}).valid).toBe(false);
 });
 test('partial selection is not annual coverage and empty is not a zero result',()=>{
  const input=make();const r=review({...input,selection:{...input.selection,expectedRevisionIds:['demo-other'],completedRevisionIds:[]}});
  if(!r.valid)throw Error('review');
  expect(r.review.presentation.completed).toEqual([]);expect(r.review.presentation.coverage).toBe('selected-only');
  expect(review({...input,selection:{...input.selection,expectedRevisionIds:[],completedRevisionIds:[]}}).valid).toBe(false);
 });
 test('re-review on changes of criterion, rubric, source, selection, date or current revision',()=>{
  const input=make();const r=review(input);if(!r.valid)throw Error('review');
  expect(r.review.confirm(structuredClone(input))).toEqual({valid:true,confirmed:true,official:false,complete:false});
  for(const next of [
   {...input,graph:{...input.graph,criteria:input.graph.criteria.map(c=>({...c,description:'Criterio modificato'}))}},
   {...input,graph:{...input.graph,rubrics:input.graph.rubrics.map(v=>({...v,source:{...v.source,sourceVersion:'demo-new'}}))}},
   {...input,graph:{...input.graph,assessments:input.graph.assessments.map(a=>a.revisionId==='demo-completed'?{...a,completedOn:'2026-11-18'}:a)}},
   {...input,selection:{...input.selection,expectedRevisionIds:['demo-other']}},
   {...input,graph:{...input.graph,assessments:[...input.graph.assessments,{...input.graph.assessments[2],revisionId:'demo-other-next',supersedesRevisionId:'demo-other'}]}},
  ])expect(r.review.isCurrent(next)).toBe(false);
  expect(r.review.confirm({...input,mode:'PRODUCTION'})).toEqual({valid:false});
 });
 test('detaches inputs and protects review from mutation; no production wiring',()=>{
  const input=make();const r=review(input);if(!r.valid)throw Error('review');
  expect(Object.isFrozen(r.review.presentation.expected[0].criteria[0])).toBe(true);
  expect(Object.isFrozen(r.review.presentation.completed)).toBe(true);
  const mutable=structuredClone(input.graph.assessments[2]);(mutable as {title:string}).title='Modificato';
  expect(r.review.isCurrent({...input,graph:{...input.graph,assessments:input.graph.assessments.map(a=>a.revisionId==='demo-other'?mutable:a)}})).toBe(false);
  for(const path of ['src/App.tsx','src/main.tsx','src/components/documents/UnifiedDocumentPreview.tsx'])expect(readFileSync(path,'utf8')).not.toContain('createAssessmentDocumentReview');
 });
});
