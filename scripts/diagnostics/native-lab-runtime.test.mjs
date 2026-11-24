import test from 'node:test';
import assert from 'node:assert/strict';
import { LabFailure, classifyFailure, observeUntil, commandBudget, createPendingCommands, withoutObservationScope } from './native-lab-runtime.mjs';
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
