/** PRODUCT-05/S7d.2d — isolated V10 encrypted receipt persistence laboratory.
 * No application imports, UI, or real archive access. In particular, never
 * writes SecureMeta, AppData or the live SecureVault. A fresh, synthetic vault
 * may be injected to test atomic encryption + exact readback.
 *
 * A physically verified V10 file is not by itself backup authority: the
 * candidate snapshot must still be identical inside the shared mutation queue.
 */
import type {CompleteSecureAppSnapshot} from '../security/secureAppStorage';
import type {DurableMutationCoordinator} from './durableMutationCoordinator';
import {createFormativeV10CopyLaboratory,type V10CopyReceipt,type V10CopyRequest,
 type V10LaboratoryOwner} from './formativeV10CopyLaboratory';
import type {AndroidBackupRuntime} from '../security/androidBackupExport';
import {detachDocumentBackupJson} from '../security/documentBackupPayloadV8';
import {sameDb2Physical} from '../security/db2PhysicalLifecycle';

export interface FormativeV10LabOwner extends V10LaboratoryOwner{
 readonly coordinator:DurableMutationCoordinator;
 /** An independently authenticated committed snapshot, never UI draft state. */
 readCommittedSnapshot():Promise<CompleteSecureAppSnapshot>;
 /** Retire the current laboratory session after an uncertain physical write. */
 invalidate():void;
}
export interface FormativeV10LabRecord{
 readonly schemaVersion:1;
 readonly kind:'formative-v10-copy-proof';
 readonly state:'lab-durable-not-official';
 readonly payloadVersion:10;
 readonly checkpointAt:string;
 readonly source:'web-readback'|'android-readback';
 readonly bytes:number;
 readonly sha256:string;
 readonly includedChanges:number;
 readonly sourceSnapshotSha256:string;
}
/** Only a dedicated synthetic store is admissible, never an ACTIVE app store.
 * In the integration fixture this is a new, ephemeral SecureVault with a
 * separate memory-backed VaultStore, using its existing 'meta' record key.
 */
export interface FormativeV10LabReceiptStore{
 readonly syntheticOnly:true;
 read():Promise<unknown>;
 write(record:FormativeV10LabRecord):Promise<void>;
}
type Prepared={receipt:V10CopyReceipt;snapshotSha256:string};
const invalid=(reason:string):never=>{throw Error('FORMATIVE_V10_DURABLE_LAB_'+reason);};
const active=(owner:FormativeV10LabOwner)=>owner.isActive()&&owner.laboratoryApproved();
function detached<T>(value:unknown):T{
 try{return detachDocumentBackupJson(value) as T;}
 catch{return invalid('INVALID_SOURCE');}
}
function digestOk(v:unknown):v is string{
 return typeof v==='string'&&/^[0-9a-f]{64}$/.test(v);
}
async function sourceDigest(snapshot:CompleteSecureAppSnapshot):Promise<string>{
 const bytes=new TextEncoder().encode(JSON.stringify(detached<CompleteSecureAppSnapshot>(snapshot)));
 const sha=await crypto.subtle.digest('SHA-256',bytes);
 return Array.from(new Uint8Array(sha),v=>v.toString(16).padStart(2,'0')).join('');
}
function recordValid(x:unknown):x is FormativeV10LabRecord{
 if(!x||typeof x!=='object'||Array.isArray(x))return false;
 const r=x as Record<string,unknown>;
 const expected=['schemaVersion','kind','state','payloadVersion','checkpointAt',
   'source','bytes','sha256','includedChanges','sourceSnapshotSha256'];
 return Object.keys(r).length===expected.length&&expected.every(k=>Object.prototype.hasOwnProperty.call(r,k))&&
  r.schemaVersion===1&&r.kind==='formative-v10-copy-proof'&&
  r.state==='lab-durable-not-official'&&r.payloadVersion===10&&
  typeof r.checkpointAt==='string'&&Number.isFinite(Date.parse(r.checkpointAt))&&
  (r.source==='web-readback'||r.source==='android-readback')&&
  typeof r.bytes==='number'&&Number.isSafeInteger(r.bytes)&&r.bytes>0&&r.bytes<=32*1024*1024&&
  digestOk(r.sha256)&&digestOk(r.sourceSnapshotSha256)&&
  typeof r.includedChanges==='number'&&Number.isSafeInteger(r.includedChanges)&&r.includedChanges>=0;
}
/** The only code that can consume the single-use copy proof is the same
 * closure that prepared it. An externally fabricated proof cannot enter.
 */
export function createFormativeV10DurableReceiptLab(
 owner:FormativeV10LabOwner,store:FormativeV10LabReceiptStore
){
 if(store?.syntheticOnly!==true)return invalid('PRODUCTION_STORE_FORBIDDEN');
 const copy=createFormativeV10CopyLaboratory(owner);
 let prepared:Prepared|null=null;
 function clear(){prepared=null;copy.invalidate();}
 async function readSnapshot(){
  if(!active(owner))return invalid('SESSION_REVOKED');
  const s=detached<CompleteSecureAppSnapshot>(await owner.readCommittedSnapshot());
  if(!s||!s.meta||typeof s.meta.changes!=='number'||
     !Number.isSafeInteger(s.meta.changes)||s.meta.changes<0)return invalid('INVALID_SOURCE');
  return s;
 }
 return {
  invalidate:clear,
  async prepare(password:string,request:V10CopyRequest){
   clear();
   return owner.coordinator.enqueueTask(async()=>{
    const snapshot=await readSnapshot();
    const sha=await sourceDigest(snapshot);
    const result=await copy.prepare(snapshot,password,request);
    if(!active(owner)||sha!==await sourceDigest(await readSnapshot())){
     clear();return invalid('SOURCE_CHANGED');
    }
    prepared={receipt:result.receipt,snapshotSha256:sha};
    return result;
   });
  },
  async verifyWeb(receipt:V10CopyReceipt,downloadedFile:Blob){
   return copy.verifyWeb(receipt,downloadedFile);
  },
  async verifyAndroid(receipt:V10CopyReceipt,encryptedText:string,filename:string,
   runtime:AndroidBackupRuntime){
   return copy.verifyAndroid(receipt,encryptedText,filename,runtime);
  },
  /** Serialized admission, exact snapshot binding, encrypted write and
   * exact readback. A write/read failure is uncertain: quarantine the owner;
   * NEVER claim a backup or retry on the same session.
   */
  async persistVerified(receipt:V10CopyReceipt):Promise<FormativeV10LabRecord>{
   if(!prepared||prepared.receipt!==receipt)return invalid('STALE_RECEIPT');
   const admitted=prepared;
   prepared=null;
   return owner.coordinator.enqueueTask(async()=>{
    if(!active(owner)){clear();return invalid('SESSION_REVOKED');}
    const current=await readSnapshot();
    const now=await sourceDigest(current);
    if(now!==admitted.snapshotSha256){clear();return invalid('SOURCE_CHANGED');}
    // Local receipt consumption is one-use even when persistence fails.
    const proof=copy.consume(receipt,current.meta);
    const record:FormativeV10LabRecord={
     schemaVersion:1,kind:'formative-v10-copy-proof',
     state:'lab-durable-not-official',
     payloadVersion:10,checkpointAt:proof.checkpointAt,source:proof.source,
     bytes:proof.bytes,sha256:proof.sha256,includedChanges:proof.includedChanges,
     sourceSnapshotSha256:admitted.snapshotSha256
    };
    if(!recordValid(record)){clear();return invalid('INVALID_PROOF');}
    // This single-record laboratory refuses overwrite; no fake append log.
    try{
     if(await store.read()!==null)return invalid('PREEXISTING_RECORD');
     if(!active(owner))return invalid('SESSION_REVOKED');
     await store.write(record);
     if(!active(owner))return invalid('SESSION_REVOKED_AFTER_WRITE');
     const verified=await store.read();
     if(!recordValid(verified)||!sameDb2Physical(record,verified))
      return invalid('READBACK_MISMATCH');
     if(!active(owner))return invalid('SESSION_REVOKED_AFTER_READBACK');
     if(await sourceDigest(await readSnapshot())!==admitted.snapshotSha256)
      return invalid('SOURCE_CHANGED_AFTER_WRITE');
     return detached<FormativeV10LabRecord>(verified);
    }catch(error){
     owner.invalidate();
     clear();
     const message=error instanceof Error?error.message:'WRITE_OR_READBACK';
     return invalid('PERSISTENCE_UNCERTAIN_'+message.slice(0,80));
    }
   });
  }
 };
}
