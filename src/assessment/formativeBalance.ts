/** VAL-01/S7a — local, deterministic review of individual period evidence.
 * No grade/competence inference, generated prose, storage, publication or
 * institutional authority. The caller supplies the independent approved scope,
 * exact recipient and actual period dates. All inputs are detached first.
 */
import {validateAssessmentEvidenceV1} from './assessmentEvidence';
import type {AssessmentEvidenceV1,AssessmentScopeV1,IndividualEvidenceRevision,AssessmentDefinitionRevision,CriterionRevision,LearningReferenceRevision,RubricRevision} from './assessmentEvidence';
import {projectIndividualAssessmentEvidence} from './assessmentEvidenceProjection';
import {snapshotAssessmentData} from './assessmentRevisionBindings';

export interface FormativeBalanceContext {
 readonly classId:string;readonly schoolYear:string;readonly subjectCode:string;
 readonly studentId:string;readonly period:'Q1'|'Q2';readonly from:string;readonly to:string;
}
export interface FormativeComparison {readonly earlierRevisionId:string;readonly laterRevisionId:string}
export interface FormativeBalanceRequest {
 readonly evidenceRevisionIds:readonly string[];
 readonly comparisons:readonly FormativeComparison[];
 /** Written by the teacher, never synthesized by this module. */
 readonly teacherText:{readonly learning:string;readonly progress:string;readonly nextStep:string};
}
type ActiveEvidence=Exclude<IndividualEvidenceRevision,{state:'withdrawn'}>;
export interface BalanceSource {
 readonly evidence:ActiveEvidence;
 readonly assessment:AssessmentDefinitionRevision;
 readonly criterion:CriterionRevision;
 readonly targets:readonly LearningReferenceRevision[];
 readonly rubric:RubricRevision|null;
}
export interface FormativeBalancePreview {
 readonly context:FormativeBalanceContext;
 readonly request:FormativeBalanceRequest;
 readonly availableCount:number;
 readonly sources:readonly BalanceSource[];
 readonly comparisons:readonly (FormativeComparison&{readonly status:'matching-recorded-context';readonly conclusion:'teacher-review-required'})[];
 readonly basisDigest:string;
 readonly coverage:'undetermined';
}
type Issue='INVALID_DOCUMENT'|'INVALID_CONTEXT'|'INVALID_REQUEST'|'INVALID_SOURCE'|'INVALID_COMPARISON'|'NO_SOURCES'|'STALE_PREVIEW'|'INVALID_CONFIRMATION';
type Invalid={readonly valid:false;readonly issue:Issue};
export type FormativeBalanceReview=Invalid|{readonly valid:true;readonly preview:FormativeBalancePreview};
export type FormativeBalanceConfirmation=Invalid|{readonly valid:true;readonly balance:FormativeBalancePreview&{readonly confirmedByTeacher:true;readonly confirmedAt:string}};
type Row=Record<string,unknown>;
const fail=(issue:Issue):Invalid=>({valid:false,issue});
const id=(x:unknown):x is string=>typeof x==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(x);
const exact=(x:unknown,keys:readonly string[]):x is Row=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.prototype.hasOwnProperty.call(x,k));
const cmp=(a:string,b:string)=>a<b?-1:a>b?1:0;
function day(x:unknown):x is string{
 if(typeof x!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(x))return false;
 const n=Date.parse(x+'T00:00:00.000Z');return Number.isFinite(n)&&new Date(n).toISOString().slice(0,10)===x;
}
function instant(x:unknown):x is string{
 if(typeof x!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(x))return false;
 const n=Date.parse(x);return Number.isFinite(n)&&new Date(n).toISOString()===x;
}
function canonical(x:unknown):string{
 if(Array.isArray(x))return '['+x.map(canonical).join(',')+']';
 if(x!==null&&typeof x==='object')return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical((x as Row)[k])).join(',')+'}';
 return JSON.stringify(x)??'undefined';
}
async function digest(x:unknown):Promise<string>{
 const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical(x)));
 return Array.from(new Uint8Array(b),v=>v.toString(16).padStart(2,'0')).join('');
}
function validContext(x:unknown,s:AssessmentScopeV1):x is FormativeBalanceContext{
 return exact(x,['classId','schoolYear','subjectCode','studentId','period','from','to'])&&
 x.classId===s.classId&&x.schoolYear===s.schoolYear&&x.subjectCode===s.subjectCode&&
 typeof x.studentId==='string'&&s.studentIds.includes(x.studentId)&&(x.period==='Q1'||x.period==='Q2')&&
 day(x.from)&&day(x.to)&&x.from<=x.to&&x.from>=s.schoolYear.slice(0,4)+'-09-01'&&x.to<=s.schoolYear.slice(5)+'-08-31';
}
function validRequest(x:unknown):x is FormativeBalanceRequest{
 return exact(x,['evidenceRevisionIds','comparisons','teacherText'])&&Array.isArray(x.evidenceRevisionIds)&&
 x.evidenceRevisionIds.every(id)&&new Set(x.evidenceRevisionIds).size===x.evidenceRevisionIds.length&&
 Array.isArray(x.comparisons)&&x.comparisons.every(p=>exact(p,['earlierRevisionId','laterRevisionId'])&&id(p.earlierRevisionId)&&id(p.laterRevisionId))&&
 new Set(x.comparisons.map(p=>canonical(p))).size===x.comparisons.length&&
 exact(x.teacherText,['learning','progress','nextStep'])&&Object.values(x.teacherText).every(v=>typeof v==='string'&&v.length<=2000);
}
function source(d:AssessmentEvidenceV1,e:IndividualEvidenceRevision){
 const assessment=d.assessments.find(a=>a.revisionId===e.assessmentRevisionId)!;
 const criterion=d.criteria.find(c=>c.revisionId===e.criterionRevisionId)!;
 const binding=assessment.criteria.find(c=>c.criterionRevisionId===criterion.revisionId)!;
 const rubric=d.rubrics.find(r=>r.revisionId===binding.rubricRevisionId)??null;
 return {evidence:e,assessment,criterion,targets:criterion.targetReferenceRevisionIds.map(id=>d.references.find(r=>r.revisionId===id)!),rubric};
}
/** Conservative technical eligibility only: same exact frozen criterion,
 * rubric, expected task, purpose and recorded observation modalities. Two
 * distinct observed events on different dates; the teacher still determines
 * whether they are pedagogically comparable and what, if anything, changed.
 */
function matching(a:BalanceSource,b:BalanceSource):boolean{
 const x=a.evidence,y=b.evidence;
 if(x.state!=='observed'||y.state!=='observed'||x.observedOn>=y.observedOn||
 x.evidenceId===y.evidenceId||x.observationEventId===y.observationEventId||
 x.criterionRevisionId!==y.criterionRevisionId||a.rubric?.revisionId!==b.rubric?.revisionId||
 a.assessment.purpose!==b.assessment.purpose)return false;
 const ax=a.assessment.criteria.find(c=>c.criterionRevisionId===x.criterionRevisionId)!;
 const bx=b.assessment.criteria.find(c=>c.criterionRevisionId===y.criterionRevisionId)!;
 return canonical(ax.expected)===canonical(bx.expected)&&x.fact.kind===y.fact.kind&&
 x.fact.method===y.fact.method&&x.fact.support===y.fact.support&&x.fact.phase===y.fact.phase;
}
export async function prepareFormativeBalance(document:unknown,scope:unknown,context:unknown,request:unknown):Promise<FormativeBalanceReview>{
 try{
  const d=snapshotAssessmentData(document) as AssessmentEvidenceV1,s=snapshotAssessmentData(scope) as AssessmentScopeV1;
  const c=snapshotAssessmentData(context),r=snapshotAssessmentData(request);
  if(!validateAssessmentEvidenceV1(d,s).valid)return fail('INVALID_DOCUMENT');
  if(!validContext(c,s))return fail('INVALID_CONTEXT');
  if(!validRequest(r))return fail('INVALID_REQUEST');
  const projection=projectIndividualAssessmentEvidence(d,s,c.studentId);
  if(!projection.valid)return fail('INVALID_DOCUMENT');
  const inPeriod=(e:IndividualEvidenceRevision)=>e.studentId===c.studentId&&e.observedOn>=c.from&&e.observedOn<=c.to&&
   d.assessments.find(a=>a.revisionId===e.assessmentRevisionId)?.period===c.period;
  const active=new Set(projection.entries.map(e=>e.evidenceRevisionId));
  const available=d.evidence.filter(e=>active.has(e.revisionId)&&inPeriod(e));
  const selected=new Set(r.evidenceRevisionIds);
  if(r.evidenceRevisionIds.some(id=>!available.some(e=>e.revisionId===id)))return fail('INVALID_SOURCE');
  const sources=available.filter(e=>selected.has(e.revisionId)).sort((a,b)=>cmp(a.observedOn,b.observedOn)||cmp(a.revisionId,b.revisionId))
   .map(e=>source(d,e) as BalanceSource);
  const pairs:FormativeBalancePreview['comparisons'][number][]=[];
  for(const p of r.comparisons){
   const a=sources.find(e=>e.evidence.revisionId===p.earlierRevisionId),b=sources.find(e=>e.evidence.revisionId===p.laterRevisionId);
   if(!a||!b||!matching(a,b))return fail('INVALID_COMPARISON');
   pairs.push({...p,status:'matching-recorded-context',conclusion:'teacher-review-required'});
  }
  if((r.teacherText.learning.trim()||r.teacherText.nextStep.trim())&&!sources.some(e=>e.evidence.state==='observed'))return fail('NO_SOURCES');
  if(r.teacherText.progress.trim()&&!pairs.length)return fail('INVALID_COMPARISON');
  // Bind every relevant revision, including superseded and withdrawn sources,
  // and their frozen dependencies. Never return unselected facts or other
  // students' records; their changes do not invalidate this individual balance.
  const basis=d.evidence.filter(inPeriod).sort((a,b)=>cmp(a.revisionId,b.revisionId)).map(e=>source(d,e));
  const basisDigest=await digest({context:c,basis});
  return {valid:true,preview:{context:c,request:r,availableCount:available.length,sources,comparisons:pairs,basisDigest,coverage:'undetermined'}};
 }catch{return fail('INVALID_DOCUMENT');}
}
/** Recompute the review against the caller's current scope/recipient/period.
 * Confirmation is not persistence, certification, or permission to publish.
 */
export async function confirmFormativeBalance(document:unknown,scope:unknown,context:unknown,reviewed:unknown,confirmation:unknown):Promise<FormativeBalanceConfirmation>{
 try{
  const r=snapshotAssessmentData(reviewed),c=snapshotAssessmentData(confirmation);
  if(!exact(r,['context','request','availableCount','sources','comparisons','basisDigest','coverage']))return fail('STALE_PREVIEW');
  if(!exact(c,['confirmedByTeacher','confirmedAt'])||c.confirmedByTeacher!==true||!instant(c.confirmedAt))return fail('INVALID_CONFIRMATION');
  const fresh=await prepareFormativeBalance(document,scope,context,r.request);
  if(!fresh.valid)return fail('STALE_PREVIEW');
  if(canonical(r)!==canonical(fresh.preview))return fail('STALE_PREVIEW');
  if(!fresh.preview.sources.length)return fail('NO_SOURCES');
  const at=c.confirmedAt;
  if(fresh.preview.sources.some(s=>s.evidence.confirmedAt>at))return fail('INVALID_CONFIRMATION');
  return {valid:true,balance:{...fresh.preview,confirmedByTeacher:true,confirmedAt:at}};
 }catch{return fail('INVALID_CONFIRMATION');}
}
