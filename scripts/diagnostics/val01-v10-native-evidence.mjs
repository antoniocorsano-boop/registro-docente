// VAL-01/PRODUCT-05/S7d.3d — actual Android emulator WebView + IDB evidence.
// Only the isolated synthetic debug APK. No release install and no real data.
// localStorage is NOT a non-rollback hardware or external trust root.
import {execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {probePackagePids,verifiedProcessStop} from './native-process-probe.mjs';

const pkg='it.trama.registrodocente.lab.v10';
const activity=pkg+'/it.trama.registrodocente.prova.MainActivity';
const api=Number(process.env.VAL01_API);
const candidate=process.env.CANDIDATE_SHA;
assert.ok([32,36].includes(api));
assert.match(candidate||'',/^[0-9a-f]{40}$/);
const adb=(...args)=>execFileSync('adb',args,{encoding:'utf8',timeout:30000}).trim();
const probe=()=>probePackagePids(adb,pkg);
const pause=ms=>new Promise(r=>setTimeout(r,ms));
mkdirSync('v10-evidence/native',{recursive:true});
const stages=[];
function stage(name,details={}){
 stages.push({stage:name,status:'PASS',...details});
 writeFileSync('v10-evidence/native/result.json',JSON.stringify({
  candidate,api,package:pkg,platform:'android-emulator-webview',
  syntheticOnly:true,productionRelease:false,
  antiRollbackAuthority:'NOT_PROVIDED',results:stages
 },null,2)+'\n');
 console.log(name,'PASS');
}
async function until(fn,label,timeout=60000){
 const end=Date.now()+timeout;
 while(Date.now()<end){
  try{const value=await fn();if(value)return value;}catch{}
  await pause(500);
 }
 throw Error(label);
}
let socket=null,sequence=0;
const pending=new Map();
function disconnect(){
 socket?.close();socket=null;
 for(const [id,p] of pending){
  clearTimeout(p.timeout);p.reject(Error('WebView disconnected'));pending.delete(id);
 }
 try{adb('forward','--remove','tcp:9222');}catch{}
}
async function connect(){
 socket=await until(async()=>{
  const pids=probe();if(pids.length!==1)return null;
  adb('forward','tcp:9222','localabstract:webview_devtools_remote_'+pids[0]);
  const response=await fetch('http://127.0.0.1:9222/json/list',
   {signal:AbortSignal.timeout(2000)});
  const targets=await response.json();
  const target=targets.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&
   /^https?:\/\/localhost(?:[:/]|$)/.test(x.url));
  if(!target)return null;
  const s=new WebSocket(target.webSocketDebuggerUrl.replace(/ws:\/\/[^/]+/,'ws://127.0.0.1:9222'));
  await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{s.close();reject(Error('CDP unavailable'));},3000);
   s.addEventListener('open',()=>{clearTimeout(timer);resolve();},{once:true});
   s.addEventListener('error',()=>{clearTimeout(timer);reject(Error('CDP rejected'));},{once:true});
  });
  s.addEventListener('message',event=>{
   const m=JSON.parse(event.data),entry=pending.get(m.id);
   if(!entry)return;
   pending.delete(m.id);clearTimeout(entry.timeout);
   if(m.error||m.result?.exceptionDetails)entry.reject(Error('WebView fixture rejected'));
   else entry.resolve(m.result?.result?.value);
  });
  return s;
 },'Native WebView unavailable');
}
function evaluate(expression,timeout=40000){
 const id=++sequence;
 return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{pending.delete(id);reject(Error('Native fixture timeout'));},timeout);
  pending.set(id,{resolve,reject,timeout:timer});
  socket.send(JSON.stringify({id,method:'Runtime.evaluate',
   params:{expression,awaitPromise:true,returnByValue:true}}));
 });
}
const call=(method,...args)=>evaluate('window.__val01V10Physical['+
 JSON.stringify(method)+'](...'+JSON.stringify(args)+')');
async function launch(){
 adb('shell','am','start','-W','-n',activity);
 await connect();
 await until(()=>evaluate('typeof window.__val01V10Physical==="object"'),
  'Missing synthetic V10 WebView fixture');
 assert.equal(probe().length,1);
}
async function forceRestart(){
 disconnect();
 const proof=await verifiedProcessStop({
  probe,forceStop:()=>adb('shell','am','force-stop',pkg)
 });
 await launch();
 return proof;
}
async function main(){
 adb('install','-r',process.env.LAB_APK);
 await launch();
 const status=await call('status');
 assert.equal(status.syntheticOnly,true);
 assert.match(status.storage,/NOT genuine anti-rollback/);
 stage('android-v10-synthetic-boot',{origin:status.origin});
 assert.equal(await call('reset'),'pristine-synthetic-lab');
 assert.equal((await call('first')).outcome.epoch,1);
 const stopped1=await forceRestart();
 assert.deepEqual((await call('inspect')).state,'consistent-synthetic-lab');
 assert.equal((await call('inspect')).epoch,1);
 stage('android-v10-cold-process-epoch1',{forcedStop:true,...stopped1});
 assert.equal((await call('second')).outcome.epoch,2);
 const stopped2=await forceRestart();
 assert.equal((await call('inspect')).epoch,2);
 stage('android-v10-cold-process-epoch2',{forcedStop:true,...stopped2});
 assert.equal((await call('rollbackPair')).state,'quarantined');
 const stopped3=await forceRestart();
 assert.equal((await call('inspect')).state,'quarantined');
 stage('android-v10-rollback-pair-quarantined',{forcedStop:true,...stopped3});
 assert.equal(await call('reset'),'pristine-synthetic-lab');
 const fault=await call('faultAfterPair');
 assert.equal(fault.rejected,true);
 assert.equal(fault.inspection.state,'quarantined');
 assert.equal(fault.pairPresent,true);
 const stopped4=await forceRestart();
 assert.equal((await call('inspect')).state,'quarantined');
 stage('android-v10-interrupted-idb-commit-quarantined',{forcedStop:true,...stopped4});
 assert.equal(await call('reset'),'pristine-synthetic-lab');
 await call('first');
 assert.equal((await call('corruptHead')).state,'quarantined');
 const stopped5=await forceRestart();
 assert.equal((await call('inspect')).state,'quarantined');
 stage('android-v10-missing-head-quarantined',{forcedStop:true,...stopped5});
 assert.equal(await call('reset'),'pristine-synthetic-lab');
 await call('first');await call('second');
 const both=await call('rollbackBoth');
 // Explicitly document FAILURE of anti-rollback assumption for origin storage.
 assert.deepEqual({state:both.state,epoch:both.epoch},
  {state:'consistent-synthetic-lab',epoch:1});
 stage('android-v10-double-rollback-not-detected',
  {limitation:'IndexedDB and localStorage both rolled back; external root absent'});
 disconnect();
}
main().catch(e=>{disconnect();console.error(e);process.exitCode=1;});
