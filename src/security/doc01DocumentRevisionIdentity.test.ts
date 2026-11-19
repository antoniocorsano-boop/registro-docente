import {describe,expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {proposeDocumentRevision} from '../documents/documentRevisionIdentity';

const input=(kind='disciplinary-plan',grade=2)=>{
 const purpose=kind==='council-disciplinary-contribution'?'council-contribution':'disciplinary-plan';
 const scope={institutionRef:'demo-school',siteRef:'demo-site',classId:'demo-class',cohortRef:'demo-cohort',schoolYear:'2026/2027',schoolOrder:'lower_secondary',gradeLevel:grade,subjectCode:'tecnologia',regimeRef:'demo-regime',purpose};
 const model=purpose==='council-contribution'?'council-contribution':grade===1?'disciplinary-first':'disciplinary-second-third';
 const version='2026-27-map-v1';
 const binding={model,version,institutionRef:scope.institutionRef,siteRef:scope.siteRef,cohortRef:scope.cohortRef,schoolYear:scope.schoolYear,schoolOrder:scope.schoolOrder,gradeLevel:grade,regimeRef:scope.regimeRef,referenceStatus:'reviewed-reference'};
 return {mode:'SYNTHETIC_ONLY',kind,documentId:'demo-document',scope,classes:[{id:scope.classId,name:grade+'C'}],bindings:[binding],modelSelection:{confirmedByTeacher:true,scope,model,version},period:{from:'2026-09-01',to:'2027-08-31'},history:null as unknown,request:{expectedHead:null as string|null,revisionId:'demo-revision-one',reason:'initial'}};
};
const propose=(x:unknown=input())=>proposeDocumentRevision(x);
const first=()=>{const r=propose();if(!r.valid)throw Error(r.issue);return r.history;};
const next=()=>({...input(),history:first(),request:{expectedHead:'demo-revision-one',revisionId:'demo-revision-two',reason:'source-update'}});
describe('DOC-01/D4a — isolated document identity and version lineage',()=>{
 test('creates distinct document categories as draft metadata, never authority or content',()=>{
  for(const kind of ['disciplinary-plan','program-completed','final-report','council-disciplinary-contribution']){
   const r=propose(input(kind));if(!r.valid)throw Error(r.issue);
   expect(r.history).toMatchObject({schemaVersion:1,official:false,complete:false,labOnly:true,identity:{documentId:'demo-document',kind},revisions:[{revisionId:'demo-revision-one',number:1,previousRevisionId:null,reason:'initial',state:'draft'}]});
   expect(JSON.stringify(r.history)).not.toMatch(/studentId|contentDigest|confirmedAt|signedAt|storedAt/);
  }
 });
 test('exact reviewed institutional context, purpose, grade and period are required',()=>{
  const x=input();
  for(const y of [{...x,bindings:[]},{...x,scope:{...x.scope,cohortRef:'demo-other'}},{...x,kind:'council-disciplinary-contribution'},{...x,period:{from:'2026-02-30',to:'2027-08-31'}},{...x,period:{from:'2026-08-31',to:'2027-08-31'}},{...x,modelSelection:{...x.modelSelection,confirmedByTeacher:false}}])expect(propose(y).valid).toBe(false);
  expect(propose(input('disciplinary-plan',1)).valid).toBe(true);
 });
 test('appends a new immutable draft with same document identity and exact predecessor',()=>{
  const x=next();const r=propose(x);if(!r.valid)throw Error(r.issue);
  expect(r.history.identity).toEqual(first().identity);
  expect(r.history.revisions).toEqual([...first().revisions,{revisionId:'demo-revision-two',number:2,previousRevisionId:'demo-revision-one',reason:'source-update',state:'draft'}]);
  expect(Object.isFrozen(r.history.identity.scope)).toBe(true);expect(Object.isFrozen(r.history.revisions[0])).toBe(true);
  expect((x.history as ReturnType<typeof first>).revisions.length).toBe(1);
 });
 test('refuses stale, duplicate or wrong initial requests',()=>{
  const x=next();
  for(const req of [{...x.request,expectedHead:null},{...x.request,expectedHead:'demo-unknown'},{...x.request,revisionId:'demo-revision-one'},{...x.request,reason:'initial'}])expect(propose({...x,request:req}).valid).toBe(false);
  const y=input();expect(propose({...y,request:{...y.request,reason:'correction'}}).valid).toBe(false);
  expect(propose({...y,request:{...y.request,expectedHead:'demo-unknown'}}).valid).toBe(false);
 });
 test('rejects identity drift, cross-document reuse and context substitutions',()=>{
  const x=next();
  for(const y of [{...x,documentId:'demo-other-document'},{...x,kind:'final-report'},{...x,period:{from:'2026-10-01',to:'2027-08-31'}},{...x,history:{...first(),identity:{...first().identity,mappingVersion:'other'}}}])expect(propose(y).valid).toBe(false);
 });
 test('rejects gaps, forks, approval or malformed historical metadata',()=>{
  const x=next(),h=first(),r=h.revisions[0];
  for(const revisions of [[],[{...r,number:2}],[{...r,previousRevisionId:'demo-other'}],[{...r,state:'confirmed'}],[r,{...r,number:2,previousRevisionId:r.revisionId,reason:'correction'}],[{...r,content:'text'}]])expect(propose({...x,history:{...h,revisions}}).valid).toBe(false);
 });
 test('rejects private destinations, content, real mode and extra fields without getter execution',()=>{
  const x=input();
  for(const y of [{...x,kind:'individual-feedback'},{...x,kind:'council-individual-contribution'},{...x,mode:'PRODUCTION'},{...x,studentId:'demo-student'},{...x,documentId:'actual-id'},{...x,request:{...x.request,content:'text'}}])expect(propose(y).valid).toBe(false);
  let accessed=false;const bad={...x.request};Object.defineProperty(bad,'revisionId',{enumerable:true,get(){accessed=true;return 'demo-revision-one';}});
  expect(propose({...x,request:bad}).valid).toBe(false);expect(accessed).toBe(false);
 });
 test('no runtime wiring or persistence',()=>{for(const path of ['src/App.tsx','src/main.tsx','src/components/documents/UnifiedDocumentPreview.tsx'])expect(readFileSync(path,'utf8')).not.toContain('proposeDocumentRevision');});
});
