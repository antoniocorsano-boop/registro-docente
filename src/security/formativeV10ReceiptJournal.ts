/** VAL-01/PRODUCT-05/S7d.3a — versioned V10 receipt journal CANDIDATE.
 * Pure, non-authoritative model. No Vault, SecureMeta, AppData, UI, DB2,
 * Android filesystem, or official backup write is permitted from this module.
 * The source laboratory receipt is NOT an official or trusted grant.
 */
import type {FormativeV10LabRecord} from '../persistence/formativeV10DurableReceiptLab';
import {detachDocumentBackupJson} from './documentBackupPayloadV8';

export interface FormativeV10ReceiptCandidateV1 {
 readonly schemaVersion:1;
 readonly kind:'formative-v10-receipt-candidate';
 readonly state:'staged-not-official';
 readonly sequence:number;
 readonly checkpointAt:string;
 readonly recordedAt:string;
 readonly source:'web-readback'|'android-readback';
 readonly bytes:number;
 readonly sha256:string;
 readonly includedChanges:number;
 readonly sourceSnapshotSha256:string;
 readonly previousDigest:string|null;
 readonly contentDigest:string;
}
export interface FormativeV10ReceiptJournalV1 {
 readonly version:1;
 readonly records:readonly FormativeV10ReceiptCandidateV1[];
}
export type V10JournalCheck=
 |{readonly valid:true;readonly journal:FormativeV10ReceiptJournalV1}
 |{readonly valid:false;readonly issue:'INVALID_OR_UNANCHORED_JOURNAL'};
const keys=['schemaVersion','kind','state','sequence','checkpointAt','recordedAt',
 'source','bytes','sha256','includedChanges','sourceSnapshotSha256','previousDigest',
 'contentDigest'] as const;
const labKeys=['schemaVersion','kind','state','payloadVersion','checkpointAt',
 'source','bytes','sha256','includedChanges','sourceSnapshotSha256'] as const;
const sha=/^[0-9a-f]{64}$/;
const maxRecords=1000;
const failure=()=>new Error('FORMATIVE_V10_RECEIPT_JOURNAL_REJECTED');
function exact(value:unknown,expected:readonly string[]):value is Record<string,unknown>{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const proto=Object.getPrototypeOf(value);
 if(proto!==Object.prototype&&proto!==null)return false;
 const names=Reflect.ownKeys(value);
 return names.length===expected.length&&
  names.every(x=>typeof x==='string'&&expected.includes(x))&&
  expected.every(k=>Object.prototype.hasOwnProperty.call(value,k)&&
   Object.prototype.hasOwnProperty.call(Object.getOwnPropertyDescriptor(value,k)??{},'value'));
}
function instant(v:unknown):v is string{
 if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v))return false;
 const parsed=Date.parse(v);
 return Number.isFinite(parsed)&&new Date(parsed).toISOString()===v;
}
const digest=(v:unknown):v is string=>typeof v==='string'&&sha.test(v);
const count=(v:unknown)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0;
const positive=(v:unknown)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>0&&v<=32*1024*1024;
function detached<T>(v:unknown):T{
 try{return detachDocumentBackupJson(v) as T;}catch{throw failure();}
}
function validRecord(r:unknown):r is FormativeV10ReceiptCandidateV1{
 if(!exact(r,keys))return false;
 return r.schemaVersion===1&&r.kind==='formative-v10-receipt-candidate'&&
  r.state==='staged-not-official'&&count(r.sequence)&&r.sequence>0&&
  instant(r.checkpointAt)&&instant(r.recordedAt)&&r.recordedAt>=r.checkpointAt&&
  (r.source==='web-readback'||r.source==='android-readback')&&positive(r.bytes)&&
  digest(r.sha256)&&count(r.includedChanges)&&digest(r.sourceSnapshotSha256)&&
  (r.previousDigest===null||digest(r.previousDigest))&&digest(r.contentDigest);
}
function canonical(r:Omit<FormativeV10ReceiptCandidateV1,'contentDigest'>):unknown[]{
 return ['VAL-01/PRODUCT-05/S7d.3a/receipt-candidate-v1',
  r.schemaVersion,r.kind,r.state,r.sequence,r.checkpointAt,r.recordedAt,
  r.source,r.bytes,r.sha256,r.includedChanges,r.sourceSnapshotSha256,r.previousDigest];
}
async function hash(row:Omit<FormativeV10ReceiptCandidateV1,'contentDigest'>):Promise<string>{
 const bytes=new TextEncoder().encode(JSON.stringify(canonical(row)));
 const result=await crypto.subtle.digest('SHA-256',bytes);
 return Array.from(new Uint8Array(result),x=>x.toString(16).padStart(2,'0')).join('');
}
/** The caller MUST provide a separately trusted expected head digest.
 * Supplying a journal together with its own claimed head is not independent
 * anti-rollback evidence; this function cannot establish such authority.
 */
export async function validateFormativeV10ReceiptJournal(
 source:unknown,expectedHeadDigest:string|null
):Promise<V10JournalCheck>{
 const rejected:V10JournalCheck={valid:false,issue:'INVALID_OR_UNANCHORED_JOURNAL'};
 try{
  if(expectedHeadDigest!==null&&!digest(expectedHeadDigest))return rejected;
  const input=detached<unknown>(source);
  if(!exact(input,['version','records'])||input.version!==1||
     !Array.isArray(input.records)||input.records.length>maxRecords)return rejected;
  let previous:string|null=null,at:string|null=null;
  for(let i=0;i<input.records.length;i++){
   const r=input.records[i];
   if(!validRecord(r)||r.sequence!==i+1||r.previousDigest!==previous||
      (at!==null&&r.checkpointAt<=at))return rejected;
   const {contentDigest:_,...unsigned}=r;
   if(await hash(unsigned)!==r.contentDigest)return rejected;
   previous=r.contentDigest;at=r.checkpointAt;
  }
  if(previous!==expectedHeadDigest)return rejected;
  return {valid:true,journal:input as unknown as FormativeV10ReceiptJournalV1};
 }catch{return rejected;}
}
function validLaboratorySource(x:unknown):x is FormativeV10LabRecord{
 if(!exact(x,labKeys))return false;
 return x.schemaVersion===1&&x.kind==='formative-v10-copy-proof'&&
  x.state==='lab-durable-not-official'&&x.payloadVersion===10&&
  instant(x.checkpointAt)&&
  (x.source==='web-readback'||x.source==='android-readback')&&
  positive(x.bytes)&&digest(x.sha256)&&count(x.includedChanges)&&
  digest(x.sourceSnapshotSha256);
}
/** Produces an UNTRUSTED proposal, not an official backup receipt.
 * Future production authorization must bind a proven physical file, exact
 * committed snapshot, authenticated archive session and durable metadata
 * transition; none is delegated to this pure helper.
 */
export async function proposeFormativeV10ReceiptJournalAppend(
 previous:unknown,expectedPreviousHead:string|null,
 laboratoryRecord:unknown,independentSnapshotDigest:string,recordedAt:string
):Promise<{readonly state:'staged-not-official';readonly journal:FormativeV10ReceiptJournalV1;
 readonly record:FormativeV10ReceiptCandidateV1}>{
 const prior:FormativeV10ReceiptJournalV1=previous===null?
  {version:1,records:[]}:detached(previous);
 const checked=await validateFormativeV10ReceiptJournal(prior,expectedPreviousHead);
 const lab=detached<unknown>(laboratoryRecord);
 if(!checked.valid||!validLaboratorySource(lab)||
    !digest(independentSnapshotDigest)||lab.sourceSnapshotSha256!==independentSnapshotDigest||
    !instant(recordedAt)||recordedAt<lab.checkpointAt||
    checked.journal.records.length>=maxRecords)throw failure();
 const last=checked.journal.records.at(-1);
 if(last&&lab.checkpointAt<=last.checkpointAt)throw failure();
 const unsigned:Omit<FormativeV10ReceiptCandidateV1,'contentDigest'>={
  schemaVersion:1,kind:'formative-v10-receipt-candidate',
  state:'staged-not-official',sequence:checked.journal.records.length+1,
  checkpointAt:lab.checkpointAt,recordedAt,source:lab.source,
  bytes:lab.bytes,sha256:lab.sha256,includedChanges:lab.includedChanges,
  sourceSnapshotSha256:lab.sourceSnapshotSha256,
  previousDigest:last?.contentDigest??null
 };
 const record={...unsigned,contentDigest:await hash(unsigned)};
 const journal:FormativeV10ReceiptJournalV1={
  version:1,records:[...checked.journal.records,record]
 };
 const verified=await validateFormativeV10ReceiptJournal(journal,record.contentDigest);
 if(!verified.valid)throw failure();
 return {state:'staged-not-official',journal:verified.journal,record};
}
