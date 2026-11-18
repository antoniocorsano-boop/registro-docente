// Synthetic CI emulator only. No production package or device.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync,writeFileSync,mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import {probePackagePids,verifiedProcessStop} from './native-process-probe.mjs';
import {createNativeUiDriver,parseNativeNodes,resumedActivity,NativeUiFault,demoRadio as strictDemoRadio,vaultField as strictVaultField} from './native-ui-driver.mjs';
const integral=process.env.VAL01_INTEGRAL==='true';
const product=process.env.VAL01_PRODUCT==='true';
const db2Lifecycle=process.env.VAL01_DB2_LIFECYCLE==='true';
const realBackup=process.env.VAL01_REAL_BACKUP==='true';
const freshRecovery=process.env.VAL01_FRESH_RECOVERY==='true';
const interruptionCut=process.env.VAL01_MIGRATION_CUT||'';
const smoke=process.env.VAL01_HISTORICAL_SMOKE==='true';
const api=product?Number(process.env.VAL01_API):36;
const pkg=integral?'it.trama.registrodocente':'it.trama.registrodocente.lab.val01';
const adb=(...args)=>execFileSync('adb',args,{encoding:'utf8',timeout:30000}).trim();
const packagePids=()=>probePackagePids(adb,pkg);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const evidence=[];
mkdirSync('native-evidence',{recursive:true});
function stage(name,details={}){
  evidence.push({stage:name,status:'PASS',...details});
  writeFileSync('native-evidence/result.json',JSON.stringify({candidate:process.env.CANDIDATE_SHA,predecessor:process.env.HISTORICAL_SHA,api,scope:smoke?'original historical APK only; native UI; synthetic emulator only':product?'original historical APK; actual candidate Root/App/Privacy; synthetic emulator only':integral?'original historical unsigned APK re-signed in CI, candidate laboratory APK':'laboratory APKs, exact historical storage source, candidate native bridge',qualification:smoke?'historical-ui-smoke':integral?(Number(process.env.OLD_VERSION)===10002?'negative-only':'supported-migration'):'complete-storage-laboratory',productionRelease:false,smoke:smoke||undefined,cut:interruptionCut||undefined,results:evidence},null,2));
  console.log(name,'PASS');
}
async function until(fn,label,ms=30000){
  const end=Date.now()+ms;let observations=0,lastError=null;
  while(Date.now()<end){try{observations++;const v=await fn();if(v)return v;}catch(e){lastError=e?.name||'Error';}await sleep(500);}
  writeFileSync('native-evidence/last-wait.json',JSON.stringify({phase:label,observations,lastError},null,2));
  throw Error(label);
}
let socket,seq=0;
const pending=new Map();
async function connect(){
  assert.equal(smoke,false,'Historical smoke cannot use DevTools');
  socket=await until(async()=>{
    const pids=packagePids();
    if(pids.length!==1)return null;
    const pid=String(pids[0]);
    adb('forward','tcp:9222','localabstract:webview_devtools_remote_'+pid);
    const res=await fetch('http://127.0.0.1:9222/json/list',{signal:AbortSignal.timeout(2000)});
    const target=(await res.json()).find(t=>t.type==='page'&&t.webSocketDebuggerUrl&&/^https?:\/\/localhost(?:[:/]|$)/.test(t.url));
    if(!target)return null;
    const ws=new WebSocket(target.webSocketDebuggerUrl.replace(/ws:\/\/[^/]+/,'ws://127.0.0.1:9222'));
    await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
    ws.addEventListener('message',e=>{const m=JSON.parse(e.data),p=pending.get(m.id);if(p){pending.delete(m.id);clearTimeout(p.timer);m.error||m.result?.exceptionDetails?p.reject(Error('WebView evaluation failed')):p.resolve(m.result);}});
    return ws;
  },'WebView CDP not available',45000);
}
function cdp(method,params={},timeout=15000){
  const id=++seq;
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{pending.delete(id);reject(Error('WebView CDP timeout: '+method));},timeout);
    pending.set(id,{timer,resolve,reject});
    socket.send(JSON.stringify({id,method,params}));
  });
}
function evaluate(expression,timeout=15000){
  return cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true},timeout).then(r=>r.result.value);
}
const call=(api,method,...args)=>evaluate('window['+JSON.stringify(api)+']['+JSON.stringify(method)+'](...'+JSON.stringify(args)+')',method==='write'?90000:15000);
const old=(m,...a)=>call('__beta2ArchiveCompatibility',m,...a);
const hist=(m,...a)=>call('__val01FenceHistorical',m,...a);
const lab=(m,...a)=>call('__val01NativeLab',m,...a);
const candidate=(m,...a)=>call('__val01FenceCandidate',m,...a);
function stop(){socket?.close();socket=null;adb('shell','am','force-stop',pkg);try{adb('forward','--remove','tcp:9222');}catch{}}
async function launch(api){
  adb('shell','am','start','-W','-n',pkg+'/it.trama.registrodocente.prova.MainActivity');
  await connect();
  await until(()=>evaluate('typeof window['+JSON.stringify(api)+']==="object"'),'Fixture missing');
}
function install(path,flags=[]){
  const result=adb('install','--no-incremental',...flags,path);
  assert.equal(result.split('\n').filter(x=>x.trim()==='Success').length,1);
}
function identity(version){
  const d=adb('shell','dumpsys','package',pkg);
  assert.equal(Number(d.match(/\bversionCode=(\d+)/)?.[1]),version);
  const uid=d.match(/\b(?:userId|appId)=(\d+)/)?.[1],first=d.match(/\bfirstInstallTime=([^\n]+)/)?.[1]?.trim();
  assert.ok(uid&&first);
  return {uid,first};
}
function nodes(){
  adb('shell','rm','-f','/sdcard/val01-ui.xml');
  adb('shell','uiautomator','dump','/sdcard/val01-ui.xml');
  const xml=adb('shell','cat','/sdcard/val01-ui.xml');
  return parseNativeNodes(xml);
}
const doc=n=>/documentsui/i.test(n.pkg);
const find=(predicate,label)=>until(()=>nodes().find(n=>n.bounds&&predicate(n)),label,45000);
function tap(n){const [l,t,r,b]=n.bounds;assert.ok(r>l&&b>t);adb('shell','input','tap',String(Math.round((l+r)/2)),String(Math.round((t+b)/2)));}
const filename='Backup_Cifrato_GDPR_2031-01-15.enc.json';
async function downloads(){
  await find(n=>doc(n)&&(/show roots|open navigation drawer|mostra radici/i.test(n.desc)||/^(Downloads|Download)$/i.test(n.text)||/^(save|salva)$/i.test(n.text)),'Native picker not visible');
  if(!nodes().some(n=>doc(n)&&/^(Downloads|Download)$/i.test(n.text))){
    tap(await find(n=>doc(n)&&/show roots|open navigation drawer|mostra radici/i.test(n.desc),'Native picker roots missing'));
    tap(await find(n=>doc(n)&&/^(Downloads|Download)$/i.test(n.text),'Downloads root missing'));
  }
}
function foreground(){
  return resumedActivity(adb('shell','dumpsys','activity','activities'),pkg);
}
async function startRead(wrong=false){
  // Never hold a DevTools awaitPromise across a backgrounded WebView.
  await evaluate('(()=>{window.__val01NativeLab.readAndPrepare('+JSON.stringify(wrong)+').catch(()=>{});return true})()');
  await downloads();
}
async function readResult(){
  await until(foreground,'Android picker did not return to the laboratory app',20000);
  const result=await until(async()=>{
    const s=await lab('readState');
    return ['cancelled','authorization-rejected','authorized','native-error'].includes(s.phase)?s:null;
  },'Native read/authorization did not settle',30000);
  console.log('native-read-phase',result.phase,result.bytes||0);
  assert.notEqual(result.phase,'native-error');
  return result;
}
async function pickerRead(wrong=false){
  await startRead(wrong);
  // DocumentsUI exposes a separate preview button with the file name in its
  // content description. That button never returns an ACTION_OPEN_DOCUMENT URI.
  // Select the visible title instead; never fall back to a preview affordance.
  const row=await find(n=>doc(n)&&n.text===filename&&!/preview|anteprima/i.test(n.desc),'Selectable encrypted file title missing (not preview)');
  assert.equal(row.text,filename);
  assert.ok(!/preview|anteprima/i.test(row.desc));
  console.log('native-file-target',JSON.stringify(row));
  tap(row);
  // Some DocumentsUI versions require explicit confirmation after selection.
  await until(()=>foreground()||nodes().some(n=>doc(n)&&/^(open|apri)$/i.test(n.text)),'File selection did not complete',12000);
  if(!foreground())tap(await find(n=>doc(n)&&/^(open|apri)$/i.test(n.text),'Open confirmation absent'));
  return readResult();
}
// Original release APK is non-debuggable: all actions on it use Android UI.
const marker='Collaudo migrazione VAL01';
const vaultPassword='synthetic-archive-compatibility-only';
const nativeApp=n=>n.pkg===pkg;
const named=(n,label)=>nativeApp(n)&&(n.text===label||n.desc===label);
// Exact, compound accessibility labels observed in all three original APKs.
// Require both the post-commit header and the management heading; a prompt,
// input field, toast, or substring alone must never count as creation.
const originalClassCreated=view=>view.some(n=>named(n,'Classe '+marker)&&n.clazz==='android.widget.TextView')&&
  view.some(n=>named(n,'Gestione Elenco Alunni: '+marker)&&n.clazz==='android.widget.TextView');
function verifyOriginalUiRecognition(){
  // Minimal non-identifying replay from failure artifacts 14302543378,
  // 14302563471 and 14303066402. The three accessibility trees agree.
  const observed=[
    {pkg,text:'Gestione alunni',desc:'',clazz:'android.widget.TextView'},
    {pkg,text:'Classe '+marker,desc:'',clazz:'android.widget.TextView'},
    {pkg,text:'Gestione Elenco Alunni: '+marker,desc:'',clazz:'android.widget.TextView'},
    {pkg,text:'Apri navigazione del Registro',desc:'',clazz:'android.widget.Button',enabled:true,clickable:true}
  ];
  assert.equal(originalClassCreated(observed),true);
  assert.equal(originalClassCreated([{pkg,text:marker,desc:'',clazz:'android.widget.EditText'}]),false);
  assert.equal(originalClassCreated(observed.slice(0,2)),false);
  assert.equal(originalClassCreated(observed.map(n=>({...n,pkg:'unrelated.package'}))),false);
  console.log('original-ui-recognition-replay PASS');
}
const appButton=label=>find(n=>named(n,label)&&n.enabled&&(n.clickable||n.clazz==='android.widget.Button'),label);
const appText=label=>find(n=>nativeApp(n)&&(n.text.includes(label)||n.desc.includes(label)),label);
const appEdit=(secret=false)=>find(n=>nativeApp(n)&&n.clazz==='android.widget.EditText'&&(!secret||n.password),'Native edit field');
function inputText(value){adb('shell','input','text',value.replace(/ /g,'%s'));}
function hideKeyboard(){if(/mInputShown=true|mIsInputViewShown=true/.test(adb('shell','dumpsys','input_method')))adb('shell','input','keyevent','4');}
function launchOriginal(){adb('shell','am','start','-W','-n',pkg+'/it.trama.registrodocente.prova.MainActivity');}
const driverEvents=[];
const uiDriver=createNativeUiDriver({
  pkg,readNodes:nodes,isForeground:foreground,tap,input:inputText,
  clear:()=>{adb('shell','input','keyevent','123');adb('shell','input','keyevent',...Array(96).fill('67'));},
  hideKeyboard,pause:sleep,
  report:event=>{
    driverEvents.push(event);
    writeFileSync('native-evidence/native-ui-driver.json',JSON.stringify(driverEvents,null,2));
    console.log('native-ui-driver',event.phase,event.status,event.attempt??'',event.code??'',event.evidence??'');
  }
});
const vaultField=n=>strictVaultField(n,pkg);
const demoRadio=n=>strictDemoRadio(n,pkg);
function verifyDemoSelectionRecognition(){
  const radio={pkg,text:'Ambiente dimostrativo Esplora con dati di esempio, non reali.',desc:'',clazz:'android.widget.RadioButton',enabled:true,clickable:true,bounds:[1,1,3,3]};
  const title={pkg,text:'Ambiente dimostrativo',desc:'',clazz:'android.widget.TextView',enabled:true,clickable:false,bounds:[1,1,3,3]};
  assert.equal(demoRadio(radio),true);assert.equal(demoRadio(title),false);
  assert.equal(demoRadio({...radio,pkg:'unrelated.package'}),false);
  assert.equal(vaultField({pkg,id:'vault-password',clazz:'android.widget.EditText',password:true,enabled:true,bounds:[1,1,3,3]}),true);
  console.log('original-demo-selection-recognition-replay PASS');
}
async function selectOriginalDemo(){await uiDriver.selectDemo();}
async function enterSyntheticPassword(credential=vaultPassword,expected){await uiDriver.enterPassword(credential,expected);}
const passwordRejected=view=>view.some(n=>nativeApp(n)&&n.text==='Password errata o metadata del vault manomesso.');
async function gate(action,credential=vaultPassword,expectedAlert=null){
  const expected=action==='Avvia la prova'||action==='Crea il mio registro'?'Configura archivio protetto':action;
  await enterSyntheticPassword(credential,expected);
  console.log('original-gate-input-verified',action);
  // The driver verifies the exact field and button in one stable sample;
  // never retry submission or authentication outcome.
  await uiDriver.submitGate(action,credential,expected);
  const outcome=await until(()=>{
    const view=nodes();
    if(passwordRejected(view))return 'rejected';
    if(expectedAlert&&view.some(n=>nativeApp(n)&&n.text===expectedAlert))return 'opened';
    if(view.some(n=>nativeApp(n)&&n.text==='Le mie classi')||view.some(n=>named(n,'Apri navigazione del Registro')))return 'opened';
    return null;
  },'Original gate did not reach an explicit outcome: '+action,45000);
  console.log('original-gate-outcome',action,outcome);
  if(outcome!=='opened')throw Error('Original authentication rejected: '+action);
}
async function findMarker(){
  for(let i=0;i<5;i++){
    try{return await until(()=>nodes().find(n=>named(n,'Apri classe '+marker)&&n.bounds),'Synthetic class missing',8000);}
    catch{
      const size=adb('shell','wm','size').match(/(\d+)x(\d+)/g)?.at(-1)?.split('x').map(Number);
      if(!size)throw Error('Missing screen size');
      const [w,h]=size;adb('shell','input','swipe',String(w/2),String(Math.round(h*.75)),String(w/2),String(Math.round(h*.35)),'450');
    }
  }
  throw Error('Synthetic class not located on verified original home screen');
}
async function uiCheckpoint(label){
  // Only synthetic CI UI, never archive contents or passwords.
  const safe=value=>!value?'':/Collaudo migrazione VAL01|^Classe creata$|^Gestione alunni$|^Apri navigazione del Registro$|^Chiudi navigazione del Registro$|^Le mie classi$|^Oggi$|^Torna a Oggi$|^Nuova Classe$|^OK$|^Annulla$|^Sblocca Registro$|^Password errata o metadata del vault manomesso\.$|^Configura archivio protetto$|^Inserisci la denominazione della nuova classe/.test(value)?value:'[redacted]';
  const view=(await until(()=>{const n=nodes();return n.length?n:null;},'UI checkpoint unavailable',12000)).map(n=>({text:n.password?'[redacted]':safe(n.text),desc:n.password?'[redacted]':safe(n.desc),pkg:n.pkg,id:n.id,clazz:n.clazz,enabled:n.enabled,clickable:n.clickable,bounds:n.bounds}));
  writeFileSync('native-evidence/ui-'+label+'.json',JSON.stringify(view,null,2));
  console.log('original-ui',label);
}
async function ensureHome(){
  // handleAddClass navigates to 'dati' after durable commit in all 3 SHAs.
  const home=()=>{try{return nodes().some(n=>nativeApp(n)&&(n.text.includes('Le mie classi')||n.desc.includes('Le mie classi')));}catch{return false;}};
  if(!home()){
    // Exact mobile header label from the three observed failure UI trees.
    // Source Navbar.tsx exposes Oggi in the drawer, not the active class view.
    tap(await appButton('Apri navigazione del Registro'));
    await appButton('Oggi');
    await uiCheckpoint('navigation-drawer');
    tap(await appButton('Oggi'));
    // Header01 requests explicit confirmation when leaving a class.
    await until(()=>home()||nodes().some(n=>named(n,'Torna a Oggi')&&n.enabled),'Return to Oggi not completed',20000);
    if(!home())tap(await appButton('Torna a Oggi'));
  }
  await appText('Le mie classi');
}
async function seedOriginal(version){
  launchOriginal();await appText('Configura archivio protetto');
  if(version!==10002){await selectOriginalDemo();await gate('Avvia la prova');}
  else await gate('Configura archivio protetto');
  await appText('Le mie classi');await uiCheckpoint('initial-home');
  if(smoke)stage('smoke-explicit-demo-setup-authenticated',{originalBinary:true});
  tap(await appButton('Nuova Classe'));
  await appText('Inserisci la denominazione della nuova classe');
  await uiDriver.enterClassName(marker);
  await uiDriver.submitClass(marker);
  // Verify that the app actually left the prompt and committed/navigated.
  await until(()=>originalClassCreated(nodes()),'Post-commit class management headings not observed in original UI',30000);
  await uiCheckpoint('class-created');
  await ensureHome();await uiCheckpoint('home-after-create');await findMarker();
  console.log('original-class-visible-before-restart');
  if(smoke)stage('smoke-synthetic-class-created-visible',{durableSubmission:true});
  if(smoke){
    const proof=await verifiedProcessStop({probe:packagePids,forceStop:()=>adb('shell','am','force-stop',pkg),pause:sleep});
    stage('smoke-process-stopped',proof);
  }else stop();
  launchOriginal();
  if(smoke){
    // Verify the cold gate natively, before any credential is entered.
    await uiDriver.stable('smoke-cold-protected-gate',view=>{
      const fields=view.filter(vaultField);
      const locked=view.some(n=>named(n,'Sblocca Registro')&&n.clazz==='android.widget.TextView');
      const visibleArchive=view.some(n=>named(n,'Apri navigazione del Registro')||named(n,'Le mie classi')||named(n,'Apri classe '+marker));
      return locked&&fields.length===1&&!visibleArchive?{key:'locked'}:null;
    },{ms:45000});
    await uiCheckpoint('cold-locked');
    const reopenedPids=packagePids();
    assert.ok(reopenedPids.length>0,'Relaunched historical process not observed');
    stage('smoke-cold-protected-gate',{archiveHidden:true,reopenedPids});
  }
  try{await gate('Sblocca Registro');}catch(e){
    // Preserve failed original UI before optional read-only diagnostic.
    await uiCheckpoint('authentication-failed').catch(()=>{});
    // Do not turn an original unlock failure into a PASS. The isolated candidate
    // may only authenticate the existing DB1 with the same synthetic credential.
    // No migration, no reset, no recovery attempt and no password guessing.
    if(!smoke&&!product&&String(e).includes('Original authentication rejected')){
      try{
        stop();const before=identity(version);install(process.env.NEW_APK,['-r']);assert.deepEqual(identity(10005),before);
        await launch('__val01NativeLab');
        assert.equal(await candidate('version'),1);
        await lab('inspectHistoricalArchive');
        assert.equal(await candidate('version'),1);
        console.log('diagnostic-candidate-readonly-authentication PASS');
      }catch{console.log('diagnostic-candidate-readonly-authentication FAILED');}
    }
    throw e;
  }
  await ensureHome();
  await uiCheckpoint('home-after-restart');await findMarker();
  console.log('original-class-visible-after-restart');
  if(smoke)stage('smoke-class-reopened-after-authentication',{markerVisible:true});
}
// D1b.5 actual product path. No synthetic native session authority.
// CDP only drives DOM and reads synthetic archive diagnostics; SAF and
// reauthentication use the mounted Root and Android's own activity lifecycle.
const inspectProduct=(includeCopy=false,fresh=false)=>call('__val01ProductInspection','inspect',includeCopy,fresh);
const readProductRaw=()=>call('__val01ProductInspection','raw');
async function navigateProduct(path,ready){
  await evaluate('(()=>{setTimeout(()=>location.replace('+JSON.stringify(path)+'),0);return true})()');
  await until(()=>evaluate(ready),'Candidate page not ready: '+path,45000);
}
async function diagnostic(){
  await navigateProduct('/diagnostic.html','typeof window.__val01ProductInspection==="object"');
}
async function productGate(){
  await navigateProduct('/index.html','!!document.querySelector("#vault-password")');
  await gate('Sblocca Registro');
}
let productPanel='section[aria-label="Aggiornamento protetto archivio"]';
const query=(selector)=>'document.querySelector('+JSON.stringify(selector)+')';
async function visible(selector){
  return evaluate('(()=>{const e='+query(selector)+';return !!e&&e.getClientRects().length>0&&getComputedStyle(e).visibility!=="hidden"&&!e.closest("[inert],[aria-hidden=true]")})()');
}
async function visibleText(text){
  return evaluate('(()=>{const e=[...document.querySelectorAll("h1,h2,h3,p,button")].find(x=>x.textContent.trim()==='+JSON.stringify(text)+'&&x.getClientRects().length>0&&getComputedStyle(x).visibility!=="hidden"&&!x.closest("[inert],[aria-hidden=true]"));return !!e})()');
}
async function waitText(text){await until(()=>visibleText(text),'Visible product text absent: '+text,45000);}
async function domClick(selector){
  await until(()=>visible(selector),'Visible candidate control absent: '+selector,45000);
  await evaluate('(()=>{const e='+query(selector)+';e.scrollIntoView({block:"center"});e.click();return true})()');
}
async function privacyProduct(){
  await domClick('[data-testid="header01-brand-navigation"]');
  await evaluate('(()=>{const e=[...document.querySelectorAll("button")].find(e=>e.textContent.trim()==="Privacy"&&e.getClientRects().length&&!e.closest("[inert],[aria-hidden=true]"));if(!e)throw Error("Privacy unavailable");e.scrollIntoView({block:"center"});return true})()');
  tap(await appButton('Privacy'));
  await until(()=>visible(productPanel),'Migration panel not visible',45000);
}
// Back may first dismiss a DocumentsUI location or overlay. Require actual
// return to the calling activity; no am start, forced foreground or bypass.
async function cancelProductPicker(){
  for(let attempt=1;attempt<=4;attempt++){
    if(foreground())return;
    const view=await until(()=>{const n=nodes();return n.some(doc)?n:null;},'DocumentsUI not active for cancellation',10000);
    assert.ok(view.some(doc));
    adb('shell','input','keyevent','4');
    try{await until(foreground,'Picker still open after Back',5000);console.log('product-picker-cancel-back',attempt);return;}
    catch{console.log('product-picker-cancel-still-open',attempt);}
  }
  throw Error('Native picker cancellation did not return after four verified Back actions');
}
async function selectProductFile(cancel=false,selectedFilename=filename){
  // The click invokes the actual React handler, not a fixture API.
  await domClick(productPanel+' > button');
  await downloads();
  if(cancel)await cancelProductPicker();
  else{
    const row=await find(n=>doc(n)&&n.text===selectedFilename&&!/preview|anteprima/i.test(n.desc),'Candidate encrypted file title absent');
    tap(row);
    await until(()=>foreground()||nodes().some(n=>doc(n)&&/^(open|apri)$/i.test(n.text)),'File selection did not return',20000);
    if(!foreground())tap(await find(n=>doc(n)&&/^(open|apri)$/i.test(n.text),'Native Open confirmation absent'));
  }
  await until(foreground,'Native picker did not return',30000);
  // Explicitly attest the native suspension gate, then authenticate through it.
  // Do not call any fixture authorize/acknowledge API.
  await until(()=>visible('#vault-password'),'Native chooser did not require reauthentication',45000);
  assert.equal(await visible(productPanel+' input[type=password]'),false,'Recovery credentials visible before reauthentication');
  await gate('Sblocca Registro');
  if(cancel)await waitText('Copia non disponibile o selezione annullata.');
  else await waitText(productPanel.includes('Ripristino')?'Copia selezionata. L’integrità sarà verificata prima del ripristino.':'Copia selezionata. L’integrità sarà verificata prima dell’aggiornamento.');
}
async function fillMigrationPasswords(copyPassword){
  // Synthetic UI input only. Never print or persist these test credentials.
  await evaluate('(()=>{const fields=[...document.querySelectorAll('+JSON.stringify(productPanel+' input[type=password]')+')];if(fields.length!==2)throw Error("Expected password inputs");const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set;for(const [i,value] of '+JSON.stringify([vaultPassword,copyPassword])+'.entries()){set.call(fields[i],value);fields[i].dispatchEvent(new Event("input",{bubbles:true}));}return true})()');
}
async function submitProduct(copyPassword,confirmation){
  await fillMigrationPasswords(copyPassword);
  const button=productPanel+' button[type=submit]';
  await until(()=>visible(button),'Migration submit missing',15000);
  // Return from CDP before a native confirmation dialog can block JS.
  await evaluate('(()=>{const e='+query(button)+';e.scrollIntoView({block:"center"});setTimeout(()=>e.click(),0);return true})()');
  if(confirmation!==null){
    await appText('La copia è stata verificata');
    const button=await find(n=>nativeApp(n)&&n.enabled&&n.clickable&&(confirmation?/^(OK|Yes|Sì)$/i:/^(Cancel|Annulla|No)$/i).test(n.text||n.desc),'Migration confirmation choice not present');
    tap(button);
  }
  await until(()=>visible('#vault-password'),'Migration did not return to protected gate',60000);
  await waitText(confirmation===true
    ?'Archivio aggiornato. Autenticati per verificarlo e riaprire il Registro.'
    :'Aggiornamento non completato. Autenticati per riaprire il Registro.');
}
async function assertUnchanged(before,version=1){
  await diagnostic();
  const raw=await readProductRaw();
  assert.equal(raw.version,version);
  assert.equal(raw.digest,before.digest);
  assert.deepEqual(raw.keys,before.keys);
}
async function writeSyntheticRestoreFile(backup){
  const dir=mkdtempSync(join(tmpdir(),'val01-restore-'));
  try{
    const file=join(dir,filename);writeFileSync(file,backup,{mode:0o600});
    adb('shell','mkdir','-p','/sdcard/Download');
    adb('push',file,'/sdcard/Download/'+filename);
    adb('shell','am','broadcast','-a','android.intent.action.MEDIA_SCANNER_SCAN_FILE','-d','file:///sdcard/Download/'+filename);
    assert.equal(execFileSync('adb',['exec-out','cat','/sdcard/Download/'+filename],{timeout:30000}).toString('utf8'),backup);
  }finally{rmSync(dir,{recursive:true,force:true});}
}
async function clickDeferred(selector){
  await until(()=>visible(selector),'Visible submit absent: '+selector,15000);
  await evaluate('(()=>{const e='+query(selector)+';if(e.disabled)throw Error("Disabled submit");e.scrollIntoView({block:"center"});setTimeout(()=>e.click(),0);return true})()');
}
async function nativeConfirm(message,approve){
  await appText(message);
  tap(await find(n=>nativeApp(n)&&n.enabled&&n.clickable&&(approve?/^(OK|Yes|Sì)$/i:/^(Cancel|Annulla|No)$/i).test(n.text||n.desc),'Explicit native confirmation absent'));
}
async function submitRestore(copyPassword,approve){
  await fillMigrationPasswords(copyPassword);
  await clickDeferred(productPanel+' form button[type=submit]');
  if(approve!==null)await nativeConfirm('Sostituire tutti i dati attuali',approve);
  await until(()=>visible('#vault-password'),'Restore did not reach protected gate',60000);
  await waitText(approve===true?'Archivio ripristinato. Autenticati per riaprire il Registro.':'Operazione non completata. Autenticati per riaprire il Registro.');
  assert.equal(await visible('[data-testid="header01-topbar"]'),false);
}
async function submitErase(approve){
  // Only the visible product form and actual confirmation grant permission.
  await evaluate('(()=>{const p='+query(productPanel)+';const b=[...p.querySelectorAll("button")].find(x=>x.textContent.trim()==="Prepara cancellazione");if(!b||b.disabled)throw Error("Erase unavailable");b.scrollIntoView({block:"center"});b.click();return true})()');
  await until(()=>visible(productPanel+' input[type=password]'),'Erase form missing',15000);
  await evaluate('(()=>{const p='+query(productPanel)+';const fields=[...p.querySelectorAll("form input")];if(fields.length!==2)throw Error("Unexpected erase fields");const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set;for(const [i,v] of '+JSON.stringify([vaultPassword,'CANCELLA'])+'.entries()){set.call(fields[i],v);fields[i].dispatchEvent(new Event("input",{bubbles:true}));}return true})()');
  await clickDeferred(productPanel+' form button[type=submit]');
  await nativeConfirm('Cancellare tutti i dati e la chiave',approve);
  if(approve){
    await waitText('Configura archivio protetto');
    await waitText('Archivio locale cancellato. Configura un nuovo archivio. Le copie esterne non sono state cancellate.');
  }else{
    await until(()=>visible('#vault-password'),'Refused erasure did not reach protected gate',60000);
    await waitText('Operazione non completata. Autenticati per riaprire il Registro.');
  }
  assert.equal(await visible('[data-testid="header01-topbar"]'),false);
}
async function assertErased(){
  await diagnostic();
  const raw=await readProductRaw();
  assert.equal(raw.version,2);assert.deepEqual(raw.keys,[]);
  assert.equal(await call('__val01ProductInspection','state'),'erased');
  return raw;
}
async function setupFreshProduct(){
  // The explicit professional setup form is driven via the actual Root UI.
  const freshPassword='synthetic-new-password';
  await waitText('Configura archivio protetto');
  await domClick('input[name="archive-mode"][value="professional"]');
  await until(()=>visible('#vault-password'),'Fresh professional form absent',15000);
  const profile={'Istituto':'Synthetic school','Anno scolastico':'2026/2027','Docente':'Synthetic teacher','Disciplina':'Tecnologia'};
  await evaluate('(()=>{const values='+JSON.stringify(profile)+';const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set;for(const [label,value] of Object.entries(values)){const l=[...document.querySelectorAll("label")].find(e=>e.childNodes[0]?.textContent.trim()===label);const input=l?.querySelector("input");if(!input)throw Error("Profile field missing");set.call(input,value);input.dispatchEvent(new Event("input",{bubbles:true}));}return true})()');
  await evaluate('(()=>{document.querySelector("#vault-password").scrollIntoView({block:"center"});return true})()');
  await enterSyntheticPassword(freshPassword);
  await clickDeferred('form button[type=submit]');
  await waitText('Sblocca Registro');
  await waitText('Nuovo archivio creato. Autenticati con la nuova password.');
  assert.equal(await visible('[data-testid="header01-topbar"]'),false);
  await gate('Sblocca Registro',freshPassword);
  await diagnostic();
  const fresh=await inspectProduct(false,true);
  assert.equal(fresh.version,2);assert.equal(fresh.keys.length,10);
  assert.deepEqual(fresh.snapshot.appData.classes,[]);
  assert.equal(fresh.snapshot.settings.archiveMode,'professional');
  assert.deepEqual(fresh.snapshot.meta,{changes:0,lastBackup:null});
  stage('db2-fresh-setup-reauthenticated');
  stop();launchOriginal();await connect();await gate('Sblocca Registro',freshPassword);
  await diagnostic();const cold=await inspectProduct(false,true);
  assert.equal(cold.version,2);assert.equal(cold.digest,fresh.digest);assert.deepEqual(cold.snapshot,fresh.snapshot);
  stage('db2-fresh-cold-reopen');
}
async function productLifecycleSuite(oldVersion,initial,before){
  // Called only after all original migration, downgrade and re-upgrade checks.
  const copy=await call('__val01ProductInspection','restoreCopy');
  await writeSyntheticRestoreFile(copy.backup);
  productPanel='section[aria-label="Ripristino protetto archivio"]';
  await productGate();await privacyProduct();await selectProductFile(true);
  stage('db2-restore-picker-cancel');
  await selectProductFile();
  adb('shell','input','keyevent','3');
  await until(()=>!foreground(),'Restore owner did not leave foreground',15000);
  launchOriginal();
  await until(()=>visible('#vault-password'),'Restore selection did not lock',45000);
  await gate('Sblocca Registro');
  await until(()=>visible(productPanel),'Restore panel missing after suspension',15000);
  await until(async()=>!(await visible(productPanel+' input[type=password]')),'Restore ticket survived session change',15000);
  stage('db2-restore-background-revoked');
  await selectProductFile();await submitRestore('wrong-synthetic',null);
  await assertUnchanged(before,2);
  stage('db2-restore-wrong-copy');
  await productGate();await privacyProduct();await selectProductFile();
  await submitRestore('synthetic-archive-backup-only',false);
  await assertUnchanged(before,2);
  stage('db2-restore-refused');
  await productGate();await privacyProduct();await selectProductFile();
  await submitRestore('synthetic-archive-backup-only',true);
  await gate('Sblocca Registro');await diagnostic();
  const restored=await inspectProduct();
  assert.equal(restored.version,2);assert.equal(restored.keys.length,10);
  assert.notEqual(restored.digest,before.digest);assert.deepEqual(restored.snapshot,copy.expected);
  stage('db2-restore-authorized-reauthenticated');
  stop();launchOriginal();await connect();await gate('Sblocca Registro');
  await diagnostic();const cold=await inspectProduct();
  assert.equal(cold.digest,restored.digest);assert.deepEqual(cold.snapshot,restored.snapshot);
  stage('db2-restore-cold-reopen');
  await productGate();await privacyProduct();await submitErase(false);
  await assertUnchanged(restored,2);
  stage('db2-erase-refused');
  await productGate();await privacyProduct();await submitErase(true);
  const erased=await assertErased();
  stage('db2-erase-authorized');
  stop();launchOriginal();await connect();await waitText('Configura archivio protetto');
  assert.equal(await visible('[data-testid="header01-topbar"]'),false);
  assert.equal((await assertErased()).digest,erased.digest);
  stage('db2-erased-cold-reopen');
  // Emulator only: the exact original cannot recreate DB1 after erasure.
  stop();install(process.env.OLD_APK,['-r','-d']);assert.deepEqual(identity(oldVersion),initial);
  launchOriginal();await appText('Sicurezza non disponibile');
  assert.ok(!nodes().some(n=>nativeApp(n)&&(/Sblocca Registro|Configura archivio protetto|Le mie classi|Proteggi i dati esistenti/.test(n.text)||n.password)));
  stop();install(process.env.NEW_APK,['-r']);assert.deepEqual(identity(10005),initial);
  launchOriginal();await connect();await waitText('Configura archivio protetto');
  assert.equal((await assertErased()).digest,erased.digest);
  stage('db2-erased-downgrade-refused');
  await navigateProduct('/index.html','!!document.querySelector("input[name=archive-mode]")');
  await setupFreshProduct();
}
// Separate, isolated hard-stop scenarios. The exact original APK is seeded
// through its UI. A CI-only debugger checkpoint pauses the real guarded
// versionchange callback, never a substitute transaction or migration grant.
async function armMigrationProcessCut(cut){
  let paused=null;
  const observedSocket=socket;
  const listener=e=>{
    const m=JSON.parse(e.data);
    if(m.method==='Debugger.paused')paused=m.params;
  };
  observedSocket.addEventListener('message',listener);
  await cdp('Debugger.enable');
  await evaluate('(()=>{const cut='+JSON.stringify(cut)+';const original=IDBTransaction.prototype.addEventListener;let armed=false;function migrationCutBefore(tx){debugger;}function migrationCutAfter(tx){debugger;}IDBTransaction.prototype.addEventListener=function(type,listener,options){const result=original.call(this,type,listener,options);if(!armed&&type==="complete"&&this.mode==="versionchange"&&this.db.name==="registro-docente-secure-vault"&&this.db.version===2){armed=true;const tx=this;if(cut==="before-commit")migrationCutBefore(tx);else original.call(tx,"complete",()=>migrationCutAfter(tx),{once:true});}return result;};return true})()');
  return async()=>{
    const info=await until(()=>paused,'Real guarded migration checkpoint was not reached',60000);
    const frame=info.callFrames[0];
    assert.equal(frame.functionName,cut==='before-commit'?'migrationCutBefore':'migrationCutAfter');
    const observed=await cdp('Debugger.evaluateOnCallFrame',{callFrameId:frame.callFrameId,expression:'({mode:tx.mode,version:tx.db.version,name:tx.db.name})',returnByValue:true});
    assert.deepEqual(observed.result.value,{mode:'versionchange',version:2,name:'registro-docente-secure-vault'});
    stage(cut==='before-commit'?'interruption-guard-before-commit':'interruption-guard-after-commit',{realVersionchange:true});
    // Do not disconnect or resume the debugger before killing the process:
    // the before-commit callback must not be allowed to finish normally.
    assert.ok(foreground());
    const proof=await verifiedProcessStop({probe:packagePids,forceStop:()=>adb('shell','am','force-stop',pkg),pause:sleep});
    observedSocket.removeEventListener('message',listener);
    observedSocket.close();socket=null;
    for(const p of pending.values())clearTimeout(p.timer);pending.clear();
    try{adb('forward','--remove','tcp:9222');}catch{}
    stage('interruption-process-stopped',proof);
  };
}
// Failure-only, read-only evidence. Never reload, clear WebView storage,
// change the expected version or mark the failed cold launch as successful.
async function collectColdInterruptionDiagnostics(before,phase='cold-gate-failed'){
  const report={cut:interruptionCut,api,phase,expectedVersion:interruptionCut==='before-commit'?1:2};
  const observe=async(name,fn)=>{try{report[name]=await fn();}catch(e){report[name]={failed:true,error:e.name||'Error'};}writeFileSync('native-evidence/cold-reopen-diagnostic.json',JSON.stringify(report,null,2));};
  await observe('foreground',()=>foreground());
  await observe('processes',()=>adb('shell','ps','-A').split('\n').filter(line=>line.includes(pkg)||line.includes('sandboxed_process')).map(line=>line.trim().split(/\s+/).filter((_,i,a)=>i<3||i===a.length-1)));
  await observe('targetInventory',async()=>{
    const res=await fetch('http://127.0.0.1:9222/json/list',{signal:AbortSignal.timeout(3000)});
    return (await res.json()).map(t=>({id:t.id,type:t.type,local:t.url?.startsWith('https://localhost')||t.url?.startsWith('http://localhost'),url:t.url?.split(/[?#]/)[0]}));
  });
  await observe('document',()=>evaluate('(()=>{const root=document.getElementById("root");return {href:location.origin+location.pathname,ready:document.readyState,visibility:document.visibilityState,boot:window.__val01Boot||null,bootstrapTrace:(()=>{try{return JSON.parse(document.querySelector("[data-bootstrap-trace]")?.getAttribute("data-bootstrap-trace")||"null")}catch{return null}})(),rootChildren:root?.childElementCount??null,heading:[...document.querySelectorAll("h1")].map(h=>h.textContent).filter(t=>["Sblocca Registro","Configura archivio protetto","Sicurezza non disponibile","Protezione del Registro","Protezione dati in corso","Oggi"].includes(t)),passwordField:!!document.querySelector("#vault-password"),scripts:[...document.scripts].filter(s=>s.src).map(s=>new URL(s.src).pathname),resources:performance.getEntriesByType("resource").filter(r=>r.initiatorType==="script").map(r=>({path:new URL(r.name).pathname,duration:Math.round(r.duration),transferSize:r.transferSize})),indexedDB:typeof indexedDB,crypto:!!globalThis.crypto?.subtle}})()',5000));
  await observe('archiveVersion',()=>evaluate('Promise.race([indexedDB.databases().then(d=>({status:"resolved",versions:d.filter(x=>x.name==="registro-docente-secure-vault").map(x=>x.version)})),new Promise(r=>setTimeout(()=>r({status:"timed-out"}),5000))])',8000));
  // Direct readonly capture on the observed version, no page navigation and
  // no crypto authorization. Abort on unexpected upgrade and close any handle.
  await observe('physical',()=>evaluate('((async()=>{const name="registro-docente-secure-vault";const ds=await indexedDB.databases();const v=ds.find(d=>d.name===name)?.version;if(v!==1&&v!==2)return {status:"unknown-version"};return new Promise(resolve=>{let settled=false;const done=value=>{if(settled)return;settled=true;clearTimeout(timer);resolve(value)};const timer=setTimeout(()=>done({status:"timed-out"}),6000);const r=indexedDB.open(name,v);r.onupgradeneeded=()=>r.transaction?.abort();r.onerror=()=>done({status:"open-error",name:r.error?.name});r.onblocked=()=>done({status:"blocked"});r.onsuccess=()=>{const db=r.result;if(settled){db.close();return;}try{const tx=db.transaction(["metadata","records"],"readonly"),m=tx.objectStore("metadata"),s=tx.objectStore("records");const mk=m.getAllKeys(),mv=m.getAll(),rk=s.getAllKeys(),rv=s.getAll();tx.oncomplete=async()=>{db.close();try{const json=JSON.stringify({metadataKeys:mk.result,metadata:mv.result,keys:rk.result,records:rv.result},(_k,v)=>v instanceof ArrayBuffer?Array.from(new Uint8Array(v)):v instanceof Uint8Array?Array.from(v):v);const digest=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(json))),x=>x.toString(16).padStart(2,"0")).join("");done({status:"read",version:v,recordCount:rk.result.length,digest});}catch{done({status:"digest-error"});}};tx.onabort=tx.onerror=()=>{db.close();done({status:"transaction-error"});};}catch{db.close();done({status:"inventory-error"});}};});})())',12000));
  if(report.physical?.status==='read')report.physical.matchesOriginal=report.physical.digest===before.digest;
  // Capture only relevant, synthetic-emulator crash/renderer/IDB log lines.
  await observe('nativeLogs',()=>adb('shell','logcat','-d','-t','1800','-v','brief').split('\n').filter(l=>/chromium|WebView|crash|IndexedDB|LevelDB|AndroidRuntime/i.test(l)).slice(-120).map(l=>l.slice(0,700)));
  writeFileSync('native-evidence/cold-reopen-diagnostic.json',JSON.stringify(report,null,2));
}
async function migrationInterruptionSuite(oldVersion,initial){
  assert.equal(product,true);assert.equal(integral,true);assert.equal(oldVersion,10004);
  assert.ok(['before-commit','after-commit'].includes(interruptionCut));
  await seedOriginal(oldVersion);
  stage('historical-seed-cold-reopen',{originalBinary:true});
  stop();install(process.env.NEW_APK,['-r']);assert.deepEqual(identity(10005),initial);
  launchOriginal();await connect();
  await until(()=>visible('#vault-password'),'Candidate initial gate missing',45000);
  await diagnostic();const before=await inspectProduct(true);
  assert.equal(before.version,1);assert.equal(before.classification,'complete');assert.equal(before.keys.length,10);assert.equal(before.marker,true);
  assert.match(before.digest,/^[a-f0-9]{64}$/);
  stage('interruption-original-preflight',{version:1,recordCount:10,classification:'complete',physicalSha256:before.digest});
  await writeSyntheticRestoreFile(before.backup);
  await productGate();await privacyProduct();await selectProductFile();
  stage('interruption-picker-reauthenticated');
  await fillMigrationPasswords('synthetic-archive-backup-only');
  const cut=await armMigrationProcessCut(interruptionCut);
  await clickDeferred(productPanel+' form button[type=submit]');
  await nativeConfirm('La copia è stata verificata',true);
  await cut();
  // Cold reopen through actual native authentication, before any diagnostic
  // read. Do not replay a grant, assume rollback or attempt automatic repair.
  assert.deepEqual(identity(10005),initial);
  launchOriginal();
  let coldGate,phase='cold-gate-failed';
  try{
    await connect();
    // Observe the actual protected Root before authentication; neither a
    // password input on setup nor an error surface counts as recovered.
    await until(async()=>foreground()&&await visibleText('Sblocca Registro')&&await visible('#vault-password'),'Cold interruption protected gate missing',45000);
    assert.equal(await visible('[data-testid="header01-topbar"]'),false);
    const reopenedPids=packagePids();
    assert.ok(reopenedPids.length>0,'Relaunched candidate process not observed');
    const trace=await evaluate('JSON.parse(document.querySelector("[data-bootstrap-trace]")?.getAttribute("data-bootstrap-trace")||"null")');
    assert.ok(Array.isArray(trace),'Protected bootstrap trace unavailable');
    assert.ok(trace.every(e=>Number.isInteger(e.attempt)&&typeof e.phase==='string'&&typeof e.code==='string'),'Malformed protected bootstrap trace');
    coldGate={foreground:true,protectedHeading:true,archiveHidden:true,reopenedPids,bootstrapTrace:trace};
    writeFileSync('native-evidence/cold-reopen-gate.json',JSON.stringify(coldGate,null,2));
    phase='cold-authentication-failed';
    await gate('Sblocca Registro');
    phase='cold-archive-ui-failed';
    await ensureHome();await findMarker();
  }catch(error){
    await collectColdInterruptionDiagnostics(before,phase).catch(()=>{});
    throw error;
  }
  // No diagnostics or new navigation until the actual cold Root has
  // authenticated and displayed the retained synthetic class.
  await diagnostic();const recovered=await inspectProduct();
  const expected=interruptionCut==='before-commit'?1:2;
  assert.equal(recovered.version,expected);
  assert.equal(recovered.digest,before.digest);
  assert.deepEqual(recovered.keys,before.keys);assert.deepEqual(recovered.snapshot,before.snapshot);
  assert.equal(recovered.marker,true);
  stage('interruption-reopen-authenticated',{version:expected,recordCount:10,physicalSha256:recovered.digest,logicalSnapshotEqual:true,markerVisible:true,coldGate});
  if(expected===1){
    stop();install(process.env.OLD_APK,['-r','-d']);assert.deepEqual(identity(oldVersion),initial);
    launchOriginal();await gate('Sblocca Registro');await ensureHome();await findMarker();
    stage('interruption-original-reopened',{versionCode:oldVersion,markerVisible:true});
    stop();install(process.env.NEW_APK,['-r']);assert.deepEqual(identity(10005),initial);
    launchOriginal();await connect();await gate('Sblocca Registro');await privacyProduct();
    // New local readback and explicit approval; old process grant is gone.
    await selectProductFile();await submitProduct('synthetic-archive-backup-only',true);
    await gate('Sblocca Registro');await diagnostic();const migrated=await inspectProduct();
    assert.equal(migrated.version,2);assert.equal(migrated.digest,before.digest);assert.deepEqual(migrated.keys,before.keys);assert.deepEqual(migrated.snapshot,before.snapshot);assert.equal(migrated.marker,true);
    stage('interruption-fresh-consent-migrated',{version:2,recordCount:10,physicalSha256:migrated.digest,logicalSnapshotEqual:true,freshFileAndConsent:true});
  }
  stop();install(process.env.OLD_APK,['-r','-d']);assert.deepEqual(identity(oldVersion),initial);
  launchOriginal();await appText('Sicurezza non disponibile');
  assert.ok(!nodes().some(n=>nativeApp(n)&&(/Sblocca Registro|Configura archivio protetto|Le mie classi|Proteggi i dati esistenti/.test(n.text)||n.password)));
  stage('interruption-downgrade-refused',{versionCode:oldVersion,archiveHidden:true});
  stop();install(process.env.NEW_APK,['-r']);assert.deepEqual(identity(10005),initial);
  launchOriginal();await connect();await gate('Sblocca Registro');await ensureHome();await findMarker();
  await diagnostic();const final=await inspectProduct();
  assert.equal(final.version,2);assert.equal(final.digest,before.digest);assert.deepEqual(final.keys,before.keys);assert.deepEqual(final.snapshot,before.snapshot);assert.equal(final.marker,true);
  stage('interruption-final-cold-reopen',{version:2,recordCount:10,physicalSha256:final.digest,logicalSnapshotEqual:true,markerVisible:true});
}
// S-R03b: actual export -> local SAF file -> protected migration ->
// changed destination -> restore of the SAME file. No generated backup or
// adb push in this suite, no native bridge grants issued by the driver.
const backupSavedMessage='Copia di sicurezza salvata e verificata nella cartella scelta.';
const exactProduct=(fresh=false)=>call('__val01ProductInspection','exactSnapshot',fresh);
const localFileBytes=name=>execFileSync('adb',['exec-out','cat','/sdcard/Download/'+name],{timeout:30000});
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
async function exportActualNativeBackup(){
  adb('shell','mkdir','-p','/sdcard/Download');
  const previous=new Set(adb('shell','ls','-1','/sdcard/Download').split('\n').filter(Boolean));
  const form='form:has(input[placeholder="Inserisci password sicura (min. 6 caratteri)"])';
  await until(()=>visible(form),'Actual Privacy export form absent',45000);
  await evaluate('(()=>{const f='+query(form)+';const fields=[...f.querySelectorAll("input[type=password]")];if(fields.length!==2)throw Error("Expected two export credentials");const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set;for(const field of fields){set.call(field,"synthetic-archive-backup-only");field.dispatchEvent(new Event("input",{bubbles:true}));}return true})()');
  await clickDeferred(form+' button[type=submit]');
  await downloads();
  tap(await find(n=>doc(n)&&n.enabled&&/^(save|salva)$/i.test(n.text),'Native export Save missing'));
  await until(foreground,'SAF destination picker did not return',30000);
  await until(()=>visible('#vault-password'),'Export chooser did not require reauthentication',45000);
  assert.equal(await visible('[data-testid="header01-topbar"]'),false);
  await gate('Sblocca Registro',vaultPassword,backupSavedMessage);
  await nativeConfirm(backupSavedMessage,true);
  const name=await until(()=>{
    const files=adb('shell','ls','-1','/sdcard/Download').split('\n').filter(x=>!previous.has(x)&&/^Backup_Cifrato_GDPR_\d{4}-\d{2}-\d{2}\.enc\.json$/.test(x));
    assert.ok(files.length<=1,'Ambiguous actual SAF output');
    return files[0]||null;
  },'Actual exported file not present in Downloads',30000);
  const bytes=localFileBytes(name);
  assert.ok(bytes.length>0&&bytes.length<=32*1024*1024);
  return {name,bytes,digest:sha256(bytes)};
}
async function realBackupSuite(oldVersion,initial){
  assert.equal(integral,true);assert.equal(product,true);assert.equal(oldVersion,10004);
  await seedOriginal(oldVersion);
  stage('historical-seed-cold-reopen',{originalBinary:true});
  stop();install(process.env.NEW_APK,['-r']);assert.deepEqual(identity(10005),initial);
  launchOriginal();await connect();
  await until(()=>visible('#vault-password'),'Candidate initial gate missing',45000);
  await diagnostic();
  const original=await exactProduct();
  assert.equal(original.version,1);assert.equal(original.keys.length,10);
  assert.ok(original.snapshot.appData.classes.some(c=>c.name===marker));
  stage('sr03b-original-db1',{version:1,recordCount:10,physicalSha256:original.digest});
  await productGate();await privacyProduct();
  const file=await exportActualNativeBackup();
  await diagnostic();
  const decoded=await call('__val01ProductInspection','decodeActualBackup',file.bytes.toString('utf8'));
  assert.equal(decoded.app,'registro-docente');assert.equal(decoded.backupDataVersion,6);
  assert.deepEqual(decoded.snapshot.meta,{changes:0,lastBackup:decoded.exportedAt});
  assert.deepEqual(decoded.snapshot,{...original.snapshot,meta:decoded.snapshot.meta});
  const exported=await exactProduct();
  const receipt=exported.snapshot.meta;
  assert.equal(exported.version,1);assert.equal(exported.keys.length,10);
  assert.deepEqual({...exported.snapshot,meta:original.snapshot.meta},original.snapshot);
  assert.equal(receipt.changes,0);
  assert.equal(receipt.lastBackup,decoded.exportedAt);
  assert.equal(receipt.verifiedBackupAt,decoded.exportedAt);
  assert.deepEqual(receipt.verifiedBackupEvidence,{bytes:file.bytes.length,sha256:file.digest,source:'android-readback',payloadVersion:6,checkpointAt:decoded.exportedAt});
  stage('sr03b-actual-export-verified',{bytes:file.bytes.length,sha256:file.digest,payloadVersion:6,recordCount:10,exactSnapshotEqual:true,nativeReceiptEqual:true,reauthenticated:true});
  await productGate();await privacyProduct();await selectProductFile(false,file.name);
  await submitProduct('synthetic-archive-backup-only',true);
  assert.equal(await visible('[data-testid="header01-topbar"]'),false);
  await gate('Sblocca Registro');await diagnostic();
  const migrated=await exactProduct();
  assert.equal(migrated.version,2);assert.equal(migrated.digest,exported.digest);
  assert.deepEqual(migrated.keys,exported.keys);assert.deepEqual(migrated.snapshot,exported.snapshot);
  stage('sr03b-same-file-migrated',{version:2,recordCount:10,sha256:file.digest,physicalSha256:migrated.digest,exactSnapshotEqual:true,reauthenticated:true});
  stop();launchOriginal();await connect();
  await until(()=>visible('#vault-password'),'Cold migration gate absent',45000);
  assert.equal(await visible('[data-testid="header01-topbar"]'),false);
  await gate('Sblocca Registro');await diagnostic();
  const cold=await exactProduct();
  assert.equal(cold.digest,migrated.digest);assert.deepEqual(cold.snapshot,migrated.snapshot);
  stage('sr03b-migration-cold-reopen',{physicalSha256:cold.digest,exactSnapshotEqual:true,reauthenticated:true});
  // Change real data via the product UI, not a fixture-created restore file.
  await productGate();await ensureHome();
  const changedName='Collaudo recupero SR03';
  tap(await appButton('Nuova Classe'));
  await appText('Inserisci la denominazione della nuova classe');
  await uiDriver.enterClassName(changedName);await uiDriver.submitClass(changedName);
  await until(()=>nodes().some(n=>named(n,'Gestione Elenco Alunni: '+changedName)),'New synthetic class was not committed',30000);
  await diagnostic();
  const changed=await exactProduct();
  assert.equal(changed.version,2);assert.notEqual(changed.digest,migrated.digest);
  assert.equal(changed.snapshot.appData.classes.length,decoded.snapshot.appData.classes.length+1);
  assert.ok(changed.snapshot.appData.classes.some(c=>c.name===changedName));
  stage('sr03b-destination-changed',{physicalSha256:changed.digest,distinctData:true});
  productPanel='section[aria-label="Ripristino protetto archivio"]';
  await productGate();await privacyProduct();await selectProductFile(false,file.name);
  await submitRestore('synthetic-archive-backup-only',true);
  await gate('Sblocca Registro');await diagnostic();
  const restored=await exactProduct();
  assert.equal(restored.version,2);assert.equal(restored.keys.length,10);
  assert.notEqual(restored.digest,changed.digest);assert.deepEqual(restored.snapshot,decoded.snapshot);
  stage('sr03b-same-file-restored',{version:2,recordCount:10,sha256:file.digest,physicalSha256:restored.digest,exactSnapshotEqual:true,reauthenticated:true,localReceiptNotImported:true});
  stop();launchOriginal();await connect();
  await until(()=>visible('#vault-password'),'Cold restore gate absent',45000);
  assert.equal(await visible('[data-testid="header01-topbar"]'),false);
  await gate('Sblocca Registro');await diagnostic();
  const final=await exactProduct();
  assert.equal(final.digest,restored.digest);assert.deepEqual(final.snapshot,decoded.snapshot);
  stage('sr03b-restore-cold-reopen',{physicalSha256:final.digest,exactSnapshotEqual:true,reauthenticated:true});
  const finalFile=localFileBytes(file.name);assert.deepEqual(finalFile,file.bytes);
  stage('sr03b-external-file-preserved',{bytes:finalFile.length,sha256:sha256(finalFile)});
}

// S-R04b: isolated CI emulator only. Simulate a replacement installation
// by uninstalling the test package and installing the same candidate anew.
// External SAF bytes remain the only recovery input. The source snapshot is
// retained only in the driver as a comparison oracle, never sent to the app.
const recoveryCredential='synthetic-new-password';
const restoreErrorMessage='Ripristino non completato. Controlla il file e la password.';
const restoreSuccessMessage='Backup cifrato verificato e ripristinato con successo!';
const restoreConsentMessage='Il ripristino sostituirà i dati del Registro con quelli della copia di sicurezza. Vuoi continuare?';
async function setupRecoveryDb1(){
  await waitText('Configura archivio protetto');
  await domClick('input[name="archive-mode"][value="professional"]');
  await until(()=>visible('#vault-password'),'Fresh professional form absent',15000);
  const profile={'Istituto':'Synthetic recovery school','Anno scolastico':'2026/2027','Docente':'Synthetic recovery teacher','Disciplina':'Tecnologia'};
  await evaluate('(()=>{const values='+JSON.stringify(profile)+';const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set;for(const [label,value] of Object.entries(values)){const l=[...document.querySelectorAll("label")].find(e=>e.childNodes[0]?.textContent.trim()===label);const input=l?.querySelector("input");if(!input)throw Error("Profile field missing");set.call(input,value);input.dispatchEvent(new Event("input",{bubbles:true}));}return true})()');
  await evaluate('(()=>{document.querySelector("#vault-password").scrollIntoView({block:"center"});return true})()');
  await gate('Crea il mio registro',recoveryCredential);
}
async function recoveryFromPrivacy(name,copyPassword,approve){
  const form='form:has(input[placeholder="Inserisci la password impostata alla cifratura"])';
  await until(()=>visible(form),'Ordinary native restore form missing',45000);
  await evaluate('(()=>{const f='+query(form)+';const field=f.querySelector("input[type=password]");if(!field)throw Error("Restore password field missing");Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(field,'+JSON.stringify(copyPassword)+');field.dispatchEvent(new Event("input",{bubbles:true}));return true})()');
  await clickDeferred(form+' button[type=submit]');
  await downloads();
  tap(await find(n=>doc(n)&&n.text===name&&!/preview|anteprima/i.test(n.desc),'Actual recovery file title missing'));
  await until(()=>foreground()||nodes().some(n=>doc(n)&&/^(open|apri)$/i.test(n.text)),'Fresh recovery file selection did not return',20000);
  if(!foreground())tap(await find(n=>doc(n)&&/^(open|apri)$/i.test(n.text),'Native Open confirmation absent'));
  await until(foreground,'Fresh recovery picker did not return',30000);
  await until(()=>visible('#vault-password'),'Fresh recovery picker did not require reauthentication',45000);
  assert.equal(await visible('[data-testid="header01-topbar"]'),false);
  await gate('Sblocca Registro',recoveryCredential,approve===null?restoreErrorMessage:restoreConsentMessage);
  if(approve===null)await nativeConfirm(restoreErrorMessage,true);
  else{
    await nativeConfirm(restoreConsentMessage,approve);
    if(approve)await nativeConfirm(restoreSuccessMessage,true);
  }
  await until(()=>evaluate('(()=>{const f='+query(form)+';const b=f?.querySelector("button[type=submit]");return !!b&&!b.disabled})()'),'Restore form did not settle',30000);
}
async function freshRecoverySuite(oldVersion,initial){
  assert.equal(integral,true);assert.equal(product,true);assert.equal(oldVersion,10004);
  assert.equal(process.env.GITHUB_ACTIONS,'true');
  assert.ok(adb('shell','getprop','ro.kernel.qemu')==='1'||adb('shell','getprop','ro.boot.qemu')==='1');
  await seedOriginal(oldVersion);
  stage('historical-seed-cold-reopen',{originalBinary:true});
  stop();install(process.env.NEW_APK,['-r']);assert.deepEqual(identity(10005),initial);
  launchOriginal();await connect();
  await until(()=>visible('#vault-password'),'Candidate initial gate missing',45000);
  await diagnostic();
  const source=await exactProduct();
  assert.equal(source.version,1);assert.equal(source.keys.length,10);
  assert.ok(source.snapshot.appData.classes.some(c=>c.name===marker));
  await productGate();await privacyProduct();
  const file=await exportActualNativeBackup();
  await diagnostic();
  const decoded=await call('__val01ProductInspection','decodeActualBackup',file.bytes.toString('utf8'));
  assert.equal(decoded.app,'registro-docente');assert.equal(decoded.backupDataVersion,6);
  assert.deepEqual(decoded.snapshot.meta,{changes:0,lastBackup:decoded.exportedAt});
  assert.deepEqual(decoded.snapshot,{...source.snapshot,meta:decoded.snapshot.meta});
  const exported=await exactProduct();
  assert.deepEqual(exported.snapshot.meta.verifiedBackupEvidence,{bytes:file.bytes.length,sha256:file.digest,source:'android-readback',payloadVersion:6,checkpointAt:decoded.exportedAt});
  stage('sr04b-source-export',{sha256:file.digest,bytes:file.bytes.length,payloadVersion:6,recordCount:10,exactSnapshotEqual:true,nativeReceiptEqual:true});
  // Only the disposable emulator package is removed. No app data copied,
  // no backup injected, no host restore, and no external file rewritten.
  stop();
  assert.equal(adb('uninstall',pkg),'Success');
  assert.ok(!adb('shell','pm','list','packages').split('\n').includes('package:'+pkg));
  assert.deepEqual(localFileBytes(file.name),file.bytes);
  install(process.env.NEW_APK);identity(10005);
  launchOriginal();await connect();
  await waitText('Configura archivio protetto');
  assert.equal(await visible('[data-testid="header01-topbar"]'),false);
  const absence=await evaluate('(async()=>({dbs:(await indexedDB.databases()).filter(d=>d.name==="registro-docente-secure-vault").length,marker:localStorage.getItem("registro_archive_established_v1")}))()');
  assert.deepEqual(absence,{dbs:0,marker:null});
  stage('sr04b-clean-installation',{archiveAbsent:true,markerAbsent:true,protectedGate:true,sha256:sha256(localFileBytes(file.name))});
  await setupRecoveryDb1();
  await diagnostic();
  const empty=await exactProduct(true);
  assert.equal(empty.version,1);assert.equal(empty.keys.length,10);
  assert.deepEqual(empty.snapshot.appData.classes,[]);
  assert.equal(empty.snapshot.settings.archiveMode,'professional');
  assert.deepEqual(empty.snapshot.meta,{changes:0,lastBackup:null});
  assert.notEqual(empty.digest,exported.digest);
  stage('sr04b-new-local-archive',{version:1,recordCount:10,physicalSha256:empty.digest,emptyProfessional:true,newCredential:true});
  // Navigate explicitly and authenticate using the new device credential.
  const openFresh=async()=>{
    await navigateProduct('/index.html','!!document.querySelector("#vault-password")');
    await gate('Sblocca Registro',recoveryCredential);
    await privacyProduct();
  };
  await openFresh();
  await recoveryFromPrivacy(file.name,'wrong-synthetic-copy-password',null);
  await diagnostic();
  assert.deepEqual(await exactProduct(true),empty);
  stage('sr04b-wrong-copy-rejected',{physicalSha256:empty.digest,unchanged:true,reauthenticated:true});
  await openFresh();
  await recoveryFromPrivacy(file.name,'synthetic-archive-backup-only',false);
  await diagnostic();
  assert.deepEqual(await exactProduct(true),empty);
  stage('sr04b-refusal-preserves-destination',{physicalSha256:empty.digest,unchanged:true,reauthenticated:true});
  await openFresh();
  await recoveryFromPrivacy(file.name,'synthetic-archive-backup-only',true);
  await diagnostic();
  const restored=await exactProduct(true);
  assert.equal(restored.version,1);assert.equal(restored.keys.length,10);
  assert.notEqual(restored.digest,empty.digest);
  assert.deepEqual(restored.snapshot,decoded.snapshot);
  assert.ok(restored.snapshot.appData.classes.some(c=>c.name===marker));
  assert.equal(restored.snapshot.meta.verifiedBackupAt,undefined);
  assert.equal(restored.snapshot.meta.verifiedBackupEvidence,undefined);
  stage('sr04b-same-file-restored',{version:1,recordCount:10,sha256:file.digest,physicalSha256:restored.digest,exactSnapshotEqual:true,localReceiptNotImported:true,newCredential:true});
  stop();launchOriginal();await connect();
  await until(()=>visible('#vault-password'),'Fresh restored cold gate absent',45000);
  assert.equal(await visible('[data-testid="header01-topbar"]'),false);
  await gate('Sblocca Registro',recoveryCredential);await ensureHome();await findMarker();
  await diagnostic();
  assert.deepEqual(await exactProduct(true),restored);
  stage('sr04b-restored-cold-reopen',{physicalSha256:restored.digest,exactSnapshotEqual:true,protectedGate:true,newCredential:true});
  const external=localFileBytes(file.name);
  assert.deepEqual(external,file.bytes);
  stage('sr04b-external-file-preserved',{bytes:external.length,sha256:sha256(external)});
}

async function productSuite(oldVersion,initial){
  assert.equal(integral,true);
  await seedOriginal(oldVersion);
  stage('historical-seed-cold-reopen',{originalBinary:true});
  stop();install(process.env.NEW_APK,['-r']);assert.deepEqual(identity(10005),initial);
  launchOriginal();await connect();
  await until(()=>visible('#vault-password'),'Candidate initial gate missing',45000);
  await diagnostic();
  const before=await inspectProduct(true);
  assert.equal(before.version,1);assert.equal(before.marker,true);
  const negative=oldVersion===10002;
  assert.equal(before.classification,negative?'incomplete':'complete');
  if(negative)assert.deepEqual(before.keys,['appData','meta']);
  else assert.equal(before.keys.length,10);
  assert.match(before.digest,/^[a-f0-9]{64}$/);
  assert.equal(typeof before.backup,'string');
  stage('product-local-preflight',{classification:before.classification,recordCount:before.keys.length});
  const dir=mkdtempSync(join(tmpdir(),'val01-product-'));
  try{
    const file=join(dir,filename);
    writeFileSync(file,before.backup,{mode:0o600});
    adb('shell','mkdir','-p','/sdcard/Download');
    adb('push',file,'/sdcard/Download/'+filename);
    // Refresh DocumentsUI's local provider index; never download or expose a copy.
    adb('shell','am','broadcast','-a','android.intent.action.MEDIA_SCANNER_SCAN_FILE','-d','file:///sdcard/Download/'+filename);
    const local=execFileSync('adb',['exec-out','cat','/sdcard/Download/'+filename],{timeout:30000});
    assert.equal(local.toString('utf8'),before.backup);
  }finally{rmSync(dir,{recursive:true,force:true});}
  await productGate();await privacyProduct();
  if(negative){
    await selectProductFile();
    await submitProduct('synthetic-archive-backup-only',null);
    await assertUnchanged(before);
    stage('product-incomplete-refused',{classification:'incomplete',physicalSha256:before.digest});
    stop();install(process.env.OLD_APK,['-r','-d']);assert.deepEqual(identity(oldVersion),initial);
    launchOriginal();await gate('Sblocca Registro');await ensureHome();await findMarker();
    stage('product-unsupported-original-reopen');return;
  }
  await selectProductFile(true);
  assert.equal(await visible(productPanel+' input[type=password]'),false);
  stage('product-picker-cancel-reauthenticated');
  await selectProductFile();
  stage('product-picker-read-reauthenticated');
  // After a delivered file, any later Android epoch must discard it.
  adb('shell','input','keyevent','3');
  await until(()=>!foreground(),'Candidate did not leave foreground',15000);
  launchOriginal();
  await until(()=>visible('#vault-password'),'Background did not lock candidate',45000);
  await gate('Sblocca Registro');
  await until(()=>visible(productPanel),'Privacy not retained after native suspension',15000);
  await until(async()=>!(await visible(productPanel+' input[type=password]')),'Stale selected file survived native epoch',15000);
  stage('product-background-revokes-selection');
  await selectProductFile();
  await submitProduct('wrong-synthetic',null);
  await assertUnchanged(before);
  stage('product-wrong-copy-no-change');
  await productGate();await privacyProduct();await selectProductFile();
  await submitProduct('synthetic-archive-backup-only',false);
  await assertUnchanged(before);
  stage('product-refusal-no-change');
  await productGate();await privacyProduct();await selectProductFile();
  await submitProduct('synthetic-archive-backup-only',true);
  assert.equal(await visible('[data-testid="header01-topbar"]'),false);
  await gate('Sblocca Registro');
  await ensureHome();await findMarker();
  await diagnostic();
  const after=await inspectProduct();
  assert.equal(after.version,2);assert.equal(after.classification,'existing-v2');
  assert.equal(after.digest,before.digest);assert.deepEqual(after.keys,before.keys);
  assert.deepEqual(after.snapshot,before.snapshot);assert.equal(after.marker,true);
  stage('product-authorized-migration-reauthenticated');
  stop();launchOriginal();await connect();await gate('Sblocca Registro');
  await ensureHome();await findMarker();
  await diagnostic();
  const cold=await inspectProduct();
  assert.equal(cold.version,2);assert.equal(cold.digest,before.digest);
  assert.deepEqual(cold.snapshot,before.snapshot);
  stage('product-v2-cold-reopen');
  stop();install(process.env.OLD_APK,['-r','-d']);assert.deepEqual(identity(oldVersion),initial);
  launchOriginal();await appText('Sicurezza non disponibile');
  assert.ok(!nodes().some(n=>nativeApp(n)&&(/Sblocca Registro|Configura archivio protetto|Le mie classi|Proteggi i dati esistenti/.test(n.text)||n.password)));
  tap(await appButton('Riprova controllo sicurezza'));await appText('Sicurezza non disponibile');
  stage('product-original-downgrade-refused');
  stop();install(process.env.NEW_APK,['-r']);assert.deepEqual(identity(10005),initial);
  launchOriginal();await connect();await gate('Sblocca Registro');await ensureHome();await findMarker();
  await diagnostic();const final=await inspectProduct();
  assert.equal(final.version,2);assert.equal(final.digest,before.digest);assert.deepEqual(final.snapshot,before.snapshot);
  stage('product-reupgrade-archive-intact');
  if(db2Lifecycle)await productLifecycleSuite(oldVersion,initial,final);
}
try{
  verifyOriginalUiRecognition();
  verifyDemoSelectionRecognition();
  assert.equal(process.env.GITHUB_ACTIONS,'true');
  assert.ok(adb('shell','getprop','ro.kernel.qemu')==='1'||adb('shell','getprop','ro.boot.qemu')==='1');
  assert.ok(api===32||api===36);assert.equal(adb('shell','getprop','ro.build.version.sdk'),String(api));
  assert.ok(!adb('shell','pm','list','packages').split('\n').includes('package:'+pkg));
  const oldVersion=Number(process.env.OLD_VERSION);
  install(process.env.OLD_APK);
  const initial=identity(oldVersion);
  if(smoke){
    assert.equal(integral,true);assert.equal(product,true);assert.equal(oldVersion,10004);
    assert.equal(db2Lifecycle,false);assert.equal(interruptionCut,'');assert.ok(!process.env.NEW_APK,'Smoke must not have a candidate APK');
    await seedOriginal(oldVersion);
    assert.deepEqual(identity(oldVersion),initial);
    assert.ok(!socket,'Historical smoke must not use DevTools');
    stage('smoke-original-installation-preserved',{sameUid:true,sameFirstInstall:true,versionCode:oldVersion,noCandidateInstall:true});
  }else if(product){if(freshRecovery)await freshRecoverySuite(oldVersion,initial);else if(realBackup)await realBackupSuite(oldVersion,initial);else if(interruptionCut)await migrationInterruptionSuite(oldVersion,initial);else await productSuite(oldVersion,initial);}
  else{
  let seed;
  if(integral){
    await seedOriginal(oldVersion);
    stage('historical-seed-cold-reopen',{originalBinary:true});
    stop();install(process.env.NEW_APK,['-r']);assert.deepEqual(identity(10005),initial);
    await launch('__val01NativeLab');
    const inventory=await lab('probeHistoricalArchive');
    writeFileSync('native-evidence/original-db1-inventory.json',JSON.stringify(inventory,null,2));
    console.log('original-db1-inventory',JSON.stringify(inventory));
    assert.equal(inventory.version,1,'Historical database must remain DB1');
    assert.equal(inventory.authentication,'accepted','Historical vault authentication failed');
    assert.deepEqual(inventory.failed,[],'Encrypted record authentication failed');
    assert.equal(inventory.marker,true,'Historical synthetic marker absent');
    if(oldVersion===10002){
      // Explicit approved support policy: retired RC2 is a negative case,
      // not a successful migration. Must prove rejection and intact DB1.
      assert.equal(inventory.metadata,'ACTIVE');
      assert.deepEqual(inventory.present,['appData','meta']);
      assert.deepEqual(inventory.authenticated,inventory.present);
      assert.equal(inventory.missing.length,8);
      const before=await lab('historicalFingerprint');
      assert.match(before,/^[a-f0-9]{64}$/);
      assert.deepEqual(await lab('rejectSparseFence'),{blocked:true,guardReached:false});
      assert.equal(await candidate('version'),1);
      assert.equal(await lab('historicalFingerprint'),before);
      assert.deepEqual(await lab('probeHistoricalArchive'),inventory);
      stage('unsupported-sparse-archive-refused-without-mutation',{qualification:'negative-only',present:inventory.present,missing:inventory.missing,physicalSha256:before});
      stop();install(process.env.OLD_APK,['-r','-d']);assert.deepEqual(identity(oldVersion),initial);
      launchOriginal();await gate('Sblocca Registro');await ensureHome();await findMarker();
      stage('unsupported-sparse-original-reopen',{qualification:'negative-only'});
    }else{
      assert.ok(oldVersion===10003||oldVersion===10004,'Unrecognized integral predecessor');
      assert.equal(inventory.missing.length,0,'Supported historical DB1 has missing physical records; no migration allowed');
      seed=await lab('inspectHistoricalArchive');
      assert.equal(seed.physical.keys.length,10);
    }
  }else{
    await launch('__val01FenceHistorical');
    seed=await old('seed',false);
    assert.equal(seed.physical.keys.length,10);
    stop();await launch('__val01FenceHistorical');
    assert.deepEqual(await old('open'),{snapshot:seed.snapshot,physical:seed.physical});
    stage('historical-seed-cold-reopen');
    stop();install(process.env.NEW_APK,['-r']);assert.deepEqual(identity(10005),initial);
    await launch('__val01NativeLab');
  }
  if(!(integral&&oldVersion===10002)){
  assert.equal(await candidate('version'),1);
  assert.equal(await lab('ready'),true);
  const write=lab('write',seed.backup);write.catch(()=>{});
  await downloads();tap(await find(n=>doc(n)&&/^(save|salva)$/i.test(n.text),'Save absent'));
  assert.equal(await write,'verified');
  const bytes=execFileSync('adb',['exec-out','cat','/sdcard/Download/'+filename],{timeout:30000});
  assert.equal(bytes.toString('utf8'),seed.backup);
  const hash=createHash('sha256').update(bytes).digest('hex');
  stage('native-saf-write-readback',{bytes:bytes.length,sha256:hash});
  stop();await launch('__val01NativeLab');assert.equal(await lab('ready'),true);
  await startRead();adb('shell','input','keyevent','4');
  assert.equal((await readResult()).phase,'cancelled');assert.equal(await candidate('version'),1);
  stage('native-picker-cancel-no-migration');
  const denied=await pickerRead(true);
  assert.equal(denied.phase,'authorization-rejected');assert.equal(denied.sha256,hash);assert.equal(denied.bytes,bytes.length);assert.equal(await candidate('version'),1);
  stage('native-wrong-copy-password-no-migration');
  const selected=await pickerRead();assert.equal(selected.phase,'authorized');
  const grant=selected.grant;
  assert.equal(grant.sha256,hash);assert.equal(grant.bytes,bytes.length);assert.equal(grant.payloadVersion,6);
  assert.equal(await candidate('version'),1);
  assert.equal(await lab('migrate',false),'rejected');assert.equal(await candidate('version'),1);
  stage('native-explicit-refusal-no-migration');
  const fresh=await pickerRead();assert.equal(fresh.phase,'authorized');assert.deepEqual(fresh.grant,grant);
  assert.equal(await lab('migrate',true),'accepted');
  assert.equal(await candidate('version'),2);
  assert.equal(await lab('migrate',true),'rejected');
  assert.deepEqual(await candidate('open'),{snapshot:seed.snapshot,physical:seed.physical});
  stage('native-authorized-migration-and-replay-rejection');
  stop();await launch('__val01NativeLab');
  assert.deepEqual(await candidate('open'),{snapshot:seed.snapshot,physical:seed.physical});
  stage('native-v2-cold-reopen');
  stop();install(process.env.OLD_APK,['-r','-d']);assert.deepEqual(identity(oldVersion),initial);
  if(integral){
    launchOriginal();
    await appText('Sicurezza non disponibile');
    assert.ok(!nodes().some(n=>nativeApp(n)&&(/Sblocca Registro|Configura archivio protetto|Le mie classi|Proteggi i dati esistenti/.test(n.text)||n.password)));
    tap(await appButton('Riprova controllo sicurezza'));
    await appText('Sicurezza non disponibile');
    stage('original-downgrade-ui-fail-closed');
  }else{
    await launch('__val01FenceHistorical');
    for(const m of ['read','unlock','write','delete','clear','initialize'])assert.equal(await hist(m),'VersionError',m);
    stage('native-in-place-downgrade-all-six-operations-rejected');
  }
  stop();install(process.env.NEW_APK,['-r']);assert.deepEqual(identity(10005),initial);
  await launch('__val01NativeLab');
  assert.deepEqual(await candidate('open'),{snapshot:seed.snapshot,physical:seed.physical});
  stage('native-reupgrade-archive-intact');
  }
  }
}catch(e){
  writeFileSync('native-evidence/failure.txt',String(e));
  process.exitCode=1;
  console.error(e.message);
  try{writeFileSync('native-evidence/synthetic-ui.json',JSON.stringify(nodes().map(n=>n.password?{...n,text:'[redacted]',desc:'[redacted]'}:n),null,2));}catch{}
  try{writeFileSync('native-evidence/foreground.txt',adb('shell','dumpsys','activity','activities'));}catch{}
}finally{
  // Bound the diagnostic itself even if a DevTools socket never closes.
  socket?.close();for(const p of pending.values())clearTimeout(p.timer);pending.clear();
  process.exit(process.exitCode||0);
}
