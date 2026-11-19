import {describe,expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {createPlannedDocumentContentReview} from '../documents/plannedDocumentContent';
import {computeDocenteOsTeachingProjectionFingerprint,type DocenteOsTeachingProjectionV1} from '../planning/docenteOsTeachingProjection';
const fixture=(grade:1|2|3=2,purpose='disciplinary-plan')=>{
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
const review=(input:unknown=fixture().input)=>createPlannedDocumentContentReview(input);
describe('DOC-01/D2b1 selected UDA content with institutional mapping',()=>{
 test('transcribes only the selected UDA with the literal source period and planned hours',()=>{
  const r=review();expect(r.status).toBe('available');if(!r.review)throw Error('unavailable');
  expect(r.review.presentation).toMatchObject({model:'disciplinary-second-third',placement:'planned-uda',origin:'docente-os',nature:'planned',official:false,complete:false,udas:[{title:'Titolo di prova',focus:'Tema dimostrativo',sourcePeriod:'Ottobre / Febbraio',plannedHours:4}]});
  const serialized=JSON.stringify(r.review.presentation);
  expect(serialized).not.toMatch(/demo-|Titolo non selezionato|Tema non selezionato|projectionHash|packRefs|quadrimestre|completedActivities/);
  expect(r.review.presentation.unfilled).toContain('term-content');
  expect(r.review.presentation.unfilled).toContain('disciplinary-objectives');
  expect(r.review.presentation.unfilled).toContain('skills');
  expect(r.review.presentation.unfilled).not.toContain('planned-uda');
 });
 test('first-year UDA is supporting material, not a substitute for curriculum fields',()=>{
  const r=review(fixture(1).input);if(!r.review)throw Error('unavailable');
  expect(r.review.presentation.placement).toBe('supporting-plan');
  for(const field of ['core-domains','expected-competences','specific-objectives','knowledge'])expect(r.review.presentation.unfilled).toContain(field);
 });
 test('third-year and council contribution preserve different placement and authority',()=>{
  const third=review(fixture(3).input);expect(third.review?.presentation.model).toBe('disciplinary-second-third');
  const c=review(fixture(2,'council-contribution').input);if(!c.review)throw Error('unavailable');
  expect(c.review.presentation.model).toBe('council-contribution');expect(c.review.presentation.excluded).toContain('council-approval');expect(c.review.presentation.excluded).toContain('collegial-profile');expect(c.review.presentation.excluded).toContain('class-composition');
 });
 test('distinguishes missing and unreviewed model or planning selection',()=>{
  const {input}=fixture();
  expect(review({...input,bindings:[]}).status).toBe('model-missing');
  expect(review({...input,bindings:[...input.bindings,...input.bindings]}).status).toBe('model-review-required');
  expect(review({...input,modelSelection:{...input.modelSelection,confirmedByTeacher:false}}).status).toBe('model-review-required');
  expect(review({...input,planning:null}).status).toBe('planning-missing');
  expect(review({...input,planning:{...input.planning,accepted:[]}}).status).toBe('planning-review-required');
 });
 test('rejects provisional, duplicate or invalid selected UDA and unconfirmed section',()=>{
  const {input,raw,wrap}=fixture();
  const a=wrap({...raw,classes:[{...raw.classes[0],sectionStatus:'PROVVISORIA'}]});
  expect(review({...input,planning:{accepted:[a],selection:{...input.planning.selection,projectionHash:a.projection.projectionFingerprint.hash}}}).status).toBe('planning-review-required');
  for(const udaIds of [[],['wrong'],[input.planning.selection.udaIds[0],input.planning.selection.udaIds[0]]])expect(review({...input,planning:{...input.planning,selection:{...input.planning.selection,udaIds}}}).status).toBe('planning-review-required');
 });
 test('single context prevents mismatched class, subject, year and regime',()=>{
  const {input}=fixture();
  expect(review({...input,scope:{...input.scope,classId:'demo-other'},modelSelection:{...input.modelSelection,scope:{...input.scope,classId:'demo-other'}}}).status).toBe('planning-review-required');
  expect(review({...input,scope:{...input.scope,subjectCode:'matematica'},modelSelection:{...input.modelSelection,scope:{...input.scope,subjectCode:'matematica'}}}).status).toBe('planning-review-required');
  expect(review({...input,scope:{...input.scope,regimeRef:'wrong'}}).status).toBe('model-missing');
  expect(review({...input,scope:{...input.scope,schoolYear:'2027/2028'}}).status).toBe('unsupported');
 });
 test('requires re-review on changed title, focus, selection or acceptance even with equal planned hours',()=>{
  const {input,raw,wrap}=fixture();const r=review(input);if(!r.review)throw Error('unavailable');
  expect(r.review.confirm(structuredClone(input))).toEqual({valid:true,confirmed:true,official:false,complete:false});
  for(const patch of [{title:'Titolo rivisto'},{focus:'Tema rivisto'}]){
   const a=wrap({...raw,classes:[{...raw.classes[0],udas:[{...raw.classes[0].udas[0],...patch},raw.classes[0].udas[1]]}]});
   const next={...input,planning:{accepted:[a],selection:{...input.planning.selection,projectionHash:a.projection.projectionFingerprint.hash}}};
   expect(review(next).status).toBe('available');expect(r.review.isCurrent(next)).toBe(false);
  }
  const a=wrap(raw,'2026-11-19T02:00:00.000Z');
  expect(r.review.confirm({...input,planning:{accepted:[a],selection:{...input.planning.selection,acceptedAt:a.acceptedAt}}})).toEqual({valid:false});
  expect(r.review.isCurrent({...input,planning:{...input.planning,selection:{...input.planning.selection,udaIds:[raw.classes[0].udas[1].projectedUdaId]}}})).toBe(false);
  expect(r.review.isCurrent(fixture(2,'council-contribution').input)).toBe(false);
 });
 test('detaches, rejects non-JSON/accessor/sparse and unexpected personal-shaped properties',()=>{
  const {input}=fixture();const before=JSON.stringify(input);const r=review(input);if(!r.review)throw Error('unavailable');
  expect(JSON.stringify(input)).toBe(before);expect(Object.isFrozen(r.review.presentation.udas[0])).toBe(true);expect(Object.isFrozen(r.review.presentation.udas)).toBe(true);
  let accessed=false;const accessor={...input};Object.defineProperty(accessor,'planning',{enumerable:true,get(){accessed=true;return input.planning;}});
  expect(review(accessor).status).not.toBe('available');expect(accessed).toBe(false);
  expect(review({...input,classes:[{...input.classes[0],students:[]}]}).status).not.toBe('available');
  const sparse=new Array(2);sparse[0]=input.planning.selection.udaIds[0];
  expect(review({...input,planning:{...input.planning,selection:{...input.planning.selection,udaIds:sparse}}}).status).not.toBe('available');
  input.planning.accepted[0].projection.classes[0].udas[0].title='Alterato';
  expect(r.review.presentation.udas[0].title).toBe('Titolo di prova');expect(r.review.isCurrent(input)).toBe(false);
 });
 test('isolated from production and no storage, export or network',()=>{
  for(const path of ['src/App.tsx','src/main.tsx','src/components/documents/UnifiedDocumentPreview.tsx'])expect(readFileSync(path,'utf8')).not.toContain('createPlannedDocumentContentReview');
  const source=readFileSync('src/documents/plannedDocumentContent.ts','utf8');expect(source).not.toMatch(/localStorage|indexedDB|fetch\(|SecureStorage|window\.print|writeFile/);
 });
});
