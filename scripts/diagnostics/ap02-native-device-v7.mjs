// AP-02/F2-DEVICE: isolated real Android WebView + production Privacy UI + native SAF.
// Only a debug laboratory APK and wholly synthetic profile/classes are allowed.
// Chrome DevTools drives public DOM controls; no application internals, plugin
// mocks, production credentials, plaintext backup uploads or external services.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { parseNativeNodes, resumedActivity, hasArea } from './native-ui-driver.mjs';
import { probePackagePids, verifiedProcessStop } from './native-process-probe.mjs';

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
const targetName = 'AP02_F2_TARGET.enc.json';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const adb = (...args) => execFileSync('adb', args, { encoding: 'utf8', timeout: 30000 }).trim();
const probe = () => probePackagePids(adb, pkg);
const nativeForeground = () => resumedActivity(adb('shell','dumpsys','activity','activities'), pkg);
const results = [];
const out = 'ap02-device-evidence';
mkdirSync(out,{recursive:true});
let phase = 'preflight';
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
async function until(fn, name, timeout = 60000) {
  const end = Date.now()+timeout;
  while(Date.now()<end) {
    try{const x=await fn();if(x)return x;}catch{}
    await sleep(350);
  }
  throw new Error('CONDITION_TIMEOUT:'+name);
}
function nativeNodes() {
  adb('shell','rm','-f','/sdcard/ap02-f2-ui.xml');
  adb('shell','uiautomator','dump','/sdcard/ap02-f2-ui.xml');
  return parseNativeNodes(adb('shell','cat','/sdcard/ap02-f2-ui.xml'));
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
async function nativeSave(alertIndex) {
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
      originalError:String(error?.message||'UNKNOWN').replace(/[^A-Z0-9:_-]/gi,'_').slice(0,100)};
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
}
// Android opens an external DocumentsUI activity. The product deliberately
// suspends and shields the Vault onPause. Resume by explicitly authenticating
// through its actual LOCKED screen; never bypass Root, grant an epoch or call
// native plugin methods out of band.
let nativeReauthCount=0;
async function reauthenticateAfterPicker(kind) {
  phase='native-saf-return-reauth-'+kind;
  await until(()=>dom('Boolean(document.querySelector("#vault-password"))'),
    'ANDROID_SESSION_REAUTH_REQUIRED_'+kind,35000);
  await onPage('Sblocca Registro',35000);
  await field('#vault-password',password);
  await button('Sblocca Registro');
  await until(()=>dom('!document.querySelector("#vault-password") && '+
    'document.body?.innerText?.includes("Privacy First")'),
    'ANDROID_SESSION_REAUTHORIZED_'+kind,45000);
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

let socket=null,seq=0;
const waiting=new Map(),dialogs=[];
let classPromptName=null;
let classPromptAcknowledged=0;
function disconnect() {
  if(socket){socket.close();socket=null;}
  for(const [id,p] of waiting){clearTimeout(p.timer);p.reject(new Error('CDP_DISCONNECTED'));waiting.delete(id);}
  try{adb('forward','--remove','tcp:9222');}catch{}
}
function send(method,params={}) {
  const id=++seq;
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{waiting.delete(id);reject(new Error('CDP_TIMEOUT:'+method));},40000);
    waiting.set(id,{timer,resolve,reject});
    socket.send(JSON.stringify({id,method,params}));
  });
}
async function connect() {
  const s=await until(async()=>{
    const ps=probe();if(ps.length!==1)return null;
    adb('forward','tcp:9222','localabstract:webview_devtools_remote_'+ps[0]);
    const resp=await fetch('http://127.0.0.1:9222/json/list',{signal:AbortSignal.timeout(3000)});
    const list=await resp.json();
    const target=list.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/^https?:\/\/localhost(?:[:/]|$)/.test(x.url));
    if(!target)return null;
    const ws=new WebSocket(target.webSocketDebuggerUrl.replace(/ws:\/\/[^/]+/,'ws://127.0.0.1:9222'));
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{ws.close();reject(new Error('CDP_SOCKET_TIMEOUT'));},4000);
      ws.addEventListener('open',()=>{clearTimeout(timer);resolve();},{once:true});
      ws.addEventListener('error',()=>{clearTimeout(timer);reject(new Error('CDP_SOCKET_ERROR'));},{once:true});
    });
    return ws;
  },'WEBVIEW_DEBUG_TARGET',60000);
  socket=s;
  socket.addEventListener('message',e=>{
    const msg=JSON.parse(e.data);
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
          void send('Page.handleJavaScriptDialog',{accept:false}).catch(()=>{});
          return;
        }
        classPromptName=null;
        classPromptAcknowledged++;
        void send('Page.handleJavaScriptDialog',{accept:true,promptText:expected}).catch(()=>{});
        return;
      }
      void send('Page.handleJavaScriptDialog',{accept:true}).catch(()=>{});
      return;
    }
    const w=waiting.get(msg.id);
    if(w){
      waiting.delete(msg.id);clearTimeout(w.timer);
      if(msg.error||msg.result?.exceptionDetails){
        const detail=msg.result?.exceptionDetails?.exception?.description||'';
        const safe=['NEW_CLASS_MISSING','AMBIGUOUS_BUTTON','NAV_NOT_UNIQUE',
          'MISSING_CONTROL','MISSING_INPUT','SYNTHETIC_PROFILE_INPUT_MISSING',
          'BUTTON_MATCH_COUNT_0','BUTTON_MATCH_COUNT_2','BUTTON_MATCH_COUNT_3',
          'ReferenceError','TypeError','InvalidStateError'].find(x=>detail.includes(x))||'UNKNOWN';
        w.reject(new Error('CDP_EVALUATION_REJECTED:'+safe));
      }
      else w.resolve(msg.result?.result?.value);
    }
  });
  await send('Page.enable');
}
async function evaluate(expr,timeout=35000){
  // Only public DOM operations, never internal App methods, Vault keys or
  // decrypted backup contents.
  const p=send('Runtime.evaluate',{expression:expr,awaitPromise:true,returnByValue:true});
  return await Promise.race([p,new Promise((_,reject)=>setTimeout(()=>reject(new Error('DOM_WAIT_TIMEOUT')),timeout))]);
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
async function nav(label){
  await click('[data-testid="header01-brand-navigation"]');
  await until(()=>dom('Boolean(document.querySelector("#registro-navigation-drawer"))'),'NAV_DRAWER',15000);
  await dom('(function(){const e=Array.from(document.querySelectorAll("#registro-navigation-drawer button"))'+
    '.filter(x=>x.textContent?.trim()==='+JSON.stringify(label)+'&&!x.disabled);'+
    'if(e.length!==1)throw Error("NAV_NOT_UNIQUE");e[0].click();return true;})()');
  if(label==='Oggi'){
    const confirm=await dom('Boolean(document.querySelector("[data-testid=header01-home-confirm]"))');
    if(confirm){
      phase='visible-ui-home-confirm';
      // Scope to the currently open, teacher-visible confirmation. A global
      // "Torna a Oggi" lookup can match an inert or hidden navigation surface.
      await until(()=>dom('(function(){const root=document.querySelector("[data-testid=header01-home-confirm]");'+
        'if(!root)return false;const a=Array.from(root.querySelectorAll("button")).filter(e=>'+
        'e.innerText?.trim()==="Torna a Oggi"&&!e.disabled&&e.getClientRects().length>0'+
        '&&getComputedStyle(e).visibility==="visible");return a.length===1;})()'),
        'VISIBLE_EXACT_HOME_CONFIRM',20000);
      await dom('(function(){const root=document.querySelector("[data-testid=header01-home-confirm]");'+
        'const a=Array.from(root?.querySelectorAll("button")||[]).filter(e=>'+
        'e.innerText?.trim()==="Torna a Oggi"&&!e.disabled&&e.getClientRects().length>0'+
        '&&getComputedStyle(e).visibility==="visible");if(a.length!==1)throw Error("HOME_CONFIRM_NOT_UNIQUE");'+
        'a[0].click();return true;})()');
      await until(()=>dom('!document.querySelector("[data-testid=header01-home-confirm]")'),
        'HOME_CONFIRM_DISMISSED',20000);
    }
  }
  phase='visible-ui-navigation-'+label;
  await onPage(label==='Privacy'?'Ripristina backup cifrato':'Le mie classi');
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
  await onPage('Gestione Elenco Alunni: '+name,45000);
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
function findV7Name(){
  const ls=adb('shell','ls','-1','/sdcard/Download');
  const names=ls.split('\n').map(s=>s.trim()).filter(s=>/^Backup_Valutazioni_V7_\d{4}-\d{2}-\d{2}\.enc\.json$/.test(s));
  assert.equal(names.length,1,'EXPECTED_ONE_V7_FILE');
  return names[0];
}
function inspectEncryptedFile(filename){
  const bytes=execFileSync('adb',['exec-out','cat','/sdcard/Download/'+filename],{timeout:30000});
  const text=bytes.toString('utf8');
  const e=JSON.parse(text);
  assert.equal(e.privacy_protocol,'REGISTRO_DOCENTE_AES_GCM_256');
  assert.equal(e.version,2);
  assert.equal(typeof e.ciphertext,'string');
  assert.ok(bytes.length>300&&!text.includes(originalClass)&&!text.includes(newerClass));
  return {bytes:bytes.length,sha256:sha256(bytes)};
}
async function exportV7(){
  phase='native-v7-export-form';
  await field('input[placeholder="Inserisci password sicura (min. 6 caratteri)"]',copyPassword);
  await field('input[placeholder="Ripeti la password"]',copyPassword);
  const prior=dialogs.length;
  phase='native-v7-export-submit';
  await button('Esporta copia completa V7');
  phase='native-v7-export-picker';
  await nativeSave(prior);
  await reauthenticateAfterPicker('export');
  await until(()=>dialogs.slice(prior).some(d=>d.kind==='alert'&&
    /Copia completa V7 salvata, riletta e verificata/.test(d.message)),
    'V7_VERIFIED_NATIVE_RECEIPT',45000);
  const name=findV7Name();
  const digest=inspectEncryptedFile(name);
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
  await onPage('Le mie classi',60000);
  record('professional-vault-created-with-synthetic-profile');
  await createClass(originalClass);
  await nav('Privacy');
  const target=await exportV7();
  // The product uses a date-only V7 basename. Retain the exact encrypted
  // target bytes locally under a second name, so the next export cannot
  // overwrite it. Native file readback still validates its envelope.
  adb('shell','mv','/sdcard/Download/'+target.name,'/sdcard/Download/'+targetName);
  adb('shell','am','broadcast','-a','android.intent.action.MEDIA_SCANNER_SCAN_FILE',
    '-d','file:///sdcard/Download/'+targetName);
  assert.deepEqual(inspectEncryptedFile(targetName),target.digest);
  record('native-v7-target-export-saf-verified',{target:target.digest,physical:true,nativeReauthCount});
  await nav('Oggi');
  await createClass(newerClass);
  await nav('Privacy');
  const recovery=await exportV7();
  assert.notEqual(recovery.digest.sha256,target.digest.sha256);
  record('native-v7-current-recovery-export-saf-verified',{recovery:recovery.digest,physical:true,nativeReauthCount});
  await restoreFromRealSaf(targetName,recovery.name);
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
  const code=String(error?.message||'UNKNOWN').slice(0,140);
  writeFileSync(out+'/failure.json',JSON.stringify({candidate:sha,api,phase,code,
    qualified:false,productionRelease:false,syntheticOnly:true},null,2));
  console.error('AP02_F2_DEVICE_BLOCKED',phase,code);
  process.exitCode=1;
}finally{disconnect();}
