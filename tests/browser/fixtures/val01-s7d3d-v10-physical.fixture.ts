/** VAL-01/PRODUCT-05/S7d.3d — physical browser/WebView persistence fixture.
 * SYNTHETIC, isolated Capacitor debug shell or localhost only.
 * Uses actual IndexedDB transactions and actual origin localStorage. The latter
 * is deliberately NOT an independently protected monotonic anti-rollback root.
 * Fixed test AES key, session and hashes MUST NEVER enter the application.
 */
import {createFormativeV10LabTransaction,
 type FormativeV10LabPairV1,type FormativeV10LabTrustedReadV1,
 type FormativeV10LabTrustedHeadV1} from '../../../src/security/formativeV10LabTransaction';
import {createDurableMutationCoordinator} from '../../../src/persistence/durableMutationCoordinator';
import {openFormativeV10StagedMetadata} from '../../../src/security/formativeV10StagedMetadata';
import {sameDb2Physical} from '../../../src/security/db2PhysicalLifecycle';
const DB='val01-s7d3d-v10-synthetic-evidence';
const TRUST='val01-s7d3d-v10-localstorage-witness';
const OLD_HEAD='val01-s7d3d-v10-epoch1-head';
const session='c'.repeat(64),snapshot='a'.repeat(64),copySha='b'.repeat(64);
const ISO1='2031-02-01T12:00:00.000Z',ISO2='2031-02-02T12:00:00.000Z';
const clone=<T>(x:T):T=>structuredClone(x);
type Pair=FormativeV10LabPairV1;
function db():Promise<IDBDatabase>{
 return new Promise((resolve,reject)=>{
  const r=indexedDB.open(DB,1);
  r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('pair'))r.result.createObjectStore('pair');};
  r.onsuccess=()=>resolve(r.result);
  r.onerror=r.onblocked=()=>reject(Error('Synthetic IDB unavailable'));
 });
}
async function physicalRead(key:string):Promise<Pair|null>{
 const connection=await db();
 try{return await new Promise((resolve,reject)=>{
  const tx=connection.transaction('pair','readonly');
  const req=tx.objectStore('pair').get(key);
  req.onsuccess=()=>resolve(req.result===undefined?null:clone(req.result as Pair));
  req.onerror=()=>reject(Error('Synthetic IDB read failed'));
 });}finally{connection.close();}
}
async function physicalPut(key:string,value:Pair|null):Promise<void>{
 const connection=await db();
 try{await new Promise<void>((resolve,reject)=>{
  const tx=connection.transaction('pair','readwrite');
  if(value===null)tx.objectStore('pair').delete(key);
  else tx.objectStore('pair').put(clone(value),key);
  tx.oncomplete=()=>resolve();
  tx.onerror=tx.onabort=()=>reject(Error('Synthetic IDB put failed'));
 });}finally{connection.close();}
}
async function physicalCAS(expected:Pair|null,next:Pair):Promise<boolean>{
 const connection=await db();
 try{return await new Promise<boolean>((resolve,reject)=>{
  const tx=connection.transaction('pair','readwrite');
  let matched=false;
  const req=tx.objectStore('pair').get('current');
  req.onsuccess=()=>{
   const observed=req.result===undefined?null:req.result as Pair;
   matched=sameDb2Physical(observed,expected);
   if(matched)tx.objectStore('pair').put(clone(next),'current');
  };
  req.onerror=()=>reject(Error('Synthetic IDB CAS read failed'));
  tx.oncomplete=()=>resolve(matched);
  tx.onerror=tx.onabort=()=>reject(Error('Synthetic IDB CAS failed'));
 });}finally{connection.close();}
}
const pairStore={
 syntheticOnly:true as const,
 read:()=>physicalRead('current'),
 compareAndReplace:physicalCAS
};
/** Only the uniquely named synthetic debug shell has a native witness.
 * A native bridge failure MUST NOT silently fall back to page localStorage.
 * SharedPreferences offers process-restart durability, NOT anti-rollback.
 */
type NativeWitnessBridge={
 read():Promise<{value:string|null}>;
 compareAndAdvance(x:{expected:string;next:string}):Promise<{advanced:boolean}>;
 seedForTest(x:{value:string|null}):Promise<{stored:boolean}>;
};
function nativeWitness():{native:boolean;bridge:NativeWitnessBridge|null}{
 const cap=(globalThis as unknown as {Capacitor?:{
  isNativePlatform?:()=>boolean;
  Plugins?:{Val01V10Witness?:NativeWitnessBridge};
 }}).Capacitor;
 const native=cap?.isNativePlatform?.()===true;
 return {native,bridge:native?(cap?.Plugins?.Val01V10Witness??null):null};
}
async function storedWitness():Promise<string|null>{
 const n=nativeWitness();
 if(!n.native)return localStorage.getItem(TRUST);
 if(!n.bridge)throw Error('Missing synthetic Android witness plugin');
 const value=(await n.bridge.read()).value;
 if(value!==null&&typeof value!=='string')throw Error('Invalid native witness read');
 return value;
}
async function seedWitness(value:string|null):Promise<void>{
 const n=nativeWitness();
 if(n.native){
  if(!n.bridge)throw Error('Missing synthetic Android witness plugin');
  if((await n.bridge.seedForTest({value})).stored!==true)
   throw Error('Synthetic native seed not confirmed');
 }else if(value===null)localStorage.removeItem(TRUST);
 else localStorage.setItem(TRUST,value);
}
async function witness():Promise<FormativeV10LabTrustedReadV1>{
 try{
  const raw=await storedWitness();
  if(raw===null)return {kind:'unverifiable'};
  const x=JSON.parse(raw) as FormativeV10LabTrustedReadV1;
  return x&&typeof x==='object'?x:{kind:'unverifiable'};
 }catch{return {kind:'unverifiable'};}
}
const trustStore={
 syntheticOnly:true as const,
 async read(){return clone(await witness());},
 async compareAndAdvance(expected:FormativeV10LabTrustedReadV1,
  next:FormativeV10LabTrustedHeadV1){
  const n=nativeWitness();
  if(!sameDb2Physical(await witness(),expected))return false;
  const nextValue=JSON.stringify({kind:'established',head:next});
  if(n.native){
   if(!n.bridge)throw Error('Missing synthetic Android witness plugin');
   return (await n.bridge.compareAndAdvance({
    expected:JSON.stringify(expected),next:nextValue
   })).advanced===true;
  }
  localStorage.setItem(TRUST,nextValue);
  return (await storedWitness())===nextValue;
 }
};
const keyPromise=crypto.subtle.importKey('raw',new Uint8Array(32).fill(7),
 {name:'AES-GCM'},false,['encrypt','decrypt']);
async function transaction(mode:'normal'|'fail-after-pair'='normal'){
 const key=await keyPromise;
 const owner={
  syntheticOnly:true as const,
  coordinator:createDurableMutationCoordinator(),
  sessionBinding:session,
  alive:true,
  isActive(){return this.alive;},
  async readCommittedSnapshotDigest(){return snapshot;},
  invalidate(){this.alive=false;}
 };
 const store=mode==='normal'?pairStore:{
  ...pairStore,
  async compareAndReplace(expected:Pair|null,next:Pair){
   const changed=await physicalCAS(expected,next);
   if(changed)throw Error('Synthetic interruption after durable IDB commit');
   return changed;
  }
 };
 return createFormativeV10LabTransaction(owner,store,trustStore,key);
}
const proof=(date:string)=>({
 schemaVersion:1 as const,kind:'formative-v10-copy-proof' as const,
 state:'lab-durable-not-official' as const,payloadVersion:10 as const,
 checkpointAt:date,source:'web-readback' as const,bytes:4096,
 sha256:copySha,includedChanges:3,sourceSnapshotSha256:snapshot
});
async function commit(date:string,mode:'normal'|'fail-after-pair'='normal'){
 const tx=await transaction(mode);
 const t=await tx.prepare(proof(date),snapshot,
  date.replace('12:00:00','12:01:00'),
  date.replace('12:00:00','12:02:00'));
 return {outcome:await tx.commit(t),inspection:await tx.inspect()};
}
async function reset(){
 await physicalPut('current',null);
 await physicalPut('epoch-one',null);
 localStorage.removeItem(OLD_HEAD);
 // Only EXPLICIT reset of the synthetic fixture establishes known absence.
 await seedWitness(JSON.stringify({kind:'confirmed-absent'}));
 return (await (await transaction()).inspect()).state;
}
async function inspect(){
 return (await (await transaction()).inspect());
}
async function first(){
 return commit(ISO1);
}
async function second(){
 const pair=await physicalRead('current'),head=await witness();
 if(!pair||head.kind!=='established'||head.head.epoch!==1)
  throw Error('First synthetic epoch not established');
 await physicalPut('epoch-one',pair);
 localStorage.setItem(OLD_HEAD,JSON.stringify(head));
 return commit(ISO2);
}
async function faultAfterPair(){
 const tx=await transaction('fail-after-pair');
 const t=await tx.prepare(proof(ISO1),snapshot,
  '2031-02-01T12:01:00.000Z','2031-02-01T12:02:00.000Z');
 let rejected=false;
 try{await tx.commit(t);}catch(e){rejected=String(e).includes('UNCERTAIN_QUARANTINED');}
 return {rejected,inspection:await tx.inspect(),pairPresent:!!await physicalRead('current'),
  witnessKind:(await witness()).kind};
}
async function corruptHead(){
 await seedWitness(null);
 return inspect();
}
async function removePair(){
 await physicalPut('current',null);
 return inspect();
}
async function rollbackPair(){
 const old=await physicalRead('epoch-one');
 if(!old)throw Error('No saved epoch one');
 await physicalPut('current',old);
 return inspect();
}
async function rollbackBoth(){
 const old=await physicalRead('epoch-one'),head=localStorage.getItem(OLD_HEAD);
 if(!old||!head)throw Error('No saved old synthetic state');
 await physicalPut('current',old);
 await seedWitness(head);
 return inspect();
}
async function diagnose(){
 const result:{
  origin:string;witness:string;epoch:number|null;pairPresent:boolean;
  recordCount:number|null;ivType:string|null;cipherType:string|null;
  metadataAuthenticates:boolean;error:string|null
 }={origin:location.origin,witness:'unknown',epoch:null,pairPresent:false,
  recordCount:null,ivType:null,cipherType:null,metadataAuthenticates:false,error:null};
 try{
  const w=await witness();
  result.witness=w.kind;
  if(w.kind==='established')result.epoch=w.head.epoch;
  const p=await physicalRead('current');
  result.pairPresent=p!==null;
  if(p){
   result.recordCount=p.journal.records.length;
   result.ivType=Object.prototype.toString.call(p.encrypted.iv);
   result.cipherType=Object.prototype.toString.call(p.encrypted.ciphertext);
  }
  if(p&&w.kind==='established'){
   const key=await keyPromise;
   await openFormativeV10StagedMetadata(p.encrypted,p.journal,{
    trustedHeadDigest:w.head.headDigest,trustedSessionBinding:w.head.sessionBinding,
    trustedSnapshotDigest:w.head.snapshotDigest
   },key);
   result.metadataAuthenticates=true;
  }
 }catch(e){result.error=e instanceof Error?e.message:'unknown';}
 return result;
}
Object.assign(globalThis,{__val01V10Physical:{
 reset,inspect,diagnose,first,second,faultAfterPair,corruptHead,removePair,rollbackPair,rollbackBoth,
 status:()=>({origin:location.origin,syntheticOnly:true,
  witnessStore:nativeWitness().native?'android-sharedpreferences':'web-localstorage',
  storage:'IndexedDB pair + mutable witness; NOT genuine anti-rollback'})
}});
document.getElementById('status')!.textContent='Laboratorio V10 sintetico disponibile';
