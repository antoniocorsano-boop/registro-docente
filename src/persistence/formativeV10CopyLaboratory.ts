/** VAL-01/PRODUCT-05/S7d.2c — isolated V10 physical-copy LAB.
 * This module has NO production call sites or write access to the Vault,
 * school data, backup metadata, Web downloads, Android files or DB2.
 * Passing a synthetic test is never a restore/commit authorization.
 */
import type {CompleteSecureAppSnapshot,SecureMeta} from '../security/secureAppStorage';
import {createFormativeBackupPayloadV10,encryptFormativeBackupV10,inspectFormativeBackupPayloadV10,
 projectFormativeRestoreV10} from '../security/formativeBackupPayloadV10';
import {detachDocumentBackupJson} from '../security/documentBackupPayloadV8';
import {sameDb2Physical} from '../security/db2PhysicalLifecycle';
import {decryptDataWithPassword} from '../cryptoUtils';
import {expectedBackupEvidence,matchesDownloadedBackup,type BackupByteEvidence} from '../security/webBackupVerification';
import {saveEncryptedBackupOnAndroid,type AndroidBackupRuntime} from '../security/androidBackupExport';

type Mode='web-readback'|'android-readback';
export interface V10LaboratoryOwner{
 isActive():boolean;
 /** Independent, non-production authority for a synthetic experiment only. */
 laboratoryApproved():boolean;
}
export interface V10CopyRequest{
 readonly assessmentScopes:unknown;
 readonly documentScope:unknown;
 readonly formativeScopes:unknown;
 readonly checkpointAt:string;
}
export interface V10PreparedCopy{
 readonly receipt:V10CopyReceipt;
 readonly evidence:Readonly<BackupByteEvidence&{payloadVersion:10}>;
 /** Encrypted AES-GCM envelope. The owner, not this authority, selects a file. */
 readonly encryptedText:string;
}
export interface V10CopyReceipt{
 readonly payloadVersion:10;
 readonly checkpointAt:string;
 readonly includedChanges:number;
}
export interface V10CopyLaboratoryProof{
 readonly state:'lab-verified-no-metadata-write';
 readonly payloadVersion:10;
 readonly checkpointAt:string;
 readonly source:Mode;
 readonly bytes:number;
 readonly sha256:string;
 readonly includedChanges:number;
}
export interface V10RestoreLaboratoryPreview{
 readonly state:'lab-projected-not-restored';
 readonly payloadVersion:10;
 readonly classCount:number;
 readonly formativeRevisionCount:number;
}
interface Pending{
 readonly receipt:V10CopyReceipt;
 readonly evidence:V10PreparedCopy['evidence'];
 phase:'ready'|'checking'|'verified';
 source?:Mode;
}
const invalid=():never=>{throw Error('FORMATIVE_V10_COPY_LAB_REJECTED');};
function active(owner:V10LaboratoryOwner):boolean{
 return owner.isActive()&&owner.laboratoryApproved();
}
function strictCount(n:unknown):n is number{
 return typeof n==='number'&&Number.isSafeInteger(n)&&n>=0&&n<Number.MAX_SAFE_INTEGER;
}
function sameEvidence(a:BackupByteEvidence,b:BackupByteEvidence):boolean{
 return a.bytes===b.bytes&&a.sha256===b.sha256;
}
function detached<T>(v:unknown):T{
 try{return detachDocumentBackupJson(v) as T;}catch{return invalid();}
}
/** One-use preparation + physical proof. No plaintext/password/file handle
 * retained in pending state. Pending evidence is invalidated on failure,
 * session change, re-preparation or proof consumption.
 */
export function createFormativeV10CopyLaboratory(owner:V10LaboratoryOwner){
 let pending:Pending|null=null;
 let epoch=0;
 function invalidate():void{epoch++;pending=null;}
 function begin(receipt:V10CopyReceipt):Pending{
  if(!active(owner)||!pending||pending.receipt!==receipt||pending.phase!=='ready')return invalid();
  pending.phase='checking';
  return pending;
 }
 function live(p:Pending,version:number):boolean{
  return pending===p&&epoch===version&&active(owner)&&p.phase==='checking';
 }
 function finish(p:Pending,version:number,source:Mode):'verified'|'cancelled'{
  if(!live(p,version)){invalidate();return 'cancelled';}
  p.phase='verified';p.source=source;return 'verified';
 }
 return {
  invalidate,
  async prepare(snapshot:CompleteSecureAppSnapshot,password:string,
   request:V10CopyRequest):Promise<V10PreparedCopy>{
   invalidate();
   const generation=epoch;
   if(!active(owner)||typeof password!=='string'||!password)return invalid();
   const s=detached<CompleteSecureAppSnapshot>(snapshot);
   const args=detached<V10CopyRequest>(request);
   if(!s||!s.meta||!strictCount(s.meta.changes)||
      typeof args.checkpointAt!=='string')return invalid();
   const includedChanges=s.meta.changes;
   // A logical checkpoint is NOT a durable backup receipt.
   const checkpoint={...s,meta:{changes:0,lastBackup:args.checkpointAt}};
   const payload=await createFormativeBackupPayloadV10(checkpoint,args.assessmentScopes,
    args.documentScope,args.formativeScopes,args.checkpointAt);
   if(generation!==epoch||!active(owner))return invalid();
   const encryptedText=await encryptFormativeBackupV10(checkpoint,password,
    args.assessmentScopes,args.documentScope,args.formativeScopes,args.checkpointAt);
   const bytes=await expectedBackupEvidence(encryptedText);
   const decoded=await decryptDataWithPassword(encryptedText,password);
   if(generation!==epoch||!active(owner)||!decoded||
      decoded.backupDataVersion!==10||decoded.exportedAt!==args.checkpointAt||
      !sameDb2Physical(decoded,payload))return invalid();
   const inspected=await inspectFormativeBackupPayloadV10(decoded,checkpoint,
    args.assessmentScopes,args.documentScope,args.formativeScopes,args.formativeScopes);
   if(generation!==epoch||!active(owner)||inspected.sourceVersion!==10||
      !sameDb2Physical(inspected.snapshot,payload.snapshot)||
      inspected.snapshot.meta.changes!==0||
      inspected.snapshot.meta.lastBackup!==args.checkpointAt)return invalid();
   const evidence=Object.freeze({...bytes,payloadVersion:10 as const});
   const receipt=Object.freeze({payloadVersion:10 as const,checkpointAt:args.checkpointAt,
    includedChanges});
   pending={receipt,evidence,phase:'ready'};
   return {receipt,evidence,encryptedText};
  },
  /** A verified Web copy requires an explicitly reselected saved Blob.
   * Triggering a browser download is NEVER a successful copy receipt.
   */
  async verifyWeb(receipt:V10CopyReceipt,downloadedFile:Blob):Promise<'verified'|'cancelled'>{
   const p=begin(receipt),version=epoch;
   try{
    if(!live(p,version)){invalidate();return 'cancelled';}
    if(!await matchesDownloadedBackup(downloadedFile,p.evidence))return invalid();
    return finish(p,version,'web-readback');
   }catch(error){invalidate();throw error;}
  },
  /** Uses the existing native plugin's verified-byte receipt, never a
   * JavaScript estimate of disk completion or an Android fallback download.
   */
  async verifyAndroid(receipt:V10CopyReceipt,encryptedText:string,filename:string,
   runtime:AndroidBackupRuntime):Promise<'verified'|'cancelled'>{
   const p=begin(receipt),version=epoch;
   try{
    if(!live(p,version)){invalidate();return 'cancelled';}
    const actual=await expectedBackupEvidence(encryptedText);
    if(!live(p,version)){invalidate();return 'cancelled';}
    if(!sameEvidence(actual,p.evidence))return invalid();
    const written=await saveEncryptedBackupOnAndroid(encryptedText,filename,
      ()=>live(p,version),runtime);
    if(written!=='verified'){invalidate();return 'cancelled';}
    return finish(p,version,'android-readback');
   }catch(error){invalidate();throw error;}
  },
  /** Consume once, without updating SecureMeta, changes or lastBackup.
   * A later production gate must verify physical state under its own lock.
   */
  consume(receipt:V10CopyReceipt,current:Pick<SecureMeta,'changes'>):V10CopyLaboratoryProof{
   const p=pending;
   invalidate();
   if(!p||p.receipt!==receipt||p.phase!=='verified'||!p.source||
      !active(owner)||!strictCount(current.changes)||
      current.changes!==receipt.includedChanges)return invalid();
   return {state:'lab-verified-no-metadata-write',payloadVersion:10,
    checkpointAt:receipt.checkpointAt,source:p.source,
    bytes:p.evidence.bytes,sha256:p.evidence.sha256,
    includedChanges:receipt.includedChanges};
  }
 };
}
/** A read-only projection from two ACTUALLY obtained encrypted file contents.
 * Both must authenticate independently, and the V10/V9 recovery guards
 * enforce exact checkpoint plus append-only history preservation.
 * Do not pass the projected snapshot into SecureAppStorage.restoreSnapshot.
 */
export async function previewFormativeV10PhysicalRecoveryLaboratory(
 owner:V10LaboratoryOwner,
 current:CompleteSecureAppSnapshot,
 incomingCiphertext:string,recoveryCiphertext:string,password:string,
 scopes:{
  currentAssessmentScopes:unknown;incomingAssessmentScopes:unknown;
  documentScope:unknown;currentFormativeScopes:unknown;incomingFormativeScopes:unknown
 }
):Promise<V10RestoreLaboratoryPreview>{
 if(!active(owner)||!incomingCiphertext||!recoveryCiphertext||!password)return invalid();
 const source=detached<CompleteSecureAppSnapshot>(current);
 const approved=detached<typeof scopes>(scopes);
 try{
  const incoming=await decryptDataWithPassword(incomingCiphertext,password);
  if(!active(owner))return invalid();
  const recovery=await decryptDataWithPassword(recoveryCiphertext,password);
  if(!active(owner)||incoming?.backupDataVersion!==10||
     recovery?.backupDataVersion!==10)return invalid();
  const proposed=await projectFormativeRestoreV10(source,incoming,recovery,
   approved.currentAssessmentScopes,approved.incomingAssessmentScopes,
   approved.documentScope,approved.currentFormativeScopes,approved.incomingFormativeScopes);
  if(!active(owner))return invalid();
  const classes=proposed.appData.classes;
  return {state:'lab-projected-not-restored',payloadVersion:10,
   classCount:classes.length,formativeRevisionCount:classes.reduce((sum,cls)=>
    sum+((cls as typeof cls&{formativeBalanceHistoryV1?:{records:unknown[]}})
      .formativeBalanceHistoryV1?.records.length??0),0)};
 }catch{return invalid();}
}
