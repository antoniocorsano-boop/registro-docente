// Exact APK diagnostic, isolated emulator only; no user data, no app code changes.
import { execFileSync } from 'node:child_process';
import { createHash, webcrypto } from 'node:crypto';
import { writeFileSync, mkdirSync } from 'node:fs';
const pkg = process.env.LAB_PACKAGE;
const api = Number(process.env.LAB_API);
if (pkg !== 'it.trama.registrodocente.lab.b43' || api!==36) throw new Error('Not an isolated emulator diagnostic');
const adb = (...args) => execFileSync('adb', args, { encoding:'utf8', timeout:30000 }).trim();
const sleep = ms => new Promise(r=>setTimeout(r,ms));
const evidence = [];
mkdirSync('native-evidence',{recursive:true});
function record(stage, status, details={}) {
  evidence.push({stage,status,...details});
  writeFileSync('native-evidence/backup-result.json',JSON.stringify({sourceSha:process.env.LAB_SOURCE_SHA,api,releaseQualified:false,results:evidence},null,2));
  console.log(stage,status,JSON.stringify(details));
}
function foreground() {
  const lines=adb('shell','dumpsys','activity','activities').split('\n');
  return lines.some(s=>/topResumedActivity|mResumedActivity/.test(s)&&s.includes(pkg));
}
let socket,seq=0;
const pending=new Map();
async function connect() {
  for(let i=0;i<30;i++){
    try {
      const pid=adb('shell','pidof',pkg).split(/\s+/)[0];
      if(!/^\d+$/.test(pid)) throw Error('No app pid');
      adb('forward','tcp:9222','localabstract:webview_devtools_remote_'+pid);
      const res=await fetch('http://127.0.0.1:9222/json/list',{signal:AbortSignal.timeout(2000)});
      const target=(await res.json()).find(t=>t.type==='page'&&t.webSocketDebuggerUrl&&/^https?:\/\/localhost(?::\d+)?(?:\/|$)/.test(t.url));
      if(!target) throw Error('No WebView target');
      socket=new WebSocket(target.webSocketDebuggerUrl.replace(/ws:\/\/[^/]+/,'ws://127.0.0.1:9222'));
      await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true})});
      socket.addEventListener('message',event=>{const m=JSON.parse(event.data);const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result)}});
      return;
    } catch { await sleep(1000); }
  }
  throw Error('WebView CDP unavailable on exact debug APK; diagnostic incomplete');
}
function cdp(method, params) {
  const id=++seq;
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP response timeout: '+method))},12000);
    pending.set(id,{resolve:r=>{clearTimeout(timer);r.exceptionDetails?reject(Error('WebView expression failed')):resolve(r)},reject:e=>{clearTimeout(timer);reject(e)}});
    socket.send(JSON.stringify({id,method,params}));
  });
}
async function evaluate(expression) {
  const r=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
  return r.result.value;
}
// Read geometry from the actual WebView, but send touches through the Android
// input dispatcher. No CDP Input acknowledgement can block the test.
function webViewBounds() {
  adb('shell','uiautomator','dump','/sdcard/trama-back-window.xml');
  const xml=adb('shell','cat','/sdcard/trama-back-window.xml');
  const nodes=Array.from(xml.matchAll(/<node\b[^>]*>/g),m=>m[0]);
  const bounds=nodes.filter(n=>n.includes('class="android.webkit.WebView"')&&n.includes('package="'+pkg+'"')).map(n=>n.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/)).filter(Boolean).map(m=>m.slice(1).map(Number)).filter(([l,t,r,b])=>r>l&&b>t).sort((a,b)=>(b[2]-b[0])*(b[3]-b[1])-(a[2]-a[0])*(a[3]-a[1]));
  if(!bounds.length)throw Error('Native WebView bounds unavailable');
  return bounds[0];
}
async function touch(expression,label='target') {
  const geometry=await evaluate('(()=>{const b='+expression+';if(!b)return null;b.scrollIntoView({block:"center",behavior:"instant"});const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,w:innerWidth,h:innerHeight,dpr:devicePixelRatio}})()');
  if(!geometry || geometry.x<0 || geometry.y<0 || geometry.x>=geometry.w || geometry.y>=geometry.h)throw Error('Target not visible: '+label);
  const [l,t,r,b]=webViewBounds();
  const sx=(r-l)/geometry.w,sy=(b-t)/geometry.h;
  if(!Number.isFinite(sx)||!Number.isFinite(sy)||Math.abs(sx-sy)/Math.max(sx,sy)>.15||Math.abs(sx-geometry.dpr)/geometry.dpr>.15)throw Error('WebView native/CSS bounds mismatch: '+JSON.stringify({bounds:[l,t,r,b],geometry}));
  const x=Math.round(l+geometry.x*sx),y=Math.round(t+geometry.y*sy);
  console.log('native-tap',label,JSON.stringify({x,y}));
  adb('shell','input','tap',String(x),String(y));
}
async function until(fn,label,ms=15000) {
  const end=Date.now()+ms;
  while(Date.now()<end){if(await fn())return;await sleep(250)}
  throw Error(label);
}
async function tap(selector, label) {
  const q=JSON.stringify(selector);
  await until(()=>evaluate('Boolean(document.querySelector('+q+'))'),'Missing '+label);
  await touch('document.querySelector('+q+')',label);
}
async function button(label, scope='') {
  const expr='Array.from(document.querySelectorAll('+JSON.stringify(scope+'button')+')).find(b=>b.getClientRects().length && !b.disabled && b.textContent.trim()==='+JSON.stringify(label)+')';
  await until(()=>evaluate('Boolean('+expr+')'),'Missing '+label);
  await touch(expr,label);
}
async function tab() { return evaluate('history.state?.tab || (new URL(location.href).searchParams.get("tab")) || "home"'); }
async function assertTab(wanted,label) {
  const names={dashboard:'Riepilogo',tabellone:'Tabellone',analytics:'Analisi'};
  await until(async()=>foreground()&&(await tab())===wanted&&await evaluate('Array.from(document.querySelectorAll("nav button")).some(b=>b.getClientRects().length&&b.classList.contains("font-bold")&&b.textContent.trim()==='+JSON.stringify(names[wanted])+')'),label+': expected active '+wanted,8000);
}
async function snapshot() {
  try {
    return await evaluate('({origin:location.origin,tab:history.state?.tab||"home",historyLength:history.length,ready:document.readyState,visibility:document.visibilityState,headings:Array.from(document.querySelectorAll("h1,h2")).slice(0,5).map(e=>e.textContent.trim()),modeAvailable:!!document.querySelector("input[name=archive-mode]"),passwordAvailable:!!document.querySelector("#vault-password"),activeNav:Array.from(document.querySelectorAll("nav button.font-bold")).map(b=>b.textContent.trim())})');
  } catch(e){return {snapshotError:e.message};}
}
async function back(label,cmd,wanted) {
  const before=await snapshot();
  adb('shell','input',...cmd);
  try { await assertTab(wanted,label);record(label,'PASS',{tab:wanted,foreground:true,before,after:await snapshot()}); }
  catch(e) {record(label,'FAIL',{foreground:foreground(),message:e.message,before,after:await snapshot()});throw e;}
}

const password='synthetic-persist-diagnostic-only';
const date='2031-01-15';
const marker='BACKUP-02 prova sintetica';
const grade='8';
let classLabel;
async function setField(selector,value) {
  const q=JSON.stringify(selector),v=JSON.stringify(value);
  await until(()=>evaluate('Boolean(document.querySelector('+q+'))'),'Missing field '+selector);
  await evaluate('(()=>{const e=document.querySelector('+q+');const proto=e.tagName==="SELECT"?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,"value").set.call(e,'+v+');e.dispatchEvent(new Event("input",{bubbles:true}));e.dispatchEvent(new Event("change",{bubbles:true}));return true})()');
  await until(()=>evaluate('document.querySelector('+q+')?.value==='+v),'Field not updated '+selector);
}
async function click(selector) {
  const q=JSON.stringify(selector);
  await until(()=>evaluate('Boolean(document.querySelector('+q+'))'),'Missing '+selector);
  await evaluate('(()=>{const e=document.querySelector('+q+');if(e.disabled)throw Error("Disabled control");e.click();return true})()');
}
async function clickText(label,scope='') {
  const expr='Array.from(document.querySelectorAll('+JSON.stringify(scope+'button')+')).find(b=>b.getClientRects().length&&!b.disabled&&b.textContent.trim()==='+JSON.stringify(label)+')';
  await until(()=>evaluate('Boolean('+expr+')'),'Missing '+label);
  await evaluate('(()=>{('+expr+').click();return true})()');
}
async function openMatrix() {
  const expr='Array.from(document.querySelectorAll("button")).find(b=>b.getAttribute("aria-label")==='+JSON.stringify(classLabel)+')';
  await until(()=>evaluate('Boolean('+expr+')'),'Synthetic class missing');
  await touch(expr,'open synthetic class');
  await until(()=>evaluate('Boolean(document.querySelector("nav"))'),'Class navigation absent');
  await button('Tabellone','nav ');
  await until(()=>evaluate('Boolean(document.querySelector("[data-testid=daily-matrix]"))'),'Daily matrix missing');
  await setField('[data-testid=daily-date]',date);
  record('daily-matrix-date-selected','PASS');
}
async function registered(expected) {
  await until(()=>evaluate('(()=>{const r=document.querySelector("[data-testid=daily-row]");return !!r&&r.querySelector("input")?.value==='+JSON.stringify(expected)+'&&!!r.querySelector("[aria-label=Registrato]")})()'),'Confirmed grade not present',30000);
}

const backupPassword='synthetic-backup-diagnostic-only';
const indicator='[data-testid="backup-copy-indicator"]';
function nativeXml(){
  adb('shell','uiautomator','dump','/sdcard/trama-backup-window.xml');
  return adb('shell','cat','/sdcard/trama-backup-window.xml');
}
function nativeNodes(xml) {
  return Array.from(xml.matchAll(/<node\b[^>]*>/g),m=>m[0]).map(n=>({text:n.match(/\btext="([^"]*)"/)?.[1]||'',desc:n.match(/content-desc="([^"]*)"/)?.[1]||'',pkg:n.match(/\bpackage="([^"]*)"/)?.[1]||'',bounds:n.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/)?.slice(1).map(Number)}));
}
async function nativeFind(predicate,label,timeout=30000){
  let target;
  await until(()=>{try{target=nativeNodes(nativeXml()).find(predicate);return !!target;}catch{return false}},label,timeout);
  return target;
}
function nativePress(n){if(!n.bounds)throw Error('Native target has no bounds');const [l,t,r,b]=n.bounds;if(r<=l||b<=t)throw Error('Native target empty');adb('shell','input','tap',String(Math.round((l+r)/2)),String(Math.round((t+b)/2)));}
const docNode=n=>/documentsui/i.test(n.pkg);
async function picker(){return nativeFind(n=>docNode(n)&&(/save|salva/i.test(n.text)||/show roots|mostra radici|open navigation drawer/i.test(n.desc)),'Android document picker not available');}
async function home(){
  const isHome=()=>evaluate('Boolean(document.querySelector('+JSON.stringify(indicator)+'))');
  if(await isHome())return;
  const inPrivacy=await evaluate('Boolean(document.querySelector(\'input[placeholder="Ripeti la password"]\'))');
  if(inPrivacy){
    // Privacy entered by the Home export shortcut does not push a history
    // entry. Test explicit Oggi separately, without claiming Back passed.
    const drawer='#registro-navigation-drawer[aria-hidden="false"]';
    const go=drawer+' [data-testid="header01-go-home"]';
    await click('[data-testid="header01-brand-navigation"]');
    await until(()=>evaluate('(()=>{const e=document.querySelector('+JSON.stringify(go)+');if(!e||e.closest("[inert]"))return false;const r=e.getBoundingClientRect();return r.width>0&&r.left>=0&&r.right<=innerWidth})()'),'Opened drawer Oggi not visible');
    await click(go);
    const confirmation='[data-testid="header01-home-confirm"]';
    await until(async()=>await isHome()||await evaluate('Boolean(document.querySelector('+JSON.stringify(confirmation)+'))'),'Explicit Oggi did not open home or confirmation');
    if(!await isHome())await clickText('Torna a Oggi',confirmation+' ');
    await until(isHome,'Explicit Oggi did not restore home');
    record('home-reached-explicit-privacy-exit','PASS');
    return;
  }
  for(let step=0;step<5;step++){
    const before=await tab();
    adb('shell','input','keyevent','4');
    await until(async()=>foreground()&&(await isHome()||(await tab())!==before),'Native Back did not restore previous view',10000);
    if(await isHome()){record('home-reached-native-back','PASS',{steps:step+1});return;}
  }
  throw Error('Home backup indicator not reached by native Back');
}
async function expectCopy(label){
  await until(()=>evaluate('document.querySelector('+JSON.stringify(indicator)+')?.textContent.includes('+JSON.stringify(label)+')'),'Backup indicator not '+label);
  record('backup-indicator','PASS',{label});
}
async function exportForm(){
  const selector=indicator+' button[aria-label="Esporta backup cifrato"]';
  await until(()=>evaluate('Boolean(document.querySelector('+JSON.stringify(selector)+'))'),'Home export control missing');
  // Application control is a normal DOM button; no native picker is simulated.
  await click(selector);
  record('backup-form-open-requested','PASS');
  await setField('input[placeholder="Inserisci password sicura (min. 6 caratteri)"]',backupPassword);
  await setField('input[placeholder="Ripeti la password"]',backupPassword);
  await button('Cifra e Scarica File');
  await picker();
  record('native-picker-opened','PASS');
}
async function chooseDownload(){
  let nodes=nativeNodes(nativeXml()).filter(docNode);
  const title=nodes.find(n=>/^(Downloads|Download)$/i.test(n.text));
  if(!title){
    const roots=await nativeFind(n=>docNode(n)&&/show roots|open navigation drawer|mostra radici/i.test(n.desc),'No picker navigation');
    nativePress(roots);
    const downloads=await nativeFind(n=>docNode(n)&&/^(Downloads|Download)$/i.test(n.text),'Downloads not available');
    nativePress(downloads);
  }
  const save=await nativeFind(n=>docNode(n)&&/^(save|salva)$/i.test(n.text),'Save button absent');
  nativePress(save);
}
async function dismissSuccess(message){
  await nativeFind(n=>n.text.includes(message),'Expected native success message absent',45000);
  const ok=await nativeFind(n=>/^OK$/i.test(n.text),'Alert OK absent');
  nativePress(ok);
  await until(()=>foreground(),'App not foreground after alert');
}
async function verifyEncryptedDownload(){
  const files=adb('shell','ls','-1','/sdcard/Download').split(/\r?\n/).filter(n=>/^Backup_Cifrato_GDPR_\d{4}-\d{2}-\d{2}\.enc\.json$/.test(n));
  if(files.length!==1)throw Error('Expected exactly one encrypted file in Downloads; got '+files.length);
  const bytes=execFileSync('adb',['exec-out','cat','/sdcard/Download/'+files[0]],{timeout:30000});
  const envelope=JSON.parse(bytes.toString('utf8'));
  if(envelope.version!==2||envelope.privacy_protocol!=='REGISTRO_DOCENTE_AES_GCM_256'||envelope.kdf?.iterations!==600000||envelope.kdf?.hash!=='SHA-256'||!envelope.ciphertext||bytes.toString('utf8').includes(marker))throw Error('Unexpected encrypted envelope');
  const material=await webcrypto.subtle.importKey('raw',Buffer.from(backupPassword),'PBKDF2',false,['deriveKey']);
  const key=await webcrypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt:Buffer.from(envelope.salt,'base64'),iterations:600000},material,{name:'AES-GCM',length:256},false,['decrypt']);
  const plaintext=await webcrypto.subtle.decrypt({name:'AES-GCM',iv:Buffer.from(envelope.iv,'base64')},key,Buffer.from(envelope.ciphertext,'base64'));
  const payload=JSON.parse(Buffer.from(plaintext).toString('utf8'));
  const matches=payload.snapshot?.appData?.classes?.flatMap(c=>c.grades).filter(g=>g.title===marker&&g.date===date&&g.value===grade&&g.type==='disegno');
  if(payload.app!=='registro-docente'||payload.backupDataVersion!==6||matches?.length!==1||payload.snapshot.meta.changes!==0||payload.snapshot.meta.verifiedBackupEvidence!==undefined)throw Error('Encrypted checkpoint does not match confirmed synthetic grade');
  record('independent-encrypted-file-readback','PASS',{bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),envelopeVersion:2,payloadVersion:6});
}
try {
  await connect();
  record('initial-webview-connected','PASS');
  await until(()=>evaluate('Boolean(document.querySelector(\'input[name="archive-mode"][value="demo"]\'))'),'Archive mode choice not available',45000);
  await tap('input[name="archive-mode"][value="demo"]','demo archive');
  await until(()=>evaluate('Boolean(document.querySelector("#vault-password"))'),'Demo password field not available after selecting mode');
  record('demo-mode-selected','PASS');
  await evaluate('(()=>{const e=document.querySelector("#vault-password");Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(e,"synthetic-persist-diagnostic-only");e.dispatchEvent(new Event("input",{bubbles:true}));e.blur();return true})()');
  // Setup is not a history traversal; use form submission and wait for the
  // observed unlocked state, without retrying the action.
  await evaluate('(()=>{const b=Array.from(document.querySelectorAll("button")).find(b=>!b.disabled&&b.textContent.trim()==="Avvia la prova");if(!b)throw Error("Demo submit absent");b.click();return true})()');
  await until(()=>evaluate('Array.from(document.querySelectorAll("button")).some(b=>/^Apri classe /.test(b.getAttribute("aria-label")||""))'),'Demo classes unavailable',45000);
  classLabel=await evaluate('Array.from(document.querySelectorAll("button")).find(b=>/^Apri classe /.test(b.getAttribute("aria-label")||"")).getAttribute("aria-label")');
  record('synthetic-archive-opened','PASS');
  await openMatrix();
  await until(()=>evaluate('document.querySelector("[aria-label=\\"Voto alunno 1\\"]")?.value===""'),'Expected empty daily grade');
  await setField('[aria-label="Voto alunno 1"]',grade);
  await tap('[aria-label="Conferma voto alunno 1"]','confirm daily grade');
  record('first-grade-draft-confirmed','PASS');
  await setField('[aria-label="Tipologia prova"]','disegno');
  await setField('[aria-label="Argomento prova"]',marker);
  await button('Conferma e registra');
  await registered(grade);
  record('first-grade-confirmed','PASS');
  // Terminate the entire Android process immediately after the UI acknowledges commit.
  socket.close();socket=null;
  adb('shell','am','force-stop',pkg);
  await until(()=>{try{return !adb('shell','pidof',pkg)}catch{return true}},'Process still running');
  adb('forward','--remove','tcp:9222');
  adb('shell','am','start','-W','-n',pkg+'/it.trama.registrodocente.prova.MainActivity');
  await connect();
  record('cold-process-connected','PASS');
  await until(()=>evaluate('document.querySelector("h1")?.textContent.includes("Sblocca Registro")'),'Fresh locked bootstrap missing',45000);
  await setField('#vault-password',password);
  await clickText('Sblocca Registro');
  await openMatrix();
  await registered(grade);
  await until(()=>evaluate('document.querySelector(\'[aria-label="Prova della giornata"]\')?.selectedOptions[0]?.textContent.includes('+JSON.stringify(marker)+')'),'Saved assessment identity missing');
  record('cold-reopen-grade-and-proof','PASS');
  record('exact-android-apk-persistence','PASS');
  await home();
  await expectCopy('Copia di sicurezza da verificare');
  await exportForm();
  adb('shell','input','keyevent','4');
  await until(()=>foreground(),'App not foreground after cancellation');
  await until(()=>evaluate('Array.from(document.querySelectorAll("button")).some(b=>!b.disabled&&b.textContent.trim()==="Cifra e Scarica File")'),'Export did not settle after cancellation');
  await home();
  await expectCopy('Copia di sicurezza da verificare');
  record('cancel-no-attestation','PASS');
  await exportForm();
  await chooseDownload();
  await dismissSuccess('Copia di sicurezza salvata e verificata');
  await verifyEncryptedDownload();
  await home();
  await expectCopy('Copia verificata');
  record('native-backup-export-and-receipt','PASS');
  await openMatrix();
  await registered(grade);
  await setField('[aria-label="Voto alunno 1"]','9');
  await tap('[aria-label="Conferma voto alunno 1"]','update synthetic grade');
  await registered('9');
  await home();
  await expectCopy('Copia da aggiornare');
  record('new-commit-invalidates-current-copy','PASS');
} catch(e) {
  record('diagnostic-incomplete-or-failed','FAIL',{message:e.message,foreground:foreground(),view:await snapshot()});
  process.exitCode=1;
} finally {socket?.close();}
