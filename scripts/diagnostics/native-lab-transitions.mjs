// Q4-R03/R04/R05: bounded read-only observations; mutations never retried.
import { LabFailure, observeUntil, withinDeadline, classifyFailure, normalizeAdbFailure } from './native-lab-runtime.mjs';
import { classifySurface, waitPublicSurface } from './native-lab-readiness.mjs';
import { parseNativeNodes, hasArea } from './native-ui-driver.mjs';
const readTransient=new Set(['CDP_TIMEOUT','CDP_DISCONNECTED','CDP_SOCKET_ERROR','CDP_SOCKET_TIMEOUT','CDP_SEND_FAILED']);
export function localPageTargets(list){
  if(!Array.isArray(list))throw new LabFailure('INVALID_HARNESS_ARGUMENT');
  const targets=[];
  for(const x of list){
    if(x?.type!=='page'||typeof x.id!=='string'||!x.id||typeof x.webSocketDebuggerUrl!=='string')continue;
    let page,ws;
    try{page=new URL(x.url);ws=new URL(x.webSocketDebuggerUrl);}catch{continue;}
    if(!['http:','https:'].includes(page.protocol)||page.hostname!=='localhost'||page.username||page.password||
      ws.protocol!=='ws:'||!/^\/devtools\/page\/[A-Za-z0-9_.-]+$/.test(ws.pathname)||ws.search||ws.hash)continue;
    targets.push({id:x.id,endpoint:'ws://127.0.0.1:9222'+ws.pathname});
  }
  if(new Set(targets.map(x=>x.id)).size!==targets.length||targets.length>8)
    throw new LabFailure('PREFLIGHT_CDP_TARGET_AMBIGUOUS');
  return targets;
}
export async function waitUniquePublicTarget({sample,inspect,verify=()=>true,expected,timeoutMs=60000,now,sleep,onState=()=>{}}){
  let prior=null,streak=0,last='no-target';
  const reset=()=>{prior=null;streak=0;};
  try{
    return await observeUntil(async()=>{
      const snapshot=await sample();
      if(!snapshot||snapshot.foreground!==true||!snapshot.pid){reset();last='not-foreground';onState({state:last,candidates:0,matches:0});return false;}
      const targets=localPageTargets(snapshot.list);
      let incomplete=false;const matched=[];
      for(const target of targets){
        try{
          const frame=await inspect(target);
          if(!frame||typeof frame.documentVisible!=='boolean'){incomplete=true;continue;}
          const state=classifySurface({...frame,foreground:true},expected);
          if(state==='ready')matched.push(target);
        }catch(error){
          if(!readTransient.has(classifyFailure(error).code))throw error;
          incomplete=true;
        }
      }
      if(!await verify(snapshot.pid)){reset();last='not-foreground';onState({state:last,candidates:targets.length,matches:0});return false;}
      if(incomplete||matched.length!==1){
        reset();last=incomplete?'inspection-incomplete':matched.length>1?'ambiguous':'no-target';
        onState({state:last,candidates:targets.length,matches:matched.length});return false;
      }
      const key=JSON.stringify([snapshot.pid,matched[0].id,matched[0].endpoint]);
      streak=prior===key?streak+1:1;prior=key;last=streak>=2?'stable':'single-sample';
      onState({state:last,candidates:targets.length,matches:1});
      return streak>=2?{...matched[0],pid:snapshot.pid}:false;
    },{timeoutMs,intervalMs:450,now,sleep,retryReadErrors:false});
  }catch(error){
    if(classifyFailure(error).code==='OBSERVATION_DEADLINE'&&last==='ambiguous'){
      const blocked=new LabFailure('PREFLIGHT_CDP_TARGET_AMBIGUOUS');blocked.observation=error.observation;throw blocked;
    }
    throw error;
  }
}
const snapshotPath='/sdcard/ap02-f2-ui.xml';
function snapshotError(error,stage){
  const normalized=normalizeAdbFailure(error);
  if(normalized instanceof LabFailure)return normalized;
  const message=String(error?.stderr??'')+'\n'+String(error?.stdout??'');
  if(/permission denied/i.test(message))return new LabFailure('NATIVE_UI_PERMISSION_DENIED');
  if(stage==='dump'&&/null root node|could not get idle state/i.test(message))return new LabFailure('NATIVE_UI_TREE_UNAVAILABLE');
  if(stage==='read'&&/(?:No such file or directory|does not exist)/i.test(message))
    return new LabFailure('NATIVE_UI_TREE_UNAVAILABLE');
  return new LabFailure(stage==='dump'?'NATIVE_UI_DUMP_FAILED':'NATIVE_UI_READ_FAILED');
}
export function readNativeSnapshot(adb,onState=()=>{}){
  try{adb('shell','rm','-f',snapshotPath);}catch(error){throw snapshotError(error,'cleanup');}
  let dump,xml;
  try{dump=adb('shell','uiautomator','dump',snapshotPath);}catch(error){throw snapshotError(error,'dump');}
  if(/null root node|could not get idle state/i.test(dump))throw new LabFailure('NATIVE_UI_TREE_UNAVAILABLE');
  try{xml=adb('shell','cat',snapshotPath);}catch(error){throw snapshotError(error,'read');}
  if(!/<hierarchy\b/.test(xml)||!/<\/hierarchy>\s*$/.test(xml))throw new LabFailure('NATIVE_UI_TREE_UNAVAILABLE');
  const nodes=parseNativeNodes(xml);
  if(!nodes.length)throw new LabFailure('NATIVE_UI_TREE_UNAVAILABLE');
  onState('snapshot-ready');return nodes;
}
export const nativeReadRetryCodes=['NATIVE_UI_TREE_UNAVAILABLE','ADB_TRANSPORT_OFFLINE','ADB_TRANSPORT_TIMEOUT'];
export async function waitNativeSelection({read,foreground,select,timeoutMs=45000,now,sleep,onState=()=>{}}){
  let prior=null,count=0;
  return observeUntil(async()=>{
    let nodes;
    try{
      if(!foreground()){prior=null;count=0;onState('not-documentsui');return false;}
      nodes=read();
      if(!foreground()){prior=null;count=0;onState('not-documentsui');return false;}
    }catch(error){
      prior=null;count=0;onState(classifyFailure(error).code);throw error;
    }
    const chosen=select(nodes);
    if(!chosen){prior=null;count=0;onState('missing-or-ambiguous');return false;}
    count=chosen.key===prior?count+1:1;prior=chosen.key;
    onState(count>=2?'stable':'single-sample');
    return count>=2?chosen.value:false;
  },{timeoutMs,intervalMs:450,now,sleep,retryReadErrors:true,retryCodes:nativeReadRetryCodes});
}
export function uniqueNativeControl(nodes,predicate){
  const found=nodes.filter(n=>n.enabled===true&&hasArea(n)&&predicate(n));
  if(found.length!==1)return null;
  const n=found[0];
  return {key:JSON.stringify([n.pkg,n.id,n.clazz,n.bounds,n.text,n.desc]),value:n};
}
export function requireDocumentsUiTap({foreground,tap,node}){
  if(!foreground())throw new LabFailure('NATIVE_UI_FOREGROUND_LOST');
  return tap(node);
}
export function safFailureDetail(d){
  if(d.activityTrail?.observedDocumentsUi)return 'NATIVE_V7_SAF_OBSERVED_UI_UNAVAILABLE';
  return d.rejected?'NATIVE_V7_EXPORT_REJECTED_BEFORE_SAF':
    d.validationRejected?'NATIVE_V7_EXPORT_FORM_REJECTED':
    d.locked?'NATIVE_V7_VAULT_LOCKED_BEFORE_SAF':
    d.cipherBusy?'NATIVE_V7_EXPORT_STILL_IN_PROGRESS':
    d.foreground===true?'NATIVE_V7_SAF_MISSING_FOREGROUND':
    d.foreground===false?'NATIVE_V7_SAF_NOT_OBSERVED_OFF_FOREGROUND':null;
}
export async function prepareClassCreation({sample,authenticate,timeoutMs=60000,now,sleep,onState=()=>{}}){
  return withinDeadline(async()=>{
    await waitPublicSurface({sample,destination:'home',authenticate,timeoutMs,now,sleep,onState});
    // Recheck without reauth or retry within the same absolute deadline.
    const state=classifySurface(await sample(),'home');onState(state);
    if(state!=='ready')throw new LabFailure('CLASS_CREATION_CONTROL_CHANGED');
    return true;
  },{timeoutMs,now});
}
