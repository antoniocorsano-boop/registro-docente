// Exact APK diagnostic, isolated emulator only; no user data, no app code changes.
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
const pkg = process.env.LAB_PACKAGE;
const api = Number(process.env.LAB_API);
if (pkg !== 'it.trama.registrodocente.lab.b43' || ![32,36].includes(api)) throw new Error('Not an isolated emulator diagnostic');
const adb = (...args) => execFileSync('adb', args, { encoding:'utf8', timeout:30000 }).trim();
const sleep = ms => new Promise(r=>setTimeout(r,ms));
const evidence = [];
mkdirSync('native-evidence',{recursive:true});
function record(stage, status, details={}) {
  evidence.push({stage,status,...details});
  writeFileSync('native-evidence/sec-session-boundary-result.json',JSON.stringify({sourceSha:process.env.LAB_SOURCE_SHA,api,releaseQualified:false,results:evidence},null,2));
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
try {
  await connect();
  const expectedSha=process.env.LAB_SOURCE_SHA;
  const identity=()=>evaluate('(()=>{const e=Array.from(document.querySelectorAll("[data-testid=registro-build-identity]")).find(e=>e.getClientRects().length&&!e.closest("[inert]")&&getComputedStyle(e).visibility==="visible");return e?{sha:e.dataset.sourceSha,text:e.textContent.trim()}:null})()');
  const validIdentity=async()=>{const x=await identity();return x?.sha===expectedSha&&x.text==="Collaudo B4.3 · "+expectedSha.slice(0,12);};
  await until(validIdentity,'Visible exact build identity missing in gate');
  record('build-identity-gate','PASS',{identity:await identity()});
  await until(()=>evaluate('Boolean(document.querySelector(\'input[name="archive-mode"][value="demo"]\'))'),'Archive mode choice not available',45000);
  await tap('input[name="archive-mode"][value="demo"]','demo archive');
  await until(()=>evaluate('Boolean(document.querySelector("#vault-password"))'),'Demo password field not available after selecting mode');
  record('demo-mode-selected','PASS');
  await evaluate('(()=>{const e=document.querySelector("#vault-password");Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(e,"synthetic-back-diagnostic-only");e.dispatchEvent(new Event("input",{bubbles:true}));e.blur();return true})()');
  // Setup is not a history traversal; use form submission and wait for the
  // observed unlocked state, without retrying the action.
  await evaluate('(()=>{const b=Array.from(document.querySelectorAll("button")).find(b=>!b.disabled&&b.textContent.trim()==="Avvia la prova");if(!b)throw Error("Demo submit absent");b.click();return true})()');
  await until(()=>evaluate('Array.from(document.querySelectorAll("button")).some(b=>/^Apri classe /.test(b.getAttribute("aria-label")||""))'),'Demo classes unavailable',45000);
  record('archive-opened','PASS',{view:await snapshot()});

  const activity=pkg+'/it.trama.registrodocente.prova.MainActivity';
  const gate=()=>evaluate('Array.from(document.querySelectorAll("h1")).some(e=>e.textContent.trim()==="Sblocca Registro"&&getComputedStyle(e).visibility==="visible") && !!document.querySelector("#vault-password")');
  const appVisible=()=>evaluate('(()=>{const e=document.querySelector("[data-testid=header01-topbar]");return !!e&&!e.closest("[inert]")&&getComputedStyle(e).visibility==="visible"})()');
  async function requireNativeGate(label){
    await until(foreground,label+': Android foreground unavailable',30000);
    await until(gate,label+': password gate unavailable',30000);
    await nativeFind(n=>n.pkg===pkg&&(/Sblocca Registro|Password locale/.test(n.text)||/Sblocca Registro|Password locale/.test(n.desc)),label+': protected surface not actually accessible',30000);
    if(await appVisible())throw Error(label+': application exposed before unlock');
  }
  async function submit(value){
    await setField('#vault-password',value);
    await evaluate('document.querySelector("#vault-password").form.requestSubmit()');
  }
  async function resume(){
    await submit('synthetic-back-diagnostic-only');
    await until(appVisible,'Authenticated application did not resume',45000);
    await until(()=>{try{return !!webViewBounds().length}catch{return false}},'Native WebView did not become accessible',30000);
  }
  await click('[data-testid="header01-brand-navigation"]');
  await until(validIdentity,'Visible exact build identity missing in drawer');
  record('build-identity-drawer','PASS',{identity:await identity()});
  await click('[data-testid="header01-brand-navigation"]');
  const openClass='Array.from(document.querySelectorAll("button")).find(b=>/^Apri classe /.test(b.getAttribute("aria-label")||""))';
  await touch(openClass,'open synthetic class');
  await until(()=>evaluate('history.state?.tab==="dashboard"'),'Class overview unavailable');
  await button('Tabellone','nav ');
  await until(()=>evaluate('history.state?.tab==="tabellone"'),'Daily matrix unavailable');
  await setField('[aria-label="Voto alunno 1"]','8');
  const route=()=>evaluate('({tab:history.state?.tab,entry:history.state?.__tramaHistoryEntryId,position:history.state?.__tramaHistoryPosition,url:location.href,length:history.length})');
  const initial=await route();
  const before=await evaluate('Capacitor.Plugins.RegistroSession.getState()');
  adb('shell','input','keyevent','KEYCODE_HOME');
  await until(()=>!foreground(),'Home did not background app');
  adb('shell','am','start','-W','-n',activity);
  await requireNativeGate('locked native Back');
  await evaluate('window.__lockedBackPopstates=0;window.addEventListener("popstate",()=>window.__lockedBackPopstates++);true');
  const locked=await route();
  if(JSON.stringify(initial)!==JSON.stringify(locked))throw Error('Unexpected route change before Back');
  adb('shell','input','keyevent','KEYCODE_BACK');
  await sleep(1200);
  await requireNativeGate('after native Back');
  const afterKey=await route();
  record('locked-key-route',JSON.stringify(afterKey)===JSON.stringify(locked)?'PASS':'FAIL',{before:locked,after:afterKey});
  const size=adb('shell','wm','size').match(/(\d+)x(\d+)(?![\s\S]*\d+x\d+)/);
  if(!size)throw Error('Screen dimensions unavailable');
  const w=Number(size[1]),h=Number(size[2]),y=Math.floor(h*.45);
  adb('shell','input','swipe',String(w-1),String(y),String(Math.floor(w*.5)),String(y),'350');
  await sleep(1200);
  await requireNativeGate('after native edge');
  const afterEdge=await route();
  record('locked-edge-route',JSON.stringify(afterEdge)===JSON.stringify(locked)?'PASS':'FAIL',{before:locked,after:afterEdge});
  const traversals=await evaluate('window.__lockedBackPopstates');
  record('locked-no-popstate',traversals===0?'PASS':'FAIL',{traversals});
  await resume();
  const dialog=await evaluate('Array.from(document.querySelectorAll("[role=dialog]")).some(e=>e.getClientRects().length&&e.textContent.includes("Modifiche non salvate"))');
  record('resume-no-draft-dialog',!dialog?'PASS':'FAIL',{dialog});
  const final=await route();
  const preserved=await evaluate('document.querySelector(\'[aria-label="Voto alunno 1"]\')?.value==="8"');
  record('resume-draft-and-route',preserved&&JSON.stringify(final)===JSON.stringify(initial)?'PASS':'FAIL',{preserved,before:initial,after:final});
  const native=await evaluate('Capacitor.Plugins.RegistroSession.getState()');
  // A confirmed manual lock starts a fresh session, unlike suspension.
  await click('[data-testid="header01-lock"]');
  await button('Continua senza salvare');
  await requireNativeGate('manual lock');
  const manualLocked=await route();
  await evaluate('window.__lockedBackPopstates=0;true');
  adb('shell','input','keyevent','KEYCODE_BACK');
  await sleep(1200);
  await requireNativeGate('manual lock after Back');
  const manualAfter=await route();
  const manualTraversals=await evaluate('window.__lockedBackPopstates');
  record('manual-locked-no-popstate',manualTraversals===0&&JSON.stringify(manualLocked)===JSON.stringify(manualAfter)?'PASS':'FAIL',{manualTraversals,before:manualLocked,after:manualAfter});
  await resume();
  const home=await evaluate('Array.from(document.querySelectorAll("button")).some(b=>/^Apri classe /.test(b.getAttribute("aria-label")||""))');
  record('manual-lock-restarts-home',home?'PASS':'FAIL');
  record('locked-back-observation-complete','PASS',{before,native});
} catch(e) {
  record('native-session-failed','FAIL',{message:e.message,foreground:foreground(),view:await snapshot()});
  process.exitCode=1;
} finally {socket?.close();}
