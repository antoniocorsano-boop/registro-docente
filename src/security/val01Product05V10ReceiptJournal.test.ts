import {describe,expect,test} from 'bun:test';
import {proposeFormativeV10ReceiptJournalAppend as propose,
 validateFormativeV10ReceiptJournal as validate} from './formativeV10ReceiptJournal';
const copy=<T>(v:T):T=>structuredClone(v);
const time='2027-02-01T10:10:00.000Z';
const digest='a'.repeat(64);
const source=(checkpointAt=time)=>({
 schemaVersion:1 as const,kind:'formative-v10-copy-proof' as const,
 state:'lab-durable-not-official' as const,payloadVersion:10 as const,
 checkpointAt,source:'web-readback' as const,bytes:2300,
 sha256:'b'.repeat(64),includedChanges:3,sourceSnapshotSha256:digest
});
const make=(s=source(),p:unknown=null,head:string|null=null,at='2027-02-01T10:11:00.000Z')=>
 propose(p,head,s,digest,at);
describe('VAL-01/PRODUCT-05/S7d.3a — V10 receipt journal, staging only',()=>{
 test('first proposal retains lab-only status and validates with an independent head',async()=>{
  const x=await make();
  expect(x.state).toBe('staged-not-official');
  expect(x.record).toMatchObject({state:'staged-not-official',sequence:1,
   sourceSnapshotSha256:digest,previousDigest:null});
  expect((await validate(x.journal,x.record.contentDigest)).valid).toBe(true);
 });
 test('two sequential versions preserve exact digest linkage',async()=>{
  const first=await make();
  const second=await make(source('2027-02-02T10:10:00.000Z'),first.journal,
   first.record.contentDigest,'2027-02-02T10:11:00.000Z');
  expect(second.journal.records).toHaveLength(2);
  expect(second.record.previousDigest).toBe(first.record.contentDigest);
  expect((await validate(second.journal,second.record.contentDigest)).valid).toBe(true);
 });
 test('stale expected head or cropped historical sequence is rejected',async()=>{
  const first=await make();
  await expect(make(source('2027-02-02T10:10:00.000Z'),
    first.journal,null,'2027-02-02T10:11:00.000Z')).rejects.toThrow();
  expect((await validate({version:1,records:[]},first.record.contentDigest)).valid).toBe(false);
 });
 test('tampering of physical byte evidence invalidates digest chain',async()=>{
  const x=await make(),altered=copy(x.journal);
  (altered.records[0] as any).bytes++;
  expect((await validate(altered,x.record.contentDigest)).valid).toBe(false);
 });
 test('tampering of the committed snapshot digest invalidates chain',async()=>{
  const x=await make(),altered=copy(x.journal);
  (altered.records[0] as any).sourceSnapshotSha256='c'.repeat(64);
  expect((await validate(altered,x.record.contentDigest)).valid).toBe(false);
 });
 test('fabricated official flag, extra keys, and invalid timestamp are rejected',async()=>{
  const x=await make();
  const altered=copy(x.journal);(altered.records[0] as any).state='official';
  expect((await validate(altered,x.record.contentDigest)).valid).toBe(false);
  const extra=copy(x.journal);(extra.records[0] as any).teacher='forged';
  expect((await validate(extra,x.record.contentDigest)).valid).toBe(false);
  await expect(make({...source(),checkpointAt:'not-a-time'})).rejects.toThrow();
 });
 test('a lab record cannot create a receipt with a different authenticated source snapshot',async()=>{
  await expect(propose(null,null,source(),'c'.repeat(64),
    '2027-02-01T10:11:00.000Z')).rejects.toThrow();
 });
 test('replay of the same checkpoint cannot be appended twice',async()=>{
  const first=await make();
  await expect(make(source(),first.journal,first.record.contentDigest)).rejects.toThrow();
 });
 test('invalid laboratory state or version never becomes official',async()=>{
  await expect(make({...source(),state:'official'})).rejects.toThrow();
  await expect(make({...source(),payloadVersion:9})).rejects.toThrow();
 });
 test('getters, cycles, unknown keys and invalid digest anchors fail closed',async()=>{
  const withGetter=Object.defineProperty({...source()},'bytes',{enumerable:true,
   get(){throw Error('UNTRUSTED_GETTER');}});
  await expect(make(withGetter)).rejects.toThrow();
  const loop:any={version:1,records:[]};loop.self=loop;
  expect((await validate(loop,null)).valid).toBe(false);
  expect((await validate({version:1,records:[],extra:true},null)).valid).toBe(false);
  expect((await validate({version:1,records:[]},'bad')).valid).toBe(false);
 });
});
