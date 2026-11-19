import {describe,expect,test} from 'bun:test';
import {commitDocumentHistoryOperation,type DocumentHistoryCommittedState,type DocumentHistoryMutationOwner} from '../persistence/documentHistoryCommit';
import {createDurableMutationCoordinator} from '../persistence/durableMutationCoordinator';
import type {SecureAppSnapshot} from './secureAppStorage';
import type {DocumentHistoryV1} from '../documents/documentHistoryTransitions';

const scope={institutionRef:'demo-school',siteRef:'demo-site',classId:'demo-class',cohortRef:'demo-cohort',schoolYear:'2026/2027',schoolOrder:'lower_secondary',gradeLevel:2,subjectCode:'tecnologia',regimeRef:'demo-regime',purpose:'disciplinary-plan'};
const period={from:'2026-09-01',to:'2027-08-31'};
const canonical=(v:unknown):string=>Array.isArray(v)?'['+v.map(canonical).join(',')+']':v!==null&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical((v as Record<string,unknown>)[k])).join(',')+'}':JSON.stringify(v);
async function digest(v:unknown){
 const h=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical(['DOC-01/archive-candidate/v1',v])));
 return Array.from(new Uint8Array(h),b=>b.toString(16).padStart(2,'0')).join('');
}
async function candidate(){
 const unsigned={
  schemaVersion:1,labOnly:true,official:false,complete:false,
  identity:{documentId:'demo-document',kind:'program-completed',scope,period,model:'disciplinary-second-third',mappingVersion:'2026-27-map-v1'},
  revision:{revisionId:'demo-revision-one',number:1,previousRevisionId:null,reason:'initial',state:'draft'},
  confirmedAt:'2026-11-19T16:00:00.000Z',confirmedByTeacher:true,
  preview:{official:false,complete:false,labOnly:true,kind:'program-completed',documentId:'demo-document',revisionId:'demo-revision-one',number:1,
   content:{official:false,complete:false,labOnly:true,coverage:'selected-only',period,
    recorded:{status:'selected',count:1,hours:1,activities:[{date:'2026-11-17',hours:1,title:'Attività dimostrativa'}]},
    coverageAssessment:'not-established',institutionalModel:'reference-only'}}
 };
 return {...unsigned,contentDigest:await digest(unsigned)};
}
const operation=async(eventId='demo-event-one')=>({mode:'SYNTHETIC_ONLY',eventId,expectedHead:null,operation:{kind:'append',record:await candidate()}});
const copy=<T>(x:T):T=>structuredClone(x);
function harness(){
 const initial:DocumentHistoryCommittedState={appData:{classes:[{id:'demo-class',name:'2C',students:[],grades:[],behaviors:[]}],currentClassId:null},meta:{changes:2,lastBackup:null}};
 let committed=copy(initial),physical=copy(initial),active=true,invalidations=0,writes=0,publications=0;
 let failWrite=false,badReadback=false,revokeOnWrite=false;
 const owner:DocumentHistoryMutationOwner={
  coordinator:createDurableMutationCoordinator(),
  storage:{
   async saveAppDataAndMeta(appData,meta){
    writes++;
    if(failWrite)throw Error('DISK_FAILURE');
    physical=copy({appData,meta});
    if(revokeOnWrite)active=false;
   },
   async loadSnapshot(){
    const s=badReadback?committed:physical;
    return {appData:copy(s.appData),meta:copy(s.meta),settings:null,udas:null,customTests:null,submissions:null,planning:null,library:null,professionalMemory:null as never,copilotState:null as never} as SecureAppSnapshot;
   }
  },
  isActive:()=>active,
  getCommitted:()=>copy(committed),
  publish:next=>{publications++;committed=copy(next);},
  invalidate:()=>{invalidations++;active=false;}
 };
 return {owner,initial,read:()=>copy(committed),physical:()=>copy(physical),counts:()=>({writes,publications,invalidations}),
  failWrite:()=>{failWrite=true;},badReadback:()=>{badReadback=true;},revokeOnWrite:()=>{revokeOnWrite=true;},revoke:()=>{active=false;}};
}
describe('DOC-01/D4c3a — guarded, verified document-history persistence (SYNTHETIC_ONLY)',()=>{
 test('validated append persists atomically, verifies readback, then publishes and returns receipt',async()=>{
  const h=harness(),q=await operation();
  const r=await commitDocumentHistoryOperation(h.owner,[scope],q);
  expect(r).toMatchObject({eventId:'demo-event-one',changed:true,verified:true});
  expect(r.headDigest).toMatch(/^[0-9a-f]{64}$/);
  expect(h.counts()).toEqual({writes:1,publications:1,invalidations:0});
  expect(h.read().meta.changes).toBe(3);
  expect(h.read().appData.classes).toEqual(h.initial.appData.classes);
  expect(h.read().appData.documentHistoryV1?.events).toHaveLength(1);
  expect(h.physical()).toEqual(h.read());
 });
 test('exact retry does not write, increment backup changes or alter the current archive',async()=>{
  const h=harness(),q=await operation();
  const first=await commitDocumentHistoryOperation(h.owner,[scope],q);
  const again=await commitDocumentHistoryOperation(h.owner,[scope],copy(q));
  expect(again).toMatchObject({eventId:q.eventId,changed:false,verified:true,headDigest:first.headDigest});
  expect(h.counts()).toEqual({writes:1,publications:1,invalidations:0});
  expect(h.read().meta.changes).toBe(3);
 });
 test('queued same-head requests cannot silently overwrite a committed event',async()=>{
  const h=harness(),a=await operation('demo-event-one'),b=await operation('demo-event-two');
  const first=commitDocumentHistoryOperation(h.owner,[scope],a);
  const second=commitDocumentHistoryOperation(h.owner,[scope],b);
  expect((await first).changed).toBe(true);
  await expect(second).rejects.toThrow('STALE_HEAD');
  expect(h.counts().writes).toBe(1);
  expect(h.read().appData.documentHistoryV1?.events[0].eventId).toBe('demo-event-one');
 });
 test('failed atomic write produces no success receipt or optimistic publish and quarantines session',async()=>{
  const h=harness();h.failWrite();
  await expect(commitDocumentHistoryOperation(h.owner,[scope],await operation())).rejects.toThrow('PERSISTENCE_UNCERTAIN');
  expect(h.counts()).toEqual({writes:1,publications:0,invalidations:1});
  expect(h.read()).toEqual(h.initial);
 });
 test('mismatched physical readback never publishes or claims durability',async()=>{
  const h=harness();h.badReadback();
  await expect(commitDocumentHistoryOperation(h.owner,[scope],await operation())).rejects.toThrow('READBACK_MISMATCH');
  expect(h.counts()).toEqual({writes:1,publications:0,invalidations:1});
  expect(h.read()).toEqual(h.initial);
 });
 test('session revoked after a physical write fails closed and cannot publish a receipt',async()=>{
  const h=harness();h.revokeOnWrite();
  await expect(commitDocumentHistoryOperation(h.owner,[scope],await operation())).rejects.toThrow('SESSION_REVOKED');
  expect(h.counts().publications).toBe(0);
  expect(h.counts().invalidations).toBe(1);
 });
 test('unapproved scope rejects before any write or state change',async()=>{
  const h=harness();
  await expect(commitDocumentHistoryOperation(h.owner,[],await operation())).rejects.toThrow('INVALID_SCOPE');
  expect(h.counts().writes).toBe(0);
  expect(h.counts().publications).toBe(0);
 });
 test('malformed or altered stored history rejects before another append',async()=>{
  const h=harness(),q=await operation();
  const first=await commitDocumentHistoryOperation(h.owner,[scope],q);
  expect(first.changed).toBe(true);
  const corrupt=h.read();
  const bogus={schemaVersion:1,labOnly:true,events:[{...corrupt.appData.documentHistoryV1!.events[0],eventDigest:'0'.repeat(64)}]} as DocumentHistoryV1;
  const owner={...h.owner,getCommitted:()=>({...h.read(),appData:{...h.read().appData,documentHistoryV1:bogus}})};
  await expect(commitDocumentHistoryOperation(owner,[scope],await operation('demo-event-two'))).rejects.toThrow('INVALID_HISTORY');
  expect(h.counts().writes).toBe(1);
 });
});
