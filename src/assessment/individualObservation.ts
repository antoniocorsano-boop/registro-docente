/** VAL-01/S6b.1 — explicit new individual observation; isolated, no persistence. */
import {validateAssessmentEvidenceV1} from './assessmentEvidence';
import type {AssessmentEvidenceV1,AssessmentScopeV1,AssessmentDefinitionRevision,CriterionRevision,LearningReferenceRevision,RubricRevision,IndividualEvidenceRevision} from './assessmentEvidence';
import {snapshotAssessmentData} from './assessmentRevisionBindings';

type Row=Record<string,unknown>;
type Observed=Extract<IndividualEvidenceRevision,{state:'observed'}>;
type Identity={readonly evidenceId:string;readonly revisionId:string;readonly observationEventId:string;readonly assessmentRevisionId:string;readonly studentId:string;readonly criterionRevisionId:string;readonly observedOn:string;readonly recordedAt:string};
type Request=Identity&({readonly state:'observed';readonly fact:Observed['fact'];readonly interpretation:Observed['interpretation']}|{readonly state:'not_observed'|'not_applicable'});
type Issue='INVALID_DOCUMENT'|'INVALID_REQUEST'|'INVALID_STUDENT'|'STALE_ASSESSMENT'|'INVALID_STATUS'|'INVALID_CRITERION'|'CONFLICT'|'INVALID_EVIDENCE'|'STALE_PREVIEW'|'INVALID_CONFIRMATION';
type Invalid={readonly valid:false;readonly issue:Issue};
export interface IndividualObservationPreview{
  readonly scope:{readonly classId:string;readonly schoolYear:string;readonly subjectCode:string};
  readonly request:Request;
  readonly assessment:AssessmentDefinitionRevision;
  readonly criterion:CriterionRevision;
  readonly references:readonly LearningReferenceRevision[];
  readonly rubric:RubricRevision|null;
}
export type ObservationPreviewResult=Invalid|{readonly valid:true;readonly preview:IndividualObservationPreview};
export type ObservationResult=Invalid|{readonly valid:true;readonly evidence:IndividualEvidenceRevision};
const bad=(issue:Issue):Invalid=>({valid:false,issue});
const id=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(v);
function exact(v:unknown,keys:readonly string[]):v is Row{
  return v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.prototype.hasOwnProperty.call(v,k));
}
function validDay(v:unknown,year:string):v is string{
  if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;
  const t=Date.parse(v+'T00:00:00.000Z');
  return Number.isFinite(t)&&new Date(t).toISOString().slice(0,10)===v&&v>=year.slice(0,4)+'-09-01'&&v<=year.slice(5)+'-08-31';
}
function instant(v:unknown):v is string{
  if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v))return false;
  const t=Date.parse(v);return Number.isFinite(t)&&new Date(t).toISOString()===v;
}
const identityKeys=['evidenceId','revisionId','observationEventId','assessmentRevisionId','studentId','criterionRevisionId'];
const baseKeys=[...identityKeys,'observedOn','recordedAt','state'];
function proposal(r:Request,confirmedAt:string):IndividualEvidenceRevision{
  return {...r,confirmedByTeacher:true,confirmedAt};
}
function prepare(d:AssessmentEvidenceV1,s:AssessmentScopeV1,input:unknown):ObservationPreviewResult{
  const row=input as Row|null;
  const state=row?.state;
  if(state!=='observed'&&state!=='not_observed'&&state!=='not_applicable')return bad('INVALID_REQUEST');
  if(!exact(input,state==='observed'?[...baseKeys,'fact','interpretation']:baseKeys)||!identityKeys.every(k=>id(input[k]))||
    !validDay(input.observedOn,d.schoolYear)||!instant(input.recordedAt))return bad('INVALID_REQUEST');
  const r=input as unknown as Request;
  if(!s.studentIds.includes(r.studentId))return bad('INVALID_STUDENT');
  const a=d.assessments.find(x=>x.revisionId===r.assessmentRevisionId);
  if(!a||d.assessments.some(x=>x.supersedesRevisionId===a.revisionId))return bad('STALE_ASSESSMENT');
  if(a.status!=='completed'||!a.completedOn)return bad('INVALID_STATUS');
  const binding=a.criteria.find(x=>x.criterionRevisionId===r.criterionRevisionId);
  const criterion=d.criteria.find(x=>x.revisionId===r.criterionRevisionId);
  if(!binding||!criterion)return bad('INVALID_CRITERION');
  if([...d.references,...d.criteria,...d.rubrics,...d.assessments,...d.evidence].some(x=>x.revisionId===r.revisionId)||
    d.evidence.some(x=>x.evidenceId===r.evidenceId))return bad('CONFLICT');
  // Event identity is local to a logical assessment, logical criterion and student.
  // Historical and withdrawn records also reserve the event identity.
  if(d.evidence.some(e=>e.studentId===r.studentId&&e.observationEventId===r.observationEventId&&
    d.assessments.find(x=>x.revisionId===e.assessmentRevisionId)?.assessmentId===a.assessmentId&&
    d.criteria.find(x=>x.revisionId===e.criterionRevisionId)?.criterionId===criterion.criterionId))return bad('CONFLICT');
  const references=[...criterion.targetReferenceRevisionIds,...criterion.contextualReferenceRevisionIds].map(i=>d.references.find(x=>x.revisionId===i)!);
  const rubric=binding.rubricRevisionId?d.rubrics.find(x=>x.revisionId===binding.rubricRevisionId)!:null;
  // Internal validation only: no confirmed revision is returned by preview.
  const validationInstant=r.recordedAt>a.confirmedAt?r.recordedAt:a.confirmedAt;
  if(!validateAssessmentEvidenceV1({...d,evidence:[...d.evidence,proposal(r,validationInstant)]},s).valid)return bad('INVALID_EVIDENCE');
  return {valid:true,preview:{scope:{classId:d.classId,schoolYear:d.schoolYear,subjectCode:d.subjectCode},request:r,assessment:a,criterion,references,rubric}};
}
/** New event only. No level is inferred from a grade, support, absence or group product. */
export function previewIndividualObservation(document:unknown,scope:unknown,request:unknown):ObservationPreviewResult{
  try{
    const d=snapshotAssessmentData(document),s=snapshotAssessmentData(scope);
    if(!validateAssessmentEvidenceV1(d,s).valid)return bad('INVALID_DOCUMENT');
    return prepare(d as AssessmentEvidenceV1,s as AssessmentScopeV1,snapshotAssessmentData(request));
  }catch{return bad('INVALID_REQUEST');}
}
/** Recheck the exact review and current graph; return one detached revision, not a save receipt. */
export function confirmIndividualObservation(document:unknown,scope:unknown,reviewed:unknown,confirmation:unknown):ObservationResult{
  try{
    const d=snapshotAssessmentData(document),s=snapshotAssessmentData(scope);
    if(!validateAssessmentEvidenceV1(d,s).valid)return bad('INVALID_DOCUMENT');
    const r=snapshotAssessmentData(reviewed),c=snapshotAssessmentData(confirmation);
    if(!exact(c,['confirmedByTeacher','confirmedAt'])||c.confirmedByTeacher!==true||!instant(c.confirmedAt))return bad('INVALID_CONFIRMATION');
    if(!exact(r,['scope','request','assessment','criterion','references','rubric']))return bad('STALE_PREVIEW');
    const data=d as AssessmentEvidenceV1,context=s as AssessmentScopeV1,fresh=prepare(data,context,r.request);
    if(!fresh.valid)return fresh;
    if(JSON.stringify(r)!==JSON.stringify(fresh.preview))return bad('STALE_PREVIEW');
    const evidence=proposal(fresh.preview.request,c.confirmedAt);
    if(!validateAssessmentEvidenceV1({...data,evidence:[...data.evidence,evidence]},context).valid)return bad('INVALID_CONFIRMATION');
    return {valid:true,evidence};
  }catch{return bad('INVALID_CONFIRMATION');}
}
