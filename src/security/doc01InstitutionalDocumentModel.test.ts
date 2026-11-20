import {describe,expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {reviewInstitutionalDocumentModel} from '../documents/institutionalDocumentModel';
const classes=[{id:'demo-first',name:'1C'},{id:'demo-second',name:'2C'},{id:'demo-third',name:'3C'}];
const make=(grade=1,purpose='disciplinary-plan')=>{
 const scope={institutionRef:'demo-school',siteRef:'demo-site',classId:classes[grade-1].id,cohortRef:'demo-cohort-'+grade,schoolYear:'2026/2027',schoolOrder:'lower_secondary',gradeLevel:grade,subjectCode:'tecnologia',regimeRef:'demo-regime-'+grade,purpose};
 const model=purpose==='council-contribution'?'council-contribution':grade===1?'disciplinary-first':'disciplinary-second-third';
 const binding={model,version:'2026-27-map-v1',institutionRef:scope.institutionRef,siteRef:scope.siteRef,cohortRef:scope.cohortRef,schoolYear:scope.schoolYear,schoolOrder:scope.schoolOrder,gradeLevel:scope.gradeLevel,regimeRef:scope.regimeRef,referenceStatus:'reviewed-reference'};
 const selection={confirmedByTeacher:true,scope,model,version:binding.version};
 return {scope,binding,selection};
};
const review=(grade=1,purpose='disciplinary-plan')=>{const f=make(grade,purpose);return reviewInstitutionalDocumentModel(f.scope,classes,[f.binding],f.selection);};
describe('DOC-01/D2a institutional reference mapping',()=>{
 test('first-year structure has core domains, expected competences, specific objectives and knowledge',()=>{
  const r=review();expect(r.status).toBe('available');if(!r.review)throw Error('reference unavailable');
  expect(r.review.model).toBe('disciplinary-first');expect(r.review.fields.map(f=>f.key)).toContain('core-domains');expect(r.review.fields.map(f=>f.key)).toContain('specific-objectives');expect(r.review.fields.map(f=>f.key)).not.toContain('term-content');
  expect(r.review.official).toBe(false);expect(r.review.complete).toBe(false);
 });
 test('second and third use term content, UDA, descriptors, tasks and skills',()=>{
  for(const grade of [2,3]){const r=review(grade);if(!r.review)throw Error('reference unavailable');expect(r.review.model).toBe('disciplinary-second-third');for(const key of ['term-content','planned-uda','observable-descriptors','significant-tasks','skills','knowledge'])expect(r.review.fields.map(f=>f.key)).toContain(key);expect(r.review.fields.find(f=>f.key==='observable-descriptors')?.nature).toBe('expected');}
 });
 test('council contribution keeps collegial approval and profile outside disciplinary authority',()=>{
  const r=review(2,'council-contribution');if(!r.review)throw Error('reference unavailable');
  for(const key of ['council-approval','shared-objectives','collegial-profile','common-assessment-criteria'])expect(r.review.fields.find(f=>f.key===key)).toMatchObject({confirmation:'council',disposition:'collegial-only',destination:'collegial-only'});
  expect(r.review.fields.find(f=>f.key==='collegial-profile')?.privacy).toBe('restricted');
 });
 test('no binding, unverified, ambiguous and stale mapping are distinct',()=>{
  const {scope,binding,selection}=make(2);
  expect(reviewInstitutionalDocumentModel(scope,classes,[],selection).status).toBe('missing');
  expect(reviewInstitutionalDocumentModel(scope,classes,[{...binding,referenceStatus:'unverified'}],selection).status).toBe('review-required');
  expect(reviewInstitutionalDocumentModel(scope,classes,[binding,binding],selection).status).toBe('review-required');
  expect(reviewInstitutionalDocumentModel(scope,classes,[{...binding,version:'future-map'}],{...selection,version:'future-map'}).status).toBe('review-required');
  expect(reviewInstitutionalDocumentModel(scope,classes,[binding],{...selection,confirmedByTeacher:false}).status).toBe('review-required');
 });
 test('regime, site, institution and cohort are never inferred from grade',()=>{
  const {scope,binding,selection}=make(2);
  for(const key of ['regimeRef','siteRef','institutionRef','cohortRef'] as const)expect(reviewInstitutionalDocumentModel({...scope,[key]:'other'},classes,[binding],selection).status).toBe('missing');
  expect(reviewInstitutionalDocumentModel(scope,classes,[{...binding,model:'disciplinary-first'}],selection).status).toBe('missing');
  expect(reviewInstitutionalDocumentModel(scope,classes,[binding],{...selection,scope:{...scope,subjectCode:'matematica'}}).status).toBe('review-required');
 });
 test('ambiguous class, personal payload and unsupported years or final models are rejected',()=>{
  const {scope,binding,selection}=make();
  expect(reviewInstitutionalDocumentModel(scope,[...classes,{id:'dup',name:'1 C'}],[binding],selection).status).toBe('invalid-context');
  expect(reviewInstitutionalDocumentModel(scope,[{...classes[0],students:[]}],[binding],selection).status).toBe('invalid-context');
  expect(reviewInstitutionalDocumentModel({...scope,schoolYear:'2025/2026'},classes,[binding],selection).status).toBe('unsupported');
  expect(reviewInstitutionalDocumentModel({...scope,purpose:'final-report'},classes,[binding],selection).status).toBe('unsupported');
  expect(reviewInstitutionalDocumentModel(scope,classes,[{...binding,studentId:'demo-person'}],selection).status).toBe('review-required');
 });
 test('only frozen metadata; restricted fields are excluded and anticipated evidence differs from observations',()=>{
  const r=review(2);if(!r.review)throw Error('reference unavailable');
  expect(r.review.fields.find(f=>f.key==='class-composition')).toMatchObject({privacy:'restricted',disposition:'excluded-restricted'});
  expect(r.review.fields.find(f=>f.key==='planned-uda')?.nature).toBe('planned');
  expect(r.review.fields.find(f=>f.key==='observable-descriptors')?.nature).toBe('expected');
  expect(r.review.fields.find(f=>f.key==='assessment-methods')?.confirmation).toBe('teacher');
  expect(Object.isFrozen(r.review.fields)).toBe(true);expect(Object.isFrozen(r.review.fields[0].origins)).toBe(true);
  expect(JSON.stringify(r.review)).not.toContain('demo-');
 });
 test('no production wiring or persistence',()=>{
  for(const path of ['src/App.tsx','src/main.tsx','src/components/documents/UnifiedDocumentPreview.tsx'])expect(readFileSync(path,'utf8')).not.toContain('reviewInstitutionalDocumentModel');
  const source=readFileSync('src/documents/institutionalDocumentModel.ts','utf8');expect(source).not.toMatch(/localStorage|indexedDB|fetch\(|SecureStorage|window\.print/);
 });
});
