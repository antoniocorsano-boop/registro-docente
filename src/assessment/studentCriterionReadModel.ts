/** VAL-01/PRODUCT-01 — local, read-only student evidence consultation.
 * No inference from grades; no mutation, network, persistence or export.
 * The independent context comes from the teacher's current settings, never
 * from an unverified archived document's claimed authority.
 */
import type {AppSettings,ClassData} from '../types';
import type {AssessmentEvidenceV1,AssessmentScopeV1} from './assessmentEvidence';
import type {AssessmentArchiveV1,ApprovedAssessmentScope} from './assessmentArchive';
import {validateAssessmentArchiveV1} from './assessmentArchive';
import {projectIndividualAssessmentEvidence} from './assessmentEvidenceProjection';
import {snapshotAssessmentData} from './assessmentRevisionBindings';
import {resolveAssessmentSubjectCode} from './assessmentSubjectScope';
import {canonicalAssessmentSchoolYear} from './assessmentSchoolYear';

type State='observed'|'not_observed'|'not_applicable';
export interface CriterionEvidenceRow {
  readonly revisionId:string;
  readonly observedOn:string;
  readonly assessmentTitle:string;
  readonly criterionDescription:string;
  readonly state:State;
}
export type CriterionEvidenceReadModel=
 | {readonly status:'absent'}
 | {readonly status:'unverified'}
 | {readonly status:'ready';readonly rows:readonly CriterionEvidenceRow[];
     readonly counts:Readonly<{observed:number;notObserved:number;notApplicable:number}>};

const unverified=():CriterionEvidenceReadModel=>({status:'unverified'});

/** A missing archive is not a negative observation. Any mismatch fails closed. */
export function readStudentCriterionEvidence(
  currentClass:ClassData,settings:Pick<AppSettings,'year'|'subject'>|undefined,studentId:string,
  approvedScopes?:readonly ApprovedAssessmentScope[]
):CriterionEvidenceReadModel{
  try{
    const descriptor=Object.getOwnPropertyDescriptor(currentClass,'assessmentEvidenceV1');
    if(!descriptor)return {status:'absent'};
    if(!('value' in descriptor))return unverified();
    const scope={classId:currentClass.id,schoolYear:canonicalAssessmentSchoolYear(settings?.year),subjectCode:resolveAssessmentSubjectCode(settings?.subject)};
    if(!scope.schoolYear||!scope.subjectCode||
       !currentClass.students.some(student=>student.id===studentId))return unverified();
    // The official local scope and roster are supplied independently.
    const authorized=approvedScopes??[scope];
    if(!authorized.some(s=>s.classId===scope.classId&&s.schoolYear===scope.schoolYear&&
      s.subjectCode===scope.subjectCode))return unverified();
    const verified=validateAssessmentArchiveV1({classes:[currentClass]},
      authorized.filter(s=>s.classId===currentClass.id));
    if(!verified.valid||verified.state!=='present')return unverified();
    const archive=snapshotAssessmentData(descriptor.value) as AssessmentArchiveV1;
    const matching=archive.documents.filter(section=>
      section.document.classId===scope.classId&&
      section.document.schoolYear===scope.schoolYear&&
      section.document.subjectCode===scope.subjectCode);
    if(matching.length===0)return {status:'absent'};
    if(matching.length!==1)return unverified();
    const document=matching[0].document as AssessmentEvidenceV1;
    const context:AssessmentScopeV1={classId:scope.classId,schoolYear:scope.schoolYear,
      subjectCode:scope.subjectCode,studentIds:currentClass.students.map(student=>student.id)};
    const projected=projectIndividualAssessmentEvidence(document,context,studentId);
    if(!projected.valid)return unverified();

    const revisions=new Map(document.evidence.map(e=>[e.revisionId,e]));
    const assessments=new Map(document.assessments.map(a=>[a.revisionId,a]));
    const criteria=new Map(document.criteria.map(c=>[c.revisionId,c]));
    const rows:CriterionEvidenceRow[]=[];
    for(const entry of projected.entries){
      const e=revisions.get(entry.evidenceRevisionId);
      const a=assessments.get(entry.assessmentRevisionId);
      const c=criteria.get(entry.criterionRevisionId);
      if(!e||!a||!c||e.state==='withdrawn')return unverified();
      rows.push({revisionId:e.revisionId,observedOn:e.observedOn,
        assessmentTitle:a.title,criterionDescription:c.description,
        state:entry.state});
    }
    // Show the most recent records first; do not merge events from the same day.
    rows.reverse();
    return {status:'ready',rows,counts:projected.counts};
  }catch{return unverified();}
}
