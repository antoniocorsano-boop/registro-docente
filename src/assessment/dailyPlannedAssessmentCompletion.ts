/** VAL-01/PRODUCT-04 — a separate, explicit teacher completion of a
 * previously planned proof. This module never saves or creates evidence.
 * It shares the S6a validator, V1 archive and atomic App coordinator.
 */
import type {AppData,ClassData,AppSettings} from '../types';
import type {AssessmentEvidenceV1,AssessmentScopeV1} from './assessmentEvidence';
import {validateAssessmentArchiveV1,type ApprovedAssessmentScope} from './assessmentArchive';
import {previewAssessmentCompletion,confirmAssessmentCompletion,type AssessmentCompletionPreview} from './assessmentCompletion';
import {snapshotAssessmentData} from './assessmentRevisionBindings';
import {approvedAssessmentSubjectCodes,resolveAssessmentSubjectCode,selectUniqueAssessmentDocument} from './assessmentSubjectScope';
import {canonicalAssessmentSchoolYear} from './assessmentSchoolYear';

type Settings=Pick<AppSettings,'year'|'subject'>|undefined;
export interface PlannedProofOption {readonly revisionId:string;readonly title:string;readonly scheduledFor:string;readonly criteriaCount:number}
export type PlannedProofs= {readonly status:'absent'|'unverified'}|
 {readonly status:'ready';readonly scope:AssessmentScopeV1;readonly document:AssessmentEvidenceV1;readonly proofs:readonly PlannedProofOption[]};
export interface PlannedCompletionReview{
 readonly scope:AssessmentScopeV1;
 readonly baseDocument:AssessmentEvidenceV1;
 readonly preview:AssessmentCompletionPreview;
}
export type PlannedCompletionResult={readonly valid:false}|{readonly valid:true;readonly review:PlannedCompletionReview};
const approvedScope=(scope:AssessmentScopeV1):ApprovedAssessmentScope=>({
 classId:scope.classId,schoolYear:scope.schoolYear,subjectCode:scope.subjectCode});
const same=(a:ApprovedAssessmentScope,b:ApprovedAssessmentScope)=>a.classId===b.classId&&
 a.schoolYear===b.schoolYear&&a.subjectCode===b.subjectCode;
const status=():PlannedCompletionResult=>({valid:false});
function lookup(c:ClassData,scope:AssessmentScopeV1):AssessmentEvidenceV1{
 const field=Object.getOwnPropertyDescriptor(c,'assessmentEvidenceV1');
 if(!field||!('value' in field))throw Error('Missing document');
 const document=selectUniqueAssessmentDocument(c.assessmentEvidenceV1!.documents.map(part=>part.document),scope);
 if(!document||document.subjectCode!==scope.subjectCode)throw Error('Missing or changed document identity');
 return snapshotAssessmentData(document) as AssessmentEvidenceV1;
}
export function listDailyPlannedProofs(c:ClassData,settings:Settings,
 approvedScopes?:readonly ApprovedAssessmentScope[]):PlannedProofs{
 try{
  if(!settings?.year||!settings.subject)return {status:'unverified'};
  const subjectCode=resolveAssessmentSubjectCode(settings.subject);
  const schoolYear=canonicalAssessmentSchoolYear(settings.year);
  if(!subjectCode||!schoolYear)return {status:'unverified'};
  const scope:AssessmentScopeV1={classId:c.id,schoolYear,subjectCode,
   studentIds:c.students.map(s=>s.id)};
  if(new Set(scope.studentIds).size!==scope.studentIds.length)return {status:'unverified'};
  const authorized=approvedScopes??approvedAssessmentSubjectCodes(subjectCode).map(code=>({...approvedScope(scope),subjectCode:code}));
  if(!authorized.some(s=>same(s,approvedScope(scope))))return {status:'unverified'};
  const verified=validateAssessmentArchiveV1({classes:[c]},
   authorized.filter(s=>s.classId===c.id));
  if(!verified.valid)return {status:'unverified'};
  if(verified.state==='absent')return {status:'absent'};
  const selected=selectUniqueAssessmentDocument(c.assessmentEvidenceV1!.documents.map(section=>section.document),scope);
  if(!selected)return {status:'absent'};
  const document=snapshotAssessmentData(selected) as AssessmentEvidenceV1;
  const documentScope:AssessmentScopeV1={...scope,subjectCode:document.subjectCode};
  const proofs=document.assessments.filter(a=>a.status==='planned'&&
   !document.assessments.some(next=>next.supersedesRevisionId===a.revisionId))
    .map(a=>({revisionId:a.revisionId,title:a.title,scheduledFor:a.date,criteriaCount:a.criteria.length}));
  return {status:'ready',scope:documentScope,document,proofs};
 }catch{return {status:'unverified'};}
}
export function previewDailyPlannedCompletion(c:ClassData,settings:Settings,request:{
 readonly assessmentRevisionId:string;readonly revisionId:string;readonly completedOn:string
},approvedScopes?:readonly ApprovedAssessmentScope[]):PlannedCompletionResult{
 const result=listDailyPlannedProofs(c,settings,approvedScopes);
 if(result.status!=='ready'||!result.proofs.some(p=>p.revisionId===request.assessmentRevisionId))return status();
 const preview=previewAssessmentCompletion(result.document,result.scope,request);
 if(!preview.valid)return status();
 return {valid:true,review:{scope:result.scope,
  baseDocument:snapshotAssessmentData(result.document) as AssessmentEvidenceV1,
  preview:preview.preview}};
}
/** Repeat all checks inside the same durable write queue as daily marks.
 * Exact full-document equality prevents erasing intervening observations,
 * edits or another completion from the previously approved snapshot.
 */
export function deriveConfirmedDailyPlannedCompletion(
 current:AppData,approvedScopes:readonly ApprovedAssessmentScope[],
 reviewed:PlannedCompletionReview,
 confirmation:{readonly confirmedByTeacher:true;readonly confirmedAt:string}
):AppData{
 try{
  const state=snapshotAssessmentData(current) as AppData;
  const scopes=snapshotAssessmentData(approvedScopes) as ApprovedAssessmentScope[];
  const r=snapshotAssessmentData(reviewed) as PlannedCompletionReview;
  const c=snapshotAssessmentData(confirmation) as typeof confirmation;
  if(c?.confirmedByTeacher!==true||!validateAssessmentArchiveV1(state,scopes).valid||
    !scopes.some(s=>same(s,approvedScope(r.scope)))||
    state.currentClassId!==r.scope.classId)throw Error('Incompatible request');
  const klass=state.classes.find(k=>k.id===r.scope.classId);
  if(!klass||JSON.stringify(klass.students.map(s=>s.id))!==JSON.stringify(r.scope.studentIds))
    throw Error('Changed roster');
  const original=lookup(klass,r.scope);
  if(JSON.stringify(original)!==JSON.stringify(r.baseDocument))throw Error('Stale document');
  const completed=confirmAssessmentCompletion(original,r.scope,r.preview,c);
  if(!completed.valid)throw Error('Not confirmed');
  const documents=klass.assessmentEvidenceV1!.documents.map(section=>
   same(section.document,r.scope)?
    {...section,document:{...original,assessments:[...original.assessments,completed.definition]}}:section);
  const updated:AppData={...state,classes:state.classes.map(one=>one.id!==klass.id?one:{
   ...one,assessmentEvidenceV1:{...klass.assessmentEvidenceV1!,documents}})};
  if(!validateAssessmentArchiveV1(updated,scopes).valid)throw Error('Invalid archive');
  return updated;
 }catch{throw Error('Prova non conclusa: verifica la situazione aggiornata.');}
}
