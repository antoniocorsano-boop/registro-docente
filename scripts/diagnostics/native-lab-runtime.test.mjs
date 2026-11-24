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
