/** VAL-01/PRODUCT-05/S7d.3c — isolated V10 transactional LABORATORY.
 * Never imported into application, SecureMeta, DB2, Android or professional
 * backup paths. This model cannot create an official restore/backup grant.
 *
 * Two independently supplied synthetic stores are required:
 * 1. atomic CAS of (receipt journal + AES-GCM sealed candidate);
 * 2. a separately protected, durable, monotonic CAS of the trusted head.
 * They are not one cross-store atomic transaction. A torn/uncertain operation
 * MUST quarantine the session; recovery is read-only, no automatic retry.
 * Rollback of BOTH stores remains undetectable without a genuine nonrollback
 * trust root outside the application (not provided by this module).
 */
import type {DurableMutationCoordinator} from '../persistence/durableMutationCoordinator';
import type {FormativeV10LabRecord} from '../persistence/formativeV10DurableReceiptLab';
import {sameDb2Physical} from './db2PhysicalLifecycle';
import {detachDocumentBackupJson} from './documentBackupPayloadV8';
import {proposeFormativeV10ReceiptJournalAppend,type FormativeV10ReceiptJournalV1}
 from './formativeV10ReceiptJournal';
import {openFormativeV10StagedMetadata,sealFormativeV10StagedMetadata,
 type FormativeV10MetadataAnchorV1} from './formativeV10StagedMetadata';
import type {EncryptedVaultRecord} from './vaultTypes';

export interface FormativeV10LabPairV1 {
 readonly journal:FormativeV10ReceiptJournalV1;
 readonly encrypted:EncryptedVaultRecord;
}
export interface FormativeV10LabTrustedHeadV1 {
 readonly epoch:number;
 readonly headDigest:string;
 readonly sessionBinding:string;
 readonly snapshotDigest:string;
}
export type FormativeV10LabTrustedReadV1=
 |{readonly kind:'confirmed-absent'}
 |{readonly kind:'established';readonly head:FormativeV10LabTrustedHeadV1}
 |{readonly kind:'unverifiable'};
/** These are interfaces for synthetic failure-injection fixtures, NOT real
 * storage adapters. In particular, syntheticOnly is no production security
 * proof. compareAndReplace MUST be durable and atomic within this fixture.
 */
export interface FormativeV10LabPairStore {
 readonly syntheticOnly:true;
 read():Promise<FormativeV10LabPairV1|null>;
 compareAndReplace(expected:FormativeV10LabPairV1|null,next:FormativeV10LabPairV1):Promise<boolean>;
}
/** Independent monotonic anchor is a CONTRACTUAL assumption, not implemented
 * here. A missing anchor after prior establishment must yield 'unverifiable',
 * NEVER 'confirmed-absent'. It must never share rollback fate with pair store.
 */
export interface FormativeV10LabTrustedHeadStore {
 readonly syntheticOnly:true;
 read():Promise<FormativeV10LabTrustedReadV1>;
 compareAndAdvance(expected:FormativeV10LabTrustedReadV1,
  next:FormativeV10LabTrustedHeadV1):Promise<boolean>;
}
export interface FormativeV10LabTransactionOwner {
 readonly syntheticOnly:true;
 readonly coordinator:DurableMutationCoordinator;
 /** Fixed, authenticated session identity supplied by an independent owner. */
 readonly sessionBinding:string;
 isActive():boolean;
 /** Must measure the current committed snapshot, not an unsaved form. */
 readCommittedSnapshotDigest():Promise<string>;
 /** Revoke the session after any ambiguous or inconsistent persistence. */
 invalidate():void;
}
export interface FormativeV10LabTicket {readonly kind:'formative-v10-lab-once'}
export interface FormativeV10LabCommitResult {
 readonly state:'lab-anchored-not-official';
 readonly epoch:number;
 readonly headDigest:string;
}
export type FormativeV10LabInspection=
 |{readonly state:'pristine-synthetic-lab'}
 |{readonly state:'consistent-synthetic-lab';readonly epoch:number;readonly headDigest:string}
 |{readonly state:'quarantined'};
type Inspected={
 readonly anchor:FormativeV10LabTrustedReadV1;
 readonly pair:FormativeV10LabPairV1|null;
};
type Pending={
 readonly ticket:FormativeV10LabTicket;
 readonly lab:FormativeV10LabRecord;
 readonly snapshotDigest:string;
 readonly expected:FormativeV10LabTrustedReadV1;
 readonly recordedAt:string;
 readonly sealedAt:string;
 readonly revision:number;
};
const hex=/^[0-9a-f]{64}$/;
const fail=(reason='INVALID'):never=>{throw Error('FORMATIVE_V10_LAB_TRANSACTION_'+reason);};
const isHex=(x:unknown):x is string=>typeof x==='string'&&hex.test(x);
function copy<T>(value:unknown):T{
 try{return detachDocumentBackupJson(value) as T;}catch{return fail();}
}
function exact(v:unknown,fields:readonly string[]):v is Record<string,unknown>{
 if(!v||typeof v!=='object'||Array.isArray(v))return false;
 const proto=Object.getPrototypeOf(v);
 if(proto!==Object.prototype&&proto!==null)return false;
 const keys=Reflect.ownKeys(v);
 return keys.length===fields.length&&keys.every(x=>typeof x==='string'&&fields.includes(x))&&
  fields.every(k=>{
   const d=Object.getOwnPropertyDescriptor(v,k);
   return !!d&&d.enumerable&&Object.prototype.hasOwnProperty.call(d,'value');
  });
}
function validateHead(raw:unknown):FormativeV10LabTrustedHeadV1{
 const x=copy<unknown>(raw);
 if(!exact(x,['epoch','headDigest','sessionBinding','snapshotDigest'])||
   typeof x.epoch!=='number'||!Number.isSafeInteger(x.epoch)||x.epoch<1||x.epoch>1000||
   !isHex(x.headDigest)||!isHex(x.sessionBinding)||!isHex(x.snapshotDigest))return fail();
 return x as unknown as FormativeV10LabTrustedHeadV1;
}
function validateRead(raw:unknown):FormativeV10LabTrustedReadV1{
 const x=copy<unknown>(raw);
 if(exact(x,['kind'])&&x.kind==='confirmed-absent')return {kind:'confirmed-absent'};
 if(exact(x,['kind'])&&x.kind==='unverifiable')return {kind:'unverifiable'};
 if(!exact(x,['kind','head'])||x.kind!=='established')return fail();
 return {kind:'established',head:validateHead(x.head)};
}
function asMetaAnchor(head:FormativeV10LabTrustedHeadV1):FormativeV10MetadataAnchorV1{
 return {trustedHeadDigest:head.headDigest,trustedSessionBinding:head.sessionBinding,
  trustedSnapshotDigest:head.snapshotDigest};
}
function verifyPairShape(raw:unknown):FormativeV10LabPairV1{
 if(!exact(raw,['journal','encrypted']))return fail();
 const enc=raw.encrypted;
 if(!exact(enc,['recordKey','schemaVersion','iv','ciphertext']))return fail();
 if(!(enc.iv instanceof Uint8Array)||!(enc.ciphertext instanceof ArrayBuffer))return fail();
 return raw as unknown as FormativeV10LabPairV1;
}
/** Never derive an expected trusted head from the ciphertext or journal. */
export function createFormativeV10LabTransaction(
 owner:FormativeV10LabTransactionOwner,store:FormativeV10LabPairStore,
 trusted:FormativeV10LabTrustedHeadStore,key:CryptoKey
){
 if(owner?.syntheticOnly!==true||store?.syntheticOnly!==true||
    trusted?.syntheticOnly!==true||Object.is(store,trusted)||!isHex(owner.sessionBinding))
    return fail('PRODUCTION_OR_UNTRUSTED_STORE');
 let quarantined=false;
 let pending:Pending|null=null;
 let revision=0;
 function quarantine(){
  quarantined=true;
  pending=null;
  owner.invalidate();
 }
 function active(){
  if(quarantined||!owner.isActive())return fail('SESSION_REVOKED');
 }
 async function preflight():Promise<Inspected>{
  active();
  const anchor=validateRead(await trusted.read());
  if(anchor.kind==='unverifiable')return fail('ANCHOR_UNVERIFIABLE');
  const raw=await store.read();
  if(anchor.kind==='confirmed-absent'){
   if(raw!==null)return fail('UNANCHORED_PAIR');
   return {anchor,pair:null};
  }
  if(anchor.head.sessionBinding!==owner.sessionBinding)return fail('SESSION_MISMATCH');
  if(raw===null)return fail('MISSING_PAIR');
  const pair=verifyPairShape(raw);
  const metadata=await openFormativeV10StagedMetadata(
   pair.encrypted,pair.journal,asMetaAnchor(anchor.head),key
  );
  if(metadata.recordCount!==anchor.head.epoch)return fail('EPOCH_MISMATCH');
  return {anchor,pair};
 }
 /** Read-only preflight; a detected torn state fails closed and stays locked.
  * An untouched 'confirmed-absent' status must come from an independent
  * witness; a missing local file or DB row cannot establish it.
  */
 async function inspect():Promise<FormativeV10LabInspection>{
  if(quarantined||!owner.isActive())return {state:'quarantined'};
  try{
   return await owner.coordinator.enqueueTask(async()=>{
    const x=await preflight();
    if(x.anchor.kind==='confirmed-absent')
     return {state:'pristine-synthetic-lab'} as const;
    if(x.anchor.kind!=='established')return fail('ANCHOR_UNVERIFIABLE');
    return {state:'consistent-synthetic-lab',epoch:x.anchor.head.epoch,
     headDigest:x.anchor.head.headDigest} as const;
   });
  }catch{
   quarantine();
   return {state:'quarantined'};
  }
 }
 /** Preparation issues a single-use closure identity only after verifying
  * the independent anchor and exact currently committed synthetic digest.
  * It does NOT write storage or claim a backup is complete.
  */
 async function prepare(labRecord:FormativeV10LabRecord,expectedSnapshot:string,
  recordedAt:string,sealedAt:string):Promise<FormativeV10LabTicket>{
  if(!isHex(expectedSnapshot))return fail('SNAPSHOT_DIGEST');
  active();
  return owner.coordinator.enqueueTask(async()=>{
   try{
    const x=await preflight();
    const actual=await owner.readCommittedSnapshotDigest();
    if(actual!==expectedSnapshot)return fail('SOURCE_CHANGED');
    const previous=x.anchor.kind==='established'?x.anchor.head.headDigest:null;
    // Strictly validate the lab proof and the journal before issuing a ticket.
    await proposeFormativeV10ReceiptJournalAppend(
     x.pair?.journal??null,previous,labRecord,actual,recordedAt
    );
    const ticket:FormativeV10LabTicket=Object.freeze({kind:'formative-v10-lab-once'});
    revision++;
    pending={ticket,lab:copy(labRecord),snapshotDigest:actual,
     expected:x.anchor,recordedAt,sealedAt,revision};
    return ticket;
   }catch{
    // A failed preflight may mean the pair or trusted head has been torn.
    // Conservatively retire this laboratory session; no silent re-admission.
    quarantine();
    throw fail('PREPARE_REJECTED_QUARANTINED');
   }
  });
 }
 /** The ticket is consumed BEFORE any asynchronous work; failure cannot
  * replay the same authorization. Both writes are in the same coordinator
  * queue as synthetic snapshot access, but not a cross-store atomic commit.
  */
 async function commit(ticket:FormativeV10LabTicket):Promise<FormativeV10LabCommitResult>{
  active();
  const admitted=pending;
  if(!admitted||admitted.ticket!==ticket)return fail('STALE_OR_FORGED_TICKET');
  pending=null;
  return owner.coordinator.enqueueTask(async()=>{
   let touched=false;
   try{
    active();
    if(admitted.revision!==revision)return fail('SUPERSEDED');
    const x=await preflight();
    if(!sameDb2Physical(x.anchor,admitted.expected))return fail('ANCHOR_CHANGED');
    if(await owner.readCommittedSnapshotDigest()!==admitted.snapshotDigest)
     return fail('SOURCE_CHANGED');
    const last=x.anchor.kind==='established'?x.anchor.head:null;
    const proposal=await proposeFormativeV10ReceiptJournalAppend(
     x.pair?.journal??null,last?.headDigest??null,
     admitted.lab,admitted.snapshotDigest,admitted.recordedAt
    );
    const next:FormativeV10LabTrustedHeadV1={
     epoch:proposal.journal.records.length,
     headDigest:proposal.record.contentDigest,
     sessionBinding:owner.sessionBinding,
     snapshotDigest:admitted.snapshotDigest
    };
    if(last&&next.epoch!==last.epoch+1)return fail('NONMONOTONIC_EPOCH');
    const encrypted=await sealFormativeV10StagedMetadata(
     proposal.journal,asMetaAnchor(next),admitted.sealedAt,key
    );
    const pair:FormativeV10LabPairV1={journal:proposal.journal,encrypted};
    // Any attempted write can succeed despite an error or timeout.
    touched=true;
    if(!await store.compareAndReplace(x.pair,pair))return fail('PAIR_CAS_REJECTED');
    const seen=await store.read();
    if(seen===null)return fail('PAIR_READBACK_MISSING');
    const actualPair=verifyPairShape(seen);
    await openFormativeV10StagedMetadata(
     actualPair.encrypted,actualPair.journal,asMetaAnchor(next),key
    );
    if(!sameDb2Physical(actualPair,pair))return fail('PAIR_READBACK_MISMATCH');
    if(!owner.isActive()||await owner.readCommittedSnapshotDigest()!==admitted.snapshotDigest)
     return fail('SOURCE_CHANGED_AFTER_PAIR');
    if(!await trusted.compareAndAdvance(x.anchor,next))
     return fail('ANCHOR_CAS_REJECTED');
    const headRead=validateRead(await trusted.read());
    if(headRead.kind!=='established'||!sameDb2Physical(headRead.head,next))
     return fail('ANCHOR_READBACK_MISMATCH');
    if(!owner.isActive()||await owner.readCommittedSnapshotDigest()!==admitted.snapshotDigest)
     return fail('SOURCE_CHANGED_AFTER_ANCHOR');
    return {state:'lab-anchored-not-official',epoch:next.epoch,headDigest:next.headDigest};
   }catch{
    // No hidden retry or rollback: even a failed preflight may reveal
    // torn storage. Never re-admit the same session on a later attempt.
    quarantine();
    throw fail(touched?'UNCERTAIN_QUARANTINED':'COMMIT_REJECTED_QUARANTINED');
   }
  });
 }
 return {prepare,commit,inspect,isQuarantined:()=>quarantined};
}
