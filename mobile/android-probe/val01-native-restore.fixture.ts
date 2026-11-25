import {nativeSeedInstitutionalHistory,nativeInstitutionalRestoreCopies,
 nativePrepareSelectedInstitutionalRestore,nativeInstitutionalRestoredSummary}
 from '../../tests/browser/fixtures/val01-s6d-db2.fixture';
// Synthetic emulator only. No production Root or real archive. Reauthorize
// only the isolated logical lab operation after the native chooser returns.
import {nativeRestoreCopies,nativePrepareSelectedRestore,nativeRestoredSummary} from '../../tests/browser/fixtures/val01-s6d-db2.fixture';
import {nativeSeedDocumentHistory,nativeDocumentRestoreCopies,nativePrepareSelectedDocumentRestore,nativeDocumentRestoredSummary} from '../../tests/browser/fixtures/val01-s6d-db2.fixture';
import {saveEncryptedBackupOnAndroid,readEncryptedBackupOnAndroid} from '../../src/security/androidBackupExport';
import {ANDROID_SESSION_EVENT,readAndroidSessionState,authorizeAndroidSession,acknowledgeAndroidShield,registerAndroidFileAccess} from '../../src/security/androidSessionLifecycle';
type Kind='recovery'|'target';
const names={recovery:'Backup_Valutazioni_V7_2031-01-15.enc.json',target:'Backup_Valutazioni_V7_2031-01-16.enc.json'};
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
  selected={};copies=await nativeRestoreCopies();
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


/** DOC-01/D4c3d2 — independent, synthetic V8 native SAF session.
 * All picker/file APIs are the same qualified Capacitor bridge as V7;
 * distinct names and a distinct grant prevent accidental cross-version reuse.
 */
const docNames={recovery:'Backup_Cifrato_GDPR_2031-01-17.enc.json',
 target:'Backup_Cifrato_GDPR_2031-01-18.enc.json'};
let docCopies:Record<Kind,string>|null=null;
let docSelected:Partial<Record<Kind,string>>={};
let docGeneration=0,docBusy=false;
let docGrant:Awaited<ReturnType<typeof nativePrepareSelectedDocumentRestore>>|null=null;
let docAbort:AbortController|null=null;
let docStatus:{phase:string;kind?:Kind;bytes?:number;sha256?:string}={phase:'idle'};
function clearDocGrant(){docAbort?.abort();docAbort=null;docGrant=null;}
document.addEventListener(ANDROID_SESSION_EVENT,()=>clearDocGrant());
function docStart(kind:Kind,operation:'write'|'read'){
 assertKind(kind);
 if(docBusy||busy||!docCopies||docGrant||docAbort)throw Error('Synthetic document picker unavailable');
 const expected=docCopies[kind],generation=++docGeneration;
 const active=()=>docGeneration===generation;
 docBusy=true;docStatus={phase:'picker',kind};
 if(operation==='read')delete docSelected[kind];
 void (async()=>{
  try{
   if(operation==='write'){
    const result=await saveEncryptedBackupOnAndroid(expected,docNames[kind],active);
    docStatus=result==='verified'&&active()?{phase:'written',kind,...await digest(expected)}:{phase:'cancelled',kind};
   }else{
    const text=await readEncryptedBackupOnAndroid(active);
    if(text===null||!active()){docStatus={phase:'cancelled',kind};return;}
    const actual=await digest(text),expectedDigest=await digest(expected);
    if(!active()||actual.bytes!==expectedDigest.bytes||actual.sha256!==expectedDigest.sha256)throw Error('Wrong V8 encrypted file');
    docSelected[kind]=text;
    docStatus={phase:'read',kind,...actual};
   }
  }catch{docStatus={phase:'error',kind};}
  finally{docBusy=false;}
 })();
 return true;
}
Object.assign(globalThis,{__doc01NativeRestore:{
 async seedHistory(){
  if(docBusy||busy||docAbort||docGrant)throw Error('Synthetic document restore is busy');
  return nativeSeedDocumentHistory();
 },
 async createCopies(){
  if(docBusy||busy||docAbort||docGrant)throw Error('Synthetic document restore unavailable');
  docSelected={};docCopies=await nativeDocumentRestoreCopies();
  return {recovery:await digest(docCopies.recovery),target:await digest(docCopies.target)};
 },
 write:(kind:Kind)=>docStart(kind,'write'),
 read:(kind:Kind)=>docStart(kind,'read'),
 status:()=>docStatus,
 async prepare(wrong=false){
  if(docBusy||busy||docGrant||docAbort||!docSelected.recovery||!docSelected.target)return 'rejected';
  const recovery=docSelected.recovery,target=docSelected.target;
  docSelected={};docCopies=null;
  const before=revision,state=await readAndroidSessionState();
  if(!state?.foreground||authenticatedEpoch!==state.epoch||revision!==before)return 'rejected';
  const controller=new AbortController();docAbort=controller;
  try{
   const grant=await nativePrepareSelectedDocumentRestore(new Blob([recovery]),new Blob([target]),controller.signal,wrong);
   if(controller.signal.aborted||docAbort!==controller||revision!==before)throw Error('V8 consent expired');
   docGrant=grant;return 'prepared';
  }catch{clearDocGrant();return 'rejected';}
 },
 async commit(confirmed:boolean){
  const pending=docGrant,controller=docAbort;
  docGrant=null;
  if(!pending||!controller||controller.signal.aborted){clearDocGrant();return 'rejected';}
  try{
   const before=revision,state=await readAndroidSessionState();
   if(!state?.foreground||authenticatedEpoch!==state.epoch||revision!==before||docAbort!==controller||controller.signal.aborted)throw Error('V8 session expired');
   await pending.commit(confirmed);return 'committed';
  }catch{return 'rejected';}
  finally{clearDocGrant();}
 },
 summary:nativeDocumentRestoredSummary
}});


/** DOC-01/D4c3e6 — independently selected real Android SAF V9 ciphertext.
 * The driver never imports the production Root and does not invent consent.
 * The actual cold process restart is verified by the outer ADB harness.
 */
const v9Names={recovery:'Backup_Cifrato_GDPR_2031-01-19.enc.json',
 target:'Backup_Cifrato_GDPR_2031-01-20.enc.json'};
let v9Copies:Record<Kind,string>|null=null;
let v9Selected:Partial<Record<Kind,string>>={};
let v9Generation=0,v9Busy=false;
let v9Grant:Awaited<ReturnType<typeof nativePrepareSelectedInstitutionalRestore>>|null=null;
let v9Abort:AbortController|null=null;
let v9Status:{phase:string;kind?:Kind;bytes?:number;sha256?:string}={phase:'idle'};
function clearV9Grant(){v9Abort?.abort();v9Abort=null;v9Grant=null;}
document.addEventListener(ANDROID_SESSION_EVENT,()=>clearV9Grant());
function v9Start(kind:Kind,operation:'write'|'read'){
 assertKind(kind);
 if(v9Busy||busy||docBusy||!v9Copies||v9Grant||v9Abort)
  throw Error('Synthetic V9 file picker unavailable');
 const expected=v9Copies[kind],next=++v9Generation;
 const active=()=>next===v9Generation;
 v9Busy=true;v9Status={phase:'picker',kind};
 if(operation==='read')delete v9Selected[kind];
 void(async()=>{
  try{
   if(operation==='write'){
    const result=await saveEncryptedBackupOnAndroid(expected,v9Names[kind],active);
    v9Status=result==='verified'&&active()?
     {phase:'written',kind,...await digest(expected)}:{phase:'cancelled',kind};
   }else{
    const text=await readEncryptedBackupOnAndroid(active);
    if(text===null||!active()){v9Status={phase:'cancelled',kind};return;}
    const actual=await digest(text),wanted=await digest(expected);
    if(!active()||actual.bytes!==wanted.bytes||actual.sha256!==wanted.sha256)
     throw Error('Incorrect institutional V9 encrypted copy');
    v9Selected[kind]=text;
    v9Status={phase:'read',kind,...actual};
   }
  }catch{v9Status={phase:'error',kind};}
  finally{v9Busy=false;}
 })();
 return true;
}
Object.assign(globalThis,{__doc01NativeV9Restore:{
 async seedHistory(){
  if(v9Busy||busy||docBusy||v9Abort||v9Grant)
   throw Error('Synthetic institutional V9 session busy');
  return nativeSeedInstitutionalHistory();
 },
 async createCopies(){
  if(v9Busy||busy||docBusy||v9Abort||v9Grant)
   throw Error('Synthetic institutional V9 session unavailable');
  v9Selected={};v9Copies=await nativeInstitutionalRestoreCopies();
  return {recovery:await digest(v9Copies.recovery),
   target:await digest(v9Copies.target)};
 },
 write:(kind:Kind)=>v9Start(kind,'write'),
 read:(kind:Kind)=>v9Start(kind,'read'),
 status:()=>v9Status,
 async prepare(wrong=false){
  if(v9Busy||busy||docBusy||v9Grant||v9Abort||!v9Selected.recovery||!v9Selected.target)
   return 'rejected';
  const recovery=v9Selected.recovery,target=v9Selected.target;
  v9Selected={};v9Copies=null;
  const before=revision,state=await readAndroidSessionState();
  if(!state?.foreground||authenticatedEpoch!==state.epoch||revision!==before)
   return 'rejected';
  const controller=new AbortController();v9Abort=controller;
  try{
   const prepared=await nativePrepareSelectedInstitutionalRestore(
    new Blob([recovery]),new Blob([target]),controller.signal,wrong);
   if(controller.signal.aborted||v9Abort!==controller||revision!==before)
    throw Error('V9 authorization expired');
   v9Grant=prepared;
   return 'prepared';
  }catch{clearV9Grant();return 'rejected';}
 },
 async commit(confirmed:boolean){
  const pending=v9Grant,controller=v9Abort;
  v9Grant=null;
  if(!pending||!controller||controller.signal.aborted){clearV9Grant();return 'rejected';}
  try{
   const before=revision,state=await readAndroidSessionState();
   if(!state?.foreground||authenticatedEpoch!==state.epoch||revision!==before||
      v9Abort!==controller||controller.signal.aborted)
    throw Error('V9 session expired');
   await pending.commit(confirmed);return 'committed';
  }catch{return 'rejected';}
  finally{clearV9Grant();}
 },
 summary:nativeInstitutionalRestoredSummary
}});
