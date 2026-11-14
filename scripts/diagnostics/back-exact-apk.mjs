// Exact APK diagnostic, isolated emulator only; no user data, no app code changes.
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
const pkg = process.env.LAB_PACKAGE;
if (pkg !== 'it.trama.registrodocente.lab.b42') throw new Error('Not an isolated laboratory package');
const adb = (...args) => execFileSync('adb', args, { encoding:'utf8', timeout:30000 }).trim();
const sleep = ms => new Promise(r=>setTimeout(r,ms));
const evidence = [];
mkdirSync('native-evidence',{recursive:true});
function record(stage, status, details={}) {
  evidence.push({stage,status,...details});
  writeFileSync('native-evidence/back-result.json',JSON.stringify({sourceSha:process.env.LAB_SOURCE_SHA,api:36,releaseQualified:false,results:evidence},null,2));
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
      const target=(await res.json()).find(t=>t.type==='page'&&t.webSocketDebuggerUrl);
      if(!target) throw Error('No WebView target');
      socket=new WebSocket(target.webSocketDebuggerUrl.replace(/ws:\/\/[^/]+/,'ws://127.0.0.1:9222'));
      await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true})});
      socket.addEventListener('message',event=>{const m=JSON.parse(event.data);const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result)}});
      return;
    } catch { await sleep(1000); }
  }
  throw Error('WebView CDP unavailable on exact debug APK; diagnostic incomplete');
}
function evaluate(expression) {
  const id=++seq;
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP response timeout'))},4000);
    pending.set(id,{resolve:r=>{clearTimeout(timer);r.exceptionDetails?reject(Error('WebView expression failed')):resolve(r.result.value)},reject:e=>{clearTimeout(timer);reject(e)}});
    socket.send(JSON.stringify({id,method:'Runtime.evaluate',params:{expression,returnByValue:true,awaitPromise:true}}));
  });
}
async function until(fn,label,ms=15000) {
  const end=Date.now()+ms;
  while(Date.now()<end){if(await fn())return;await sleep(250)}
  throw Error(label);
}
async function tap(selector, label) {
  const q=JSON.stringify(selector);
  await until(()=>evaluate('Boolean(document.querySelector('+q+'))'),'Missing '+label);
  await evaluate('document.querySelector('+q+').click(); true');
}
async function button(label, scope='') {
  const expr='Array.from(document.querySelectorAll('+JSON.stringify(scope+'button')+')).find(b=>b.getClientRects().length && b.textContent.trim()==='+JSON.stringify(label)+')';
  await until(()=>evaluate('Boolean('+expr+')'),'Missing '+label);
  await evaluate('('+expr+').click(); true');
}
async function tab() { return evaluate('history.state?.tab || (new URL(location.href).searchParams.get("tab")) || "home"'); }
async function assertTab(wanted,label) {
  await until(async()=>foreground()&&(await tab())===wanted,label+': expected '+wanted,8000);
}
async function back(label,cmd,wanted) {
  adb('shell','input',...cmd);
  try { await assertTab(wanted,label);record(label,'PASS',{tab:wanted,foreground:true}); }
  catch(e) {record(label,'FAIL',{foreground:foreground(),message:e.message});throw e;}
}
try {
  await connect();
  await until(()=>evaluate('Boolean(document.querySelector(\'#vault-password\'))'),'Archive setup not available');
  await tap('input[name="archive-mode"][value="demo"]','demo archive');
  await evaluate('(()=>{const e=document.querySelector("#vault-password");Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(e,"synthetic-back-diagnostic-only");e.dispatchEvent(new Event("input",{bubbles:true}));e.blur();return true})()');
  await button('Avvia la prova');
  await until(()=>evaluate('Array.from(document.querySelectorAll("button")).some(b=>/^Apri classe /.test(b.getAttribute("aria-label")||""))'),'Demo classes unavailable');
  await evaluate('Array.from(document.querySelectorAll("button")).find(b=>/^Apri classe /.test(b.getAttribute("aria-label")||"")).click(); true');
  await until(()=>evaluate('Boolean(document.querySelector("nav"))'),'Class navigation absent');
  await button('Riepilogo','nav ');
  await assertTab('dashboard','class overview');
  await button('Tabellone','nav ');
  await assertTab('tabellone','class matrix');
  await button('Analisi','nav ');
  await assertTab('analytics','analysis');
  record('setup','PASS',{foreground:foreground()});
  await back('native-key-analytics-to-matrix',['keyevent','4'],'tabellone');
  // Real system edge input via adb, with gesture overlay verified by workflow.
  const size=adb('shell','wm','size').match(/(\d+)x(\d+)(?![\s\S]*\d+x\d+)/);
  if(!size)throw Error('Screen dimensions unavailable');
  const w=Number(size[1]),h=Number(size[2]),y=Math.floor(h*.45);
  await back('native-right-edge-matrix-to-overview',['swipe',String(w-1),String(y),String(Math.floor(w*.5)),String(y),'350'],'dashboard');
  await button('Analisi','nav ');
  await assertTab('analytics','analysis again');
  await back('native-left-edge-analysis-to-overview',['swipe','1',String(y),String(Math.floor(w*.5)),String(y),'350'],'dashboard');
  // Do not claim physical gesture, dirty-draft or root qualification from these tests.
  record('emulator-only-diagnostic','PASS');
} catch(e) {
  record('diagnostic-incomplete-or-failed','FAIL',{message:e.message,foreground:foreground()});
  process.exitCode=1;
} finally {socket?.close();}
