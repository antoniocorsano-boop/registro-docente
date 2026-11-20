import { describe, expect, test } from 'bun:test';
import { reviewPlanningDocumentSource } from '../documents/planningDocumentSource';
import { computeDocenteOsTeachingProjectionFingerprint, type DocenteOsTeachingProjectionV1 } from '../planning/docenteOsTeachingProjection';
import { readFileSync } from 'node:fs';
const scope={institutionRef:'demo-school',cohortRef:'demo-cohort',classId:'demo-class',schoolYear:'2026/2027',subjectCode:'tecnologia',gradeLevel:2};
const classes=[{id:'demo-class',name:'2C'},{id:'demo-other',name:'2A'}];
const raw:Omit<DocenteOsTeachingProjectionV1,'projectionFingerprint'>={
  contract:'DOCENTE_OS_REGISTRO_TEACHING_PROJECTION_V1',contractVersion:1,sourceProduct:'DOCENTE_OS',targetProduct:'REGISTRO_DOCENTE',importMode:'READ_ONLY_PROJECTION',acceptanceRequired:true,automaticWriteAllowed:false,schoolYear:'2026/2027',disciplineName:'Tecnologia',generatedAt:'2026-11-19T00:00:00.000Z',provenance:{repository:'antoniocorsano-boop/docente-os-2026-27',sourceCommit:'a'.repeat(40),sourceBranch:'demo'},privacyClass:'PROFESSIONAL_NON_PERSONAL',
  classes:[{sourceSectionId:'demo-section',grade:2,sectionCode:'C',compactLabel:'2C',displayLabel:'2ª C',sectionStatus:'CONFERMATA',canonicalPlan:{code:'demo-plan',assetId:'demo-asset',generationId:'demo-gen'},udas:[{sourceUdaRef:'demo-uda',projectedUdaId:'docente-os:demo-section:demo-gen:demo-uda',title:'Titolo dimostrativo',focus:'Contenuto non riportato',plannedHours:4,period:'Q1',packRefs:['demo-pack'],canonicalGenerationId:'demo-gen'}]}]
};
const wrap=(p:typeof raw=raw)=>({projection:{...p,projectionFingerprint:{algorithm:'SHA-256' as const,hash:computeDocenteOsTeachingProjectionFingerprint(p)}},acceptedAt:'2026-11-19T01:00:00.000Z',classReconciliation:[{sourceSectionId:'demo-section',status:'resolved' as const,registroClassId:'demo-class'}]});
const current=wrap();
const selection={confirmedByTeacher:true,institutionRef:scope.institutionRef,cohortRef:scope.cohortRef,projectionHash:current.projection.projectionFingerprint.hash,acceptedAt:current.acceptedAt,sourceSectionId:'demo-section',udaIds:[raw.classes[0].udas[0].projectedUdaId]};
const review=(s:unknown=scope,c:unknown=classes,a:unknown=[current],r:unknown=selection)=>reviewPlanningDocumentSource(s,c,a,r);
describe('DOC-01/D1d1 selected professional planning source',()=>{
 test('reuses exact accepted confirmed projection and returns only planned references',()=>{
   const r=review();expect(r.valid).toBe(true);if(!r.valid)throw new Error(r.issue);
   expect(r.source).toMatchObject({kind:'planned-uda-references',count:1,official:false,completedActivities:null});
   expect(r.source.references[0]).toMatchObject({udaId:selection.udaIds[0],plannedHours:4});
   expect(JSON.stringify(r.source)).not.toMatch(/Titolo dimostrativo|Contenuto non riportato|demo-pack|sourceBranch|sourceCommit/);
 });
 test('requires explicit teacher-reviewed institution and cohort; no inference',()=>{
   for(const patch of [{confirmedByTeacher:false},{institutionRef:'demo-other'},{cohortRef:'demo-other'}])expect(review(scope,classes,[current],{...selection,...patch}).valid).toBe(false);
 });
 test('requires exact scope and independent current class identity',()=>{
   for(const patch of [{schoolYear:'2027/2028'},{subjectCode:'matematica'},{gradeLevel:1},{classId:'demo-other'}])expect(review({...scope,...patch}).valid).toBe(false);
   expect(review(scope,[...classes,{id:'demo-duplicate',name:'2ª C'}]).valid).toBe(false);
   expect(review(scope,[{id:'demo-replaced',name:'2C'}]).valid).toBe(false);
 });
 test('withholds provisional or unconfirmed sections even with valid fingerprint',()=>{
   for(const sectionStatus of ['PROVVISORIA','DA_CONFERMARE'] as const){
     const a=wrap({...raw,classes:[{...raw.classes[0],sectionStatus}]});
     expect(review(scope,classes,[a],{...selection,projectionHash:a.projection.projectionFingerprint.hash}).valid).toBe(false);
   }
 });
 test('rejects stale source, altered content and ambiguous acceptance',()=>{
   const changed=wrap({...raw,classes:[{...raw.classes[0],udas:[{...raw.classes[0].udas[0],plannedHours:5}]}]});
   expect(review(scope,classes,[changed]).valid).toBe(false);
   const tampered=structuredClone(current);tampered.projection.classes[0].udas[0].title='Alterato';
   expect(review(scope,classes,[tampered]).valid).toBe(false);
   expect(review(scope,classes,[current,current]).valid).toBe(false);
   expect(review(scope,classes,[{...current,acceptedAt:'2026-11-19T02:00:00.000Z'}]).valid).toBe(false);
 });
 test('never silently selects UDA or accepts unrelated selection',()=>{
   for(const udaIds of [[],['demo-other'],[selection.udaIds[0],selection.udaIds[0]]])expect(review(scope,classes,[current],{...selection,udaIds}).valid).toBe(false);
   expect(review(scope,classes,[current],{...selection,sourceSectionId:'demo-other'}).valid).toBe(false);
 });
 test('requires existing resolved mapping and never retargets',()=>{
   for(const classReconciliation of [[{sourceSectionId:'demo-section',status:'ambiguous'}],[{sourceSectionId:'demo-section',status:'resolved',registroClassId:'demo-other'}]])expect(review(scope,classes,[{...current,classReconciliation}]).valid).toBe(false);
 });
 test('rejects extra personal-shaped fields, preserves inputs and is not wired to production',()=>{
   expect(review({...scope,studentId:'demo-student'}).valid).toBe(false);
   expect(review(scope,[{...classes[0],students:[]}]).valid).toBe(false);
   const before=JSON.stringify([scope,classes,current,selection]);review();expect(JSON.stringify([scope,classes,current,selection])).toBe(before);
   for(const path of ['src/App.tsx','src/main.tsx','src/components/documents/DocumentPlanningPreview.tsx'])expect(readFileSync(path,'utf8')).not.toContain('reviewPlanningDocumentSource');
 });
});
