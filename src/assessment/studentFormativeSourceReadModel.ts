/** VAL-01/PRODUCT-05 — eligible period evidence for the teacher's S7 review.
 * Read-only local bridge to the existing validated archive. This is NOT a
 * formative judgement, a generated balance, an export or a durable approval.
 */
import type {AppSettings,ClassData} from '../types';
import type {AssessmentEvidenceV1,AssessmentScopeV1} from './assessmentEvidence';
import type {AssessmentArchiveV1} from './assessmentArchive';
import {validateAssessmentArchiveV1} from './assessmentArchive';
import {projectIndividualAssessmentEvidence} from './assessmentEvidenceProjection';
import {snapshotAssessmentData} from './assessmentRevisionBindings';
import {resolveAssessmentSubjectCode} from './assessmentSubjectScope';

type State='observed'|'not_observed'|'not_applicable';
export interface FormativeSourceRow {
  readonly evidenceRevisionId:string;
  readonly observedOn:string;
  readonly assessmentTitle:string;
  readonly criterionDescription:string;
  readonly state:State;
}
export type FormativeSourcesReadModel =
  | {readonly status:'absent'}
  | {readonly status:'unverified'}
  | {readonly status:'ready';readonly rows:readonly FormativeSourceRow[];
     readonly counts:Readonly<{observed:number;notObserved:number;notApplicable:number}>;
     readonly coverage:'undetermined'};

const unverified=():FormativeSourcesReadModel=>({status:'unverified'});
function day(value:string):boolean{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const timestamp=Date.parse(value+'T00:00:00.000Z');
  return Number.isFinite(timestamp)&&new Date(timestamp).toISOString().slice(0,10)===value;
}

/** The teacher chooses real dates; the period label alone never invents
 * institutional boundaries. Only already-confirmed, active revisions within
 * the selected assessment period are candidates. Nothing is auto-approved.
 */
export function readStudentFormativeSources(
  currentClass:ClassData,
  settings:Pick<AppSettings,'year'|'subject'>|undefined,
  studentId:string,
  period:'Q1'|'Q2',
  from:string,
  to:string
):FormativeSourcesReadModel {
  try{
    const descriptor=Object.getOwnPropertyDescriptor(currentClass,'assessmentEvidenceV1');
    if(!descriptor)return {status:'absent'};
    if(!('value' in descriptor))return unverified();
    const schoolYear=settings?.year;
    const subjectCode=resolveAssessmentSubjectCode(settings?.subject);
    if(!schoolYear||!subjectCode||(period!=='Q1'&&period!=='Q2')||
       !day(from)||!day(to)||from>to||
       from<schoolYear.slice(0,4)+'-09-01'||to>schoolYear.slice(5)+'-08-31'||
       !currentClass.students.some(student=>student.id===studentId))return unverified();
    const approved={classId:currentClass.id,schoolYear,subjectCode};
    const checked=validateAssessmentArchiveV1({classes:[currentClass]},[approved]);
    if(!checked.valid||checked.state!=='present')return unverified();
    const archive=snapshotAssessmentData(descriptor.value) as AssessmentArchiveV1;
    const sections=archive.documents.filter(section=>
      section.document.classId===approved.classId&&
      section.document.schoolYear===schoolYear&&section.document.subjectCode===subjectCode);
    if(sections.length!==1)return unverified();
    const document=sections[0].document as AssessmentEvidenceV1;
    const scope:AssessmentScopeV1={...approved,studentIds:currentClass.students.map(s=>s.id)};
    const individual=projectIndividualAssessmentEvidence(document,scope,studentId);
    if(!individual.valid)return unverified();
    const evidence=new Map(document.evidence.map(e=>[e.revisionId,e]));
    const assessments=new Map(document.assessments.map(a=>[a.revisionId,a]));
    const criteria=new Map(document.criteria.map(c=>[c.revisionId,c]));
    const rows:FormativeSourceRow[]=[];
    const counts={observed:0,notObserved:0,notApplicable:0};
    for(const entry of individual.entries){
      const record=evidence.get(entry.evidenceRevisionId);
      const assessment=assessments.get(entry.assessmentRevisionId);
      const criterion=criteria.get(entry.criterionRevisionId);
      if(!record||record.state==='withdrawn'||!assessment||!criterion)return unverified();
      if(assessment.period!==period||record.observedOn<from||record.observedOn>to)continue;
      rows.push({evidenceRevisionId:record.revisionId,observedOn:record.observedOn,
        assessmentTitle:assessment.title,criterionDescription:criterion.description,
        state:entry.state});
      if(entry.state==='observed')counts.observed++;
      else if(entry.state==='not_observed')counts.notObserved++;
      else counts.notApplicable++;
    }
    rows.sort((a,b)=>a.observedOn<b.observedOn?1:a.observedOn>b.observedOn?-1:
      a.evidenceRevisionId<b.evidenceRevisionId?1:a.evidenceRevisionId>b.evidenceRevisionId?-1:0);
    return {status:'ready',rows,counts,coverage:'undetermined'};
  }catch{return unverified();}
}
