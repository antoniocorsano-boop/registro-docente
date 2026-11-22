/** S7d.1: detached, append-only history proposal. NO Vault or backup wiring.
 * A verified S7c proposal is not a durable commit or authenticated consent.
 */
import type {ClassData,AppSettings} from '../types';
import type {FormativeBalanceCommitCandidateV1} from './formativeBalanceCommitPreflight';
import {recheckFormativeBalanceCommitPreflight} from './formativeBalanceCommitPreflight';
import {snapshotAssessmentData} from './assessmentRevisionBindings';

export interface FormativeBalanceHistoryEntryV1 {
 readonly id:string;
 readonly revision:number;
 readonly supersedes:string|null;
 readonly recordedAt:string;
 readonly candidate:FormativeBalanceCommitCandidateV1;
}
export interface FormativeBalanceHistoryV1 {
 readonly schemaVersion:1;
 readonly entries:readonly FormativeBalanceHistoryEntryV1[];
}
type Failure='INVALID_HISTORY'|'INVALID_REQUEST'|'CONFLICT'|'STALE_EVIDENCE';
export type FormativeHistoryProposal=
 | {readonly valid:false;readonly issue:Failure}
 | {readonly valid:true;readonly status:'proposed-not-persisted';readonly history:FormativeBalanceHistoryV1};
type Row=Record<string,unknown>;
const own=(x:object,k:string)=>Object.prototype.hasOwnProperty.call(x,k);
const exact=(x:unknown,ks:readonly string[]):x is Row=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
 Object.keys(x).length===ks.length&&ks.every(k=>own(x,k));
const instant=(x:unknown):x is string=>typeof x==='string'&&
 /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(x)&&
 Number.isFinite(Date.parse(x))&&new Date(x).toISOString()===x;
const identifier=(x:unknown):x is string=>typeof x==='string'&&
 /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(x);
const bad=(issue:Failure):{valid:false;issue:Failure}=>({valid:false,issue});
const historyKeys=['schemaVersion','entries'] as const;
const entryKeys=['id','revision','supersedes','recordedAt','candidate'] as const;
const candidateKeys=['schemaVersion','kind','state','context','evidenceRevisionIds','comparisons',
 'teacherText','basisDigest','sessionConfirmationAt'] as const;
const contextKeys=['classId','schoolYear','subjectCode','studentId','period','from','to'] as const;
const textKeys=['learning','progress','nextStep'] as const;
const comparisonKeys=['earlierRevisionId','laterRevisionId'] as const;
function candidateValid(v:unknown):v is FormativeBalanceCommitCandidateV1{
 if(!exact(v,candidateKeys)||v.schemaVersion!==1||v.kind!=='individual-formative-balance'||
    v.state!=='proposal-only-not-saved'||!exact(v.context,contextKeys)||
    !Object.values(v.context).every(x=>typeof x==='string')||
    !['Q1','Q2'].includes(v.context.period as string)||!exact(v.teacherText,textKeys)||
    !textKeys.every(k=>typeof (v.teacherText as Row)[k]==='string'&&
      ((v.teacherText as Row)[k] as string).length<=2000)||
    !Array.isArray(v.evidenceRevisionIds)||v.evidenceRevisionIds.length===0||
    !v.evidenceRevisionIds.every(identifier)||new Set(v.evidenceRevisionIds).size!==v.evidenceRevisionIds.length||
    !Array.isArray(v.comparisons)||!v.comparisons.every(x=>exact(x,comparisonKeys)&&
       identifier(x.earlierRevisionId)&&identifier(x.laterRevisionId))||
    typeof v.basisDigest!=='string'||!/^[a-f0-9]{64}$/.test(v.basisDigest)||
    !instant(v.sessionConfirmationAt))return false;
 return true;
}
function sameContext(a:FormativeBalanceCommitCandidateV1,b:FormativeBalanceCommitCandidateV1){
 const x=a.context,y=b.context;
 return x.classId===y.classId&&x.schoolYear===y.schoolYear&&x.subjectCode===y.subjectCode&&
  x.studentId===y.studentId&&x.period===y.period&&x.from===y.from&&x.to===y.to;
}
export function validateFormativeBalanceHistory(value:unknown):value is FormativeBalanceHistoryV1{
 try{
  const h=snapshotAssessmentData(value);
  if(!exact(h,historyKeys)||h.schemaVersion!==1||!Array.isArray(h.entries)||h.entries.length>10000)return false;
  const ids=new Set<string>(),last=new Map<string,{id:string;revision:number;recordedAt:string}>();
  for(const e of h.entries){
   if(!exact(e,entryKeys)||!identifier(e.id)||ids.has(e.id)||typeof e.revision!=='number'||!Number.isSafeInteger(e.revision)||
      e.revision<1||!instant(e.recordedAt)||!candidateValid(e.candidate)||
      e.recordedAt<e.candidate.sessionConfirmationAt)return false;
   const key=JSON.stringify(e.candidate.context),prev=last.get(key);
   if(prev){
    if(e.revision!==prev.revision+1||e.supersedes!==prev.id||e.recordedAt<prev.recordedAt)return false;
   }else if(e.revision!==1||e.supersedes!==null)return false;
   ids.add(e.id);last.set(key,{id:e.id,revision:e.revision,recordedAt:e.recordedAt});
  }
  return true;
 }catch{return false;}
}
/** Produces a complete detached replacement image only. A later qualified
 * storage adapter MUST compare against the current encrypted snapshot inside
 * the serialized write gate and verify the committed readback.
 */
export async function proposeFormativeBalanceHistoryAppend(
 currentClass:ClassData,settings:Pick<AppSettings,'year'|'subject'>|undefined,
 existing:unknown,candidate:unknown,
 request:{id:string;recordedAt:string;expectedPreviousId:string|null}
):Promise<FormativeHistoryProposal>{
 try{
  const h=snapshotAssessmentData(existing),c=snapshotAssessmentData(candidate);
  if(!validateFormativeBalanceHistory(h))return bad('INVALID_HISTORY');
  if(!candidateValid(c)||!exact(request,['id','recordedAt','expectedPreviousId'])||
    !identifier(request.id)||!instant(request.recordedAt)||
    (request.expectedPreviousId!==null&&!identifier(request.expectedPreviousId))||
    request.recordedAt<c.sessionConfirmationAt)return bad('INVALID_REQUEST');
  if(h.entries.some(x=>x.id===request.id))return bad('CONFLICT');
  const previous=[...h.entries].reverse().find(x=>sameContext(x.candidate,c));
  if((previous?.id??null)!==request.expectedPreviousId)return bad('CONFLICT');
  if(previous&&request.recordedAt<previous.recordedAt)return bad('CONFLICT');
  const recheck=await recheckFormativeBalanceCommitPreflight(currentClass,settings,c);
  if(!recheck.valid)return bad('STALE_EVIDENCE');
  const proposed={schemaVersion:1 as const,entries:[...h.entries,{
    id:request.id,revision:(previous?.revision??0)+1,supersedes:previous?.id??null,
    recordedAt:request.recordedAt,candidate:c
  }]};
  if(!validateFormativeBalanceHistory(proposed))return bad('INVALID_HISTORY');
  return {valid:true,status:'proposed-not-persisted',history:proposed};
 }catch{return bad('INVALID_REQUEST');}
}
