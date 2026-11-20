// Synthetic CI emulator only: no production APK, no data from a user device.
import {execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {parseNativeNodes,resumedActivity,hasArea} from './native-ui-driver.mjs';
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

const nativeRestore=(method,...args)=>evaluate('window.__val01NativeRestore['+JSON.stringify(method)+'](...'+JSON.stringify(args)+')');
const docRestore=(method,...args)=>evaluate('window.__doc01NativeRestore['+JSON.stringify(method)+'](...'+JSON.stringify(args)+')');
const docFileNames={recovery:'Backup_Cifrato_GDPR_2031-01-17.enc.json',target:'Backup_Cifrato_GDPR_2031-01-18.enc.json'};
const fileNames={recovery:'Backup_Cifrato_GDPR_2031-01-15.enc.json',target:'Backup_Cifrato_GDPR_2031-01-16.enc.json'};
const doc=n=>/documentsui/i.test(n.pkg);
function nodes(){
 adb('shell','rm','-f','/sdcard/val01-ui.xml');
 adb('shell','uiautomator','dump','/sdcard/val01-ui.xml');
 return parseNativeNodes(adb('shell','cat','/sdcard/val01-ui.xml'));
}
const find=(predicate,label)=>until(()=>nodes().find(n=>hasArea(n)&&predicate(n)),label,45000);
function tap(n){assert.ok(hasArea(n));const [l,t,r,b]=n.bounds;adb('shell','input','tap',String(Math.round((l+r)/2)),String(Math.round((t+b)/2)));}
const foreground=()=>resumedActivity(adb('shell','dumpsys','activity','activities'),pkg);
async function downloads(){
 await find(n=>doc(n)&&(/show roots|open navigation drawer|mostra radici/i.test(n.desc)||/^(Downloads|Download)$/i.test(n.text)||/^(save|salva)$/i.test(n.text)),'Native picker not visible');
 if(!nodes().some(n=>doc(n)&&/^(Downloads|Download)$/i.test(n.text))){
  tap(await find(n=>doc(n)&&/show roots|open navigation drawer|mostra radici/i.test(n.desc),'Native picker roots missing'));
  tap(await find(n=>doc(n)&&/^(Downloads|Download)$/i.test(n.text),'Downloads root missing'));
 }
}
async function startPicker(operation,kind){
 assert.equal(await nativeRestore(operation,kind),true);
 await downloads();
}
async function pickerResult(kind,phase){
 await until(foreground,'Picker did not return',30000);
 const r=await until(async()=>{const s=await nativeRestore('status');return ['written','read','cancelled','error'].includes(s.phase)?s:null;},'Native picker operation did not settle',45000);
 assert.equal(r.kind,kind);assert.equal(r.phase,phase);return r;
}
async function writeCopy(kind,expected){
 await startPicker('write',kind);
 tap(await find(n=>doc(n)&&/^(save|salva)$/i.test(n.text),'Native Save missing'));
 const written=await pickerResult(kind,'written');
 const bytes=execFileSync('adb',['exec-out','cat','/sdcard/Download/'+fileNames[kind]],{timeout:30000});
 const actual={bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
 assert.deepEqual(actual,expected);assert.equal(written.bytes,actual.bytes);assert.equal(written.sha256,actual.sha256);
 return actual;
}
async function readCopy(kind,expected){
 await startPicker('read',kind);
 const row=await find(n=>doc(n)&&n.text===fileNames[kind]&&!/preview|anteprima/i.test(n.desc),'Exact encrypted filename missing');
 tap(row);
 await until(()=>foreground()||nodes().some(n=>doc(n)&&/^(open|apri)$/i.test(n.text)),'File selection did not complete',20000);
 if(!foreground())tap(await find(n=>doc(n)&&/^(open|apri)$/i.test(n.text),'Native Open missing'));
 const read=await pickerResult(kind,'read');
 assert.equal(read.bytes,expected.bytes);assert.equal(read.sha256,expected.sha256);
 return {bytes:read.bytes,sha256:read.sha256};
}
async function docPickerResult(kind,phase){
 await until(foreground,'V8 picker did not return',30000);
 const status=await until(async()=>{
  const s=await docRestore('status');
  return ['written','read','cancelled','error'].includes(s.phase)?s:null;
 },'V8 picker did not settle',45000);
 assert.equal(status.kind,kind);assert.equal(status.phase,phase);
 return status;
}
async function startDocPicker(operation,kind){
 assert.equal(await docRestore(operation,kind),true);
 await downloads();
}
async function writeDocCopy(kind,expected){
 await startDocPicker('write',kind);
 tap(await find(n=>doc(n)&&/^(save|salva)$/i.test(n.text),'Native V8 Save missing'));
 const written=await docPickerResult(kind,'written');
 const bytes=execFileSync('adb',['exec-out','cat','/sdcard/Download/'+docFileNames[kind]],{timeout:30000});
 const actual={bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
 assert.deepEqual(actual,expected);
 assert.equal(written.bytes,actual.bytes);assert.equal(written.sha256,actual.sha256);
 return actual;
}
async function readDocCopy(kind,expected){
 await startDocPicker('read',kind);
 tap(await find(n=>doc(n)&&n.text===docFileNames[kind]&&!/preview|anteprima/i.test(n.desc),'Native V8 file missing'));
 await until(()=>foreground()||nodes().some(n=>doc(n)&&/^(open|apri)$/i.test(n.text)),'Native V8 selected file did not return',20000);
 if(!foreground())tap(await find(n=>doc(n)&&/^(open|apri)$/i.test(n.text),'Native V8 Open missing'));
 const read=await docPickerResult(kind,'read');
 assert.deepEqual({bytes:read.bytes,sha256:read.sha256},expected);
 return {bytes:read.bytes,sha256:read.sha256};
}
async function cancelPicker(){
 for(let attempt=0;attempt<4;attempt++){
  if(foreground())return;
  assert.ok((await until(()=>{const view=nodes();return view.some(doc)?view:null;},'DocumentsUI not active',10000)).some(doc));
  adb('shell','input','keyevent','4');
  try{await until(foreground,'Picker remains open',5000);return;}catch{}
 }
 throw Error('Picker did not return after bounded Back actions');
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

 // Reuse the very same DB2 state and native shell, without another emulator build.
 const copies=await nativeRestore('createCopies');
 const recovery=await writeCopy('recovery',copies.recovery),target=await writeCopy('target',copies.target);
 assert.notEqual(recovery.sha256,target.sha256);
 assert.deepEqual(await call('physicalDigest'),last);
 stage('native-v7-saf-write-readback',{recovery,target});
 await startPicker('read','target');await cancelPicker();await pickerResult('target','cancelled');
 assert.equal(await nativeRestore('prepare'),'rejected');
 assert.deepEqual(await call('physicalDigest'),last);
 stage('native-v7-saf-cancellation');
 const recoveryRead=await readCopy('recovery',recovery),targetRead=await readCopy('target',target);
 assert.deepEqual(await call('physicalDigest'),last);
 stage('native-v7-saf-selected-copies',{recovery:recoveryRead,target:targetRead});
 assert.equal(await nativeRestore('prepare'),'prepared');
 assert.deepEqual(await call('physicalDigest'),last);
 assert.equal(await nativeRestore('commit',true),'committed');
 assert.equal(await nativeRestore('commit',true),'rejected');
 const restored=await call('physicalDigest');
 assert.deepEqual(Object.keys(restored).sort(),Object.keys(last).sort());
 assert.ok(Object.keys(restored).every(k=>restored[k]!==last[k]));
 stage('native-v7-authorized-restore-and-replay-refusal');
 const restoreStop=await forceRestart(installation);
 assert.deepEqual(await nativeRestore('summary'),{...withdrawn,changes:4,records:8,extra:[{state:'not_observed',studentId:'s4',criterionRevisionId:'c2'}]});
 assert.deepEqual(await call('physicalDigest'),restored);
 assert.deepEqual(await call('downgrade'),{rejected:true,version:2});
 stage('native-v7-restored-cold-reopen',restoreStop);

 // DOC-01/D4c3d2: same isolated native APK, same physical DB2 archive.
 // Existing twelve VAL-01 V7 stages must all have passed before entering V8.
 const seededHistory=await docRestore('seedHistory');
 assert.deepEqual(seededHistory,{events:1,changes:5,grades:['8'],assessmentRevisions:8,
  historyValid:true,eventKinds:['append'],version:2});
 const documentBefore=await call('physicalDigest');
 assert.deepEqual(Object.keys(documentBefore).sort(),Object.keys(restored).sort());
 assert.deepEqual(Object.keys(documentBefore).filter(k=>documentBefore[k]!==restored[k]).sort(),['appData','meta']);
 stage('native-v8-document-history-commit');

 const v8Copies=await docRestore('createCopies');
 const v8Recovery=await writeDocCopy('recovery',v8Copies.recovery);
 const v8Target=await writeDocCopy('target',v8Copies.target);
 assert.notEqual(v8Recovery.sha256,v8Target.sha256);
 assert.deepEqual(await call('physicalDigest'),documentBefore);
 stage('native-v8-saf-write-readback',{recovery:v8Recovery,target:v8Target});

 await startDocPicker('read','target');await cancelPicker();await docPickerResult('target','cancelled');
 assert.equal(await docRestore('prepare'),'rejected');
 assert.deepEqual(await call('physicalDigest'),documentBefore);
 stage('native-v8-saf-cancellation');

 const v8RecoveryRead=await readDocCopy('recovery',v8Recovery);
 const v8TargetRead=await readDocCopy('target',v8Target);
 assert.deepEqual(await call('physicalDigest'),documentBefore);
 stage('native-v8-saf-selected-copies',{recovery:v8RecoveryRead,target:v8TargetRead});

 assert.equal(await docRestore('prepare'),'prepared');
 assert.deepEqual(await call('physicalDigest'),documentBefore);
 assert.equal(await docRestore('commit',true),'committed');
 assert.equal(await docRestore('commit',true),'rejected');
 const documentAfter=await call('physicalDigest');
 assert.deepEqual(Object.keys(documentAfter).sort(),Object.keys(documentBefore).sort());
 assert.equal(Object.keys(documentAfter).length,10);
 assert.ok(Object.keys(documentAfter).every(k=>documentAfter[k]!==documentBefore[k]));
 stage('native-v8-authorized-restore-and-replay-refusal');

 const documentStop=await forceRestart(installation);
 assert.deepEqual(await docRestore('summary'),{events:2,changes:6,grades:['8'],assessmentRevisions:8,
  historyValid:true,eventKinds:['append','revoke'],version:2});
 assert.deepEqual(await call('physicalDigest'),documentAfter);
 assert.deepEqual(await call('downgrade'),{rejected:true,version:2});
 stage('native-v8-restored-cold-reopen',documentStop);
 await call('close');
}finally{disconnect();}
