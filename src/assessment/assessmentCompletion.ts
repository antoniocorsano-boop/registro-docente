/** VAL-01/S6a — explicit planned-to-completed transition, no storage or individual evidence. */
import {validateAssessmentEvidenceV1} from './assessmentEvidence';
import type {AssessmentEvidenceV1,AssessmentDefinitionRevision,CriterionRevision,LearningReferenceRevision,RubricRevision} from './assessmentEvidence';
import {snapshotAssessmentData} from './assessmentRevisionBindings';
type Row=Record<string,unknown>;
type Issue='INVALID_DOCUMENT'|'INVALID_REQUEST'|'STALE_REVISION'|'INVALID_STATUS'|'CONFLICT'|'STALE_PREVIEW'|'INVALID_CONFIRMATION';
type Invalid={readonly valid:false;readonly issue:Issue};
interface Request{readonly assessmentRevisionId:string;readonly revisionId:string;readonly completedOn:string}
export interface AssessmentCompletionPreview{
  readonly scope:{readonly classId:string;readonly schoolYear:string;readonly subjectCode:string};
  readonly request:Request;
  readonly planned:AssessmentDefinitionRevision;
  readonly frozen:{readonly criteria:readonly CriterionRevision[];readonly references:readonly LearningReferenceRevision[];readonly rubrics:readonly RubricRevision[]};
}
export type CompletionPreviewResult=Invalid|{readonly valid:true;readonly preview:AssessmentCompletionPreview};
export type CompletionResult=Invalid|{readonly valid:true;readonly definition:AssessmentDefinitionRevision};
const bad=(issue:Issue):Invalid=>({valid:false,issue});
const id=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(v);
function exact(v:unknown,keys:string[]):v is Row{
  return v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.prototype.hasOwnProperty.call(v,k));
}
function validDay(v:unknown,year:string):v is string{
  if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;
  const t=Date.parse(v+'T00:00:00.000Z');
  return Number.isFinite(t)&&new Date(t).toISOString().slice(0,10)===v&&v>=year.slice(0,4)+'-09-01'&&v<=year.slice(5)+'-08-31';
}
function validInstant(v:unknown):v is string{
  if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v))return false;
  const t=Date.parse(v);return Number.isFinite(t)&&new Date(t).toISOString()===v;
}
function prepare(d:AssessmentEvidenceV1,input:unknown):CompletionPreviewResult{
  if(!exact(input,['assessmentRevisionId','revisionId','completedOn'])||!id(input.assessmentRevisionId)||!id(input.revisionId)||!validDay(input.completedOn,d.schoolYear))return bad('INVALID_REQUEST');
  const request:Request={assessmentRevisionId:input.assessmentRevisionId,revisionId:input.revisionId,completedOn:input.completedOn};
  const planned=d.assessments.find(a=>a.revisionId===request.assessmentRevisionId);
  if(!planned||d.assessments.some(a=>a.supersedesRevisionId===planned.revisionId))return bad('STALE_REVISION');
  if(planned.status!=='planned'||d.assessments.some(a=>a.assessmentId===planned.assessmentId&&a.status!=='planned'))return bad('INVALID_STATUS');
  if([...d.references,...d.criteria,...d.rubrics,...d.assessments,...d.evidence].some(x=>x.revisionId===request.revisionId))return bad('CONFLICT');
  const criteria=planned.criteria.map(b=>d.criteria.find(c=>c.revisionId===b.criterionRevisionId)!);
  const refIds=[...new Set(criteria.flatMap(c=>[...c.targetReferenceRevisionIds,...c.contextualReferenceRevisionIds]))];
  const rubricIds=[...new Set(planned.criteria.flatMap(b=>b.rubricRevisionId?[b.rubricRevisionId]:[]))];
  return {valid:true,preview:{scope:{classId:d.classId,schoolYear:d.schoolYear,subjectCode:d.subjectCode},request,planned,
    frozen:{criteria,references:refIds.map(i=>d.references.find(r=>r.revisionId===i)!),rubrics:rubricIds.map(i=>d.rubrics.find(r=>r.revisionId===i)!)}}};
}
/** Review exact planned activity and actual date, with historical references preserved. */
export function previewAssessmentCompletion(document:unknown,scope:unknown,request:unknown):CompletionPreviewResult{
  try{
    const d=snapshotAssessmentData(document),s=snapshotAssessmentData(scope);
    if(!validateAssessmentEvidenceV1(d,s).valid)return bad('INVALID_DOCUMENT');
    return prepare(d as AssessmentEvidenceV1,snapshotAssessmentData(request));
  }catch{return bad('INVALID_REQUEST');}
}
/** Confirm completion against the current graph, returning a detached revision only.
 * Explicit caller assertion is not authentication or a save receipt.
 */
export function confirmAssessmentCompletion(document:unknown,scope:unknown,reviewed:unknown,confirmation:unknown):CompletionResult{
  try{
    const d=snapshotAssessmentData(document),s=snapshotAssessmentData(scope);
    if(!validateAssessmentEvidenceV1(d,s).valid)return bad('INVALID_DOCUMENT');
    const r=snapshotAssessmentData(reviewed),c=snapshotAssessmentData(confirmation);
    if(!exact(c,['confirmedByTeacher','confirmedAt'])||c.confirmedByTeacher!==true||!validInstant(c.confirmedAt))return bad('INVALID_CONFIRMATION');
    if(!exact(r,['scope','request','planned','frozen']))return bad('STALE_PREVIEW');
    const data=d as AssessmentEvidenceV1,fresh=prepare(data,r.request);
    if(!fresh.valid)return fresh;
    if(JSON.stringify(r)!==JSON.stringify(fresh.preview))return bad('STALE_PREVIEW');
    const {planned,request}=fresh.preview;
    // A civil date has no exact offset. Reject confirmation earlier than the
    // earliest possible UTC instant of the actual day, as in the evidence domain.
    if(c.confirmedAt<planned.confirmedAt||Date.parse(c.confirmedAt)<Date.parse(request.completedOn+'T00:00:00.000Z')-14*3600000)return bad('INVALID_CONFIRMATION');
    const definition:AssessmentDefinitionRevision={...planned,revisionId:request.revisionId,supersedesRevisionId:planned.revisionId,
      confirmedByTeacher:true,confirmedAt:c.confirmedAt,status:'completed',completedOn:request.completedOn};
    if(!validateAssessmentEvidenceV1({...data,assessments:[...data.assessments,definition]},s).valid)return bad('INVALID_CONFIRMATION');
    return {valid:true,definition};
  }catch{return bad('INVALID_CONFIRMATION');}
}
