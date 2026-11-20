// Synthetic React fixture only. Never a product route or a real restore.
import React from 'react';
import {createRoot} from 'react-dom/client';
import {DocumentRecoveryReview} from '../../../src/components/documents/DocumentRecoveryReview';
import {createDocumentRecoveryDecision,type DocumentRecoveryDriver} from '../../../src/security/documentRecoveryDecision';
import '../../../src/index.css';
const args=new URLSearchParams(location.search);
const scenario=args.get('scenario')??'success';
const events:string[]=[];
const receipt=Object.freeze({owner:'synthetic-v8'});
const review={version:8 as const,eventsBefore:2,eventsAfter:3,gradesPreserved:true as const,
 assessmentsPreserved:true as const,recoveryCopyVerified:true as const,replacementRequiresConfirmation:true as const};
// Deferred operations are confined to the synthetic browser fixture. The real
// owner and IndexedDB never participate in these remount tests.
type DeferredStage='prepare'|'commit'|'verify';
const pending:Partial<Record<DeferredStage,()=>void>>={};
async function hold(stage:DeferredStage){
 if(!scenario.startsWith('deferred'))return;
 await new Promise<void>(resolve=>{pending[stage]=resolve;});
}
function releaseDeferred(stage:DeferredStage){
 const release=pending[stage];
 if(!release)throw Error('Deferred stage not active: '+stage);
 delete pending[stage];
 release();
}
const workflow:DocumentRecoveryDriver={
 async prepare(){events.push('prepare');await hold('prepare');if(scenario==='invalid')throw Error('Non verificata');return {review,grant:receipt};},
 async commit(grant,consent){events.push('commit');if(grant!==receipt||consent!==true)throw Error('Invalid consent');await hold('commit');if(scenario==='uncertain'||scenario==='deferred-uncertain')throw Error('Physical outcome unknown');},
 invalidate(){events.push('invalidate');},
 async verifyAfterReopen(){events.push('reopen-verified');await hold('verify');return scenario!=='verification-fail';}
};
const ownedDecision=createDocumentRecoveryDecision(workflow);
const root=createRoot(document.getElementById('root')!);
let epoch=0;
function render(){
 root.render(
  <div data-testid="doc01-recovery-epoch" data-epoch={epoch}
    style={{minHeight:'100vh',maxWidth:520,margin:'0 auto',padding:'16px',boxSizing:'border-box',fontFamily:'system-ui, sans-serif'}}>
   {scenario.startsWith('deferred')
     ? <DocumentRecoveryReview key={epoch} decision={ownedDecision}/>
     : <DocumentRecoveryReview workflow={workflow}/>}
  </div>
 );
}
Object.assign(globalThis,{__doc01D4c3e1:{
 calls:()=>events.slice(),
 phase:()=>ownedDecision.phase(),
 release:(stage:DeferredStage)=>releaseDeferred(stage),
 remount:()=>{epoch++;render();}
}});
render();
