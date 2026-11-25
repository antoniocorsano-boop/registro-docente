import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {packagePidCommand,parsePackagePids,probePackagePids,verifiedProcessStop} from './native-process-probe.mjs';
const pkg='it.trama.registrodocente';
test('one adb shell command preserves actual pidof status and package argument',()=>{
  const command=packagePidCommand(pkg);
  assert.ok(command.startsWith('pidof '+pkg+';'));
  assert.ok(!command.includes('sh -c'));assert.ok(!command.includes('|| true'));
  // Reproduce the remote shell behavior with controlled pidof responses.
  const run=stub=>execFileSync('sh',['-c',stub+'; '+command],{encoding:'utf8'});
  assert.deepEqual(parsePackagePids(run('pidof(){ test "$1" = "'+pkg+'" || return 2; printf "456 123\\n"; return 0; }')),[123,456]);
  assert.deepEqual(parsePackagePids(run('pidof(){ test "$1" = "'+pkg+'" || return 2; return 1; }')),[]);
  assert.throws(()=>parsePackagePids(run('pidof(){ return 127; }')));
  assert.throws(()=>packagePidCommand(pkg+'; echo unsafe'));
});
test('probe refuses empty, malformed, contradictory and transport failure responses',()=>{
  for(const raw of ['', 'error: device offline','VAL01_PIDOF_EXIT=0','12\nVAL01_PIDOF_EXIT=1','VAL01_PIDOF_EXIT=127','12 12\nVAL01_PIDOF_EXIT=0','12\nVAL01_PIDOF_EXIT=0\nextra','0\nVAL01_PIDOF_EXIT=0'])
    assert.throws(()=>parsePackagePids(raw));
  assert.throws(()=>probePackagePids(()=>{throw Error('transport failed');},pkg),/transport failed/);
  const calls=[];
  const result=probePackagePids((...args)=>{calls.push(args);return '1234\nVAL01_PIDOF_EXIT=0';},pkg);
  assert.deepEqual(result,[1234]);assert.deepEqual(calls,[['shell',packagePidCommand(pkg)]]);
});
function scenario(samples){
  let t=0,i=0,stops=0;
  const opts={probe:()=>{const v=samples[Math.min(i++,samples.length-1)];if(v instanceof Error)throw v;return v;},forceStop:()=>{stops++;},now:()=>t,pause:async ms=>{t+=ms;},timeoutMs:1500};
  return {opts,stops:()=>stops,probes:()=>i};
}
test('requires running PID before stop; never accepts initially absent process',async()=>{
  const s=scenario([[]]);
  await assert.rejects(verifiedProcessStop(s.opts),/not positively observed/);
  assert.equal(s.stops(),0);
});
test('requires two consecutive absence samples; resets on process reappearance',async()=>{
  const s=scenario([[341],[341],[],[342],[],[]]);
  assert.deepEqual(await verifiedProcessStop(s.opts),{forcedStop:true,beforePids:[341],afterPids:[],absenceSamples:2,observations:5});
  assert.equal(s.stops(),1);
});
test('persistent process fails deadline with exactly one stop request',async()=>{
  const s=scenario([[341],[341]]);
  await assert.rejects(verifiedProcessStop(s.opts),/absence not verified/);assert.equal(s.stops(),1);
});
test('error after stop cannot become absence or successful proof',async()=>{
  const s=scenario([[341],[],new Error('ADB disconnected')]);
  await assert.rejects(verifiedProcessStop(s.opts),/ADB disconnected/);assert.equal(s.stops(),1);
});
test('force-stop failure is not retried and produces no proof',async()=>{
  const s=scenario([[341],[],[]]);let requests=0;
  await assert.rejects(verifiedProcessStop({...s.opts,forceStop:()=>{requests++;throw Error('am failure');}}),/am failure/);
  assert.equal(requests,1);assert.equal(s.probes(),1);
});

test('R03 rejects late second absence sample without repeating force-stop',async()=>{
  let now=0,probes=0,stops=0;
  await assert.rejects(verifiedProcessStop({
    now:()=>now,timeoutMs:1000,pause:async ms=>{now+=ms;},
    forceStop:()=>{stops++;},probe:()=>{probes++;if(probes===3)now=1001;return probes===1?[123]:[];}
  }),/absence not verified|PROCESS_STOP_DEADLINE/);
  assert.equal(stops,1);assert.equal(probes,3);
});
