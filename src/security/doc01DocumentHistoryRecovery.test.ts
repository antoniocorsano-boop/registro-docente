import {describe,expect,test} from 'bun:test';
import {applyDocumentHistoryOperation,type DocumentHistoryV1} from '../documents/documentHistoryTransitions';
import {inspectDocumentHistoryRecovery} from './documentHistoryRecovery';

const scope={institutionRef:'demo-school',siteRef:'demo-site',classId:'demo-class',cohortRef:'demo-cohort',schoolYear:'2026/2027',schoolOrder:'lower_secondary',gradeLevel:2,subjectCode:'tecnologia',regimeRef:'demo-regime',purpose:'disciplinary-plan'};
const period={from:'2026-09-01',to:'2027-08-31'};
const clone=<T>(v:T):T=>structuredClone(v);
const blank=():DocumentHistoryV1=>({schemaVersion:1,labOnly:true,events:[]});
const canonical=(v:unknown):string=>Array.isArray(v)?'['+v.map(canonical).join(',')+']':v!==null&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical((v as Record<string,unknown>)[k])).join(',')+'}':JSON.stringify(v);
async function record(){
 const u={
  schemaVersion:1,labOnly:true,official:false,complete:false,
  identity:{documentId:'demo-document',kind:'program-completed',scope,period,model:'disciplinary-second-third',mappingVersion:'2026-27-map-v1'},
  revision:{revisionId:'demo-revision-one',number:1,previousRevisionId:null,reason:'initial',state:'draft'},
  confirmedAt:'2026-11-19T16:00:00.000Z',confirmedByTeacher:true,
  preview:{official:false,complete:false,labOnly:true,kind:'program-completed',documentId:'demo-document',revisionId:'demo-revision-one',number:1,
   content:{official:false,complete:false,labOnly:true,coverage:'selected-only',period,
    recorded:{status:'selected',count:1,hours:1,activities:[{date:'2026-11-17',hours:1,title:'Attività dimostrativa'}]},
    coverageAssessment:'not-established',institutionalModel:'reference-only'}}
 };
 const h=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical(['DOC-01/archive-candidate/v1',u])));
 const contentDigest=Array.from(new Uint8Array(h),b=>b.toString(16).padStart(2,'0')).join('');
 return {...u,contentDigest};
}
async function create(){
 const r=await record();
 const q={mode:'SYNTHETIC_ONLY',eventId:'demo-event-one',expectedHead:null,operation:{kind:'append',record:r}};
 const first=await applyDocumentHistoryOperation(blank(),[scope],q);
 if(!first.valid)throw Error(first.issue);
 const revoke={mode:'SYNTHETIC_ONLY',eventId:'demo-event-two',expectedHead:first.archive.events[0].eventDigest,
  operation:{kind:'revoke',documentId:r.identity.documentId,revisionId:r.revision.revisionId,
  contentDigest:r.contentDigest,revokedAt:'2026-11-19T16:02:00.000Z',reason:'withdrawn',confirmedByTeacher:true}};
 const second=await applyDocumentHistoryOperation(first.archive,[scope],revoke);
 if(!second.valid)throw Error(second.issue);
 return {old:first.archive,next:second.archive};
}
describe('DOC-01/D4c3c1 — isolated recoverability of immutable document history',()=>{
 test('accepts an exact recovery copy and a newer valid event without rewriting previous bytes',async()=>{
  const {old,next}=await create();
  const result=await inspectDocumentHistoryRecovery(old,next,clone(old),[scope]);
  expect(result).toMatchObject({valid:true,changed:true,archive:next});
  if(!result.valid)throw Error(result.issue);
  expect(Object.isFrozen(result.archive.events[0])).toBe(true);
  expect(result.archive.events[0]).toEqual(old.events[0]);
 });
 test('idempotent restoration never rewrites a valid identical history',async()=>{
  const {old}=await create();
  expect(await inspectDocumentHistoryRecovery(old,clone(old),clone(old),[scope]))
   .toMatchObject({valid:true,changed:false,archive:old});
 });
 test('empty current history may acquire an independently valid synthetic collection',async()=>{
  const {old}=await create();
  expect(await inspectDocumentHistoryRecovery(blank(),old,blank(),[scope]))
   .toMatchObject({valid:true,changed:true,archive:old});
 });
 test('rejects missing predecessor events even when incoming itself validates',async()=>{
  const {old,next}=await create();
  expect(await inspectDocumentHistoryRecovery(next,old,next,[scope]))
   .toEqual({valid:false,issue:'HISTORY_LOSS'});
  expect(await inspectDocumentHistoryRecovery(old,blank(),old,[scope]))
   .toEqual({valid:false,issue:'HISTORY_LOSS'});
 });
 test('rejects a different but independently valid branch of history',async()=>{
  const a=await create(),b=await create();
  const changed=clone(b.old);
  changed.events[0].eventId='demo-event-different';
  // Even a changed self-consistent branch cannot displace a stored prefix.
  // A malformed replacement also fails closed before any promotion.
  const result=await inspectDocumentHistoryRecovery(a.old,changed,a.old,[scope]);
  expect(result.valid).toBe(false);
 });
 test('rejects an altered historical event or chain, regardless of recovery copy',async()=>{
  const {old,next}=await create();
  const changed=clone(next);
  (changed.events[0] as {eventDigest:string}).eventDigest='0'.repeat(64);
  expect((await inspectDocumentHistoryRecovery(old,changed,old,[scope])).valid).toBe(false);
 });
 test('recovery copy must exactly reflect current history, not caller-selected older state',async()=>{
  const {old,next}=await create();
  expect(await inspectDocumentHistoryRecovery(next,next,old,[scope]))
   .toEqual({valid:false,issue:'RECOVERY_MISMATCH'});
 });
 test('independent approved scopes are mandatory for both current and incoming',async()=>{
  const {old,next}=await create();
  expect((await inspectDocumentHistoryRecovery(old,next,old,[])).valid).toBe(false);
  expect((await inspectDocumentHistoryRecovery(old,next,old,[{...scope,subjectCode:'matematica'}])).valid).toBe(false);
 });
 test('no caller alias is modified or returned as writable state',async()=>{
  const {old,next}=await create(),a=clone(old),b=clone(next),r=clone(old);
  const result=await inspectDocumentHistoryRecovery(a,b,r,[scope]);
  expect(result.valid).toBe(true);
  expect(a).toEqual(old);expect(b).toEqual(next);expect(r).toEqual(old);
  if(result.valid)expect(Object.isFrozen(result.archive)).toBe(true);
 });
});
