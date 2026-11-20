import {describe,expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {createFinalDocumentReview} from '../documents/finalDocumentReview';
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

const input=()=>{
 const a=make();const {scope,classes,bindings,modelSelection,period}=a;
 const ls={institutionRef:scope.institutionRef,cohortRef:scope.cohortRef,classId:scope.classId,schoolYear:scope.schoolYear,subjectCode:scope.subjectCode,gradeLevel:scope.gradeLevel,periodStart:period.from,periodEnd:period.to};
 const lessons=[{id:'demo-lesson',date:'2026-11-17',hours:1.5},{id:'demo-second',date:'2026-11-18',hours:2}];
 return {mode:'SYNTHETIC_ONLY',scope,classes,bindings,modelSelection,period,
 recorded:{records:[{id:'demo-uda',className:'2C',lessons}],selection:{confirmedByTeacher:true,scope:ls,lessons:lessons.map(l=>({udaId:'demo-uda',lessonId:l.id,date:l.date,hours:l.hours}))}},
 assessment:{graph:a.graph,selection:a.selection},
 selection:{confirmedByTeacher:true,scope,period,topics:[{lessonId:'demo-lesson',title:'Attività dimostrativa'}],links:[{lessonId:'demo-lesson',revisionId:'demo-completed'}],summary:[{section:'methodologies',text:'Metodo dimostrativo'}]}};
};
const review=(x:unknown=input())=>createFinalDocumentReview(x);
describe('DOC-01/D3c final documentation',()=>{
 test('separates recorded activities, actual assessments and teacher synthesis, without double counting',()=>{
  const r=review();if(!r.valid)throw Error(r.issue);const p=r.review.presentation;
  expect(p).toMatchObject({official:false,complete:false,coverage:'selected-only',recorded:{status:'selected',count:2,hours:3.5,activities:[{date:'2026-11-17',hours:1.5,title:'Attività dimostrativa'},{date:'2026-11-18',hours:2,title:null}]},assessments:{status:'selected',completed:[{title:'Verifica dimostrativa',completedOn:'2026-11-17'}]},links:[{activityIndex:0,assessmentIndex:0}],summary:[{section:'methodologies',text:'Metodo dimostrativo'}]});
  expect(JSON.stringify(p)).not.toMatch(/demo-|Seconda verifica|Criterio dimostrativo|Livello dimostrativo|plannedDate/);
 });
 test('missing sources are null, never zero or inferred completion',()=>{
  const x=input();const r=review({...x,recorded:null,assessment:null,selection:{...x.selection,topics:[],links:[]}});
  if(!r.valid)throw Error(r.issue);expect(r.review.presentation.recorded).toEqual({status:'not-selected',count:null,hours:null,activities:[]});expect(r.review.presentation.assessments).toEqual({status:'not-selected',completed:[]});
 });
 test('planned-only definitions are not completed evidence',()=>{
  const x=input();const r=review({...x,assessment:{...x.assessment,selection:{...x.assessment.selection,completedRevisionIds:[]}},selection:{...x.selection,links:[]}});
  if(!r.valid)throw Error(r.issue);expect(r.review.presentation.assessments).toEqual({status:'not-selected',completed:[]});
 });
 test('rejects mismatched scope, stale lessons and assessment revisions',()=>{
  const x=input();for(const v of [{...x,scope:{...x.scope,cohortRef:'other'}},{...x,recorded:{...x.recorded,records:[]}},{...x,assessment:{...x.assessment,selection:{...x.assessment.selection,completedRevisionIds:['demo-planned']}}},{...x,selection:{...x.selection,confirmedByTeacher:false}}])expect(review(v).valid).toBe(false);
 });
 test('only explicit same-day links to selected completed assessments, no duplicate links or topics',()=>{
  const x=input();for(const p of [{links:[{lessonId:'demo-second',revisionId:'demo-completed'}]},{links:[{lessonId:'demo-lesson',revisionId:'demo-other'}]},{links:[...x.selection.links,...x.selection.links]},{topics:[...x.selection.topics,...x.selection.topics]},{topics:[{lessonId:'unknown',title:'Test'}]}])expect(review({...x,selection:{...x.selection,...p}}).valid).toBe(false);
  const r=review({...x,selection:{...x.selection,links:[]}});if(!r.valid)throw Error(r.issue);expect(r.review.presentation.links).toEqual([]);
 });
 test('rejects personal-shaped input and unauthorized summary categories',()=>{
  const x=input();for(const v of [{...x,students:[]},{...x,mode:'PRODUCTION'},{...x,assessment:{...x.assessment,graph:{...x.assessment.graph,evidence:[]}}},{...x,selection:{...x.selection,summary:[{section:'student-profile',text:'Test'}]}},{...x,selection:{...x.selection,summary:[{section:'methodologies',text:'Test',studentId:'x'}]}}])expect(review(v).valid).toBe(false);
 });
 test('re-review after edits to sources or explicit synthesis; output immutable',()=>{
  const x=input();const r=review(x);if(!r.valid)throw Error(r.issue);expect(r.review.confirm(structuredClone(x))).toEqual({valid:true,confirmed:true,official:false,complete:false});
  expect(r.review.isCurrent({...x,selection:{...x.selection,summary:[{section:'methodologies',text:'Modificato'}]}})).toBe(false);
  expect(r.review.isCurrent({...x,recorded:{...x.recorded,records:[]}})).toBe(false);
  expect(r.review.isCurrent({...x,assessment:{...x.assessment,graph:{...x.assessment.graph,criteria:x.assessment.graph.criteria.map(c=>({...c,description:'Modificato'}))}}})).toBe(false);
  expect(Object.isFrozen(r.review.presentation.recorded.activities[0])).toBe(true);
 });
 test('no production wiring',()=>{for(const path of ['src/App.tsx','src/main.tsx','src/components/documents/UnifiedDocumentPreview.tsx'])expect(readFileSync(path,'utf8')).not.toContain('createFinalDocumentReview');});
});
