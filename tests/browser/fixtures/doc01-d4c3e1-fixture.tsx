// Synthetic React fixture only. Never a product route or a real restore.
import React from 'react';
import {createRoot} from 'react-dom/client';
import {DocumentRecoveryReview} from '../../../src/components/documents/DocumentRecoveryReview';
import type {DocumentRecoveryDriver} from '../../../src/security/documentRecoveryDecision';
const args=new URLSearchParams(location.search);
const scenario=args.get('scenario')??'success';
const events:string[]=[];
const receipt=Object.freeze({owner:'synthetic-v8'});
const review={version:8 as const,eventsBefore:2,eventsAfter:3,gradesPreserved:true as const,
 assessmentsPreserved:true as const,recoveryCopyVerified:true as const,replacementRequiresConfirmation:true as const};
const workflow:DocumentRecoveryDriver={
 async prepare(){events.push('prepare');if(scenario==='invalid')throw Error('Non verificata');return {review,grant:receipt};},
 async commit(grant,consent){events.push('commit');if(grant!==receipt||consent!==true)throw Error('Invalid consent');if(scenario==='uncertain')throw Error('Physical outcome unknown');},
 invalidate(){events.push('invalidate');},
 async verifyAfterReopen(){events.push('reopen-verified');return scenario!=='verification-fail';}
};
Object.assign(globalThis,{__doc01D4c3e1:{calls:()=>events.slice()}});
createRoot(document.getElementById('root')!).render(
 <div style={{minHeight:'100vh',maxWidth:520,margin:'0 auto',padding:'16px',boxSizing:'border-box',fontFamily:'system-ui, sans-serif'}}>
  <DocumentRecoveryReview workflow={workflow}/>
 </div>
);
