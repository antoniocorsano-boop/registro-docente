import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {DocumentRecoveryReview} from '../../../src/components/documents/DocumentRecoveryReview';
import {createDocumentRecoverySupervisor} from '../../../src/security/documentRecoverySupervisor';
import type {DocumentRecoveryDriver} from '../../../src/security/documentRecoveryDecision';
import '../../../src/index.css';
const events:string[]=[];
type PendingStage='prepare'|'commit'|'verify';
const gates=new Map<PendingStage,{promise:Promise<void>;release:()=>void}>();
function hold(stage:PendingStage){
 if(gates.has(stage))throw Error('Stage already suspended');
 let release=()=>{};
 const promise=new Promise<void>(resolve=>{release=resolve;});
 gates.set(stage,{promise,release});
}
function release(stage:PendingStage){
 const gate=gates.get(stage);if(!gate)throw Error('Missing suspended stage');
 gates.delete(stage);gate.release();
}
async function pause(stage:PendingStage){await gates.get(stage)?.promise;}
let newAuthentication=false;
const driver:DocumentRecoveryDriver={
 async prepare(){events.push('prepare');await pause('prepare');return {review:{version:8,eventsBefore:1,eventsAfter:2,
  gradesPreserved:true,assessmentsPreserved:true,recoveryCopyVerified:true,replacementRequiresConfirmation:true},
  grant:Object.freeze({kind:'opaque'})};},
 async commit(_grant,yes){if(yes!==true)throw Error('consent');events.push('commit');await pause('commit');},
 invalidate(){events.push('invalidate');},
 async verifyAfterReopen(){events.push('verify');await pause('verify');return newAuthentication;}
};
const supervisor=createDocumentRecoverySupervisor(driver);
Object.assign(globalThis,{__doc01Supervisor:{events:()=>events.slice(),phase:()=>supervisor.decision.phase(),isDetached:()=>supervisor.isDetached(),hold,release}});
function Fixture(){
 const [mounted,setMounted]=useState(true);
 return <div style={{maxWidth:520,margin:'auto',padding:12,color:'#f8fafc'}}>
  <div className="mb-3 flex gap-2 flex-wrap">
   <button type="button" onClick={()=>{supervisor.detachOldView();setMounted(false);}}
    className="min-h-11 rounded-lg border border-slate-500 px-3">Disattiva vecchia vista</button>
   <button type="button" onClick={()=>{newAuthentication=true;setMounted(true);}}
    className="min-h-11 rounded-lg border border-slate-500 px-3">Riapri nuova vista</button>
  </div>
  {mounted&&<DocumentRecoveryReview decision={supervisor.decision}/>}
 </div>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);
