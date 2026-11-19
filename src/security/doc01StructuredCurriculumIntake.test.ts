import {describe,expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {reviewStructuredCurriculumIntake} from '../documents/structuredCurriculumIntake';
import {previewArenaPlanningContext,bindAcceptedArenaPlanningContext} from '../planning/arenaPlanningContext';
import type {TeachingProfile} from '../planning/types';

function fixture(grade:1|2|3=2,purpose='disciplinary-plan'){
 const regimeRef=grade===1?'Regime 2025':'Regime 2012';
 const scope={institutionRef:'demo-school',siteRef:'demo-site',classId:'demo-class',cohortRef:'demo-cohort-'+grade,schoolYear:'2026/2027',schoolOrder:'lower_secondary',gradeLevel:grade,subjectCode:'tecnologia',regimeRef,purpose};
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
const review=(v:unknown=fixture().input)=>reviewStructuredCurriculumIntake(v);
describe('DOC-01/D2b2b fail-closed preparation of structured curriculum intake',()=>{
 test('Arena LAB contract and either synthetic marker always rejected; no fields or source text exposed',()=>{
  const {input}=fixture();
  // Boundary markers from Arena PR #352 R1, not a claim of actual producer output.
  for(const supplement of [{contract:'ARENA_REGISTRO_STRUCTURED_CONTENT_LAB_V1',labOnly:true,authority:'SYNTHETIC_ONLY',items:[{kind:'objective',text:'Testo fittizio'}]},{contract:'ARENA_REGISTRO_STRUCTURED_CONTENT_LAB_V1',labOnly:false,authority:'APPROVED'},{contract:'future',labOnly:true},{contract:'future',authority:'SYNTHETIC_ONLY'}]){
   const r=review({...input,supplement});expect(r).toEqual({status:'lab-rejected',canAcquire:false,official:false,complete:false,placements:[],annualReferenceCount:null});
  }
 });
 test('no unrecognized productive contract can be promoted by a receipt or fingerprint claim',()=>{
  const {input}=fixture();const r=review({...input,supplement:{contract:'ARENA_REGISTRO_STRUCTURED_CONTENT_V1',authority:'APPROVED',vigency:'VIGENTE',authorityReceiptRef:'demo-receipt',fingerprint:{algorithm:'SHA-256',hash:'a'.repeat(64)}}});
  expect(r.status).toBe('unsupported-contract');expect(r.canAcquire).toBe(false);expect(r.placements).toEqual([]);
 });
 test('existing V1 remains reference-only; missing supplement stays distinct; no objective values',()=>{
  const {input,payload}=fixture();
  for(const [supplement,status] of [[null,'supplement-missing'],[payload,'reference-only']] as const){
   const r=review({...input,supplement});expect(r.status).toBe(status);expect(r.annualReferenceCount).toBe(1);expect(r.canAcquire).toBe(false);expect(r.placements.length).toBe(7);expect(r.placements.every(p=>p.state==='unfilled'&&p.nature==='expected')).toBe(true);
   expect(JSON.stringify(r)).not.toMatch(/Testo fittizio|demo-receipt|demo-revision|demo-annual-item/);
  }
 });
 test('first year preserves separate nuclei, competence, knowledge and objective specificity review',()=>{
  const r=review(fixture(1).input);expect(r.placements.find(p=>p.kind==='core-theme')).toMatchObject({field:'core-domains',disposition:'candidate-field'});expect(r.placements.find(p=>p.kind==='competence')?.field).toBe('expected-competences');expect(r.placements.find(p=>p.kind==='knowledge')?.field).toBe('knowledge');expect(r.placements.find(p=>p.kind==='objective')).toMatchObject({field:'specific-objectives',disposition:'specificity-review'});expect(r.placements.find(p=>p.kind==='milestone')).toMatchObject({field:null,disposition:'support-only'});
 });
 test('second and third grades keep skills and expected descriptors distinct from assessment outcomes',()=>{
  for(const grade of [2,3] as const){const r=review(fixture(grade).input);expect(r.placements.find(p=>p.kind==='skill')?.field).toBe('skills');expect(r.placements.find(p=>p.kind==='evidence')).toMatchObject({field:'observable-descriptors',nature:'expected',state:'unfilled'});expect(r.placements.find(p=>p.kind==='objective')).toMatchObject({field:'disciplinary-objectives',disposition:'specificity-review'});expect(r.placements.find(p=>p.kind==='competence')?.field).toBeNull();}
 });
 test('council contribution never allocates the shared collegiate or reserved fields',()=>{
  const r=review(fixture(2,'council-contribution').input);expect(r.placements.filter(p=>p.field!==null).map(p=>p.field)).toEqual(['disciplinary-objectives']);expect(JSON.stringify(r)).not.toMatch(/shared-objectives|collegial-profile|class-composition|council-approval/);
 });
 test('model, scope and current curriculum are independently reviewed through D2a and D1d2',()=>{
  const {input,payload,accept}=fixture();expect(review({...input,bindings:[]}).status).toBe('model-review-required');expect(review({...input,scope:{...input.scope,regimeRef:'wrong'}}).status).toBe('model-review-required');expect(review({...input,arena:{...input.arena,selection:{...input.arena.selection,sourceRevisionId:'wrong'}}}).status).toBe('curriculum-review-required');
  const provisional=accept({...payload,authorityState:'PROVISIONAL_COMPLETE',vigencyStatus:'NON_VIGENTE',authorityReceiptRef:null});expect(review({...input,arena:{...input.arena,accepted:[provisional]}}).status).toBe('curriculum-review-required');expect(review({...input,arena:{...input.arena,selection:{...input.arena.selection,confirmedByTeacher:false}}}).status).toBe('curriculum-review-required');
 });
 test('rejects accessor roots, leaves the result immutable and does not add production wiring',()=>{
  const {input}=fixture();let accessed=false;const bad={...input};Object.defineProperty(bad,'supplement',{enumerable:true,get(){accessed=true;return null;}});expect(review(bad).status).toBe('invalid-input');expect(accessed).toBe(false);
  const r=review(input);expect(Object.isFrozen(r)).toBe(true);expect(Object.isFrozen(r.placements)).toBe(true);expect(Object.isFrozen(r.placements[0])).toBe(true);expect(review({...input,studentId:'demo-student'}).status).toBe('invalid-input');
  for(const path of ['src/App.tsx','src/main.tsx','src/components/documents/UnifiedDocumentPreview.tsx'])expect(readFileSync(path,'utf8')).not.toContain('reviewStructuredCurriculumIntake');
 });
});
