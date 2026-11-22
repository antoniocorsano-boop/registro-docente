/** VAL-01/PRODUCT-05/S7d.3b — encrypted candidate metadata, SYNTHETIC LAB ONLY.
 * AES-GCM authenticates this record under a separately supplied laboratory key
 * and the dedicated record-key AAD. It does NOT grant production backup status.
 * An authenticated old ciphertext remains valid: anti-rollback requires a
 * separately trusted current head/session/snapshot, never the ciphertext itself.
 * NO imports into SecureAppStorage, SecureMeta, UI, DB2 or production restore.
 */
import {decryptJsonRecord,encryptJsonRecord} from './cryptoPrimitives';
import {detachDocumentBackupJson} from './documentBackupPayloadV8';
import {validateFormativeV10ReceiptJournal,type FormativeV10ReceiptJournalV1} from './formativeV10ReceiptJournal';
import type {EncryptedVaultRecord} from './vaultTypes';

export const FORMATIVE_V10_STAGED_META_KEY='formativeV10StagedMetadataV1';
export interface FormativeV10MetadataAnchorV1 {
 readonly trustedHeadDigest:string;
 readonly trustedSessionBinding:string;
 readonly trustedSnapshotDigest:string;
}
/** Protected and independently sourced inputs. A value copied from the
 * encrypted record is NOT a trusted anchor. */
export interface FormativeV10StagedMetadataV1 {
 readonly schemaVersion:1;
 readonly kind:'formative-v10-staged-metadata';
 readonly state:'lab-authenticated-not-official';
 readonly payloadVersion:10;
 readonly journalVersion:1;
 readonly recordCount:number;
 readonly headDigest:string;
 readonly sessionBinding:string;
 readonly sourceSnapshotSha256:string;
 readonly copySha256:string;
 readonly checkpointAt:string;
 readonly recordedAt:string;
}
const metaKeys=['schemaVersion','kind','state','payloadVersion','journalVersion',
 'recordCount','headDigest','sessionBinding','sourceSnapshotSha256','copySha256',
 'checkpointAt','recordedAt'] as const;
const anchorKeys=['trustedHeadDigest','trustedSessionBinding','trustedSnapshotDigest'] as const;
const digest=/^[0-9a-f]{64}$/;
const fail=():never=>{throw Error('FORMATIVE_V10_STAGED_METADATA_REJECTED');};
function exact(x:unknown,keys:readonly string[]):x is Record<string,unknown>{
 if(!x||typeof x!=='object'||Array.isArray(x))return false;
 const proto=Object.getPrototypeOf(x);
 if(proto!==Object.prototype&&proto!==null)return false;
 const own=Reflect.ownKeys(x);
 return own.length===keys.length&&own.every(k=>typeof k==='string'&&keys.includes(k))&&
  keys.every(k=>{
   const d=Object.getOwnPropertyDescriptor(x,k);
   return d!==undefined&&d.enumerable&&Object.prototype.hasOwnProperty.call(d,'value');
  });
}
function iso(x:unknown):x is string{
 if(typeof x!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(x))return false;
 const n=Date.parse(x);
 return Number.isFinite(n)&&new Date(n).toISOString()===x;
}
function hex(x:unknown):x is string{return typeof x==='string'&&digest.test(x);}
function copy<T>(raw:unknown):T{
 try{return detachDocumentBackupJson(raw) as T;}catch{return fail();}
}
function checkAnchor(raw:unknown):FormativeV10MetadataAnchorV1{
 const x=copy<unknown>(raw);
 if(!exact(x,anchorKeys)||!hex(x.trustedHeadDigest)||
    !hex(x.trustedSessionBinding)||!hex(x.trustedSnapshotDigest))return fail();
 return x as unknown as FormativeV10MetadataAnchorV1;
}
function checkMetadata(raw:unknown):FormativeV10StagedMetadataV1{
 const x=copy<unknown>(raw);
 if(!exact(x,metaKeys)||x.schemaVersion!==1||
   x.kind!=='formative-v10-staged-metadata'||x.state!=='lab-authenticated-not-official'||
   x.payloadVersion!==10||x.journalVersion!==1||
   typeof x.recordCount!=='number'||!Number.isSafeInteger(x.recordCount)||
   x.recordCount<1||x.recordCount>1000||
   !hex(x.headDigest)||!hex(x.sessionBinding)||!hex(x.sourceSnapshotSha256)||
   !hex(x.copySha256)||!iso(x.checkpointAt)||!iso(x.recordedAt)||
   x.recordedAt<x.checkpointAt)return fail();
 return x as unknown as FormativeV10StagedMetadataV1;
}
async function validated(
 rawJournal:unknown,rawAnchor:unknown
):Promise<{journal:FormativeV10ReceiptJournalV1;anchor:FormativeV10MetadataAnchorV1;
 last:FormativeV10ReceiptJournalV1['records'][number]}>{
 const anchor=checkAnchor(rawAnchor);
 const v=await validateFormativeV10ReceiptJournal(rawJournal,anchor.trustedHeadDigest);
 if(!v.valid||v.journal.records.length===0)return fail();
 const last=v.journal.records[v.journal.records.length-1];
 if(last.sourceSnapshotSha256!==anchor.trustedSnapshotDigest)return fail();
 return {journal:v.journal,anchor,last};
}
/** Cryptographic sealing under a caller-owned SYNTHETIC-ONLY key.
 * No save operation, trusted key derivation or operational authorization.
 */
export async function sealFormativeV10StagedMetadata(
 rawJournal:unknown,rawAnchor:unknown,recordedAt:string,syntheticKey:CryptoKey
):Promise<EncryptedVaultRecord>{
 try{
  const {journal,anchor,last}=await validated(rawJournal,rawAnchor);
  if(!iso(recordedAt)||recordedAt<last.recordedAt)return fail();
  const metadata:FormativeV10StagedMetadataV1={
   schemaVersion:1,kind:'formative-v10-staged-metadata',
   state:'lab-authenticated-not-official',payloadVersion:10,journalVersion:1,
   recordCount:journal.records.length,headDigest:anchor.trustedHeadDigest,
   sessionBinding:anchor.trustedSessionBinding,
   sourceSnapshotSha256:anchor.trustedSnapshotDigest,
   copySha256:last.sha256,checkpointAt:last.checkpointAt,recordedAt
  };
  return await encryptJsonRecord(FORMATIVE_V10_STAGED_META_KEY,1,metadata,syntheticKey);
 }catch{return fail();}
}
/** Opening never trusts the sealed record to supply its own expected head.
 * The independently trusted anchor and complete journal are mandatory.
 * Rollback of BOTH the trusted anchor and the encrypted record cannot be
 * detected here; later durable coordination must provide anti-rollback state.
 */
export async function openFormativeV10StagedMetadata(
 rawEncrypted:unknown,rawJournal:unknown,rawAnchor:unknown,syntheticKey:CryptoKey
):Promise<FormativeV10StagedMetadataV1>{
 try{
  const {journal,anchor,last}=await validated(rawJournal,rawAnchor);
  if(!rawEncrypted||typeof rawEncrypted!=='object'||Array.isArray(rawEncrypted))
   return fail();
  const r=rawEncrypted as Partial<EncryptedVaultRecord>;
  if(r.recordKey!==FORMATIVE_V10_STAGED_META_KEY||r.schemaVersion!==1||
     !(r.iv instanceof Uint8Array)||r.iv.byteLength!==12||
     !(r.ciphertext instanceof ArrayBuffer)||r.ciphertext.byteLength<16)return fail();
  const decrypted=await decryptJsonRecord<unknown>(r as EncryptedVaultRecord,syntheticKey);
  const meta=checkMetadata(decrypted);
  if(meta.headDigest!==anchor.trustedHeadDigest||
     meta.sessionBinding!==anchor.trustedSessionBinding||
     meta.sourceSnapshotSha256!==anchor.trustedSnapshotDigest||
     meta.recordCount!==journal.records.length||
     meta.copySha256!==last.sha256||meta.checkpointAt!==last.checkpointAt||
     meta.recordedAt<last.recordedAt)return fail();
  return meta;
 }catch{return fail();}
}
