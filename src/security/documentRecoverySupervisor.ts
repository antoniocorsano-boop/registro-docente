/** DOC-01/D4c3e3 — controller lifetime is external to the retired App. */
import {createDocumentRecoveryDecision,type DocumentRecoveryDecision,type DocumentRecoveryDriver} from './documentRecoveryDecision';
export interface DocumentRecoverySupervisor {
 readonly decision:DocumentRecoveryDecision;
 readonly isDetached:()=>boolean;
 detachOldView():void;
 dispose():void;
}
export function createDocumentRecoverySupervisor(_driver:DocumentRecoveryDriver):DocumentRecoverySupervisor{
 throw Error('DOC01_D4C3E3_SUPERVISOR_NOT_IMPLEMENTED');
}
