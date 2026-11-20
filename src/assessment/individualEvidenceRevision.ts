/** VAL-01/S6b.2 — explicit revision or withdrawal of a previously confirmed observation.
 * No new observation, deletion, persistence, grade change, or runtime activation.
 */
import {validateAssessmentEvidenceV1} from './assessmentEvidence';
import type {AssessmentEvidenceV1,IndividualEvidenceRevision,AssessmentDefinitionRevision,CriterionRevision,LearningReferenceRevision,RubricRevision} from './assessmentEvidence';
import {snapshotAssessmentData} from './assessmentRevisionBindings';
type Row=Record<string,unknown>;
type Observed=Extract<IndividualEvidenceRevision,{state:'observed'}>;
type Change={readonly evidenceRevisionId:string;readonly revisionId:string;readonly recordedAt:string};
type Request=Change&(
  {readonly action:'correct';readonly state:'observed';readonly fact:Observed['fact'];readonly interpretation:Observed['interpretation']}|
  {readonly action:'correct';readonly state:'not_observed'|'not_applicable'}|
  {readonly action:'withdraw';readonly reason:string});
type Issue='INVALID_DOCUMENT'|'INVALID_REQUEST'|'STALE_REVISION'|'WITHDRAWN'|'CONFLICT'|'INVALID_CHANGE'|'STALE_PREVIEW'|'INVALID_CONFIRMATION';
type Invalid={readonly valid:false;readonly issue:Issue};
export interface EvidenceRevisionPreview{
  readonly scope:{readonly classId:string;readonly schoolYear:string;readonly subjectCode:string};
  readonly request:Request;
  readonly previous:IndividualEvidenceRevision;
  readonly assessment:AssessmentDefinitionRevision;
  readonly criterion:CriterionRevision;
  readonly references:readonly LearningReferenceRevision[];
  readonly rubric:RubricRevision|null;
}
export type EvidenceRevisionPreviewResult=Invalid|{readonly valid:true;readonly preview:EvidenceRevisionPreview};
export type EvidenceRevisionResult=Invalid|{readonly valid:true;readonly evidence:IndividualEvidenceRevision};
const bad=(issue:Issue):Invalid=>({valid:false,issue});
const id=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(v);
function instant(v:unknown):v is string{
  if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v))return false;
  const t=Date.parse(v);return Number.isFinite(t)&&new Date(t).toISOString()===v;
}
function exact(v:unknown,keys:readonly string[]):v is Row{
  return v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.prototype.hasOwnProperty.call(v,k));
}
const base=['action','evidenceRevisionId','revisionId','recordedAt'];
function content(e:IndividualEvidenceRevision):unknown{
  if(e.state==='observed')return {state:e.state,fact:e.fact,interpretation:e.interpretation};
  if(e.state==='withdrawn')return {state:e.state,reason:e.reason};
  return {state:e.state};
}
// Compare validated plain data structurally, not by caller-dependent key order.
function canonical(v:unknown):string{
  if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';
  if(v!==null&&typeof v==='object')return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical((v as Row)[k])).join(',')+'}';
  return JSON.stringify(v)??'undefined';
}
function proposed(p:IndividualEvidenceRevision,r:Request,confirmedAt:string):IndividualEvidenceRevision{
  const common={evidenceId:p.evidenceId,observationEventId:p.observationEventId,assessmentRevisionId:p.assessmentRevisionId,
    studentId:p.studentId,criterionRevisionId:p.criterionRevisionId,observedOn:p.observedOn,recordedAt:r.recordedAt,
    revisionId:r.revisionId,supersedesRevisionId:p.revisionId,confirmedByTeacher:true as const,confirmedAt};
  if(r.action==='withdraw')return {...common,state:'withdrawn',reason:r.reason};
  if(r.state==='observed')return {...common,state:'observed',fact:r.fact,interpretation:r.interpretation};
  return {...common,state:r.state};
}
function prepare(d:AssessmentEvidenceV1,s:unknown,input:unknown):EvidenceRevisionPreviewResult{
  const row=input as Row|null;
  const keys=row?.action==='withdraw'?[...base,'reason']:
    row?.action==='correct'&&row.state==='observed'?[...base,'state','fact','interpretation']:
    row?.action==='correct'&&(row.state==='not_observed'||row.state==='not_applicable')?[...base,'state']:null;
  if(!keys||!exact(input,keys)||!id(input.evidenceRevisionId)||!id(input.revisionId)||!instant(input.recordedAt))return bad('INVALID_REQUEST');
  const r=input as unknown as Request;
  const p=d.evidence.find(e=>e.revisionId===r.evidenceRevisionId);
  if(!p||d.evidence.some(e=>e.supersedesRevisionId===p.revisionId))return bad('STALE_REVISION');
  if(p.state==='withdrawn')return bad('WITHDRAWN');
  if([...d.references,...d.criteria,...d.rubrics,...d.assessments,...d.evidence].some(e=>e.revisionId===r.revisionId))return bad('CONFLICT');
  if(r.recordedAt<p.confirmedAt)return bad('INVALID_CHANGE');
  const a=d.assessments.find(e=>e.revisionId===p.assessmentRevisionId)!;
  const criterion=d.criteria.find(e=>e.revisionId===p.criterionRevisionId)!;
  const binding=a.criteria.find(e=>e.criterionRevisionId===p.criterionRevisionId)!;
  const references=[...criterion.targetReferenceRevisionIds,...criterion.contextualReferenceRevisionIds].map(i=>d.references.find(e=>e.revisionId===i)!);
  const rubric=binding.rubricRevisionId?d.rubrics.find(e=>e.revisionId===binding.rubricRevisionId)!:null;
  const candidate=proposed(p,r,r.recordedAt);
  if(!validateAssessmentEvidenceV1({...d,evidence:[...d.evidence,candidate]},s).valid)return bad('INVALID_CHANGE');
  if(r.action==='correct'&&canonical(content(p))===canonical(content(candidate)))return bad('INVALID_CHANGE');
  return {valid:true,preview:{scope:{classId:d.classId,schoolYear:d.schoolYear,subjectCode:d.subjectCode},request:r,previous:p,assessment:a,criterion,references,rubric}};
}
/** Review an exact current evidence revision and its original frozen assessment.
 * Later curriculum or assessment revisions never rewrite the historical link.
 */
export function previewEvidenceRevision(document:unknown,scope:unknown,request:unknown):EvidenceRevisionPreviewResult{
  try{
    const d=snapshotAssessmentData(document),s=snapshotAssessmentData(scope);
    if(!validateAssessmentEvidenceV1(d,s).valid)return bad('INVALID_DOCUMENT');
    return prepare(d as AssessmentEvidenceV1,s,snapshotAssessmentData(request));
  }catch{return bad('INVALID_REQUEST');}
}
/** Return one detached proposed revision on explicit confirmation, not a save receipt. */
export function confirmEvidenceRevision(document:unknown,scope:unknown,reviewed:unknown,confirmation:unknown):EvidenceRevisionResult{
  try{
    const d=snapshotAssessmentData(document),s=snapshotAssessmentData(scope);
    if(!validateAssessmentEvidenceV1(d,s).valid)return bad('INVALID_DOCUMENT');
    const r=snapshotAssessmentData(reviewed),c=snapshotAssessmentData(confirmation);
    if(!exact(c,['confirmedByTeacher','confirmedAt'])||c.confirmedByTeacher!==true||!instant(c.confirmedAt))return bad('INVALID_CONFIRMATION');
    if(!exact(r,['scope','request','previous','assessment','criterion','references','rubric']))return bad('STALE_PREVIEW');
    const data=d as AssessmentEvidenceV1,fresh=prepare(data,s,r.request);
    if(!fresh.valid)return fresh;
    if(canonical(r)!==canonical(fresh.preview))return bad('STALE_PREVIEW');
    const p=fresh.preview,evidence=proposed(p.previous,p.request,c.confirmedAt);
    if(!validateAssessmentEvidenceV1({...data,evidence:[...data.evidence,evidence]},s).valid)return bad('INVALID_CONFIRMATION');
    return {valid:true,evidence};
  }catch{return bad('INVALID_CONFIRMATION');}
}
