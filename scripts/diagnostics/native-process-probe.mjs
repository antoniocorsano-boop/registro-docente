// Synthetic CI only. A failed ADB transport or malformed output is never
// evidence that a process is absent.
import { performance } from 'node:perf_hooks';
import { withinDeadline } from './native-lab-runtime.mjs';
export function packagePidCommand(pkg){
  if(typeof pkg!=='string'||!/^([A-Za-z][A-Za-z0-9_]*\.)+[A-Za-z][A-Za-z0-9_]*$/.test(pkg))throw Error('Invalid Android package');
  // adb shell joins arguments without quoting. Send one complete remote
  // command, without an inner sh -c; preserve pidof's actual exit status.
  return "pidof "+pkg+"; rc=$?; printf '\\nVAL01_PIDOF_EXIT=%s\\n' \"$rc\"";
}
export function parsePackagePids(raw){
  if(typeof raw!=='string')throw Error('Invalid PID probe output');
  const match=raw.trim().match(/^(?:([1-9]\d*(?:[ \t]+[1-9]\d*)*)\s+)?VAL01_PIDOF_EXIT=([0-9]+)$/);
  if(!match)throw Error('Malformed PID probe output');
  const pids=match[1]?match[1].split(/\s+/).map(Number):[];
  if(pids.some(p=>!Number.isSafeInteger(p))||new Set(pids).size!==pids.length)throw Error('Invalid PID inventory');
  if(match[2]==='0'&&pids.length>0)return pids.sort((a,b)=>a-b);
  if(match[2]==='1'&&pids.length===0)return [];
  throw Error('PID probe failed or exit status inconsistent');
}
export function probePackagePids(adb,pkg){
  return parsePackagePids(adb('shell',packagePidCommand(pkg)));
}
function checkedPids(value){
  if(!Array.isArray(value)||value.some(p=>!Number.isSafeInteger(p)||p<=0)||new Set(value).size!==value.length)throw Error('Invalid PID observation');
  return [...value].sort((a,b)=>a-b);
}
export async function verifiedProcessStop({probe,forceStop,pause=ms=>new Promise(r=>setTimeout(r,ms)),now=performance.now.bind(performance),timeoutMs=15000}){
  return withinDeadline(async()=>{
  const deadline=now()+timeoutMs;
  const beforePids=checkedPids(probe());
  if(!beforePids.length)throw Error('Process not positively observed before force-stop');
  // Exactly one stop request. Do not retry a destructive or uncertain action.
  if(now()>=deadline)throw Error('Process still present or absence not verified after force-stop');
  forceStop();
  let absenceSamples=0,observations=0;
  while(now()<deadline){
    const afterPids=checkedPids(probe());
    if(now()>=deadline)break;
    observations++;
    // Two consecutive, independently successful empty probes. A transport
    // or parser error escapes immediately and cannot count as absence.
    absenceSamples=afterPids.length===0?absenceSamples+1:0;
    if(absenceSamples===2)return {forcedStop:true,beforePids,afterPids,absenceSamples,observations};
    await pause(Math.min(250,Math.max(0,deadline-now())));
  }
  throw Error('Process still present or absence not verified after force-stop');
  },{timeoutMs,now,timeoutCode:'PROCESS_STOP_DEADLINE'});
}
