import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { pullLabV7Bytes } from './native-v7-document-discovery.mjs';
import { LabFailure, classifyFailure, observeUntil, commandBudget, createPendingCommands, withoutObservationScope, cdpEvaluationFailure, normalizeAdbFailure, withinDeadline, bestEffortDiagnostic, createDialogTracker, failureCategories } from './native-lab-runtime.mjs';
const fakeClock = () => {
  let time = 0;
  return { now: () => time, sleep: async ms => { time += ms; }, advance: ms => { time += ms; } };
};
test('legacy UI label cannot erase the observation category or leak payload', () => {
  assert.deepEqual(classifyFailure(new Error('CONDITION_TIMEOUT:UI_TEXT_Ripristina backup cifrato')), {
    category:'INDETERMINATE', code:'OBSERVATION_DEADLINE',
  });
  assert.deepEqual(classifyFailure(new Error('arbitrary private text')), {
    category:'INDETERMINATE', code:'UNKNOWN_FAILURE',
  });
});
test('unknown product failure and assertions are not diagnosed as infrastructure', () => {
  assert.equal(classifyFailure(new Error('NATIVE_V7_EXPORT_REJECTED_BEFORE_SAF')).category,'INDETERMINATE');
  assert.equal(classifyFailure({code:'ERR_ASSERTION'}).code,'ASSERTION_FAILED');
  assert.equal(classifyFailure(new LabFailure('CDP_DISCONNECTED')).category,'INFRASTRUCTURE');
});
test('monotone observation deadline bounds every inherited command budget', async () => {
  const clock = fakeClock(); const budgets = [];
  await assert.rejects(observeUntil(() => { budgets.push(commandBudget(100)); return false; },
    {...clock, timeoutMs:10, intervalMs:4}), e => {
    assert.deepEqual(e.observation,{attempts:3,transientErrors:0,lastCode:null}); return e.code==='OBSERVATION_DEADLINE';
  });
  assert.deepEqual(budgets,[10,6,2]);
});
test('late truth is not accepted', async () => {
  const clock = fakeClock();
  await assert.rejects(observeUntil(() => {clock.advance(12); return true;},
    {...clock,timeoutMs:10}), {code:'OBSERVATION_DEADLINE'});
});
test('read-only retry is explicit and preserves observation accounting', async () => {
  const clock = fakeClock(); let count=0;
  const value=await observeUntil(() => {
    if (++count===1) throw new LabFailure('NATIVE_UI_TREE_UNAVAILABLE');
    return 'ready';
  }, {...clock,timeoutMs:10,intervalMs:1,retryReadErrors:true});
  assert.equal(value,'ready'); assert.equal(count,2);
});
test('transition exception is not retried, even when transport outcome is unknown', async () => {
  const clock = fakeClock(); let actions=0;
  await assert.rejects(observeUntil(() => {actions++; throw new LabFailure('CDP_TIMEOUT');},
    {...clock,timeoutMs:20}), {code:'CDP_TIMEOUT'});
  assert.equal(actions,1);
});
test('assertion propagates immediately even on a read-only loop', async () => {
  const clock=fakeClock(); let count=0;
  await assert.rejects(observeUntil(() => {count++; assert.fail('negative test');},
    {...clock,timeoutMs:10,retryReadErrors:true}), {code:'ERR_ASSERTION'});
  assert.equal(count,1);
});
test('nested scope cannot extend the parent deadline', async () => {
  const clock=fakeClock();
  await assert.rejects(observeUntil(async () => {
    clock.advance(7);
    return observeUntil(() => {assert.equal(commandBudget(100),3); return false;},
      {...clock,timeoutMs:100,intervalMs:5});
  }, {...clock,timeoutMs:10}), {code:'OBSERVATION_DEADLINE'});
});
test('CDP settlement cancels the timer and ignores late responses', async () => {
  const timers=new Set();
  const channel=createPendingCommands({setTimer:fn=>{timers.add(fn);return fn;},clearTimer:fn=>timers.delete(fn)});
  let id;const p=channel.request(n=>{id=n;},20);
  assert.equal(channel.size,1); assert.equal(channel.settle(id,null,42),true);
  assert.equal(await p,42);assert.equal(channel.size,0);assert.equal(timers.size,0);
  assert.equal(channel.settle(id,null,43),false);
});
test('CDP timeout removes command, without retransmission', async () => {
  const timers=new Set();let sends=0;
  const channel=createPendingCommands({setTimer:fn=>{timers.add(fn);return fn;},clearTimer:fn=>timers.delete(fn)});
  const p=channel.request(()=>sends++,20); const check=assert.rejects(p,{code:'CDP_TIMEOUT'});
  [...timers][0]();await check;assert.equal(sends,1);assert.equal(channel.size,0);assert.equal(timers.size,0);
});
test('CDP close rejects every pending command and prohibits later sends', async () => {
  const channel=createPendingCommands();
  const a=assert.rejects(channel.request(()=>{},500),{code:'CDP_DISCONNECTED'});
  const b=assert.rejects(channel.request(()=>{},500),{code:'CDP_DISCONNECTED'});
  channel.close();await Promise.all([a,b]);assert.equal(channel.size,0);
  await assert.rejects(channel.request(()=>assert.fail('send after close'),500),{code:'CDP_DISCONNECTED'});
});
test('synchronous socket send failure clears pending command', async () => {
  const channel=createPendingCommands();
  await assert.rejects(channel.request(()=>{throw Error('private details');},20),{code:'CDP_SEND_FAILED'});
  assert.equal(channel.size,0);
});
test('unsolicited event uses its own deadline, not expired connection scope', async () => {
  const clock=fakeClock();
  await assert.rejects(observeUntil(() => {
    clock.advance(12);
    assert.throws(()=>commandBudget(50),{code:'COMMAND_DEADLINE'});
    assert.equal(withoutObservationScope(()=>commandBudget(50)),50);
    return true;
  }, {...clock,timeoutMs:10}), {code:'OBSERVATION_DEADLINE'});
});

test('CDP control failure preserves legacy button and navigation codes', () => {
  for (const code of ['BUTTON_MATCH_COUNT_0','BUTTON_MATCH_COUNT_2','BUTTON_MATCH_COUNT_3',
    'NAV_NOT_UNIQUE','MISSING_CONTROL','MISSING_INPUT','NEW_CLASS_MISSING','AMBIGUOUS_BUTTON',
    'SYNTHETIC_PROFILE_INPUT_MISSING','HOME_CONFIRM_DIALOG_MISSING','HOME_CONFIRM_NOT_UNIQUE']) {
    assert.deepEqual(classifyFailure(cdpEvaluationFailure('Error: '+code+'\n    at synthetic private stack')), {
      category:'INDETERMINATE',code,
    });
  }
  assert.equal(classifyFailure(new Error('CDP_EVALUATION_REJECTED:BUTTON_MATCH_COUNT_0')).code,'BUTTON_MATCH_COUNT_0');
});
test('CDP unknown detail and substring impostors are not persisted or misclassified', () => {
  for (const detail of [undefined,'secret value','Error: private BUTTON_MATCH_COUNT_0 suffix',
    'Error: BUTTON_MATCH_COUNT_0 secret suffix','Error: other\nBUTTON_MATCH_COUNT_0','BUTTON_MATCH_COUNT_9']) {
    assert.deepEqual(classifyFailure(cdpEvaluationFailure(detail)),{
      category:'INDETERMINATE',code:'CDP_EVALUATION_REJECTED',
    });
  }
  for (const [name,code] of [['ReferenceError','CDP_REFERENCE_ERROR'],['TypeError','CDP_TYPE_ERROR'],
    ['InvalidStateError','CDP_INVALID_STATE_ERROR']]) {
    assert.deepEqual(classifyFailure(cdpEvaluationFailure(name+': private value')),{
      category:'INDETERMINATE',code,
    });
  }
});
test('a rejected CDP control command cannot be retried as observation', async () => {
  let calls=0;const clock=fakeClock();
  await assert.rejects(observeUntil(()=>{
    calls++;throw cdpEvaluationFailure('Error: BUTTON_MATCH_COUNT_0');
  },{...clock,timeoutMs:20,retryReadErrors:true}),{code:'BUTTON_MATCH_COUNT_0'});
  assert.equal(calls,1);
});

test('R02 rejects late CDP reply before delayed timer executes',async()=>{
  let now=0;const timers=new Set();let id,sends=0;
  const channel=createPendingCommands({now:()=>now,setTimer:fn=>{timers.add(fn);return fn;},clearTimer:fn=>timers.delete(fn)});
  const result=channel.request(n=>{id=n;sends++;},20);
  const rejection=assert.rejects(result,{code:'CDP_TIMEOUT'});
  now=21;assert.equal(channel.settle(id,null,true),true);
  await rejection;assert.equal(sends,1);assert.equal(channel.size,0);assert.equal(timers.size,0);
});
test('R03 shared scope rejects late successful physical read',async()=>{
  const clock=fakeClock();
  await assert.rejects(observeUntil(()=>{
    assert.equal(commandBudget(30000),15);
    clock.advance(16);return {bytes:400};
  },{...clock,timeoutMs:15,retryReadErrors:true,retryCodes:['NATIVE_V7_PHYSICAL_READ_UNAVAILABLE']}),{code:'OBSERVATION_DEADLINE'});
});
test('R03 finite deadline rejects late result',async()=>{
  const clock=fakeClock();
  await assert.rejects(withinDeadline(()=>{clock.advance(20);return true;},{now:clock.now,timeoutMs:10}),{code:'COMMAND_DEADLINE'});
});
test('R04 ADB offline and timeout retain safe codes',()=>{
  assert.equal(normalizeAdbFailure({code:'ETIMEDOUT'}).code,'ADB_TRANSPORT_TIMEOUT');
  assert.equal(normalizeAdbFailure({stderr:Buffer.from('adb: device offline\n')}).code,'ADB_TRANSPORT_OFFLINE');
  const raw=new Error('other failure');assert.equal(normalizeAdbFailure(raw),raw);
});
test('R04 failed diagnosis does not replace primary error',async()=>{
  const primary=new LabFailure('ADB_TRANSPORT_OFFLINE');
  try{throw primary;}catch(error){
    assert.equal(await bestEffortDiagnostic(()=>{throw Error('diagnostic unavailable');}),null);
    assert.equal(error,primary);
  }
});
test('R05 dialog ACK counts only confirmed command; unknown outcome is sticky',async()=>{
  const tracker=createDialogTracker();let release,sends=0,acks=0;
  tracker.track(()=>{sends++;return new Promise(r=>{release=r;});},()=>acks++);
  await Promise.resolve();assert.equal(acks,0);assert.equal(tracker.snapshot().requested,1);
  release();await tracker.flush();assert.equal(acks,1);
  tracker.track(()=>{sends++;throw new LabFailure('CDP_TIMEOUT');},()=>acks++);
  await assert.rejects(tracker.flush(),{code:'CDP_DIALOG_OUTCOME_UNKNOWN'});
  assert.throws(()=>tracker.track(()=>sends++),{code:'CDP_DIALOG_OUTCOME_UNKNOWN'});
  assert.equal(sends,2);assert.equal(acks,1);assert.equal(tracker.snapshot().failed,true);
});
test('R05 PRODUCT category is reserved and not assigned by raw failure text',()=>{
  assert.ok(failureCategories.includes('PRODUCT'));
  assert.equal(classifyFailure(Error('PRODUCT')).category,'INDETERMINATE');
});

test('R03 real pull adapter inherits shared command budget',async()=>{
  const clock=fakeClock();
  const bytes=await withinDeadline(()=>pullLabV7Bytes('Backup_Valutazioni_V7_2031-01-15.enc.json',(cmd,args,opts)=>{
    assert.equal(cmd,'adb');assert.equal(args[0],'pull');
    assert.equal(opts.timeout,100);assert.equal(opts.killSignal,'SIGKILL');
    writeFileSync(args[2],Buffer.from('synthetic'));
  }),{now:clock.now,timeoutMs:100});
  assert.equal(bytes.toString(),'synthetic');
});

import { isInteractiveElement, classifySurface, waitPublicSurface, bootReady, versionFacts, completeFingerprint, safeSurfaceTrace, sampleBootReadiness, waitBootReadiness, createPublicAuthentication } from './native-lab-readiness.mjs';
const readyFrame={foreground:true,documentVisible:true,brand:true,privacy:true,home:true};
test('Q3 boot needs ready transport, completed boot, stopped animation and package manager',()=>{
  const f={transport:'device',boot:'1',animation:'stopped',packageManager:'package:/system/framework/framework-res.apk'};
  assert.equal(bootReady(f),true);
  for(const key of Object.keys(f))assert.equal(bootReady({...f,[key]:'unknown'}),false);
});
test('Q3 fingerprint extracts only known version fields and rejects missing or injected data',()=>{
  const v=versionFacts({adb:'Android Debug Bridge version 1.0.41\nVersion 36.0.0-1234',emulator:'Android emulator version 36.2.1.0 (build_id 123)',webview:'Current WebView package (name, version): (com.google.android.webview, 130.0.1.2)',androidBuild:'google/sdk_gphone/x86:12/ABC/123:userdebug/dev-keys',runnerImage:'ubuntu22',runnerVersion:'20261124.1',node:'v22.15.0',chromium:'130.0.1.2'});
  assert.equal(v.adb,'1.0.41');
  assert.equal(v.emulator,'36.2.1.0');assert.equal(v.webviewVersion,'130.0.1.2');
  assert.equal(versionFacts({androidBuild:'private text\nother'}).androidBuild,null);
  assert.equal(v.platformTools,'36.0.0');assert.equal(v.platformToolsBuild,'1234');assert.equal(v.emulatorBuild,'123');
  assert.equal(completeFingerprint(v),true);
  assert.equal(completeFingerprint({...v,platformTools:null}),false);
});
test('Q3 destination rejects stale page, background, gate, missing controls',()=>{
  assert.equal(classifySurface(readyFrame,'privacy'),'ready');
  for(const f of [{...readyFrame,foreground:false},{...readyFrame,documentVisible:false},{...readyFrame,protectedField:true},{...readyFrame,privacy:false},{...readyFrame,brand:false}])
    assert.notEqual(classifySurface(f,'privacy'),'ready');
  assert.equal(classifySurface({...readyFrame,lock:true,lockControls:true},'privacy'),'locked');
  assert.equal(classifySurface({...readyFrame,gateError:true},'privacy'),'gate-error');
  assert.equal(classifySurface({foreground:true,documentVisible:true,setup:true,professionalChoice:true},'setup'),'ready');
  assert.equal(classifySurface({...readyFrame,lock:true,lockControls:true},'lock'),'ready');
});
test('Q3 actual predicate refuses hidden or inert ancestor, disabled and background controls',()=>{
  const doc={visibilityState:'visible'};
  const style=()=>({visibility:'visible',display:'block',opacity:'1',pointerEvents:'auto'});
  const e={closest:()=>null,matches:()=>false,getClientRects:()=>[{}],parentElement:null};
  assert.equal(isInteractiveElement(e,doc,style),true);
  assert.equal(isInteractiveElement({...e,closest:()=>({})},doc,style),false);
  assert.equal(isInteractiveElement({...e,matches:()=>true},doc,style),false);
  assert.equal(isInteractiveElement(e,{visibilityState:'hidden'},style),false);
  assert.equal(isInteractiveElement({...e,parentElement:{hidden:true}},doc,n=>n.hidden?{...style(),opacity:'0'}:style()),false);
});
test('Q3 lock observed before one real authentication and two ready samples',async()=>{
  const clock=fakeClock();let i=0,auth=0;
  const frames=[{...readyFrame,lock:true,lockControls:true},readyFrame,readyFrame];
  await waitPublicSurface({sample:()=>frames[i++],destination:'privacy',authenticate:async()=>{auth++;},timeoutMs:5000,now:clock.now,sleep:clock.sleep});
  assert.equal(auth,1);assert.equal(i,3);
});
test('Q3 uncertain authentication and second lock never cause repeated submit',async()=>{
  for(const fail of [true,false]){
    const clock=fakeClock();let calls=0;
    await assert.rejects(waitPublicSurface({sample:()=>({...readyFrame,lock:true,lockControls:true}),destination:'privacy',
      authenticate:async()=>{calls++;if(fail)throw new LabFailure('CDP_TIMEOUT');},timeoutMs:5000,now:clock.now,sleep:clock.sleep}),
      {code:fail?'CDP_TIMEOUT':'PUBLIC_RELOCK_AFTER_AUTH'});
    assert.equal(calls,1);
  }
});
test('Q3 application error blocks instead of being labelled transport; no arbitrary trace data',async()=>{
  const clock=fakeClock();
  await assert.rejects(waitPublicSurface({sample:()=>({...readyFrame,gateError:true}),destination:'privacy',timeoutMs:5000,now:clock.now,sleep:clock.sleep}),{code:'PUBLIC_GATE_ERROR'});
  assert.equal(classifyFailure(new LabFailure('PUBLIC_GATE_ERROR')).category,'INDETERMINATE');
  assert.deepEqual(safeSurfaceTrace([{destination:'privacy',state:'ready',payload:'private'},{destination:'secret',state:'ready'}]),[{destination:'privacy',state:'ready'}]);
});
test('Q3 incomplete or alternating readiness times out; disconnection propagates',async()=>{
  const clock=fakeClock();let i=0;
  await assert.rejects(waitPublicSurface({sample:()=>i++%2===0?readyFrame:{...readyFrame,privacy:false},destination:'privacy',timeoutMs:1000,now:clock.now,sleep:clock.sleep}),{code:'OBSERVATION_DEADLINE'});
  await assert.rejects(waitPublicSurface({sample:()=>{throw new LabFailure('CDP_DISCONNECTED');},destination:'privacy',timeoutMs:1000}),{code:'CDP_DISCONNECTED'});
});

test('Q3-R01 real boot sampler short circuits every not-ready predecessor',()=>{
  const steps=[['get-state'],['shell','getprop','sys.boot_completed'],['shell','getprop','init.svc.bootanim'],['shell','pm','path','android']];
  const values=['device','1','stopped','package:/system/framework/framework-res.apk'];
  for(let stop=0;stop<steps.length;stop++){
    const seen=[];
    const ready=sampleBootReadiness((...args)=>{
      const index=seen.length;seen.push(args);
      return index===stop?'not-ready':values[index];
    });
    assert.equal(ready,false);assert.deepEqual(seen,steps.slice(0,stop+1));
  }
  let i=0;assert.equal(sampleBootReadiness((...args)=>{assert.deepEqual(args,steps[i]);return values[i++];}),true);
});
test('Q3-R01 real boot wait retries only known missing service within shared budget',async()=>{
  const clock=fakeClock();let polls=0,pm=0;
  const adb=(...args)=>{
    if(args[0]==='get-state'){polls++;return 'device';}
    if(args[2]==='sys.boot_completed')return polls===1?'0':'1';
    if(args[2]==='init.svc.bootanim')return 'stopped';
    assert.equal(args.join(' '),'shell pm path android');
    pm++;assert.ok(commandBudget(90000)<=5000);
    if(pm===1)throw Object.assign(new Error('private shell detail'),{status:1,stderr:"cmd: Can't find service: package\n",stdout:''});
    return 'package:/system/framework/framework-res.apk';
  };
  assert.equal(await waitBootReadiness(adb,{now:clock.now,sleep:clock.sleep,timeoutMs:5000,intervalMs:1000}),true);
  assert.equal(polls,3);assert.equal(pm,2);
});
test('Q3-R01 unexpected package manager error is never converted to transient readiness',async()=>{
  const clock=fakeClock();let polls=0;
  const unexpected=Object.assign(new Error('unexpected package error'),{status:1,stderr:'Permission denied'});
  await assert.rejects(waitBootReadiness((...args)=>{
    if(args[0]==='get-state'){polls++;return 'device';}
    if(args[2]==='sys.boot_completed')return '1';
    if(args[2]==='init.svc.bootanim')return 'stopped';
    throw unexpected;
  },{now:clock.now,sleep:clock.sleep,timeoutMs:5000}),e=>e===unexpected);
  assert.equal(polls,1);
});
test('Q3-R01 missing package service timeout retains classified observation evidence',async()=>{
  const clock=fakeClock();let polls=0;
  await assert.rejects(waitBootReadiness((...args)=>{
    if(args[0]==='get-state'){polls++;return 'device';}
    if(args[2]==='sys.boot_completed')return '1';
    if(args[2]==='init.svc.bootanim')return 'stopped';
    return 'Error: Could not access the Package Manager. Is the system running?';
  },{now:clock.now,sleep:clock.sleep,timeoutMs:2100,intervalMs:1000}),e=>{
    assert.equal(e.code,'PREFLIGHT_BOOT_UNREADY');
    assert.deepEqual(e.observation,{attempts:3,transientErrors:3,lastCode:'PREFLIGHT_PACKAGE_SERVICE_PENDING'});return true;
  });
  assert.equal(polls,3);
});
test('Q3-R02 real authentication adapter fills and submits exactly once within destination wait',async()=>{
  const clock=fakeClock();const actions=[];
  const locked={...readyFrame,lock:true,lockControls:true,protectedField:true};
  let frames=[locked,readyFrame,readyFrame];
  const authenticate=createPublicAuthentication({
    waitForLock:async()=>{actions.push('observed-real-lock');},
    fill:async()=>{actions.push('field');},
    submit:async()=>{actions.push('submit');},
    waitForSession:async()=>{actions.push('ready-session');}
  });
  await waitPublicSurface({sample:()=>frames.shift(),destination:'privacy',authenticate,now:clock.now,sleep:clock.sleep,timeoutMs:5000});
  assert.deepEqual(actions,['observed-real-lock','field','submit','ready-session']);
  await assert.rejects(authenticate(),{code:'PUBLIC_RELOCK_AFTER_AUTH'});
  assert.equal(actions.filter(x=>x==='submit').length,1);
});
test('Q3-R02 real adapter blocks second lock and uncertain fill/submit outcomes',async()=>{
  const locked={...readyFrame,lock:true,lockControls:true,protectedField:true};
  for(const mode of ['fill','submit','relock']){
    const clock=fakeClock(),actions=[];
    const authenticate=createPublicAuthentication({
      waitForLock:async()=>{actions.push('lock');},
      fill:async()=>{actions.push('field');if(mode==='fill')throw new LabFailure('CDP_TIMEOUT');},
      submit:async()=>{actions.push('submit');if(mode==='submit')throw new LabFailure('CDP_TIMEOUT');},
      waitForSession:async()=>{actions.push('session');}
    });
    await assert.rejects(waitPublicSurface({sample:()=>locked,destination:'privacy',authenticate,now:clock.now,sleep:clock.sleep,timeoutMs:5000}),
      {code:mode==='relock'?'PUBLIC_RELOCK_AFTER_AUTH':'CDP_TIMEOUT'});
    await assert.rejects(authenticate(),{code:'PUBLIC_RELOCK_AFTER_AUTH'});
    assert.equal(actions.filter(x=>x==='field').length,1);
    assert.equal(actions.filter(x=>x==='submit').length,mode==='fill'?0:1);
  }
});
test('Q3-R02 separate positively observed lifecycle boundaries permit four independent SAF unlocks',async()=>{
  let fills=0,submits=0,locks=0,sessions=0;
  for(let boundary=0;boundary<4;boundary++){
    const authenticate=createPublicAuthentication({
      waitForLock:async()=>{locks++;},fill:async()=>{fills++;},
      submit:async()=>{submits++;},waitForSession:async()=>{sessions++;}
    });
    await authenticate();await assert.rejects(authenticate(),{code:'PUBLIC_RELOCK_AFTER_AUTH'});
  }
  assert.deepEqual({locks,fills,submits,sessions},{locks:4,fills:4,submits:4,sessions:4});
});
