import {describe,expect,test} from 'bun:test';
import {generateDataEncryptionKey} from './cryptoPrimitives';
import {sameDb2Physical} from './db2PhysicalLifecycle';
import {createDurableMutationCoordinator} from '../persistence/durableMutationCoordinator';
import {createFormativeV10LabTransaction,type FormativeV10LabPairV1,
 type FormativeV10LabTrustedReadV1,type FormativeV10LabTrustedHeadV1} from './formativeV10LabTransaction';
import {openFormativeV10StagedMetadata} from './formativeV10StagedMetadata';

const original='a'.repeat(64),session='c'.repeat(64),fileHash='b'.repeat(64);
const checkpoint='2027-04-01T12:00:00.000Z';
const recorded='2027-04-01T12:01:00.000Z';
const sealed='2027-04-01T12:02:00.000Z';
const copy=<T>(v:T):T=>structuredClone(v);
const proof=(at=checkpoint)=>({
 schemaVersion:1 as const,kind:'formative-v10-copy-proof' as const,
 state:'lab-durable-not-official' as const,payloadVersion:10 as const,
 checkpointAt:at,source:'web-readback' as const,bytes:4242,
 sha256:fileHash,includedChanges:3,sourceSnapshotSha256:original
});
function fixtureStores(){
 let pair:FormativeV10LabPairV1|null=null;
 let head:FormativeV10LabTrustedReadV1={kind:'confirmed-absent'};
 let pairMode:'normal'|'fail-before'|'fail-after'|'refuse'|'wrong-readback'='normal';
 let anchorMode:'normal'|'fail-before'|'fail-after'|'refuse'|'wrong-readback'='normal';
 const pairStore={
  syntheticOnly:true as const,
  async read():Promise<FormativeV10LabPairV1|null>{
   const result=copy(pair);
   if(result&&pairMode==='wrong-readback'){
    const altered=new Uint8Array(result.encrypted.ciphertext.slice(0));
    altered[0]^=1;
    return {...result,encrypted:{...result.encrypted,ciphertext:altered.buffer}};
   }
   return result;
  },
  async compareAndReplace(expected:FormativeV10LabPairV1|null,next:FormativeV10LabPairV1){
   if(pairMode==='fail-before')throw Error('synthetic interrupt');
   if(pairMode==='refuse')return false;
   if(!sameDb2Physical(pair,expected))return false;
   pair=copy(next);
   if(pairMode==='fail-after')throw Error('synthetic interrupt after write');
   return true;
  },
  setMode(v:typeof pairMode){pairMode=v;},
  tamper(callback:(p:FormativeV10LabPairV1|null)=>FormativeV10LabPairV1|null){
   pair=callback(copy(pair));
  },
  raw:()=>copy(pair)
 };
 const anchorStore={
  syntheticOnly:true as const,
  async read():Promise<FormativeV10LabTrustedReadV1>{
   if(anchorMode==='wrong-readback'&&head.kind==='established')
    return {kind:'established',head:{...head.head,headDigest:'d'.repeat(64)}};
   return copy(head);
  },
  async compareAndAdvance(expected:FormativeV10LabTrustedReadV1,
   next:FormativeV10LabTrustedHeadV1){
   if(anchorMode==='fail-before')throw Error('synthetic anchor unavailable');
   if(anchorMode==='refuse')return false;
   if(!sameDb2Physical(head,expected))return false;
   if(head.kind==='established'&&next.epoch!==head.head.epoch+1)return false;
   if(head.kind!=='established'&&head.kind!=='confirmed-absent')return false;
   head={kind:'established',head:copy(next)};
   if(anchorMode==='fail-after')throw Error('synthetic unknown anchor commit');
   return true;
  },
  setMode(v:typeof anchorMode){anchorMode=v;},
  setHead(v:FormativeV10LabTrustedReadV1){head=copy(v);},
  raw:()=>copy(head)
 };
 return {pairStore,anchorStore};
}
async function setup(stores=fixtureStores(),binding=session,providedKey?:CryptoKey){
 const key=providedKey??await generateDataEncryptionKey();
 const owner={
  syntheticOnly:true as const,coordinator:createDurableMutationCoordinator(),
  sessionBinding:binding,alive:true,source:original,
  isActive(){return this.alive;},
  async readCommittedSnapshotDigest(){return this.source;},
  invalidate(){this.alive=false;}
 };
 const tx=createFormativeV10LabTransaction(owner,stores.pairStore,stores.anchorStore,key);
 return {...stores,key,owner,tx};
}
const commitFirst=async(x:Awaited<ReturnType<typeof setup>>)=>{
 const t=await x.tx.prepare(proof(),original,recorded,sealed);
 return x.tx.commit(t);
};
describe('VAL-01/PRODUCT-05/S7d.3c — isolated dual-store commit + conservative recovery',()=>{
 test('confirmed independent absence admits first exact receipt, never an official backup',async()=>{
  const x=await setup();
  expect(await x.tx.inspect()).toEqual({state:'pristine-synthetic-lab'});
  const result=await commitFirst(x);
  expect(result).toMatchObject({state:'lab-anchored-not-official',epoch:1});
  expect(await x.tx.inspect()).toEqual({
   state:'consistent-synthetic-lab',epoch:1,headDigest:result.headDigest
  });
  expect(x.anchorStore.raw().kind).toBe('established');
  const p=x.pairStore.raw()!;
  const anchor=x.anchorStore.raw();
  if(anchor.kind!=='established')throw Error('missing trusted synthetic anchor');
  const decrypted=await openFormativeV10StagedMetadata(p.encrypted,p.journal,{
   trustedHeadDigest:anchor.head.headDigest,trustedSessionBinding:anchor.head.sessionBinding,
   trustedSnapshotDigest:anchor.head.snapshotDigest},x.key);
  expect(decrypted.state).toBe('lab-authenticated-not-official');
 });
 test('monotonic second commit retains old journal and advances the external head',async()=>{
  const x=await setup(),first=await commitFirst(x);
  const next=await x.tx.prepare(proof('2027-04-02T12:00:00.000Z'),original,
   '2027-04-02T12:01:00.000Z','2027-04-02T12:02:00.000Z');
  const second=await x.tx.commit(next);
  expect(second.epoch).toBe(2);
  expect(second.headDigest).not.toBe(first.headDigest);
  expect(x.pairStore.raw()?.journal.records).toHaveLength(2);
  expect((x.pairStore.raw()?.journal.records[1]).previousDigest).toBe(first.headDigest);
 });
 test('one-use identity cannot be replayed or fabricated',async()=>{
  const x=await setup();
  const ticket=await x.tx.prepare(proof(),original,recorded,sealed);
  await expect(x.tx.commit({kind:'formative-v10-lab-once'})).rejects.toThrow();
  await x.tx.commit(ticket);
  await expect(x.tx.commit(ticket)).rejects.toThrow();
 });
 test('latest preparation supersedes earlier ticket',async()=>{
  const x=await setup();
  const first=await x.tx.prepare(proof(),original,recorded,sealed);
  const newer=await x.tx.prepare(proof(),original,recorded,sealed);
  await expect(x.tx.commit(first)).rejects.toThrow();
  expect((await x.tx.commit(newer)).epoch).toBe(1);
 });
 test('commit rechecks current committed snapshot and rejects stale source',async()=>{
  const x=await setup();
  const ticket=await x.tx.prepare(proof(),original,recorded,sealed);
  x.owner.source='e'.repeat(64);
  await expect(x.tx.commit(ticket)).rejects.toThrow();
  expect(x.pairStore.raw()).toBeNull();
  expect(x.anchorStore.raw()).toEqual({kind:'confirmed-absent'});
 });
 test('unverifiable or lost trusted head never implies fresh first install',async()=>{
  const x=await setup();
  x.anchorStore.setHead({kind:'unverifiable'});
  expect(await x.tx.inspect()).toEqual({state:'quarantined'});
  expect(x.owner.alive).toBe(false);
  await expect(x.tx.prepare(proof(),original,recorded,sealed)).rejects.toThrow();
 });
 test('unanchored pair cannot be accepted or silently reset',async()=>{
  const x=await setup();
  await commitFirst(x);
  x.anchorStore.setHead({kind:'confirmed-absent'});
  const restart=await setup({pairStore:x.pairStore,anchorStore:x.anchorStore},session,x.key);
  expect(await restart.tx.inspect()).toEqual({state:'quarantined'});
  expect(restart.pairStore.raw()).not.toBeNull();
 });
 test('established head with missing pair fails closed',async()=>{
  const x=await setup();
  await commitFirst(x);
  x.pairStore.tamper(()=>null);
  const restart=await setup({pairStore:x.pairStore,anchorStore:x.anchorStore},session,x.key);
  expect(await restart.tx.inspect()).toEqual({state:'quarantined'});
 });
 test('tampered authenticated pair never matches independent head',async()=>{
  const x=await setup();
  await commitFirst(x);
  x.pairStore.tamper(p=>{
   if(!p)throw Error('empty');
   const cipher=new Uint8Array(p.encrypted.ciphertext.slice(0));
   cipher[cipher.length-1]^=1;
   return {...p,encrypted:{...p.encrypted,ciphertext:cipher.buffer}};
  });
  const restart=await setup({pairStore:x.pairStore,anchorStore:x.anchorStore},session,x.key);
  // Independent key identity mismatch ALSO rejects: no false success.
  expect(await restart.tx.inspect()).toEqual({state:'quarantined'});
 });
 test('interrupted pair write after possible durable commit quarantines without retry',async()=>{
  const x=await setup();
  x.pairStore.setMode('fail-after');
  await expect(commitFirst(x)).rejects.toThrow('UNCERTAIN_QUARANTINED');
  expect(x.tx.isQuarantined()).toBe(true);
  expect(x.owner.alive).toBe(false);
  expect(x.pairStore.raw()).not.toBeNull();
  expect(x.anchorStore.raw()).toEqual({kind:'confirmed-absent'});
 });
 test('pair compare-and-swap refusal quarantines the uncertain operation',async()=>{
  const x=await setup();
  x.pairStore.setMode('refuse');
  await expect(commitFirst(x)).rejects.toThrow('UNCERTAIN_QUARANTINED');
  expect(x.anchorStore.raw()).toEqual({kind:'confirmed-absent'});
 });
 test('pair readback corruption quarantines before any anchor advance',async()=>{
  const x=await setup();
  x.pairStore.setMode('wrong-readback');
  await expect(commitFirst(x)).rejects.toThrow('UNCERTAIN_QUARANTINED');
  expect(x.anchorStore.raw()).toEqual({kind:'confirmed-absent'});
 });
 test('anchor compare-and-swap failure after pair success quarantines and preserves evidence',async()=>{
  const x=await setup();
  x.anchorStore.setMode('fail-before');
  await expect(commitFirst(x)).rejects.toThrow('UNCERTAIN_QUARANTINED');
  expect(x.pairStore.raw()).not.toBeNull();
  expect(x.anchorStore.raw()).toEqual({kind:'confirmed-absent'});
 });
 test('anchor may advance even if its API throws: no premature success or auto retry',async()=>{
  const x=await setup();
  x.anchorStore.setMode('fail-after');
  await expect(commitFirst(x)).rejects.toThrow('UNCERTAIN_QUARANTINED');
  expect(x.owner.alive).toBe(false);
  expect(x.anchorStore.raw().kind).toBe('established');
 });
 test('anchor readback disagreement rejects success after durable writes',async()=>{
  const x=await setup();
  x.anchorStore.setMode('wrong-readback');
  await expect(commitFirst(x)).rejects.toThrow('UNCERTAIN_QUARANTINED');
  expect(x.tx.isQuarantined()).toBe(true);
 });
 test('rollback of pair only or of anchor only is detected on a later inspection',async()=>{
  const x=await setup();
  await commitFirst(x);
  const oldPair=x.pairStore.raw();
  const oldHead=x.anchorStore.raw();
  const t=await x.tx.prepare(proof('2027-04-02T12:00:00.000Z'),original,
   '2027-04-02T12:01:00.000Z','2027-04-02T12:02:00.000Z');
  await x.tx.commit(t);
  const nowPair=x.pairStore.raw();
  x.pairStore.tamper(()=>oldPair);
  const restart=await setup({pairStore:x.pairStore,anchorStore:x.anchorStore},session,x.key);
  expect(await restart.tx.inspect()).toEqual({state:'quarantined'});
  x.pairStore.tamper(()=>nowPair);
  x.anchorStore.setHead(oldHead);
  const restart2=await setup({pairStore:x.pairStore,anchorStore:x.anchorStore},session,x.key);
  expect(await restart2.tx.inspect()).toEqual({state:'quarantined'});
 });
 test('rollback of BOTH synthetic stores is not detectable; genuine anti-rollback is external',async()=>{
  const x=await setup();
  await commitFirst(x);
  const oldPair=x.pairStore.raw();
  const oldHead=x.anchorStore.raw();
  const t=await x.tx.prepare(proof('2027-04-02T12:00:00.000Z'),original,
   '2027-04-02T12:01:00.000Z','2027-04-02T12:02:00.000Z');
  await x.tx.commit(t);
  x.pairStore.tamper(()=>oldPair);
  x.anchorStore.setHead(oldHead);
  // This models a BROKEN independent monotonic witness. The module must not
  // claim to prevent rollback when BOTH persistence domains are compromised.
  const freshOwner={
   syntheticOnly:true as const,coordinator:createDurableMutationCoordinator(),
   sessionBinding:session,alive:true,
   isActive(){return this.alive;},
   async readCommittedSnapshotDigest(){return original;},
   invalidate(){this.alive=false;}
  };
  const fresh=createFormativeV10LabTransaction(
   freshOwner,x.pairStore,x.anchorStore,x.key
  );
  expect(await fresh.inspect()).toMatchObject({state:'consistent-synthetic-lab',epoch:1});
 });
 test('session binding mismatch denies any reuse by another session',async()=>{
  const x=await setup();
  await commitFirst(x);
  const newOwner={
   syntheticOnly:true as const,coordinator:createDurableMutationCoordinator(),
   sessionBinding:'e'.repeat(64),alive:true,
   isActive(){return this.alive;},
   async readCommittedSnapshotDigest(){return original;},
   invalidate(){this.alive=false;}
  };
  const fresh=createFormativeV10LabTransaction(newOwner,x.pairStore,x.anchorStore,x.key);
  expect(await fresh.inspect()).toEqual({state:'quarantined'});
 });
});
