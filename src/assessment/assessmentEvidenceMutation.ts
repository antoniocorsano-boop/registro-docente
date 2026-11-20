/** VAL-01/S6d.2a — isolated derive function for the existing durable coordinator.
 * No I/O, activation, schema migration, backup authority or publication.
 * Call only after a qualified protected session has independently supplied scopes.
 */
import type {AppData,ClassData} from '../types';
import type {AssessmentScopeV1,IndividualEvidenceRevision} from './assessmentEvidence';
import {validateAssessmentArchiveV1,type AssessmentArchiveV1,type ApprovedAssessmentScope} from './assessmentArchive';
import {snapshotAssessmentData} from './assessmentRevisionBindings';
import {confirmIndividualObservation,type IndividualObservationPreview} from './individualObservation';
import {confirmEvidenceRevision,type EvidenceRevisionPreview} from './individualEvidenceRevision';

type EvidenceClass=ClassData & {readonly assessmentEvidenceV1?:AssessmentArchiveV1};
export type EvidenceCommitRequest=
 | {readonly kind:'new';readonly preview:IndividualObservationPreview}
 | {readonly kind:'revision';readonly preview:EvidenceRevisionPreview};
export type EvidenceCommitCandidate={readonly appData:AppData;readonly evidence:IndividualEvidenceRevision};

const reject=()=>new Error('Rilevazione non applicata: contesto o conferma non validi.');
const sameScope=(a:ApprovedAssessmentScope,b:ApprovedAssessmentScope)=>a.classId===b.classId&&a.schoolYear===b.schoolYear&&a.subjectCode===b.subjectCode;
const rosterMatches=(a:readonly string[],b:readonly string[])=>a.length===b.length&&a.every((id,i)=>id===b[i]);

/** The reviewed request must be confirmed against the latest committed document,
 * not a stale copy from the UI. Only one existing document and one new revision
 * change; existing bindings and ordinary grade records are preserved.
 */
export function deriveConfirmedEvidenceMutation(
 current:AppData,approvedScopes:readonly ApprovedAssessmentScope[],expectedScope:AssessmentScopeV1,
 reviewed:EvidenceCommitRequest,confirmation:unknown
):EvidenceCommitCandidate{
 try{
  const app=snapshotAssessmentData(current) as AppData;
  const approved=snapshotAssessmentData(approvedScopes) as readonly ApprovedAssessmentScope[];
  const expected=snapshotAssessmentData(expectedScope) as AssessmentScopeV1;
  const request=snapshotAssessmentData(reviewed) as EvidenceCommitRequest;
  const c=snapshotAssessmentData(confirmation);
  if(!validateAssessmentArchiveV1(app,approved).valid||app.currentClassId!==expected.classId||
    !approved.some(s=>sameScope(s,expected)))throw reject();
  const cls=app.classes.find(c=>c.id===expected.classId) as EvidenceClass|undefined;
  if(!cls||!rosterMatches(cls.students.map(s=>s.id),expected.studentIds))throw reject();
  const envelope=cls.assessmentEvidenceV1;
  const index=envelope?.documents.findIndex(s=>sameScope(s.document,expected))??-1;
  if(!envelope||index<0)throw reject(); // never create or migrate a document
  const section=envelope.documents[index];
  const scope:AssessmentScopeV1={classId:expected.classId,schoolYear:expected.schoolYear,subjectCode:expected.subjectCode,studentIds:cls.students.map(s=>s.id)};
  if(!request||!['new','revision'].includes(request.kind)||Object.keys(request).length!==2)throw reject();
  const result=request.kind==='new'?confirmIndividualObservation(section.document,scope,request.preview,c):
    confirmEvidenceRevision(section.document,scope,request.preview,c);
  if(!result.valid)throw reject();
  const document={...section.document,evidence:[...section.document.evidence,result.evidence]};
  const nextClass:EvidenceClass={...cls,assessmentEvidenceV1:{...envelope,documents:envelope.documents.map((s,i)=>i===index?{...s,document}:s)}};
  const next:AppData={...app,classes:app.classes.map(s=>s.id===cls.id?nextClass:s)};
  if(!validateAssessmentArchiveV1(next,approved).valid)throw reject();
  return {appData:next,evidence:result.evidence};
 }catch{throw reject();}
}
