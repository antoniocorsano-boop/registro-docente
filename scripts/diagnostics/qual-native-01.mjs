// Exact APK diagnostic, isolated emulator only; no user data, no app code changes.
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync, readFileSync, statSync } from 'node:fs';
const pkg = process.env.LAB_PACKAGE;
const api = Number(process.env.LAB_API);
if (pkg !== 'it.trama.registrodocente.lab.b43' || ![32,36].includes(api)) throw new Error('Not an isolated emulator diagnostic');
const adb = (...args) => execFileSync('adb', args, { encoding:'utf8', timeout:30000 }).trim();
const sleep = ms => new Promise(r=>setTimeout(r,ms));
const evidence = [];
mkdirSync('native-evidence',{recursive:true});
function record(stage, status, details={}) {
  evidence.push({stage,status,...details});
  writeFileSync('native-evidence/qual-native-result.json',JSON.stringify({sourceSha:process.env.LAB_SOURCE_SHA,api,releaseQualified:false,diagnosticOnly:true,results:evidence},null,2));
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
// The system observations are evidence, not assertions that a gesture was
// recognized. ADB exit 0 proves injection only. Do not retry a failed gesture.
function collect(label, name, args) {
  try {
    const result=adb(...args);
    writeFileSync('native-evidence/'+label+'-'+name+'.txt',result+'\n');
    return {available:true,bytes:Buffer.byteLength(result)};
  } catch(e) {return {available:false,error:String(e.message).slice(0,300)};}
}
function systemEvidence(label) {
  return {
    systemui:collect(label,'systemui',['shell','dumpsys','activity','service','com.android.systemui/.SystemUIService']),
    input:collect(label,'input',['shell','dumpsys','input']),
    window:collect(label,'window',['shell','dumpsys','window']),
    logcat:collect(label,'logcat',['logcat','-d','-t','1200','-v','threadtime'])
  };
}
// Parse the standard non-streaming ART trace, checking entry records rather
// than merely searching the method-name dictionary. Unsupported formats and
// overflow are explicitly inconclusive, never proof of an absent callback.
function inspectTrace(file) {
  const b=readFileSync(file), marker=Buffer.from('*end\n');
  const end=b.indexOf(marker);
  if(end<0)return {status:'UNAVAILABLE',reason:'no standard ART header'};
  const header=b.subarray(0,end).toString('utf8');
  const binary=end+marker.length;
  if(b.length<binary+18||b.toString('ascii',binary,binary+4)!=='SLOW')
    return {status:'UNAVAILABLE',reason:'unsupported binary header'};
  const version=b.readUInt16LE(binary+4),offset=b.readUInt16LE(binary+6);
  const stride=version===1?9:version===2?10:version===3?b.readUInt16LE(binary+16):0;
  const threadBytes=version===1?1:2;
  if(!stride||stride<threadBytes+4||offset<16||binary+offset>b.length)
    return {status:'UNAVAILABLE',reason:'unsupported trace record layout',version};
  const dict=new Map();
  const methodSection=header.split('*methods\n')[1]||'';
  for(const line of methodSection.split('\n')) {
    const parts=line.split('\t');
    if(parts.length>=3&&/^0x[0-9a-f]+$/i.test(parts[0])) {
      const cls=parts[1],name=parts[2];
      if((cls.includes('it/trama/registrodocente/prova/MainActivity')||cls.includes('it.trama.registrodocente.prova.MainActivity'))&&name==='navigateWebHistory')
        dict.set(Number.parseInt(parts[0],16)>>>0,'nativeCallback');
      if((cls==='android/webkit/WebView'||cls==='android.webkit.WebView')&&['goBack','canGoBack'].includes(name))
        dict.set(Number.parseInt(parts[0],16)>>>0,name);
    }
  }
  const counts={nativeCallback:0,goBack:0,canGoBack:0};
  let p=binary+offset;
  for(;p+stride<=b.length;p+=stride){
    const raw=b.readUInt32LE(p+threadBytes);
    if((raw&3)===0){
      const name=dict.get((raw&0xfffffffc)>>>0);
      if(name)counts[name]++;
    }
  }
  const complete=p===b.length&&!/data-file-overflow=true/i.test(header);
  return {status:'OBSERVED',version,complete,counts,matchedMethods:dict.size,
    absenceConclusive:false};
}
async function observe(label, cmd, wanted, profile=false) {
  const before=await snapshot();
  await evaluate('window.__tramaNativeProbeEvents.length=0');
  let traceStarted=false, trace={status:'NOT_REQUESTED'};
  const remote='/data/local/tmp/trama-qual-'+label+'.trace';
  const local='native-evidence/'+label+'.trace';
  if(profile) {
    try {
      adb('shell','am','profile','start',pkg,remote);
      traceStarted=true;
    } catch(e){trace={status:'UNAVAILABLE',reason:String(e.message).slice(0,250)};}
  }
  let inputError=null,routePass=false,routeError=null;
  const started=Date.now();
  try {
    if(cmd[0]==='web-control')await evaluate('history.back(); true');
    else adb('shell','input',...cmd);
  } catch(e){inputError=String(e.message);}
  const inputReturned=Date.now();
  try{if(!inputError){await assertTab(wanted,label);routePass=true;}}
  catch(e){routeError=e.message;}
  finally{
    if(traceStarted) {
      try{
        adb('shell','am','profile','stop',pkg);
        adb('pull',remote,local);
        if(statSync(local).size>0)trace=inspectTrace(local);
        else trace={status:'UNAVAILABLE',reason:'empty ART trace'};
      }catch(e){trace={status:'UNAVAILABLE',reason:String(e.message).slice(0,250)};}
      try{adb('shell','rm','-f',remote);}catch{}
    }
  }
  const events=await evaluate('window.__tramaNativeProbeEvents.slice()').catch(()=>null);
  const after=await snapshot();
  const stillForeground=foreground();
  const system=systemEvidence(label);
  record(label,routePass&&stillForeground?'PASS':'FAIL',{
    kind:cmd[0],profile,before,after,foreground:stillForeground,
    wanted,inputAccepted:!inputError,inputError,routeError,
    started,inputReturned,observedAt:Date.now(),events,trace,system
  });
  return routePass&&stillForeground;
}
async function preparePair() {
  await button('Riepilogo','nav ');
  await assertTab('dashboard','pair baseline overview');
  await button('Tabellone','nav ');
  await assertTab('tabellone','pair baseline matrix');
  await button('Analisi','nav ');
  await assertTab('analytics','pair baseline analysis');
}
try {
  await connect();
  await evaluate(`(()=>{window.__tramaNativeProbeEvents=[];for(const type of ['popstate','pointerdown','pointerup','pointercancel'])window.addEventListener(type,e=>{if(window.__tramaNativeProbeEvents.length<100)window.__tramaNativeProbeEvents.push({type,time:performance.now(),tab:history.state?.tab||'home',position:history.state?.__tramaHistoryPosition??null,x:type.startsWith('pointer')?e.clientX:undefined,y:type.startsWith('pointer')?e.clientY:undefined})},{capture:true,passive:true});return true})()`);
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
  const size=adb('shell','wm','size').match(/(\d+)x(\d+)(?![\s\S]*\d+x\d+)/);
  if(!size)throw Error('Screen dimensions unavailable');
  const w=Number(size[1]),h=Number(size[2]),y=Math.floor(h*.45);
  record('baseline','PASS',{screen:{w,h,y},system:systemEvidence('baseline')});
  const right=['swipe',String(w-1),String(y),String(Math.floor(w*.5)),String(y),'350'];
  const left=['swipe','1',String(y),String(Math.floor(w*.5)),String(y),'350'];
  // Each condition is declared before execution. A failed action is retained.
  // Re-establish the starting route for an independent left-edge observation
  // only if the preceding right-edge action did not reach the matrix.
  for(const condition of [{name:'unprofiled-a',profile:false},{name:'unprofiled-b',profile:false},{name:'profiled',profile:true}]){
    await preparePair();
    const rightPassed=await observe(condition.name+'-right',right,'tabellone',condition.profile);
    if(!rightPassed){
      if(!foreground())throw Error('Activity exited; no recovery navigation');
      await button('Riepilogo','nav ');
      await assertTab('dashboard','independent left baseline overview');
      await button('Tabellone','nav ');
      await assertTab('tabellone','independent left baseline matrix');
      record(condition.name+'-left-independent','PASS',{reason:'previous right failed; new starting route'});
    }
    await observe(condition.name+'-left',left,'dashboard',condition.profile);
    if(!foreground())throw Error('Activity exited; no recovery navigation');
  }
  // Positive controls: the native key and WebView history path on equivalent
  // route pairs. Neither can turn an unsuccessful edge gesture into PASS.
  await preparePair();
  await observe('native-key-control',['keyevent','4'],'tabellone',true);
  await preparePair();
  await observe('web-history-control',['web-control'],'tabellone',false);
  const attempts=evidence.filter(x=>x.kind);
  const expected=['unprofiled-a-right','unprofiled-a-left','unprofiled-b-right','unprofiled-b-left','profiled-right','profiled-left','native-key-control','web-history-control'];
  if(expected.some(label=>!attempts.some(x=>x.stage===label)))throw Error('Missing planned observation');
  record('diagnostic-complete','PASS',{
    planned:expected.length,observed:attempts.length,routeFailures:attempts.filter(x=>x.status==='FAIL').map(x=>x.stage),
    traceUnavailable:attempts.filter(x=>x.profile&&x.trace.status!=='OBSERVED').map(x=>x.stage),
    nativeKeyTrace:attempts.find(x=>x.stage==='native-key-control')?.trace,
    releaseQualified:false
  });
  // Exit success means the diagnostic collected all planned evidence, NOT
  // qualification of edge gestures. All route failures are preserved in JSON.
} catch(e){
  record('diagnostic-incomplete','FAIL',{message:e.message,foreground:foreground(),view:await snapshot()});
  process.exitCode=1;
} finally {socket?.close();}
