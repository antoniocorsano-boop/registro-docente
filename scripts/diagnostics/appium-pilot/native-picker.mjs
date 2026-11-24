// Q5-SYS-04: adapter to the existing F2 Android document-picker implementation.
// Runs only on the synthetic emulator. Never logs raw tree, coordinates or names.
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {LabFailure, classifyFailure, commandBudgetInfo, classifyAdbDeadline, observeUntil} from '../native-lab-runtime.mjs';
import {readNativeSnapshot, waitNativeSelection, uniqueNativeControl, requireDocumentsUiTap, nativeReadRetryCodes} from '../native-lab-transitions.mjs';
import {classifyResumedActivity} from '../native-saf-lifecycle-probe.mjs';
import {hasArea} from '../native-ui-driver.mjs';
import {labV7Date} from '../native-v7-document-discovery.mjs';

const pkg='it.trama.registrodocente.lab.ap02v7';
const doc=n=>/documentsui/i.test(n.pkg);
const folder=n=>doc(n)&&/^(Downloads|Download)$/i.test(n.text);
const root=n=>doc(n)&&/show roots|open navigation drawer|mostra radici/i.test(n.desc);
const save=n=>doc(n)&&/^(save|salva)$/i.test(n.text);
const open=n=>doc(n)&&/^(open|apri)$/i.test(n.text);
export function createPicker({adb,api,report=()=>{},now,sleep}){
  assert.ok([32,36].includes(api));
  const activity=()=>classifyResumedActivity(adb('shell','dumpsys','activity','activities'),pkg);
  const foreground=()=>activity()==='documentsui';
  const read=()=>readNativeSnapshot(adb);
  const selection=(select,timeoutMs=45000)=>waitNativeSelection({
    read,foreground,select,timeoutMs,now,sleep,onState:state=>report('observation',state)
  });
  const find=predicate=>selection(nodes=>uniqueNativeControl(nodes,predicate));
  const tap=node=>{
    assert.ok(hasArea(node));
    const [x1,y1,x2,y2]=node.bounds;
    return requireDocumentsUiTap({foreground,node,tap:()=>adb('shell','input','tap',
      String(Math.floor((x1+x2)/2)),String(Math.floor((y1+y2)/2)))});
  };
  async function downloads(){
    report('phase','saf-downloads-location');
    const decision=await selection(nodes=>{
      if(nodes.some(n=>folder(n)&&hasArea(n)))return {key:'downloads',value:'downloads'};
      const found=uniqueNativeControl(nodes,root);
      return found?{key:found.key,value:found.value}:null;
    },api===32?90000:45000);
    if(decision!=='downloads'){
      report('phase','saf-open-roots');
      tap(decision);
      report('phase','saf-select-downloads');
      tap(await find(folder));
    }
    report('phase','saf-downloads-ready');
  }
  async function returned(){
    report('phase','saf-observe-document-return');
    await observeUntil(()=>activity()==='application',{
      timeoutMs:45000,intervalMs:450,now,sleep,retryReadErrors:true,retryCodes:nativeReadRetryCodes
    });
  }
  async function run(action,name){
    if(action!=='save'&&action!=='open')throw new LabFailure('INVALID_HARNESS_ARGUMENT');
    if(action==='open'&&labV7Date(name)===null)throw new LabFailure('INVALID_HARNESS_ARGUMENT');
    await downloads();
    if(action==='save'){
      report('phase','saf-save-control');
      tap(await find(save));
    }else{
      report('phase','saf-select-exact-document');
      tap(await find(n=>doc(n)&&n.text===name&&!/preview|anteprima/i.test(n.desc)));
      report('phase','saf-observe-open-or-return');
      let previous=null,count=0;
      const next=await observeUntil(()=>{
        let item;
        try{
          if(activity()==='application')return 'returned';
          if(!foreground()){previous=null;count=0;return false;}
          const nodes=read();
          item=foreground()?uniqueNativeControl(nodes,open):null;
        }catch(error){previous=null;count=0;throw error;}
        if(!item){previous=null;count=0;return false;}
        count=item.key===previous?count+1:1;previous=item.key;
        return count>=2?item.value:false;
      },{timeoutMs:25000,intervalMs:450,now,sleep,retryReadErrors:true,retryCodes:nativeReadRetryCodes});
      if(next!=='returned'&&activity()!=='application'){
        report('phase','saf-confirm-open');
        tap(next);
      }
    }
    await returned();
    report('phase','saf-native-complete');
  }
  return {run};
}
function adb(...args){
  const budget=commandBudgetInfo(30000);
  try{return execFileSync('adb',args,{encoding:'utf8',timeout:budget.timeoutMs,killSignal:'SIGKILL',stdio:['ignore','pipe','pipe']}).trim();}
  catch(error){throw classifyAdbDeadline(error,budget);}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  let last=null;
  const report=(kind,value)=>{
    if(kind==='phase'||value!==last){
      process.stdout.write(JSON.stringify({kind,value})+'\n');
      last=value;
    }
  };
  try{
    const request=JSON.parse(readFileSync(0,'utf8'));
    await createPicker({adb,api:Number(process.env.AP02_API),report}).run(request.action,request.name);
    report('result','PASS');
  }catch(error){
    const classified=classifyFailure(error);
    report('failure',classified.code);
    process.exitCode=1;
  }
}
