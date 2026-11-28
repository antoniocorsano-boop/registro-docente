/** VAL-01/PRODUCT-02 — independently scoped, existing-only recording context.
 * A class roster and teacher settings supply authority; stored documents
 * cannot authenticate themselves. This module never creates a proof or archive.
 */
import type {AppSettings,ClassData} from '../types';
import type {AssessmentEvidenceV1,AssessmentScopeV1} from './assessmentEvidence';
import {validateAssessmentArchiveV1,type ApprovedAssessmentScope} from './assessmentArchive';
import {snapshotAssessmentData} from './assessmentRevisionBindings';
import {approvedAssessmentSubjectCodes,resolveAssessmentSubjectCode,selectUniqueAssessmentDocument} from './assessmentSubjectScope';
import {canonicalAssessmentSchoolYear} from './assessmentSchoolYear';

export interface CriterionRecordingOption {
 readonly assessmentRevisionId:string;
 readonly title:string;
 readonly completedOn:string;
 readonly criteria:readonly {readonly revisionId:string;readonly description:string}[];
}
export type DailyCriterionRecordingContext=
 | {readonly status:'absent'|'unverified'}
 | {readonly status:'ready';readonly document:AssessmentEvidenceV1;
    readonly scope:AssessmentScopeV1;readonly assessments:readonly CriterionRecordingOption[]};

export function resolveDailyCriterionRecordingContext(
 currentClass:ClassData,settings:Pick<AppSettings,'year'|'subject'>|undefined,
 approvedScopes?:readonly ApprovedAssessmentScope[]
):DailyCriterionRecordingContext{
 try{
  const field=Object.getOwnPropertyDescriptor(currentClass,'assessmentEvidenceV1');
  if(!field)return {status:'absent'};
  if(!('value' in field)||!settings?.year||!settings?.subject)return {status:'unverified'};
  const subjectCode=resolveAssessmentSubjectCode(settings.subject);
  const schoolYear=canonicalAssessmentSchoolYear(settings.year);
  if(!subjectCode||!schoolYear)return {status:'unverified'};
  const approved={classId:currentClass.id,schoolYear,subjectCode};
  const authorized=approvedScopes??approvedAssessmentSubjectCodes(subjectCode).map(code=>({...approved,subjectCode:code}));
  if(!authorized.some(s=>s.classId===approved.classId&&
   s.schoolYear===approved.schoolYear&&s.subjectCode===approved.subjectCode))
   return {status:'unverified'};
  // Validate only this class against its independently approved scopes.
  // Whole-archive mutations still validate the complete scope list.
  const result=validateAssessmentArchiveV1({classes:[currentClass]},
   authorized.filter(s=>s.classId===currentClass.id));
  if(!result.valid||result.state!=='present')return {status:'unverified'};
  const cls=snapshotAssessmentData(currentClass) as ClassData;
  const document=selectUniqueAssessmentDocument(cls.assessmentEvidenceV1!.documents.map(section=>section.document),approved);
  if(!document)return {status:'absent'};
  const scope:AssessmentScopeV1={...approved,subjectCode:document.subjectCode,studentIds:cls.students.map(s=>s.id)};
  const criteria=new Map(document.criteria.map(c=>[c.revisionId,c.description]));
  const assessments=document.assessments.filter(a=>a.status==='completed'&&
    !document.assessments.some(next=>next.supersedesRevisionId===a.revisionId)).map(a=>({
      assessmentRevisionId:a.revisionId,title:a.title,completedOn:a.completedOn!,
      criteria:a.criteria.map(c=>({revisionId:c.criterionRevisionId,
        description:criteria.get(c.criterionRevisionId)!}))
    }));
  return {status:'ready',document,scope,assessments};
 }catch{return {status:'unverified'};}
}
