/**
 * VAL-01/D1b.2c: isolated version-bound, one-use copy verification.
 * No production call sites, persistent writes or restore authority.
 * The session owner MUST invalidate on lock/reset/restore and derive the
 * required version from committed archive state in the mutation queue.
 */
import { snapshotAssessmentData } from '../assessment/assessmentRevisionBindings';
import { createAssessmentBackupPayloadV7, inspectAssessmentBackupPayload } from '../security/assessmentBackupPayload';
import { createBackupPayload } from '../security/backupPayload';
import { encryptDataWithPassword, decryptDataWithPassword } from '../cryptoUtils';
import { expectedBackupEvidence, matchesDownloadedBackup, type BackupByteEvidence } from '../security/webBackupVerification';
import { saveEncryptedBackupOnAndroid, type AndroidBackupRuntime } from '../security/androidBackupExport';
import type { CompleteSecureAppSnapshot, SecureMeta, BackupVerificationEvidence } from '../security/secureAppStorage';

export type BackupPayloadVersion = 6|7;
type VersionedEvidence = Omit<BackupVerificationEvidence,'payloadVersion'> & {readonly payloadVersion:BackupPayloadVersion};
export type VersionedBackupMeta = Omit<SecureMeta,'verifiedBackupEvidence'> & {verifiedBackupEvidence?:VersionedEvidence};
export interface VersionedBackupReceipt {
  readonly includedChanges:number;
  readonly checkpointAt:string;
  readonly payloadVersion:BackupPayloadVersion;
}
type CopyEvidence=Readonly<BackupByteEvidence & {payloadVersion:BackupPayloadVersion}>;
type VerificationSource=VersionedEvidence['source'];
type Active=()=>boolean;
type Result='verified'|'cancelled';
interface Pending {
  receipt:VersionedBackupReceipt;
  evidence:CopyEvidence;
  phase:'ready'|'verifying'|'verified';
  source?:VerificationSource;
  active?:Active;
}
const invalid=()=>new Error('Ricevuta della copia non valida o non più attuale.');
const versionOk=(v:unknown):v is BackupPayloadVersion=>v===6||v===7;
const countOk=(n:unknown):n is number=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=0;
const atOk=(v:unknown):v is string=>typeof v==='string'&&Number.isFinite(Date.parse(v));
const record=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const own=(v:object,k:string)=>Object.prototype.hasOwnProperty.call(v,k);
const sameBytes=(a:BackupByteEvidence,b:BackupByteEvidence)=>a.bytes===b.bytes&&a.sha256===b.sha256;

// Input is copied synchronously before the first await. No accessors,
// prototypes, cycles or unsafe serializer keys may enter the new path.
function detached(v:unknown):unknown {
  const copy=(x:unknown):unknown=>{
    if(Array.isArray(x))return x.map(copy);
    if(record(x)){
      const out:Record<string,unknown>={};
      for(const [k,y] of Object.entries(x)){
        if(['__proto__','constructor','prototype','toJSON'].includes(k))throw invalid();
        out[k]=copy(y);
      }
      return out;
    }
    if(typeof x==='number'&&!Number.isFinite(x))throw invalid();
    return x;
  };
  return copy(snapshotAssessmentData(v));
}
function containsDomain(v:unknown):boolean {
  if(Array.isArray(v))return v.some(containsDomain);
  return record(v)&&(own(v,'assessmentEvidenceV1')||Object.values(v).some(containsDomain));
}

export function verifiedBackupDateForVersion(meta:VersionedBackupMeta,required:BackupPayloadVersion):string|null{
  const at=meta.verifiedBackupAt,e=meta.verifiedBackupEvidence;
  return versionOk(required)&&atOk(at)&&at===meta.lastBackup&&e?.checkpointAt===at&&
    e.payloadVersion===required&&Number.isSafeInteger(e.bytes)&&e.bytes>0&&e.bytes<=32*1024*1024&&
    typeof e.sha256==='string'&&/^[0-9a-f]{64}$/.test(e.sha256)&&
    (e.source==='android-readback'||e.source==='web-readback')?at:null;
}

export function createVersionedBackupReceiptAuthority(version:BackupPayloadVersion){
  if(!versionOk(version))throw invalid();
  let epoch=0;
  let pending:Pending|null=null;
  function invalidate(){epoch++;pending=null;}
  function begin(receipt:VersionedBackupReceipt):Pending{
    if(!pending||pending.receipt!==receipt||pending.phase!=='ready')throw invalid();
    pending.phase='verifying';
    return pending;
  }
  function live(p:Pending,active:Active):boolean{
    return pending===p&&p.phase==='verifying'&&active();
  }
  function discard(p:Pending){if(pending===p)invalidate();}
  function finish(p:Pending,active:Active,source:VerificationSource):Result{
    if(!live(p,active)){discard(p);return 'cancelled';}
    p.source=source;p.active=active;p.phase='verified';
    return 'verified';
  }
  return {
    async prepare(snapshot:CompleteSecureAppSnapshot,approvedScopes:unknown,password:string,checkpointAt:string){
      invalidate();
      const generation=epoch;
      const captured=detached(snapshot);
      const scopes=detached(approvedScopes);
      if(!record(captured)||!record(captured.meta)||!countOk(captured.meta.changes)||!atOk(checkpointAt))throw invalid();
      if(version===6&&containsDomain(captured))throw invalid();
      const includedChanges=captured.meta.changes;
      const checkpoint={...captured,meta:{changes:0,lastBackup:checkpointAt}} as unknown as CompleteSecureAppSnapshot;
      const payload=version===7
        ? await createAssessmentBackupPayloadV7(checkpoint,scopes,checkpointAt)
        : createBackupPayload(checkpoint,checkpointAt);
      // Validate the generated payload before encryption, including v6 domain
      // rejection. Only the existing codecs may construct the payload.
      await inspectAssessmentBackupPayload(payload,checkpoint,scopes);
      if(epoch!==generation)throw invalid();
      const encryptedText=await encryptDataWithPassword(payload,password);
      const bytes=await expectedBackupEvidence(encryptedText);
      // Authenticate and inspect the actual serialized content, not a caller
      // supplied version label, before creating the receipt.
      const decoded=await decryptDataWithPassword(encryptedText,password);
      const inspected=await inspectAssessmentBackupPayload(decoded,checkpoint,scopes);
      const actualVersion=inspected.sourceVersion;
      if(actualVersion!==version||decoded.exportedAt!==checkpointAt||
         inspected.snapshot.meta.changes!==0||inspected.snapshot.meta.lastBackup!==checkpointAt||
         epoch!==generation)throw invalid();
      const evidence:CopyEvidence=Object.freeze({...bytes,payloadVersion:actualVersion});
      const receipt:VersionedBackupReceipt=Object.freeze({includedChanges,checkpointAt,payloadVersion:actualVersion});
      // Pending state contains no plaintext, password or ciphertext.
      pending={receipt,evidence,phase:'ready'};
      return {receipt,evidence,encryptedText};
    },
    async verifyWeb(receipt:VersionedBackupReceipt,file:Blob,isActive:Active):Promise<Result>{
      const p=begin(receipt);
      try{
        if(!live(p,isActive)){discard(p);return 'cancelled';}
        const matches=await matchesDownloadedBackup(file,p.evidence);
        if(!live(p,isActive)){discard(p);return 'cancelled';}
        if(!matches)throw invalid();
        return finish(p,isActive,'web-readback');
      }catch(error){discard(p);throw error;}
    },
    async verifyAndroid(receipt:VersionedBackupReceipt,encryptedText:string,filename:string,isActive:Active,runtime?:AndroidBackupRuntime):Promise<Result>{
      const p=begin(receipt);
      try{
        if(!live(p,isActive)){discard(p);return 'cancelled';}
        const actual=await expectedBackupEvidence(encryptedText);
        if(!live(p,isActive)){discard(p);return 'cancelled';}
        if(!sameBytes(actual,p.evidence))throw invalid();
        const result=await saveEncryptedBackupOnAndroid(encryptedText,filename,()=>live(p,isActive),runtime);
        if(result!=='verified'){discard(p);return 'cancelled';}
        return finish(p,isActive,'android-readback');
      }catch(error){discard(p);throw error;}
    },
    invalidate,
    consume(current:VersionedBackupMeta,receipt:VersionedBackupReceipt,requiredVersion:BackupPayloadVersion):VersionedBackupMeta{
      if(!pending||pending.receipt!==receipt)throw invalid();
      const p=pending;
      invalidate(); // Consume before persistence; no replay even after a failed write.
      if(p.phase!=='verified'||!p.source||!p.active||!p.active()||
         requiredVersion!==p.evidence.payloadVersion||!countOk(current.changes)||
         current.changes<receipt.includedChanges)throw invalid();
      return {changes:current.changes-receipt.includedChanges,lastBackup:receipt.checkpointAt,
        verifiedBackupAt:receipt.checkpointAt,verifiedBackupEvidence:{...p.evidence,source:p.source,checkpointAt:receipt.checkpointAt}};
    }
  };
}
