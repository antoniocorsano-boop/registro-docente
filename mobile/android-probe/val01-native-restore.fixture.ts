// Synthetic emulator only. No production Root or real archive. Reauthorize
// only the isolated logical lab operation after the native chooser returns.
import {nativeRestoreCopies,nativePrepareSelectedRestore,nativeRestoredSummary} from '../../tests/browser/fixtures/val01-s6d-db2.fixture';
import {nativeDocumentCopies,nativePrepareSelectedDocumentRestore,nativeRestoredDocumentSummary} from '../../tests/browser/fixtures/val01-s6d-db2.fixture';
import {saveEncryptedBackupOnAndroid,readEncryptedBackupOnAndroid} from '../../src/security/androidBackupExport';
import {ANDROID_SESSION_EVENT,readAndroidSessionState,authorizeAndroidSession,acknowledgeAndroidShield,registerAndroidFileAccess} from '../../src/security/androidSessionLifecycle';
type Kind='recovery'|'target';
const namesV7={recovery:'Backup_Cifrato_GDPR_2031-01-15.enc.json',target:'Backup_Cifrato_GDPR_2031-01-16.enc.json'};
const namesV8={recovery:'Backup_DOC01_V8_2031-01-17.enc.json',target:'Backup_DOC01_V8_2031-01-18.enc.json'};
let names=namesV7;
let copies:Record<Kind,string>|null=null;
let selected:Partial<Record<Kind,string>>={};
let generation=0,revision=0,authenticatedEpoch:number|null=null,busy=false;
let grant:Awaited<ReturnType<typeof nativePrepareSelectedRestore>>|null=null;
let abort:AbortController|null=null;
let status:{phase:string;kind?:Kind;bytes?:number;sha256?:string}={phase:'idle'};
function clearGrant(){abort?.abort();abort=null;grant=null;}
document.addEventListener(ANDROID_SESSION_EVENT,()=>{
 revision++;authenticatedEpoch=null;
 // A chooser may suspend the synthetic operation before authorization.
 // Once preparation begins every lifecycle change revokes the grant.
 clearGrant();
});
async function access(active:()=>boolean){
 for(let i=0;i<100&&active();i++){
  const s=await readAndroidSessionState();
  if(s?.foreground){
   const r=revision;
   await authorizeAndroidSession(s.epoch);
   if(!active())return false;
   await acknowledgeAndroidShield(s.epoch,true);
   const observed=await readAndroidSessionState();
   if(!active())return false;
   if(!observed?.foreground||observed.epoch!==s.epoch||revision!==r)continue;
   authenticatedEpoch=s.epoch;return active();
  }
  await new Promise(r=>setTimeout(r,100));
 }
 return false;
}
registerAndroidFileAccess(access);
const digest=async(text:string)=>{
 const bytes=new TextEncoder().encode(text);
 const hash=await crypto.subtle.digest('SHA-256',bytes);
 return {bytes:bytes.length,sha256:Array.from(new Uint8Array(hash),v=>v.toString(16).padStart(2,'0')).join('')};
};
function assertKind(kind:Kind){if(kind!=='recovery'&&kind!=='target')throw Error('Invalid synthetic copy');}
function start(kind:Kind,operation:'write'|'read'){
 assertKind(kind);
 if(busy||!copies||grant||abort)throw Error('Synthetic operation unavailable');
 const expected=copies[kind],epoch=++generation;
 busy=true;status={phase:'picker',kind};
 if(operation==='read')delete selected[kind];
 const active=()=>generation===epoch;
 void (async()=>{
  try{
   if(operation==='write'){
    const outcome=await saveEncryptedBackupOnAndroid(expected,names[kind],active);
    if(outcome==='verified'&&active())status={phase:'written',kind,...await digest(expected)};
    else status={phase:'cancelled',kind};
   }else{
    const text=await readEncryptedBackupOnAndroid(active);
    if(text===null||!active()){status={phase:'cancelled',kind};return;}
    const actual=await digest(text),wanted=await digest(expected);
    if(!active()||actual.bytes!==wanted.bytes||actual.sha256!==wanted.sha256)throw Error('Wrong synthetic document');
    selected[kind]=text;
    status={phase:'read',kind,...actual};
   }
  }catch{status={phase:'error',kind};}
  finally{busy=false;}
 })();
 return true;
}
Object.assign(globalThis,{__val01NativeRestore:{
 async createCopies(){
  if(busy||grant||abort)throw Error('Synthetic operation unavailable');
  selected={};names=namesV7;copies=await nativeRestoreCopies();
  return {recovery:await digest(copies.recovery),target:await digest(copies.target)};
 },
 write:(kind:Kind)=>start(kind,'write'),
 read:(kind:Kind)=>start(kind,'read'),
 status:()=>status,
 async prepare(wrong=false){
  if(busy||grant||abort||!selected.recovery||!selected.target)return 'rejected';
  const recovery=selected.recovery,target=selected.target;
  selected={};copies=null;
  const r=revision,s=await readAndroidSessionState();
  if(!s?.foreground||authenticatedEpoch!==s.epoch||revision!==r)return 'rejected';
  const controller=new AbortController();abort=controller;
  try{
   const next=await nativePrepareSelectedRestore(new Blob([recovery]),new Blob([target]),controller.signal,wrong);
   if(controller.signal.aborted||abort!==controller||revision!==r)throw Error('Synthetic authorization expired');
   grant=next;return 'prepared';
  }catch{clearGrant();return 'rejected';}
 },
 async commit(confirmed:boolean){
  const pending=grant,controller=abort;
  grant=null;
  if(!pending||!controller||controller.signal.aborted){clearGrant();return 'rejected';}
  try{
   const r=revision,s=await readAndroidSessionState();
   if(!s?.foreground||authenticatedEpoch!==s.epoch||revision!==r||abort!==controller)throw Error('Synthetic authorization expired');
   await pending.commit(confirmed);return 'committed';
  }catch{return 'rejected';}
  finally{clearGrant();}
 },
 summary:nativeRestoredSummary
}});

// DOC-01/D4c3d2 — same authenticated Android SAF bridge, separate V8
// synthetic-only entrypoint. It reuses the existing chooser, byte digest,
// foreground-epoch revocation and one-use grant lifecycle, not a second picker.
Object.assign(globalThis,{__doc01NativeRestore:{
 async createCopies(){
  if(busy||grant||abort)throw Error('Synthetic operation unavailable');
  selected={};names=namesV8;copies=await nativeDocumentCopies();
  return {recovery:await digest(copies.recovery),target:await digest(copies.target)};
 },
 write:(kind:Kind)=>start(kind,'write'),
 read:(kind:Kind)=>start(kind,'read'),
 status:()=>status,
 async prepare(wrong=false){
  if(busy||grant||abort||!selected.recovery||!selected.target)return 'rejected';
  const recovery=selected.recovery,target=selected.target;
  selected={};copies=null;
  const r=revision,s=await readAndroidSessionState();
  if(!s?.foreground||authenticatedEpoch!==s.epoch||revision!==r)return 'rejected';
  const controller=new AbortController();abort=controller;
  try{
   const next=await nativePrepareSelectedDocumentRestore(new Blob([recovery]),new Blob([target]),controller.signal,wrong);
   if(controller.signal.aborted||abort!==controller||revision!==r)throw Error('Synthetic authorization expired');
   grant=next;return 'prepared';
  }catch{clearGrant();return 'rejected';}
 },
 async commit(confirmed:boolean){
  const pending=grant,controller=abort;
  grant=null;
  if(!pending||!controller||controller.signal.aborted){clearGrant();return 'rejected';}
  try{
   const r=revision,s=await readAndroidSessionState();
   if(!s?.foreground||authenticatedEpoch!==s.epoch||revision!==r||abort!==controller)throw Error('Synthetic authorization expired');
   await pending.commit(confirmed);return 'committed';
  }catch{return 'rejected';}
  finally{clearGrant();}
 },
 summary:nativeRestoredDocumentSummary
}});
