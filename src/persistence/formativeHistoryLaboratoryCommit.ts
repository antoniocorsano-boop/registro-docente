/** VAL-01/S7d.2a — LAB ONLY, explicitly unauthorised for production UI.
 * Uses existing authenticated owner and shared coordinator; introduces no Vault
 * store, migration, export/restore permission or persistent UI entrypoint.
 * The balance-history field cannot be saved by production SecureAppStorage
 * or exported by legacy V6-V9 backups. This is a simulation of the commit
 * protocol with an injected synthetic writer, not an authorization bypass.
 */
import type {AppData,AppSettings,ClassData} from '../types';
import type {FormativeBalanceCommitCandidateV1} from '../assessment/formativeBalanceCommitPreflight';
import type {FormativeBalanceHistoryV1} from '../assessment/formativeBalanceHistory';
import {proposeFormativeBalanceHistoryAppend,validateFormativeBalanceHistoryV1} from '../assessment/formativeBalanceHistory';
import {snapshotAssessmentData} from '../assessment/assessmentRevisionBindings';
import {sameDb2Physical} from '../security/db2PhysicalLifecycle';
import {incrementBackupChanges} from './backupCheckpoint';
import type {SecureAppStorage,SecureMeta} from '../security/secureAppStorage';
import type {DurableMutationCoordinator} from './durableMutationCoordinator';

type HistoryClass=ClassData & {formativeBalanceHistoryV1?:FormativeBalanceHistoryV1};
export interface FormativeHistoryCommittedState{
 readonly appData:AppData;
 readonly meta:SecureMeta;
}
export interface FormativeHistoryLaboratoryOwner{
 readonly coordinator:DurableMutationCoordinator;
 readonly storage:Pick<SecureAppStorage,'saveAppDataAndMeta'|'loadSnapshot'>;
 isActive():boolean;
 /** For non-production synthetic harnesses only; no runtime caller. */
 laboratoryApproved():boolean;
 getCommitted():FormativeHistoryCommittedState;
 publish(next:FormativeHistoryCommittedState):void;
 /** Retire the session; never retry a write of uncertain physical status. */
 invalidate():void;
}
export interface FormativeHistoryLaboratoryReceipt{
 readonly id:string;
 readonly revision:number;
 readonly verified:true;
 readonly status:'lab-committed-no-runtime';
}
const fail=(reason:string):never=>{throw Error(reason);};
function active(owner:FormativeHistoryLaboratoryOwner):void{
 if(!owner.isActive()||!owner.laboratoryApproved())fail('SESSION_OR_LAB_AUTHORITY_REVOKED');
}
function quarantine(owner:FormativeHistoryLaboratoryOwner,reason:string):never{
 owner.invalidate();return fail(reason);
}
function historyForClass(cls:ClassData):FormativeBalanceHistoryV1|undefined{
 const c=cls as HistoryClass;
 return Object.prototype.hasOwnProperty.call(c,'formativeBalanceHistoryV1')
   ?c.formativeBalanceHistoryV1:undefined;
}
async function exactHistoryClasses(app:AppData):Promise<boolean>{
 if(!Array.isArray(app.classes)||new Set(app.classes.map(c=>c.id)).size!==app.classes.length)return false;
 for(const cls of app.classes){
  const h=historyForClass(cls);
  if(h!==undefined){
   if(h.classId!==cls.id||!Array.isArray(cls.students)||
      (await validateFormativeBalanceHistoryV1(h,{
       classId:cls.id,schoolYear:h.schoolYear,subjectCode:h.subjectCode,
       studentIds:cls.students.map(x=>x.id)
      })).valid===false)return false;
  }
 }
 return true;
}

/** Writes only inside the existing owner-wide serialization queue.
 * This laboratory intentionally cannot be invoked by a production screen.
 * The final readback verifies BOTH exact appData and exact backup metadata.
 * On the PR #398 base, SecureAppStorage deliberately rejects this field;
 * only an injected synthetic laboratory store can write it until a qualified
 * V10 backup/restore and authorized storage upgrade are available.
 */
export async function commitFormativeHistoryLaboratory(
 owner:FormativeHistoryLaboratoryOwner,
 settings:Pick<AppSettings,'year'|'subject'>,
 candidate:FormativeBalanceCommitCandidateV1,
 request:{id:string;recordedAt:string;expectedHeadDigest:string|null}
):Promise<FormativeHistoryLaboratoryReceipt>{
 active(owner);
 let admitted:FormativeBalanceCommitCandidateV1,op:typeof request,config:typeof settings;
 try{
  admitted=snapshotAssessmentData(candidate) as FormativeBalanceCommitCandidateV1;
  op=snapshotAssessmentData(request) as typeof request;
  config=snapshotAssessmentData(settings) as typeof settings;
 }catch{return fail('INVALID_REQUEST');}
 const receipt=await owner.coordinator.enqueueTask(async()=>{
  active(owner);
  let old:FormativeHistoryCommittedState;
  try{
   old=snapshotAssessmentData(owner.getCommitted()) as FormativeHistoryCommittedState;
   if(!old||!old.appData||!old.meta||!Number.isSafeInteger(old.meta.changes)||
      old.meta.changes<0||old.meta.changes>=Number.MAX_SAFE_INTEGER||
      !(await exactHistoryClasses(old.appData)))fail('INVALID_COMMITTED_ARCHIVE');
  }catch{return fail('INVALID_COMMITTED_ARCHIVE');}
  const cls=old.appData.classes.find(x=>x.id===admitted.context.classId);
  if(!cls)throw Error('INVALID_STUDENT_CONTEXT');
  const history=historyForClass(cls);
  if((history?.records.at(-1)?.contentDigest??null)!==op.expectedHeadDigest)
   throw Error('STALE_HEAD');
  // S7d.1b rechecks exact scope, source and the history digest chain itself.
  const evaluated=await proposeFormativeBalanceHistoryAppend(history,admitted,cls,config,
   {id:op.id,recordedAt:op.recordedAt});
  if(!evaluated.valid)return fail(evaluated.issue);
  active(owner);
  const newClass:HistoryClass={...cls,formativeBalanceHistoryV1:evaluated.history};
  const next:FormativeHistoryCommittedState={
   appData:{...old.appData,classes:old.appData.classes.map(x=>x.id===cls.id?newClass:x)},
   meta:incrementBackupChanges(old.meta)
  };
  if(!(await exactHistoryClasses(next.appData)))fail('INVALID_PROPOSED_ARCHIVE');
  // Write + metadata must succeed atomically through the owner's existing Vault.
  try{await owner.storage.saveAppDataAndMeta(next.appData,next.meta);}
  catch{return quarantine(owner,'PERSISTENCE_UNCERTAIN');}
  if(!owner.isActive()||!owner.laboratoryApproved())return quarantine(owner,'SESSION_REVOKED_AFTER_WRITE');
  let readback:Awaited<ReturnType<FormativeHistoryLaboratoryOwner['storage']['loadSnapshot']>>;
  try{readback=await owner.storage.loadSnapshot();}
  catch{return quarantine(owner,'READBACK_UNAVAILABLE');}
  if(!owner.isActive()||!owner.laboratoryApproved())return quarantine(owner,'SESSION_REVOKED_AFTER_READBACK');
  if(!sameDb2Physical(readback.appData,next.appData)||!sameDb2Physical(readback.meta,next.meta)||
     !readback.appData||!(await exactHistoryClasses(readback.appData)))
   return quarantine(owner,'READBACK_MISMATCH');
  const saved=(readback.appData.classes.find(x=>x.id===cls.id) as HistoryClass|undefined)?.formativeBalanceHistoryV1;
  const last=saved?.records.at(-1);
  if(!last||last.id!==op.id||last.revision!==evaluated.record.revision||last.contentDigest!==evaluated.record.contentDigest)
    return quarantine(owner,'READBACK_MISMATCH');
  try{owner.publish(next);}
  catch{return quarantine(owner,'PUBLISH_UNCERTAIN');}
  return {id:last.id,revision:last.revision,verified:true as const,
   status:'lab-committed-no-runtime' as const};
 });
 active(owner);
 return receipt;
}
