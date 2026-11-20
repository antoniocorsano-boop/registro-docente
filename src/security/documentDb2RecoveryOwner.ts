/** DOC-01/D4c3e2 — DB2 owner adapter (synthetic qualification, no product route).
 * Deliberately never accepts the currently distributed V1 owner as V8 authority.
 * DocumentHistoryV1 itself is lab-only: real student documents remain forbidden.
 */
import type {DocumentRecoveryDriver,DocumentRecoveryReview} from './documentRecoveryDecision';
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
import {createDb2Lifecycle} from './db2Lifecycle';
import {captureDb2,sameDb2Physical} from './db2PhysicalLifecycle';
import {readEncryptedBackupOnAndroid,ANDROID_BACKUP_MAX_BYTES} from './androidBackupExport';
import {decryptDataWithPassword} from '../cryptoUtils';
import {projectDocumentRestoreV8} from './documentBackupPayloadV8';
import {validateDocumentHistory} from '../documents/documentHistoryTransitions';
import {detachHistoricalDocumentData} from '../documents/documentHistoricalValidation';
import {snapshotAssessmentData} from '../assessment/assessmentRevisionBindings';
import {validateAssessmentArchiveV1,type ApprovedAssessmentScope} from '../assessment/assessmentArchive';
import {ExistingSessionVaultStore} from './existingSessionVaultStore';
import {SecureVault} from './secureVault';
import {SecureAppStorage,type CompleteSecureAppSnapshot} from './secureAppStorage';
import {withoutLocalBackupVerification} from '../persistence/backupCheckpoint';
import {sanitizePersistedSettings} from './dataClassification';

const rejected=()=>Error('DOC-01: proprietario o copia documentale non verificabile.');
const genuine=(value:unknown):value is string=>typeof value==='string'&&value.length>0;
const copyBytes=(value:string):Blob=>{
 const bytes=new TextEncoder().encode(value);
 if(!bytes.length||bytes.byteLength>ANDROID_BACKUP_MAX_BYTES)throw rejected();
 return new Blob([bytes],{type:'application/json'});
};

/** Actual V2 owner and existing Android ciphertext-only SAF reader.
 * The synthetic source override is only connected in the isolated browser lab.
 * No production Root supplies an adapter, and V1 is refused before changes.
 */
export function createDocumentDb2RecoveryDriver(options:DocumentDb2RecoveryOptions):DocumentRecoveryDriver {
 if(!options||!options.owner||!options.authority||!genuine(options.vaultPassword)||
   !genuine(options.recoveryPassword)||!genuine(options.targetPassword)||
   !(options.owner.store instanceof ExistingSessionVaultStore)||
   !options.owner.vault||!options.owner.storage||!options.owner.coordinator||
   typeof options.authority.currentToken!=='function'||
   typeof options.authority.isCurrent!=='function'||
   typeof options.authority.onRetired!=='function'||
   typeof options.authority.freshAuthentication!=='function')throw rejected();
 const owner=options.owner,authority=options.authority;
 // Freeze approvals before any network-independent but asynchronous file picker.
 // Never derive an approval from an untrusted V8 file.
 const currentAssessment=snapshotAssessmentData(options.approvedCurrentAssessmentScopes) as ApprovedAssessmentScope[];
 const incomingAssessment=snapshotAssessmentData(options.approvedIncomingAssessmentScopes) as ApprovedAssessmentScope[];
 const documentScopes=detachHistoricalDocumentData(options.approvedDocumentScopes) as unknown[];
 if(!Array.isArray(currentAssessment)||!Array.isArray(incomingAssessment)||
   !Array.isArray(documentScopes)||!documentScopes.length)throw rejected();
 const factory=options.factory??globalThis.indexedDB;
 if(!factory)throw rejected();
 const service=createDb2Lifecycle(factory);
 let phase:'idle'|'preparing'|'prepared'|'committing'|'verification-required'|'uncertain'|'ended'='idle';
 let revision=0;
 let pendingGrant:object|null=null;
 let originalToken:string|null=null;
 let expectedSnapshot:CompleteSecureAppSnapshot|null=null;
 let retired=false;
 let sealed=false;
 const current=(token:string,generation:number)=>revision===generation&&
   phase==='preparing'&&authority.currentToken()===token;
 const assure=async(token:string,generation:number)=>{
  if(!current(token,generation)||!await authority.isCurrent(token))throw rejected();
 };
 const abandon=()=>{
  revision++;
  pendingGrant=null;
  service.invalidate();
 };
 const picker=options.selectCiphertext??(async(_kind:V8DocumentCopyKind,isActive:()=>boolean)=>
  readEncryptedBackupOnAndroid(isActive));
 const select=async(kind:V8DocumentCopyKind,token:string,generation:number):Promise<string>=>{
  await assure(token,generation);
  const selected=await picker(kind,()=>current(token,generation)&&owner.vault.isUnlocked());
  await assure(token,generation);
  if(!genuine(selected))throw rejected();
  copyBytes(selected); // strict max size, including synthetic adapter
  return selected;
 };
 const retire=async()=>{
  if(retired)return;
  retired=true;
  try{authority.onRetired();}
  finally{
   owner.vault.lock();
   await owner.store.retireConnection();
  }
 };
 return {
  invalidate(){
   abandon();
   if(phase==='preparing'||phase==='prepared')phase=retired?'uncertain':'ended';
  },
  async prepare(){
   if(phase!=='idle'||!owner.vault.isUnlocked())throw rejected();
   phase='preparing';const generation=++revision;
   const token=authority.currentToken();
   if(!genuine(token)){phase='ended';throw rejected();}
   originalToken=token;
   try{
    // Native bridge verifies SHA256 and byte-count of each selected ciphertext.
    // Abort or native suspension means no physical DB2 preparation.
    const recoveryText=await select('recovery',token,generation);
    const targetText=await select('target',token,generation);
    await assure(token,generation);
    const physical=await captureDb2(factory);
    if(physical.state!=='active')throw rejected();
    // All already-admitted writes settle before we capture the exact archive.
    sealed=true;
    await owner.coordinator.sealAndDrain();
    await assure(token,generation);
    const previous=await owner.storage.loadExactBackupSnapshot();
    const metadata=await owner.store.getMetadata();
    if(!previous||!metadata||metadata.state!=='ACTIVE'||
       !sameDb2Physical(physical.metadata,metadata))throw rejected();
    const history=(previous.appData as typeof previous.appData&{documentHistoryV1?:unknown}).documentHistoryV1;
    const priorCheck=await validateDocumentHistory(history,documentScopes);
    if(!priorCheck.valid||priorCheck.archive.labOnly!==true)throw rejected();
    const [incoming,recovery]=await Promise.all([
     decryptDataWithPassword(targetText,options.targetPassword),
     decryptDataWithPassword(recoveryText,options.recoveryPassword)
    ]);
    const projected=await projectDocumentRestoreV8(previous,incoming,recovery,
      currentAssessment,incomingAssessment,documentScopes);
    const future=(projected.appData as typeof projected.appData&{documentHistoryV1?:unknown}).documentHistoryV1;
    const verified=await validateDocumentHistory(future,documentScopes);
    if(!verified.valid||verified.archive.labOnly!==true||
       !validateAssessmentArchiveV1(projected.appData,incomingAssessment).valid)throw rejected();
    const preview:DocumentRecoveryReview=Object.freeze({
     version:8,eventsBefore:priorCheck.archive.events.length,eventsAfter:verified.archive.events.length,
     gradesPreserved:true,assessmentsPreserved:true,recoveryCopyVerified:true,
     replacementRequiresConfirmation:true
    });
    // The staged current archive is no longer a valid App owner. Discard any
    // React state and key before making a physical DB2 replacement possible.
    await retire();
    await assure(token,generation);
    const grant=await service.prepareDocumentRestore({
     operation:'restore-document',
     password:options.vaultPassword,file:copyBytes(targetText),backupPassword:options.targetPassword,
     recoveryFile:copyBytes(recoveryText),recoveryPassword:options.recoveryPassword,
     currentAssessmentScopes:currentAssessment,incomingAssessmentScopes:incomingAssessment,
     documentScopes
    },metadata);
    await assure(token,generation);
    pendingGrant=grant;
    expectedSnapshot={...projected,settings:sanitizePersistedSettings(projected.settings),
      meta:withoutLocalBackupVerification(projected.meta)};
    phase='prepared';
    return {review:preview,grant};
   }catch{
    abandon();
    // Once write admission has closed, even a failed checkpoint must retire
    // the old UI/Vault: it cannot be silently revived with a sealed queue.
    if(sealed&&!retired){try{await retire();}catch{/* stay fail-closed */}}
    phase=retired?'uncertain':'ended';
    throw rejected();
   }
  },
  async commit(grant:object,consent:true){
   if(phase!=='prepared'||!pendingGrant||grant!==pendingGrant||consent!==true||!originalToken)
    throw rejected();
   const token=originalToken;
   pendingGrant=null;phase='committing'; // consume synchronously before await
   try{
    if(authority.currentToken()!==token||!await authority.isCurrent(token))throw rejected();
    await service.commit(grant,true);
    // A subsequent native epoch change cannot be represented as a certain
    // commit failure: the atomic write may already have completed.
    if(authority.currentToken()!==token||!await authority.isCurrent(token))throw rejected();
    phase='verification-required';
   }catch{
    phase='uncertain';abandon();throw rejected();
   }
  },
  async verifyAfterReopen(){
   if(phase!=='verification-required'||!originalToken||!expectedSnapshot)throw rejected();
   phase='uncertain'; // optimistic success is explicitly forbidden
   const fresh=await authority.freshAuthentication(originalToken);
   if(!fresh||!genuine(fresh.token)||fresh.token===originalToken||!genuine(fresh.password))return false;
   if(authority.currentToken()!==fresh.token||!await authority.isCurrent(fresh.token))return false;
   const reopenedStore=new ExistingSessionVaultStore(2,factory);
   const reopenedVault=new SecureVault(reopenedStore);
   try{
    await reopenedVault.unlock(fresh.password);
    await reopenedStore.verifyAuthenticatedRecords(fresh.password);
    if(authority.currentToken()!==fresh.token||!await authority.isCurrent(fresh.token))return false;
    const reopenedStorage=new SecureAppStorage(reopenedVault);
    const snapshot=await reopenedStorage.loadExactBackupSnapshot();
    if(!snapshot||!sameDb2Physical(snapshot,expectedSnapshot))return false;
    const history=(snapshot.appData as typeof snapshot.appData&{documentHistoryV1?:unknown}).documentHistoryV1;
    const doc=await validateDocumentHistory(history,documentScopes);
    if(!doc.valid||doc.archive.labOnly!==true||
       !validateAssessmentArchiveV1(snapshot.appData,incomingAssessment).valid)return false;
    if(authority.currentToken()!==fresh.token||!await authority.isCurrent(fresh.token))return false;
    phase='ended';expectedSnapshot=null;originalToken=null;
    return true;
   }catch{return false;}
   finally{
    reopenedVault.lock();
    await reopenedStore.retireConnection();
   }
  }
 };
}
