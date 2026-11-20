import {describe,expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {validateHistoricalDocumentRecord} from '../documents/documentHistoricalValidation';
import {validateDocumentHistory,applyDocumentHistoryOperation} from '../documents/documentHistoryTransitions';
import {proposeDocumentRevision} from '../documents/documentRevisionIdentity';
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
type Archive=Extract<Awaited<ReturnType<typeof validateDocumentHistory>>,{valid:true}>['archive'];
const blank=():Archive=>({schemaVersion:1,labOnly:true,events:[]});
const scope=finalDraft().revision.scope;
const approved=[scope];
const eventRequest=(eventId:string,expectedHead:string|null,operation:unknown)=>({mode:'SYNTHETIC_ONLY',eventId,expectedHead,operation});
const append=(r:RecordV1,eventId='demo-event-one',expectedHead:string|null=null)=>eventRequest(eventId,expectedHead,{kind:'append',record:r});
const revoke=(r:RecordV1,eventId:string,expectedHead:string|null,revokedAt='2026-11-19T16:02:00.000Z')=>eventRequest(eventId,expectedHead,{kind:'revoke',documentId:r.identity.documentId,revisionId:r.revision.revisionId,contentDigest:r.contentDigest,revokedAt,reason:'correction-required',confirmedByTeacher:true});
const head=(a:Archive)=>a.events.at(-1)?.eventDigest??null;
const step=async(a:unknown,q:unknown,scopes:unknown=approved)=>{
 const r=await applyDocumentHistoryOperation(a,scopes,q);if(!r.valid)throw Error(r.issue);return r;
};
const first=async()=>prepare(request(finalDraft()));
async function successor(reason:'correction'|'content-update'|'source-update'='correction',confirmedAt='2026-11-19T16:03:00.000Z'){
 const d=finalDraft(),h=proposeDocumentRevision(d.revision);if(!h.valid)throw Error(h.issue);
 d.source.selection.summary[0].text='Metodo rettificato';
 return prepare({...request({...d,revision:{...d.revision,history:h.history,request:{expectedHead:'demo-revision-one',revisionId:'demo-revision-two',reason}}}),confirmedAt});
}
async function other(){
 const d=planningDraft();
 return prepare(request({...d,revision:{...d.revision,documentId:'demo-document-other',request:{...d.revision.request,revisionId:'demo-other-revision'}}}));
}
const canonical=(v:unknown):string=>Array.isArray(v)?'['+v.map(canonical).join(',')+']':v!==null&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical((v as Record<string,unknown>)[k])).join(',')+'}':JSON.stringify(v);
async function rehashEvent(e:Record<string,unknown>){
 const {eventDigest:_,...u}=e;
 const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical(['DOC-01/document-history-event/v1',u])));
 return {...u,eventDigest:Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('')};
}
describe('DOC-01/D4c2b append-only historical document transitions',()=>{
 test('accepts empty synthetic history and first independently validated copy without persistence',async()=>{
  const empty=await validateDocumentHistory(blank(),approved);
  expect(empty).toMatchObject({valid:true,archive:blank(),heads:[]});
  const r=await first(),q=append(r),a=await step(blank(),q);
  expect(a).toMatchObject({valid:true,changed:true,heads:[{documentId:r.identity.documentId,revisionId:r.revision.revisionId,contentDigest:r.contentDigest,status:'confirmed'}]});
  expect(a.archive.events).toHaveLength(1);expect(a.archive.events[0]).toMatchObject({eventId:q.eventId,previousEventDigest:null,operation:q.operation});
  expect(head(a.archive)).toMatch(/^[0-9a-f]{64}$/);
  expect(Object.isFrozen(a.archive.events[0])).toBe(true);expect(a).not.toHaveProperty('saved');
  expect((await validateDocumentHistory(JSON.parse(JSON.stringify(a.archive)),approved)).valid).toBe(true);
 });
 test('appends correction without rewriting earlier copy; derives latest heads',async()=>{
  const r=await first(),a=await step(blank(),append(r)),n=await successor();
  const b=await step(a.archive,append(n,'demo-event-two',head(a.archive)));
  expect(b.archive.events).toHaveLength(2);expect(b.archive.events[0]).toEqual(a.archive.events[0]);
  expect(b.heads).toEqual([{documentId:r.identity.documentId,revisionId:n.revision.revisionId,contentDigest:n.contentDigest,status:'confirmed'}]);
  expect(JSON.stringify(b.archive.events[1])).toContain('Metodo rettificato');
  expect(JSON.stringify(b.archive.events[0])).not.toContain('Metodo rettificato');
  expect(a.archive.events).toHaveLength(1);
 });
 test('supports independent documents and exact historical scope, denies unapproved documents',async()=>{
  const r=await first(),a=await step(blank(),append(r)),n=await other();
  const b=await step(a.archive,append(n,'demo-event-other',head(a.archive)));
  expect(b.heads.map(x=>x.documentId)).toEqual([r.identity.documentId,n.identity.documentId]);
  expect((await validateDocumentHistory(b.archive,[])).valid).toBe(false);
  expect((await validateDocumentHistory(b.archive,[scope,scope])).valid).toBe(false);
  expect((await applyDocumentHistoryOperation(a.archive,[{...scope,subjectCode:'matematica'}],append(n,'demo-event-other',head(a.archive)))).valid).toBe(false);
 });
 test('exact retry is idempotent even after later events, never rewrites or resurrects history',async()=>{
  const r=await first(),q=append(r),a=await step(blank(),q),b=await step(a.archive,append(await successor(),'demo-event-two',head(a.archive)));
  const retry=await step(b.archive,structuredClone(q));
  expect(retry.changed).toBe(false);expect(retry.archive).toEqual(b.archive);expect(retry.heads).toEqual(b.heads);
  expect((await applyDocumentHistoryOperation(b.archive,approved,{...q,expectedHead:head(b.archive)})).valid).toBe(false);
  expect((await applyDocumentHistoryOperation(b.archive,approved,append(r,'demo-event-duplicate',head(b.archive)))).valid).toBe(false);
 });
 test('rejects stale head, skipped initial revision, forks, repeated revision ID and backward confirmation time',async()=>{
  const r=await first(),a=await step(blank(),append(r)),n=await successor();
  for(const [archive,q] of [[blank(),append(n)],[a.archive,append(n,'demo-event-two',null)],[a.archive,append(r,'demo-event-dup',head(a.archive))],[a.archive,append(await successor('correction','2026-11-19T15:59:00.000Z'),'demo-event-backdated',head(a.archive))]] as const)
   expect((await applyDocumentHistoryOperation(archive,approved,q)).valid).toBe(false);
  const b=await step(a.archive,append(n,'demo-event-two',head(a.archive)));
  expect((await applyDocumentHistoryOperation(b.archive,approved,append(await successor('source-update'),'demo-event-fork',head(b.archive)))).valid).toBe(false);
 });
 test('revokes only exact current confirmed revision, preserves original and refuses implicit or repeated revocation',async()=>{
  const r=await first(),a=await step(blank(),append(r)),q=revoke(r,'demo-event-revoke',head(a.archive)),b=await step(a.archive,q);
  expect(b.heads).toEqual([{documentId:r.identity.documentId,revisionId:r.revision.revisionId,contentDigest:r.contentDigest,status:'revoked'}]);
  expect(b.archive.events[0]).toEqual(a.archive.events[0]);expect(b.archive.events[1].operation).toEqual(q.operation);
  for(const op of [{...q.operation,confirmedByTeacher:false},{...q.operation,contentDigest:'0'.repeat(64)},{...q.operation,revisionId:'demo-other'},{...q.operation,revokedAt:'2026-11-19T15:59:00.000Z'},{...q.operation,reason:'inventato'}])
   expect((await applyDocumentHistoryOperation(a.archive,approved,{...q,operation:op})).valid).toBe(false);
  expect((await applyDocumentHistoryOperation(b.archive,approved,revoke(r,'demo-event-revoke-again',head(b.archive)))).valid).toBe(false);
  expect((await step(b.archive,q)).changed).toBe(false);
 });
 test('after revocation requires fresh correction, never reactivates same copy',async()=>{
  const r=await first(),a=await step(blank(),append(r)),b=await step(a.archive,revoke(r,'demo-event-revoke',head(a.archive)));
  for(const n of [await successor('content-update'),await successor('source-update'),await successor('correction','2026-11-19T16:01:00.000Z')])
   expect((await applyDocumentHistoryOperation(b.archive,approved,append(n,'demo-event-two',head(b.archive)))).valid).toBe(false);
  const n=await successor(),c=await step(b.archive,append(n,'demo-event-two',head(b.archive)));
  expect(c.heads[0]).toMatchObject({revisionId:n.revision.revisionId,status:'confirmed'});
  expect(c.archive.events.slice(0,2)).toEqual(b.archive.events);
  expect((await validateDocumentHistory(c.archive,approved)).valid).toBe(true);
 });
 test('rejects tampered chain, replayed or rehashed invalid events, unknown fields and accessor without invoking it',async()=>{
  const r=await first(),a=await step(blank(),append(r)),b=await step(a.archive,revoke(r,'demo-event-revoke',head(a.archive)));
  const [e1,e2]=b.archive.events;
  const bad=await rehashEvent({...e2,operation:{...e2.operation,confirmedByTeacher:false}});
  const fork=await rehashEvent({...e2,previousEventDigest:null});
  for(const history of [{...b.archive,events:[e2,e1]},{...b.archive,events:[e1,{...e2,eventDigest:'0'.repeat(64)}]},{...b.archive,events:[e1,bad]},{...b.archive,events:[e1,fork]},{...b.archive,events:[e1,e1]},{...b.archive,schemaVersion:2},{...b.archive,studentId:'demo-student'}])
   expect((await validateDocumentHistory(history,approved)).valid).toBe(false);
  let accessed=false;const raw={...b.archive};Object.defineProperty(raw,'events',{enumerable:true,get(){accessed=true;return b.archive.events;}});
  expect((await validateDocumentHistory(raw,approved)).valid).toBe(false);expect(accessed).toBe(false);
 });
 test('detaches requests, does not confer authentication or wire production storage',async()=>{
  const r=await first(),q=append(r),a=await step(blank(),q);
  const copy=JSON.parse(JSON.stringify(a.archive)),v=await validateDocumentHistory(copy,approved);
  if(!v.valid)throw Error(v.issue);
  copy.events[0].operation.record.preview.content.summary[0].text='Mutato';
  expect(JSON.stringify(v.archive)).not.toContain('Mutato');
  expect(Object.isFrozen(v.archive.events)).toBe(true);expect(Object.isFrozen(v.heads)).toBe(true);
  for(const bad of [{...q,mode:'PRODUCTION'},{...q,eventId:'invalid'},{...q,studentId:'demo-student'},{...q,operation:{kind:'append',record:{...r,contentDigest:'0'.repeat(64)}}}])
   expect((await applyDocumentHistoryOperation(blank(),approved,bad)).valid).toBe(false);
  for(const path of ['src/App.tsx','src/main.tsx','src/security/secureAppStorage.ts','src/security/backupPayload.ts'])expect(readFileSync(path,'utf8')).not.toMatch(/validateDocumentHistory|applyDocumentHistoryOperation/);
 });
});
