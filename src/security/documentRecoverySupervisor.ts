/** DOC-01/D4c3e3 — controller lifetime is external to the retired App. */
import {createDocumentRecoveryDecision,type DocumentRecoveryDecision,type DocumentRecoveryDriver} from './documentRecoveryDecision';
export interface DocumentRecoverySupervisor {
 readonly decision:DocumentRecoveryDecision;
 readonly isDetached:()=>boolean;
 detachOldView():void;
 dispose():void;
}
/** Creates the decision before the old React App is mounted. The supervisor
 * stays in a separate shell and never treats a view's unmount as consent revocation.
 * No persistence across browser process death is claimed here.
 */
export function createDocumentRecoverySupervisor(driver:DocumentRecoveryDriver):DocumentRecoverySupervisor{
 if(!driver||typeof driver.prepare!=='function'||typeof driver.commit!=='function'||
    typeof driver.invalidate!=='function'||typeof driver.verifyAfterReopen!=='function')
    throw Error('Supervisore del recupero non verificabile.');
 const decision=createDocumentRecoveryDecision(driver);
 let detached=false,disposed=false;
 return {
  decision,
  isDetached:()=>detached,
  detachOldView(){
   if(disposed)throw Error('Supervisore già terminato.');
   detached=true;
   // The DB2 owner, not this UI, handles the physical lock and epoch.
   // Never cancel a grant merely because React destroyed the old view.
  },
  dispose(){
   if(disposed)return;
   const phase=decision.phase();
   if(!['idle','preparing','prepared','cancelled','completed','uncertain'].includes(phase))
    throw Error('Il recupero deve essere verificato prima della chiusura.');
   if(['idle','preparing','prepared'].includes(phase))decision.cancel();
   disposed=true;detached=true;
  }
 };
}
