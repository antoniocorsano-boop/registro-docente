import {describe,expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {prepareDocumentArchiveCandidate} from '../documents/documentArchiveCandidate';
import {createFinalRevisionReview} from '../documents/finalRevisionConfirmation';
import {createPlanningRevisionReview} from '../documents/planningRevisionConfirmation';
import {computeDocenteOsTeachingProjectionFingerprint,type DocenteOsTeachingProjectionV1} from '../planning/docenteOsTeachingProjection';
import {previewArenaPlanningContext,bindAcceptedArenaPlanningContext} from '../planning/arenaPlanningContext';
import type {TeachingProfile} from '../planning/types';
import type {AssessmentEvidenceV1,AssessmentDefinitionRevision} from '../assessment/assessmentEvidence';
const planningFixture=(grade:1|2|3=2,purpose='disciplinary-plan')=>{
 const scope={institutionRef:'demo-school',siteRef:'demo-site',classId:'demo-class',cohortRef:'demo-cohort',schoolYear:'2026/2027',schoolOrder:'lower_secondary',gradeLevel:grade,subjectCode:'tecnologia',regimeRef:'demo-regime',purpose};
 const classes=[{id:'demo-class',name:grade+'C'},{id:'demo-other',name:grade+'A'}];
 const model=purpose==='council-contribution'?'council-contribution':grade===1?'disciplinary-first':'disciplinary-second-third';
 const binding={model,version:'2026-27-map-v1',institutionRef:scope.institutionRef,siteRef:scope.siteRef,cohortRef:scope.cohortRef,schoolYear:scope.schoolYear,schoolOrder:scope.schoolOrder,gradeLevel:grade,regimeRef:scope.regimeRef,referenceStatus:'reviewed-reference'};
 const modelSelection={confirmedByTeacher:true,scope,model,version:binding.version};
 const uda=(suffix:string,title:string,focus:string,hours:number,period:string)=>({sourceUdaRef:'demo-'+suffix,projectedUdaId:'docente-os:demo-section:demo-gen:demo-'+suffix,title,focus,plannedHours:hours,period,packRefs:['demo-pack'],canonicalGenerationId:'demo-gen'});
 const raw:Omit<DocenteOsTeachingProjectionV1,'projectionFingerprint'>={contract:'DOCENTE_OS_REGISTRO_TEACHING_PROJECTION_V1',contractVersion:1,sourceProduct:'DOCENTE_OS',targetProduct:'REGISTRO_DOCENTE',importMode:'READ_ONLY_PROJECTION',acceptanceRequired:true,automaticWriteAllowed:false,schoolYear:'2026/2027',disciplineName:'Tecnologia',generatedAt:'2026-11-19T00:00:00.000Z',provenance:{repository:'antoniocorsano-boop/docente-os-2026-27',sourceCommit:'a'.repeat(40),sourceBranch:'demo'},privacyClass:'PROFESSIONAL_NON_PERSONAL',classes:[{sourceSectionId:'demo-section',grade,sectionCode:'C',compactLabel:grade+'C',displayLabel:grade+'ª C',sectionStatus:'CONFERMATA',canonicalPlan:{code:'demo-plan',assetId:'demo-asset',generationId:'demo-gen'},udas:[uda('one','Titolo di prova','Tema dimostrativo',4,'Ottobre / Febbraio'),uda('two','Titolo non selezionato','Tema non selezionato',6,'Marzo')]}]};
 const wrap=(p:typeof raw=raw,acceptedAt='2026-11-19T01:00:00.000Z')=>({projection:{...p,projectionFingerprint:{algorithm:'SHA-256' as const,hash:computeDocenteOsTeachingProjectionFingerprint(p)}},acceptedAt,classReconciliation:[{sourceSectionId:'demo-section',status:'resolved' as const,registroClassId:'demo-class'}]});
 const accepted=wrap();
 const selection={confirmedByTeacher:true,institutionRef:scope.institutionRef,cohortRef:scope.cohortRef,projectionHash:accepted.projection.projectionFingerprint.hash,acceptedAt:accepted.acceptedAt,sourceSectionId:'demo-section',udaIds:[raw.classes[0].udas[0].projectedUdaId]};
 const input={scope,classes,bindings:[binding],modelSelection,planning:{accepted:[accepted],selection}};
 return {input,raw,wrap};
};

function arenaFixture(grade:1|2|3=2,purpose='disciplinary-plan'){
 const regimeRef='demo-regime';
 const scope={institutionRef:'demo-school',siteRef:'demo-site',classId:'demo-class',cohortRef:'demo-cohort',schoolYear:'2026/2027',schoolOrder:'lower_secondary',gradeLevel:grade,subjectCode:'tecnologia',regimeRef,purpose};
 const classes=[{id:'demo-class',name:grade+'C'},{id:'demo-other',name:grade+'A'}];
 const model=purpose==='council-contribution'?'council-contribution':grade===1?'disciplinary-first':'disciplinary-second-third';
 const binding={model,version:'2026-27-map-v1',institutionRef:scope.institutionRef,siteRef:scope.siteRef,cohortRef:scope.cohortRef,schoolYear:scope.schoolYear,schoolOrder:scope.schoolOrder,gradeLevel:grade,regimeRef,referenceStatus:'reviewed-reference'};
 const modelSelection={confirmedByTeacher:true,scope,model,version:binding.version};
 const profile:TeachingProfile={id:'demo-profile',schoolYear:'2026/2027',schoolOrder:'lower_secondary',gradeLevel:grade,cohortRef:scope.cohortRef,subjectCode:'tecnologia',normativeRegime:regimeRef,normativeReference:{id:'demo-norm',sourceRef:'demo',version:'1',nationalHoursDefined:false},reservePercent:0,assessmentPeriods:[],calendar:{startDate:'2026-09-01',endDate:'2027-06-30',closureDates:[],weeklySlots:[]}};
 const payload={contract:'ARENA_REGISTRO_PLANNING_CONTEXT_V1',contractVersion:1,sourceProduct:'ARENA',targetProduct:'REGISTRO_DOCENTE',importMode:'PREVIEW_ONLY',acceptanceRequired:true,automaticWriteAllowed:false,instituteName:scope.institutionRef,schoolYear:profile.schoolYear,sourceSchoolYear:profile.schoolYear,schoolOrder:'secondaria',subjectCode:'tecnologia',gradeLevel:grade,cohortRef:scope.cohortRef,cohortRefKind:'DERIVED_APPLICABILITY_KEY',applicabilityStatus:grade===1?'APPLICABLE':'TRANSITIONAL',normativeRegime:regimeRef,authorityState:'APPROVED',vigencyStatus:'VIGENTE',authorityReceiptRef:'demo-receipt',masterId:'demo-master',masterVersion:'demo-master-version',structuralFingerprint:{scope:'MASTER',algorithm:'fnv1a',version:1,hash:'1234abcd'},provenance:{repository:'antoniocorsano-boop/CurManLight_arena',sourceCommit:'a'.repeat(40),sourceDocumentId:'demo-document',sourceRevisionId:'demo-revision'},curricoloItems:[{id:'demo-annual-item',kind:'ANNUALITA_DISCIPLINARE',schoolStage:'Secondaria di primo grado',gradeLabel:'Classe '+['I','II','III'][grade-1],sourceSection:'demo-section',text:'Testo fittizio objective'}],privacyClass:'PROFESSIONAL_NON_PERSONAL'};
 const accept=(p:unknown=payload)=>{const r=previewArenaPlanningContext(p,profile);if(!r.ok)throw Error('invalid fixture');return bindAcceptedArenaPlanningContext([],r.context,{accepted:true,acceptedAt:'2026-11-19T00:00:00.000Z'})[0];};
 const current=accept();
 const selection={confirmedByTeacher:true,contextId:current.id,acceptedAt:current.acceptedAt,masterVersion:current.masterVersion,sourceCommit:current.provenance.sourceCommit,sourceRevisionId:current.provenance.sourceRevisionId,sourceSchoolYear:current.sourceSchoolYear,fingerprint:current.structuralFingerprint.hash,itemIds:['demo-annual-item']};
 return {input:{scope,classes,bindings:[binding],modelSelection,arena:{profiles:[profile],accepted:[current],selection},supplement:null as unknown},payload,accept};
}

const planningDraft=(grade:1|2|3=2,purpose='disciplinary-plan')=>{
 const {input}=planningFixture(grade,purpose);
 const arena=arenaFixture(grade,purpose).input.arena;
 const {scope,classes,bindings,modelSelection}=input;
 return {mode:'SYNTHETIC_ONLY',revision:{mode:'SYNTHETIC_ONLY',kind:purpose==='council-contribution'?'council-disciplinary-contribution':'disciplinary-plan',documentId:'demo-document',scope,classes,bindings,modelSelection,period:{from:'2026-09-01',to:'2027-08-31'},history:null as unknown,request:{expectedHead:null as string|null,revisionId:'demo-revision-one',reason:'initial'}},source:{...input,arena}};
};

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

const finalDraft=()=>{
 const source=input();const {scope,classes,bindings,modelSelection,period}=source;
 return {mode:'SYNTHETIC_ONLY',revision:{mode:'SYNTHETIC_ONLY',kind:'final-report',documentId:'demo-document',scope,classes,bindings,modelSelection,period,history:null as unknown,request:{expectedHead:null as string|null,revisionId:'demo-revision-one',reason:'initial'}},source};
};

const at='2026-11-19T16:00:00.000Z';
const request=(reviewed:unknown)=>{
 const kind=(reviewed as ReturnType<typeof finalDraft>).revision.kind;
 const r=kind==='final-report'||kind==='program-completed'?createFinalRevisionReview(reviewed):createPlanningRevisionReview(reviewed);
 if(!r.valid)throw Error(r.issue);
 const preview=r.review.preview;
 return {mode:'SYNTHETIC_ONLY',reviewed,current:structuredClone(reviewed),decision:{confirmedByTeacher:true,documentId:preview.documentId,revisionId:preview.revisionId,reviewed:preview},confirmedAt:at};
};
const prepare=async(x:unknown)=>{const r=await prepareDocumentArchiveCandidate(x);if(!r.valid)throw Error(r.issue);return r.record;};
describe('DOC-01/D4c1 immutable archive candidate from exact reviewed document',()=>{
 test('derives only the confirmed final projection with immutable revision metadata and digest',async()=>{
  const x=request(finalDraft()),record=await prepare(x);
  expect(record).toMatchObject({schemaVersion:1,labOnly:true,official:false,complete:false,confirmedAt:at,confirmedByTeacher:true,identity:{documentId:'demo-document',kind:'final-report'},revision:{revisionId:'demo-revision-one',number:1,previousRevisionId:null},preview:x.decision.reviewed});
  expect(record.contentDigest).toMatch(/^[0-9a-f]{64}$/);
  expect(Object.isFrozen(record)).toBe(true);expect(Object.isFrozen(record.preview)).toBe(true);expect(Object.isFrozen(record.identity)).toBe(true);
  expect(JSON.stringify(record)).not.toMatch(/projectionFingerprint|targetReferenceRevisionIds|demo-criterion-rev|studentId|reviewedSource|assessmentGraph/);
 });
 test('supports annual disciplinary planning and council contribution through existing review producer',async()=>{
  for(const x of [planningDraft(),planningDraft(2,'council-contribution')]){
   const q=request(x),r=await prepare(q);expect(r.identity.kind).toBe(x.revision.kind);expect(r.preview).toEqual(q.decision.reviewed);
   expect(JSON.stringify(r)).not.toMatch(/sourceCommit|projectionHash|Testo fittizio objective|Titolo non selezionato|councilApproved/);
  }
 });
 test('deterministic digest for same data and changes with confirmed content or time',async()=>{
  const x=request(finalDraft()),a=await prepare(x),b=await prepare(structuredClone(x));
  expect(a.contentDigest).toBe(b.contentDigest);
  expect((await prepare({...x,confirmedAt:'2026-11-19T16:01:00.000Z'})).contentDigest).not.toBe(a.contentDigest);
  const d=finalDraft();d.source.selection.summary[0].text='Metodo modificato';
  expect((await prepare(request(d))).contentDigest).not.toBe(a.contentDigest);
 });
 test('refuses stale source, even where the visible preview stays identical',async()=>{
  const x=finalDraft(),q=request(x);
  const current={...x,source:{...x.source,assessment:{...x.source.assessment,graph:{...x.source.assessment.graph,rubrics:x.source.assessment.graph.rubrics.map(r=>({...r,source:{...r.source,sourceVersion:'demo-changed'}}))}}}};
  const next=createFinalRevisionReview(current);if(!next.valid)throw Error(next.issue);
  expect(next.review.preview).toEqual(q.decision.reviewed);
  expect((await prepareDocumentArchiveCandidate({...q,current})).valid).toBe(false);
 });
 test('rejects changed revision, tampered decision and implicit confirmation',async()=>{
  const x=finalDraft(),q=request(x);
  for(const decision of [{...q.decision,confirmedByTeacher:false},{...q.decision,revisionId:'demo-other'},{...q.decision,reviewed:{...q.decision.reviewed,number:99}}])
   expect((await prepareDocumentArchiveCandidate({...q,decision})).valid).toBe(false);
  expect((await prepareDocumentArchiveCandidate({...q,current:{...x,revision:{...x.revision,documentId:'demo-other'}}})).valid).toBe(false);
 });
 test('rejects invalid timestamp, non-lab, arbitrary fields, private and malformed input',async()=>{
  const q=request(finalDraft());
  for(const x of [{...q,confirmedAt:'2026-11-31T16:00:00.000Z'},{...q,mode:'PRODUCTION'},{...q,studentId:'demo-student'},{...q,record:{}},{...q,reviewed:null}])
   expect((await prepareDocumentArchiveCandidate(x)).valid).toBe(false);
  let accessed=false;const bad={...q};Object.defineProperty(bad,'current',{enumerable:true,get(){accessed=true;return q.current;}});
  expect((await prepareDocumentArchiveCandidate(bad)).valid).toBe(false);expect(accessed).toBe(false);
 });
 test('detaches the candidate from input and does not claim persistence or expose production wiring',async()=>{
  const x=finalDraft(),q=request(x),r=await prepare(q);
  x.source.selection.summary[0].text='Mutato';expect(JSON.stringify(r)).not.toContain('Mutato');
  expect(r).not.toHaveProperty('saved');expect(r).not.toHaveProperty('authenticated');
  for(const path of ['src/App.tsx','src/main.tsx','src/security/secureAppStorage.ts','src/security/backupPayload.ts'])expect(readFileSync(path,'utf8')).not.toContain('prepareDocumentArchiveCandidate');
 });
});
