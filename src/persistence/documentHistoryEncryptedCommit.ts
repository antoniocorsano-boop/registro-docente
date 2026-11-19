/**
 * DOC-01/D4c3a — isolated, encrypted, compare-and-swap history admission.
 *
 * LAB / SYNTHETIC_ONLY / NO_RUNTIME. The supplied storage port must perform
 * a durable, atomic CAS in the same transaction as its generation check.
 * This module does not implement that port, create a DB or grant authority.
 * DB2 has a closed record inventory: introducing this key requires a separate
 * explicitly authorized version/migration/backup and restore qualification.
 *
 * AES-GCM authenticates ciphertext under the existing session DEK. It does
 * NOT establish who confirmed an event or protect against rollback of a
 * complete, otherwise valid older encrypted archive.
 */
import {applyDocumentHistoryOperation, validateDocumentHistory, type DocumentHistoryV1} from '../documents/documentHistoryTransitions';
import {detachHistoricalDocumentData} from '../documents/documentHistoricalValidation';
import {encryptJsonRecord, decryptJsonRecord} from '../security/cryptoPrimitives';
import type {EncryptedVaultRecord} from '../security/vaultTypes';
import type {DurableMutationCoordinator} from './durableMutationCoordinator';

export const DOC01_HISTORY_RECORD_KEY = 'doc01-history-v1' as const;
export type DocumentHistoryCipherSlot = Readonly<{
  /** Opaque storage-owned generation; never synthesized from a document digest. */
  generation: string;
  encrypted: EncryptedVaultRecord | null;
}>;
export type DocumentHistoryCasResult =
  | Readonly<{committed:true; generation:string}>
  | Readonly<{committed:false}>;

/** Atomicity and durability are REQUIRED semantics, not established by this
 * TypeScript type. Future IndexedDB integration must prove them independently. */
export interface DocumentHistoryAtomicStorage {
  read():Promise<DocumentHistoryCipherSlot>;
  compareAndSwap(
    expectedGeneration:string,
    encrypted:EncryptedVaultRecord
  ):Promise<DocumentHistoryCasResult>;
}
export interface SyntheticDocumentHistoryOwner {
  readonly mode:'SYNTHETIC_ONLY';
  readonly coordinator:DurableMutationCoordinator;
  readonly storage:DocumentHistoryAtomicStorage;
  /** Existing authenticated owner supplies the unlocked DEK, never a new key. */
  getSessionKey():CryptoKey;
  isActive():boolean;
}
export type DocumentHistoryCommitReceipt = Readonly<{
  changed:boolean;
  eventId:string;
  head:string|null;
  eventCount:number;
}>;

const refused = () => Error('DOC-01: sessione o storico cifrato non verificabile.');
const assertSession = (owner:SyntheticDocumentHistoryOwner) => {
  if(owner.mode!=='SYNTHETIC_ONLY'||!owner.isActive())throw refused();
};
function checkSlot(slot:DocumentHistoryCipherSlot):void{
  if(!slot||typeof slot.generation!=='string'||!/^[A-Za-z0-9._:-]{1,128}$/.test(slot.generation))throw refused();
  if(slot.encrypted!==null&&
    (!slot.encrypted||slot.encrypted.recordKey!==DOC01_HISTORY_RECORD_KEY||
      slot.encrypted.schemaVersion!==1||
      !(slot.encrypted.iv instanceof Uint8Array)||slot.encrypted.iv.byteLength!==12||
      !(slot.encrypted.ciphertext instanceof ArrayBuffer)||slot.encrypted.ciphertext.byteLength<16))throw refused();
}
async function verifiedHistory(
  slot:DocumentHistoryCipherSlot,key:CryptoKey,scopes:unknown
):Promise<DocumentHistoryV1>{
  checkSlot(slot);
  const raw:unknown=slot.encrypted===null
    ? {schemaVersion:1,labOnly:true,events:[]}
    : await decryptJsonRecord<unknown>(slot.encrypted,key);
  const inspected=await validateDocumentHistory(raw,scopes);
  if(!inspected.valid)throw refused();
  return inspected.archive;
}
const receipt=(archive:DocumentHistoryV1,eventId:string,changed:boolean):DocumentHistoryCommitReceipt=>Object.freeze({
  changed,eventId,head:archive.events.at(-1)?.eventDigest??null,eventCount:archive.events.length
});

/** Revalidate inside the canonical mutation queue, not at UI request time.
 * An uncertain post-commit readback or revoked session never receives success.
 * A caller may retry the exact event after reauthentication to discover
 * whether it committed; idempotency is supplied by D4c2b.
 */
export async function commitEncryptedDocumentHistory(
  owner:SyntheticDocumentHistoryOwner,
  approvedScopes:unknown,
  request:unknown
):Promise<DocumentHistoryCommitReceipt>{
  assertSession(owner);
  // Snapshot the user-controlled inputs before any await/queue contention.
  const scopes=detachHistoricalDocumentData(approvedScopes);
  const action=detachHistoricalDocumentData(request);
  return owner.coordinator.enqueueTask(async()=>{
    assertSession(owner);
    const key=owner.getSessionKey();
    assertSession(owner);
    try{
      const before=await owner.storage.read();
      assertSession(owner);
      const current=await verifiedHistory(before,key,scopes);
      const change=await applyDocumentHistoryOperation(current,scopes,action);
      if(!change.valid)throw refused();
      assertSession(owner);
      if(!change.changed)return receipt(change.archive,(action as {eventId:string}).eventId,false);
      const cipher=await encryptJsonRecord(DOC01_HISTORY_RECORD_KEY,1,change.archive,key);
      assertSession(owner);
      // A stale writer must never overwrite a current history or its head.
      const committed=await owner.storage.compareAndSwap(before.generation,cipher);
      if(!committed.committed||committed.generation===before.generation)throw refused();
      assertSession(owner);
      // The CAS receipt alone is insufficient: verify persisted ciphertext.
      const after=await owner.storage.read();
      assertSession(owner);
      if(after.generation!==committed.generation)throw refused();
      const verified=await verifiedHistory(after,key,scopes);
      if(JSON.stringify(verified)!==JSON.stringify(change.archive))throw refused();
      assertSession(owner);
      return receipt(verified,(action as {eventId:string}).eventId,true);
    }catch{
      // Do not leak which digest, content or session secret was rejected.
      throw refused();
    }
  });
}
