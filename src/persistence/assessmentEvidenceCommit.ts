/** VAL-01/S6d.3 — durable evidence adapter for an already authenticated owner.
 * No new storage, authorization, migration, UI entrypoint or backup authority.
 * The owner supplies the canonical coordinator, independently approved scope,
 * and an active session. The receipt is issued only after atomic persistence.
 */
import type {AppData,ClassData} from '../types';
import type {AssessmentEvidenceV1,AssessmentScopeV1} from '../assessment/assessmentEvidence';
import type {AssessmentArchiveV1,ApprovedAssessmentScope} from '../assessment/assessmentArchive';
import {deriveConfirmedEvidenceMutation,type EvidenceCommitRequest} from '../assessment/assessmentEvidenceMutation';
import {snapshotAssessmentData} from '../assessment/assessmentRevisionBindings';
import {incrementBackupChanges} from './backupCheckpoint';
import type {SecureMeta,SecureAppStorage} from '../security/secureAppStorage';
import type {DurableMutationCoordinator} from './durableMutationCoordinator';
export type EvidenceCommittedState={appData:AppData;meta:SecureMeta};
type EvidenceClass=ClassData & {assessmentEvidenceV1?:AssessmentArchiveV1};
export interface EvidenceSaveReceipt {
 readonly revisionId:string;
 readonly document:AssessmentEvidenceV1;
}
export interface EvidenceMutationOwner {
 readonly coordinator:DurableMutationCoordinator;
 readonly storage:Pick<SecureAppStorage,'saveAppDataAndMeta'>;
 isActive():boolean;
 getCommitted():EvidenceCommittedState;
 publish(next:EvidenceCommittedState):void;
}
const unavailable=()=>Error('Sessione non attuale: riapri il Registro.');
const active=(owner:EvidenceMutationOwner)=>{if(!owner.isActive())throw unavailable();};
/** Capture the reviewed input at admission, revalidate against latest committed
 * state inside the canonical queue, and never issue an optimistic receipt.
 * A revoked owner must reauthenticate and inspect rather than replay blindly.
 */
export async function commitAssessmentEvidence(owner:EvidenceMutationOwner,
 scopes:readonly ApprovedAssessmentScope[],scope:AssessmentScopeV1,
 reviewed:EvidenceCommitRequest,confirmation:unknown):Promise<EvidenceSaveReceipt>{
 active(owner);
 const approved=snapshotAssessmentData(scopes) as readonly ApprovedAssessmentScope[];
 const context=snapshotAssessmentData(scope) as AssessmentScopeV1;
 const request=snapshotAssessmentData(reviewed) as EvidenceCommitRequest;
 const confirmed=snapshotAssessmentData(confirmation);
 const candidate=await owner.coordinator.enqueue({
  getCommitted:()=>{active(owner);return owner.getCommitted();},
  derive:previous=>{
   active(owner);
   const result=deriveConfirmedEvidenceMutation(previous.appData,approved,context,request,confirmed);
   return {appData:result.appData,meta:incrementBackupChanges(previous.meta)};
  },
  persist:async next=>{active(owner);await owner.storage.saveAppDataAndMeta(next.appData,next.meta);},
  // The admitted write may finish during draining. Update the owner's
  // committed reference, but never give a stale caller a success receipt.
  publish:next=>owner.publish(next)
 });
 active(owner);
 const cls=candidate.appData.classes.find(c=>c.id===context.classId) as EvidenceClass|undefined;
 const document=cls?.assessmentEvidenceV1?.documents.find(s=>s.document.classId===context.classId&&s.document.schoolYear===context.schoolYear&&s.document.subjectCode===context.subjectCode)?.document;
 const revisionId=request.preview.request.revisionId;
 if(!document||!document.evidence.some(e=>e.revisionId===revisionId))throw unavailable();
 return {revisionId,document:snapshotAssessmentData(document) as AssessmentEvidenceV1};
}
