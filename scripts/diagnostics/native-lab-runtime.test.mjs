import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, existsSync } from 'node:fs';
import { pullLabV7Bytes } from './native-v7-document-discovery.mjs';
import { LabFailure, classifyFailure, observeUntil, commandBudget, commandBudgetInfo, classifyAdbDeadline, createPendingCommands, withoutObservationScope, cdpEvaluationFailure, normalizeAdbFailure, withinDeadline, bestEffortDiagnostic, createDialogTracker, createRecoveryConsentGate, V7_RECOVERY_CONSENT, failureCategories } from './native-lab-runtime.mjs';
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

import { isInteractiveElement, publicSurfaceFrame, publicHomeConfirmation, confirmHomeOnce, classifySafReturnFrame, waitSafReturnLock, classifySurface, waitPublicSurface, sampleDestinationFrame, classifyDestinationObservation, bootReady, versionFacts, completeFingerprint, safeSurfaceTrace, sampleBootReadiness, waitBootReadiness, createPublicAuthentication, bootAnimationState, emulatorIdentity } from './native-lab-readiness.mjs';
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

// Q4 governance: guard exact isolated orchestration without modifying main gates.
test('Q4 wrapper preserves three trials, two APIs, isolated identity and F2 gates',()=>{
  const wrapper=readFileSync(new URL('../../.github/workflows/qa-stability-01-q4.yml',import.meta.url),'utf8');
  const f2=readFileSync(new URL('../../.github/workflows/ap02-f2-native-device.yml',import.meta.url),'utf8');
  for(const s of ['branches: [fix/audit-pre-01-atomic-bootstrap]','github.event.pull_request.number == 414','qa/qa-stability-01-q2','80378e9daab60fe6c389e372c3c79e3dcd09aac0','trial: [1, 2, 3]','fail-fast: false','uses: ./.github/workflows/ap02-f2-native-device.yml','contents: read'])
    assert.ok(wrapper.includes(s),s);
  for(const s of ['branches: [main]','api: [32, 36]','workflow_call:','test "$CANDIDATE_SHA" = "$EVENT_HEAD"','test "$GITHUB_RUN_ATTEMPT" = 1','q4-api{0}-trial{1}-{2}-run{3}-attempt{4}','q4-identity.json','Require exact complete acceptance evidence','Require complete Q3 environment and readiness evidence','.results[4].nativeReauthCount>=4','.results[5].absenceSamples==2','productionRelease==false','syntheticOnly==true','persist-credentials: false'])
    assert.ok(f2.includes(s),s);
  assert.ok(!wrapper.includes('secrets: inherit'));
  assert.ok(!wrapper.includes('contents: write'));
});

test('Q4 preflight and CI-FAST invoke the same complete Node runner as F2',()=>{
  const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
  const runner='scripts/diagnostics/run-native-lab-contracts.mjs';
  const f2=read('.github/workflows/ap02-f2-native-device.yml');
  const q4=read('.github/workflows/qa-stability-01-q4.yml');
  const fast=read('.github/workflows/ci-fast-development.yml');
  const code=read(runner);
  for(const workflow of [f2,q4,fast]){
    assert.ok(workflow.includes('node '+runner));
    assert.ok(workflow.includes("node-version: '22'"));
  }
  assert.ok(q4.includes('needs: preflight'));
  assert.ok(q4.indexOf('node '+runner)<q4.indexOf('    needs: preflight'));
  for(const name of ['native-process-probe','native-ui-driver','native-saf-lifecycle-probe','native-lab-runtime'])
    assert.ok(code.includes('scripts/diagnostics/'+name+'.test.mjs'));
  assert.ok(code.includes("['--test',...tests]"));
});

test('Q4 boot proves absent animation only from empty service and complete process list',()=>{
  assert.equal(bootAnimationState('stopped'), 'stopped');
  assert.equal(bootAnimationState('', 'NAME\ninit\nsystem_server'),'absent-verified');
  for(const list of ['', 'NAME\nsystem_server','NAME\ninit\nbootanimation','NAME\ninit\n/system/bin/bootanimation','error: unavailable'])
    assert.notEqual(bootAnimationState('',list),'absent-verified');
  assert.equal(bootAnimationState('running','NAME\ninit'),'running');
  const states=[],calls=[];
  assert.equal(sampleBootReadiness((...args)=>{
    calls.push(args.join(' '));
    return {'get-state':'device','shell getprop sys.boot_completed':'1','shell getprop init.svc.bootanim':'','shell ps -A -o NAME':'NAME\ninit\nsystem_server','shell pm path android':'package:/system/framework/framework-res.apk'}[args.join(' ')];
  },s=>states.push(s)),true);
  assert.deepEqual(states,['animation-absent-verified','ready-absent-verified']);
  assert.equal(calls.at(-1),'shell pm path android');
});
test('Q4 exact installed emulator identity survives classified version-probe failure, rejects mismatch',()=>{
  const p={packageMetadata:'Pkg.Desc=Android Emulator\nPkg.Revision=37.3.10\n',binarySha256:'a'.repeat(64)};
  const success=emulatorIdentity({...p,probe:{status:0,stdout:'Android emulator version 37.3.10.0 (build_id 16970787)'}});
  assert.equal(success.version,'37.3.10.0');assert.equal(success.source,'executable');
  const failed=emulatorIdentity({...p,probe:{status:1,stderr:'private process detail'}});
  assert.deepEqual(failed,{version:'37.3.10',source:'sdk-package',revision:'37.3.10',binarySha256:'a'.repeat(64),build:null,probeStatus:'nonzero-exit'});
  assert.equal(emulatorIdentity({...p,probe:{status:0,stdout:'Android emulator version 38.0.1.0'}}).version,null);
  assert.equal(emulatorIdentity({...p,binarySha256:null,probe:{status:1}}).version,null);
  assert.equal(emulatorIdentity({...p,packageMetadata:'',probe:{status:1}}).version,null);
});

import { nativeViewState, localPageTargets, identifyPublicTarget, waitUniquePublicTarget, readNativeSnapshot, waitNativeSelection, uniqueNativeControl, requireDocumentsUiTap, safFailureDetail, prepareClassCreation } from './native-lab-transitions.mjs';
const nativeDescription=(overrides={})=>JSON.stringify({attached:true,visible:true,empty:false,width:400,height:800,...overrides});
const target=(id,description=nativeDescription())=>({type:'page',id,url:'http://localhost/',webSocketDebuggerUrl:'ws://localhost/devtools/page/'+id,description});
const setupFrame={documentVisible:true,documentFocused:true,setup:true,professionalChoice:true};
test('Q4-R03 observes unique real setup context twice and rejects unrelated localhost target',async()=>{
  const clock=fakeClock(),states=[],calls=[];
  const selected=await waitUniquePublicTarget({expected:'setup',now:clock.now,sleep:clock.sleep,timeoutMs:5000,
    sample:()=>({pid:17,foreground:true,list:[target('a'),target('b')]}),
    inspect:async x=>{calls.push(x.id);return x.id==='a'?setupFrame:{documentVisible:true,documentFocused:false};},
    onState:s=>states.push(s)});
  assert.equal(selected.id,'a');assert.deepEqual(calls,['a','b','a','b']);
  assert.deepEqual(states.at(-1),{state:'stable',candidates:2,matches:1});
  assert.equal(localPageTargets([{...target('x'),url:'https://evil.example/'}]).length,0);
});
test('Q4-R03 ambiguous and incomplete observations never choose a target',async()=>{
  for(const mode of ['ambiguous','disconnected']){
    const clock=fakeClock();
    await assert.rejects(waitUniquePublicTarget({expected:'setup',now:clock.now,sleep:clock.sleep,timeoutMs:1100,
      sample:()=>({pid:17,foreground:true,list:[target('a'),target('b')]}),
      inspect:async x=>{if(mode==='disconnected'&&x.id==='b')throw new LabFailure('CDP_DISCONNECTED');return setupFrame;}
    }),{code:mode==='ambiguous'?'PREFLIGHT_CDP_TARGET_AMBIGUOUS':'OBSERVATION_DEADLINE'});
  }
});
test('Q4-R03 resets streak on transient ambiguity, PID change and zero targets',async()=>{
  const clock=fakeClock();let i=0;
  const snapshots=[{pid:1,list:[]},{pid:1,list:[target('a')]},{pid:2,list:[target('a')]},{pid:2,list:[target('a'),target('b')]},{pid:2,list:[target('a')]},{pid:2,list:[target('a')]}];
  const chosen=await waitUniquePublicTarget({expected:'setup',now:clock.now,sleep:clock.sleep,timeoutMs:5000,
    sample:()=>({...snapshots[i++],foreground:true}),inspect:async()=>setupFrame});
  assert.equal(chosen.pid,2);assert.equal(i,6);
});
const snapshotXml='<hierarchy><node package="com.android.documentsui" text="Save" enabled="true" bounds="[1,2][10,20]" /></hierarchy>';
test('Q4-R04 dump succeeds then missing snapshot is classified; permission and unknown exits are not retried',()=>{
  for(const [stderr,code] of [['cat: /sdcard/ap02-f2-ui.xml: No such file or directory','NATIVE_UI_TREE_UNAVAILABLE'],['Permission denied','NATIVE_UI_PERMISSION_DENIED'],['unexpected','NATIVE_UI_READ_FAILED']]){
    assert.throws(()=>readNativeSnapshot((...args)=>{
      if(args[1]==='cat')throw Object.assign(new Error('private text'),{status:1,stderr});
      return '';
    }),{code});
  }
  assert.throws(()=>readNativeSnapshot((...args)=>args[1]==='cat'?'<hierarchy>':''),{code:'NATIVE_UI_TREE_UNAVAILABLE'});
  assert.equal(readNativeSnapshot((...args)=>args[1]==='cat'?snapshotXml:'').length,1);
});
test('Q4-R04 stable picker control requires two foreground samples and retries only missing snapshot',async()=>{
  const clock=fakeClock();let reads=0,taps=0;
  const chosen=await waitNativeSelection({now:clock.now,sleep:clock.sleep,timeoutMs:5000,foreground:()=>true,
    read:()=>{reads++;if(reads===2)throw new LabFailure('NATIVE_UI_TREE_UNAVAILABLE');return readNativeSnapshot((...a)=>a[1]==='cat'?snapshotXml:'');},
    select:nodes=>uniqueNativeControl(nodes,n=>n.text==='Save')});
  assert.equal(reads,4);
  requireDocumentsUiTap({foreground:()=>true,node:chosen,tap:()=>{taps++;}});
  assert.throws(()=>requireDocumentsUiTap({foreground:()=>false,node:chosen,tap:()=>{taps++;}}),{code:'NATIVE_UI_FOREGROUND_LOST'});
  assert.equal(taps,1);
  assert.equal(uniqueNativeControl([chosen,chosen],()=>true),null);
  assert.equal(uniqueNativeControl([{...chosen,enabled:false}],()=>true),null);
});
test('Q4-R04 lock during observed DocumentsUI is not labelled pre-picker rejection',()=>{
  assert.equal(safFailureDetail({locked:true,foreground:false,activityTrail:{observedDocumentsUi:true}}),'NATIVE_V7_SAF_OBSERVED_UI_UNAVAILABLE');
  assert.equal(safFailureDetail({locked:true,activityTrail:{observedDocumentsUi:false}}),'NATIVE_V7_VAULT_LOCKED_BEFORE_SAF');
});
test('Q4-R05 class action boundary observes lock, one authentication, stable Home and final check',async()=>{
  const clock=fakeClock();let auth=0,reads=0;
  const locked={...readyFrame,lock:true,lockControls:true,protectedField:true};
  const frames=[locked,readyFrame,readyFrame,readyFrame];
  assert.equal(await prepareClassCreation({sample:()=>{reads++;return frames.shift();},authenticate:async()=>{auth++;},now:clock.now,sleep:clock.sleep,timeoutMs:5000}),true);
  assert.equal(auth,1);assert.equal(reads,4);
});
test('Q4-R05 missing or ambiguous Home button and a late lock fail before class mutation',async()=>{
  const clock=fakeClock();
  await assert.rejects(prepareClassCreation({sample:()=>({...readyFrame,home:false}),now:clock.now,sleep:clock.sleep,timeoutMs:1000}),{code:'OBSERVATION_DEADLINE'});
  const frames=[readyFrame,readyFrame,{...readyFrame,lock:true,lockControls:true,protectedField:true}];
  await assert.rejects(prepareClassCreation({sample:()=>frames.shift(),timeoutMs:3000,now:clock.now,sleep:clock.sleep}),{code:'CLASS_CREATION_CONTROL_CHANGED'});
});

test('Q4 pilot trial 0 must pass on both APIs before three counted trials',()=>{
  const q=readFileSync(new URL('../../.github/workflows/qa-stability-01-q4.yml',import.meta.url),'utf8');
  const f=readFileSync(new URL('../../.github/workflows/ap02-f2-native-device.yml',import.meta.url),'utf8');
  assert.ok(q.includes('trial: 0'));
  assert.ok(q.includes('needs: [preflight, pilot]'));
  assert.ok(q.includes('Qualify selected inherited Bun contracts before Android pilot'));
  assert.ok(f.includes('^[0123]$'));
});

test('Q4-R03 foreground loss after inspection resets the unique-target streak',async()=>{
  const clock=fakeClock();let checks=0;
  await waitUniquePublicTarget({expected:'setup',now:clock.now,sleep:clock.sleep,timeoutMs:5000,
    sample:()=>({pid:17,foreground:true,list:[target('a')]}),inspect:async()=>setupFrame,
    verify:()=>++checks!==2});
  assert.equal(checks,4);
});
test('Q4-R04 transport failure during foreground checks invalidates previous sample',async()=>{
  const clock=fakeClock();let foregroundReads=0,snapshots=0;
  await waitNativeSelection({now:clock.now,sleep:clock.sleep,timeoutMs:5000,
    foreground:()=>{if(++foregroundReads===3)throw new LabFailure('ADB_TRANSPORT_OFFLINE');return true;},
    read:()=>{snapshots++;return readNativeSnapshot((...args)=>args[1]==='cat'?snapshotXml:'');},
    select:nodes=>uniqueNativeControl(nodes,n=>n.text==='Save')});
  assert.equal(snapshots,3);
});

test('Q4 final fractional budget exits observation without launching another command',async()=>{
  const clock=fakeClock();const budgets=[];
  await assert.rejects(observeUntil(()=>{
    budgets.push(commandBudget(100));clock.advance(0.5);return false;
  },{...clock,timeoutMs:10,intervalMs:9}),e=>{
    assert.deepEqual(e.observation,{attempts:1,transientErrors:0,lastCode:null});
    return e.code==='OBSERVATION_DEADLINE';
  });
  assert.deepEqual(budgets,[10]);
});
test('Q4 command deadline inside a transition still propagates without retry',async()=>{
  const clock=fakeClock();let actions=0;
  await assert.rejects(observeUntil(()=>{
    actions++;clock.advance(9.5);commandBudget(100);return true;
  },{...clock,timeoutMs:10,retryReadErrors:false}),{code:'COMMAND_DEADLINE'});
  assert.equal(actions,1);
});
test('Q4 home confirmation requires a unique interactive control and never clicks during reads',()=>{
  let clicks=0,locked=false,eligible=true,duplicate=false,hidden=false;
  const element={closest:()=>null,getClientRects:()=>[{}],disabled:false};
  const button={...element,textContent:'Torna a Oggi',click:()=>clicks++};
  const dialog={...element,contains:e=>e===button};
  const root={querySelector:()=>dialog,querySelectorAll:()=>duplicate?[button,{...button}]:[button]};
  const doc={get visibilityState(){return hidden?'hidden':'visible';},querySelector:s=>
    s.includes('header01-home-confirm')?root:s==='#vault-password'&&locked?{}:null};
  const style=()=>({visibility:'visible'});
  const interactive=e=>Boolean(e)&&eligible&&!hidden;
  const sample=(submit=false)=>publicHomeConfirmation(doc,style,interactive,submit);
  assert.equal(sample().ready,true);assert.equal(clicks,0);
  for(const mode of ['lock','inert','duplicate','hidden']){
    locked=mode==='lock';eligible=mode!=='inert';duplicate=mode==='duplicate';hidden=mode==='hidden';
    assert.equal(sample().ready,false);
    assert.equal(sample(true).action,'not-performed');
    assert.equal(clicks,0);
  }
  locked=false;eligible=true;duplicate=false;hidden=false;
  assert.equal(sample(true).action,'performed');assert.equal(clicks,1);
});

test('Q4 SAF return separates foreground, protected drain, lock and apparent readiness',()=>{
  const f={documentVisible:true,brand:true};
  const locked={...f,brand:false,lock:true,lockControls:true,protectedField:true};
  assert.equal(classifySafReturnFrame('documentsui',locked),'picker-active');
  assert.equal(classifySafReturnFrame('application',{...locked,documentVisible:false}),'webview-hidden');
  assert.equal(classifySafReturnFrame('application',{...f,suspensionDraining:true}),'draining');
  assert.equal(classifySafReturnFrame('application',{...f,suspensionDraining:true,suspensionDelayed:true}),'drain-delayed');
  assert.equal(classifySafReturnFrame('application',{...locked,lockControls:false}),'protected-not-ready');
  assert.equal(classifySafReturnFrame('application',f),'interactive-without-observed-lock');
  assert.equal(classifySafReturnFrame('application',locked),'lock-ready');
  assert.equal(classifySafReturnFrame('application',{...locked,gateError:true}),'gate-error');
});
test('Q4 SAF return waits through native handoff and drain, never accepts an already interactive App',async()=>{
  const clock=fakeClock(),states=[];
  const app={documentVisible:true,brand:true};
  const lock={documentVisible:true,lock:true,lockControls:true,protectedField:true};
  const frames=[{activity:'documentsui',frame:null},{activity:'application',frame:app},
    {activity:'application',frame:{...app,suspensionDraining:true}},
    {activity:'application',frame:lock}];
  await waitSafReturnLock({sample:()=>frames.shift(),onState:s=>states.push(s),...clock,timeoutMs:5000});
  assert.deepEqual(states,['picker-active','interactive-without-observed-lock','draining','lock-ready']);
  const never=fakeClock();
  await assert.rejects(waitSafReturnLock({sample:()=>({activity:'application',frame:app}),...never,timeoutMs:1000}),{code:'OBSERVATION_DEADLINE'});
});
test('Q4 SAF return never treats an application error or read failure as a lock',async()=>{
  for(const error of [false,true]){
    const clock=fakeClock();let reads=0;
    await assert.rejects(waitSafReturnLock({sample:()=>{reads++;
      if(error)throw new LabFailure('CDP_DISCONNECTED');
      return {activity:'application',frame:{documentVisible:true,gateError:true}};
    },...clock,timeoutMs:1000}),{code:error?'CDP_DISCONNECTED':'PUBLIC_GATE_ERROR'});
    assert.equal(reads,1);
  }
});

test('Q4 restore consent is held until the one actual password submission is acknowledged',async()=>{
  const gate=createRecoveryConsentGate();let accepts=0;
  gate.arm();gate.startSubmit();
  assert.equal(gate.capture('confirm',V7_RECOVERY_CONSENT),true);
  assert.equal(gate.ready(),false);
  await assert.rejects(gate.accept(()=>accepts++),{code:'RECOVERY_CONSENT_INVALID'});
  gate.acknowledgeSubmit();assert.equal(gate.ready(),true);
  await gate.accept(async()=>{accepts++;});
  assert.equal(gate.snapshot().state,'accepted');assert.equal(accepts,1);
  await assert.rejects(gate.accept(()=>accepts++),{code:'RECOVERY_CONSENT_INVALID'});
  assert.equal(accepts,1);
});
test('Q4 restore consent rejects early, mismatched and duplicate dialogs without accepting them',async()=>{
  for(const mode of ['early','wrong','duplicate','alert']){
    const gate=createRecoveryConsentGate();let accepts=0;gate.arm();
    if(mode!=='early')gate.startSubmit();
    assert.equal(gate.capture(mode==='alert'?'alert':'confirm',mode==='wrong'?'Ripristino V7':V7_RECOVERY_CONSENT),true);
    if(mode==='duplicate')gate.capture('confirm',V7_RECOVERY_CONSENT);
    assert.throws(()=>gate.ready(),{code:'RECOVERY_CONSENT_INVALID'});
    await assert.rejects(gate.accept(()=>accepts++),{code:'RECOVERY_CONSENT_INVALID'});
    assert.equal(accepts,0);
  }
});
test('Q4 unknown consent command outcome is not retried',async()=>{
  const gate=createRecoveryConsentGate();let calls=0;
  gate.arm();gate.startSubmit();gate.acknowledgeSubmit();gate.capture('confirm',V7_RECOVERY_CONSENT);
  await assert.rejects(gate.accept(()=>{calls++;throw new LabFailure('CDP_TIMEOUT');}),{code:'CDP_TIMEOUT'});
  await assert.rejects(gate.accept(()=>calls++),{code:'RECOVERY_CONSENT_INVALID'});
  assert.equal(calls,1);
});

test('Q4-R06 transient final connection readiness loss resets selection and closes rejected socket',async()=>{
  const clock=fakeClock(),closed=[],states=[];let acquired=0,samples=0;
  const identity=()=>({pid:17,foreground:true,list:[target('a')]});
  const selected=await waitUniquePublicTarget({expected:'setup',...clock,timeoutMs:5000,
    sample:()=>{samples++;return identity();},inspect:()=>setupFrame,
    acquire:()=>({number:++acquired}),inspectAcquired:s=>s.number===1?{documentVisible:false}:setupFrame,
    confirmIdentity:identity,release:s=>closed.push(s.number),onState:s=>states.push(s.state)});
  assert.equal(samples,4);assert.equal(selected.connection.number,2);
  assert.deepEqual(closed,[1]);assert.ok(states.includes('handoff-not-ready'));
  assert.equal(states.at(-1),'handoff-stable');
});
test('Q4-R06 final PID, foreground and candidate-set changes require fresh selection',async()=>{
  for(const mode of ['pid','foreground','list']){
    const clock=fakeClock(),closed=[];let n=0;
    const identity=()=>({pid:17,foreground:true,list:[target('a')]});
    const selected=await waitUniquePublicTarget({expected:'setup',...clock,timeoutMs:5000,sample:identity,inspect:()=>setupFrame,
      acquire:()=>({number:++n}),inspectAcquired:()=>setupFrame,confirmIdentity:()=>{
        const f=identity();if(n!==1)return f;
        if(mode==='pid')f.pid=18;if(mode==='foreground')f.foreground=false;if(mode==='list')f.list.push(target('b'));return f;
      },release:s=>closed.push(s.number)});
    assert.equal(selected.connection.number,2);assert.deepEqual(closed,[1]);
  }
});
test('Q4-R06 retained socket is closed on late success and unknown read failure',async()=>{
  for(const mode of ['late','unknown']){
    const clock=fakeClock(),closed=[];const identity=()=>({pid:17,foreground:true,list:[target('a')]});
    await assert.rejects(waitUniquePublicTarget({expected:'setup',...clock,timeoutMs:1000,sample:identity,inspect:()=>setupFrame,
      acquire:()=>({number:1}),inspectAcquired:()=>{if(mode==='unknown')throw new LabFailure('CDP_EVALUATION_REJECTED');return setupFrame;},
      confirmIdentity:()=>{clock.advance(1000);return identity();},release:s=>closed.push(s.number)}),
      {code:mode==='late'?'PREFLIGHT_CDP_HANDOFF_UNSTABLE':'CDP_EVALUATION_REJECTED'});
    assert.deepEqual(closed,[1]);
  }
});
test('Q4-R06 known read-only handoff transport failure may repeat but not beyond common deadline',async()=>{
  const clock=fakeClock(),closed=[];let count=0;
  const identity=()=>({pid:17,foreground:true,list:[target('a')]});
  await assert.rejects(waitUniquePublicTarget({expected:'setup',...clock,timeoutMs:800,sample:identity,inspect:()=>setupFrame,
    acquire:()=>({number:++count}),inspectAcquired:()=>{throw new LabFailure('CDP_DISCONNECTED');},
    confirmIdentity:identity,release:s=>closed.push(s.number)}),{code:'PREFLIGHT_CDP_HANDOFF_UNSTABLE'});
  assert.equal(count,1);assert.deepEqual(closed,[1]);
});

test('Q4-R07 independent startup matrix precedes pilot and cannot count as full F2 acceptance',()=>{
  const q=readFileSync(new URL('../../.github/workflows/qa-stability-01-q4.yml',import.meta.url),'utf8');
  const f=readFileSync(new URL('../../.github/workflows/ap02-f2-native-device.yml',import.meta.url),'utf8');
  const d=readFileSync(new URL('./ap02-native-device-v7.mjs',import.meta.url),'utf8');
  const startup=q.slice(q.indexOf('  startup:'),q.indexOf('  pilot:'));
  assert.ok(startup.includes('needs: preflight')&&startup.includes('trial: [1, 2, 3]')&&startup.includes('startup_only: true'));
  assert.ok(q.slice(q.indexOf('  pilot:'),q.indexOf('  q4:')).includes('needs: [preflight, startup]'));
  assert.ok(q.includes('needs: [preflight, pilot]'));
  assert.ok(f.includes('default: false')&&f.includes('if: ${{ !inputs.startup_only }}'));
  assert.ok(f.includes('q4-startup-api{0}-trial{1}')&&f.includes('.fullF2Qualified==false'));
  assert.ok(f.includes('.results[4].nativeReauthCount>=4')&&f.includes('.results[5].absenceSamples==2'));
  assert.ok(d.indexOf('if(startupOnly){')<d.indexOf('await createClass(originalClass)'));
  assert.ok(d.includes("startupOnly?'AP02_STARTUP_ONLY_SUCCESS':'AP02_F2_DEVICE_SUCCESS'"));
  const flow=d.slice(d.indexOf('if(startupOnly){'),d.indexOf('await createClass(originalClass)'));
  assert.ok(flow.includes('verifiedProcessStop')&&flow.includes("await makePublicAuthentication('startup-cold-reopen')()")&&flow.includes('fullF2Qualified:false'));
});

test('Q4-R08 native metadata distinguishes an attached visible view without trusting absent fields',()=>{
  assert.equal(nativeViewState(nativeDescription()),'active');
  for(const d of [{attached:false},{visible:false},{empty:true}])
    assert.equal(nativeViewState(nativeDescription(d)),'inactive');
  for(const d of ['',undefined,'bad','{}',nativeDescription({width:0}),nativeDescription({height:'800'})])
    assert.equal(nativeViewState(d),'unknown');
});
test('Q4-R08 excludes only positively inactive competing WebViews and fails closed on unknown metadata',async()=>{
  const active=target('a'),detached=target('b',nativeDescription({attached:false}));
  const candidates=localPageTargets([active,detached]);let inspected=0;
  const result=await identifyPublicTarget(candidates,()=>{inspected++;return setupFrame;},'setup');
  assert.equal(result.target.id,'a');assert.equal(inspected,1);
  const unknown=await identifyPublicTarget(localPageTargets([active,target('b','')]),()=>setupFrame,'setup');
  assert.equal(unknown.state,'native-evidence-incomplete');
});
test('Q4-R08 two active WebViews require exactly one explicitly focused and ready document',async()=>{
  const targets=localPageTargets([target('a'),target('b')]);
  const single=await identifyPublicTarget(targets,x=>({...setupFrame,documentFocused:x.id==='b'}),'setup');
  assert.equal(single.target.id,'b');
  for(const focus of [true,false,undefined]){
    const result=await identifyPublicTarget(targets,()=>({...setupFrame,documentFocused:focus}),'setup');
    assert.equal(result.state,focus===undefined?'inspection-incomplete':'ambiguous');
    assert.equal(result.target,undefined);
  }
  const wrong=await identifyPublicTarget(targets,x=>x.id==='a'?{...setupFrame,documentFocused:false}:{documentVisible:true,documentFocused:true},'setup');
  assert.equal(wrong.state,'no-target');
});
test('Q4-R08 rejects changed native visibility or focus during retained connection handoff',async()=>{
  for(const mode of ['visibility','focus']){
    const clock=fakeClock(),closed=[];let acquired=0,phase='search';
    const identity=()=>({pid:17,foreground:true,list:[target('a'),target('b')]});
    const focus=x=>({...setupFrame,documentFocused:phase==='verify'&&acquired===1?x.id==='b':x.id==='a'});
    const result=await waitUniquePublicTarget({expected:'setup',...clock,timeoutMs:5000,sample:()=>{phase='search';return identity();},
      inspect:focus,acquire:x=>({id:x.id,n:++acquired}),inspectAcquired:focus,
      confirmIdentity:()=>{phase='verify';const f=identity();if(mode==='visibility'&&acquired===1)f.list[1]=target('b',nativeDescription({visible:false}));return f;},
      release:s=>closed.push(s.n)});
    assert.equal(result.connection.n,2);assert.deepEqual(closed,[1]);
  }
});
test('Q4-R08 duplicate debugger endpoints never qualify as two independent identities',()=>{
  assert.throws(()=>localPageTargets([target('a'),{...target('b'),webSocketDebuggerUrl:target('a').webSocketDebuggerUrl}]),{code:'PREFLIGHT_CDP_TARGET_AMBIGUOUS'});
});

test('Q4-R09 atomic home confirmation repeats only after acknowledged no-action',async()=>{
  const clock=fakeClock(),frames=[];let attempts=0,clicks=0,checks=0;
  await confirmHomeOnce({...clock,timeoutMs:5000,foreground:()=>++checks!==1,
    attempt:()=>{attempts++;if(attempts<3)return {ready:false,action:'not-performed'};
      clicks++;return {ready:true,action:'performed'};},onFrame:f=>frames.push(f.action)});
  assert.equal(attempts,3);assert.equal(clicks,1);
  assert.deepEqual(frames,['not-attempted','not-performed','not-performed','performed']);
});
test('Q4-R09 unknown or invalid confirmation outcome never permits another attempt',async()=>{
  for(const mode of ['transport','invalid','contradictory','late']){
    const clock=fakeClock();let attempts=0;
    await assert.rejects(confirmHomeOnce({...clock,timeoutMs:1000,foreground:()=>true,attempt:()=>{
      attempts++;
      if(mode==='transport')throw new LabFailure('CDP_TIMEOUT');
      if(mode==='invalid')return null;
      if(mode==='contradictory')return {ready:true,action:'not-performed'};
      clock.advance(1000);return {ready:true,action:'performed'};
    }}),{code:mode==='transport'?'CDP_TIMEOUT':mode==='late'?'OBSERVATION_DEADLINE':'CDP_EVALUATION_REJECTED'});
    assert.equal(attempts,1);
  }
});
test('Q4-R09 unavailable confirmation does not count as successful dismissal',async()=>{
  const clock=fakeClock();let attempts=0;
  await assert.rejects(confirmHomeOnce({...clock,timeoutMs:1000,foreground:()=>true,
    attempt:()=>{attempts++;return {ready:false,action:'not-performed'};}}),{code:'OBSERVATION_DEADLINE'});
  assert.ok(attempts>1);
});

test('Q4-R10 ADB deadline classification distinguishes independent command allowance from truncated observation budget',async()=>{
  const clock=fakeClock(),timeout={code:'ETIMEDOUT'};
  assert.equal(classifyAdbDeadline(timeout,commandBudgetInfo(30000)).code,'ADB_TRANSPORT_TIMEOUT');
  await withinDeadline(async()=>{
    assert.deepEqual(commandBudgetInfo(30000),{timeoutMs:30000,limitedBy:'command'});
    clock.advance(40000);
    assert.deepEqual(commandBudgetInfo(30000),{timeoutMs:20000,limitedBy:'observation'});
    assert.equal(classifyAdbDeadline(timeout,commandBudgetInfo(30000)).code,'COMMAND_DEADLINE');
    assert.equal(classifyAdbDeadline(timeout,commandBudgetInfo(30000)).message,'COMMAND_DEADLINE');
  },{timeoutMs:60000,now:clock.now});
});
test('Q4-R10 negative DOM frames avoid ADB; ready, lock and error require a real foreground read',async()=>{
  let reads=0;
  const sample=frame=>sampleDestinationFrame({readFrame:()=>frame,foreground:()=>{reads++;return true;},destination:'home'});
  const negative=await sample({...readyFrame,gatePending:true});
  assert.equal(negative.foreground,null);assert.equal(classifyDestinationObservation(negative,'home'),'protected');assert.equal(reads,0);
  assert.equal(classifyDestinationObservation({...readyFrame,foreground:null,domOnlyState:'ready'},'home'),'background');
  for(const frame of [readyFrame,{...readyFrame,lock:true,lockControls:true},{...readyFrame,gateError:true}]){
    assert.equal((await sample(frame)).foreground,true);
  }
  assert.equal(reads,3);
});
test('Q4-R10 known ADB read failure invalidates streak, while authentication failure is never repeated',async()=>{
  const clock=fakeClock(),states=[],errors=[];let samples=0;
  await waitPublicSurface({...clock,timeoutMs:5000,destination:'home',
    sample:()=>{samples++;if(samples===2)throw new LabFailure('ADB_TRANSPORT_TIMEOUT');return readyFrame;},
    onState:s=>states.push(s),onReadFailure:e=>errors.push(e)});
  assert.equal(samples,4);assert.deepEqual(states,['ready','transport-unavailable','ready','ready']);
  assert.deepEqual(errors,['ADB_TRANSPORT_TIMEOUT']);
  let submits=0;
  await assert.rejects(waitPublicSurface({...fakeClock(),timeoutMs:5000,destination:'home',
    sample:()=>({...readyFrame,lock:true,lockControls:true}),
    authenticate:()=>{submits++;throw new LabFailure('ADB_TRANSPORT_TIMEOUT');}}),{code:'ADB_TRANSPORT_TIMEOUT'});
  assert.equal(submits,1);
});
test('Q4-R10 unverified native foreground cannot qualify a destination or trigger authentication',async()=>{
  let submits=0;
  await assert.rejects(waitPublicSurface({...fakeClock(),timeoutMs:1000,destination:'home',
    sample:()=>({...readyFrame,foreground:null,lock:true,lockControls:true,domOnlyState:'locked'}),
    authenticate:()=>{submits++;}}),{code:'OBSERVATION_DEADLINE'});
  assert.equal(submits,0);
});

 
// Q5-R01 exercises the serialized public DOM predicate, not a fabricated
// gateError flag. A visible rejection is terminal, never another submit.
function q5GateFrame(title,rejected,hidden=false){
  const heading={textContent:title}, error={textContent:'synthetic rejection',hidden};
  const doc={visibilityState:'visible',querySelector:()=>null,querySelectorAll:selector=>{
    if(selector==='h1,h2,h3,h4,[role=heading]')return [heading];
    if(selector==='button'&&title==='Sblocca Registro')return [{textContent:title}];
    if(selector==='#vault-password'&&title==='Sblocca Registro')return [{}];
    if(selector==='input[name="archive-mode"][value="professional"]'&&title==='Configura archivio protetto')return [{}];
    if(selector==='p.text-rose-300'&&rejected)return [error];
    return [];
  }};
  // Match the production CDP serialization and provide explicit synthetic DOM visibility.
  const frame=Function('return ('+publicSurfaceFrame.toString()+')')()(null,doc,()=>({}),e=>!e.hidden);
  return frame;
}
test('Q5-R01 visible setup and unlock rejections are public gate errors; unrelated or hidden errors are not',()=>{
  for(const title of ['Configura archivio protetto','Sblocca Registro']){
    const frame=q5GateFrame(title,true);
    assert.equal(frame.gateActionError,true);
    assert.equal(frame.gateError,true);
    assert.equal(classifySurface({...frame,foreground:true},'home'),'gate-error');
    assert.equal(q5GateFrame(title,false).gateError,false);
    assert.equal(q5GateFrame(title,true,true).gateError,false);
  }
  const unrelated=q5GateFrame('Ripristina backup cifrato',true);
  assert.equal(unrelated.gateActionError,true);
  assert.equal(unrelated.gateError,false);
});
test('Q5-R01 rejected unlock terminates after one submission and a verified foreground error',async()=>{
  const clock=fakeClock();let submits=0,reads=0,foregroundReads=0;
  const readFrame=()=>{reads++;return q5GateFrame('Sblocca Registro',submits>0);};
  await assert.rejects(waitPublicSurface({...clock,timeoutMs:5000,destination:'home',
    sample:()=>sampleDestinationFrame({readFrame,foreground:()=>{foregroundReads++;return true;},destination:'home'}),
    authenticate:()=>{submits++;}}),{code:'PUBLIC_GATE_ERROR'});
  assert.equal(submits,1);assert.equal(reads,2);assert.equal(foregroundReads,2);
  assert.equal(classifySafReturnFrame('application',q5GateFrame('Sblocca Registro',true)),'gate-error');
});
test('Q5-R02 physical pull preserves inherited deadline category, single invocation and partial-file cleanup',async()=>{
  const name='Backup_Valutazioni_V7_2031-01-15.enc.json';
  for(const inherited of [false,true]){
    const clock=fakeClock();let calls=0,local;
    const attempt=()=>pullLabV7Bytes(name,(_cmd,args,options)=>{
      calls++;local=args[2];assert.equal(options.timeout,inherited?15000:30000);
      writeFileSync(local,'partial');
      throw Object.assign(new Error('synthetic private detail'),{code:'ETIMEDOUT'});
    });
    const code=inherited?'COMMAND_DEADLINE':'ADB_TRANSPORT_TIMEOUT';
    const category=inherited?'INDETERMINATE':'INFRASTRUCTURE';
    const check=e=>{assert.equal(e.code,code);assert.equal(e.message,code);assert.equal(classifyFailure(e).category,category);return true;};
    if(inherited)await assert.rejects(withinDeadline(attempt,{now:clock.now,timeoutMs:15000}),check);
    else assert.throws(attempt,check);
    assert.equal(calls,1);assert.equal(existsSync(local),false);
  }
});


// Q5-R12: actual Home confirmation predicate with a suspended, retained dialog.
function q5HomeFixture(){
  const state={locked:false,draining:false,rejected:false,present:true,foreground:true,clicks:0};
  const owner={};
  const button={textContent:'Torna a Oggi',disabled:false,closest:()=>state.locked||state.draining?owner:null,getClientRects:()=>[{}],click:()=>{state.clicks++;state.present=false;}};
  const dialog={contains:e=>e===button};
  const root={querySelector:()=>dialog,querySelectorAll:()=>[button]};
  const doc={visibilityState:'visible',querySelector:s=>s.includes('header01-home-confirm')?(state.present?root:null):s==='#vault-password'&&state.locked?{}:null};
  const style=()=>({visibility:state.locked||state.draining?'hidden':'visible'});
  const interactive=e=>Boolean(e)&&!state.locked&&!state.draining;
  const surface=()=>({lock:state.locked,lockControls:state.locked,gateError:state.rejected,suspensionDraining:state.draining,protectedField:state.locked});
  const attempt=()=>publicHomeConfirmation(doc,style,interactive,true,surface);
  return {state,attempt};
}
test('Q5-R12 suspension during retained Home confirmation authenticates once and clicks exactly once',async()=>{
  const {state,attempt}=q5HomeFixture(),clock=fakeClock();let reads=0,submits=0;
  state.draining=true;
  const frames=[];
  await confirmHomeOnce({...clock,timeoutMs:20000,foreground:()=>true,
    attempt:()=>{if(++reads===2){state.draining=false;state.locked=true;}return attempt();},
    authenticate:()=>{assert.equal(state.clicks,0);submits++;state.locked=false;},
    onFrame:f=>frames.push(f)});
  assert.equal(submits,1);assert.equal(state.clicks,1);
  assert.equal(frames[0].protectedSurface,true);assert.equal(frames[1].locked,true);
  assert.equal(frames[1].action,'not-performed');assert.equal(frames.at(-1).action,'performed');
});
test('Q5-R12 lock rejection, relock, missing dialog and uncertain authentication all fail closed',async()=>{
  for(const mode of ['gate','relock','missing','uncertain']){
    const {state,attempt}=q5HomeFixture();state.locked=true;let submits=0;
    state.rejected=mode==='gate';
    await assert.rejects(confirmHomeOnce({...fakeClock(),timeoutMs:20000,foreground:()=>true,attempt,
      authenticate:()=>{submits++;if(mode==='uncertain')throw new LabFailure('CDP_DISCONNECTED');
        if(mode!=='relock')state.locked=false;if(mode==='missing')state.present=false;}}),
      {code:mode==='gate'?'PUBLIC_GATE_ERROR':mode==='relock'?'PUBLIC_RELOCK_AFTER_AUTH':mode==='missing'?'HOME_CONFIRM_DIALOG_MISSING':'CDP_DISCONNECTED'});
    assert.equal(submits,mode==='gate'?0:1);assert.equal(state.clicks,0);
  }
});
test('Q5-R12 background cannot authorize authentication or confirmation',async()=>{
  const {state,attempt}=q5HomeFixture();state.locked=true;let reads=0,submits=0;
  await assert.rejects(confirmHomeOnce({...fakeClock(),timeoutMs:1000,foreground:()=>false,
    attempt:()=>{reads++;return attempt();},authenticate:()=>{submits++;}}),{code:'OBSERVATION_DEADLINE'});
  assert.equal(reads,0);assert.equal(submits,0);assert.equal(state.clicks,0);
});
test('Q5-R12 one authentication allowance spans Home navigation boundaries',async()=>{
  const {state,attempt}=q5HomeFixture();let submits=0;
  const shared=createPublicAuthentication({waitForLock:()=>{},fill:()=>{},submit:()=>{submits++;},waitForSession:()=>{}});
  await shared();state.locked=true;
  await assert.rejects(confirmHomeOnce({...fakeClock(),timeoutMs:20000,foreground:()=>true,attempt,authenticate:shared}),{code:'PUBLIC_RELOCK_AFTER_AUTH'});
  assert.equal(submits,1);assert.equal(state.clicks,0);
});
