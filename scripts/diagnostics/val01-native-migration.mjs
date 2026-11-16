// Synthetic CI emulator only. No production package or device.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync,writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const pkg='it.trama.registrodocente.lab.val01';
const adb=(...args)=>execFileSync('adb',args,{encoding:'utf8',timeout:30000}).trim();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const evidence=[];
mkdirSync('native-evidence',{recursive:true});
function stage(name,details={}){
  evidence.push({stage:name,status:'PASS',...details});
  writeFileSync('native-evidence/result.json',JSON.stringify({candidate:process.env.CANDIDATE_SHA,predecessor:process.env.HISTORICAL_SHA,api:36,scope:'laboratory APKs, exact historical storage source, candidate native bridge',productionRelease:false,results:evidence},null,2));
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
    return {text:get('text'),desc:get('content-desc'),pkg:get('package'),id:get('resource-id'),clickable:get('clickable')==='true',bounds:s.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/)?.slice(1).map(Number)};
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
try{
  assert.equal(process.env.GITHUB_ACTIONS,'true');
  assert.ok(adb('shell','getprop','ro.kernel.qemu')==='1'||adb('shell','getprop','ro.boot.qemu')==='1');
  assert.equal(adb('shell','getprop','ro.build.version.sdk'),'36');
  assert.ok(!adb('shell','pm','list','packages').split('\n').includes('package:'+pkg));
  const oldVersion=Number(process.env.OLD_VERSION);
  install(process.env.OLD_APK);
  const initial=identity(oldVersion);
  await launch('__val01FenceHistorical');
  const seed=await old('seed',false);
  assert.equal(seed.physical.keys.length,10);
  stop();await launch('__val01FenceHistorical');
  assert.deepEqual(await old('open'),{snapshot:seed.snapshot,physical:seed.physical});
  stage('historical-seed-cold-reopen');
  stop();install(process.env.NEW_APK,['-r']);assert.deepEqual(identity(10005),initial);
  await launch('__val01NativeLab');
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
  await launch('__val01FenceHistorical');
  for(const m of ['read','unlock','write','delete','clear','initialize'])assert.equal(await hist(m),'VersionError',m);
  stage('native-in-place-downgrade-all-six-operations-rejected');
  stop();install(process.env.NEW_APK,['-r']);assert.deepEqual(identity(10005),initial);
  await launch('__val01NativeLab');
  assert.deepEqual(await candidate('open'),{snapshot:seed.snapshot,physical:seed.physical});
  stage('native-reupgrade-archive-intact');
}catch(e){
  writeFileSync('native-evidence/failure.txt',String(e));
  process.exitCode=1;
  console.error(e.message);
  try{writeFileSync('native-evidence/synthetic-ui.json',JSON.stringify(nodes(),null,2));}catch{}
  try{writeFileSync('native-evidence/foreground.txt',adb('shell','dumpsys','activity','activities'));}catch{}
}finally{
  // Bound the diagnostic itself even if a DevTools socket never closes.
  socket?.close();for(const p of pending.values())clearTimeout(p.timer);pending.clear();
  process.exit(process.exitCode||0);
}
