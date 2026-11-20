/** DOC-01/D4c3e4 — isolated institutional V9 backup and logical restore.
 * Payload version 9, historical schema 2 and encrypted-envelope version 2
 * are distinct. This module never writes DB2, opens SAF or approves a restore.
 */
import type {CompleteSecureAppSnapshot} from './secureAppStorage';
import type {AppData} from '../types';
import type {InstitutionalDocumentHistoryV2} from '../documents/institutionalDocumentHistoryV2';
import {validateInstitutionalDocumentHistoryV2} from '../documents/institutionalDocumentHistoryV2';
import {detachDocumentBackupJson} from './documentBackupPayloadV8';
import {assertNoUnsupportedDocumentHistory} from './documentHistoryBackupFence';
import {createAssessmentBackupPayloadV7,inspectAssessmentBackupPayload} from './assessmentBackupPayload';
import {projectAssessmentRestoreV7} from './assessmentRestorePolicy';
import {withoutLocalBackupVerification} from '../persistence/backupCheckpoint';
import {sameDb2Physical} from './db2PhysicalLifecycle';
import {encryptDataWithPassword,decryptDataWithPassword} from '../cryptoUtils';
import type {ApprovedAssessmentScope} from '../assessment/assessmentArchive';

export const INSTITUTIONAL_BACKUP_DATA_VERSION_V9=9;
export type InstitutionalSnapshotV9=Omit<CompleteSecureAppSnapshot,'appData'>&{appData:AppData&{documentHistoryV2:InstitutionalDocumentHistoryV2}};
export interface InstitutionalBackupPayloadV9 {
 readonly app:'registro-docente';
 readonly backupDataVersion:9;
 readonly exportedAt:string;
 readonly snapshot:InstitutionalSnapshotV9;
}
export interface InstitutionalBackupInspectionV9 {
 readonly sourceVersion:9;
 readonly snapshot:InstitutionalSnapshotV9;
 readonly replacementRequiresReview:true;
}
type Row=Record<string,unknown>;
const own=(o:object,k:string)=>Object.prototype.hasOwnProperty.call(o,k);
const row=(v:unknown):v is Row=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const invalid=():never=>{throw Error('DOC01_V9_REJECTED');};
const ROOT=['app','backupDataVersion','exportedAt','snapshot'] as const;
function strict(v:unknown,keys:readonly string[]):v is Row{
 return row(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v))&&
  Reflect.ownKeys(v).length===keys.length&&keys.every(k=>{
   const d=Object.getOwnPropertyDescriptor(v,k);return !!d&&d.enumerable&&own(d,'value');
  });
}
/** Remove only the exact institutional V2 root. The old V6/V7 and V8
 * downgrade fence must still inspect every other field and reject V1 aliases.
 * No "empty" history is synthesized for the caller.
 */
function peelV2(raw:unknown):{legacy:CompleteSecureAppSnapshot;history:unknown}{
 const copy=detachDocumentBackupJson(raw);
 if(!row(copy)||!row(copy.appData)||!own(copy.appData,'documentHistoryV2'))return invalid();
 const history=copy.appData.documentHistoryV2;
 delete copy.appData.documentHistoryV2;
 assertNoUnsupportedDocumentHistory(copy);
 return {legacy:copy as unknown as CompleteSecureAppSnapshot,history};
}
async function historyV2(raw:unknown,approvedScope:unknown):Promise<InstitutionalDocumentHistoryV2>{
 const checked=await validateInstitutionalDocumentHistoryV2(raw,approvedScope);
 if(!checked.valid)return invalid();
 return checked.archive;
}
const v7form=(payload:Row,legacy:CompleteSecureAppSnapshot)=>({
 app:'registro-docente',backupDataVersion:7,exportedAt:payload.exportedAt,
 snapshot:legacy
});
/** Only professional V9 snapshots with independently approved institutional
 * V2 scope can be exported. The V7 serializer validates the other ten
 * records and preserves assessment history under its existing strict codec.
 */
export async function createInstitutionalBackupPayloadV9(
 snapshot:unknown,assessmentScopes:unknown,scope:unknown,exportedAt:string
):Promise<InstitutionalBackupPayloadV9>{
 try{
  const peeled=peelV2(snapshot);
  const hist=await historyV2(peeled.history,detachDocumentBackupJson(scope));
  const v7=await createAssessmentBackupPayloadV7(
   peeled.legacy,detachDocumentBackupJson(assessmentScopes),exportedAt
  );
  return {app:'registro-docente',backupDataVersion:9,exportedAt,
   snapshot:{...v7.snapshot,appData:{...v7.snapshot.appData,documentHistoryV2:hist}}};
 }catch{return invalid();}
}
/** Read-only inspection: an encrypted file never creates restore authority.
 * Current and candidate scope approvals come from outside the file.
 */
export async function inspectInstitutionalBackupPayloadV9(
 payload:unknown,current:CompleteSecureAppSnapshot,assessmentScopes:unknown,scope:unknown
):Promise<InstitutionalBackupInspectionV9>{
 try{
  const p=detachDocumentBackupJson(payload);
  if(!strict(p,ROOT)||p.app!=='registro-docente'||p.backupDataVersion!==9)return invalid();
  const prior=peelV2(current);
  const incoming=peelV2(p.snapshot);
  await historyV2(prior.history,detachDocumentBackupJson(scope));
  const hist=await historyV2(incoming.history,detachDocumentBackupJson(scope));
  const inspected=await inspectAssessmentBackupPayload(
   v7form(p,incoming.legacy),prior.legacy,detachDocumentBackupJson(assessmentScopes)
  );
  if(inspected.sourceVersion!==7)return invalid();
  return {sourceVersion:9,
   snapshot:{...inspected.snapshot,appData:{...inspected.snapshot.appData,documentHistoryV2:hist}},
   replacementRequiresReview:true};
 }catch{return invalid();}
}
/** Pure pre-restore projection. Require an exact recovery copy of the
 * current V9 archive (allowing only device-local backup receipt adjustments).
 * All old V2 events and V7 assessment revisions must survive unchanged.
 * A valid result is NOT a DB2 compare-and-swap grant.
 */
export async function projectInstitutionalRestoreV9(
 current:CompleteSecureAppSnapshot,incoming:unknown,recovery:unknown,
 currentAssessmentScopes:unknown,incomingAssessmentScopes:unknown,scope:unknown
):Promise<CompleteSecureAppSnapshot>{
 try{
  const prior=detachDocumentBackupJson(current) as CompleteSecureAppSnapshot;
  const candidate=detachDocumentBackupJson(incoming);
  const checkpoint=detachDocumentBackupJson(recovery);
  const oldScopes=detachDocumentBackupJson(currentAssessmentScopes) as ApprovedAssessmentScope[];
  const nextScopes=detachDocumentBackupJson(incomingAssessmentScopes) as ApprovedAssessmentScope[];
  const docsScope=detachDocumentBackupJson(scope);
  if(!row(checkpoint)||typeof checkpoint.exportedAt!=='string')return invalid();
  const exactPrevious=await createInstitutionalBackupPayloadV9(
   prior,oldScopes,docsScope,checkpoint.exportedAt
  );
  const restoredCheck=await inspectInstitutionalBackupPayloadV9(checkpoint,prior,oldScopes,docsScope);
  const next=await inspectInstitutionalBackupPayloadV9(candidate,prior,nextScopes,docsScope);
  const normalCurrent={...prior,meta:withoutLocalBackupVerification(prior.meta)};
  if(!sameDb2Physical(exactPrevious.snapshot,normalCurrent))return invalid();
  const checkpointAdjusted={...exactPrevious.snapshot,meta:{
   changes:0,lastBackup:checkpoint.exportedAt
  }};
  if(!sameDb2Physical(restoredCheck.snapshot,exactPrevious.snapshot)&&
     !sameDb2Physical(restoredCheck.snapshot,checkpointAdjusted))return invalid();
  const oldHistory=await historyV2(peelV2(prior).history,docsScope);
  const recoveryHistory=restoredCheck.snapshot.appData.documentHistoryV2;
  const newHistory=next.snapshot.appData.documentHistoryV2;
  if(!sameDb2Physical(oldHistory,recoveryHistory)||
     newHistory.events.length<oldHistory.events.length||
     !oldHistory.events.every((event,index)=>sameDb2Physical(event,newHistory.events[index])))return invalid();
  // The original V7 projected restore remains the authority for grades,
  // assessed evidence, settings, planning, and all other ten datasets.
  const clean=peelV2(prior).legacy;
  const newV7=peelV2(next.snapshot).legacy;
  const oldV7=peelV2(restoredCheck.snapshot).legacy;
  const projected=await projectAssessmentRestoreV7(
   clean,v7form(candidate as Row,newV7),v7form(checkpoint,oldV7),oldScopes,nextScopes
  );
  return {...projected,appData:{...projected.appData,documentHistoryV2:newHistory} as AppData};
 }catch{return invalid();}
}
/** Same authenticated AES-GCM v2 envelope as earlier formats. No custom
 * crypto, no changes to legacy encryption, no app/DB2 write.
 */
export async function encryptInstitutionalBackupV9(
 snapshot:unknown,password:string,assessmentScopes:unknown,scope:unknown,exportedAt:string
):Promise<string>{
 try{
  if(typeof password!=='string'||!password)return invalid();
  const payload=await createInstitutionalBackupPayloadV9(snapshot,assessmentScopes,scope,exportedAt);
  return await encryptDataWithPassword(payload,password);
 }catch{return invalid();}
}
export async function decryptAndInspectInstitutionalBackupV9(
 ciphertext:string,password:string,current:CompleteSecureAppSnapshot,
 assessmentScopes:unknown,scope:unknown
):Promise<InstitutionalBackupInspectionV9>{
 try{
  if(typeof ciphertext!=='string'||!ciphertext||typeof password!=='string'||!password)return invalid();
  const payload=await decryptDataWithPassword(ciphertext,password);
  return await inspectInstitutionalBackupPayloadV9(payload,current,assessmentScopes,scope);
 }catch{return invalid();}
}
