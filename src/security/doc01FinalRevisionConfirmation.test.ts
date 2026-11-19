import {describe,expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {createFinalRevisionReview} from '../documents/finalRevisionConfirmation';
import {proposeDocumentRevision} from '../documents/documentRevisionIdentity';
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

const draft=()=>{
 const source=input();const {scope,classes,bindings,modelSelection,period}=source;
 return {mode:'SYNTHETIC_ONLY',revision:{mode:'SYNTHETIC_ONLY',kind:'final-report',documentId:'demo-document',scope,classes,bindings,modelSelection,period,history:null as unknown,request:{expectedHead:null as string|null,revisionId:'demo-revision-one',reason:'initial'}},source};
};
const ready=(x:unknown=draft())=>{const r=createFinalRevisionReview(x);if(!r.valid)throw Error(r.issue);return r.review;};
type Preview=ReturnType<typeof ready>['preview'];
const decision=(reviewed:Preview)=>({confirmedByTeacher:true,documentId:reviewed.documentId,revisionId:reviewed.revisionId,reviewed});
describe('DOC-01/D4b1 — bind exact final revision to reviewed sources',()=>{
 test('derives final report from D3c, not caller supplied content, and requires a distinct explicit confirmation',()=>{
  const x=draft(),r=ready(x);
  expect(r.preview).toMatchObject({official:false,complete:false,labOnly:true,kind:'final-report',documentId:'demo-document',revisionId:'demo-revision-one',number:1,content:{recorded:{count:2,hours:3.5},assessments:{completed:[{title:'Verifica dimostrativa'}]},summary:[{text:'Metodo dimostrativo'}]}});
  expect(r.status(x)).toBe('draft');
  expect(r.confirm(x,decision(r.preview))).toEqual({valid:true,confirmed:true,official:false,complete:false});
  expect(r.status(x)).toBe('confirmed');expect(r.confirm(x,decision(r.preview)).valid).toBe(false);
  expect(Object.isFrozen(r.preview.content)).toBe(true);
 });
 test('program completed is a distinct recorded-only document, rejects hidden report inputs',()=>{
  const x=draft();const revision={...x.revision,kind:'program-completed'};
  expect(createFinalRevisionReview({...x,revision}).valid).toBe(false);
  const source={...x.source,assessment:null,selection:{...x.source.selection,links:[],summary:[]}};
  const r=ready({...x,revision,source});expect(r.preview.content).toMatchObject({recorded:{count:2,hours:3.5}});
  expect(r.preview.content).not.toHaveProperty('summary');expect(r.preview.content).not.toHaveProperty('assessments');
  expect(createFinalRevisionReview({...x,revision,source:{...source,recorded:null,selection:{...source.selection,topics:[]}}}).valid).toBe(false);
 });
 test('rejects scope, period, model and source context mismatch, private or unsupported kinds',()=>{
  const x=draft();for(const y of [{...x,revision:{...x.revision,period:{from:'2026-10-01',to:'2027-08-31'}}},{...x,revision:{...x.revision,kind:'disciplinary-plan'}},{...x,revision:{...x.revision,kind:'individual-feedback'}},{...x,source:{...x.source,scope:{...x.source.scope,cohortRef:'demo-other'}}},{...x,source:{...x.source,bindings:[]}}])expect(createFinalRevisionReview(y).valid).toBe(false);
 });
 test('rejects tampered displayed content, absent explicit confirmation and wrong document or revision',()=>{
  const x=draft(),r=ready(x),d=decision(r.preview);
  for(const bad of [{...d,confirmedByTeacher:false},{...d,revisionId:'demo-other'},{...d,documentId:'demo-other'},{...d,reviewed:{...r.preview,number:2}},{...d,reviewed:{...r.preview,content:{...r.preview.content,complete:true}}},{...d,signature:'fake'}])expect(r.confirm(x,bad).valid).toBe(false);
  expect(r.status(x)).toBe('draft');expect(r.confirm(x,d).valid).toBe(true);
 });
 test('changed teacher text or recorded source invalidates confirmed review even if original input returns',()=>{
  const x=draft(),r=ready(x);expect(r.confirm(x,decision(r.preview)).valid).toBe(true);
  const y={...x,source:{...x.source,selection:{...x.source.selection,summary:[{section:'methodologies',text:'Nuovo testo'}]}}};
  expect(r.status(y)).toBe('review-required');expect(r.status(x)).toBe('review-required');expect(r.confirm(x,decision(r.preview)).valid).toBe(false);
  const q=ready(x);expect(q.status({...x,source:{...x.source,recorded:{...x.source.recorded,records:[]}}})).toBe('review-required');
 });
 test('hidden criterion changes invalidate even when final report visible content is unchanged',()=>{
  const x=draft(),r=ready(x);expect(r.confirm(x,decision(r.preview)).valid).toBe(true);
  const graph={...x.source.assessment.graph,criteria:x.source.assessment.graph.criteria.map(c=>({...c,description:'Nuovo criterio'}))};
  const y={...x,source:{...x.source,assessment:{...x.source.assessment,graph}}};
  const fresh=ready(y);expect(fresh.preview).toEqual(r.preview);expect(r.status(y)).toBe('review-required');
 });
 test('new revision cannot inherit confirmation even with identical report content',()=>{
  const x=draft(),r=ready(x);expect(r.confirm(x,decision(r.preview)).valid).toBe(true);
  const h=proposeDocumentRevision(x.revision);if(!h.valid)throw Error(h.issue);
  const y={...x,revision:{...x.revision,history:h.history,request:{expectedHead:'demo-revision-one',revisionId:'demo-revision-two',reason:'source-update'}}};
  const fresh=ready(y);expect(fresh.preview.number).toBe(2);expect(fresh.preview.content).toEqual(r.preview.content);
  expect(fresh.status(y)).toBe('draft');expect(r.status(y)).toBe('review-required');expect(fresh.confirm(y,decision(r.preview)).valid).toBe(false);
 });
 test('explicit revocation is revision-specific and irreversible on this review instance',()=>{
  const x=draft(),r=ready(x);expect(r.confirm(x,decision(r.preview)).valid).toBe(true);
  expect(r.revoke({revokedByTeacher:true,documentId:'demo-document',revisionId:'demo-other'})).toBe(false);
  expect(r.revoke({revokedByTeacher:true,documentId:'demo-document',revisionId:'demo-revision-one'})).toBe(true);
  expect(r.status(x)).toBe('revoked');expect(r.confirm(x,decision(r.preview)).valid).toBe(false);
 });
 test('rejects personal graph, extra payload and production; no runtime wiring',()=>{
  const x=draft();for(const y of [{...x,mode:'PRODUCTION'},{...x,content:{text:'fake'}},{...x,source:{...x.source,assessment:{...x.source.assessment,graph:{...x.source.assessment.graph,evidence:[]}}}}])expect(createFinalRevisionReview(y).valid).toBe(false);
  let accessed=false;const bad={...x};Object.defineProperty(bad,'source',{enumerable:true,get(){accessed=true;return x.source;}});
  expect(createFinalRevisionReview(bad).valid).toBe(false);expect(accessed).toBe(false);
  for(const path of ['src/App.tsx','src/main.tsx','src/components/documents/UnifiedDocumentPreview.tsx'])expect(readFileSync(path,'utf8')).not.toContain('createFinalRevisionReview');
 });
});
