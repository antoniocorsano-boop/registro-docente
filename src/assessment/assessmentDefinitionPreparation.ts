/** VAL-01/S5b — isolated preparation and explicit confirmation of a new planned activity.
 * No persistence, authorization, generated IDs, grades, student evidence or runtime integration.
 */
import {validateAssessmentEvidenceV1} from './assessmentEvidence';
import type {AssessmentDefinitionRevision,AssessmentEvidenceV1,AssessmentPurpose,EvidenceKind} from './assessmentEvidence';
import {snapshotAssessmentData} from './assessmentRevisionBindings';
import {listAssessmentPreparationOptions} from './assessmentPreparationOptions';
import type {AssessmentPreparationOptions} from './assessmentPreparationOptions';

type Row=Record<string,unknown>;
type Option=Extract<AssessmentPreparationOptions,{valid:true}>['criteria'][number];
type Selection=AssessmentDefinitionRevision['criteria'][number];
interface PreparationRequest {
  readonly activityId:string;readonly assessmentId:string;readonly revisionId:string;
  readonly date:string;readonly period:'Q1'|'Q2';readonly title:string;readonly purpose:AssessmentPurpose;
  readonly criteria:readonly Selection[];
}
export interface AssessmentPreparationPreview {
  readonly scope:{readonly classId:string;readonly schoolYear:string;readonly subjectCode:string};
  readonly request:PreparationRequest;
  readonly selected:readonly {readonly criterionRevisionId:string;readonly description:string;
    readonly targets:Option['targets'];readonly context:Option['context'];readonly rubric:Option['rubrics'][number]|null}[];
}
type Issue='INVALID_DOCUMENT'|'INVALID_REQUEST'|'EXISTING_ACTIVITY'|'CONFLICT'|'UNAVAILABLE_SELECTION'|'STALE_PREVIEW'|'INVALID_CONFIRMATION';
type Invalid={readonly valid:false;readonly issue:Issue};
export type PreparationResult=Invalid|{readonly valid:true;readonly preview:AssessmentPreparationPreview};
export type ConfirmationResult=Invalid|{readonly valid:true;readonly definition:AssessmentDefinitionRevision};
const bad=(issue:Issue):Invalid=>({valid:false,issue});
const own=(x:object,k:string)=>Object.prototype.hasOwnProperty.call(x,k);
function exact(x:unknown,required:string[],optional:string[]=[]):x is Row{
  return x!==null&&typeof x==='object'&&!Array.isArray(x)&&required.every(k=>own(x,k))&&
    Object.keys(x).every(k=>required.includes(k)||optional.includes(k))&&optional.every(k=>!own(x,k)||(x as Row)[k]!==undefined);
}
const id=(x:unknown):x is string=>typeof x==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(x);
const prose=(x:unknown):x is string=>typeof x==='string'&&x.trim().length>0&&x.length<=2000;
function day(x:unknown,year:string):x is string{
  if(typeof x!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(x))return false;
  const t=Date.parse(x+'T00:00:00.000Z');
  return Number.isFinite(t)&&new Date(t).toISOString().slice(0,10)===x&&x>=year.slice(0,4)+'-09-01'&&x<=year.slice(5)+'-08-31';
}
function parseRequest(x:unknown,year:string):PreparationRequest|null{
  if(!exact(x,['activityId','assessmentId','revisionId','date','period','title','purpose','criteria'])||
    !id(x.activityId)||!id(x.assessmentId)||!id(x.revisionId)||!day(x.date,year)||!prose(x.title)||
    (x.period!=='Q1'&&x.period!=='Q2')||
    !['diagnostic','formative','summative'].includes(x.purpose as string)||!Array.isArray(x.criteria)||x.criteria.length===0)return null;
  const criteria:Selection[]=[];
  const seen=new Set<string>();
  for(const c of x.criteria){
    if(!exact(c,['criterionRevisionId','expected'],['rubricRevisionId'])||!id(c.criterionRevisionId)||
      seen.has(c.criterionRevisionId)||(own(c,'rubricRevisionId')&&!id(c.rubricRevisionId))||
      !exact(c.expected,['kind','description','method'])||
      !['process','product','performance','argumentation'].includes(c.expected.kind as string)||
      !prose(c.expected.description)||!prose(c.expected.method))return null;
    seen.add(c.criterionRevisionId);
    criteria.push({criterionRevisionId:c.criterionRevisionId,...(typeof c.rubricRevisionId==='string'?{rubricRevisionId:c.rubricRevisionId}:{}),
      expected:{kind:c.expected.kind as EvidenceKind,description:c.expected.description,method:c.expected.method}});
  }
  return {activityId:x.activityId,assessmentId:x.assessmentId,revisionId:x.revisionId,date:x.date,
    period:x.period,title:x.title,purpose:x.purpose as AssessmentPurpose,criteria};
}
function prepare(d:AssessmentEvidenceV1,context:unknown,input:unknown):PreparationResult{
  const request=parseRequest(input,d.schoolYear);
  if(!request)return bad('INVALID_REQUEST');
  const options=listAssessmentPreparationOptions(d,context,request.activityId);
  if(!options.valid)return bad('INVALID_DOCUMENT');
  if(options.existing)return bad('EXISTING_ACTIVITY');
  if(d.assessments.some(a=>a.assessmentId===request.assessmentId)||
    [...d.references,...d.criteria,...d.rubrics,...d.assessments,...d.evidence].some(r=>r.revisionId===request.revisionId))return bad('CONFLICT');
  const selected:AssessmentPreparationPreview['selected'][number][]=[];
  for(const c of request.criteria){
    const option=options.criteria.find(o=>o.criterionRevisionId===c.criterionRevisionId);
    if(!option)return bad('UNAVAILABLE_SELECTION');
    const rubric=c.rubricRevisionId===undefined?null:option.rubrics.find(r=>r.rubricRevisionId===c.rubricRevisionId);
    if(rubric===undefined)return bad('UNAVAILABLE_SELECTION');
    selected.push({criterionRevisionId:option.criterionRevisionId,description:option.description,targets:option.targets,
      context:option.context,rubric});
  }
  return {valid:true,preview:{scope:{classId:d.classId,schoolYear:d.schoolYear,subjectCode:d.subjectCode},request,selected}};
}
/** Returns reviewable content, not a confirmed definition. */
export function previewAssessmentDefinition(document:unknown,scope:unknown,request:unknown):PreparationResult{
  try{
    const d=snapshotAssessmentData(document),s=snapshotAssessmentData(scope);
    if(!validateAssessmentEvidenceV1(d,s).valid)return bad('INVALID_DOCUMENT');
    return prepare(d as AssessmentEvidenceV1,s,snapshotAssessmentData(request));
  }catch{return bad('INVALID_REQUEST');}
}
/** Rebuild the reviewed selection from current data, then validate the appended
 * definition in the full domain graph. Confirmation is an explicit caller assertion,
 * not an authenticated authorization or a persistence receipt.
 */
export function confirmAssessmentDefinition(document:unknown,scope:unknown,reviewed:unknown,confirmation:unknown):ConfirmationResult{
  try{
    const d=snapshotAssessmentData(document),s=snapshotAssessmentData(scope);
    if(!validateAssessmentEvidenceV1(d,s).valid)return bad('INVALID_DOCUMENT');
    const r=snapshotAssessmentData(reviewed),c=snapshotAssessmentData(confirmation);
    if(!exact(c,['confirmedByTeacher','confirmedAt'])||c.confirmedByTeacher!==true||typeof c.confirmedAt!=='string')return bad('INVALID_CONFIRMATION');
    if(!exact(r,['scope','request','selected']))return bad('STALE_PREVIEW');
    const data=d as AssessmentEvidenceV1;
    const fresh=prepare(data,s,r.request);
    if(!fresh.valid)return fresh;
    if(JSON.stringify(r)!==JSON.stringify(fresh.preview))return bad('STALE_PREVIEW');
    const p=fresh.preview.request;
    const definition:AssessmentDefinitionRevision={assessmentId:p.assessmentId,revisionId:p.revisionId,
      confirmedByTeacher:true,confirmedAt:c.confirmedAt,date:p.date,period:p.period,title:p.title,purpose:p.purpose,
      status:'planned',source:{kind:'explicit-activity',activityId:p.activityId},criteria:p.criteria};
    if(!validateAssessmentEvidenceV1({...data,assessments:[...data.assessments,definition]},s).valid)return bad('INVALID_CONFIRMATION');
    return {valid:true,definition};
  }catch{return bad('INVALID_CONFIRMATION');}
}
