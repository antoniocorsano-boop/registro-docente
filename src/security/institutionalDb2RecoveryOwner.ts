/** DOC-01/D4c3e5 — institutional V9 DB2 owner, isolated from the product Root.
 * Uses the existing authenticated Android ciphertext picker and CAS service.
 * No live UI activation, no V1-to-V2 document migration, synthetic tests only.
 */
import type {InstitutionalRecoveryDriver,InstitutionalRecoveryReview} from './institutionalRecoveryDecision';



import type {DurableMutationCoordinator} from '../persistence/durableMutationCoordinator';

export type V9InstitutionalCopyKind='recovery'|'target';
export interface InstitutionalDb2Owner{
 readonly store:ExistingSessionVaultStore;
 readonly vault:SecureVault;
 readonly storage:SecureAppStorage;
 readonly coordinator:DurableMutationCoordinator;
}
export interface InstitutionalRecoverySessionAuthority {
 /** A native foreground/authenticated epoch, not a browser page timestamp. */
 currentToken():string|null;
 /** Must fail on suspension, lock or native epoch change. */
 isCurrent(token:string):Promise<boolean>;
 /** Synchronous native epoch-change notification, required during physical CAS. */
 subscribeEpochChanges(token:string,onRevoked:()=>void):()=>void;
 /** Hide and abandon all old App/React state before DB2 replacement. */
 onRetired():void;
 /** Must request a NEW authenticated epoch and password, not reuse the old one. */
 freshAuthentication(previousToken:string):Promise<{token:string;password:string}|null>;
}
export interface InstitutionalDb2RecoveryOptions {
 readonly owner:InstitutionalDb2Owner;
 readonly authority:InstitutionalRecoverySessionAuthority;
 readonly vaultPassword:string;
 readonly recoveryPassword:string;
 readonly targetPassword:string;
 readonly approvedCurrentAssessmentScopes:readonly unknown[];
 readonly approvedIncomingAssessmentScopes:readonly unknown[];
 readonly approvedInstitutionalScope:unknown;
 /** Synthetic fixture override. The real bridge defaults to Android SAF readback. */
 readonly selectCiphertext?:(kind:V9InstitutionalCopyKind,isActive:()=>boolean)=>Promise<string|null>;
 readonly factory?:IDBFactory;
}
import {createDb2Lifecycle} from './db2Lifecycle';
import {captureDb2,sameDb2Physical} from './db2PhysicalLifecycle';
import {readEncryptedBackupOnAndroid,ANDROID_BACKUP_MAX_BYTES} from './androidBackupExport';
import {decryptDataWithPassword} from '../cryptoUtils';
import {projectInstitutionalRestoreV9} from './institutionalBackupPayloadV9';
import {validateInstitutionalDocumentHistoryV2} from '../documents/institutionalDocumentHistoryV2';
import {detachHistoricalDocumentData} from '../documents/documentHistoricalValidation';
import {snapshotAssessmentData} from '../assessment/assessmentRevisionBindings';
import {validateAssessmentArchiveV1,type ApprovedAssessmentScope} from '../assessment/assessmentArchive';
import {ExistingSessionVaultStore} from './existingSessionVaultStore';
import {SecureVault} from './secureVault';
import {SecureAppStorage,type CompleteSecureAppSnapshot} from './secureAppStorage';
import {withoutLocalBackupVerification} from '../persistence/backupCheckpoint';
import {sanitizePersistedSettings} from './dataClassification';

const rejected=()=>Error('DOC-01: recupero istituzionale v9 non verificabile.');
const genuine=(value:unknown):value is string=>typeof value==='string'&&value.length>0;
const copyBytes=(value:string):Blob=>{
 const bytes=new TextEncoder().encode(value);
 if(!bytes.length||bytes.byteLength>ANDROID_BACKUP_MAX_BYTES)throw rejected();
 return new Blob([bytes],{type:'application/json'});
};

/** Actual DB2 owner and existing Android ciphertext-only SAF reader.
 * The synthetic source override is only connected in the isolated browser lab.
 * No production Root supplies an adapter, and V1 is refused before changes.
 */
export function createInstitutionalDb2RecoveryDriver(options:InstitutionalDb2RecoveryOptions):InstitutionalRecoveryDriver {
 if(!options||!options.owner||!options.authority||!genuine(options.vaultPassword)||
   !genuine(options.recoveryPassword)||!genuine(options.targetPassword)||
   !(options.owner.store instanceof ExistingSessionVaultStore)||
   !options.owner.vault||!options.owner.storage||!options.owner.coordinator||
   typeof options.authority.currentToken!=='function'||
   typeof options.authority.isCurrent!=='function'||
   typeof options.authority.subscribeEpochChanges!=='function'||
   typeof options.authority.onRetired!=='function'||
   typeof options.authority.freshAuthentication!=='function')throw rejected();
 const owner=options.owner,authority=options.authority;
 // Freeze approvals before any network-independent but asynchronous file picker.
 // Never derive an approval from an untrusted V9 file.
 const currentAssessment=snapshotAssessmentData(options.approvedCurrentAssessmentScopes) as ApprovedAssessmentScope[];
 const incomingAssessment=snapshotAssessmentData(options.approvedIncomingAssessmentScopes) as ApprovedAssessmentScope[];
 const institutionalScope=detachHistoricalDocumentData(options.approvedInstitutionalScope);
 if(!Array.isArray(currentAssessment)||!Array.isArray(incomingAssessment)||
   !institutionalScope||typeof institutionalScope!=='object'||Array.isArray(institutionalScope))throw rejected();
 const factory=options.factory??globalThis.indexedDB;
 if(!factory)throw rejected();
 const service=createDb2Lifecycle(factory);
 let phase:'idle'|'preparing'|'prepared'|'committing'|'verification-required'|'uncertain'|'ended'='idle';
 let revision=0;
 let pendingGrant:Awaited<ReturnType<ReturnType<typeof createDb2Lifecycle>['prepareDocumentRestore']>>|null=null;
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
 const picker=options.selectCiphertext??(async(_kind:V9InstitutionalCopyKind,isActive:()=>boolean)=>
  readEncryptedBackupOnAndroid(isActive));
 const select=async(kind:V9InstitutionalCopyKind,token:string,generation:number):Promise<string>=>{
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
    const history=(previous.appData as typeof previous.appData&{documentHistoryV2?:unknown}).documentHistoryV2;
    const priorCheck=await validateInstitutionalDocumentHistoryV2(history,institutionalScope);
    if(!priorCheck.valid||priorCheck.archive.labOnly!==false)throw rejected();
    const [incoming,recovery]=await Promise.all([
     decryptDataWithPassword(targetText,options.targetPassword),
     decryptDataWithPassword(recoveryText,options.recoveryPassword)
    ]);
    const projected=await projectInstitutionalRestoreV9(previous,incoming,recovery,
      currentAssessment,incomingAssessment,institutionalScope);
    const future=(projected.appData as typeof projected.appData&{documentHistoryV2?:unknown}).documentHistoryV2;
    const verified=await validateInstitutionalDocumentHistoryV2(future,institutionalScope);
    if(!verified.valid||verified.archive.labOnly!==false||
       !validateAssessmentArchiveV1(projected.appData,incomingAssessment).valid)throw rejected();
    const preview:InstitutionalRecoveryReview=Object.freeze({
     version:9,eventsBefore:priorCheck.archive.events.length,eventsAfter:verified.archive.events.length,
     gradesPreserved:true,assessmentsPreserved:true,recoveryCopyVerified:true,
     replacementRequiresConfirmation:true
    });
    // The staged current archive is no longer a valid App owner. Discard any
    // React state and key before making a physical DB2 replacement possible.
    await retire();
    await assure(token,generation);
    const grant=await service.prepareInstitutionalRestore({
     operation:'restore-institutional',
     password:options.vaultPassword,file:copyBytes(targetText),backupPassword:options.targetPassword,
     recoveryFile:copyBytes(recoveryText),recoveryPassword:options.recoveryPassword,
     currentAssessmentScopes:currentAssessment,incomingAssessmentScopes:incomingAssessment,
     institutionalScope
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
  async commit(candidate:object,consent:true){
   if(phase!=='prepared'||!pendingGrant||candidate!==pendingGrant||consent!==true||!originalToken)
    throw rejected();
   const token=originalToken;
   const grant=pendingGrant;
   pendingGrant=null;phase='committing'; // consume synchronously before await
   let unsubscribe:()=>void=()=>{};
   try{
    // Register BEFORE checking freshness. A change during IDB opening or a
    // pending transaction aborts the actual service CAS, not just its UI.
    unsubscribe=authority.subscribeEpochChanges(token,()=>{service.invalidate();});
    if(typeof unsubscribe!=='function')throw rejected();
    const stillAuthorized=()=>authority.currentToken()===token;
    if(!stillAuthorized()||!await authority.isCurrent(token))throw rejected();
    await service.commit(grant,true,stillAuthorized);
    // If a change happened after the transaction completed, do not claim
    // success or rollback. The result remains uncertain until fresh readback.
    if(!stillAuthorized()||!await authority.isCurrent(token))throw rejected();
    phase='verification-required';
   }catch{
    phase='uncertain';abandon();throw rejected();
   }finally{try{unsubscribe();}catch{/* fail-closed outcome already set */}}
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
    const history=(snapshot.appData as typeof snapshot.appData&{documentHistoryV2?:unknown}).documentHistoryV2;
    const doc=await validateInstitutionalDocumentHistoryV2(history,institutionalScope);
    if(!doc.valid||doc.archive.labOnly!==false||
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
