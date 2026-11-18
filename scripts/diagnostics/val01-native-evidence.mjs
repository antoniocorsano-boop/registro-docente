// Synthetic CI emulator only: no production APK, no data from a user device.
import {execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {probePackagePids,verifiedProcessStop} from './native-process-probe.mjs';

const pkg='it.trama.registrodocente.lab.val01';
const activity=pkg+'/it.trama.registrodocente.prova.MainActivity';
const api=Number(process.env.VAL01_API);
assert.ok([32,36].includes(api));
assert.match(process.env.CANDIDATE_SHA||'',/^[a-f0-9]{40}$/);
const adb=(...args)=>execFileSync('adb',args,{encoding:'utf8',timeout:30000}).trim();
const probe=()=>probePackagePids(adb,pkg);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const results=[];
mkdirSync('native-evidence',{recursive:true});
function stage(name,details={}){
 results.push({stage:name,status:'PASS',...details});
 writeFileSync('native-evidence/result.json',JSON.stringify({candidate:process.env.CANDIDATE_SHA,api,scope:'synthetic native storage fixture; not production UI',package:pkg,productionRelease:false,results},null,2));
 console.log(name,'PASS');
}
async function until(fn,label,timeout=60000){
 const end=Date.now()+timeout;
 while(Date.now()<end){try{const r=await fn();if(r)return r;}catch{}await sleep(500);}
 throw Error(label);
}
let ws=null,seq=0;
const pending=new Map();
function disconnect(){
 ws?.close();ws=null;
 for(const [id,p] of pending){clearTimeout(p.timer);p.reject(Error('CDP disconnected'));pending.delete(id);}
 try{adb('forward','--remove','tcp:9222');}catch{}
}
async function connect(){
 ws=await until(async()=>{
  const pids=probe();if(pids.length!==1)return null;
  adb('forward','tcp:9222','localabstract:webview_devtools_remote_'+pids[0]);
  const response=await fetch('http://127.0.0.1:9222/json/list',{signal:AbortSignal.timeout(2000)});
  const target=(await response.json()).find(t=>t.type==='page'&&t.webSocketDebuggerUrl&&/^https?:\/\/localhost(?:[:/]|$)/.test(t.url));
  if(!target)return null;
  const socket=new WebSocket(target.webSocketDebuggerUrl.replace(/ws:\/\/[^/]+/,'ws://127.0.0.1:9222'));
  await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{socket.close();reject(Error('CDP connect timeout'));},3000);
   socket.addEventListener('open',()=>{clearTimeout(timer);resolve();},{once:true});
   socket.addEventListener('error',()=>{clearTimeout(timer);reject(Error('CDP connect error'));},{once:true});
  });
  socket.addEventListener('message',e=>{const m=JSON.parse(e.data),p=pending.get(m.id);if(p){pending.delete(m.id);clearTimeout(p.timer);m.error||m.result?.exceptionDetails?p.reject(Error('Fixture evaluation failed')):p.resolve(m.result?.result?.value);}});
  return socket;
 },'Native WebView unavailable');
}
function evaluate(expression,timeout=30000){
 const id=++seq;
 return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{pending.delete(id);reject(Error('Fixture evaluation timeout'));},timeout);
  pending.set(id,{timer,resolve,reject});ws.send(JSON.stringify({id,method:'Runtime.evaluate',params:{expression,awaitPromise:true,returnByValue:true}}));
 });
}
const call=(method,...args)=>evaluate('window.__val01Db2Evidence['+JSON.stringify(method)+'](...'+JSON.stringify(args)+')');
async function launch(){
 adb('shell','am','start','-W','-n',activity);
 await connect();
 await until(()=>evaluate('typeof window.__val01Db2Evidence==="object"'),'Native fixture missing');
 assert.equal(probe().length,1);
}
function identity(){
 const d=adb('shell','dumpsys','package',pkg);
 const uid=d.match(/\b(?:userId|appId)=(\d+)/)?.[1],first=d.match(/\bfirstInstallTime=([^\n]+)/)?.[1]?.trim();
 assert.ok(uid&&first);return {uid,first};
}
async function forceRestart(expectedIdentity){
 disconnect();
 const proof=await verifiedProcessStop({probe,forceStop:()=>adb('shell','am','force-stop',pkg)});
 await launch();
 assert.deepEqual(identity(),expectedIdentity);
 assert.equal(await call('versions'),2);
 // New JS owner must be absent until the fixture explicitly authenticates.
 await assert.rejects(call('summary'),/evaluation failed/);
 await call('open');
 return proof;
}
const start={changes:0,states:[],active:[],grades:['8'],records:4};
const observed={changes:1,states:['observed'],active:['observed'],grades:['8'],records:5};
const withdrawn={changes:3,states:['observed','not_observed','withdrawn'],active:[],grades:['8'],records:7};

try{
 assert.equal(Number(adb('shell','getprop','ro.build.version.sdk')),api);
 assert.equal(adb('install','--no-incremental',process.env.LAB_APK).split('\n').filter(x=>x==='Success').length,1);
 await launch();const installation=identity();
 assert.equal(await call('versions'),0);
 assert.deepEqual(await call('seed'),start);
 assert.equal(await call('versions'),2);
 stage('native-db2-seed');
 const initial=await call('physicalDigest');
 const failed=await call('commit','new',true);
 assert.deepEqual(failed,{triggered:true,rejected:true,summary:start});
 assert.deepEqual(await call('physicalDigest'),initial);
 stage('native-atomic-abort');
 const abortStop=await forceRestart(installation);
 assert.deepEqual(await call('summary'),start);
 assert.deepEqual(await call('physicalDigest'),initial);
 stage('native-abort-cold-reopen',abortStop);
 assert.deepEqual((await call('commit','new')).summary,observed);
 const saved=await call('physicalDigest');
 assert.deepEqual(Object.keys(saved).sort(),Object.keys(initial).sort());
 assert.deepEqual(Object.keys(saved).filter(k=>saved[k]!==initial[k]).sort(),['appData','meta']);
 stage('native-evidence-atomic-commit');
 const saveStop=await forceRestart(installation);
 assert.deepEqual(await call('summary'),observed);
 assert.deepEqual(await call('physicalDigest'),saved);
 stage('native-committed-cold-reopen',saveStop);
 assert.deepEqual((await call('commit','correct')).summary.states,['observed','not_observed']);
 assert.deepEqual((await call('commit','withdraw')).summary,withdrawn);
 const last=await call('physicalDigest');
 const historyStop=await forceRestart(installation);
 assert.deepEqual(await call('summary'),withdrawn);
 assert.deepEqual(await call('physicalDigest'),last);
 stage('native-history-cold-reopen',historyStop);
 const backup=await call('backup');
 assert.equal(backup.version,7);assert.equal(backup.verified,'verified');assert.equal(backup.v6Rejected,true);assert.equal(backup.exact,true);assert.equal(backup.changes,3);
 assert.deepEqual(await call('physicalDigest'),last);
 assert.deepEqual(await call('rejectLegacy'),{rejected:true,unchanged:true});
 assert.deepEqual(await call('downgrade'),{rejected:true,version:2});
 assert.deepEqual(await call('physicalDigest'),last);
 stage('native-v7-inspection-and-v6-refusal');
 await call('close');
}finally{disconnect();}
