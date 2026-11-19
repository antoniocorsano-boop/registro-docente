/** DOC-01/D4c3a — isolated, fail-closed transactional laboratory adapter.
 * NO_RUNTIME: until backup/restore versioning, downgrade fencing, DB2 recovery
 * and explicit promotion are qualified, do not wire this into the application.
 * This function does NOT grant authentication, backup, signature or anti-rollback.
 */
import type {AppData} from '../types';
import {
  applyDocumentHistoryOperation,validateDocumentHistory,
  type DocumentHistoryV1
} from '../documents/documentHistoryTransitions';
import {detachHistoricalDocumentData} from '../documents/documentHistoricalValidation';
import {incrementBackupChanges} from './backupCheckpoint';
import {sameDb2Physical} from '../security/db2PhysicalLifecycle';
import type {SecureMeta,SecureAppStorage} from '../security/secureAppStorage';
import type {DurableMutationCoordinator} from './durableMutationCoordinator';

export type DocumentHistoryAppData=AppData & {documentHistoryV1?:DocumentHistoryV1};
export interface DocumentHistoryCommittedState {
  readonly appData:DocumentHistoryAppData;
  readonly meta:SecureMeta;
}
export interface DocumentHistoryMutationOwner {
  readonly coordinator:DurableMutationCoordinator;
  readonly storage:Pick<SecureAppStorage,'saveAppDataAndMeta'|'loadSnapshot'>;
  isActive():boolean;
  getCommitted():DocumentHistoryCommittedState;
  publish(next:DocumentHistoryCommittedState):void;
  /** Quarantine the session on uncertain persistence/readback. */
  invalidate():void;
}
export interface DocumentHistorySaveReceipt {
  readonly eventId:string;
  readonly headDigest:string|null;
  readonly changed:boolean;
  readonly verified:true;
}

type Row=Record<string,unknown>;
const own=(v:object,k:string)=>Object.prototype.hasOwnProperty.call(v,k);
const row=(v:unknown):v is Row=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const blank=():DocumentHistoryV1=>({schemaVersion:1,labOnly:true,events:[]});
const invalid=(reason:string)=>new Error(reason);
const session=(owner:DocumentHistoryMutationOwner)=>{
  if(!owner.isActive())throw invalid('SESSION_REVOKED');
};
function quarantine(owner:DocumentHistoryMutationOwner,reason:string):never{
  // Invalidate only: never attempt to reconstruct or replay a possibly
  // committed operation from stale in-memory state.
  owner.invalidate();
  throw invalid(reason);
}

/** Bind inputs before the first await, then revalidate against the actual
 * latest committed state INSIDE the shared coordinator. The injected owner
 * alone decides whether this laboratory is backed by an authenticated Vault.
 * No default live storage or production activation is created here.
 */
export async function commitDocumentHistoryOperation(
  owner:DocumentHistoryMutationOwner,
  approvedScopes:unknown,
  request:unknown
):Promise<DocumentHistorySaveReceipt>{
  session(owner);
  let scopes:unknown,submitted:unknown;
  try{
    scopes=detachHistoricalDocumentData(approvedScopes);
    submitted=detachHistoricalDocumentData(request);
  }catch{throw invalid('INVALID_REQUEST');}
  if(!row(submitted)||typeof submitted.eventId!=='string')throw invalid('INVALID_REQUEST');
  const eventId=submitted.eventId;

  const receipt=await owner.coordinator.enqueueTask(async()=>{
    session(owner);
    const previous=owner.getCommitted();
    if(!previous||!row(previous.appData)||!Array.isArray(previous.appData.classes)||
       !row(previous.meta)||!Number.isSafeInteger(previous.meta.changes)||
       previous.meta.changes<0||previous.meta.changes>=Number.MAX_SAFE_INTEGER)
      throw invalid('INVALID_SNAPSHOT');

    let appData:DocumentHistoryAppData,meta:SecureMeta;
    try{
      appData=detachHistoricalDocumentData(previous.appData) as DocumentHistoryAppData;
      meta=detachHistoricalDocumentData(previous.meta) as SecureMeta;
    }catch{throw invalid('INVALID_SNAPSHOT');}
    const stored=own(appData,'documentHistoryV1')?appData.documentHistoryV1:blank();
    const inspected=await validateDocumentHistory(stored,scopes);
    if(!inspected.valid)throw invalid(inspected.issue==='INVALID_SCOPE'?'INVALID_SCOPE':'INVALID_HISTORY');
    const result=await applyDocumentHistoryOperation(inspected.archive,scopes,submitted);
    if(!result.valid)throw invalid(result.issue);
    session(owner);
    const next:DocumentHistoryCommittedState=result.changed
      ?{appData:{...appData,documentHistoryV1:result.archive},meta:incrementBackupChanges(meta)}
      :{appData,meta};

    if(result.changed){
      try{await owner.storage.saveAppDataAndMeta(next.appData,next.meta);}
      catch{return quarantine(owner,'PERSISTENCE_UNCERTAIN');}
      if(!owner.isActive())return quarantine(owner,'SESSION_REVOKED');
    }

    // Verify the exact persisted appData and meta, not only the digest chain.
    // This readback also covers an idempotent retry without a second write.
    let readback:Awaited<ReturnType<DocumentHistoryMutationOwner['storage']['loadSnapshot']>>;
    try{readback=await owner.storage.loadSnapshot();}
    catch{return quarantine(owner,'READBACK_MISMATCH');}
    if(!owner.isActive())return quarantine(owner,'SESSION_REVOKED');
    if(!sameDb2Physical(readback.appData,next.appData)||!sameDb2Physical(readback.meta,next.meta))
      return quarantine(owner,'READBACK_MISMATCH');
    const checked=await validateDocumentHistory(
      (readback.appData as DocumentHistoryAppData).documentHistoryV1??blank(),scopes);
    if(!checked.valid||!sameDb2Physical(checked.archive,result.archive))
      return quarantine(owner,'READBACK_MISMATCH');
    if(!owner.isActive())return quarantine(owner,'SESSION_REVOKED');
    if(result.changed){
      try{owner.publish(next);}
      catch{return quarantine(owner,'PUBLISH_UNCERTAIN');}
    }
    return {eventId,headDigest:result.archive.events.at(-1)?.eventDigest??null,
      changed:result.changed,verified:true as const};
  });
  session(owner);
  return receipt;
}
