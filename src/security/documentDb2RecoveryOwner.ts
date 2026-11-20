/** DOC-01/D4c3e2 — DB2 owner adapter (synthetic qualification, no product route).
 * Deliberately never accepts the currently distributed V1 owner as V8 authority.
 * DocumentHistoryV1 itself is lab-only: real student documents remain forbidden.
 */
import type {DocumentRecoveryDriver} from './documentRecoveryDecision';
import type {ExistingSessionVaultStore} from './existingSessionVaultStore';
import type {SecureVault} from './secureVault';
import type {SecureAppStorage} from './secureAppStorage';
import type {DurableMutationCoordinator} from '../persistence/durableMutationCoordinator';

export type V8DocumentCopyKind='recovery'|'target';
export interface DocumentDb2Owner{
 readonly store:ExistingSessionVaultStore;
 readonly vault:SecureVault;
 readonly storage:SecureAppStorage;
 readonly coordinator:DurableMutationCoordinator;
}
export interface DocumentRecoverySessionAuthority {
 /** A native foreground/authenticated epoch, not a browser page timestamp. */
 currentToken():string|null;
 /** Must fail on suspension, lock or native epoch change. */
 isCurrent(token:string):Promise<boolean>;
 /** Hide and abandon all old App/React state before DB2 replacement. */
 onRetired():void;
 /** Must request a NEW authenticated epoch and password, not reuse the old one. */
 freshAuthentication(previousToken:string):Promise<{token:string;password:string}|null>;
}
export interface DocumentDb2RecoveryOptions {
 readonly owner:DocumentDb2Owner;
 readonly authority:DocumentRecoverySessionAuthority;
 readonly vaultPassword:string;
 readonly recoveryPassword:string;
 readonly targetPassword:string;
 readonly approvedCurrentAssessmentScopes:readonly unknown[];
 readonly approvedIncomingAssessmentScopes:readonly unknown[];
 readonly approvedDocumentScopes:readonly unknown[];
 /** Synthetic fixture override. The real bridge defaults to Android SAF readback. */
 readonly selectCiphertext?:(kind:V8DocumentCopyKind,isActive:()=>boolean)=>Promise<string|null>;
 readonly factory?:IDBFactory;
}
export function createDocumentDb2RecoveryDriver(_options:DocumentDb2RecoveryOptions):DocumentRecoveryDriver {
 throw Error('DOC01_D4C3E2_NOT_IMPLEMENTED');
}
