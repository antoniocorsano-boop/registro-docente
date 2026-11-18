/** VAL-01/S5a — read-only local catalogue for explicit teacher selection.
 * No student information in output, no inference, no archive writes or runtime integration.
 */
import { validateAssessmentEvidenceV1 } from './assessmentEvidence';
import type { AssessmentEvidenceV1, AssessmentStatus, LearningKind, LearningReferenceRevision } from './assessmentEvidence';
import { snapshotAssessmentData } from './assessmentRevisionBindings';

interface ReferenceOption {
  readonly revisionId:string;
  readonly kind:LearningKind;
  readonly text:string;
  readonly sourceVersion:string;
}
interface RubricOption {
  readonly rubricRevisionId:string;
  readonly sourceVersion:string;
  readonly levels:readonly {readonly levelId:string;readonly label:string;readonly description:string}[];
}
interface CriterionOption {
  readonly criterionRevisionId:string;
  readonly description:string;
  readonly targets:readonly ReferenceOption[];
  readonly context:readonly ReferenceOption[];
  readonly rubrics:readonly RubricOption[];
}
export type AssessmentPreparationOptions =
  | {readonly valid:true;readonly existing:{readonly assessmentRevisionId:string;readonly status:AssessmentStatus}|null;
      readonly criteria:readonly CriterionOption[]}
  | {readonly valid:false;readonly issue:'INVALID_DOCUMENT'|'INVALID_ACTIVITY'};
function active<T extends {readonly revisionId:string;readonly supersedesRevisionId?:string}>(rows:readonly T[]):T[]{
  const superseded=new Set(rows.flatMap(row=>row.supersedesRevisionId?[row.supersedesRevisionId]:[]));
  return rows.filter(row=>!superseded.has(row.revisionId)).sort((a,b)=>a.revisionId<b.revisionId?-1:a.revisionId>b.revisionId?1:0);
}
function reference(r:LearningReferenceRevision):ReferenceOption{
  return {revisionId:r.revisionId,kind:r.kind,text:r.text,sourceVersion:r.source.sourceVersion};
}
/** Offer only exact current revisions for new preparation. Historical links remain
 * in the source; a revised target/criterion is never silently substituted.
 * An existing activity is reported, not changed or duplicated.
 */
export function listAssessmentPreparationOptions(document:unknown,scope:unknown,activityId:unknown):AssessmentPreparationOptions{
  try{
    const data=snapshotAssessmentData(document),context=snapshotAssessmentData(scope);
    if(!validateAssessmentEvidenceV1(data,context).valid)return {valid:false,issue:'INVALID_DOCUMENT'};
    if(typeof activityId!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(activityId))return {valid:false,issue:'INVALID_ACTIVITY'};
    const d=data as AssessmentEvidenceV1;
    const refs=new Map(active(d.references).map(r=>[r.revisionId,r]));
    const rubrics=active(d.rubrics);
    const criteria:CriterionOption[]=[];
    for(const c of active(d.criteria)){
      if([...c.targetReferenceRevisionIds,...c.contextualReferenceRevisionIds].some(id=>!refs.has(id)))continue;
      const options:RubricOption[]=[];
      for(const rubric of rubrics){
        const entry=rubric.criteria.find(r=>r.criterionRevisionId===c.revisionId);
        if(entry)options.push({rubricRevisionId:rubric.revisionId,sourceVersion:rubric.source.sourceVersion,
          levels:entry.levels.map(l=>({levelId:l.levelId,label:l.label,description:l.description}))});
      }
      criteria.push({criterionRevisionId:c.revisionId,description:c.description,
        targets:c.targetReferenceRevisionIds.map(id=>reference(refs.get(id)!)),
        context:c.contextualReferenceRevisionIds.map(id=>reference(refs.get(id)!)),rubrics:options});
    }
    const existing=active(d.assessments).find(a=>a.source.activityId===activityId);
    return {valid:true,existing:existing?{assessmentRevisionId:existing.revisionId,status:existing.status}:null,criteria};
  }catch{return {valid:false,issue:'INVALID_DOCUMENT'};}
}
