// AP-02/F2-DEVICE: isolated real Android WebView + production Privacy UI + native SAF.
// Only a debug laboratory APK and wholly synthetic profile/classes are allowed.
// Chrome DevTools drives public DOM controls; no application internals, plugin
// mocks, production credentials, plaintext backup uploads or external services.
import assert from 'node:assert/strict';
import {appiumSnapshot} from './appium-pilot/native-picker.mjs';
import { LabFailure, classifyFailure, commandBudget, commandBudgetInfo, classifyAdbDeadline, observeUntil, createPendingCommands, withoutObservationScope, cdpEvaluationFailure, normalizeAdbFailure, bestEffortDiagnostic, isTransportOrDeadline, createDialogTracker, createRecoveryConsentGate, observeAppiumBootstrap } from './native-lab-runtime.mjs';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { isInteractiveElement, publicHomeConfirmation, confirmHomeOnce, publicSurfaceFrame, waitSafReturnLock, waitPublicSurface, sampleDestinationFrame, waitBootReadiness, createPublicAuthentication, emulatorIdentity, classifySurface, versionFacts, completeFingerprint, safeSurfaceTrace } from './native-lab-readiness.mjs';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { resumedActivity, hasArea } from './native-ui-driver.mjs';
import { waitUniquePublicTarget, readNativeSnapshot, waitNativeSelection, uniqueNativeControl, requireDocumentsUiTap, safFailureDetail, prepareClassCreation, readGuardedNativeSnapshot, waitNativeOpenOrReturn } from './native-lab-transitions.mjs';
import { probePackagePids, verifiedProcessStop } from './native-process-probe.mjs';
import { classifyResumedActivity, startSafActivityProbe } from './native-saf-lifecycle-probe.mjs';
import { createAdbTransportTrace } from './native-adb-transport-probe.mjs';
import { classifyHomeNavigationFrame, safeHomeNavigationReport } from './native-home-navigation-probe.mjs';
import {labV7Date,isOriginalV7Name,selectNewLabV7Name,quotedLabV7Path,pullLabV7Bytes} from './native-v7-document-discovery.mjs';

const pkg = 'it.trama.registrodocente.lab.ap02v7';
const activity = pkg + '/it.trama.registrodocente.prova.MainActivity';
const api = Number(process.env.AP02_API);
const sha = process.env.CANDIDATE_SHA;
const startupOnly=process.env.AP02_STARTUP_ONLY==='true';
const dualDiagnostic=process.env.Q5_DUAL_DIAGNOSTIC==='true';
const dualQualification=process.env.Q5_DUAL_QUALIFICATION==='true';
const dualNative=dualDiagnostic||dualQualification;
assert.ok(!(dualDiagnostic&&dualQualification),'DUAL_MODES_MUTUALLY_EXCLUSIVE');
if(dualDiagnostic)assert.ok(!startupOnly,'DUAL_DIAGNOSTIC_REQUIRES_FULL_FLOW');
let nativeSession=null,nativeSnapshots=0;
if(startupOnly)assert.match(process.env.Q4_TRIAL||'',/^[123]$/);
assert.ok([32,36].includes(api));
assert.match(sha || '', /^[0-9a-f]{40}$/);
const password = 'ap02-local-synthetic-2026';
const copyPassword = 'ap02-copy-synthetic-2026';
const originalClass = 'Classe fittizia F2 A';
const newerClass = 'Classe fittizia F2 B';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const adbTransport = createAdbTransportTrace();
const adb = (...args) => {
  const budget=commandBudgetInfo(30000);
  const began = Date.now();
  try {
    const result = execFileSync('adb', args, { encoding: 'utf8', timeout: budget.timeoutMs, killSignal: 'SIGKILL', stdio:['ignore','pipe','pipe'] }).trim();
    adbTransport.record(args, began, 'ok',budget);
    return result;
  } catch (error) {
    // Only an allowlisted command category, duration and transport result are
    // retained; never persist ADB arguments, stderr or response text.
    adbTransport.record(args, began,
      error?.code === 'ETIMEDOUT' ? 'timeout' : 'failed',budget);
    throw classifyAdbDeadline(error,budget);
  }
};
const probe = () => probePackagePids(adb, pkg);
const nativeForeground = () => resumedActivity(adb('shell','dumpsys','activity','activities'), pkg);
const results = [];
const out = dualDiagnostic?'ap02-device-evidence/dual-diagnostic':'ap02-device-evidence';
mkdirSync(out,{recursive:true});
let phase = 'preflight';
let lastSafActivityTrail = null;
const surfaceTransitions=[];
let lastDestinationFrame=null;
const surfaceReadFailures={ADB_TRANSPORT_TIMEOUT:0,ADB_TRANSPORT_OFFLINE:0};
const readyDestinations=new Set();
let cdpTargetObservation=null,nativeUiObservation=null,classControlObservation=null;
const environment={schemaVersion:1,candidate:sha,api,syntheticOnly:true,productionRelease:false,
  runId:process.env.GITHUB_RUN_ID||null,runAttempt:process.env.GITHUB_RUN_ATTEMPT||null,
  bootReady:false,bootObservation:null,packageReady:false,launches:0,foreground:false,cdpReady:false,versions:null,emulatorIdentity:null,complete:false,
  appiumBootstrap:[]};
function saveEnvironment(){writeFileSync(out+'/environment.json',JSON.stringify(environment,null,2));}
const surfaceExpression=(label)=>'('+publicSurfaceFrame.toString()+')('+JSON.stringify(label)+',document,getComputedStyle,'+isInteractiveElement.toString()+')';
const interactiveSource=isInteractiveElement.toString();
async function samplePublicSurface(label){
  const frame=await dom(surfaceExpression(label));
  return {...frame,foreground:nativeForeground()};
}
function observeSurface(destination,state){
  const previous=surfaceTransitions[surfaceTransitions.length-1];
  if(previous?.destination!==destination||previous?.state!==state){
    surfaceTransitions.push({destination,state});
    if(surfaceTransitions.length>80)surfaceTransitions.shift();
  }
}
async function waitDestination(destination,label=null,ms=60000,reauth=true){
  const ready=await waitPublicSurface({destination,timeoutMs:ms,
    sample:async()=>{
      const frame=await sampleDestinationFrame({readFrame:()=>dom(surfaceExpression(label)),foreground:nativeForeground,destination});
      lastDestinationFrame={destination,foreground:frame.foreground,documentVisible:frame.documentVisible===true,
        gatePending:frame.gatePending===true,gateBusy:frame.gateBusy===true,gateActionError:frame.gateActionError===true,
        protectedField:frame.protectedField===true,lock:frame.lock===true,setup:frame.setup===true,
        brand:frame.brand===true,home:frame.home===true};
      return frame;
    },
    onReadFailure:code=>{surfaceReadFailures[code]++;},
    onState:state=>observeSurface(destination,state),
    authenticate:reauth&&['home','privacy','class','class-detail'].includes(destination)?
      makePublicAuthentication('destination-'+destination):undefined});
  readyDestinations.add(destination);
  return ready;
}
async function preflightBoot(){
  phase='preflight-boot';
  saveEnvironment();
  await waitBootReadiness(adb,{onState:state=>{environment.bootObservation=state;}});
  environment.bootReady=true;
  saveEnvironment();
  if(Number(adb('shell','getprop','ro.build.version.sdk'))!==api)throw new LabFailure('PREFLIGHT_WRONG_API');
  phase='preflight-versions';
  const sdk=process.env.ANDROID_HOME||process.env.ANDROID_SDK_ROOT;
  if(!sdk)throw new LabFailure('PREFLIGHT_VERSION_INCOMPLETE');
  const directory=join(sdk,'emulator'),binary=join(directory,'emulator');
  let metadata,binarySha256;
  try{
    metadata=readFileSync(join(directory,'source.properties'),'utf8');
    binarySha256=sha256(readFileSync(binary));
  }catch{throw new LabFailure('PREFLIGHT_VERSION_INCOMPLETE');}
  const emulatorProbe=spawnSync(binary,['-version'],
    {encoding:'utf8',timeout:commandBudget(10000),killSignal:'SIGKILL',stdio:['ignore','pipe','pipe']});
  const identity=emulatorIdentity({probe:emulatorProbe,packageMetadata:metadata,binarySha256});
  environment.emulatorIdentity=identity;
  saveEnvironment();
  if(!identity.version)throw new LabFailure('PREFLIGHT_VERSION_INCOMPLETE');
  environment.versions=versionFacts({adb:adb('version'),emulator:'Android emulator version '+identity.version+(identity.build?' (build_id '+identity.build+')':''),
    webview:adb('shell','dumpsys','webviewupdate'),androidBuild:adb('shell','getprop','ro.build.fingerprint'),
    runnerImage:process.env.ImageOS,runnerVersion:process.env.ImageVersion,node:process.version});
  saveEnvironment();
}
async function record(name, additional = {}) {
  await dialogTracker.flush();
  phase = name;
  results.push({ stage:name, status:'PASS', ...additional });
  writeFileSync(out+'/result.json',JSON.stringify({schemaVersion:1,candidate:sha,api,package:pkg,
    mode:'installed-professional-ui-real-saf',syntheticOnly:true,productionRelease:false,
    source:'public DOM in installed WebView, real Android DocumentsUI, native Capacitor plugin',
    results},null,2));
  console.log('AP02_DEVICE_STAGE_PASS',name);
}
function sha256(b){return createHash('sha256').update(b).digest('hex');}
async function until(fn, name, timeout = 60000, retryReadErrors = true) {
  // Names may include localized UI text or filenames; never retain them in
  // the failure record. Scope is inherited by bounded ADB/CDP commands.
  try{return await observeUntil(fn,{timeoutMs:timeout,retryReadErrors});}
  catch(error){
    if(error instanceof LabFailure&&error.observation){
      const purposes=['UI_TEXT_','ANDROID_INTERACTIVE_OR_LOCK_','ANDROID_SESSION_REAUTH_REQUIRED_',
        'ANDROID_SESSION_REAUTHORIZED_','EXACT_DOCUMENT_'];
      const prefix=purposes.find(p=>name.startsWith(p));
      const fixed=['WEBVIEW_DEBUG_TARGET','NAV_DRAWER','HOME_NAVIGATION_OR_CONFIRM',
        'HOME_INTERACTIVE_READY','VISIBLE_EXACT_HOME_CONFIRM','HOME_CONFIRM_DISMISSED',
        'PRIVACY_V7_EXPORT_BUTTON_READY','VISIBLE_CLASS_CREATION_CONTROL',
        'SYNTHETIC_CLASS_PROMPT_NOT_ACCEPTED','INTERACTIVE_SYNTHETIC_CLASS_AFTER_PROMPT',
        'ANDROID_DOCUMENTS_UI','DOC_ROOTS','DOC_DOWNLOADS','DOC_SAVE_BUTTON',
        'DOC_OPEN_BUTTON','RETURN_FROM_SAVE','RETURN_FROM_OPEN','SELECT_DOCUMENT',
        'V7_VERIFIED_NATIVE_RECEIPT','REAL_RECOVERY_CONSENT','REAL_V7_RESTORE_RESULT','PREFLIGHT_FOREGROUND'];
      error.observation.purpose=prefix?prefix.slice(0,-1):fixed.includes(name)?name:'OTHER_OBSERVATION';
    }
    throw error;
  }
}
const sendNativeRequest = (method,path,body) => fetch('http://127.0.0.1:4723'+path,{
    method,headers:{'content-type':'application/json'},
    ...(body===undefined?{}:{body:JSON.stringify(body)}),
    signal:AbortSignal.timeout(commandBudget(60000))});
async function nativeRequest(method,path,body){
  const response=await sendNativeRequest(method,path,body);
  const payload=await response.json();
  if(!response.ok||payload.value?.error)throw new LabFailure('NATIVE_UI_READ_FAILED');
  return payload.value;
}
function recordAppiumBootstrap(row) {
  environment.appiumBootstrap.push(row);
  // Persist each completed operation without suppressing its original outcome.
  try { saveEnvironment(); } catch {}
}
async function startNativeSession(){
  const capabilities={capabilities:{alwaysMatch:{
    platformName:'Android','appium:automationName':'UiAutomator2',
    'appium:deviceName':'Android Emulator','appium:appPackage':pkg,
    'appium:appActivity':'it.trama.registrodocente.prova.MainActivity',
    'appium:noReset':true,'appium:autoLaunch':false,'appium:autoWebview':false,
    'appium:shouldTerminateApp':false,'appium:newCommandTimeout':900,
    'appium:uiautomator2ServerReadTimeout':30000
  },firstMatch:[{}]}};
  const value=await observeAppiumBootstrap({
    operation:'create-session',
    send:method=>sendNativeRequest(method,'/session',capabilities),
    validate:value=>assert.match(value?.sessionId||'',/^[a-f0-9-]{36}$/i),
    record:recordAppiumBootstrap,
  });
  nativeSession=value.sessionId;
  await observeAppiumBootstrap({
    operation:'get-native-context',
    send:method=>sendNativeRequest(method,'/session/'+nativeSession+'/context'),
    validate:value=>assert.equal(value,'NATIVE_APP'),
    record:recordAppiumBootstrap,
  });
}
async function closeNativeSession(){
  if(!nativeSession)return;
  const id=nativeSession;nativeSession=null;
  await nativeRequest('DELETE','/session/'+id);
}
function nativeNodes() {
  if(dualNative){
    const nodes=readGuardedNativeSnapshot({session:nativeSession,foreground:documentsForeground,
      read:appiumSnapshot,onState:state=>{nativeUiObservation=state;}});
    nativeSnapshots++;
    return nodes;
  }
  // NATIVE_UI_TREE_UNAVAILABLE is a read-only transient; no tap is retried.
  return readNativeSnapshot(adb,state=>{nativeUiObservation=state;});
}
const doc = n => /documentsui/i.test(n.pkg);
const activitySurface=()=>classifyResumedActivity(adb('shell','dumpsys','activity','activities'),pkg);
const documentsForeground=()=>activitySurface()==='documentsui';
const nativeSelection=(select,timeout=45000)=>waitNativeSelection({
  read:nativeNodes,foreground:documentsForeground,select,timeoutMs:timeout,
  onState:state=>{nativeUiObservation=state;}
});
const findNative = (fn,name,timeout=45000) => nativeSelection(nodes=>uniqueNativeControl(nodes,fn),timeout);
function tap(n) {
  assert.ok(hasArea(n));
  const [x1,y1,x2,y2]=n.bounds;
  return requireDocumentsUiTap({foreground:documentsForeground,node:n,tap:()=>adb('shell','input','tap',String(Math.floor((x1+x2)/2)),String(Math.floor((y1+y2)/2)))});
}
async function downloads() {
  const root=n=>doc(n)&&/show roots|open navigation drawer|mostra radici/i.test(n.desc);
  const folder=n=>doc(n)&&/^(Downloads|Download)$/i.test(n.text);
  const decision=await nativeSelection(nodes=>{
    if(nodes.some(n=>folder(n)&&hasArea(n)))return {key:'downloads',value:'downloads'};
    const open=uniqueNativeControl(nodes,root);
    return open?{key:open.key,value:open.value}:null;
  },api===32?90000:45000);
  if(decision!=='downloads'){
    tap(decision);
    tap(await findNative(folder,'DOC_DOWNLOADS'));
  }
}
let nativeSaveCompletionCount=0;
async function nativeSave(alertIndex, activityProbe) {
  try {
    await downloads();
  } catch(error) {
    // Local instrumentation only: never inspect or upload decrypted archives,
    // class names, password values, native window contents or ciphertext.
    // The UI can silently cancel an export while Android is re-establishing
    // its foreground session; distinguish this from an inaccessible picker.
    const safe=await bestEffortDiagnostic(()=>dom('(function(){const buttons=Array.from(document.querySelectorAll("button"));'+
      'return {locked:!!document.querySelector("#vault-password"),'+
      'cipherBusy:document.body?.innerText?.includes("Cifratura in corso...")===true,'+
      'exportButtonVisible:buttons.some(e=>e.innerText?.trim()==="Esporta copia completa V7"'+
      '&&e.getClientRects().length>0&&getComputedStyle(e).visibility==="visible"),'+
      'documentVisibility:document.visibilityState};})()'));
    const failureAlert=dialogs.slice(alertIndex).some(d=>d.kind==='alert'&&
      /Copia V7 non completata o non verificata/i.test(d.message));
    const cancelledAlert=dialogs.slice(alertIndex).some(d=>d.kind==='alert'&&
      /Inserisci e conferma una password/i.test(d.message));
    const diagnostic={stage:'native-v7-saf-selection',
      api,foreground:await bestEffortDiagnostic(()=>Boolean(nativeForeground())),rejected:failureAlert,
      validationRejected:cancelledAlert,locked:safe?.locked??null,
      cipherBusy:safe?.cipherBusy??null,
      exportButtonVisible:safe?.exportButtonVisible??null,
      documentVisibility:safe?.documentVisibility??'unavailable',
      originalError:classifyFailure(error).code,
      activityTrail:activityProbe?.snapshot()??null};
    // Secondary UI evidence adds context, never replaces the primary failure.
    // Once DocumentsUI has been observed, Vault lock is expected; do not label
    // it NATIVE_V7_VAULT_LOCKED_BEFORE_SAF or erase the original error.
    // The closed detail taxonomy includes NATIVE_V7_EXPORT_REJECTED_BEFORE_SAF,
    // NATIVE_V7_EXPORT_STILL_IN_PROGRESS and NATIVE_V7_SAF_NOT_OBSERVED_OFF_FOREGROUND.
    diagnostic.detailCode=safFailureDetail(diagnostic);
    try{writeFileSync(out+'/saf-diagnostic.json',JSON.stringify(diagnostic,null,2));}catch{}
    throw error;
  }
  const saveControl=await findNative(n=>doc(n)&&/^(save|salva)$/i.test(n.text),'DOC_SAVE_BUTTON');
  noteSafPicker();
  tap(saveControl);
  await until(nativeForeground,'RETURN_FROM_SAVE',45000);
  // Picker return observed; this does not prove a new document was created.
  nativeSaveCompletionCount++;
  noteSafReturned();
  adbTransport.mark('picker-returned');
}
// Android opens an external DocumentsUI activity. The product deliberately
// suspends and shields the Vault onPause. Resume by explicitly authenticating
// through its actual LOCKED screen; never bypass Root, grant an epoch or call
// native plugin methods out of band.
let nativeReauthCount=0;
const safReturns=[];
let currentSafReturn=null;
function beginSafReturn(role){
  currentSafReturn={role,states:[],documentsUiObserved:false,returned:false,authenticated:false};
  safReturns.push(currentSafReturn);
  if(safReturns.length>4)safReturns.shift();
}
function markSafReturn(state){
  if(!currentSafReturn)return;
  const states=currentSafReturn.states;
  if(states[states.length-1]===state)return;
  states.push(state);
  if(states.length>64)states.shift();
  console.log('AP02_SAF_LIFECYCLE',api,currentSafReturn.role,state);
}
function noteSafPicker(){
  if(!documentsForeground())throw new LabFailure('NATIVE_UI_FOREGROUND_LOST');
  if(currentSafReturn)currentSafReturn.documentsUiObserved=true;
  markSafReturn('picker-observed');
}
function noteSafReturned(){
  if(currentSafReturn)currentSafReturn.returned=true;
  markSafReturn('activity-returned');
}
async function sampleSafReturn(){
  const activity=classifyResumedActivity(adb('shell','dumpsys','activity','activities'),pkg);
  if(activity!=='application')return {activity,frame:null};
  const frame=await dom(surfaceExpression(null));
  // A successful lock sample is valid only while the same Activity is in front.
  if(frame.lock&&frame.lockControls&&!nativeForeground())return {activity:'unknown',frame:null};
  return {activity,frame};
}
async function reauthenticateAfterPicker(kind) {
  phase='native-saf-return-reauth-'+kind;
  adbTransport.mark('lock-wait-start');
  if(!currentSafReturn?.documentsUiObserved||!currentSafReturn.returned)
    throw new LabFailure('NATIVE_UI_FOREGROUND_LOST');
  try{
    await waitSafReturnLock({sample:sampleSafReturn,onState:markSafReturn,timeoutMs:35000});
  }catch(error){
    if(error instanceof LabFailure&&error.observation)error.observation.purpose='ANDROID_SESSION_REAUTH_REQUIRED';
    throw error;
  }
  adbTransport.mark('lock-present');
  // Target import may synchronously show a public JS confirm immediately
  // after the native bridge's freshly authenticated file read. While that
  // modal is held, Runtime.evaluate cannot reliably sample the underlying DOM.
  // Exact downstream consent is positive evidence of this specific transition,
  // not a substitute for authentication on any other surface.
  const options=kind==='target-source'?{
    beforeSubmit:()=>recoveryConsent.startSubmit(),
    afterSubmit:()=>recoveryConsent.acknowledgeSubmit(),
    waitForSession:async()=>{
      await until(()=>recoveryConsent.ready()&&nativeForeground(),'REAL_RECOVERY_CONSENT',45000,false);
      markSafReturn('authenticated-import-consent-held');
    }
  }:{};
  await makePublicAuthentication('saf-'+kind,step=>{
    const marks={'lock-ready':'lock-ui-ready','password-entered':'password-field-entered',
      'unlock-requested':'unlock-requested','unlocked':'unlocked'};
    adbTransport.mark(marks[step]);
    markSafReturn(step);
  },options)();
  nativeReauthCount++;
  currentSafReturn.authenticated=true;
  currentSafReturn=null;
}
async function nativeChoose(filename) {
  await downloads();
  const sourceControl=await findNative(n=>doc(n)&&n.text===filename&&!/preview|anteprima/i.test(n.desc),'EXACT_DOCUMENT_'+filename);
  noteSafPicker();
  tap(sourceControl);
  const open=n=>doc(n)&&/^(open|apri)$/i.test(n.text);
  markSafReturn('document-tapped');
  // Observe return or a stable positive confirmation control; no duplicate tap.
  const next=await waitNativeOpenOrReturn({activity:activitySurface,read:nativeNodes,
    select:nodes=>uniqueNativeControl(nodes,open),onState:state=>{nativeUiObservation=state;}});
  if(next!=='returned'&&activitySurface()!=='application'){
    tap(next); // one-shot; requireDocumentsUiTap still rejects lost foreground.
    markSafReturn('open-confirmation-tapped');
  }
  await until(()=>activitySurface()==='application','RETURN_FROM_OPEN',45000);
  noteSafReturned();
}

let socket=null,channel=null;
const dialogs=[];
const dialogTracker=createDialogTracker();
const recoveryConsent=createRecoveryConsentGate();
let classPromptName=null;
let classPromptAcknowledged=0;
function disconnect() {
  const active=socket;
  channel?.close();channel=null;socket=null;
  if(active)active.close();
  try{adb('forward','--remove','tcp:9222');}catch{}
}
function send(method,params={},timeout=35000) {
  const active=socket;
  if(!active||!channel)return Promise.reject(new LabFailure('CDP_DISCONNECTED'));
  return channel.request(id=>active.send(JSON.stringify({id,method,params})),timeout);
}
async function openCdpSocket(endpoint){
  const budget=commandBudget(4000),ws=new WebSocket(endpoint);
  try{
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new LabFailure('CDP_SOCKET_TIMEOUT')),budget);
      ws.addEventListener('open',()=>{clearTimeout(timer);resolve();},{once:true});
      ws.addEventListener('error',()=>{clearTimeout(timer);reject(new LabFailure('CDP_SOCKET_ERROR'));},{once:true});
      ws.addEventListener('close',()=>{clearTimeout(timer);reject(new LabFailure('CDP_DISCONNECTED'));},{once:true});
    });
    return ws;
  }catch(error){ws.close();throw error;}
}
async function readSocketSurface(ws){
  const probeChannel=createPendingCommands();
  const close=()=>probeChannel.close();
  const message=e=>{
    let msg;try{msg=JSON.parse(e.data);}catch{close();return;}
    if(msg.error||msg.result?.exceptionDetails)probeChannel.settle(msg.id,new LabFailure('CDP_EVALUATION_REJECTED'));
    else probeChannel.settle(msg.id,null,msg.result?.result?.value);
  };
  ws.addEventListener('close',close);ws.addEventListener('error',close);ws.addEventListener('message',message);
  try{
    // Runtime.evaluate is read-only here: no Page.enable, handlers, input or storage.
    return await probeChannel.request(id=>ws.send(JSON.stringify({id,method:'Runtime.evaluate',
      params:{expression:surfaceExpression(null),returnByValue:true}})),4000);
  }finally{
    probeChannel.close();ws.removeEventListener('close',close);ws.removeEventListener('error',close);ws.removeEventListener('message',message);
  }
}
async function readCdpIdentity(forward){
  const ps=probe();if(ps.length!==1||!nativeForeground())return null;
  if(forward)adb('forward','tcp:9222','localabstract:webview_devtools_remote_'+ps[0]);
  let list;
  try{
    const resp=await fetch('http://127.0.0.1:9222/json/list',{signal:AbortSignal.timeout(commandBudget(3000))});
    if(!resp.ok)return null;
    list=await resp.json();
  }catch(error){
    if(error instanceof LabFailure)throw error;
    if(error?.name==='TimeoutError'||error instanceof TypeError)return null;
    throw error;
  }
  const current=probe();
  return {pid:ps[0],foreground:current.length===1&&current[0]===ps[0]&&nativeForeground(),list};
}
async function connect(expected){
  const selected=await waitUniquePublicTarget({expected,
    sample:()=>readCdpIdentity(true),
    inspect:async target=>{
      const ws=await openCdpSocket(target.endpoint);
      try{return await readSocketSurface(ws);}finally{ws.close();}
    },
    verify:pid=>{const current=probe();return current.length===1&&current[0]===pid&&nativeForeground();},
    acquire:target=>openCdpSocket(target.endpoint),
    inspectAcquired:readSocketSurface,
    confirmIdentity:()=>readCdpIdentity(false),
    release:ws=>ws.close(),
    onState:state=>{
      const prior=cdpTargetObservation;
      cdpTargetObservation=state;
      if(!prior||prior.state!==state.state||prior.candidates!==state.candidates||prior.matches!==state.matches)
        console.log('AP02_CDP_TARGET_STATE',api,state.state,state.candidates,state.matches);
    }
  });
  const s=selected.connection;
  socket=s;
  const active=createPendingCommands();channel=active;
  s.addEventListener('close',()=>active.close(),{once:true});
  s.addEventListener('error',()=>active.close(),{once:true});
  s.addEventListener('message',e=>{
    if(socket!==s)return;
    let msg;
    try{msg=JSON.parse(e.data);}catch{active.close();s.close();return;}
    if(msg.method==='Page.javascriptDialogOpening') {
      const d=msg.params;
      dialogs.push({kind:d.type,message:d.message});
      if(recoveryConsent.capture(d.type,d.message))return;
      // Real WebView JavaScript prompt generated by the visible "Nuova Classe"
      // control. Chrome DevTools accepts it once, with an explicitly armed,
      // synthetic class name. Android DocumentsUI remains OS-driven via ADB;
      // this does not call App internals or simulate a Capacitor plugin.
      if(d.type==='prompt') {
        const expected=classPromptName;
        if(typeof expected!=='string' || !d.message?.startsWith(
          'Inserisci la denominazione della nuova classe')) {
          try{dialogTracker.track(()=>withoutObservationScope(()=>send('Page.handleJavaScriptDialog',{accept:false})));}catch{}
          return;
        }
        classPromptName=null;
        try{dialogTracker.track(()=>withoutObservationScope(()=>send('Page.handleJavaScriptDialog',{accept:true,promptText:expected})),()=>{classPromptAcknowledged++;});}catch{}
        return;
      }
      try{dialogTracker.track(()=>withoutObservationScope(()=>send('Page.handleJavaScriptDialog',{accept:true})));}catch{}
      return;
    }
    if(msg.error||msg.result?.exceptionDetails){
      // Retain only allowlisted control/error codes, never raw page text.
      active.settle(msg.id,cdpEvaluationFailure(msg.result?.exceptionDetails?.exception?.description));
    }else active.settle(msg.id,null,msg.result?.result?.value);
  });
  await send('Page.enable');
}
async function evaluate(expr,timeout=35000){
  // Only public DOM operations, never internal App methods, Vault keys or
  // decrypted backup contents.
  dialogTracker.check();
  return send('Runtime.evaluate',{expression:expr,awaitPromise:true,returnByValue:true},timeout);
}
const dom = body => evaluate('('+body+')');
async function onPage(text,ms=30000){
  if(text==='Configura archivio protetto')return waitDestination('setup',null,ms,false);
  if(text==='Sblocca Registro')return waitDestination('lock',null,ms,false);
  if(text==='Le mie classi')return waitDestination('home',null,ms);
  if(text==='Ripristina backup cifrato')return waitDestination('privacy',null,ms);
  if(text===originalClass||text===newerClass)return waitDestination('class',text,ms);
  throw new LabFailure('INVALID_HARNESS_ARGUMENT');
}
function field(selector,value){
  return dom('(function(){const el=document.querySelector('+JSON.stringify(selector)+');'+
    'if(!('+interactiveSource+')(el)||el.readOnly)throw Error("MISSING_INPUT");'+
    'Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(el,'+JSON.stringify(value)+');'+
    'el.dispatchEvent(new Event("input",{bubbles:true}));el.dispatchEvent(new Event("change",{bubbles:true}));return true;})()');
}
function click(selector) {
  return dom('(function(){const el=document.querySelector('+JSON.stringify(selector)+');'+
    'if(!('+interactiveSource+')(el))throw Error("MISSING_CONTROL");el.click();return true;})()');
}
function button(label) {
  return dom('(function(){const a=Array.from(document.querySelectorAll("button")).filter(e=>'+
    'e.textContent?.trim() === '+JSON.stringify(label)+'&&('+interactiveSource+')(e));'+
    'if(a.length===0)throw Error("BUTTON_MATCH_COUNT_0");'+
    'if(a.length!==1)throw Error("BUTTON_MATCH_COUNT_"+a.length);a[0].click();return true;})()');
}
// Collect only aggregate, non-sensitive DOM facts on an Android Home-confirm
// failure. Never retain dialog text, class names, markup or screenshots.
let homeConfirmDiagnostic = null;
let homeNavigationDiagnostic = null;
// Inspect only fixed public UI predicates; never extract names, screen text,
// passwords, documents, or WebView markup into a diagnostic artifact.
const publicHomeFrame = () => dom('(function(){'+
  'const visible='+interactiveSource+';'+
  'const security=('+publicSurfaceFrame.toString()+')(null,document,getComputedStyle,visible);'+
  'const buttons=Array.from(document.querySelectorAll("button"));'+
  'const brand=document.querySelector("[data-testid=header01-brand-navigation]");'+
  'const confirmed=document.querySelector("[data-testid=header01-home-confirm]");'+
  'return {locked:!!document.querySelector("#vault-password"),'+
  'lockReady:security.lock&&security.lockControls,gateError:security.gateError,'+
  'protectedSurface:security.setup||security.gatePending||security.suspensionDraining||security.closingProtected||security.protectedField,'+
  'confirmationVisible:visible(confirmed),'+
  'todayHeadingVisible:visible(document.querySelector("#today-heading")),'+
  'classHeadingVisible:Array.from(document.querySelectorAll("h2")).some(e=>e.textContent?.trim()==="Le mie classi"&&visible(e)),'+
  'newClassButtonVisible:buttons.some(e=>e.textContent?.trim()==="Nuova Classe"&&!e.disabled&&visible(e)),'+
  'brandInteractive:visible(brand)&&!brand.disabled&&!brand.closest("[inert]"),'+
  'documentVisible:document.visibilityState==="visible"};})()');

function captureHomeConfirmDiagnostic(submit=false){
  return dom('('+publicHomeConfirmation.toString()+')(document,getComputedStyle,'+interactiveSource+','+JSON.stringify(submit)+','+publicSurfaceFrame.toString()+')');
}
// Class prompts and Android lifecycle callbacks can suspend the mounted Vault.
// A visible text node inside the protected, inert App is not an interactive
// screen. Re-authenticate only through the actual public Vault lock UI.
function makePublicAuthentication(scope,onStep=()=>{},options={}){
  return createPublicAuthentication({
    waitForLock:async()=>{await onPage('Sblocca Registro',35000);},
    fill:async()=>{await field('#vault-password',password);},
    submit:async()=>{options.beforeSubmit?.();await button('Sblocca Registro');options.afterSubmit?.();},
    waitForSession:options.waitForSession||(()=>waitDestination('session',null,45000,false)),
    onStep:step=>{
      onStep(step);
      if(step==='unlocked')console.log('AP02_SESSION_REAUTH_VIA_REAL_UI',scope,api);
    }
  });
}
async function ensureInteractiveSession(scope){
  const authenticate=makePublicAuthentication(scope);
  const state=async()=>{
    const f=await samplePublicSurface(null);
    if(f.gateError)throw new LabFailure('PUBLIC_GATE_ERROR');
    return {locked:f.foreground&&f.documentVisible&&f.lock&&f.lockControls,
      ready:f.foreground&&f.documentVisible&&f.brand&&!f.setup&&!f.lock&&!f.gatePending&&!f.protectedField};
  };
  // Android can protect the mounted WebView between a stable readiness
  // sample and the final surface check. Only read observations may repeat;
  // the one-use authentication adapter rejects a second lock in this scope.
  for(let attempt=0;attempt<4;attempt++){
    const observed=await until(async()=>{
      const first=await state();
      if(first.locked)return 'locked';
      if(!first.ready)return null;
      await sleep(500);
      const second=await state();
      return second.locked?'locked':second.ready?'ready':null;
    },'ANDROID_INTERACTIVE_OR_LOCK_'+scope,45000);
    if(observed==='locked'){
      phase='visible-ui-session-reauth-'+scope;
      await authenticate();
      await until(async()=>{
        const next=await state();
        if(next.locked)throw new LabFailure('PUBLIC_RELOCK_AFTER_AUTH');
        return next.ready;
      },'ANDROID_SESSION_REAUTHORIZED_'+scope,45000,false);
    }
    const last=await state();
    if(last.ready&&!last.locked)return;
    console.log('AP02_INTERACTIVE_SURFACE_RETRY',scope,api,attempt+1);
    await sleep(500);
  }
  assert.fail('ANDROID_PROTECTED_SURFACE_'+scope);
}
async function nav(label){
  await ensureInteractiveSession('before-nav-'+label);
  await click('[data-testid="header01-brand-navigation"]');
  await until(async()=>nativeForeground()&&await dom('(function(){const e=document.querySelector("#registro-navigation-drawer");return ('+interactiveSource+')(e);})()'),'NAV_DRAWER',15000);
  await dom('(function(){const e=Array.from(document.querySelectorAll("#registro-navigation-drawer button"))'+
    '.filter(x=>x.textContent?.trim()==='+JSON.stringify(label)+'&&('+interactiveSource+')(x));'+
    'if(e.length!==1)throw Error("NAV_NOT_UNIQUE");e[0].click();return true;})()');
  if(label==='Oggi'){
    const started=Date.now(), transitions=[];
    let lastFrame=null;
    // One public authentication allowance for the entire Oggi navigation.
    // It is shared before, during and after the confirmation boundary.
    const authenticateHome=makePublicAuthentication('home-navigation');
    const sample=async()=>{
      lastFrame=await publicHomeFrame();
      if(!nativeForeground())lastFrame={...lastFrame,documentVisible:false,brandInteractive:false};
      const stage=classifyHomeNavigationFrame(lastFrame);
      if(stage==='gate-error')throw new LabFailure('PUBLIC_GATE_ERROR');
      if(transitions.length===0||transitions[transitions.length-1].stage!==stage)
        transitions.push({stage,elapsedMs:Date.now()-started});
      return stage;
    };
    try {
      // Observe the real security gate at each navigation boundary. This
      // supports an OS-triggered Vault lock but never bypasses reauthentication.
      const first=await until(async()=>{
        const stage=await sample();
        if(stage==='locked'){
          await authenticateHome();
          return false;
        }
        return stage==='confirmation'||stage==='home-ready'?stage:false;
      },'HOME_NAVIGATION_OR_CONFIRM',45000,false);
      if(first==='confirmation'){
        phase='visible-ui-home-confirm';
        homeConfirmDiagnostic=null;
        try {
          // One synchronous browser predicate checks and clicks. A known
          // no-action response may be sampled again; unknown outcomes never retry.
          await confirmHomeOnce({
            foreground:nativeForeground,
            attempt:()=>captureHomeConfirmDiagnostic(true),
            authenticate:authenticateHome,
            onFrame:frame=>{homeConfirmDiagnostic=frame;},
            timeoutMs:20000
          });
        } catch(error){
          if(!homeConfirmDiagnostic){
            const frame=await bestEffortDiagnostic(()=>captureHomeConfirmDiagnostic());
            homeConfirmDiagnostic=frame?{...frame,foreground:null}:{diagnosticUnavailable:true};
          }
          throw error;
        }
        phase='visible-ui-home-confirm-dismiss';
        await until(()=>dom('!document.querySelector("[data-testid=header01-home-confirm]")'),
          'HOME_CONFIRM_DISMISSED',20000);
      }
      phase='visible-ui-navigation-Oggi';
      await until(async()=>{
        const stage=await sample();
        if(stage==='locked'){
          await authenticateHome();
          return false;
        }
        if(stage!=='home-ready')return false;
        // Require two real, stable, interactive Home frames. A background
        // class label or a stale/inert DOM fragment must not count as success.
        await sleep(450);
        return (await sample())==='home-ready';
      },'HOME_INTERACTIVE_READY',60000,false);
      console.log('AP02_HOME_NAVIGATION_CONFIRMED',api);
    } catch(error){
      homeNavigationDiagnostic=safeHomeNavigationReport(transitions,lastFrame);
      console.log('AP02_HOME_NAVIGATION_BLOCKED',api,homeNavigationDiagnostic.lastStage);
      throw error;
    }
  } else if(label==='Privacy'){
    phase='visible-ui-navigation-Privacy';
    // The exact public destination, real gate and both V7 forms must be ready.
    await until(()=>waitDestination('privacy',null,45000),'PRIVACY_V7_EXPORT_BUTTON_READY',45000,false);
    phase='visible-ui-privacy-v7-ready';
  } else {
    phase='visible-ui-navigation-'+label;
    await onPage('Le mie classi');
  }
}
async function createClass(name){
  // Class setup is part of the public WebView UI, not a native SAF action.
  // Accessibility snapshots can return "null root node" when Android 32 is
  // updating or shielding the WebView. Drive the REAL "Nuova Classe" control
  // and its REAL window.prompt via Chrome DevTools instead; never construct
  // internal application records or mutate a Vault through test hooks.
  phase='visible-ui-create-synthetic-class';
  // VISIBLE_CLASS_CREATION_CONTROL: the Q3 Home gate is observed again at the
  // actual action boundary, including at most one real unlock for this scope.
  await prepareClassCreation({sample:()=>samplePublicSurface(null),
    authenticate:makePublicAuthentication('before-class-creation'),
    onState:state=>{classControlObservation=state;observeSurface('home',state);}});
  readyDestinations.add('home');
  if(!nativeForeground())throw new LabFailure('CLASS_CREATION_CONTROL_CHANGED');
  if(classPromptName!==null)throw Error('CLASS_PROMPT_ALREADY_PENDING');
  const before=classPromptAcknowledged;
  classPromptName=name;
  // The CDP Runtime.evaluate call may reject after a synchronous WebChrome
  // prompt; only explicit observation of that exact accepted prompt and the
  // resulting visible class permits continuation.
  let clickError=null;
  try{await button('Nuova Classe');}
  catch(error){clickError=error;}
  await until(()=>{dialogTracker.check();return classPromptAcknowledged===before+1;},
    'SYNTHETIC_CLASS_PROMPT_NOT_ACCEPTED',15000);
  classPromptName=null;
  // On Android 36 the OS may protect the mounted App while the prompt settles.
  // Check the real authentication gate BEFORE waiting for class text, then
  // require the class view to be interactive, not merely present in the DOM.
  await ensureInteractiveSession('after-class-prompt');
  const expectedClassHeading='Gestione Elenco Alunni: '+name;
  await until(async()=>{
    const f=await samplePublicSurface(expectedClassHeading);
    if(f.gateError)throw new LabFailure('PUBLIC_GATE_ERROR');
    const state={locked:f.foreground&&f.documentVisible&&f.lock&&f.lockControls,
      ready:f.foreground&&f.documentVisible&&f.brand&&!f.protectedField&&!f.gatePending,
      classVisible:f.classVisible};
    if(state.locked){
      await ensureInteractiveSession('after-class-prompt');
      return false;
    }
    return state.ready&&state.classVisible;
  },'INTERACTIVE_SYNTHETIC_CLASS_AFTER_PROMPT',90000,false);
  await waitDestination('class-detail',expectedClassHeading,45000);
  if(clickError)console.log('AP02_CLASS_PROMPT_RUNTIME_RECOVERED',api);
  const hasDone=await dom('document.body?.innerText?.includes("Dati Salvati in Locale con Successo!")');
  if(hasDone){
    phase='visible-ui-close-save-notice';
    await button('Chiudi');
  }
  phase='visible-ui-class-return-home';
  await nav('Oggi');
  await onPage(name,30000);
}
function listLabV7Files(){
  const ls=adb('shell','ls','-1','/sdcard/Download');
  return ls.split('\n').map(s=>s.trim()).filter(s=>labV7Date(s)!==null).sort();
}
// F2-DEVICE diagnostic evidence: device-side metadata only, never file bytes,
// filenames, class names or authentication data. Existing workflow preserves
// saf-diagnostic.json on qualification failure.
let lastPhysicalReadKind = 'not-attempted';
function safeDeviceFlag(flag,filename) {
  try {
    execFileSync('adb',['shell','test',flag,quotedLabV7Path(filename)],
      {stdio:'ignore',timeout:commandBudget(7000),killSignal:'SIGKILL'});
    return true;
  } catch(error) {
    return error?.status===1 ? false : null;
  }
}
function safeDeviceByteCount(filename,strict=false) {
  try {
    const value=adb('shell','stat','-c','%s',quotedLabV7Path(filename));
    return /^\d+$/.test(value) ? Number(value) : null;
  } catch(error) {if(strict)throw error;return null;}
}
// F2-DIAG-02: metadata only for two synthetic Android exports. No file bytes,
// names, SAF URIs, password values, app records or raw ADB output are retained.
// Snapshots are persisted only if the two encrypted-file hashes coincide.
function readSyntheticFileMetadata(filename) {
  assert.ok(labV7Date(filename)!==null,'INVALID_LAB_V7_FILENAME');
  const present=safeDeviceFlag('-e',filename);
  const regularFile=safeDeviceFlag('-f',filename);
  const readableByShell=safeDeviceFlag('-r',filename);
  let modifiedEpochSeconds=null,inode=null;
  if(present===true) {
    try {
      const stat=adb('shell','stat','-c','%Y|%i',quotedLabV7Path(filename));
      const parts=/^(\d+)\|(\d+)$/.exec(stat);
      if(parts) {modifiedEpochSeconds=Number(parts[1]);inode=parts[2];}
    } catch { /* Unavailable metadata is not a reason to pass qualification. */ }
  }
  return {present,regularFile,readableByShell,
    sizeBytes:present===true?safeDeviceByteCount(filename):null,
    modifiedEpochSeconds,inode};
}
function captureSyntheticFilePair(datedFilename,originalName) {
  return {observedAt:new Date().toISOString(),
    retainedTarget:readSyntheticFileMetadata(originalName),
    datedExport:readSyntheticFileMetadata(datedFilename)};
}
function changedIfKnown(before,after) {
  return before===null||after===null ? null : before!==after;
}
function captureDuplicateExportDiagnostic(previous,current,before,pickerReturnsBefore) {
  const after=captureSyntheticFilePair(current.name,previous.name);
  const prior=before.datedExport,next=after.datedExport;
  const oldTarget=before.retainedTarget,newTarget=after.retainedTarget;
  const diagnostic={
    schemaVersion:2,stage:'native-v7-duplicate-export',candidate:sha,api,phase,
    syntheticOnly:true,productionRelease:false,
    fileLocation:'android-shared-downloads',
    firstAndSecondEncryptedHashesEqual:previous.digest.sha256===current.digest.sha256,
    sameDatedFilename:previous.name===current.name,
    nativeSaveReturnObserved:nativeSaveCompletionCount===pickerReturnsBefore+1,
    saveReturnsBefore:pickerReturnsBefore,
    saveReturnsAfter:nativeSaveCompletionCount,
    before,after,
    changes:{
      datedFileNewlyPresent:prior.present===false&&next.present===true,
      datedFileSizeChanged:changedIfKnown(prior.sizeBytes,next.sizeBytes),
      datedFileModifiedChanged:changedIfKnown(prior.modifiedEpochSeconds,next.modifiedEpochSeconds),
      datedFileInodeChanged:changedIfKnown(prior.inode,next.inode),
      retainedTargetSizeChanged:changedIfKnown(oldTarget.sizeBytes,newTarget.sizeBytes),
      retainedTargetModifiedChanged:changedIfKnown(oldTarget.modifiedEpochSeconds,newTarget.modifiedEpochSeconds),
      retainedTargetInodeChanged:changedIfKnown(oldTarget.inode,newTarget.inode),
      targetAndDatedAreSameInode:
        newTarget.inode===null||next.inode===null?null:newTarget.inode===next.inode
    }
  };
  writeFileSync(out+'/saf-diagnostic.json',JSON.stringify(diagnostic,null,2));
  console.log('AP02_F2_DUPLICATE_EXPORT_DIAGNOSTIC',JSON.stringify({
    api,phase,sameDatedFilename:diagnostic.sameDatedFilename,
    nativeSaveReturnObserved:diagnostic.nativeSaveReturnObserved,
    changes:diagnostic.changes
  }));
}
async function capturePhysicalReadDiagnostic(filename,attempts) {
  // Accept only the two fixed laboratory filename patterns and never persist
  // the basename, raw ADB output, file contents, SAF URI or DOM text.
  assert.ok(labV7Date(filename)!==null,'INVALID_LAB_V7_FILENAME');
  let transport='unavailable';
  try {transport=adb('get-state')==='device'?'ready':'other';}catch{}
  let foreground=null;
  try {foreground=Boolean(nativeForeground());}catch{}
  const session=await dom('(function(){return {'+
    'locked:Boolean(document.querySelector("#vault-password")),'+
    'visibility:document.visibilityState};})()').catch(()=>null);
  const available=transport==='ready';
  const diagnostic={
    schemaVersion:1,stage:'native-v7-physical-read',
    candidate:sha,api,phase,syntheticOnly:true,productionRelease:false,
    fileRole:isOriginalV7Name(filename)?'original':'numbered-copy',
    fileLocation:'android-shared-downloads',attempts,
    lastReadKind:lastPhysicalReadKind,transport,foreground,
    sessionLocked:session?.locked??null,
    documentVisibility:['visible','hidden','prerender'].includes(session?.visibility)?
      session.visibility:'unavailable',
    filePresent:available?safeDeviceFlag('-e',filename):null,
    regularFile:available?safeDeviceFlag('-f',filename):null,
    readableByShell:available?safeDeviceFlag('-r',filename):null,
    sizeBytes:available?safeDeviceByteCount(filename):null
  };
  writeFileSync(out+'/saf-diagnostic.json',JSON.stringify(diagnostic,null,2));
  console.log('AP02_F2_PHYSICAL_READ_DIAGNOSTIC',
    JSON.stringify({api,phase,fileRole:diagnostic.fileRole,
      lastReadKind:diagnostic.lastReadKind,
      transport:diagnostic.transport,filePresent:diagnostic.filePresent,
      regularFile:diagnostic.regularFile,readableByShell:diagnostic.readableByShell,
      sizeBytesKnown:diagnostic.sizeBytes!==null,
      foreground:diagnostic.foreground,sessionLocked:diagnostic.sessionLocked}));
}
function inspectEncryptedFile(filename){
  assert.ok(labV7Date(filename)!==null,'INVALID_LAB_V7_FILENAME');
  let bytes;
  try{
    const before=safeDeviceByteCount(filename,true);
    if(!Number.isSafeInteger(before)||before<=0)throw Error('LAB_V7_SIZE_UNAVAILABLE');
    bytes=pullLabV7Bytes(filename);
    const after=safeDeviceByteCount(filename,true);
    if(bytes.length!==before||after!==before)throw Error('LAB_V7_SIZE_MISMATCH');
  }
  catch(error){
    if(isTransportOrDeadline(error))throw error;
    lastPhysicalReadKind=error?.code==='ETIMEDOUT'?'adb-pull-timeout':
      error?.message==='LAB_V7_SIZE_UNAVAILABLE'?'device-size-unavailable':
      error?.message==='LAB_V7_SIZE_MISMATCH'?'physical-size-mismatch':'adb-pull-rejected';
    throw Error('NATIVE_V7_PHYSICAL_READ_UNAVAILABLE');
  }
  const text=bytes.toString('utf8');
  // Fail closed even if a transport unexpectedly yields shell error text.
  // Never submit that text to the encrypted-envelope parser.
  if(/^(?:cat:|sh:|\/system\/bin\/sh:)/i.test(text.trimStart())||bytes.length===0){
    lastPhysicalReadKind=bytes.length===0?'empty-read':'shell-error-response';
    throw Error('NATIVE_V7_PHYSICAL_READ_UNAVAILABLE');
  }
  let e;
  try{e=JSON.parse(text);}
  catch{throw Error('NATIVE_V7_ENVELOPE_INVALID_JSON');}
  assert.equal(e.privacy_protocol,'REGISTRO_DOCENTE_AES_GCM_256');
  assert.equal(e.version,2);
  assert.equal(typeof e.ciphertext,'string');
  assert.ok(bytes.length>300&&!text.includes(originalClass)&&!text.includes(newerClass));
  return {bytes:bytes.length,sha256:sha256(bytes)};
}
async function verifiedEncryptedFile(filename){
  let attempts=0;
  lastPhysicalReadKind='not-attempted';
  try{
    return await observeUntil(()=>{attempts++;return inspectEncryptedFile(filename);},{
      timeoutMs:15000,intervalMs:500,retryReadErrors:true,
      retryCodes:['NATIVE_V7_PHYSICAL_READ_UNAVAILABLE']
    });
  }catch(error){
    await bestEffortDiagnostic(()=>capturePhysicalReadDiagnostic(filename,attempts));
    if(classifyFailure(error).code==='OBSERVATION_DEADLINE' &&
       error.observation?.lastCode==='NATIVE_V7_PHYSICAL_READ_UNAVAILABLE')
      throw new LabFailure('NATIVE_V7_PHYSICAL_READ_UNAVAILABLE_AFTER_RETRY');
    throw error;
  }
}
async function exportV7(previous=null){
  // Let ACTION_CREATE_DOCUMENT create genuinely separate files on a filename
  // collision. No shell rename, copy, media broadcast, or forged receipts.
  const filesBefore=listLabV7Files();
  if(previous===null){
    assert.equal(filesBefore.length,0,'UNEXPECTED_EXISTING_V7_DOCUMENT');
  } else {
    assert.deepEqual(filesBefore,[previous.name],'ORIGINAL_V7_FILE_NOT_PRESENT');
    assert.deepEqual(await verifiedEncryptedFile(previous.name),previous.digest,
      'ORIGINAL_V7_FILE_CHANGED_BEFORE_EXPORT');
  }
  phase='native-v7-export-form';
  await ensureInteractiveSession('before-v7-export');
  await onPage('Ripristina backup cifrato');
  await field('input[placeholder="Inserisci password sicura (min. 6 caratteri)"]',copyPassword);
  await field('input[placeholder="Ripeti la password"]',copyPassword);
  const prior=dialogs.length;
  phase='native-v7-export-submit';
  // Start before invoking the real UI, to catch picker arrival and early return.
  // Only Activity categories and elapsed times survive a failed qualification.
  const activityProbe=startSafActivityProbe({
    appPackage:pkg, readActivityDump:()=>adb('shell','dumpsys','activity','activities')
  });
  try {
    beginSafReturn('export');
    await button('Esporta copia completa V7');
    phase='native-v7-export-picker';
    await nativeSave(prior,activityProbe);
  } finally {
    lastSafActivityTrail = await activityProbe.stop();
    adbTransport.mark('activity-probe-stopped');
  }
  await reauthenticateAfterPicker('export');
  await until(()=>dialogs.slice(prior).some(d=>d.kind==='alert'&&
    /Copia completa V7 salvata, riletta e verificata/.test(d.message)),
    'V7_VERIFIED_NATIVE_RECEIPT',45000);
  phase='native-v7-export-physical-discovery';
  const filesAfter=listLabV7Files();
  let name;
  try{
    name=selectNewLabV7Name(filesBefore,filesAfter);
  }catch(error){
    // Record only aggregate observations, never the on-device filenames.
    writeFileSync(out+'/saf-diagnostic.json',JSON.stringify({
      schemaVersion:3,stage:'android-saf-document-discovery',
      candidate:sha,api,syntheticOnly:true,productionRelease:false,
      countBefore:filesBefore.length,countAfter:filesAfter.length,
      originalStillPresent:previous===null?null:filesAfter.includes(previous.name),
      code:/^[A-Z0-9:_-]+$/.test(String(error?.message))?error.message:'INVALID_DOCUMENT_SELECTION'
    },null,2));
    throw error;
  }
  const digest=await verifiedEncryptedFile(name);
  if(previous!==null){
    // Collision has not altered the first copy, and the second encrypted
    // document must be distinct. The later restore tests its actual content.
    assert.deepEqual(await verifiedEncryptedFile(previous.name),previous.digest,
      'ORIGINAL_V7_FILE_MODIFIED_BY_SECOND_EXPORT');
    assert.notEqual(digest.sha256,previous.digest.sha256,
      'V7_SECOND_ENCRYPTED_COPY_NOT_DISTINCT');
  }
  return {name,digest};
}
async function restoreFromRealSaf(target,recovery){
  await waitDestination('privacy',null,45000);
  const prior=dialogs.length;
  await field('input[placeholder="Inserisci la password impostata alla cifratura"]',copyPassword);
  await field('#restore-v7-recovery-password',copyPassword);
  beginSafReturn('target-source');
  recoveryConsent.arm();
  await button('Scegli file e ripristina');
  await nativeChoose(target);
  await reauthenticateAfterPicker('target-source');
  phase='native-v7-recovery-consent';
  await recoveryConsent.accept(()=>withoutObservationScope(()=>send('Page.handleJavaScriptDialog',{accept:true})));
  console.log('AP02_RECOVERY_CONSENT_ACKNOWLEDGED',api);
  beginSafReturn('recovery-source');
  await nativeChoose(recovery);
  await reauthenticateAfterPicker('recovery-source');
  await until(()=>dialogs.slice(prior).some(d=>d.kind==='alert'&&/ripristinato con successo/i.test(d.message)),
    'REAL_V7_RESTORE_RESULT',60000);
}
async function launch(){
  phase='preflight-package';
  if(!/^package:\/[^\r\n]+\.apk(?:\r?\n|$)/.test(adb('shell','pm','path',pkg)))throw new LabFailure('PREFLIGHT_PACKAGE_UNAVAILABLE');
  environment.packageReady=true;
  phase='preflight-launch';
  adb('shell','am','start','-W','-n',activity);
  await until(()=>probe().length===1&&nativeForeground(),'PREFLIGHT_FOREGROUND',45000);
  phase='preflight-cdp';
  await connect(environment.launches===0?'setup':'lock');
  await until(()=>probe().length===1&&nativeForeground(),'PREFLIGHT_FOREGROUND',45000);
  const chromium=await dom('navigator.userAgent.match(/Chrome\\/([0-9.]+)/)?.[1]??null');
  const detected=versionFacts({chromium}).chromium;
  if(environment.versions.chromium&&environment.versions.chromium!==detected)throw new LabFailure('PREFLIGHT_VERSION_INCOMPLETE');
  environment.versions.chromium=detected;
  environment.foreground=true;environment.cdpReady=true;
  environment.launches++;
  environment.complete=completeFingerprint(environment.versions);
  saveEnvironment();
  if(!environment.complete)throw new LabFailure('PREFLIGHT_VERSION_INCOMPLETE');
}
async function run(){
  await preflightBoot();
  phase='preflight-install';
  assert.equal(adb('install','--no-incremental',process.env.AP02_LAB_APK).split('\n').filter(x=>x==='Success').length,1);
  if(dualNative)await startNativeSession();
  await launch();
  await onPage('Configura archivio protetto',60000);
  await record('installed-professional-android-webview');
  phase='startup-professional-profile';
  // In contrast to the earlier demo-mode browser test, this is a wholly
  // synthetic PROFESSIONAL archive created through the actual product gate.
  await click('input[name="archive-mode"][value="professional"]');
  const profile=['Istituto totalmente fittizio','2026/2027','Docente sintetico','Tecnologia'];
  for(let i=0;i<profile.length;i++){
    const index=i,value=profile[i];
    await dom('(function(){const a=Array.from(document.querySelectorAll("fieldset input[required]"));'+
      'if(a.length!==4||!('+interactiveSource+')(a['+index+']))throw Error("SYNTHETIC_PROFILE_INPUT_MISSING");'+
      'Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(a['+index+'],'+
      JSON.stringify(value)+');a['+index+'].dispatchEvent(new Event("input",{bubbles:true}));'+
      'a['+index+'].dispatchEvent(new Event("change",{bubbles:true}));return true;})()');
  }
  await field('#vault-password',password);
  phase='startup-professional-submit';
  await button('Crea il mio registro');
  phase='startup-professional-home';
  try { await onPage('Le mie classi',60000); }
  catch(error) {
    // Read only Boolean screen indicators and categorical Android activity.
    // Never store input values, class names or the underlying activity dump.
    const surface=await dom('(function(){return {'+
      'locked:Boolean(document.querySelector("#vault-password")),'+
      'visibility:document.visibilityState,'+
      'homeHeadingVisible:Array.from(document.querySelectorAll("h2")).some(e=>'+
      'e.textContent?.trim()==="Le mie classi"&&e.getClientRects().length>0)}})()').catch(()=>null);
    let nativeActivity='unknown';
    try { nativeActivity=classifyResumedActivity(adb('shell','dumpsys','activity','activities'),pkg); } catch {}
    const diagnostic={schemaVersion:4,
      stage:'professional-setup-home',api,phase,
      originalError:classifyFailure(error).code,
      nativeActivity,locked:surface?.locked??null,
      visibility:['visible','hidden'].includes(surface?.visibility)?surface.visibility:'unknown',
      homeHeadingVisible:surface?.homeHeadingVisible??null,
      publicSurfaceStates:safeSurfaceTrace(surfaceTransitions),
      lastDestinationFrame,surfaceReadFailures:{...surfaceReadFailures}};
    writeFileSync(out+'/saf-diagnostic.json',JSON.stringify(diagnostic,null,2));
    console.log('AP02_STARTUP_HOME_DIAGNOSTIC',JSON.stringify(diagnostic));
    throw error;
  }
  await record('professional-vault-created-with-synthetic-profile');
  if(startupOnly){
    // A distinct diagnostic run, not a counted F2 trial. Preserve the same
    // installed synthetic archive and require an independently observed stop.
    phase='startup-cold-stop';
    disconnect();
    const restart=await verifiedProcessStop({probe,forceStop:()=>adb('shell','am','force-stop',pkg)});
    await launch();
    phase='startup-cold-authentication';
    await onPage('Sblocca Registro',60000);
    await makePublicAuthentication('startup-cold-reopen')();
    await waitDestination('home',null,60000,false);
    await dialogTracker.flush();
    writeFileSync(out+'/startup.json',JSON.stringify({schemaVersion:1,candidate:sha,api,
      trial:Number(process.env.Q4_TRIAL),mode:'startup-only',syntheticOnly:true,productionRelease:false,
      fullF2Qualified:false,setupHome:true,coldAuthenticatedHome:true,forcedStop:true,
      absenceSamples:restart.absenceSamples,beforePidsCount:restart.beforePids?.length,
      afterPidsCount:restart.afterPids?.length},null,2));
    return;
  }
  await createClass(originalClass);
  await nav('Privacy');
  const target=await exportV7();
  // The first document remains at its original provider-owned location.
  // Android will give the second same-day copy a numbered filename.
  assert.deepEqual(await verifiedEncryptedFile(target.name),target.digest);
  await record('native-v7-target-export-saf-verified',{target:target.digest,physical:true,nativeReauthCount});
  await nav('Oggi');
  await createClass(newerClass);
  await nav('Privacy');
  // Observe physical file identities before export #2 through the actual UI.
  const priorExportMetadata=captureSyntheticFilePair(target.name,target.name);
  const pickerReturnsBeforeRecovery=nativeSaveCompletionCount;
  const recovery=await exportV7(target);
  if(recovery.digest.sha256===target.digest.sha256) {
    try {captureDuplicateExportDiagnostic(target,recovery,priorExportMetadata,pickerReturnsBeforeRecovery);}
    catch {console.log('AP02_F2_DUPLICATE_EXPORT_DIAGNOSTIC_UNAVAILABLE',api);}
  }
  assert.notEqual(recovery.digest.sha256,target.digest.sha256);
  await record('native-v7-current-recovery-export-saf-verified',{recovery:recovery.digest,physical:true,nativeReauthCount});
  await restoreFromRealSaf(target.name,recovery.name);
  await onPage('Le mie classi',60000);
  assert.equal(await dom('document.body?.innerText?.includes('+JSON.stringify(originalClass)+')'),true);
  assert.equal(await dom('document.body?.innerText?.includes('+JSON.stringify(newerClass)+')'),false);
  await record('actual-professional-v7-native-saf-import-and-restored-ui',{twoFileSelection:true,
    encryptedFilesDistinct:true,nativeReauthCount});
  disconnect();
  const restart=await verifiedProcessStop({probe,forceStop:()=>adb('shell','am','force-stop',pkg)});
  await launch();
  await onPage('Sblocca Registro',60000);
  await makePublicAuthentication('cold-reopen')();
  await waitDestination('home',null,60000,false);
  assert.equal(await dom('document.body?.innerText?.includes('+JSON.stringify(originalClass)+')'),true);
  assert.equal(await dom('document.body?.innerText?.includes('+JSON.stringify(newerClass)+')'),false);
  await record('actual-android-process-cold-reopen-preserves-v7-restore',{
    forcedStop:true,absenceSamples:restart.absenceSamples,
    beforePidsCount:restart.beforePids?.length,afterPidsCount:restart.afterPids?.length});
}
try{
  await run();
  await dialogTracker.flush();
  writeFileSync(out+'/surface-readiness.json',JSON.stringify({candidate:sha,api,rawDomStored:false,readyDestinations:[...readyDestinations].sort(),transitions:safeSurfaceTrace(surfaceTransitions)},null,2));
  if(dualDiagnostic){
    assert.ok(nativeSnapshots>0&&environment.complete&&environment.launches===2);
    assert.deepEqual(safReturns.map(x=>x.role),['export','export','target-source','recovery-source']);
    assert.ok(safReturns.every(x=>x.documentsUiObserved&&x.returned&&x.authenticated));
    assert.equal(nativeReauthCount,4);
    assert.equal(results.length,6);
    assert.equal(await nativeRequest('GET','/session/'+nativeSession+'/context'),'NATIVE_APP');
    await closeNativeSession();
    writeFileSync(out+'/summary.json',JSON.stringify({candidate:sha,api,trial:Number(process.env.Q5_DUAL_TRIAL),syntheticOnly:true,productionRelease:false,fullF2Qualified:false,status:'PASS',nativeSnapshots,nativeReauthCount,stages:results.map(x=>x.stage),safReturns:safReturns.map(x=>x.role),nativeContextOnly:true,cdpDirect:true},null,2));
    console.log('Q5_DUAL_DIAGNOSTIC_PASS',sha,api);
  }else{
    if(dualQualification){
      assert.ok(environment.complete&&environment.launches===2);
      if(startupOnly){
        assert.equal(nativeSnapshots,0);assert.equal(nativeReauthCount,0);
        assert.equal(results.length,2);assert.equal(safReturns.length,0);
      }else{
        assert.ok(nativeSnapshots>0);
        assert.deepEqual(safReturns.map(x=>x.role),['export','export','target-source','recovery-source']);
        assert.ok(safReturns.every(x=>x.documentsUiObserved&&x.returned&&x.authenticated));
        assert.equal(nativeReauthCount,4);assert.equal(results.length,6);
      }
      assert.equal(await nativeRequest('GET','/session/'+nativeSession+'/context'),'NATIVE_APP');
      await closeNativeSession();
      writeFileSync(out+'/dual-channel.json',JSON.stringify({candidate:sha,api,syntheticOnly:true,productionRelease:false,
        mode:'canonical-candidate',startupOnly,nativeContextOnly:true,cdpDirect:true,nativeSnapshots,nativeReauthCount,
        safReturns:safReturns.map(x=>x.role),stages:results.map(x=>x.stage),sessionClosed:true},null,2));
    }
    console.log(startupOnly?'AP02_STARTUP_ONLY_SUCCESS':'AP02_F2_DEVICE_SUCCESS',sha,api);
  }
}catch(error){
  // Classify failures but never echo data, passwords, ciphertext or WebView DOM.
  const {category,code}=classifyFailure(error);
  try{saveEnvironment();}catch{}
  writeFileSync(out+'/failure.json',JSON.stringify({candidate:sha,api,phase,code,category,
    observation:error instanceof LabFailure?error.observation:undefined,
    dialogCommands:dialogTracker.snapshot(),
    recoveryConsent:recoveryConsent.snapshot(),
    surfaceTransitions:safeSurfaceTrace(surfaceTransitions),readyDestinations:[...readyDestinations].sort(),
    qualified:false,productionRelease:false,syntheticOnly:true,
    appiumBootstrap:environment.appiumBootstrap,
    cdpTargetObservation,nativeUiObservation,classControlObservation,
    adbTransport:adbTransport.snapshot(),lastDestinationFrame,surfaceReadFailures,
    safActivityTrail:lastSafActivityTrail,
    safReturnLifecycle:safReturns,
    homeConfirmDiagnostic:homeConfirmDiagnostic||undefined,
    homeNavigationDiagnostic:homeNavigationDiagnostic||undefined},null,2));
  console.error('AP02_F2_DEVICE_BLOCKED',phase,code,category);
  console.log('AP02_STARTUP_STATE',JSON.stringify({startupOnly,cdpTargetObservation,publicSurfaceStates:safeSurfaceTrace(surfaceTransitions),lastDestinationFrame,surfaceReadFailures}));
  console.log('AP02_ADB_TRANSPORT_SUMMARY',JSON.stringify(adbTransport.snapshot()));
  console.log('AP02_SAF_LIFECYCLE_SUMMARY',JSON.stringify(safReturns));
  console.log('AP02_RECOVERY_CONSENT_STATE',JSON.stringify(recoveryConsent.snapshot()));
  process.exitCode=1;
}finally{
  disconnect();
  if(dualNative&&nativeSession){
    try{await closeNativeSession();}catch{process.exitCode=1;console.error('Q5_DUAL_NATIVE_CLEANUP_FAILED');}
  }
}
