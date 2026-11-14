// Exact APK diagnostic, isolated emulator only; no user data, no app code changes.
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
const pkg = process.env.LAB_PACKAGE;
const api = Number(process.env.LAB_API);
if (pkg !== 'it.trama.registrodocente.prova' || ![32,36].includes(api)) throw new Error('Not an isolated emulator diagnostic');
const adb = (...args) => execFileSync('adb', args, { encoding:'utf8', timeout:30000 }).trim();
const sleep = ms => new Promise(r=>setTimeout(r,ms));
const evidence = [];
mkdirSync('native-evidence',{recursive:true});
function record(stage, status, details={}) {
  evidence.push({stage,status,...details});
  writeFileSync('native-evidence/back-result.json',JSON.stringify({sourceSha:process.env.LAB_SOURCE_SHA,api,releaseQualified:false,results:evidence},null,2));
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
try {
  await connect();
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
  await touch('Array.from(document.querySelectorAll("button")).find(b=>/^Apri classe /.test(b.getAttribute("aria-label")||""))','open synthetic class');
  await until(()=>evaluate('Boolean(document.querySelector("nav"))'),'Class navigation absent');
  await button('Riepilogo','nav ');
  await assertTab('dashboard','class overview');
  record('class-overview','PASS',{view:await snapshot()});
  await button('Tabellone','nav ');
  await assertTab('tabellone','class matrix');
  record('matrix','PASS',{view:await snapshot()});
  await button('Analisi','nav ');
  await assertTab('analytics','analysis');
  record('setup','PASS',{foreground:foreground()});
  // Prioritize the actual reported right-edge swipe on Android 16.
  // Real system edge input via adb, with gesture overlay verified by workflow.
  const size=adb('shell','wm','size').match(/(\d+)x(\d+)(?![\s\S]*\d+x\d+)/);
  if(!size)throw Error('Screen dimensions unavailable');
  const w=Number(size[1]),h=Number(size[2]),y=Math.floor(h*.45);
  await back('native-right-edge-analysis-to-matrix',['swipe',String(w-1),String(y),String(Math.floor(w*.5)),String(y),'350'],'tabellone');
  await back('native-left-edge-matrix-to-overview',['swipe','1',String(y),String(Math.floor(w*.5)),String(y),'350'],'dashboard');
  await button('Analisi','nav ');
  await assertTab('analytics','analysis again');
  await back('native-key-analysis-to-overview',['keyevent','4'],'dashboard');
  // Reach the known fresh archive root using actual system Back events.
  for(let step=0;step<4 && (await tab())!=='home';step++){
    adb('shell','input','keyevent','4');
    await sleep(700);
    if(!foreground())throw Error('Activity exited during return to root');
  }
  await until(async()=>foreground()&&(await tab())==='home'&&await evaluate('Array.from(document.querySelectorAll("h1,h2")).some(e=>e.textContent.includes("Oggi"))'),'Oggi root not reached');
  const rootBefore=await snapshot();
  adb('shell','input','keyevent','4');
  await sleep(1000);
  if(!foreground()||(await tab())!=='home')throw Error('System Back exited or changed the root');
  record('native-root-retained','PASS',{before:rootBefore,after:await snapshot(),foreground:true});
  // Physical device, IME, dialogs and dirty-draft behavior remain unqualified.
  record('emulator-only-diagnostic','PASS');
} catch(e) {
  record('diagnostic-incomplete-or-failed','FAIL',{message:e.message,foreground:foreground(),view:await snapshot()});
  process.exitCode=1;
} finally {socket?.close();}
