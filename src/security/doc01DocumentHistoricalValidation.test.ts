import {describe,expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {proposeDocumentRevision} from '../documents/documentRevisionIdentity';
import {validateHistoricalDocumentRecord} from '../documents/documentHistoricalValidation';
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
type RecordV1=Awaited<ReturnType<typeof prepare>>;
const check=(record:unknown,approvedScope:unknown)=>validateHistoricalDocumentRecord(record,approvedScope);
const canonical=(v:unknown):string=>Array.isArray(v)?'['+v.map(canonical).join(',')+']':v!==null&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical((v as Record<string,unknown>)[k])).join(',')+'}':JSON.stringify(v);
const resign=async(v:Record<string,unknown>)=>{
 const {contentDigest:_,...unsigned}=v;
 const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical(['DOC-01/archive-candidate/v1',unsigned])));
 return {...unsigned,contentDigest:Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('')};
};
describe('DOC-01/D4c2a historical validation of frozen document record',()=>{
 test('accepts a serialized historical final copy without current source and with independently approved exact scope',async()=>{
  const r=await prepare(request(finalDraft()));
  const result=await check(JSON.parse(JSON.stringify(r)),r.identity.scope);
  expect(result).toMatchObject({valid:true,record:r});
  if(!result.valid)throw Error('history rejected');
  expect(Object.isFrozen(result.record)).toBe(true);expect(Object.isFrozen(result.record.preview)).toBe(true);
 });
 test('accepts both annual planning variants and council contribution',async()=>{
  for(const draft of [planningDraft(1),planningDraft(3),planningDraft(2,'council-contribution')]){
   const r=await prepare(request(draft));expect((await check(r,r.identity.scope)).valid).toBe(true);
  }
 });
 test('detects digest corruption, unsupported version and extra metadata',async()=>{
  const r=await prepare(request(finalDraft()));
  for(const bad of [{...r,contentDigest:'0'.repeat(64)},{...r,confirmedAt:'2026-11-19T16:02:00.000Z'},{...r,schemaVersion:2},{...r,studentId:'demo-student'}])
   expect((await check(bad,r.identity.scope)).valid).toBe(false);
 });
 test('rejects rehashed mismatch of document kind, revision and scope',async()=>{
  const r=await prepare(request(finalDraft()));
  for(const bad of [{...r,preview:{...r.preview,documentId:'demo-other'}},{...r,preview:{...r.preview,number:2}},{...r,identity:{...r.identity,kind:'disciplinary-plan'}},{...r,identity:{...r.identity,scope:{...r.identity.scope,classId:'demo-other'}}}])
   expect((await check(await resign(bad),r.identity.scope)).valid).toBe(false);
 });
 test('rejects rehashed extra personal fields and invalid content semantics',async()=>{
  const r=await prepare(request(finalDraft()));
  const p=r.preview as Extract<RecordV1['preview'],{kind:'final-report'|'program-completed'}>;
  const c=p.content as Extract<typeof p.content,{assessments:unknown}>;
  for(const content of [{...c,studentId:'demo-student'},{...c,recorded:{...c.recorded,hours:99}},{...c,recorded:{...c.recorded,activities:[{...c.recorded.activities[0],studentId:'demo-student'},...c.recorded.activities.slice(1)]}},{...c,links:[{activityIndex:99,assessmentIndex:0}]}]){
   expect((await check(await resign({...r,preview:{...r.preview,content}}),r.identity.scope)).valid).toBe(false);
  }
 });
 test('requires exact independent scope, rejects invalid time, history chain metadata and authority markers even when rehashed',async()=>{
  const r=await prepare(request(finalDraft()));
  for(const scope of [null,{...r.identity.scope,schoolYear:'2027/2028'},{...r.identity.scope,subjectCode:'matematica'},{...r.identity.scope,studentId:'demo-student'}])
   expect((await check(r,scope)).valid).toBe(false);
  for(const bad of [{...r,confirmedAt:'2026-11-31T10:00:00.000Z'},{...r,revision:{...r.revision,previousRevisionId:'demo-earlier'}},{...r,official:true},{...r,confirmedByTeacher:false}])
   expect((await check(await resign(bad),r.identity.scope)).valid).toBe(false);
 });
 test('rejects rehashed planned content with false authority or unselected link',async()=>{
  const r=await prepare(request(planningDraft()));
  const p=r.preview as Extract<RecordV1['preview'],{kind:'disciplinary-plan'|'council-disciplinary-contribution'}>;
  const c=p.content;
  for(const content of [{...c,curriculum:{...c.curriculum,objectives:['Inventato']}},{...c,planning:{...c.planning,official:true}},{...c,planning:{...c.planning,udas:[{...c.planning.udas[0],studentId:'demo-student'}]}},{...c,assessment:{status:'selected',coverage:'selected-only',expected:[],localTargets:[],links:[{udaIndex:100,assessmentIndex:0}],linkAuthority:'teacher-declared',curriculumEquivalence:'not-established'}}])
   expect((await check(await resign({...r,preview:{...p,content}}),r.identity.scope)).valid).toBe(false);
 });
 test('detaches historical record, rejects accessor, never exposes storage or authentication authority',async()=>{
  const r=await prepare(request(finalDraft())),mutable=JSON.parse(JSON.stringify(r));const result=await check(mutable,r.identity.scope);
  if(!result.valid)throw Error('history rejected');
  mutable.preview.content.recorded.activities[0].title='Mutato';
  expect(JSON.stringify(result.record)).not.toContain('Mutato');
  expect(result).not.toHaveProperty('authenticated');expect(result).not.toHaveProperty('saved');
  let accessed=false;const bad={...r};Object.defineProperty(bad,'preview',{enumerable:true,get(){accessed=true;return r.preview;}});
  expect((await check(bad,r.identity.scope)).valid).toBe(false);expect(accessed).toBe(false);
  for(const path of ['src/App.tsx','src/main.tsx','src/security/secureAppStorage.ts','src/security/backupPayload.ts'])expect(readFileSync(path,'utf8')).not.toContain('validateHistoricalDocumentRecord');
 });
});

describe('DOC-01/D4c2a producer-to-history closure',()=>{
 test('round-trips program completed as recorded-only content, rejects rehashed report fields',async()=>{
  const x=finalDraft(),draft={...x,revision:{...x.revision,kind:'program-completed'},source:{...x.source,assessment:null,selection:{...x.source.selection,links:[],summary:[]}}};
  const r=await prepare(request(draft)),scope=draft.revision.scope;
  expect((await check(JSON.parse(JSON.stringify(r)),scope)).valid).toBe(true);
  expect(r.preview.content).not.toHaveProperty('assessments');
  expect(r.preview.content).not.toHaveProperty('summary');
  expect((await check(await resign({...r,preview:{...r.preview,content:{...r.preview.content,summary:[]}}}),scope)).valid).toBe(false);
 });
 test('round-trips selected expected criteria and explicit UDA links; rejects rehashed group or link violations',async()=>{
  const x=planningDraft(),a=make(),scope=x.source.scope,period=x.revision.period;
  const assessment={graph:a.graph,selection:{...a.selection,scope,period,expectedRevisionIds:['demo-other'],completedRevisionIds:[]},links:{confirmedByTeacher:true,items:[{udaId:x.source.planning.selection.udaIds[0],assessmentRevisionId:'demo-other'}]}};
  const draft={...x,source:{...x.source,assessment}};
  const r=await prepare(request(draft));
  expect((await check(JSON.parse(JSON.stringify(r)),scope)).valid).toBe(true);
  const p=r.preview as Extract<RecordV1['preview'],{kind:'disciplinary-plan'|'council-disciplinary-contribution'}>;
  const c=p.content,a1=c.assessment;
  if(!a1||a1.status!=='selected')throw Error('selected assessment missing');
  expect(a1.localTargets.length).toBeGreaterThan(0);
  expect(a1.links).toEqual([{udaIndex:0,assessmentIndex:0}]);
  for(const changed of [{...a1,localTargets:[]},{...a1,links:[...a1.links,...a1.links]},{...a1,localTargets:a1.localTargets.map(g=>({...g,targets:g.targets.map(t=>({...t,origin:'arena'}))}))}]){
   expect((await check(await resign({...r,preview:{...p,content:{...c,assessment:changed}}}),scope)).valid).toBe(false);
  }
 });
 test('round-trips explicit missing assessment and missing curriculum; does not mistake absence for zero',async()=>{
  const x=planningDraft(),d={...x,source:{...x.source,arena:null,assessment:null}},r=await prepare(request(d)),scope=d.revision.scope;
  expect((await check(JSON.parse(JSON.stringify(r)),scope)).valid).toBe(true);
  const p=r.preview as Extract<RecordV1['preview'],{kind:'disciplinary-plan'|'council-disciplinary-contribution'}>;
  const c=p.content;
  expect(c.curriculum.annualReferenceCount).toBeNull();expect(c.assessment?.coverage).toBeNull();
  expect((await check(await resign({...r,preview:{...p,content:{...c,curriculum:{...c.curriculum,annualReferenceCount:0}}}}),scope)).valid).toBe(false);
 });
 test('round-trips a subsequent revision without reconstructing the prior sources',async()=>{
  const x=finalDraft(),lineage=proposeDocumentRevision(x.revision);
  if(!lineage.valid)throw Error(lineage.issue);
  const d={...x,revision:{...x.revision,history:lineage.history,request:{expectedHead:'demo-revision-one',revisionId:'demo-revision-two',reason:'correction'}}};
  const r=await prepare(request(d)),scope=d.revision.scope;
  expect(r.revision).toMatchObject({number:2,previousRevisionId:'demo-revision-one',revisionId:'demo-revision-two'});
  expect((await check(JSON.parse(JSON.stringify(r)),scope)).valid).toBe(true);
  // This is a record-level check only; continuity across stored records belongs to D4c2b.
  expect((await check(await resign({...r,revision:{...r.revision,previousRevisionId:r.revision.revisionId}}),scope)).valid).toBe(false);
 });
 test('rejects non-canonical half-hour quantities and inconsistent sums even with valid recomputed digest',async()=>{
  const x=finalDraft(),r=await prepare(request(x)),scope=x.revision.scope;
  const p=r.preview as Extract<RecordV1['preview'],{kind:'final-report'|'program-completed'}>;
  const c=p.content,recorded=c.recorded;
  for(const hours of [0,0.25,1.25,10.5]){
   const activities=recorded.activities.map((a,i)=>i===0?{...a,hours}:a);
   const changed={...recorded,activities,hours:activities.reduce((sum,a)=>sum+a.hours,0)};
   expect((await check(await resign({...r,preview:{...p,content:{...c,recorded:changed}}}),scope)).valid).toBe(false);
  }
 });
});
