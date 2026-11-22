/** VAL-01/PRODUCT-05/S7 — local verified bridge for the existing S7a engine.
 * Source and scope are detached after the independently selected year, class,
 * discipline, roster and time window have been checked by PRODUCT-05/1.
 * A missing/invalid archive never falls back to grades or another student.
 */
import type {AppSettings,ClassData} from '../types';
import type {AssessmentEvidenceV1,AssessmentScopeV1} from './assessmentEvidence';
import type {AssessmentArchiveV1} from './assessmentArchive';
import {snapshotAssessmentData} from './assessmentRevisionBindings';
import {readStudentFormativeSources} from './studentFormativeSourceReadModel';
import {resolveAssessmentSubjectCode} from './assessmentSubjectScope';

export type FormativeReviewSource =
 | {readonly status:'absent'|'unverified'}
 | {readonly status:'ready';readonly document:AssessmentEvidenceV1;readonly scope:AssessmentScopeV1};

export function loadStudentFormativeReviewSource(
  currentClass:ClassData,
  settings:Pick<AppSettings,'year'|'subject'>|undefined,
  studentId:string,period:'Q1'|'Q2',from:string,to:string
):FormativeReviewSource{
  try{
    const detached=snapshotAssessmentData(currentClass) as ClassData;
    const model=readStudentFormativeSources(detached,settings,studentId,period,from,to);
    if(model.status!=='ready')return {status:model.status};
    const descriptor=Object.getOwnPropertyDescriptor(detached,'assessmentEvidenceV1');
    if(!descriptor||!('value' in descriptor))return {status:'unverified'};
    const archive=descriptor.value as AssessmentArchiveV1;
    const schoolYear=settings?.year,subjectCode=resolveAssessmentSubjectCode(settings?.subject);
    const sections=archive.documents.filter(s=>s.document.classId===detached.id&&
      s.document.schoolYear===schoolYear&&s.document.subjectCode===subjectCode);
    if(sections.length!==1||!schoolYear||!subjectCode)return {status:'unverified'};
    return {status:'ready',
      document:sections[0].document,
      scope:{classId:detached.id,schoolYear,subjectCode,studentIds:detached.students.map(x=>x.id)}
    };
  }catch{return {status:'unverified'};}
}
