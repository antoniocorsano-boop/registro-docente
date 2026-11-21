/** VAL-01/PRODUCT-03 — teacher-authored first-run proof and frozen criteria.
 * No I/O, AI, grade inference or new persistence authority. Both historical
 * S5b preparation and S6a completion contracts are reused and revalidated
 * inside the application's existing encrypted mutation queue.
 */
import type {AppData,ClassData,AppSettings} from '../types';
import type {AssessmentEvidenceV1,AssessmentScopeV1,AssessmentPurpose,EvidenceKind,LearningReferenceRevision,CriterionRevision} from './assessmentEvidence';
import {validateAssessmentEvidenceV1} from './assessmentEvidence';
import {validateAssessmentArchiveV1,type ApprovedAssessmentScope,type AssessmentArchiveV1} from './assessmentArchive';
import {snapshotAssessmentData} from './assessmentRevisionBindings';
import {previewAssessmentDefinition,confirmAssessmentDefinition} from './assessmentDefinitionPreparation';
import {previewAssessmentCompletion,confirmAssessmentCompletion} from './assessmentCompletion';

export interface AssessmentSetupCriterion{
 readonly criterionId:string;readonly revisionId:string;
 readonly description:string;
 readonly expected:{readonly kind:EvidenceKind;readonly description:string;readonly method:string};
}
export interface AssessmentSetupRequest{
 readonly activityId:string;readonly assessmentId:string;
 readonly plannedRevisionId:string;readonly completedRevisionId:string;
 readonly objectiveId:string;readonly objectiveRevisionId:string;
 readonly title:string;readonly date:string;readonly period:'Q1'|'Q2';readonly purpose:AssessmentPurpose;
 readonly objectiveText:string;readonly criteria:readonly AssessmentSetupCriterion[];
 readonly preparedAt:string;
}
export interface AssessmentSetupReview{
 readonly scope:AssessmentScopeV1;
 /** The exact frozen baseline (null denotes an absent, not malformed, archive). */
 readonly baseDocument:AssessmentEvidenceV1|null;
 readonly request:AssessmentSetupRequest;
}
export type AssessmentSetupResult=
 | {readonly valid:false;readonly issue:'INVALID_CONTEXT'|'INVALID_PROOF'}
 | {readonly valid:true;readonly review:AssessmentSetupReview};
const fail=():AssessmentSetupResult=>({valid:false,issue:'INVALID_PROOF'});
const sameScope=(a:ApprovedAssessmentScope,b:ApprovedAssessmentScope)=>
 a.classId===b.classId&&a.schoolYear===b.schoolYear&&a.subjectCode===b.subjectCode;
const unique=(xs:readonly string[])=>new Set(xs).size===xs.length;
const validId=(v:string)=>/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(v);
const validInstant=(v:string)=>/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v)&&
 Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
const validDate=(d:string,year:string)=>/^\d{4}-\d\d-\d\d$/.test(d)&&Number.isFinite(Date.parse(d+'T00:00:00Z'))&&
 new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d&&
 d>=year.slice(0,4)+'-09-01'&&d<=year.slice(5)+'-08-31';
const prose=(x:string)=>typeof x==='string'&&x.trim().length>0&&x.length<=2000;

function emptyDocument(s:AssessmentScopeV1):AssessmentEvidenceV1{
 return {version:1,classId:s.classId,schoolYear:s.schoolYear,subjectCode:s.subjectCode,
  references:[],criteria:[],rubrics:[],assessments:[],evidence:[]};
}
function extract(c:ClassData,s:AssessmentScopeV1):AssessmentEvidenceV1|null{
 const field=Object.getOwnPropertyDescriptor(c,'assessmentEvidenceV1');
 if(!field)return null;
 if(!('value' in field))throw Error('Invalid archive');
 const envelope=field.value as AssessmentArchiveV1;
 const matches=envelope.documents.filter(d=>sameScope(d.document,s));
 if(matches.length!==1)throw Error('No unique document');
 return snapshotAssessmentData(matches[0].document) as AssessmentEvidenceV1;
}
function validateRequest(r:AssessmentSetupRequest,s:AssessmentScopeV1){
 const ids=[r.activityId,r.assessmentId,r.plannedRevisionId,r.completedRevisionId,
  r.objectiveId,r.objectiveRevisionId,...r.criteria.flatMap(c=>[c.criterionId,c.revisionId])];
 if(!ids.every(validId)||!unique(ids)||!validInstant(r.preparedAt)||!validDate(r.date,s.schoolYear)||
  !prose(r.title)||!prose(r.objectiveText)||
  !['Q1','Q2'].includes(r.period)||!['diagnostic','formative','summative'].includes(r.purpose)||
  !Array.isArray(r.criteria)||r.criteria.length<1||r.criteria.length>4)return false;
 return r.criteria.every(c=>prose(c.description)&&
  ['process','product','performance','argumentation'].includes(c.expected.kind)&&
  prose(c.expected.description)&&prose(c.expected.method));
}
/** Build a detached candidate using S5b + S6a, not a direct ad hoc definition.
 * Confirmation is an explicit later operation; the preview is never persisted.
 */
function build(
 base:AssessmentEvidenceV1,scope:AssessmentScopeV1,
 request:AssessmentSetupRequest,confirmedAt:string
):AssessmentEvidenceV1{
 if(!validateRequest(request,scope)||!validInstant(confirmedAt)||confirmedAt<request.preparedAt)
  throw Error('Invalid request');
 const common={confirmedByTeacher:true as const,confirmedAt};
 const source={kind:'local' as const,sourceVersion:'manual-v1'};
 const objective:LearningReferenceRevision={...common,referenceId:request.objectiveId,
  revisionId:request.objectiveRevisionId,kind:'specific-objective',
  text:request.objectiveText.trim(),source};
 const criteria:CriterionRevision[]=request.criteria.map(c=>({...common,criterionId:c.criterionId,
  revisionId:c.revisionId,description:c.description.trim(),
  targetReferenceRevisionIds:[objective.revisionId],contextualReferenceRevisionIds:[]}));
 const withSources:AssessmentEvidenceV1={...base,references:[...base.references,objective],
  criteria:[...base.criteria,...criteria]};
 if(!validateAssessmentEvidenceV1(withSources,scope).valid)throw Error('Invalid references');
 const preparation=previewAssessmentDefinition(withSources,scope,{
  activityId:request.activityId,assessmentId:request.assessmentId,revisionId:request.plannedRevisionId,
  date:request.date,period:request.period,title:request.title.trim(),purpose:request.purpose,
  criteria:request.criteria.map(c=>({criterionRevisionId:c.revisionId,
   expected:{kind:c.expected.kind,description:c.expected.description.trim(),method:c.expected.method.trim()}}))
 });
 if(!preparation.valid)throw Error('Invalid preparation');
 const planned=confirmAssessmentDefinition(withSources,scope,preparation.preview,common);
 if(!planned.valid)throw Error('Invalid planned proof');
 const withPlanned:AssessmentEvidenceV1={...withSources,assessments:[...withSources.assessments,planned.definition]};
 const completion=previewAssessmentCompletion(withPlanned,scope,{
  assessmentRevisionId:planned.definition.revisionId,revisionId:request.completedRevisionId,
  completedOn:request.date
 });
 if(!completion.valid)throw Error('Invalid completion preview');
 const completed=confirmAssessmentCompletion(withPlanned,scope,completion.preview,common);
 if(!completed.valid)throw Error('Invalid completion confirmation');
 const final:AssessmentEvidenceV1={...withPlanned,assessments:[...withPlanned.assessments,completed.definition]};
 if(!validateAssessmentEvidenceV1(final,scope).valid)throw Error('Invalid final proof');
 return final;
}
export function previewDailyAssessmentSetup(c:ClassData,
 settings:Pick<AppSettings,'year'|'subject'>|undefined,raw:AssessmentSetupRequest
):AssessmentSetupResult{
 try{
  if(!settings?.year||!settings?.subject)return {valid:false,issue:'INVALID_CONTEXT'};
  const scope:AssessmentScopeV1={classId:c.id,schoolYear:settings.year,
   subjectCode:settings.subject,studentIds:c.students.map(s=>s.id)};
  const approved={classId:scope.classId,schoolYear:scope.schoolYear,subjectCode:scope.subjectCode};
  if(!unique(scope.studentIds)||!validateAssessmentArchiveV1({classes:[c]},[approved]).valid)
   return {valid:false,issue:'INVALID_CONTEXT'};
  const base=extract(c,scope);
  const request=snapshotAssessmentData(raw) as AssessmentSetupRequest;
  build(base??emptyDocument(scope),scope,request,request.preparedAt);
  return {valid:true,review:{scope,baseDocument:base,request}};
 }catch{return fail();}
}
/** Reruns validation inside the durable queue on the latest committed state.
 * No archive overwrite, repair or migration; first creation is an explicit
 * classroom action, not a conversion of historical grades.
 */
export function deriveConfirmedDailyAssessmentSetup(
 current:AppData,approvedScopes:readonly ApprovedAssessmentScope[],
 reviewed:AssessmentSetupReview,
 confirmation:{readonly confirmedByTeacher:true;readonly confirmedAt:string}
):AppData{
 const reject=()=>Error('Prova non registrata: contesto o conferma cambiati.');
 try{
  const app=snapshotAssessmentData(current) as AppData;
  const review=snapshotAssessmentData(reviewed) as AssessmentSetupReview;
  const approved=snapshotAssessmentData(approvedScopes) as ApprovedAssessmentScope[];
  const confirmed=snapshotAssessmentData(confirmation) as typeof confirmation;
  if(!confirmed||confirmed.confirmedByTeacher!==true||
    !validateAssessmentArchiveV1(app,approved).valid||
    !approved.some(s=>sameScope(s,review.scope))||app.currentClassId!==review.scope.classId)
   throw reject();
  const c=app.classes.find(c=>c.id===review.scope.classId);
  if(!c||JSON.stringify(c.students.map(s=>s.id))!==JSON.stringify(review.scope.studentIds))
   throw reject();
  const original=extract(c,review.scope);
  if(JSON.stringify(original)!==JSON.stringify(review.baseDocument))throw reject();
  const output=build(original??emptyDocument(review.scope),review.scope,
   review.request,confirmed.confirmedAt);
  const previous=c.assessmentEvidenceV1;
  const nextArchive:AssessmentArchiveV1=previous?{
   ...previous,documents:previous.documents.map(section=>
     sameScope(section.document,review.scope)?{...section,document:output}:section)
  }:{version:1,documents:[{document:output,bindings:[]}]};
  const next:AppData={...app,classes:app.classes.map(one=>one.id===c.id?
   {...one,assessmentEvidenceV1:nextArchive}:one)};
  if(!validateAssessmentArchiveV1(next,approved).valid)throw reject();
  return next;
 }catch{throw reject();}
}
