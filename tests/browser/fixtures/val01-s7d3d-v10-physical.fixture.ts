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

/** S7d.3f — PHYSICAL SAF FILE LAB. No real data, app restore, or official V10 grant.
 * The outer AES-GCM synthetic fixture key is deliberately fixed and public.
 * Its ciphertext authenticates only synthetic bytes, NOT a professional backup.
 * A trusted anti-rollback head is not supplied by the file itself.
 */
type SafBridge={
 chooseDestination():Promise<{status:string;token?:string}>;
 writeFile(x:{token:string;encryptedText:string}):Promise<{status:string;bytes:number;sha256:string}>;
 chooseSource():Promise<{status:string;token?:string}>;
 readFile(x:{token:string}):Promise<{status:string;encryptedText:string;bytes:number;sha256:string}>;
};
function requireSaf():SafBridge{
 const cap=(globalThis as unknown as {Capacitor?:{
  isNativePlatform?:()=>boolean;Plugins?:{Val01V10Saf?:SafBridge};
 }}).Capacitor;
 if(cap?.isNativePlatform?.()!==true||!cap.Plugins?.Val01V10Saf)
  throw Error('Synthetic SAF exclusively available in Android debug fixture');
 return cap.Plugins.Val01V10Saf;
}
const b64=(bytes:Uint8Array):string=>btoa(Array.from(bytes,x=>String.fromCharCode(x)).join(''));
function decodeB64(value:unknown):Uint8Array{
 if(typeof value!=='string'||value.length>350000||value.length%4===1||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(value))throw Error('Invalid synthetic base64');
 const bytes=Uint8Array.from(atob(value),x=>x.charCodeAt(0));
 if(b64(bytes)!==value)throw Error('Noncanonical synthetic base64');
 return bytes;
}
const hexDigest=async(raw:Uint8Array)=>Array.from(
 new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(raw).buffer)),
 x=>x.toString(16).padStart(2,'0')).join('');
async function syntheticSafEnvelope():Promise<string>{
 const inspection=await inspect(),current=await physicalRead('current'),head=await witness();
 if(inspection.state!=='consistent-synthetic-lab'||!current||
    head.kind!=='established'||head.head.epoch!==inspection.epoch)
   throw Error('Synthetic V10 source not committed and verified');
 await openFormativeV10StagedMetadata(current.encrypted,current.journal,{
  trustedHeadDigest:head.head.headDigest,
  trustedSessionBinding:head.head.sessionBinding,
  trustedSnapshotDigest:head.head.snapshotDigest
 },await keyPromise);
 const data={
  pair:{journal:current.journal,encrypted:{
   recordKey:current.encrypted.recordKey,
   schemaVersion:current.encrypted.schemaVersion,
   iv:Array.from(current.encrypted.iv),
   ciphertext:Array.from(new Uint8Array(current.encrypted.ciphertext))
  }},
  head
 };
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv},
  await keyPromise,new TextEncoder().encode(JSON.stringify(data)));
 return JSON.stringify({kind:'val01-v10-saf-synthetic',syntheticOnly:true,version:10,
  state:'lab-only-not-official',iv:b64(iv),ciphertext:b64(new Uint8Array(cipher))});
}
async function safBeginWrite(){return requireSaf().chooseDestination();}
async function safCompleteWrite(token:string){
 if(typeof token!=='string'||!token)throw Error('Missing one-use SAF token');
 const text=await syntheticSafEnvelope();
 const bytes=new TextEncoder().encode(text);
 const expected=await hexDigest(bytes);
 const receipt=await requireSaf().writeFile({token,encryptedText:text});
 if(receipt.status!=='lab-file-readback-verified-not-official'||
    receipt.bytes!==bytes.length||receipt.sha256!==expected)
  throw Error('Synthetic physical SAF receipt mismatch');
 return {status:'lab-file-readback-verified-not-official',bytes:receipt.bytes,
  sha256:receipt.sha256};
}
async function safBeginRead(){return requireSaf().chooseSource();}
async function safCompleteRead(token:string,explicitRestore=false){
 if(typeof token!=='string'||!token||typeof explicitRestore!=='boolean')
  throw Error('Invalid SAF read request');
 const read=await requireSaf().readFile({token});
 if(read.status!=='lab-file-read-not-official')throw Error('Native synthetic read rejected');
 const rawBytes=new TextEncoder().encode(read.encryptedText);
 if(read.bytes!==rawBytes.byteLength||read.sha256!==await hexDigest(rawBytes))
  throw Error('Synthetic SAF hash mismatch');
 const envelope=JSON.parse(read.encryptedText) as Record<string,unknown>;
 if(!envelope||Object.keys(envelope).sort().join(',')!==
    ['kind','syntheticOnly','version','state','iv','ciphertext'].sort().join(',')||
   envelope.kind!=='val01-v10-saf-synthetic'||envelope.syntheticOnly!==true||
   envelope.version!==10||envelope.state!=='lab-only-not-official')
  throw Error('Invalid V10 laboratory envelope');
 const iv=decodeB64(envelope.iv),ciphertext=decodeB64(envelope.ciphertext);
 if(iv.byteLength!==12||ciphertext.byteLength<16)throw Error('Invalid cipher size');
 const plaintext=await crypto.subtle.decrypt({name:'AES-GCM',iv},
  await keyPromise,new Uint8Array(ciphertext).buffer);
 const body=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(plaintext)) as {
  pair:{journal:Pair['journal'];encrypted:{
   recordKey:string;schemaVersion:number;iv:number[];ciphertext:number[]}};
  head:FormativeV10LabTrustedReadV1;
 };
 if(!body||Object.keys(body).sort().join(',')!=='head,pair'||
    !body.pair||!body.pair.encrypted||body.head?.kind!=='established')
  throw Error('Missing authenticated synthetic fields');
 const enc=body.pair.encrypted;
 if(!Array.isArray(enc.iv)||enc.iv.length!==12||
    !Array.isArray(enc.ciphertext)||enc.ciphertext.length<16||
    enc.ciphertext.length>131072||
    ![...enc.iv,...enc.ciphertext].every(x=>Number.isInteger(x)&&x>=0&&x<=255))
  throw Error('Invalid serialized synthetic ciphertext');
 const pair:Pair={journal:body.pair.journal,encrypted:{
  recordKey:enc.recordKey,schemaVersion:enc.schemaVersion,
  iv:new Uint8Array(enc.iv),ciphertext:new Uint8Array(enc.ciphertext).buffer
 }};
 const head=body.head.head;
 const opened=await openFormativeV10StagedMetadata(pair.encrypted,pair.journal,{
  trustedHeadDigest:head.headDigest,
  trustedSessionBinding:head.sessionBinding,
  trustedSnapshotDigest:head.snapshotDigest
 },await keyPromise);
 if(opened.recordCount!==head.epoch||head.sessionBinding!==session||
    head.snapshotDigest!==snapshot)
  throw Error('Synthetic SAF source is inconsistent');
 if(!explicitRestore)
  return {status:'lab-file-authenticated-not-restored',epoch:head.epoch,
   bytes:read.bytes,sha256:read.sha256};
 // EXPLICIT laboratory reset/restore only: never silently discard a current state.
 if((await inspect()).state!=='pristine-synthetic-lab'||await physicalRead('current')!==null||
    (await witness()).kind!=='confirmed-absent')
  throw Error('Synthetic restore needs a freshly reset empty laboratory');
 // The file carries only a synthetic head; NEVER treat it as a genuine
 // independent anti-rollback authority. Any torn store causes quarantine.
 if(!await physicalCAS(null,pair))throw Error('Synthetic restore CAS refused');
 await seedWitness(JSON.stringify(body.head));
 const recovered=await inspect();
 if(recovered.state!=='consistent-synthetic-lab'||recovered.epoch!==head.epoch)
  throw Error('Synthetic SAF restore quarantined');
 return {status:'lab-restored-not-official',epoch:recovered.epoch,
  bytes:read.bytes,sha256:read.sha256};
}
Object.assign((globalThis as unknown as {__val01V10Physical:Record<string,unknown>})
 .__val01V10Physical,{safBeginWrite,safCompleteWrite,safBeginRead,safCompleteRead});
