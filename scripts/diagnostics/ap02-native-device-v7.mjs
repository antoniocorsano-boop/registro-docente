// AP-02/F2-DEVICE: isolated real Android WebView + production Privacy UI + native SAF.
// Only a debug laboratory APK and wholly synthetic profile/classes are allowed.
// Chrome DevTools drives public DOM controls; no application internals, plugin
// mocks, production credentials, plaintext backup uploads or external services.
import assert from 'node:assert/strict';
import { LabFailure, classifyFailure, commandBudget, observeUntil, createPendingCommands, withoutObservationScope } from './native-lab-runtime.mjs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { parseNativeNodes, resumedActivity, hasArea } from './native-ui-driver.mjs';
import { probePackagePids, verifiedProcessStop } from './native-process-probe.mjs';
import { classifyResumedActivity, startSafActivityProbe } from './native-saf-lifecycle-probe.mjs';
import { createAdbTransportTrace } from './native-adb-transport-probe.mjs';
import { classifyHomeNavigationFrame, safeHomeNavigationReport } from './native-home-navigation-probe.mjs';
import {labV7Date,isOriginalV7Name,selectNewLabV7Name,quotedLabV7Path,pullLabV7Bytes} from './native-v7-document-discovery.mjs';

const pkg = 'it.trama.registrodocente.lab.ap02v7';
const activity = pkg + '/it.trama.registrodocente.prova.MainActivity';
const api = Number(process.env.AP02_API);
const sha = process.env.CANDIDATE_SHA;
assert.ok([32,36].includes(api));
assert.match(sha || '', /^[0-9a-f]{40}$/);
const password = 'ap02-local-synthetic-2026';
const copyPassword = 'ap02-copy-synthetic-2026';
const originalClass = 'Classe fittizia F2 A';
const newerClass = 'Classe fittizia F2 B';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const adbTransport = createAdbTransportTrace();
const adb = (...args) => {
  const began = Date.now();
  try {
    const result = execFileSync('adb', args, { encoding: 'utf8', timeout: commandBudget(30000), killSignal: 'SIGKILL' }).trim();
    adbTransport.record(args, began, 'ok');
    return result;
  } catch (error) {
    // Only an allowlisted command category, duration and transport result are
    // retained; never persist ADB arguments, stderr or response text.
    adbTransport.record(args, began,
      error?.code === 'ETIMEDOUT' ? 'timeout' : 'failed');
    throw error;
  }
};
const probe = () => probePackagePids(adb, pkg);
const nativeForeground = () => resumedActivity(adb('shell','dumpsys','activity','activities'), pkg);
const results = [];
const out = 'ap02-device-evidence';
mkdirSync(out,{recursive:true});
let phase = 'preflight';
let lastSafActivityTrail = null;
function record(name, additional = {}) {
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
        'V7_VERIFIED_NATIVE_RECEIPT','REAL_RECOVERY_CONSENT','REAL_V7_RESTORE_RESULT'];
      error.observation.purpose=prefix?prefix.slice(0,-1):fixed.includes(name)?name:'OTHER_OBSERVATION';
    }
    throw error;
  }
}
function nativeNodes() {
  adb('shell','rm','-f','/sdcard/ap02-f2-ui.xml');
  // Some emulator frames legitimately have no accessibility root. Do not
  // interpret a failed Android shell 'cat' as XML or another data format.
  const dump=adb('shell','uiautomator','dump','/sdcard/ap02-f2-ui.xml');
  if(/null root node/i.test(dump))throw Error('NATIVE_UI_TREE_UNAVAILABLE');
  let xml;
  try{xml=adb('shell','cat','/sdcard/ap02-f2-ui.xml');}
  catch{throw Error('NATIVE_UI_TREE_UNAVAILABLE');}
  if(!/<hierarchy\b/.test(xml))throw Error('NATIVE_UI_TREE_UNAVAILABLE');
  return parseNativeNodes(xml);
}
const doc = n => /documentsui/i.test(n.pkg);
const findNative = (fn,name,timeout=45000) =>
  until(()=>nativeNodes().find(n=>hasArea(n)&&fn(n)),name,timeout);
function tap(n) {
  assert.ok(hasArea(n));
  const [x1,y1,x2,y2]=n.bounds;
  adb('shell','input','tap',String(Math.floor((x1+x2)/2)),String(Math.floor((y1+y2)/2)));
}
async function downloads() {
  await findNative(n=>doc(n)&&(/show roots|open navigation drawer|mostra radici/i.test(n.desc)||
    /^(Downloads|Download|save|salva)$/i.test(n.text)),'ANDROID_DOCUMENTS_UI',
    api===32?90000:45000);
  if(!nativeNodes().some(n=>doc(n)&&/^(Downloads|Download)$/i.test(n.text))) {
    tap(await findNative(n=>doc(n)&&/show roots|open navigation drawer|mostra radici/i.test(n.desc),'DOC_ROOTS'));
    tap(await findNative(n=>doc(n)&&/^(Downloads|Download)$/i.test(n.text),'DOC_DOWNLOADS'));
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
    const safe=await dom('(function(){const buttons=Array.from(document.querySelectorAll("button"));'+
      'return {locked:!!document.querySelector("#vault-password"),'+
      'cipherBusy:document.body?.innerText?.includes("Cifratura in corso...")===true,'+
      'exportButtonVisible:buttons.some(e=>e.innerText?.trim()==="Esporta copia completa V7"'+
      '&&e.getClientRects().length>0&&getComputedStyle(e).visibility==="visible"),'+
      'documentVisibility:document.visibilityState};})()').catch(()=>null);
    const failureAlert=dialogs.slice(alertIndex).some(d=>d.kind==='alert'&&
      /Copia V7 non completata o non verificata/i.test(d.message));
    const cancelledAlert=dialogs.slice(alertIndex).some(d=>d.kind==='alert'&&
      /Inserisci e conferma una password/i.test(d.message));
    const diagnostic={stage:'native-v7-saf-selection',
      api,foreground:nativeForeground(),rejected:failureAlert,
      validationRejected:cancelledAlert,locked:safe?.locked??null,
      cipherBusy:safe?.cipherBusy??null,
      exportButtonVisible:safe?.exportButtonVisible??null,
      documentVisibility:safe?.documentVisibility??'unavailable',
      originalError:classifyFailure(error).code,
      activityTrail:activityProbe?.snapshot()??null};
    writeFileSync(out+'/saf-diagnostic.json',JSON.stringify(diagnostic,null,2));
    if(failureAlert)throw Error('NATIVE_V7_EXPORT_REJECTED_BEFORE_SAF');
    if(cancelledAlert)throw Error('NATIVE_V7_EXPORT_FORM_REJECTED');
    if(safe?.locked)throw Error('NATIVE_V7_VAULT_LOCKED_BEFORE_SAF');
    if(safe?.cipherBusy)throw Error('NATIVE_V7_EXPORT_STILL_IN_PROGRESS');
    throw Error(diagnostic.foreground?'NATIVE_V7_SAF_MISSING_FOREGROUND':
      'NATIVE_V7_SAF_NOT_OBSERVED_OFF_FOREGROUND');
  }
  tap(await findNative(n=>doc(n)&&/^(save|salva)$/i.test(n.text),'DOC_SAVE_BUTTON'));
  await until(nativeForeground,'RETURN_FROM_SAVE',45000);
  // Picker return observed; this does not prove a new document was created.
  nativeSaveCompletionCount++;
  adbTransport.mark('picker-returned');
}
// Android opens an external DocumentsUI activity. The product deliberately
// suspends and shields the Vault onPause. Resume by explicitly authenticating
// through its actual LOCKED screen; never bypass Root, grant an epoch or call
// native plugin methods out of band.
let nativeReauthCount=0;
async function reauthenticateAfterPicker(kind) {
  phase='native-saf-return-reauth-'+kind;
  adbTransport.mark('lock-wait-start');
  await until(()=>dom('Boolean(document.querySelector("#vault-password"))'),
    'ANDROID_SESSION_REAUTH_REQUIRED_'+kind,35000);
  adbTransport.mark('lock-present');
  await onPage('Sblocca Registro',35000);
  adbTransport.mark('lock-ui-ready');
  await field('#vault-password',password);
  adbTransport.mark('password-field-entered');
  await button('Sblocca Registro');
  adbTransport.mark('unlock-requested');
  await until(()=>dom('!document.querySelector("#vault-password") && '+
    'document.body?.innerText?.includes("Privacy First")'),
    'ANDROID_SESSION_REAUTHORIZED_'+kind,45000);
  adbTransport.mark('unlocked');
  nativeReauthCount++;
}
async function nativeChoose(filename) {
  await downloads();
  tap(await findNative(n=>doc(n)&&n.text===filename&&!/preview|anteprima/i.test(n.desc),'EXACT_DOCUMENT_'+filename));
  await until(()=>nativeForeground()||nativeNodes().some(n=>doc(n)&&/^(open|apri)$/i.test(n.text)),
    'SELECT_DOCUMENT',25000);
  if(!nativeForeground()) tap(await findNative(n=>doc(n)&&/^(open|apri)$/i.test(n.text),'DOC_OPEN_BUTTON'));
  await until(nativeForeground,'RETURN_FROM_OPEN',45000);
}

let socket=null,channel=null;
const dialogs=[];
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
async function connect() {
  const s=await until(async()=>{
    const ps=probe();if(ps.length!==1)return null;
    adb('forward','tcp:9222','localabstract:webview_devtools_remote_'+ps[0]);
    let list;
    try {
      const resp=await fetch('http://127.0.0.1:9222/json/list',{signal:AbortSignal.timeout(commandBudget(3000))});
      if(!resp.ok)return null;
      list=await resp.json();
    }catch(error){
      if(error instanceof LabFailure)throw error;
      if(error?.name==='TimeoutError'||error instanceof TypeError)return null;
      throw error;
    }
    if(!Array.isArray(list))throw new LabFailure('INVALID_HARNESS_ARGUMENT');
    const target=list.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/^https?:\/\/localhost(?:[:/]|$)/.test(x.url));
    if(!target)return null;
    const handshakeBudget=commandBudget(4000);
    const ws=new WebSocket(target.webSocketDebuggerUrl.replace(/ws:\/\/[^/]+/,'ws://127.0.0.1:9222'));
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{ws.close();reject(new LabFailure('CDP_SOCKET_TIMEOUT'));},handshakeBudget);
      ws.addEventListener('open',()=>{clearTimeout(timer);resolve();},{once:true});
      ws.addEventListener('error',()=>{clearTimeout(timer);ws.close();reject(new LabFailure('CDP_SOCKET_ERROR'));},{once:true});
      ws.addEventListener('close',()=>{clearTimeout(timer);reject(new LabFailure('CDP_DISCONNECTED'));},{once:true});
    });
    return ws;
  },'WEBVIEW_DEBUG_TARGET',60000);
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
      // Real WebView JavaScript prompt generated by the visible "Nuova Classe"
      // control. Chrome DevTools accepts it once, with an explicitly armed,
      // synthetic class name. Android DocumentsUI remains OS-driven via ADB;
      // this does not call App internals or simulate a Capacitor plugin.
      if(d.type==='prompt') {
        const expected=classPromptName;
        if(typeof expected!=='string' || !d.message?.startsWith(
          'Inserisci la denominazione della nuova classe')) {
          void withoutObservationScope(()=>send('Page.handleJavaScriptDialog',{accept:false})).catch(()=>{});
          return;
        }
        classPromptName=null;
        classPromptAcknowledged++;
        void withoutObservationScope(()=>send('Page.handleJavaScriptDialog',{accept:true,promptText:expected})).catch(()=>{});
        return;
      }
      void withoutObservationScope(()=>send('Page.handleJavaScriptDialog',{accept:true})).catch(()=>{});
      return;
    }
    if(msg.error||msg.result?.exceptionDetails){
      // Do not store exception text from the page.
      active.settle(msg.id,new LabFailure('CDP_EVALUATION_REJECTED'));
    }else active.settle(msg.id,null,msg.result?.result?.value);
  });
  await send('Page.enable');
}
async function evaluate(expr,timeout=35000){
  // Only public DOM operations, never internal App methods, Vault keys or
  // decrypted backup contents.
  return send('Runtime.evaluate',{expression:expr,awaitPromise:true,returnByValue:true},timeout);
}
const dom = body => evaluate('('+body+')');
async function onPage(text,ms=30000){
  return until(()=>dom('document.body?.innerText?.includes('+JSON.stringify(text)+')'), 'UI_TEXT_'+text,ms);
}
function field(selector,value){
  return dom('(function(){const el=document.querySelector('+JSON.stringify(selector)+');'+
    'if(!el||el.disabled)throw Error("MISSING_INPUT");'+
    'Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(el,'+JSON.stringify(value)+');'+
    'el.dispatchEvent(new Event("input",{bubbles:true}));el.dispatchEvent(new Event("change",{bubbles:true}));return true;})()');
}
function click(selector) {
  return dom('(function(){const el=document.querySelector('+JSON.stringify(selector)+');'+
    'if(!el||el.disabled)throw Error("MISSING_CONTROL");el.click();return true;})()');
}
function button(label) {
  return dom('(function(){const a=Array.from(document.querySelectorAll("button")).filter(e=>'+
    'e.innerText?.trim() === '+JSON.stringify(label)+'&&!e.disabled&&e.getClientRects().length>0'+
    '&&!e.closest("[inert]")&&getComputedStyle(e).visibility==="visible");'+
    'if(a.length!==1)throw Error("BUTTON_MATCH_COUNT_"+a.length);a[0].click();return true;})()');
}
// Collect only aggregate, non-sensitive DOM facts on an Android Home-confirm
// failure. Never retain dialog text, class names, markup or screenshots.
let homeConfirmDiagnostic = null;
let homeNavigationDiagnostic = null;
// Inspect only fixed public UI predicates; never extract names, screen text,
// passwords, documents, or WebView markup into a diagnostic artifact.
const publicHomeFrame = () => dom('(function(){'+
  'const visible=e=>Boolean(e&&e.getClientRects().length>0&&!e.closest("[inert], [aria-hidden=true]")&&getComputedStyle(e).visibility==="visible");'+
  'const buttons=Array.from(document.querySelectorAll("button"));'+
  'const brand=document.querySelector("[data-testid=header01-brand-navigation]");'+
  'const confirmed=document.querySelector("[data-testid=header01-home-confirm]");'+
  'return {locked:!!document.querySelector("#vault-password"),'+
  'confirmationVisible:visible(confirmed),'+
  'todayHeadingVisible:visible(document.querySelector("#today-heading")),'+
  'classHeadingVisible:Array.from(document.querySelectorAll("h2")).some(e=>e.textContent?.trim()==="Le mie classi"&&visible(e)),'+
  'newClassButtonVisible:buttons.some(e=>e.textContent?.trim()==="Nuova Classe"&&!e.disabled&&visible(e)),'+
  'brandInteractive:visible(brand)&&!brand.disabled,'+
  'documentVisible:document.visibilityState==="visible"};})()');

async function captureHomeConfirmDiagnostic(){
  try {
    return await dom('(function(){const root=document.querySelector("[data-testid=header01-home-confirm]");'+
      'const buttons=Array.from(root?.querySelectorAll("button")||[]);'+
      'const named=buttons.filter(e=>e.textContent?.trim()==="Torna a Oggi");'+
      'const visible=named.filter(e=>e.getClientRects().length>0&&'+
      'getComputedStyle(e).visibility==="visible"&&!e.closest("[inert]"));'+
      'return {dialogPresent:!!root,accessibleAlertdialog:!!root?.querySelector("[role=alertdialog][aria-modal=true]"),'+
      'buttonCount:buttons.length,exactLabelCount:named.length,'+
      'visibleCount:visible.length,enabledCount:visible.filter(e=>!e.disabled).length,'+
      'inertCount:named.filter(e=>Boolean(e.closest("[inert]"))).length,'+
      'planningExitDialogOpen:!!document.querySelector("#planning-exit-title"),'+
      'inertOwnerIsDrawer:named.some(e=>e.closest("[inert]")?.id==="registro-navigation-drawer"),'+
      'inertOwnerIsRoot:named.some(e=>e.closest("[inert]")===document.querySelector("#root")),'+
      'inertOwnerContainsNavbar:named.some(e=>Boolean(e.closest("[inert]")?.contains(document.querySelector("[data-testid=header01-brand-navigation]")))),'+
      'buttonHasLayoutRect:named.some(e=>e.getClientRects().length>0),'+
      'buttonStyleVisible:named.some(e=>getComputedStyle(e).visibility==="visible"),'+
      'inertOwnerTag:named[0]?.closest("[inert]")?.tagName||null};})()');
  } catch { return {diagnosticUnavailable:true}; }
}
// Class prompts and Android lifecycle callbacks can suspend the mounted Vault.
// A visible text node inside the protected, inert App is not an interactive
// screen. Re-authenticate only through the actual public Vault lock UI.
async function ensureInteractiveSession(scope){
  const state=()=>dom('(function(){const brand=document.querySelector("[data-testid=header01-brand-navigation]");'+
    'const locked=Boolean(document.querySelector("#vault-password"));'+
    'const ready=Boolean(brand&&!brand.closest("[inert]")&&'+
    'brand.getClientRects().length>0&&getComputedStyle(brand).visibility==="visible"&&'+
    'document.visibilityState==="visible");return {locked,ready};})()');
  // Android can protect the mounted WebView between a stable readiness
  // sample and the final surface check. Retry the *real* authentication and
  // visibility checks rather than clicking through inert content.
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
      await onPage('Sblocca Registro',35000);
      await field('#vault-password',password);
      await button('Sblocca Registro');
      await until(async()=>{
        const next=await state();
        return next.ready&&!next.locked;
      },'ANDROID_SESSION_REAUTHORIZED_'+scope,45000);
      console.log('AP02_SESSION_REAUTH_VIA_REAL_UI',scope,api);
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
  await until(()=>dom('Boolean(document.querySelector("#registro-navigation-drawer"))'),'NAV_DRAWER',15000);
  await dom('(function(){const e=Array.from(document.querySelectorAll("#registro-navigation-drawer button"))'+
    '.filter(x=>x.textContent?.trim()==='+JSON.stringify(label)+'&&!x.disabled);'+
    'if(e.length!==1)throw Error("NAV_NOT_UNIQUE");e[0].click();return true;})()');
  if(label==='Oggi'){
    const started=Date.now(), transitions=[];
    let lastFrame=null;
    const sample=async()=>{
      lastFrame=await publicHomeFrame();
      const stage=classifyHomeNavigationFrame(lastFrame);
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
          await ensureInteractiveSession('during-home-navigation');
          return false;
        }
        return stage==='confirmation'||stage==='home-ready'?stage:false;
      },'HOME_NAVIGATION_OR_CONFIRM',45000,false);
      if(first==='confirmation'){
        phase='visible-ui-home-confirm';
        try {
          await until(()=>dom('(function(){const root=document.querySelector("[data-testid=header01-home-confirm]");'+
            'if(!root||!root.querySelector("[role=alertdialog][aria-modal=true]"))return false;const a=Array.from(root.querySelectorAll("button")).filter(e=>'+
            'e.textContent?.trim()==="Torna a Oggi"&&!e.disabled&&e.getClientRects().length>0'+
            '&&getComputedStyle(e).visibility==="visible"&&!e.closest("[inert]"));return a.length===1;})()'),
            'VISIBLE_EXACT_HOME_CONFIRM',20000);
        } catch(error){
          homeConfirmDiagnostic=await captureHomeConfirmDiagnostic();
          throw error;
        }
        await dom('(function(){const root=document.querySelector("[data-testid=header01-home-confirm]");'+
          'if(!root||!root.querySelector("[role=alertdialog][aria-modal=true]"))throw Error("HOME_CONFIRM_DIALOG_MISSING");'+
          'const a=Array.from(root.querySelectorAll("button")).filter(e=>'+
          'e.textContent?.trim()==="Torna a Oggi"&&!e.disabled&&e.getClientRects().length>0'+
          '&&getComputedStyle(e).visibility==="visible"&&!e.closest("[inert]"));'+
          'if(a.length!==1)throw Error("HOME_CONFIRM_NOT_UNIQUE");a[0].click();return true;})()');
        await until(()=>dom('!document.querySelector("[data-testid=header01-home-confirm]")'),
          'HOME_CONFIRM_DISMISSED',20000);
      }
      phase='visible-ui-navigation-Oggi';
      await until(async()=>{
        const stage=await sample();
        if(stage==='locked'){
          await ensureInteractiveSession('after-home-navigation');
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
  } else {
    phase='visible-ui-navigation-'+label;
    await onPage(label==='Privacy'?'Ripristina backup cifrato':'Le mie classi');
  }
  if(label==='Privacy'){
    phase='visible-ui-privacy-v7-ready';
    // On slower Android WebViews the Privacy heading may appear before the
    // action mounts or becomes interactive. Never click a hidden/stale
    // button, and never rely on text presence alone as a readiness signal.
    await until(()=>dom('(function(){const a=Array.from(document.querySelectorAll("button")).filter(e=>'+
      'e.innerText?.trim()==="Esporta copia completa V7" && !e.disabled && e.getClientRects().length>0'+
      '&&!e.closest("[inert]")&&getComputedStyle(e).visibility==="visible");'+
      'return a.length===1;})()'), 'PRIVACY_V7_EXPORT_BUTTON_READY',30000);
  }
}
async function createClass(name){
  // Class setup is part of the public WebView UI, not a native SAF action.
  // Accessibility snapshots can return "null root node" when Android 32 is
  // updating or shielding the WebView. Drive the REAL "Nuova Classe" control
  // and its REAL window.prompt via Chrome DevTools instead; never construct
  // internal application records or mutate a Vault through test hooks.
  phase='visible-ui-create-synthetic-class';
  assert.ok(nativeForeground(),'APPLICATION_NOT_FOREGROUND_FOR_CLASS');
  await until(()=>dom('document.visibilityState==="visible" && '+
    '!document.querySelector("#vault-password") && '+
    '!Array.from(document.querySelectorAll("div[inert][style]")).some(e=>e.style.visibility==="hidden") && '+
    'Array.from(document.querySelectorAll("button")).filter(e=>'+
    'e.innerText?.trim()==="Nuova Classe" && !e.disabled && e.getClientRects().length>0).length===1'),
    'VISIBLE_CLASS_CREATION_CONTROL',30000);
  if(classPromptName!==null)throw Error('CLASS_PROMPT_ALREADY_PENDING');
  const before=classPromptAcknowledged;
  classPromptName=name;
  // The CDP Runtime.evaluate call may reject after a synchronous WebChrome
  // prompt; only explicit observation of that exact accepted prompt and the
  // resulting visible class permits continuation.
  let clickError=null;
  try{await button('Nuova Classe');}
  catch(error){clickError=error;}
  await until(()=>classPromptAcknowledged===before+1,
    'SYNTHETIC_CLASS_PROMPT_NOT_ACCEPTED',15000);
  classPromptName=null;
  // On Android 36 the OS may protect the mounted App while the prompt settles.
  // Check the real authentication gate BEFORE waiting for class text, then
  // require the class view to be interactive, not merely present in the DOM.
  await ensureInteractiveSession('after-class-prompt');
  const expectedClassHeading='Gestione Elenco Alunni: '+name;
  await until(async()=>{
    const state=await dom('(function(){const brand=document.querySelector("[data-testid=header01-brand-navigation]");'+
      'return {locked:!!document.querySelector("#vault-password"),'+
      'ready:!!brand&&!brand.closest("[inert]")&&brand.getClientRects().length>0&&'+
      'getComputedStyle(brand).visibility==="visible"&&document.visibilityState==="visible",'+
      'classVisible:document.body?.innerText?.includes('+JSON.stringify(expectedClassHeading)+')===true};})()');
    if(state.locked){
      await ensureInteractiveSession('after-class-prompt');
      return false;
    }
    return state.ready&&state.classVisible;
  },'INTERACTIVE_SYNTHETIC_CLASS_AFTER_PROMPT',90000,false);
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
      {stdio:'ignore',timeout:7000});
    return true;
  } catch(error) {
    return error?.status===1 ? false : null;
  }
}
function safeDeviceByteCount(filename) {
  try {
    const value=adb('shell','stat','-c','%s',quotedLabV7Path(filename));
    return /^\d+$/.test(value) ? Number(value) : null;
  } catch { return null; }
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
    const before=safeDeviceByteCount(filename);
    if(!Number.isSafeInteger(before)||before<=0)throw Error('LAB_V7_SIZE_UNAVAILABLE');
    bytes=pullLabV7Bytes(filename);
    const after=safeDeviceByteCount(filename);
    if(bytes.length!==before||after!==before)throw Error('LAB_V7_SIZE_MISMATCH');
  }
  catch(error){
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
  const deadline=Date.now()+15000;
  let attempts=0;
  lastPhysicalReadKind='not-attempted';
  while(true){
    attempts++;
    try{return inspectEncryptedFile(filename);}
    catch(error){
      if(error?.message!=='NATIVE_V7_PHYSICAL_READ_UNAVAILABLE')throw error;
      if(Date.now()>=deadline){
        // Missing diagnostics must never mask the physical-read failure.
        try{await capturePhysicalReadDiagnostic(filename,attempts);}
        catch{console.log('AP02_F2_PHYSICAL_READ_DIAGNOSTIC_UNAVAILABLE',api);}
        throw Error('NATIVE_V7_PHYSICAL_READ_UNAVAILABLE_AFTER_RETRY');
      }
      await sleep(500);
    }
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
  const prior=dialogs.length;
  await field('input[placeholder="Inserisci la password impostata alla cifratura"]',copyPassword);
  await field('#restore-v7-recovery-password',copyPassword);
  await button('Scegli file e ripristina');
  await nativeChoose(target);
  await reauthenticateAfterPicker('target-source');
  await until(()=>dialogs.slice(prior).some(d=>d.kind==='confirm'&&/Ripristino V7/.test(d.message)),
    'REAL_RECOVERY_CONSENT',45000);
  await nativeChoose(recovery);
  await reauthenticateAfterPicker('recovery-source');
  await until(()=>dialogs.slice(prior).some(d=>d.kind==='alert'&&/ripristinato con successo/i.test(d.message)),
    'REAL_V7_RESTORE_RESULT',60000);
}
async function launch(){
  adb('shell','am','start','-W','-n',activity);
  await connect();
  assert.equal(probe().length,1);
}
async function run(){
  assert.equal(Number(adb('shell','getprop','ro.build.version.sdk')),api);
  assert.equal(adb('install','--no-incremental',process.env.AP02_LAB_APK).split('\n').filter(x=>x==='Success').length,1);
  await launch();
  await onPage('Configura archivio protetto',60000);
  record('installed-professional-android-webview');
  // In contrast to the earlier demo-mode browser test, this is a wholly
  // synthetic PROFESSIONAL archive created through the actual product gate.
  await click('input[name="archive-mode"][value="professional"]');
  const profile=['Istituto totalmente fittizio','2026/2027','Docente sintetico','Tecnologia'];
  for(let i=0;i<profile.length;i++){
    const index=i,value=profile[i];
    await dom('(function(){const a=Array.from(document.querySelectorAll("fieldset input[required]"));'+
      'if(a.length!==4||!a['+index+'])throw Error("SYNTHETIC_PROFILE_INPUT_MISSING");'+
      'Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(a['+index+'],'+
      JSON.stringify(value)+');a['+index+'].dispatchEvent(new Event("input",{bubbles:true}));'+
      'a['+index+'].dispatchEvent(new Event("change",{bubbles:true}));return true;})()');
  }
  await field('#vault-password',password);
  await button('Crea il mio registro');
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
    writeFileSync(out+'/saf-diagnostic.json',JSON.stringify({schemaVersion:3,
      stage:'professional-setup-home',api,phase,
      originalError:classifyFailure(error).code,
      nativeActivity,locked:surface?.locked??null,
      visibility:['visible','hidden'].includes(surface?.visibility)?surface.visibility:'unknown',
      homeHeadingVisible:surface?.homeHeadingVisible??null},null,2));
    throw error;
  }
  record('professional-vault-created-with-synthetic-profile');
  await createClass(originalClass);
  await nav('Privacy');
  const target=await exportV7();
  // The first document remains at its original provider-owned location.
  // Android will give the second same-day copy a numbered filename.
  assert.deepEqual(await verifiedEncryptedFile(target.name),target.digest);
  record('native-v7-target-export-saf-verified',{target:target.digest,physical:true,nativeReauthCount});
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
  record('native-v7-current-recovery-export-saf-verified',{recovery:recovery.digest,physical:true,nativeReauthCount});
  await restoreFromRealSaf(target.name,recovery.name);
  await onPage('Le mie classi',60000);
  assert.equal(await dom('document.body?.innerText?.includes('+JSON.stringify(originalClass)+')'),true);
  assert.equal(await dom('document.body?.innerText?.includes('+JSON.stringify(newerClass)+')'),false);
  record('actual-professional-v7-native-saf-import-and-restored-ui',{twoFileSelection:true,
    encryptedFilesDistinct:true,nativeReauthCount});
  disconnect();
  const restart=await verifiedProcessStop({probe,forceStop:()=>adb('shell','am','force-stop',pkg)});
  await launch();
  await onPage('Sblocca Registro',60000);
  await field('#vault-password',password);
  await button('Sblocca Registro');
  await onPage('Le mie classi',60000);
  assert.equal(await dom('document.body?.innerText?.includes('+JSON.stringify(originalClass)+')'),true);
  assert.equal(await dom('document.body?.innerText?.includes('+JSON.stringify(newerClass)+')'),false);
  record('actual-android-process-cold-reopen-preserves-v7-restore',{
    forcedStop:true,absenceSamples:restart.absenceSamples,
    beforePidsCount:restart.beforePids?.length,afterPidsCount:restart.afterPids?.length});
}
try{
  await run();
  console.log('AP02_F2_DEVICE_SUCCESS',sha,api);
}catch(error){
  // Classify failures but never echo data, passwords, ciphertext or WebView DOM.
  const {category,code}=classifyFailure(error);
  writeFileSync(out+'/failure.json',JSON.stringify({candidate:sha,api,phase,code,category,
    observation:error instanceof LabFailure?error.observation:undefined,
    qualified:false,productionRelease:false,syntheticOnly:true,
    adbTransport:adbTransport.snapshot(),
    safActivityTrail:lastSafActivityTrail,
    homeConfirmDiagnostic:homeConfirmDiagnostic||undefined,
    homeNavigationDiagnostic:homeNavigationDiagnostic||undefined},null,2));
  console.error('AP02_F2_DEVICE_BLOCKED',phase,code,category);
  process.exitCode=1;
}finally{disconnect();}
