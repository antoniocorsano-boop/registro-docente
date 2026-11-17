// Synthetic CI emulator only. No production package or device.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync,writeFileSync,mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const integral=process.env.VAL01_INTEGRAL==='true';
const product=process.env.VAL01_PRODUCT==='true';
const db2Lifecycle=process.env.VAL01_DB2_LIFECYCLE==='true';
const api=product?Number(process.env.VAL01_API):36;
const pkg=integral?'it.trama.registrodocente':'it.trama.registrodocente.lab.val01';
const adb=(...args)=>execFileSync('adb',args,{encoding:'utf8',timeout:30000}).trim();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const evidence=[];
mkdirSync('native-evidence',{recursive:true});
function stage(name,details={}){
  evidence.push({stage:name,status:'PASS',...details});
  writeFileSync('native-evidence/result.json',JSON.stringify({candidate:process.env.CANDIDATE_SHA,predecessor:process.env.HISTORICAL_SHA,api,scope:product?'original historical APK; actual candidate Root/App/Privacy; synthetic emulator only':integral?'original historical unsigned APK re-signed in CI, candidate laboratory APK':'laboratory APKs, exact historical storage source, candidate native bridge',qualification:integral?(Number(process.env.OLD_VERSION)===10002?'negative-only':'supported-migration'):'complete-storage-laboratory',productionRelease:false,results:evidence},null,2));
  console.log(name,'PASS');
}
async function until(fn,label,ms=30000){
  const end=Date.now()+ms;
  while(Date.now()<end){try{const v=await fn();if(v)return v;}catch{}await sleep(500);}
  throw Error(label);
}
let socket,seq=0;
const pending=new Map();
async function connect(){
  socket=await until(async()=>{
    const pid=adb('shell','pidof',pkg).split(/\s+/)[0];
    if(!/^\d+$/.test(pid))return null;
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
function evaluate(expression,timeout=15000){
  const id=++seq;
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{pending.delete(id);reject(Error('WebView evaluation timeout'));},timeout);
    pending.set(id,{timer,resolve:r=>resolve(r.result.value),reject});
    socket.send(JSON.stringify({id,method:'Runtime.evaluate',params:{expression,awaitPromise:true,returnByValue:true}}));
  });
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
  return [...xml.matchAll(/<node\b[^>]*>/g)].map(m=>{
    const s=m[0],get=k=>s.match(new RegExp('\\b'+k+'="([^"]*)"'))?.[1]||'';
    return {text:get('text'),desc:get('content-desc'),pkg:get('package'),id:get('resource-id'),clickable:get('clickable')==='true',enabled:get('enabled')==='true',focused:get('focused')==='true',clazz:get('class'),password:get('password')==='true',bounds:s.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/)?.slice(1).map(Number)};
  });
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
  return adb('shell','dumpsys','activity','activities').split('\n').some(s=>/topResumedActivity|mResumedActivity/.test(s)&&s.includes(pkg+'/'));
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
const vaultField=n=>nativeApp(n)&&n.id==='vault-password'&&n.clazz==='android.widget.EditText'&&n.password;
const passwordRejected=view=>view.some(n=>nativeApp(n)&&n.text==='Password errata o metadata del vault manomesso.');
// UIAutomator may mask password text on older WebView/Android releases.
// Accept only an exact value or a full-length mask, and require the ordinary
// vault authentication plus independent cold reopen with the same fixture
// credential. Never submit an unverified, partial or empty field.
const passwordEmpty=n=>!n.text||n.text==='Password locale';
const passwordEvidence=(n,credential)=>n.text===credential?'exact':
  /^[•●*]+$/u.test(n.text)&&[...n.text].length===credential.length?'masked-length':null;
async function enterSyntheticPassword(credential=vaultPassword){
  for(let attempt=1;attempt<=3;attempt++){
    const field=await find(vaultField,'Original vault password field missing');
    tap(field);
    await until(()=>nodes().some(n=>vaultField(n)&&n.focused),'Password field not focused',15000);
    let current=await find(n=>vaultField(n)&&n.focused,'Password field focus lost');
    if(!passwordEmpty(current)){
      // MOVE_END followed by bounded Delete events works on API32 and API36;
      // avoid input keycombination, which is not portable to API32.
      adb('shell','input','keyevent','123');
      adb('shell','input','keyevent',...Array(96).fill('67'));
      current=await find(n=>vaultField(n)&&n.focused&&passwordEmpty(n),'Password field not empty');
    }
    // Verify the focused field immediately before injection, not just the
    // initially tapped element. Retry input only; no authentication retries.
    if(!current.focused)continue;
    inputText(credential);
    let verified;
    try{verified=await until(()=>nodes().find(n=>vaultField(n)&&passwordEvidence(n,credential)),'Synthetic password input differs from expected',5000);}
    catch{console.log('synthetic-password-entry-retry',attempt);continue;}
    // Keyboard dismissal must not navigate or clear the password.
    hideKeyboard();
    try{
      const final=await until(()=>nodes().find(n=>vaultField(n)&&passwordEvidence(n,credential)),'Synthetic password changed before submit',5000);
      console.log('synthetic-password-evidence',passwordEvidence(final,credential));
      return;
    }catch{console.log('synthetic-password-focus-retry',attempt);}
  }
  throw Error('Synthetic password input could not be attested; no authentication submitted');
}
async function gate(action,credential=vaultPassword){
  await enterSyntheticPassword(credential);
  console.log('original-gate-input-verified',action);
  tap(await appButton(action));
  const outcome=await until(()=>{
    const view=nodes();
    if(passwordRejected(view))return 'rejected';
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
  if(version!==10002){tap(await appText('Ambiente dimostrativo'));await gate('Avvia la prova');}
  else await gate('Configura archivio protetto');
  await appText('Le mie classi');await uiCheckpoint('initial-home');
  tap(await appButton('Nuova Classe'));
  await appText('Inserisci la denominazione della nuova classe');
  tap(await appEdit());inputText(marker);
  await until(()=>nodes().some(n=>nativeApp(n)&&n.clazz==='android.widget.EditText'&&n.text===marker),'Class prompt value not entered exactly',15000);
  hideKeyboard();tap(await appButton('OK'));
  // Verify that the app actually left the prompt and committed/navigated.
  await until(()=>originalClassCreated(nodes()),'Post-commit class management headings not observed in original UI',30000);
  await uiCheckpoint('class-created');
  await ensureHome();await uiCheckpoint('home-after-create');await findMarker();
  console.log('original-class-visible-before-restart');
  stop();launchOriginal();
  try{await gate('Sblocca Registro');}catch(e){
    // Preserve failed original UI before optional read-only diagnostic.
    await uiCheckpoint('authentication-failed').catch(()=>{});
    // Do not turn an original unlock failure into a PASS. The isolated candidate
    // may only authenticate the existing DB1 with the same synthetic credential.
    // No migration, no reset, no recovery attempt and no password guessing.
    if(!product&&String(e).includes('Original authentication rejected')){
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
async function selectProductFile(cancel=false){
  // The click invokes the actual React handler, not a fixture API.
  await domClick(productPanel+' > button');
  await downloads();
  if(cancel)await cancelProductPicker();
  else{
    const row=await find(n=>doc(n)&&n.text===filename&&!/preview|anteprima/i.test(n.desc),'Candidate encrypted file title absent');
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
  await enterSyntheticPassword(freshPassword);
  tap(await appButton('Crea il mio registro'));
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
  assert.equal(process.env.GITHUB_ACTIONS,'true');
  assert.ok(adb('shell','getprop','ro.kernel.qemu')==='1'||adb('shell','getprop','ro.boot.qemu')==='1');
  assert.ok(api===32||api===36);assert.equal(adb('shell','getprop','ro.build.version.sdk'),String(api));
  assert.ok(!adb('shell','pm','list','packages').split('\n').includes('package:'+pkg));
  const oldVersion=Number(process.env.OLD_VERSION);
  install(process.env.OLD_APK);
  const initial=identity(oldVersion);
  if(product){await productSuite(oldVersion,initial);}
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
