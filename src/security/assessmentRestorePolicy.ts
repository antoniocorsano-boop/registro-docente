/** VAL-01/S6d.2c.3 — conservative V7 restore policy, no storage or authority.
 * A full replacement needs an exact recovery copy of the current archive.
 * This increment refuses any removal or rewriting of assessment history,
 * even if the caller explicitly requests replacement. Never infer scopes.
 */
import type {AppData,ClassData} from '../types';
import type {AssessmentArchiveV1,ApprovedAssessmentScope} from '../assessment/assessmentArchive';
import {validateAssessmentArchiveV1} from '../assessment/assessmentArchive';
import {resolveApprovedAssessmentScopes} from '../assessment/approvedAssessmentScopes';
import {snapshotAssessmentData} from '../assessment/assessmentRevisionBindings';
import {createAssessmentBackupPayloadV7,inspectAssessmentBackupPayload} from './assessmentBackupPayload';
import {sameDb2Physical,db2Failure} from './db2PhysicalLifecycle';
import {withoutLocalBackupVerification} from '../persistence/backupCheckpoint';
import {normalizeLoadedCopilotState} from '../copilot/state';
import type {CompleteSecureAppSnapshot} from './secureAppStorage';

type EvidenceClass=ClassData & {assessmentEvidenceV1?:AssessmentArchiveV1};
const historyKeys=['references','criteria','rubrics','assessments','evidence'] as const;
const includesExact=(candidate:readonly unknown[],previous:readonly unknown[])=>previous.every(p=>candidate.some(c=>sameDb2Physical(p,c)));

/** Validate both graphs independently, and require every previously confirmed
 * revision and frozen link to survive unchanged. Additions are permitted,
 * provided the candidate is independently valid; no merge or repair.
 */
export function preservesAssessmentHistory(previous:AppData,candidate:AppData,
 currentScopes:readonly ApprovedAssessmentScope[],incomingScopes:readonly ApprovedAssessmentScope[]):boolean{
 let oldData:AppData,newData:AppData;
 try{oldData=snapshotAssessmentData(previous) as AppData;newData=snapshotAssessmentData(candidate) as AppData;}catch{return false;}
 if(!validateAssessmentArchiveV1(oldData,currentScopes).valid||!validateAssessmentArchiveV1(newData,incomingScopes).valid)return false;
 for(const cls of oldData.classes as EvidenceClass[]){
  const old=cls.assessmentEvidenceV1;if(!old)continue;
  const next=(newData.classes.find(c=>c.id===cls.id) as EvidenceClass|undefined)?.assessmentEvidenceV1;
  if(!next)return false;
  for(const section of old.documents){
   const d=section.document;
   const found=next.documents.find(s=>s.document.classId===d.classId&&s.document.schoolYear===d.schoolYear&&s.document.subjectCode===d.subjectCode);
   if(!found||!historyKeys.every(k=>includesExact(found.document[k],d[k]))||!includesExact(found.bindings,section.bindings))return false;
  }
 }
 return true;
}

/**
 * AP-02: a previous V7 copy may predate a newly created class. The current
 * teacher-approved contexts are the ONLY authority: the candidate can narrow
 * this set to classes it actually contains, but can never add an approval.
 *
 * validateAssessmentArchiveV1 rejects approval entries for absent classes.
 * Passing the complete current list to an older (otherwise valid) snapshot
 * causes INVALID_SCOPE before its encrypted backup can be restored.
 * Unsupported, duplicate or malformed class identities fail closed.
 */
export function selectApprovedScopesForIncomingV7Backup(
  incoming:unknown,approvedScopes:readonly ApprovedAssessmentScope[]
):readonly ApprovedAssessmentScope[]{
 let data:unknown;
 try{data=snapshotAssessmentData(incoming);}catch{throw db2Failure();}
 if(!data||typeof data!=='object'||Array.isArray(data)||
    (data as {backupDataVersion?:unknown}).backupDataVersion!==7)throw db2Failure();
 const snapshot=(data as {snapshot?:unknown}).snapshot;
 if(!snapshot||typeof snapshot!=='object'||Array.isArray(snapshot))throw db2Failure();
 const appData=(snapshot as {appData?:unknown}).appData;
 if(!appData||typeof appData!=='object'||Array.isArray(appData))throw db2Failure();
 const classes=(appData as {classes?:unknown}).classes;
 if(!Array.isArray(classes))throw db2Failure();
 const classIds=new Set<string>();
 for(const cls of classes){
  const id=cls&&typeof cls==='object'&&!Array.isArray(cls)
    ?(cls as {id?:unknown}).id:null;
  if(typeof id!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(id)||
     classIds.has(id))throw db2Failure();
  classIds.add(id);
 }
 // This is intersection only. The backup's contents cannot grant authority
 // to a scope that was not approved independently by the current teacher.
 return approvedScopes.filter(scope=>classIds.has(scope.classId));
}

/** Independent scope and exact recovery copy checks precede encryption of a
 * replacement. Local verification receipts never travel. A checkpoint copy
 * may reset only the change counter and backup date, never another dataset.
 * The returned snapshot is not a permission to write.
 */
export async function projectAssessmentRestoreV7(
 current:CompleteSecureAppSnapshot,incoming:unknown,recovery:unknown,
 currentScopes:readonly ApprovedAssessmentScope[],incomingScopes:readonly ApprovedAssessmentScope[],
 options?: {requireCandidateScopeContinuity: boolean}
):Promise<CompleteSecureAppSnapshot>{
 if(!incoming||typeof incoming!=='object'||!recovery||typeof recovery!=='object')throw db2Failure();
 const detached=snapshotAssessmentData(recovery) as {exportedAt?:unknown};
 const at=detached.exportedAt;
 if(typeof at!=='string')throw db2Failure();
 const previous=await createAssessmentBackupPayloadV7(current,currentScopes,at);
 const recover=await inspectAssessmentBackupPayload(recovery,current,currentScopes);
 const next=await inspectAssessmentBackupPayload(incoming,current,incomingScopes);
 if(recover.sourceVersion!==7||next.sourceVersion!==7)throw db2Failure();
 const clean={...current,meta:withoutLocalBackupVerification(current.meta)};
 if(!sameDb2Physical(previous.snapshot,clean))throw db2Failure();
 const checkpoint={...previous.snapshot,meta:{changes:0,lastBackup:at}};
 if(!sameDb2Physical(recover.snapshot,previous.snapshot)&&!sameDb2Physical(recover.snapshot,checkpoint))throw db2Failure();
 if(!preservesAssessmentHistory(previous.snapshot.appData,next.snapshot.appData,currentScopes,incomingScopes))throw db2Failure();
 const candidate={...next.snapshot,copilotState:normalizeLoadedCopilotState(next.snapshot.copilotState),
  meta:withoutLocalBackupVerification(next.snapshot.meta)};
 // The operational restore persists these settings and planning together.
 // Their scopes must validate the result in addition to the current authority.
 if(options?.requireCandidateScopeContinuity){
  const candidateScopes=resolveApprovedAssessmentScopes(candidate.appData,candidate.planning,candidate.settings);
  if(!validateAssessmentArchiveV1(candidate.appData,candidateScopes).valid)throw db2Failure();
 }
 return candidate;
}
