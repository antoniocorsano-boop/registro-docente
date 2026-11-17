import React from 'react';
import {createRoot} from 'react-dom/client';
import {SecureRegistroRoot} from '../../../src/components/SecureRegistroRoot';
import '../../../src/index.css';
import '../../../src/styles/lsm01cBMobilePrimaryActionDock.css';
// Candidate only. No query parameter, localStorage or production entrypoint
// enables the migration. Use synthetic local archives in CI.
const boot=(window as unknown as {__val01Boot?:{module:boolean;renderRequested:boolean;rootCommitted:boolean}}).__val01Boot;
if(boot)boot.module=true;
const root=document.getElementById('root')!;
if(boot){
  const observer=new MutationObserver(()=>{if(root.childElementCount){boot.rootCommitted=true;observer.disconnect();}});
  observer.observe(root,{childList:true,subtree:true});
  boot.renderRequested=true;
}
createRoot(root).render(<SecureRegistroRoot archiveMigrationCandidate/>);
