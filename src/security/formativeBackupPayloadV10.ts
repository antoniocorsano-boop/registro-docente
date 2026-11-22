/** VAL-01/PRODUCT-05/S7d.2b — isolated V10 backup codec and logical
 * restore preflight for teacher-authored formative history.
 * No production export/import selection, DB2/SAF write or restore authority.
 * V9 remains the independent authority for institutional V2, assessment V7,
 * all ten encrypted datasets and the professional-only classification.
 */
import type {AppData,ClassData} from '../types';
import type {CompleteSecureAppSnapshot} from './secureAppStorage';
import type {AssessmentScopeV1} from '../assessment/assessmentEvidence';
import type {FormativeBalanceHistoryV1} from '../assessment/formativeBalanceHistory';
import {validateFormativeBalanceHistoryV1,preservesFormativeBalanceHistory} from '../assessment/formativeBalanceHistory';
import {detachDocumentBackupJson} from './documentBackupPayloadV8';
import {createInstitutionalBackupPayloadV9,inspectInstitutionalBackupPayloadV9,
 projectInstitutionalRestoreV9} from './institutionalBackupPayloadV9';
import {sameDb2Physical} from './db2PhysicalLifecycle';
import {encryptDataWithPassword,decryptDataWithPassword} from '../cryptoUtils';

export const FORMATIVE_BACKUP_DATA_VERSION_V10=10;
export type FormativeClassV10=ClassData&{formativeBalanceHistoryV1?:FormativeBalanceHistoryV1};
export type FormativeSnapshotV10=Omit<CompleteSecureAppSnapshot,'appData'>&{
 appData:AppData&{classes:FormativeClassV10[]}
};
export interface FormativeBackupPayloadV10{
 readonly app:'registro-docente';
 readonly backupDataVersion:10;
 readonly exportedAt:string;
 readonly snapshot:FormativeSnapshotV10;
}
export interface FormativeBackupInspectionV10{
 readonly sourceVersion:10;
 readonly snapshot:FormativeSnapshotV10;
 /** Must never be interpreted as permission for DB2/Android replacement. */
 readonly replacementRequiresReview:true;
}
type Row=Record<string,unknown>;
type ScopeMap=Map<string,AssessmentScopeV1>;
const own=(x:object,k:string)=>Object.prototype.hasOwnProperty.call(x,k);
const row=(x:unknown):x is Row=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const invalid=():never=>{throw Error('FORMATIVE_V10_REJECTED');};
const ROOT=['app','backupDataVersion','exportedAt','snapshot'] as const;
const SCOPE=['classId','schoolYear','subjectCode','studentIds'] as const;
const HISTORY_KEY='formativeBalanceHistoryV1';
function exact(v:unknown,keys:readonly string[]):v is Row{
 return row(v)&&Object.keys(v).length===keys.length&&keys.every(k=>own(v,k));
}
function detached(v:unknown):any{
 try{return detachDocumentBackupJson(v);}catch{return invalid();}
}
function approveScopes(raw:unknown,classes:readonly FormativeClassV10[]):ScopeMap{
 const v=detached(raw);
 if(!Array.isArray(v)||v.length>10000)return invalid();
 const byClass=new Map<string,FormativeClassV10>();
 for(const cls of classes){
  if(!cls||typeof cls.id!=='string'||byClass.has(cls.id)||!Array.isArray(cls.students)||
     new Set(cls.students.map(x=>x.id)).size!==cls.students.length)return invalid();
  byClass.set(cls.id,cls);
 }
 const approvals=new Map<string,AssessmentScopeV1>();
 for(const scope of v){
  if(!exact(scope,SCOPE)||typeof scope.classId!=='string'||typeof scope.schoolYear!=='string'||
     typeof scope.subjectCode!=='string'||!Array.isArray(scope.studentIds)||
     !scope.studentIds.every((id:unknown)=>typeof id==='string')||
     new Set(scope.studentIds).size!==scope.studentIds.length)return invalid();
  const cls=byClass.get(scope.classId);
  if(!cls||approvals.has(scope.classId)||scope.studentIds.length!==cls.students.length||
     !sameDb2Physical(scope.studentIds,cls.students.map(x=>x.id)))return invalid();
  approvals.set(scope.classId,scope as unknown as AssessmentScopeV1);
 }
 return approvals;
}
/** Only an explicitly approved direct class-level field can cross the V10
 * boundary. All other placements remain visible to the V9 downgrade fence.
 * The source is detached by descriptor-only deep traversal before deletion.
 */
async function split(raw:unknown,approved:unknown):Promise<{
 legacy:CompleteSecureAppSnapshot;
 histories:Map<string,FormativeBalanceHistoryV1>;
 scopes:ScopeMap;
}>{
 const snap=detached(raw);
 if(!row(snap)||!row(snap.appData)||!Array.isArray(snap.appData.classes))return invalid();
 const classes=snap.appData.classes as FormativeClassV10[];
 const scopes=approveScopes(approved,classes),histories=new Map<string,FormativeBalanceHistoryV1>();
 for(const cls of classes){
  if(!row(cls))return invalid();
  if(!own(cls,HISTORY_KEY))continue;
  const scope=scopes.get(cls.id);
  if(!scope)return invalid();
  const checked=await validateFormativeBalanceHistoryV1(cls.formativeBalanceHistoryV1,scope);
  if(!checked.valid)return invalid();
  histories.set(cls.id,checked.history);
  delete cls.formativeBalanceHistoryV1;
 }
 return {legacy:snap as CompleteSecureAppSnapshot,histories,scopes};
}
function attach(snapshot:CompleteSecureAppSnapshot,history:Map<string,FormativeBalanceHistoryV1>):FormativeSnapshotV10{
 const detachedSnapshot=detached(snapshot) as FormativeSnapshotV10;
 const found=new Set<string>();
 detachedSnapshot.appData.classes=detachedSnapshot.appData.classes.map(cls=>{
  const h=history.get(cls.id);
  if(!h)return cls;
  found.add(cls.id);
  return {...cls,formativeBalanceHistoryV1:detached(h)};
 });
 if(found.size!==history.size)return invalid();
 return detachedSnapshot;
}
function v9Form(raw:Row,snapshot:CompleteSecureAppSnapshot){
 return {app:'registro-docente',backupDataVersion:9,exportedAt:raw.exportedAt,snapshot};
}
/** Explicit V10 only. Never auto-upgrade V6-V9 or infer an owner/scope from a
 * decrypted file. V9 must validate its own complete snapshot first.
 */
export async function createFormativeBackupPayloadV10(
 snapshot:unknown,assessmentScopes:unknown,documentScope:unknown,
 formativeScopes:unknown,exportedAt:string
):Promise<FormativeBackupPayloadV10>{
 try{
  const splitSource=await split(snapshot,formativeScopes);
  const previous=await createInstitutionalBackupPayloadV9(
    splitSource.legacy,assessmentScopes,documentScope,exportedAt);
  return {app:'registro-docente',backupDataVersion:10,exportedAt,
   snapshot:attach(previous.snapshot,splitSource.histories)};
 }catch{return invalid();}
}
/** Inspection is read-only. The V9 delegate still independently validates
 * current and candidate assessment history and institutional documents.
 */
export async function inspectFormativeBackupPayloadV10(
 payload:unknown,current:CompleteSecureAppSnapshot,
 assessmentScopes:unknown,documentScope:unknown,
 currentFormativeScopes:unknown,incomingFormativeScopes:unknown
):Promise<FormativeBackupInspectionV10>{
 try{
  const p=detached(payload);
  if(!exact(p,ROOT)||p.app!=='registro-docente'||p.backupDataVersion!==10)return invalid();
  const old=await split(current,currentFormativeScopes);
  const proposed=await split(p.snapshot,incomingFormativeScopes);
  const inspected=await inspectInstitutionalBackupPayloadV9(
   v9Form(p,proposed.legacy),old.legacy,assessmentScopes,documentScope);
  if(inspected.sourceVersion!==9)return invalid();
  return {sourceVersion:10,
   snapshot:attach(inspected.snapshot,proposed.histories),
   replacementRequiresReview:true};
 }catch{return invalid();}
}
/** Conservative logical restore. An independently inspected exact recovery
 * copy of the current V10 snapshot is required before any replacement.
 * Every old history remains an exact prefix of the newly validated history.
 * This NEVER writes or grants a physical DB2/Android restore.
 */
export async function projectFormativeRestoreV10(
 current:CompleteSecureAppSnapshot,incoming:unknown,recovery:unknown,
 currentAssessmentScopes:unknown,incomingAssessmentScopes:unknown,
 documentScope:unknown,currentFormativeScopes:unknown,incomingFormativeScopes:unknown
):Promise<FormativeSnapshotV10>{
 try{
  const backup=detached(recovery),incomingPayload=detached(incoming);
  if(!exact(backup,ROOT)||backup.backupDataVersion!==10||
     !exact(incomingPayload,ROOT)||incomingPayload.backupDataVersion!==10)return invalid();
  const [old,candidate,checkpoint]=await Promise.all([
   split(current,currentFormativeScopes),
   split(incomingPayload.snapshot,incomingFormativeScopes),
   split(backup.snapshot,currentFormativeScopes)
  ]);
  // V9 verifies all non-formative datasets against an exact recovery copy.
  const projected=await projectInstitutionalRestoreV9(
   old.legacy,v9Form(incomingPayload,candidate.legacy),
   v9Form(backup,checkpoint.legacy),
   currentAssessmentScopes,incomingAssessmentScopes,documentScope);
  if(!sameDb2Physical([...old.histories.entries()],[...checkpoint.histories.entries()]))
   return invalid();
  for(const oldClass of old.legacy.appData.classes){
   const nextClass=candidate.legacy.appData.classes.find(cls=>cls.id===oldClass.id);
   if(!nextClass)return invalid();
   const prior=old.histories.get(oldClass.id),next=candidate.histories.get(oldClass.id);
   const scope=old.scopes.get(oldClass.id)??candidate.scopes.get(oldClass.id);
   // V9 forbids discarding existing students, classes and grade history;
   // S7d1b independently checks the historic digest-chain prefix.
   if(!scope){
    if(prior||next)return invalid();
    continue;
   }
   if(!await preservesFormativeBalanceHistory(prior,next,scope))return invalid();
  }
  return attach(projected,candidate.histories);
 }catch{return invalid();}
}
/** Existing authenticated AES-GCM V2 envelope, no independent cryptography.
 * Physical copy/readback and actual restore authorization remain separate.
 */
export async function encryptFormativeBackupV10(
 snapshot:unknown,password:string,assessmentScopes:unknown,documentScope:unknown,
 formativeScopes:unknown,exportedAt:string
):Promise<string>{
 try{
  if(typeof password!=='string'||!password)return invalid();
  const p=await createFormativeBackupPayloadV10(
   snapshot,assessmentScopes,documentScope,formativeScopes,exportedAt);
  return await encryptDataWithPassword(p,password);
 }catch{return invalid();}
}
export async function decryptAndInspectFormativeBackupV10(
 ciphertext:string,password:string,current:CompleteSecureAppSnapshot,
 assessmentScopes:unknown,documentScope:unknown,
 currentFormativeScopes:unknown,incomingFormativeScopes:unknown
):Promise<FormativeBackupInspectionV10>{
 try{
  if(typeof ciphertext!=='string'||!ciphertext||typeof password!=='string'||!password)return invalid();
  const payload=await decryptDataWithPassword(ciphertext,password);
  return await inspectFormativeBackupPayloadV10(
   payload,current,assessmentScopes,documentScope,currentFormativeScopes,incomingFormativeScopes);
 }catch{return invalid();}
}
