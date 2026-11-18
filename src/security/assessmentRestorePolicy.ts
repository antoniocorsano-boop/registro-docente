/** VAL-01/S6d.2c.3 — conservative V7 restore policy, no storage or authority.
 * A full replacement needs an exact recovery copy of the current archive.
 * This increment refuses any removal or rewriting of assessment history,
 * even if the caller explicitly requests replacement. Never infer scopes.
 */
import type {AppData,ClassData} from '../types';
import type {AssessmentArchiveV1,ApprovedAssessmentScope} from '../assessment/assessmentArchive';
import {validateAssessmentArchiveV1} from '../assessment/assessmentArchive';
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
 if(!validateAssessmentArchiveV1(previous,currentScopes).valid||!validateAssessmentArchiveV1(candidate,incomingScopes).valid)return false;
 for(const cls of previous.classes as EvidenceClass[]){
  const old=cls.assessmentEvidenceV1;if(!old)continue;
  const next=(candidate.classes.find(c=>c.id===cls.id) as EvidenceClass|undefined)?.assessmentEvidenceV1;
  if(!next)return false;
  for(const section of old.documents){
   const d=section.document;
   const found=next.documents.find(s=>s.document.classId===d.classId&&s.document.schoolYear===d.schoolYear&&s.document.subjectCode===d.subjectCode);
   if(!found||!historyKeys.every(k=>includesExact(found.document[k],d[k]))||!includesExact(found.bindings,section.bindings))return false;
  }
 }
 return true;
}

/** Independent scope and exact recovery copy checks precede encryption of a
 * replacement. Local verification receipts never travel. A checkpoint copy
 * may reset only the change counter and backup date, never another dataset.
 * The returned snapshot is not a permission to write.
 */
export async function projectAssessmentRestoreV7(
 current:CompleteSecureAppSnapshot,incoming:unknown,recovery:unknown,
 currentScopes:readonly ApprovedAssessmentScope[],incomingScopes:readonly ApprovedAssessmentScope[]
):Promise<CompleteSecureAppSnapshot>{
 if(!incoming||typeof incoming!=='object'||!recovery||typeof recovery!=='object')throw db2Failure();
 const at=(recovery as {exportedAt?:unknown}).exportedAt;
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
 return {...next.snapshot,copilotState:normalizeLoadedCopilotState(next.snapshot.copilotState),
  meta:withoutLocalBackupVerification(next.snapshot.meta)};
}
