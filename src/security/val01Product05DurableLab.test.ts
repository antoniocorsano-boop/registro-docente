import {describe,test,expect} from 'bun:test';
import type {AppData,AppSettings,ClassData} from '../types';
import type {SecureAppSnapshot,SecureMeta} from './secureAppStorage';
import {SecureAppStorage} from './secureAppStorage';
import {SecureVault} from './secureVault';
import type {VaultStore} from './vaultStore';
import type {VaultMetadataV1,EncryptedVaultRecord,VaultRecordKey} from './vaultTypes';
import {assertNoUnsupportedDocumentHistory} from './documentHistoryBackupFence';
import {createBackupPayload,normalizeBackupPayload} from './backupPayload';
import {createAssessmentBackupPayloadV7} from './assessmentBackupPayload';
import {boardDocument,boardScope} from '../../tests/browser/fixtures/val01-s6c-data';
import {prepareFormativeBalance,confirmFormativeBalance} from '../assessment/formativeBalance';
import {prepareFormativeBalanceCommitPreflight} from '../assessment/formativeBalanceCommitPreflight';
import type {FormativeBalanceCommitCandidateV1} from '../assessment/formativeBalanceCommitPreflight';
import {commitFormativeHistoryLaboratory,type FormativeHistoryLaboratoryOwner,
 type FormativeHistoryCommittedState} from '../persistence/formativeHistoryLaboratoryCommit';
import {createDurableMutationCoordinator} from '../persistence/durableMutationCoordinator';

const settings:Pick<AppSettings,'year'|'subject'>={year:boardScope.schoolYear,subject:boardScope.subjectCode};
const context={classId:boardScope.classId,schoolYear:boardScope.schoolYear,subjectCode:boardScope.subjectCode,
 studentId:'s1',period:'Q1' as const,from:'2026-09-01',to:'2027-01-31'};
const request={id:'balance-test-1',recordedAt:'2027-02-01T10:02:00.000Z',expectedHeadDigest:null};
function cls():ClassData{return {id:boardScope.classId,name:'Classe fittizia',
 students:boardScope.studentIds.map(id=>({id,name:'Alunno sintetico'})),
 grades:[],behaviors:[],assessmentEvidenceV1:{version:1,documents:[{document:structuredClone(boardDocument),bindings:[]}]}};}
const initial=():FormativeHistoryCommittedState=>({appData:{classes:[cls()],currentClassId:boardScope.classId},
 meta:{changes:2,lastBackup:null}});
async function sourceCandidate(state:FormativeHistoryCommittedState){
 const c=state.appData.classes[0],doc=c.assessmentEvidenceV1!.documents[0].document;
 const p=await prepareFormativeBalance(doc,boardScope,context,{evidenceRevisionIds:['r-1'],comparisons:[],
  teacherText:{learning:'Apprendimento osservato dal docente',progress:'',nextStep:'Consolidare la filiera'}});
 if(!p.valid)throw Error(p.issue);
 const r=await confirmFormativeBalance(doc,boardScope,context,p.preview,
  {confirmedByTeacher:true,confirmedAt:'2027-02-01T10:00:00.000Z'});
 if(!r.valid)throw Error(r.issue);
 const v=await prepareFormativeBalanceCommitPreflight(c,settings,r.balance);
 if(!v.valid)throw Error(v.issue);
 return v.candidate;
}
const copy=<T>(x:T):T=>structuredClone(x);
const snap=(s:FormativeHistoryCommittedState)=>({appData:copy(s.appData),meta:copy(s.meta),
 settings:null,udas:null,customTests:null,submissions:null,planning:null,library:null,
 professionalMemory:null as never,copilotState:null as never} as SecureAppSnapshot);
function fake(){
 const original=initial();
 let committed=copy(original),physical=copy(original),live=true,permitted=true;
 let writeCount=0,publishCount=0,invalidations=0;
 let badReadback=false,revokeDuringWrite=false,failWrite=false;
 let latchWrite:(()=>void)|null=null,signalWrite:(()=>void)|null=null;
 const writing=new Promise<void>(r=>{signalWrite=r;});
 const owner:FormativeHistoryLaboratoryOwner={
  coordinator:createDurableMutationCoordinator(),
  storage:{
   async saveAppDataAndMeta(appData,meta){
    writeCount++;if(failWrite)throw Error('synthetic disk failure');
    if(latchWrite){signalWrite?.();await new Promise<void>(resolve=>{pendingRelease=resolve;});}
    physical=copy({appData,meta});if(revokeDuringWrite)live=false;
   },
   async loadSnapshot(){return snap(badReadback?committed:physical);}
  },
  isActive:()=>live,laboratoryApproved:()=>permitted,
  getCommitted:()=>copy(committed),
  publish:s=>{publishCount++;committed=copy(s);},
  invalidate:()=>{invalidations++;live=false;}
 };
 let pendingRelease:(()=>void)|null=null;
 return {owner,original,get:()=>copy(committed),physical:()=>copy(physical),
  counters:()=>({writeCount,publishCount,invalidations}),
  fail:()=>{failWrite=true;},mismatch:()=>{badReadback=true;},
  revokeOnWrite:()=>{revokeDuringWrite=true;},revoke:()=>{live=false;},
  denyLab:()=>{permitted=false;},queueGate:()=>{latchWrite=()=>{};return {
    entered:writing,release:()=>pendingRelease?.()
  };},
  corrupt:fn=>{committed=fn(committed);}
 };
}
class MemoryEncryptedStore implements VaultStore{
 private metadata:VaultMetadataV1|null=null;
 private records=new Map<VaultRecordKey,EncryptedVaultRecord>();
 batchKeys:VaultRecordKey[][]=[];
 async getMetadata(){return this.metadata;}
 async putMetadata(m:VaultMetadataV1){this.metadata=m;}
 async getRecord(key:VaultRecordKey){return this.records.get(key)??null;}
 async putRecord(r:EncryptedVaultRecord){this.records.set(r.recordKey as VaultRecordKey,r);}
 async putRecords(records:EncryptedVaultRecord[]){
  this.batchKeys.push(records.map(r=>r.recordKey as VaultRecordKey));
  for(const r of records)this.records.set(r.recordKey as VaultRecordKey,r);
 }
 async deleteRecord(key:VaultRecordKey){this.records.delete(key);}
 async listRecordKeys(){return [...this.records.keys()];}
 async clearAll(){this.records.clear();this.metadata=null;}
}
describe('VAL-01/PRODUCT-05/S7d.2a isolated durable laboratory',()=>{
 test('atomically writes appData+meta, reads exact state, then publishes truthful receipt',async()=>{
  const h=fake(),v=await sourceCandidate(h.get());
  const result=await commitFormativeHistoryLaboratory(h.owner,settings,v,request);
  expect(result).toEqual({id:'balance-test-1',revision:1,verified:true,status:'lab-committed-no-runtime'});
  expect(h.counters()).toEqual({writeCount:1,publishCount:1,invalidations:0});
  expect(h.get().meta.changes).toBe(3);
  expect(h.physical()).toEqual(h.get());
  const saved=(h.get().appData.classes[0] as ClassData&{formativeBalanceHistoryV1:{records:unknown[]}}).formativeBalanceHistoryV1;
  expect(saved.records).toHaveLength(1);
  expect(h.original.appData.classes[0]).not.toHaveProperty('formativeBalanceHistoryV1');
 });
 test('repeat and concurrent same-head append reject without extra writes',async()=>{
  const h=fake(),v=await sourceCandidate(h.get());
  const a=commitFormativeHistoryLaboratory(h.owner,settings,v,request);
  const b=commitFormativeHistoryLaboratory(h.owner,settings,v,{...request,id:'balance-test-2'});
  expect((await a).revision).toBe(1);
  await expect(b).rejects.toThrow('STALE_HEAD');
  await expect(commitFormativeHistoryLaboratory(h.owner,settings,v,request)).rejects.toThrow('STALE_HEAD');
  expect(h.counters()).toEqual({writeCount:1,publishCount:1,invalidations:0});
 });
 test('failure of physical atomic write never publishes and quarantines owner',async()=>{
  const h=fake(),v=await sourceCandidate(h.get());h.fail();
  await expect(commitFormativeHistoryLaboratory(h.owner,settings,v,request)).rejects.toThrow('PERSISTENCE_UNCERTAIN');
  expect(h.counters()).toEqual({writeCount:1,publishCount:0,invalidations:1});
  expect(h.get()).toEqual(h.original);
 });
 test('readback mismatch prevents success and forces new authenticated session',async()=>{
  const h=fake(),v=await sourceCandidate(h.get());h.mismatch();
  await expect(commitFormativeHistoryLaboratory(h.owner,settings,v,request)).rejects.toThrow('READBACK_MISMATCH');
  expect(h.counters()).toEqual({writeCount:1,publishCount:0,invalidations:1});
  expect(h.get()).toEqual(h.original);
 });
 test('revoked session after physical write never yields a save confirmation',async()=>{
  const h=fake(),v=await sourceCandidate(h.get());h.revokeOnWrite();
  await expect(commitFormativeHistoryLaboratory(h.owner,settings,v,request))
   .rejects.toThrow('SESSION_REVOKED_AFTER_WRITE');
  expect(h.counters()).toEqual({writeCount:1,publishCount:0,invalidations:1});
 });
 test('deny nonlaboratory calls, stale source and foreign student before writes',async()=>{
  const h=fake(),v=await sourceCandidate(h.get());h.denyLab();
  await expect(commitFormativeHistoryLaboratory(h.owner,settings,v,request))
   .rejects.toThrow('SESSION_OR_LAB_AUTHORITY_REVOKED');
  expect(h.counters().writeCount).toBe(0);
  const other=fake(),s=await sourceCandidate(other.get());
  await expect(commitFormativeHistoryLaboratory(other.owner,settings,{...s,context:{...s.context,studentId:'other'}},request))
   .rejects.toThrow('STALE_EVIDENCE');
  expect(other.counters().writeCount).toBe(0);
 });
 test('modified latest committed source rejects inside mutation queue',async()=>{
  const h=fake(),v=await sourceCandidate(h.get());
  let release!:()=>void;
  const gate=new Promise<void>(resolve=>{release=resolve;});
  const blocker=h.owner.coordinator.enqueueTask(()=>gate);
  const pending=commitFormativeHistoryLaboratory(h.owner,settings,v,request);
  h.corrupt(s=>{
   const out=copy(s);
   const assessment=out.appData.classes[0].assessmentEvidenceV1!.documents[0].document.assessments.find(x=>x.revisionId==='a2');
   if(!assessment)throw Error('synthetic missing assessment');
   assessment.title='Versione concorrente';
   return out;
  });
  release();await blocker;
  await expect(pending).rejects.toThrow('STALE_EVIDENCE');
  expect(h.counters().writeCount).toBe(0);
 });
 test('existing SecureAppStorage blocks new formative history even after synthetic lab consent',async()=>{
  const store=new MemoryEncryptedStore(),vault=new SecureVault(store);
  await vault.initializeActive('synthetic password for isolated test');
  const storage=new SecureAppStorage(vault),origin=initial();
  await storage.saveAppDataAndMeta(origin.appData,origin.meta);
  let committed=copy(origin),active=true,published=0,invalidations=0;
  const owner:FormativeHistoryLaboratoryOwner={
   coordinator:createDurableMutationCoordinator(),storage,
   isActive:()=>active,laboratoryApproved:()=>true,getCommitted:()=>copy(committed),
   publish:next=>{published++;committed=copy(next);},
   invalidate:()=>{active=false;invalidations++;}
  };
  const v=await sourceCandidate(committed);
  await expect(commitFormativeHistoryLaboratory(owner,settings,v,request))
   .rejects.toThrow('PERSISTENCE_UNCERTAIN');
  expect(invalidations).toBe(1);
  expect(published).toBe(0);
  expect(store.batchKeys).toHaveLength(1);
  vault.lock();
  await expect(storage.loadSnapshot()).rejects.toThrow();
  await vault.unlock('synthetic password for isolated test');
  const restored=await storage.loadSnapshot();
  expect(restored.appData).toEqual(origin.appData);
  expect(restored.meta).toEqual(origin.meta);
  expect((restored.appData?.classes[0] as ClassData&{formativeBalanceHistoryV1?:unknown})
    .formativeBalanceHistoryV1).toBeUndefined();
 });
 test('V6/V7/V8/V9 legacy backup guard refuses new history instead of silent downgrade',async()=>{
  const h=fake(),v=await sourceCandidate(h.get());
  const out=await commitFormativeHistoryLaboratory(h.owner,settings,v,request);
  expect(out.verified).toBe(true);
  const current=h.get();
  expect(()=>assertNoUnsupportedDocumentHistory(current.appData)).toThrow('DOC01_HISTORY_BACKUP_UNSUPPORTED');
  expect(()=>createBackupPayload(current as never)).toThrow('DOC01_HISTORY_BACKUP_UNSUPPORTED');
  await expect(createAssessmentBackupPayloadV7(current,[], '2027-02-01T10:10:00.000Z'))
   .rejects.toThrow('DOC01_HISTORY_BACKUP_UNSUPPORTED');
  expect(()=>normalizeBackupPayload({app:'registro-docente',backupDataVersion:6,exportedAt:'2027-02-01T10:10:00.000Z',
   snapshot:current} as never,current as never)).toThrow('DOC01_HISTORY_BACKUP_UNSUPPORTED');
 });
});
