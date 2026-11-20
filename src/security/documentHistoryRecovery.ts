/** DOC-01/D4c3c1 — isolated preservation check before recovery.
 * This pure helper is NOT a DB2 transaction, a backup codec, a verified
 * physical recovery copy, authorization, signature or anti-rollback.
 */
import {validateDocumentHistory,type DocumentHistoryV1} from '../documents/documentHistoryTransitions';
import {
 detachHistoricalDocumentData as detach,
 canonicalHistoricalDocumentData as canonical
} from '../documents/documentHistoricalValidation';

export type DocumentHistoryRecoveryResult=
 |{valid:true;archive:DocumentHistoryV1;changed:boolean}
 |{valid:false;issue:'INVALID_HISTORY'|'INVALID_SCOPE'|'RECOVERY_MISMATCH'|'HISTORY_LOSS'|'HISTORY_FORK'};

const failure=(issue:Extract<DocumentHistoryRecoveryResult,{valid:false}>['issue']):DocumentHistoryRecoveryResult=>({valid:false,issue});

/** A valid incoming chain can replace the current chain only if every event
 * currently stored is retained in identical order and content. The supplied
 * recovery baseline must be exactly current; physical readback and session
 * authority belong to later DB2/Android qualification.
 */
export async function inspectDocumentHistoryRecovery(
 current:unknown,incoming:unknown,recovery:unknown,approvedScopes:unknown
):Promise<DocumentHistoryRecoveryResult>{
 let old:unknown,proposed:unknown,checkpoint:unknown,scopes:unknown;
 try{
  old=detach(current);
  proposed=detach(incoming);
  checkpoint=detach(recovery);
  scopes=detach(approvedScopes);
 }catch{return failure('INVALID_HISTORY');}

 const oldCheck=await validateDocumentHistory(old,scopes);
 const nextCheck=await validateDocumentHistory(proposed,scopes);
 const recoveryCheck=await validateDocumentHistory(checkpoint,scopes);
 if(!oldCheck.valid||!nextCheck.valid||!recoveryCheck.valid){
  if([oldCheck,nextCheck,recoveryCheck].some(v=>!v.valid&&v.issue==='INVALID_SCOPE'))
   return failure('INVALID_SCOPE');
  return failure('INVALID_HISTORY');
 }
 // Exact logical checkpoint is a prerequisite, not a verified disk backup.
 if(canonical(oldCheck.archive)!==canonical(recoveryCheck.archive))
  return failure('RECOVERY_MISMATCH');
 const oldEvents=oldCheck.archive.events;
 const nextEvents=nextCheck.archive.events;
 if(nextEvents.length<oldEvents.length)return failure('HISTORY_LOSS');
 for(let i=0;i<oldEvents.length;i++)
  if(canonical(nextEvents[i])!==canonical(oldEvents[i]))return failure('HISTORY_FORK');

 return {valid:true,archive:nextCheck.archive,changed:nextEvents.length!==oldEvents.length};
}
