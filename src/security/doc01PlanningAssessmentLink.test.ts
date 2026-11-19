import {describe,expect,test} from 'bun:test';
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

const draft=(grade:1|2|3=2,purpose='disciplinary-plan')=>{
 const {input}=planningFixture(grade,purpose);
 const arena=arenaFixture(grade,purpose).input.arena;
 const {scope,classes,bindings,modelSelection}=input;
 return {mode:'SYNTHETIC_ONLY',revision:{mode:'SYNTHETIC_ONLY',kind:purpose==='council-contribution'?'council-disciplinary-contribution':'disciplinary-plan',documentId:'demo-document',scope,classes,bindings,modelSelection,period:{from:'2026-09-01',to:'2027-08-31'},history:null as unknown,request:{expectedHead:null as string|null,revisionId:'demo-revision-one',reason:'initial'}},source:{...input,arena}};
};

const timestamp='2026-11-01T10:00:00.000Z';
const confirmation={confirmedByTeacher:true as const,confirmedAt:timestamp};
const assessmentFixture=(grade=2,purpose='disciplinary-plan')=>{
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

const enriched=(grade:1|2|3=2,purpose='disciplinary-plan')=>{
 const x=draft(grade,purpose),a=assessmentFixture(grade,purpose);
 const {scope}=x.source,period=x.revision.period;
 const selection={...a.selection,scope,period,expectedRevisionIds:['demo-other'],completedRevisionIds:[] as string[]};
 const links={confirmedByTeacher:true,items:[{udaId:x.source.planning.selection.udaIds[0],assessmentRevisionId:'demo-other'}]};
 return {...x,source:{...x.source,assessment:{graph:a.graph,selection,links}}};
};
const ready=(x:unknown=enriched())=>{const r=createPlanningRevisionReview(x);if(!r.valid)throw Error(r.issue);return r.review;};
const confirm=(x:unknown,r:ReturnType<typeof ready>)=>r.confirm(x,{confirmedByTeacher:true,documentId:r.preview.documentId,revisionId:r.preview.revisionId,reviewed:r.preview});
describe('DOC-01/D4b3 explicit UDA and expected assessment connection',()=>{
 test('enriches the existing annual document with selected expected criteria, local targets and explicit links',()=>{
  const x=enriched(),r=ready(x);
  expect(r.preview.content).toMatchObject({curriculum:{status:'reference-only',annualReferenceCount:1,objectives:null},assessment:{status:'selected',coverage:'selected-only',expected:[{title:'Seconda verifica dimostrativa',criteria:[{criterion:'Criterio dimostrativo',kind:'product',method:'Analisi della rappresentazione'}]}],localTargets:[{assessmentIndex:0,criterionIndex:0,targets:[{kind:'specific-objective',text:'Obiettivo locale dimostrativo',origin:'local'}]}],links:[{udaIndex:0,assessmentIndex:0}],linkAuthority:'teacher-declared',curriculumEquivalence:'not-established'}});
  const rendered=JSON.stringify(r.preview.content);expect(rendered).not.toMatch(/demo-|Livello dimostrativo|Descrizione riservata|completedOn|studentId|Testo fittizio/);
  expect(confirm(x,r).valid).toBe(true);expect(r.status(x)).toBe('confirmed');
 });
 test('old contract preserved, explicit missing is not zero, no implicit links',()=>{
  const x=enriched();
  expect(ready(draft()).preview.content).not.toHaveProperty('assessment');
  expect(ready({...x,source:{...x.source,assessment:null}}).preview.content).toMatchObject({assessment:{status:'missing',expected:[],localTargets:[],links:[]}});
  const y={...x,source:{...x.source,assessment:{...x.source.assessment,links:{confirmedByTeacher:true,items:[]}}}};
  expect(ready(y).preview.content).toMatchObject({assessment:{links:[]}});
 });
 test('rejects unselected UDA, unselected or cancelled assessment, duplicate links and absent teacher decision',()=>{
  const x=enriched(),a=x.source.assessment,l=a.links.items[0];
  for(const links of [{...a.links,confirmedByTeacher:false},{...a.links,items:[{...l,udaId:'docente-os:demo-section:demo-gen:demo-two'}]},{...a.links,items:[{...l,assessmentRevisionId:'demo-completed'}]},{...a.links,items:[{...l,assessmentRevisionId:'demo-cancelled'}]},{...a.links,items:[l,l]}])expect(createPlanningRevisionReview({...x,source:{...x.source,assessment:{...a,links}}}).valid).toBe(false);
 });
 test('completed outcomes, stale revision, empty selection and mismatched graph are denied',()=>{
  const x=enriched(),a=x.source.assessment;
  for(const assessment of [{...a,selection:{...a.selection,completedRevisionIds:['demo-completed']}},{...a,selection:{...a.selection,expectedRevisionIds:['demo-planned']}},{...a,selection:{...a.selection,expectedRevisionIds:[]}},{...a,graph:{...a.graph,classId:'demo-other'}}])expect(createPlanningRevisionReview({...x,source:{...x.source,assessment}}).valid).toBe(false);
 });
 test('local targets do not become authoritative curriculum, even without Arena',()=>{
  const x=enriched(),r=ready({...x,source:{...x.source,arena:null}});
  expect(r.preview.content).toMatchObject({curriculum:{status:'missing',objectives:null},assessment:{curriculumEquivalence:'not-established',localTargets:[{targets:[{origin:'local'}]}]}});
  const c=ready(enriched(2,'council-contribution'));expect(c.preview.kind).toBe('council-disciplinary-contribution');expect(c.preview.content.planning.excluded).toContain('council-approval');
 });
 test('hidden rubric changes and changed declared links invalidate confirmation',()=>{
  const x=enriched(),r=ready(x);expect(confirm(x,r).valid).toBe(true);const a=x.source.assessment;
  const y={...x,source:{...x.source,assessment:{...a,graph:{...a.graph,rubrics:a.graph.rubrics.map(b=>({...b,source:{...b.source,sourceVersion:'demo-version-new'}}))}}}};
  expect(ready(y).preview).toEqual(r.preview);expect(r.status(y)).toBe('review-required');expect(r.status(x)).toBe('review-required');
  const q=ready(x);expect(confirm(x,q).valid).toBe(true);expect(q.status({...x,source:{...x.source,assessment:{...a,links:{confirmedByTeacher:true,items:[]}}}})).toBe('review-required');
 });
 test('source arrival and local target text revision require a new review',()=>{
  const x=enriched(),q=ready({...x,source:{...x.source,assessment:null}});expect(q.status(x)).toBe('review-required');
  const r=ready(x),a=x.source.assessment;expect(confirm(x,r).valid).toBe(true);
  const y={...x,source:{...x.source,assessment:{...a,graph:{...a.graph,references:a.graph.references.map(b=>({...b,text:'Obiettivo locale modificato'}))}}}};
  expect(ready(y).preview).toMatchObject({content:{assessment:{localTargets:[{targets:[{text:'Obiettivo locale modificato'}]}]}}});expect(r.status(y)).toBe('review-required');
 });
 test('rejects personal evidence slice and arbitrary content, preserves immutable selected preview',()=>{
  const x=enriched(),a=x.source.assessment,r=ready(x);
  for(const assessment of [{...a,graph:{...a.graph,evidence:[]}},{...a,content:{}},{...a,links:{...a.links,studentId:'demo-student'}}])expect(createPlanningRevisionReview({...x,source:{...x.source,assessment}}).valid).toBe(false);
  const c=r.preview.content as unknown as {assessment:{localTargets:readonly {targets:readonly object[]}[];links:readonly object[]}};
  expect(Object.isFrozen(c.assessment.localTargets[0].targets[0])).toBe(true);expect(Object.isFrozen(c.assessment.links[0])).toBe(true);
 });
});
