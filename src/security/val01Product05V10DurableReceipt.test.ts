/** Synthetic V10 lab fixtures: no student identity or professional data. */
import {beforeAll,describe,expect,test} from 'bun:test';
import type {AppSettings,ClassData} from '../types';
import type {CompleteSecureAppSnapshot} from './secureAppStorage';
import type {FormativeV10LabOwner,FormativeV10LabReceiptStore,
 FormativeV10LabRecord} from '../persistence/formativeV10DurableReceiptLab';
import {createFormativeV10DurableReceiptLab} from '../persistence/formativeV10DurableReceiptLab';
import {createDurableMutationCoordinator} from '../persistence/durableMutationCoordinator';
import {SecureVault} from './secureVault';
import type {VaultStore} from './vaultStore';
import type {VaultRecordKey,VaultMetadataV1,EncryptedVaultRecord} from './vaultTypes';
import {createInitialArchiveSnapshot} from './initialArchiveSetup';
import {boardDocument,boardScope} from '../../tests/browser/fixtures/val01-s6c-data';
import {prepareFormativeBalance,confirmFormativeBalance} from '../assessment/formativeBalance';
import {prepareFormativeBalanceCommitPreflight} from '../assessment/formativeBalanceCommitPreflight';
import {proposeFormativeBalanceHistoryAppend} from '../assessment/formativeBalanceHistory';

beforeAll(()=>{const g=globalThis as typeof globalThis&{window?:typeof globalThis};if(!g.window)g.window=globalThis;});
const at='2027-02-01T10:10:00.000Z',pass='synthetic V10 vault password';
const assessmentScopes=[{classId:boardScope.classId,schoolYear:boardScope.schoolYear,subjectCode:boardScope.subjectCode}];
const documentScope={institutionCode:'ZZIC00000A',siteCode:'ZZMM000001',schoolYear:'2026/2027',
 schoolOrder:'lower-secondary' as const,gradeLevel:2 as const,classId:'2C',subjectCode:boardScope.subjectCode,
 purpose:'disciplinary-plan' as const};
const formativeScopes=[boardScope];
const req={assessmentScopes,documentScope,formativeScopes,checkpointAt:at};
const clone=<T>(v:T):T=>structuredClone(v);
function initial():CompleteSecureAppSnapshot{
 const s=createInitialArchiveSnapshot({mode:'professional',
  profile:{school:'Istituto inventato',year:'2026/27',teacher:'Docente inventato',subject:'Tecnologia'}});
 const c:ClassData={id:boardScope.classId,name:'Classe sintetica',
  students:boardScope.studentIds.map(id=>({id,name:'Fittizio '+id})),
  grades:[],behaviors:[],assessmentEvidenceV1:{version:1,
   documents:[{document:clone(boardDocument),bindings:[]}]}};
 s.appData={classes:[c],currentClassId:c.id};
 (s.appData as any).documentHistoryV2={schemaVersion:2,labOnly:false,events:[]};
 s.meta={changes:3,lastBackup:null};
 return s as CompleteSecureAppSnapshot;
}
async function historical():Promise<CompleteSecureAppSnapshot>{
 const s=initial(),c=s.appData.classes[0],doc=c.assessmentEvidenceV1!.documents[0].document;
 const context={classId:boardScope.classId,schoolYear:boardScope.schoolYear,
  subjectCode:boardScope.subjectCode,studentId:'s1',period:'Q1' as const,
  from:'2026-09-01',to:'2027-01-31'};
 const preview=await prepareFormativeBalance(doc,boardScope,context,
  {evidenceRevisionIds:['r-1'],comparisons:[],
   teacherText:{learning:'Relazione docente inventata',progress:'',nextStep:'Verificare gli obiettivi'}});
 if(!preview.valid)throw Error(preview.issue);
 const confirmed=await confirmFormativeBalance(doc,boardScope,context,preview.preview,
  {confirmedByTeacher:true,confirmedAt:'2027-02-01T10:00:00.000Z'});
 if(!confirmed.valid)throw Error(confirmed.issue);
 const preflight=await prepareFormativeBalanceCommitPreflight(c,
  {year:boardScope.schoolYear,subject:boardScope.subjectCode} as AppSettings,confirmed.balance);
 if(!preflight.valid)throw Error(preflight.issue);
 const saved=await proposeFormativeBalanceHistoryAppend(undefined,preflight.candidate,c,
  {year:boardScope.schoolYear,subject:boardScope.subjectCode},
  {id:'synthetic-v10-receipt-1',recordedAt:'2027-02-01T10:00:01.000Z'});
 if(!saved.valid)throw Error(saved.issue);
 (c as ClassData&{formativeBalanceHistoryV1:typeof saved.history}).formativeBalanceHistoryV1=saved.history;
 return s;
}
function harness(start:CompleteSecureAppSnapshot){
 let snapshot=clone(start),record:FormativeV10LabRecord|null=null;
 let live=true,approved=true,writes=0,invalidations=0,failed=false,altered=false,revokeWrite=false;
 const owner:FormativeV10LabOwner={
  coordinator:createDurableMutationCoordinator(),
  isActive:()=>live,laboratoryApproved:()=>approved,
  readCommittedSnapshot:async()=>clone(snapshot),
  invalidate:()=>{live=false;invalidations++;}
 };
 const store:FormativeV10LabReceiptStore={
  syntheticOnly:true,
  read:async()=>altered&&record?{...record,sha256:'0'.repeat(64)}:clone(record),
  write:async x=>{
   writes++;
   if(failed)throw Error('SYNTHETIC_DISK_FAILURE');
   record=clone(x);
   if(revokeWrite)live=false;
  }
 };
 return {owner,store,lab:createFormativeV10DurableReceiptLab(owner,store),
  snapshot:()=>clone(snapshot),record:()=>clone(record),
  mutate:fn=>{snapshot=fn(clone(snapshot));},
  get:()=>({live,approved,writes,invalidations}),
  fail:()=>{failed=true;},tamperRead:()=>{altered=true;},
  revokeInWrite:()=>{revokeWrite=true;},revoke:()=>{live=false;},
  denyLab:()=>{approved=false;},
  seed:r=>{record=clone(r);}
 };
}
class SyntheticEncryptedStore implements VaultStore{
 private metadata:VaultMetadataV1|null=null;
 private records=new Map<VaultRecordKey,EncryptedVaultRecord>();
 async getMetadata(){return this.metadata;}
 async putMetadata(m:VaultMetadataV1){this.metadata=m;}
 async getRecord(k:VaultRecordKey){return this.records.get(k)??null;}
 async putRecord(r:EncryptedVaultRecord){this.records.set(r.recordKey as VaultRecordKey,r);}
 async putRecords(rs:EncryptedVaultRecord[]){for(const r of rs)await this.putRecord(r);}
 async deleteRecord(k:VaultRecordKey){this.records.delete(k);}
 async listRecordKeys(){return [...this.records.keys()];}
 async clearAll(){this.metadata=null;this.records.clear();}
 ciphertext(){return this.records.get('meta')?.ciphertext??null;}
}
async function webVerified(h:ReturnType<typeof harness>){
 const p=await h.lab.prepare(pass,req);
 expect(await h.lab.verifyWeb(p.receipt,new Blob([p.encryptedText]))).toBe('verified');
 return p;
}
describe('VAL-01/PRODUCT-05/S7d.2d — encrypted lab-only durable V10 receipt',()=>{
 test('one-use verified receipt is persisted only after exact state recheck and readback',async()=>{
  const h=harness(await historical()),before=h.snapshot(),p=await webVerified(h);
  const stored=await h.lab.persistVerified(p.receipt);
  expect(stored).toMatchObject({schemaVersion:1,kind:'formative-v10-copy-proof',
   state:'lab-durable-not-official',source:'web-readback',payloadVersion:10,checkpointAt:at,
   includedChanges:3,bytes:p.evidence.bytes,sha256:p.evidence.sha256});
  expect(stored.sourceSnapshotSha256).toMatch(/^[0-9a-f]{64}$/);
  expect(h.record()).toEqual(stored);
  expect(h.get().writes).toBe(1);
  expect(h.snapshot()).toEqual(before);
  expect(h.snapshot().meta).toEqual(before.meta);
  await expect(h.lab.persistVerified(p.receipt)).rejects.toThrow('STALE_RECEIPT');
 });
 test('fabricated proof cannot enter without an instance-owned receipt',async()=>{
  const h=harness(await historical()),p=await webVerified(h);
  await expect(h.lab.persistVerified({...p.receipt})).rejects.toThrow('STALE_RECEIPT');
  expect(h.get().writes).toBe(0);
  const result=await h.lab.persistVerified(p.receipt);
  expect(result.payloadVersion).toBe(10);
 });
 test('same modification count but changed student data is rejected before physical write',async()=>{
  const h=harness(await historical()),p=await webVerified(h);
  h.mutate(s=>{s.appData.classes[0].name='Classe modificata senza incremento contatore';return s;});
  await expect(h.lab.persistVerified(p.receipt)).rejects.toThrow('SOURCE_CHANGED');
  expect(h.get().writes).toBe(0);
 });
 test('changed modification counter blocks acknowledgement and does not alter metadata',async()=>{
  const h=harness(await historical()),p=await webVerified(h);
  h.mutate(s=>{s.meta.changes++;return s;});
  await expect(h.lab.persistVerified(p.receipt)).rejects.toThrow('SOURCE_CHANGED');
  expect(h.get().writes).toBe(0);
 });
 test('synthetic write failure quarantines owner, without retry or success',async()=>{
  const h=harness(await historical()),p=await webVerified(h);h.fail();
  await expect(h.lab.persistVerified(p.receipt)).rejects.toThrow('PERSISTENCE_UNCERTAIN');
  expect(h.get()).toMatchObject({live:false,writes:1,invalidations:1});
  await expect(h.lab.persistVerified(p.receipt)).rejects.toThrow('STALE_RECEIPT');
 });
 test('readback mismatch quarantines owner and denies positive receipt',async()=>{
  const h=harness(await historical()),p=await webVerified(h);h.tamperRead();
  await expect(h.lab.persistVerified(p.receipt)).rejects.toThrow('PERSISTENCE_UNCERTAIN');
  expect(h.get()).toMatchObject({live:false,invalidations:1,writes:1});
 });
 test('revocation after write prevents success even when disk may contain receipt',async()=>{
  const h=harness(await historical()),p=await webVerified(h);h.revokeInWrite();
  await expect(h.lab.persistVerified(p.receipt)).rejects.toThrow('PERSISTENCE_UNCERTAIN');
  expect(h.get()).toMatchObject({live:false,writes:1,invalidations:1});
 });
 test('preexisting receipt is never silently replaced',async()=>{
  const h=harness(await historical()),p=await webVerified(h);
  h.seed({schemaVersion:1,kind:'formative-v10-copy-proof',
   state:'lab-durable-not-official',payloadVersion:10,checkpointAt:at,
   source:'web-readback',bytes:5,sha256:'a'.repeat(64),includedChanges:3,
   sourceSnapshotSha256:'b'.repeat(64)});
  await expect(h.lab.persistVerified(p.receipt)).rejects.toThrow('PERSISTENCE_UNCERTAIN');
  expect(h.get().writes).toBe(0);
 });
 test('actual isolated SecureVault encrypts receipt, locks and reopens with authentication',async()=>{
  const vaultStore=new SyntheticEncryptedStore(),vault=new SecureVault(vaultStore);
  await vault.initializeActive('isolated synthetic vault only');
  const snapshot=await historical();
  let live=true;
  const owner:FormativeV10LabOwner={
   coordinator:createDurableMutationCoordinator(),
   isActive:()=>live,laboratoryApproved:()=>true,
   readCommittedSnapshot:async()=>clone(snapshot),invalidate:()=>{live=false;}
  };
  const store:FormativeV10LabReceiptStore={
   syntheticOnly:true,
   read:()=>vault.get('meta'),
   write:r=>vault.put('meta',r)
  };
  const lab=createFormativeV10DurableReceiptLab(owner,store);
  const p=await lab.prepare(pass,req);
  expect(await lab.verifyWeb(p.receipt,new Blob([p.encryptedText]))).toBe('verified');
  const saved=await lab.persistVerified(p.receipt);
  const encrypted=vaultStore.ciphertext();
  expect(encrypted).not.toBeNull();
  if(!encrypted)throw Error('Missing encrypted test record');
  expect(new TextDecoder().decode(encrypted)).not.toContain('formative-v10-copy-proof');
  vault.lock();
  await expect(store.read()).rejects.toThrow();
  await vault.unlock('isolated synthetic vault only');
  expect(await store.read()).toEqual(saved);
  expect(snapshot.meta.verifiedBackupEvidence).toBeUndefined();
  expect(snapshot.meta.lastBackup).toBeNull();
 });
 test('revoked or nonlaboratory owner cannot prepare V10 receipt',async()=>{
  const h=harness(await historical());h.denyLab();
  await expect(h.lab.prepare(pass,req)).rejects.toThrow('SESSION_REVOKED');
  const other=harness(await historical());other.revoke();
  await expect(other.lab.prepare(pass,req)).rejects.toThrow('SESSION_REVOKED');
 });
 test('pending proof is invalidated by subsequent preparation',async()=>{
  const h=harness(await historical()),a=await webVerified(h);
  const b=await webVerified(h);
  await expect(h.lab.persistVerified(a.receipt)).rejects.toThrow('STALE_RECEIPT');
  const result=await h.lab.persistVerified(b.receipt);
  expect(result.state).toBe('lab-durable-not-official');
 });
});
