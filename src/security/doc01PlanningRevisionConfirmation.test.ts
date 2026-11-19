import {describe,expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {createPlanningRevisionReview} from '../documents/planningRevisionConfirmation';
import {proposeDocumentRevision} from '../documents/documentRevisionIdentity';
import {computeDocenteOsTeachingProjectionFingerprint,type DocenteOsTeachingProjectionV1} from '../planning/docenteOsTeachingProjection';
import {previewArenaPlanningContext,bindAcceptedArenaPlanningContext} from '../planning/arenaPlanningContext';
import type {TeachingProfile} from '../planning/types';
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
const ready=(x:unknown=draft())=>{const r=createPlanningRevisionReview(x);if(!r.valid)throw Error(r.issue);return r.review;};
type Preview=ReturnType<typeof ready>['preview'];
const decision=(reviewed:Preview)=>({confirmedByTeacher:true,documentId:reviewed.documentId,revisionId:reviewed.revisionId,reviewed});
describe('DOC-01/D4b2 annual planning revision confirmation',()=>{
 test('derives selected plan and reference-only curriculum; distinct confirmation, no official approval',()=>{
  const x=draft(),r=ready(x);
  expect(r.preview).toMatchObject({official:false,complete:false,labOnly:true,kind:'disciplinary-plan',documentId:'demo-document',revisionId:'demo-revision-one',number:1,content:{planning:{nature:'planned',udas:[{title:'Titolo di prova',plannedHours:4,sourcePeriod:'Ottobre / Febbraio'}]},curriculum:{status:'reference-only',annualReferenceCount:1,objectives:null}}});
  expect(JSON.stringify(r.preview.content)).not.toMatch(/demo-|Testo fittizio|Titolo non selezionato|sourceCommit|projectionHash/);
  expect(r.status(x)).toBe('draft');expect(r.confirm(x,decision(r.preview))).toEqual({valid:true,confirmed:true,official:false,complete:false});expect(r.status(x)).toBe('confirmed');expect(r.confirm(x,decision(r.preview)).valid).toBe(false);
  expect(Object.isFrozen(r.preview.content.curriculum)).toBe(true);
 });
 test('separates first year and council contribution with no collegial authority',()=>{
  expect(ready(draft(1)).preview.content.planning.placement).toBe('supporting-plan');
  const c=ready(draft(2,'council-contribution')).preview;
  expect(c.kind).toBe('council-disciplinary-contribution');expect(c.content.planning.model).toBe('council-contribution');expect(c.content.planning.excluded).toContain('council-approval');expect(c.content.planning.excluded).toContain('collegial-profile');
 });
 test('missing curriculum stays missing and missing planning blocks; no unsupported supplement',()=>{
  const x=draft();expect(ready({...x,source:{...x.source,arena:null}}).preview.content.curriculum).toEqual({status:'missing',annualReferenceCount:null,objectives:null});
  for(const source of [{...x.source,planning:null},{...x.source,arena:{...x.source.arena,selection:{...x.source.arena.selection,confirmedByTeacher:false}}},{...x.source,supplement:{contract:'future'}}])expect(createPlanningRevisionReview({...x,source}).valid).toBe(false);
 });
 test('refuses nonannual scope, mismatched class, destination and unreviewed model',()=>{
  const x=draft();for(const y of [{...x,revision:{...x.revision,period:{from:'2026-10-01',to:'2027-08-31'}}},{...x,revision:{...x.revision,kind:'final-report'}},{...x,source:{...x.source,scope:{...x.source.scope,classId:'demo-other'}}},{...x,source:{...x.source,bindings:[]}}])expect(createPlanningRevisionReview(y).valid).toBe(false);
 });
 test('changed acceptance even with identical visible content invalidates permanently',()=>{
  const x=draft(),r=ready(x);expect(r.confirm(x,decision(r.preview)).valid).toBe(true);
  const {wrap}=planningFixture();const accepted=wrap(undefined,'2026-11-19T02:00:00.000Z');
  const y={...x,source:{...x.source,planning:{accepted:[accepted],selection:{...x.source.planning.selection,acceptedAt:accepted.acceptedAt}}}};
  expect(ready(y).preview).toEqual(r.preview);expect(r.status(y)).toBe('review-required');expect(r.status(x)).toBe('review-required');
 });
 test('changed non-displayed annual curriculum text invalidates prior review',()=>{
  const x=draft(),r=ready(x);expect(r.confirm(x,decision(r.preview)).valid).toBe(true);
  const {payload,accept}=arenaFixture();const a=accept({...payload,curricoloItems:[{...payload.curricoloItems[0],text:'Testo fittizio modificato'}]});
  const y={...x,source:{...x.source,arena:{...x.source.arena,accepted:[a],selection:{...x.source.arena.selection,contextId:a.id}}}};
  expect(ready(y).preview).toEqual(r.preview);expect(r.status(y)).toBe('review-required');
 });
 test('revision changes and tampered decisions do not inherit confirmation',()=>{
  const x=draft(),r=ready(x);const d=decision(r.preview);
  for(const bad of [{...d,confirmedByTeacher:false},{...d,revisionId:'demo-other'},{...d,reviewed:{...r.preview,number:99}}])expect(r.confirm(x,bad).valid).toBe(false);
  expect(r.confirm(x,d).valid).toBe(true);const h=proposeDocumentRevision(x.revision);if(!h.valid)throw Error(h.issue);
  const y={...x,revision:{...x.revision,history:h.history,request:{expectedHead:'demo-revision-one',revisionId:'demo-revision-two',reason:'source-update'}}};const next=ready(y);expect(next.status(y)).toBe('draft');expect(next.confirm(y,d).valid).toBe(false);expect(r.status(y)).toBe('review-required');
 });
 test('revocation terminal, explicit and revision-specific; missing curriculum becoming available invalidates',()=>{
  const x=draft(),r=ready(x);expect(r.confirm(x,decision(r.preview)).valid).toBe(true);expect(r.revoke({revokedByTeacher:true,documentId:'demo-other',revisionId:'demo-revision-one'})).toBe(false);
  expect(r.revoke({revokedByTeacher:true,documentId:'demo-document',revisionId:'demo-revision-one'})).toBe(true);expect(r.status(x)).toBe('revoked');expect(r.confirm(x,decision(r.preview)).valid).toBe(false);
  const y={...x,source:{...x.source,arena:null}},q=ready(y);expect(q.status(x)).toBe('review-required');
 });
 test('rejects private data, invented payload and accessor; no production wiring',()=>{
  const x=draft();for(const y of [{...x,mode:'PRODUCTION'},{...x,content:{}},{...x,source:{...x.source,students:[]}},{...x,revision:{...x.revision,kind:'individual-feedback'}}])expect(createPlanningRevisionReview(y).valid).toBe(false);
  let accessed=false;const bad={...x};Object.defineProperty(bad,'source',{enumerable:true,get(){accessed=true;return x.source;}});expect(createPlanningRevisionReview(bad).valid).toBe(false);expect(accessed).toBe(false);
  for(const path of ['src/App.tsx','src/main.tsx','src/components/documents/UnifiedDocumentPreview.tsx'])expect(readFileSync(path,'utf8')).not.toContain('createPlanningRevisionReview');
 });
});
