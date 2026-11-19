/** DOC-01/D4c3a — isolated, fail-closed transactional laboratory adapter.
 * NO_RUNTIME: until backup/restore v8, downgrade fencing, DB2 recovery and
 * explicit promotion are qualified, this module must not be called by the app.
 */
import type {AppData} from '../types';
import type {DocumentHistoryV1} from '../documents/documentHistoryTransitions';
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

export async function commitDocumentHistoryOperation(
  owner:DocumentHistoryMutationOwner,
  approvedScopes:unknown,
  request:unknown
):Promise<DocumentHistorySaveReceipt>{
  void owner;void approvedScopes;void request;
  throw Error('DOC01_D4C3_NOT_IMPLEMENTED');
}
