import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { commandBudgetInfo, classifyAdbDeadline } from './native-lab-runtime.mjs';

// F2-DEVICE: discover only lab V7 files created by Android ACTION_CREATE_DOCUMENT.
// Android is the owner of the file names and normally adds "(1)" on collision.
// Do not rename files via shell or interpret the receipt as proof of a new file.
const base=/^Backup_Valutazioni_V7_(\d{4}-\d{2}-\d{2})\.enc\.json$/;
const variants=[
 /^Backup_Valutazioni_V7_(\d{4}-\d{2}-\d{2}) ?\(\d{1,3}\)\.enc\.json$/,
 /^Backup_Valutazioni_V7_(\d{4}-\d{2}-\d{2})\.enc ?\(\d{1,3}\)\.json$/,
 /^Backup_Valutazioni_V7_(\d{4}-\d{2}-\d{2})\.enc\.json ?\(\d{1,3}\)$/
];
export function labV7Date(name) {
  if(typeof name!=='string')return null;
  const match=base.exec(name)||variants.map(r=>r.exec(name)).find(Boolean);
  return match&&match[0]===name?match[1]:null;
}
export function isOriginalV7Name(name){return base.test(name);}
export function selectNewLabV7Name(before,after){
  // Never guess a file by date alone. Each export must add exactly one
  // distinct, physically discoverable document; its old peer must still exist.
  if(!Array.isArray(before)||!Array.isArray(after)||
     before.some(n=>labV7Date(n)===null)||after.some(n=>labV7Date(n)===null)||
     new Set(before).size!==before.length||new Set(after).size!==after.length)
    throw Error('INVALID_LAB_V7_FILE_LIST');
  if(before.length===0){
    if(after.length!==1||!isOriginalV7Name(after[0]))
      throw Error('V7_FIRST_FILE_NOT_UNIQUE');
    return after[0];
  }
  if(before.length!==1||!isOriginalV7Name(before[0])||
     after.length!==2||!after.includes(before[0]))
    throw Error('V7_SECOND_DISTINCT_DOCUMENT_MISSING');
  const added=after.filter(n=>!before.includes(n));
  if(added.length!==1||added[0]===before[0]||
     labV7Date(added[0])!==labV7Date(before[0]))
    throw Error('V7_SECOND_DISTINCT_DOCUMENT_MISSING');
  return added[0];
}
// A constrained shell path for exact laboratory filenames; the quotes protect
// Android's parenthesized collision suffix, never arbitrary user input.
export function quotedLabV7Path(name){
  if(labV7Date(name)===null)throw Error('INVALID_LAB_V7_FILE_NAME');
  return "'/sdcard/Download/"+name+"'";
}

// F2-DIAG-07: use the ADB sync protocol, not a remote shell command.
// Raw remote path is one argv value, including any collision suffix. The
// encrypted bytes are staged only in a private runner temp directory, never
// in uploaded evidence. A failed or partial transfer cannot qualify.
export function pullLabV7Bytes(name,run=execFileSync){
  if(labV7Date(name)===null)throw Error('INVALID_LAB_V7_FILE_NAME');
  const directory=mkdtempSync(join(tmpdir(),'ap02-v7-read-'));
  const local=join(directory,'encrypted.bin');
  try{
    const budget=commandBudgetInfo(30000);
    try{run('adb',['pull','/sdcard/Download/'+name,local],{timeout:budget.timeoutMs,killSignal:'SIGKILL',stdio:['ignore','ignore','pipe']});}
    catch(error){throw classifyAdbDeadline(error,budget);}
    return readFileSync(local);
  }finally{
    rmSync(directory,{recursive:true,force:true});
  }
}
