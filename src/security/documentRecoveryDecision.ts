/** DOC-01/D4c3e1 — authorization and teacher review in an isolated UI laboratory.
 * A preview is not a physical restore: the DB2 owner remains the sole writer.
 * No production owner or Android bridge is connected in this increment.
 */
export interface DocumentRecoveryReview {
 readonly version:8;
 readonly eventsBefore:number;
 readonly eventsAfter:number;
 readonly gradesPreserved:true;
 readonly assessmentsPreserved:true;
 readonly recoveryCopyVerified:true;
 readonly replacementRequiresConfirmation:true;
}
export interface DocumentRecoveryDriver {
 prepare():Promise<{review:DocumentRecoveryReview;grant:object}>;
 commit(grant:object,consent:true):Promise<void>;
 invalidate():void;
 verifyAfterReopen():Promise<boolean>;
}
export type DocumentRecoveryPhase='idle'|'prepared'|'verification-required'|'completed'|'cancelled'|'uncertain';
export interface DocumentRecoveryDecision {
 phase():DocumentRecoveryPhase;
 review():DocumentRecoveryReview|null;
 prepare():Promise<DocumentRecoveryReview>;
 confirm(authorization:{accepted:boolean;phrase:string}):Promise<void>;
 cancel():void;
 verifyAfterReopen():Promise<boolean>;
}
export function createDocumentRecoveryDecision(_driver:DocumentRecoveryDriver):DocumentRecoveryDecision {
 throw Error('DOC01_D4C3E1_NOT_IMPLEMENTED');
}
