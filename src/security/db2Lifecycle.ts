/** VAL-01 D1b.5 — isolated authorized DB2 restore/erase/setup.
 * No runtime activation. A fresh Root session must reopen after every attempt.
 * The owner must seal and drain writes before prepare and revoke on lifecycle
 * changes; consent is bound to the complete physical inventory at commit. */
import {captureDb2,replaceDb2,createErasedDb2,db2Failure,type Db2Inventory,type ErasedDb2,sameDb2Physical} from './db2PhysicalLifecycle';
import {deriveKeyEncryptionKey,unwrapDataEncryptionKey,decryptJsonRecord,encryptJsonRecord,generateDataEncryptionKey,wrapDataEncryptionKey,KDF_ITERATIONS_V1} from './cryptoPrimitives';
import {decryptDataWithPassword,BACKUP_VERSION_V2} from '../cryptoUtils';
import {inspectAssessmentBackupPayload} from './assessmentBackupPayload';
import {projectAssessmentRestoreV7} from './assessmentRestorePolicy';
import {projectDocumentRestoreV8} from './documentBackupPayloadV8';
import {detachHistoricalDocumentData} from '../documents/documentHistoricalValidation';
import {snapshotAssessmentData} from '../assessment/assessmentRevisionBindings';
import type {ApprovedAssessmentScope} from '../assessment/assessmentArchive';
import {createInitialArchiveSnapshot,type NewArchiveSetup} from './initialArchiveSetup';
import {sanitizePersistedSettings} from './dataClassification';
import {assertCouncilSnapshotIntegrity} from '../council/councilEvidenceSnapshots';
import {withoutLocalBackupVerification} from '../persistence/backupCheckpoint';
import type {CompleteSecureAppSnapshot} from './secureAppStorage';
import type {VaultMetadataV1} from './vaultTypes';
const KEYS=['appData','settings','udas','customTests','submissions','planning','library','professionalMemory','copilotState','meta'] as const;
type Operation='restore'|'erase'|'setup'|'restore-assessment'|'restore-document';
type Grant=Readonly<{operation:Operation}>;
type Active=Extract<Db2Inventory,{state:'active'}>;
type Intent={operation:'restore';password:string;file:Blob;backupPassword:string}
  |{operation:'erase';password:string}|{operation:'setup';password:string;setup:NewArchiveSetup};
type AssessmentRestoreIntent={readonly operation:'restore-assessment';readonly password:string;readonly file:Blob;readonly backupPassword:string;readonly recoveryFile:Blob;readonly recoveryPassword:string;readonly currentScopes:readonly ApprovedAssessmentScope[];readonly incomingScopes:readonly ApprovedAssessmentScope[]};
/** DOC-01/D4c3d1 — lab-only full DB2 V8 restore with independently
 * approved assessment and document scopes and exact physical owner.
 */
export type DocumentRestoreIntent={readonly operation:'restore-document';readonly password:string;
 readonly file:Blob;readonly backupPassword:string;readonly recoveryFile:Blob;readonly recoveryPassword:string;
 readonly currentAssessmentScopes:readonly unknown[];readonly incomingAssessmentScopes:readonly unknown[];
 readonly documentScopes:readonly unknown[]};
const own=(x:object,k:string)=>Object.prototype.hasOwnProperty.call(x,k);
function exact(value:unknown,keys:readonly string[]):boolean{
  return !!value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(k=>own(value,k));
}
async function authenticate(p:Active,password:string):Promise<CompleteSecureAppSnapshot>{
  const kek=await deriveKeyEncryptionKey(password,p.metadata.salt);
  const dek=await unwrapDataEncryptionKey(p.metadata.wrappedDek,p.metadata.wrapIv,kek);
  return Object.fromEntries(await Promise.all(p.records.map(async r=>[r.recordKey,await decryptJsonRecord(r,dek)]))) as unknown as CompleteSecureAppSnapshot;
}
async function buildActive(s:CompleteSecureAppSnapshot,password:string):Promise<Active>{
  if(!password||!exact(s,KEYS)||!Number.isSafeInteger(s.meta?.changes)||s.meta.changes<0)throw db2Failure();
  const clean={...s,settings:sanitizePersistedSettings(s.settings),meta:withoutLocalBackupVerification(s.meta)};
  await assertCouncilSnapshotIntegrity(clean.appData);
  const salt=crypto.getRandomValues(new Uint8Array(16));
  const dek=await generateDataEncryptionKey();
  const kek=await deriveKeyEncryptionKey(password,salt);
  const wrapped=await wrapDataEncryptionKey(dek,kek);
  const now=new Date().toISOString();
  const metadata:VaultMetadataV1={vaultVersion:1,state:'ACTIVE',kdf:{name:'PBKDF2',hash:'SHA-256',iterations:KDF_ITERATIONS_V1},salt,wrappedDek:wrapped.wrappedKey,wrapIv:wrapped.iv,createdAt:now,updatedAt:now};
  const records=await Promise.all(KEYS.map(k=>encryptJsonRecord(k,1,clean[k],dek)));
  // Verify the candidate bytes with the wrapped key, before mutating DB2.
  const next:Active={state:'active',metadata,records:records.sort((a,b)=>a.recordKey.localeCompare(b.recordKey))};
  if(!sameDb2Physical(await authenticate(next,password),clean))throw db2Failure();
  return next;
}
async function restoreSnapshot(intent:Extract<Intent,{operation:'restore'}>,current:CompleteSecureAppSnapshot){
  if(!(intent.file instanceof Blob)||intent.file.size<=0||intent.file.size>32*1024*1024)throw db2Failure();
  const text=new TextDecoder('utf-8',{fatal:true}).decode(await intent.file.arrayBuffer());
  if(JSON.parse(text).version!==BACKUP_VERSION_V2)throw db2Failure();
  const payload=await decryptDataWithPassword(text,intent.backupPassword);
  // Deliberately only complete v6 for this gate. v7 and partial/legacy copies
  // must not silently overwrite the upgraded archive or assessment evidence.
  if(!exact(payload,['app','backupDataVersion','exportedAt','snapshot'])||payload.app!=='registro-docente'||payload.backupDataVersion!==6||
    typeof payload.exportedAt!=='string'||!Number.isFinite(Date.parse(payload.exportedAt))||!exact(payload.snapshot,KEYS))throw db2Failure();
  const inspected=await inspectAssessmentBackupPayload(payload,current,[]);
  if(inspected.sourceVersion!==6||inspected.replacementRequiresReview)throw db2Failure();
  return inspected.snapshot;
}
async function readEncryptedAssessmentCopy(file:Blob,password:string){
  if(!(file instanceof Blob)||file.size<=0||file.size>32*1024*1024)throw db2Failure();
  const bytes=await file.arrayBuffer();
  if(bytes.byteLength!==file.size)throw db2Failure();
  const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
  if(JSON.parse(text).version!==BACKUP_VERSION_V2)throw db2Failure();
  return decryptDataWithPassword(text,password);
}
export async function inspectDb2LifecycleState(factory:IDBFactory=globalThis.indexedDB):Promise<'active'|'erased'|'unverifiable'>{
  try{return (await captureDb2(factory)).state;}catch{return 'unverifiable';}
}
export function createDb2Lifecycle(factory:IDBFactory=globalThis.indexedDB){
  let controller:AbortController|null=null;
  let pending:{grant:Grant;previous:Db2Inventory;next:Db2Inventory;controller:AbortController}|null=null;
  function invalidate(){controller?.abort();controller=null;pending=null;}
  return {
    invalidate,
    async prepare(intent:Intent,expectedOwner?:VaultMetadataV1|ErasedDb2):Promise<Grant>{
      invalidate();
      if(!['restore','erase','setup'].includes(intent.operation))throw db2Failure();
      const attempt=new AbortController();controller=attempt;
      try{
        const previous=await captureDb2(factory,attempt.signal);
        if(expectedOwner&&!sameDb2Physical(previous.metadata,expectedOwner))throw db2Failure();
        let next:Db2Inventory;
        if(intent.operation==='setup'){
          if(previous.state!=='erased')throw db2Failure();
          next=await buildActive(createInitialArchiveSnapshot(intent.setup),intent.password);
        }else{
          if(previous.state!=='active')throw db2Failure();
          const current=await authenticate(previous,intent.password);
          next=intent.operation==='erase'?{state:'erased',metadata:createErasedDb2(),records:[]}:
            await buildActive(await restoreSnapshot(intent,current),intent.password);
        }
        if(attempt.signal.aborted||controller!==attempt)throw db2Failure();
        const grant=Object.freeze({operation:intent.operation});
        pending={grant,previous,next,controller:attempt};
        return grant;
      }catch{if(controller===attempt)invalidate();throw db2Failure();}
    },
    /** Opt-in laboratory-only V7 path. The owner must have sealed/drained and
     * retired its connection; supply independently approved scopes and exact
     * authenticated generation. Commit remains a separate one-use consent.
     */
    async prepareAssessmentRestore(intent:AssessmentRestoreIntent,expectedOwner:VaultMetadataV1):Promise<Grant>{
      invalidate();
      const attempt=new AbortController();controller=attempt;
      try{
        if(!expectedOwner||intent.operation!=='restore-assessment')throw db2Failure();
        // Freeze caller inputs before first await. Blobs are immutable.
        const owner=structuredClone(expectedOwner);
        const {password,file,backupPassword,recoveryFile,recoveryPassword}=intent;
        const currentScopes=snapshotAssessmentData(intent.currentScopes) as readonly ApprovedAssessmentScope[];
        const incomingScopes=snapshotAssessmentData(intent.incomingScopes) as readonly ApprovedAssessmentScope[];
        const previous=await captureDb2(factory,attempt.signal);
        if(previous.state!=='active'||!sameDb2Physical(previous.metadata,owner))throw db2Failure();
        const current=await authenticate(previous,password);
        const [incoming,recovery]=await Promise.all([readEncryptedAssessmentCopy(file,backupPassword),readEncryptedAssessmentCopy(recoveryFile,recoveryPassword)]);
        const projected=await projectAssessmentRestoreV7(current,incoming,recovery,currentScopes,incomingScopes);
        if(attempt.signal.aborted||controller!==attempt)throw db2Failure();
        const next=await buildActive(projected,password);
        if(attempt.signal.aborted||controller!==attempt)throw db2Failure();
        const grant=Object.freeze({operation:'restore-assessment' as const});
        pending={grant,previous,next,controller:attempt};
        return grant;
      }catch{if(controller===attempt)invalidate();throw db2Failure();}
    },
    /** DOC-01/D4c3d1: V8-only synthetic physical DB2 restore.
     * The owner must seal/drain, retire its existing DB2 connection and
     * independently approve assessment and document scopes before calling.
     * No production App/Root entrypoint supplies this intent.
     */
    async prepareDocumentRestore(intent:DocumentRestoreIntent,expectedOwner:VaultMetadataV1):Promise<Grant>{
      invalidate();
      const attempt=new AbortController();controller=attempt;
      try{
        if(!expectedOwner||intent.operation!=='restore-document')throw db2Failure();
        // Bind all caller inputs before the first async operation, so changing
        // an approval or expected metadata while unlocking cannot escalate it.
        const owner=structuredClone(expectedOwner);
        const {password,file,backupPassword,recoveryFile,recoveryPassword}=intent;
        const currentScopes=snapshotAssessmentData(intent.currentAssessmentScopes) as readonly ApprovedAssessmentScope[];
        const incomingScopes=snapshotAssessmentData(intent.incomingAssessmentScopes) as readonly ApprovedAssessmentScope[];
        const documentScopes=detachHistoricalDocumentData(intent.documentScopes) as readonly unknown[];
        const previous=await captureDb2(factory,attempt.signal);
        if(previous.state!=='active'||!sameDb2Physical(previous.metadata,owner))throw db2Failure();
        const current=await authenticate(previous,password);
        const [incoming,recovery]=await Promise.all([
          readEncryptedAssessmentCopy(file,backupPassword),
          readEncryptedAssessmentCopy(recoveryFile,recoveryPassword)
        ]);
        if(attempt.signal.aborted||controller!==attempt)throw db2Failure();
        const projected=await projectDocumentRestoreV8(current,incoming,recovery,
          currentScopes,incomingScopes,documentScopes);
        if(attempt.signal.aborted||controller!==attempt)throw db2Failure();
        const next=await buildActive(projected,password);
        if(attempt.signal.aborted||controller!==attempt)throw db2Failure();
        const grant=Object.freeze({operation:'restore-document' as const});
        pending={grant,previous,next,controller:attempt};
        return grant;
      }catch{if(controller===attempt)invalidate();throw db2Failure();}
    },
    async commit(grant:Grant,confirmed:boolean):Promise<void>{
      if(!pending||pending.grant!==grant||confirmed!==true){invalidate();throw db2Failure();}
      const {previous,next,controller:attempt}=pending;pending=null;
      try{
        await replaceDb2(factory,previous,next,attempt.signal);
        // Readback mismatch/revocation AFTER commit is not rollback. Never
        // write the previous image back; owner must inspect under lock.
        const verified=await captureDb2(factory,attempt.signal);
        if(!sameDb2Physical(verified,next))throw db2Failure();
      }finally{if(controller===attempt)invalidate();}
    }
  };
}
