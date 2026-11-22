import {describe,expect,test} from 'bun:test';
import {generateDataEncryptionKey} from './cryptoPrimitives';
import {proposeFormativeV10ReceiptJournalAppend as propose} from './formativeV10ReceiptJournal';
import {FORMATIVE_V10_STAGED_META_KEY,
 sealFormativeV10StagedMetadata as seal,openFormativeV10StagedMetadata as open}
 from './formativeV10StagedMetadata';
import {verifiedBackupDate,withoutLocalBackupVerification} from '../persistence/backupCheckpoint';
const time='2027-03-01T12:00:00.000Z';
const snapshot='a'.repeat(64);
const session='c'.repeat(64);
const lab={
 schemaVersion:1 as const,kind:'formative-v10-copy-proof' as const,
 state:'lab-durable-not-official' as const,payloadVersion:10 as const,
 checkpointAt:time,source:'android-readback' as const,bytes:1500,
 sha256:'b'.repeat(64),includedChanges:2,sourceSnapshotSha256:snapshot
};
async function fixture(){
 const first=await propose(null,null,lab,snapshot,'2027-03-01T12:01:00.000Z');
 const anchor={trustedHeadDigest:first.record.contentDigest,
  trustedSessionBinding:session,trustedSnapshotDigest:snapshot};
 const key=await generateDataEncryptionKey();
 const enc=await seal(first.journal,anchor,'2027-03-01T12:02:00.000Z',key);
 return {first,anchor,key,enc};
}
describe('VAL-01/PRODUCT-05/S7d.3b — sealed metadata, isolated laboratory',()=>{
 test('authenticated V10 metadata round-trips with every independently supplied anchor',async()=>{
  const x=await fixture();
  const m=await open(x.enc,x.first.journal,x.anchor,x.key);
  expect(m).toMatchObject({state:'lab-authenticated-not-official',
   payloadVersion:10,recordCount:1,headDigest:x.anchor.trustedHeadDigest,
   sessionBinding:session,copySha256:lab.sha256,sourceSnapshotSha256:snapshot});
  expect(x.enc.recordKey).toBe(FORMATIVE_V10_STAGED_META_KEY);
  expect(x.enc.schemaVersion).toBe(1);
 });
 test('a different cryptographic key never authenticates the ciphertext',async()=>{
  const x=await fixture();
  await expect(open(x.enc,x.first.journal,x.anchor,await generateDataEncryptionKey())).rejects.toThrow();
 });
 test('record-key and schema-version domain binding reject substitution',async()=>{
  const x=await fixture();
  await expect(open({...x.enc,recordKey:'meta'},x.first.journal,x.anchor,x.key)).rejects.toThrow();
  await expect(open({...x.enc,schemaVersion:6},x.first.journal,x.anchor,x.key)).rejects.toThrow();
 });
 test('a modified ciphertext and a modified IV are rejected',async()=>{
  const x=await fixture();
  const bytes=new Uint8Array(x.enc.ciphertext.slice(0));bytes[0]^=1;
  await expect(open({...x.enc,ciphertext:bytes.buffer},x.first.journal,x.anchor,x.key)).rejects.toThrow();
  const iv=x.enc.iv.slice();iv[0]^=1;
  await expect(open({...x.enc,iv},x.first.journal,x.anchor,x.key)).rejects.toThrow();
 });
 test('a stale expected head rejects a previously valid sealed record',async()=>{
  const x=await fixture();
  await expect(open(x.enc,x.first.journal,{...x.anchor,trustedHeadDigest:'d'.repeat(64)},x.key)).rejects.toThrow();
 });
 test('a different independent session binding rejects reuse',async()=>{
  const x=await fixture();
  await expect(open(x.enc,x.first.journal,{...x.anchor,trustedSessionBinding:'d'.repeat(64)},x.key)).rejects.toThrow();
 });
 test('a changed independently committed snapshot rejects the record',async()=>{
  const x=await fixture();
  await expect(open(x.enc,x.first.journal,{...x.anchor,trustedSnapshotDigest:'d'.repeat(64)},x.key)).rejects.toThrow();
 });
 test('truncated, mutated or missing journals never validate against a trusted head',async()=>{
  const x=await fixture();
  await expect(open(x.enc,{version:1,records:[]},x.anchor,x.key)).rejects.toThrow();
  const altered=structuredClone(x.first.journal);
  (altered.records[0] as any).sha256='e'.repeat(64);
  await expect(open(x.enc,altered,x.anchor,x.key)).rejects.toThrow();
  await expect(open(x.enc,null,x.anchor,x.key)).rejects.toThrow();
 });
 test('new head cannot reuse a prior sealed metadata record',async()=>{
  const x=await fixture();
  const second=await propose(x.first.journal,x.first.record.contentDigest,
   {...lab,checkpointAt:'2027-03-02T12:00:00.000Z'},
   snapshot,'2027-03-02T12:01:00.000Z');
  await expect(open(x.enc,second.journal,{...x.anchor,trustedHeadDigest:second.record.contentDigest},x.key)).rejects.toThrow();
 });
 test('no empty log, malformed/extra anchor or invalid checkpoint timestamp is sealable',async()=>{
  const x=await fixture();
  await expect(seal({version:1,records:[]},x.anchor,'2027-03-01T12:02:00.000Z',x.key)).rejects.toThrow();
  await expect(seal(x.first.journal,{...x.anchor,official:true},'2027-03-01T12:02:00.000Z',x.key)).rejects.toThrow();
  await expect(seal(x.first.journal,x.anchor,'2027-01-01T00:00:00.000Z',x.key)).rejects.toThrow();
 });
 test('untrusted getters, wrong encrypted record shapes and missing anchor fail closed',async()=>{
  const x=await fixture();
  const malicious=Object.defineProperty({...x.anchor},'trustedSessionBinding',
    {enumerable:true,get(){throw Error('getter');}});
  await expect(open(x.enc,x.first.journal,malicious,x.key)).rejects.toThrow();
  await expect(open({...x.enc,iv:new Uint8Array(0)},x.first.journal,x.anchor,x.key)).rejects.toThrow();
  await expect(open(x.enc,x.first.journal,null,x.key)).rejects.toThrow();
 });
 test('V6 local verification semantics remain independent of V10 candidates',async()=>{
  const x=await fixture();
  expect((await open(x.enc,x.first.journal,x.anchor,x.key)).payloadVersion).toBe(10);
  const meta={changes:0,lastBackup:time,verifiedBackupAt:time,
   verifiedBackupEvidence:{bytes:1500,sha256:'b'.repeat(64),
    source:'android-readback' as const,payloadVersion:6 as const,checkpointAt:time}};
  expect(verifiedBackupDate(meta)).toBe(time);
  expect(verifiedBackupDate(withoutLocalBackupVerification(meta))).toBe(null);
 });
});
