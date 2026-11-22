/** VAL-01/PRODUCT-05/S7c — read-only preflight for a future encrypted
 * teacher-authored balance record. This module deliberately neither commits
 * anything to the Vault nor changes ClassData, AppData or backup versions.
 *
 * The SHA-256 digest is a change detector, NOT authentication or a signature.
 * A later durable-write gate must independently prove local teacher consent,
 * encrypted commit+readback, conflict exclusion, backup and restore fidelity.
 */
import type {ClassData,AppSettings} from '../types';
import {snapshotAssessmentData} from './assessmentRevisionBindings';
import {loadStudentFormativeReviewSource} from './studentFormativeReviewSource';
import {prepareFormativeBalance,confirmFormativeBalance} from './formativeBalance';
import type {FormativeBalanceContext,FormativeBalanceRequest} from './formativeBalance';

export interface FormativeBalanceCommitCandidateV1 {
 readonly schemaVersion:1;
 readonly kind:'individual-formative-balance';
 readonly state:'proposal-only-not-saved';
 readonly context:FormativeBalanceContext;
 readonly evidenceRevisionIds:readonly string[];
 readonly comparisons:FormativeBalanceRequest['comparisons'];
 readonly teacherText:FormativeBalanceRequest['teacherText'];
 readonly basisDigest:string;
 readonly sessionConfirmationAt:string;
}
type Issue='INVALID_CONFIRMATION'|'UNVERIFIED_ARCHIVE'|'STALE_EVIDENCE'|'INVALID_CANDIDATE';
type Rejected={readonly valid:false;readonly issue:Issue};
export type FormativeBalanceCommitPreflight=
 | Rejected
 | {readonly valid:true;readonly state:'verified-no-write';readonly candidate:FormativeBalanceCommitCandidateV1};
export type FormativeBalanceCommitRecheck=
 | Rejected
 | {readonly valid:true;readonly state:'verified-no-write'};
type Row=Record<string,unknown>;
const invalid=(issue:Issue):Rejected=>({valid:false,issue});
const keys=(x:unknown,expected:readonly string[]):x is Row=>
 x!==null&&typeof x==='object'&&!Array.isArray(x)&&
 Object.keys(x).length===expected.length&&expected.every(k=>Object.prototype.hasOwnProperty.call(x,k));
const confirmationKeys=['context','request','availableCount','sources','comparisons',
 'basisDigest','basisLatestConfirmedAt','coverage','confirmedByTeacher','confirmedAt'] as const;
const candidateKeys=['schemaVersion','kind','state','context','evidenceRevisionIds',
 'comparisons','teacherText','basisDigest','sessionConfirmationAt'] as const;
const contextKeys=['classId','schoolYear','subjectCode','studentId','period','from','to'] as const;

/** Prove the actual S7 confirmation against the current independently scoped
 * archive, not against a caller-provided document or an old UI snapshot.
 * Project ONLY whitelisted metadata needed by a future storage proposal.
 */
export async function prepareFormativeBalanceCommitPreflight(
 currentClass:ClassData,settings:Pick<AppSettings,'year'|'subject'>|undefined,
 confirmed:unknown
):Promise<FormativeBalanceCommitPreflight>{
 try{
  const receipt=snapshotAssessmentData(confirmed);
  if(!keys(receipt,confirmationKeys)||receipt.confirmedByTeacher!==true||
     !keys(receipt.context,contextKeys))return invalid('INVALID_CONFIRMATION');
  const c=receipt.context;
  if(typeof c.studentId!=='string'||typeof c.from!=='string'||typeof c.to!=='string'||
     (c.period!=='Q1'&&c.period!=='Q2'))return invalid('INVALID_CONFIRMATION');
  const current=loadStudentFormativeReviewSource(currentClass,settings,
    c.studentId,c.period,c.from,c.to);
  if(current.status!=='ready')return invalid('UNVERIFIED_ARCHIVE');
  const {confirmedByTeacher,confirmedAt,...reviewed}=receipt;
  const refreshed=await confirmFormativeBalance(current.document,current.scope,c,
    reviewed,{confirmedByTeacher,confirmedAt});
  if(!refreshed.valid)return invalid('STALE_EVIDENCE');
  const b=refreshed.balance;
  const request=b.request;
  // The candidate deliberately excludes sources, raw notes, rubric internals,
  // student names, unrelated roster, inferred levels and the preview itself.
  return {valid:true,state:'verified-no-write',candidate:{
    schemaVersion:1,kind:'individual-formative-balance',state:'proposal-only-not-saved',
    context:{...b.context},
    evidenceRevisionIds:[...request.evidenceRevisionIds],
    comparisons:request.comparisons.map(p=>({earlierRevisionId:p.earlierRevisionId,
      laterRevisionId:p.laterRevisionId})),
    teacherText:{learning:request.teacherText.learning,progress:request.teacherText.progress,
      nextStep:request.teacherText.nextStep},
    basisDigest:b.basisDigest,sessionConfirmationAt:b.confirmedAt
  }};
 }catch{return invalid('INVALID_CONFIRMATION');}
}

/** A separate read-time conflict check for the projected candidate.
 * This is intentionally insufficient to grant a write or export: the result
 * can only be consumed by a separately qualified encrypted storage protocol.
 */
export async function recheckFormativeBalanceCommitPreflight(
 currentClass:ClassData,settings:Pick<AppSettings,'year'|'subject'>|undefined,
 candidate:unknown
):Promise<FormativeBalanceCommitRecheck>{
 try{
  const v=snapshotAssessmentData(candidate);
  if(!keys(v,candidateKeys)||v.schemaVersion!==1||
     v.kind!=='individual-formative-balance'||v.state!=='proposal-only-not-saved'||
     !keys(v.context,contextKeys)||typeof v.basisDigest!=='string'||
     !/^[a-f0-9]{64}$/.test(v.basisDigest)||
     typeof v.sessionConfirmationAt!=='string')return invalid('INVALID_CANDIDATE');
  const c=v.context;
  if(typeof c.studentId!=='string'||typeof c.from!=='string'||typeof c.to!=='string'||
     (c.period!=='Q1'&&c.period!=='Q2'))return invalid('INVALID_CANDIDATE');
  const current=loadStudentFormativeReviewSource(currentClass,settings,
    c.studentId,c.period,c.from,c.to);
  if(current.status!=='ready')return invalid('UNVERIFIED_ARCHIVE');
  const request={evidenceRevisionIds:v.evidenceRevisionIds,
    comparisons:v.comparisons,teacherText:v.teacherText};
  const r=await prepareFormativeBalance(current.document,current.scope,c,request);
  if(!r.valid||r.preview.basisDigest!==v.basisDigest||!r.preview.sources.length)
    return invalid('STALE_EVIDENCE');
  const confirmation=await confirmFormativeBalance(current.document,current.scope,
    c,r.preview,{confirmedByTeacher:true,confirmedAt:v.sessionConfirmationAt});
  return confirmation.valid?{valid:true,state:'verified-no-write'}:invalid('STALE_EVIDENCE');
 }catch{return invalid('INVALID_CANDIDATE');}
}
