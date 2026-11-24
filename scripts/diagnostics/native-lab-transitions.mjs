// Q4-R03/R04/R05: bounded read-only observations; mutations never retried.
import { LabFailure, observeUntil, withinDeadline, classifyFailure, normalizeAdbFailure } from './native-lab-runtime.mjs';
import { classifySurface, waitPublicSurface } from './native-lab-readiness.mjs';
import { parseNativeNodes, hasArea } from './native-ui-driver.mjs';
const readTransient=new Set(['CDP_TIMEOUT','CDP_DISCONNECTED','CDP_SOCKET_ERROR','CDP_SOCKET_TIMEOUT','CDP_SEND_FAILED']);
// Chromium AwDevToolsManagerDelegate::GetTargetDescription supplies native
// attachment, visibility and screen rectangle. Missing facts are not evidence
// that a competing WebView is inactive. Keep no raw descriptions or geometry.
export function nativeViewState(description){
  let d;
  try{d=typeof description==='string'?JSON.parse(description):null;}catch{return 'unknown';}
  if(!d||typeof d!=='object'||Array.isArray(d))return 'unknown';
  if(d.attached===false||d.visible===false||d.empty===true)return 'inactive';
  if(d.attached===true&&d.visible===true&&d.empty===false&&
    Number.isFinite(d.width)&&d.width>0&&Number.isFinite(d.height)&&d.height>0)return 'active';
  return 'unknown';
}
export function localPageTargets(list){
  if(!Array.isArray(list))throw new LabFailure('INVALID_HARNESS_ARGUMENT');
  const targets=[];
  for(const x of list){
    if(x?.type!=='page'||typeof x.id!=='string'||!x.id||typeof x.webSocketDebuggerUrl!=='string')continue;
    let page,ws;
    try{page=new URL(x.url);ws=new URL(x.webSocketDebuggerUrl);}catch{continue;}
    if(!['http:','https:'].includes(page.protocol)||page.hostname!=='localhost'||page.username||page.password||
      ws.protocol!=='ws:'||!/^\/devtools\/page\/[A-Za-z0-9_.-]+$/.test(ws.pathname)||ws.search||ws.hash)continue;
    targets.push({id:x.id,endpoint:'ws://127.0.0.1:9222'+ws.pathname,nativeView:nativeViewState(x.description)});
  }
  if(new Set(targets.map(x=>x.id)).size!==targets.length||new Set(targets.map(x=>x.endpoint)).size!==targets.length||targets.length>8)
    throw new LabFailure('PREFLIGHT_CDP_TARGET_AMBIGUOUS');
  return targets;
}
// Native-inactive candidates can be excluded positively. For several native
// active views, only one affirmatively focused document may be selected; all
// others must explicitly report no focus. DOM readiness alone is insufficient.
export async function identifyPublicTarget(targets,inspect,expected){
  if(targets.some(x=>x.nativeView==='unknown'))
    return {state:'native-evidence-incomplete',matches:0};
  const active=targets.filter(x=>x.nativeView==='active');
  const observations=[];
  for(const target of active){
    try{
      const frame=await inspect(target);
      if(!frame||typeof frame.documentVisible!=='boolean'||
         (active.length>1&&typeof frame.documentFocused!=='boolean'))
        return {state:'inspection-incomplete',matches:0};
      observations.push({target,frame});
    }catch(error){
      if(!readTransient.has(classifyFailure(error).code))throw error;
      return {state:'inspection-incomplete',matches:0};
    }
  }
  if(!observations.length)return {state:'no-target',matches:0};
  const eligible=observations.length===1?observations:observations.filter(x=>x.frame.documentFocused===true);
  if(eligible.length!==1)return {state:'ambiguous',matches:eligible.length||observations.length};
  const match=eligible[0];
  if(classifySurface({...match.frame,foreground:true},expected)!=='ready')
    return {state:'no-target',matches:0};
  return {state:'identified',matches:1,target:match.target};
}
export async function waitUniquePublicTarget({sample,inspect,verify=()=>true,expected,timeoutMs=60000,now,sleep,onState=()=>{},
  acquire,inspectAcquired,confirmIdentity,release}){
  if(acquire&&(!inspectAcquired||!confirmIdentity||!release))throw new LabFailure('INVALID_HARNESS_ARGUMENT');
  let prior=null,streak=0,last='no-target',held=null,completed=false;
  const reset=()=>{prior=null;streak=0;};
  try{
    const result=await observeUntil(async()=>{
      const snapshot=await sample();
      if(!snapshot||snapshot.foreground!==true||!snapshot.pid){reset();last='not-foreground';onState({state:last,candidates:0,matches:0});return false;}
      const targets=localPageTargets(snapshot.list);
      const identified=await identifyPublicTarget(targets,inspect,expected);
      if(!await verify(snapshot.pid)){reset();last='not-foreground';onState({state:last,candidates:targets.length,matches:0});return false;}
      if(!identified.target){
        reset();last=identified.state;
        onState({state:last,candidates:targets.length,matches:identified.matches});return false;
      }
      const signature=list=>JSON.stringify(list.map(x=>[x.id,x.endpoint,x.nativeView]).sort((a,b)=>a[0].localeCompare(b[0])));
      const key=JSON.stringify([snapshot.pid,identified.target.id,identified.target.endpoint,signature(targets)]);
      streak=prior===key?streak+1:1;prior=key;last=streak>=2?'stable':'single-sample';
      onState({state:last,candidates:targets.length,matches:1});
      if(streak<2)return false;
      const selected={...identified.target,pid:snapshot.pid};
      if(!acquire)return selected;
      // The old final connection happened after this bounded loop, allowing
      // a transient visibility change to turn a valid search into a failure.
      // Open and validate the actual retained socket within the SAME budget.
      const rejectHandoff=state=>{
        reset();last=state;onState({state:last,candidates:targets.length,matches:1});return false;
      };
      let keep=false;
      try{
        held=await acquire(selected);
        if(!held)return rejectHandoff('handoff-incomplete');
        const frame=await inspectAcquired(held);
        if(!frame||typeof frame.documentVisible!=='boolean')return rejectHandoff('handoff-incomplete');
        if(classifySurface({...frame,foreground:true},expected)!=='ready')return rejectHandoff('handoff-not-ready');
        // Fresh list must describe the same candidate set, PID and endpoint.
        // No forwarding change, mutation, Page.enable or input during handoff.
        const identity=await confirmIdentity(selected);
        if(!identity||identity.pid!==selected.pid||identity.foreground!==true)
          return rejectHandoff('handoff-identity-changed');
        const currentTargets=localPageTargets(identity.list);
        if(signature(currentTargets)!==signature(targets))return rejectHandoff('handoff-identity-changed');
        const finalSelection=await identifyPublicTarget(currentTargets,
          target=>target.id===selected.id?inspectAcquired(held):inspect(target),expected);
        if(finalSelection.target?.id!==selected.id||!await verify(selected.pid))
          return rejectHandoff('handoff-selection-changed');
        last='handoff-stable';onState({state:last,candidates:targets.length,matches:1});
        keep=true;
        return {...selected,connection:held};
      }catch(error){
        if(!readTransient.has(classifyFailure(error).code))throw error;
        return rejectHandoff('handoff-incomplete');
      }finally{
        if(!keep&&held){release(held);held=null;}
      }
    },{timeoutMs,intervalMs:450,now,sleep,retryReadErrors:false});
    completed=true;
    return result;
  }catch(error){
    if(classifyFailure(error).code==='OBSERVATION_DEADLINE'&&(last==='ambiguous'||last.startsWith('handoff-'))){
      const blocked=new LabFailure(last==='ambiguous'?'PREFLIGHT_CDP_TARGET_AMBIGUOUS':'PREFLIGHT_CDP_HANDOFF_UNSTABLE');
      blocked.observation=error.observation;throw blocked;
    }
    throw error;
  }finally{
    // A late success rejected by the observation deadline cannot leak a socket.
    if(!completed&&held)release(held);
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
