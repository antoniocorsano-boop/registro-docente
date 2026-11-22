/** VAL-01/PRODUCT-05/S7d1 — immutable, scope-checked history proposal.
 * This is NOT a Vault serializer, an authorized commit, an export codec, or a
 * signature. Existing V6/V7/V8/V9 backups MUST reject this future domain.
 * Existing historical evidence remains historical even if later withdrawn.
 */
import type {AppSettings,ClassData} from '../types';
import type {AssessmentScopeV1} from './assessmentEvidence';
import type {FormativeBalanceContext,FormativeBalanceRequest} from './formativeBalance';
import type {FormativeBalanceCommitCandidateV1} from './formativeBalanceCommitPreflight';
import {recheckFormativeBalanceCommitPreflight} from './formativeBalanceCommitPreflight';
import {loadStudentFormativeReviewSource} from './studentFormativeReviewSource';
import {snapshotAssessmentData} from './assessmentRevisionBindings';

export interface FormativeBalanceHistoryRecordV1 {
 readonly schemaVersion:1;
 readonly kind:'teacher-authored-formative-balance';
 readonly id:string;
 readonly context:FormativeBalanceContext;
 readonly revision:number;
 readonly supersedesRecordId:string|null;
 readonly previousDigest:string|null;
 readonly confirmedByTeacher:true;
 readonly confirmedAt:string;
 readonly recordedAt:string;
 readonly evidenceRevisionIds:readonly string[];
 readonly comparisons:FormativeBalanceRequest['comparisons'];
 readonly teacherText:FormativeBalanceRequest['teacherText'];
 readonly basisDigest:string;
 readonly contentDigest:string;
}
export interface FormativeBalanceHistoryV1 {
 readonly version:1;
 readonly classId:string;
 readonly schoolYear:string;
 readonly subjectCode:string;
 readonly records:readonly FormativeBalanceHistoryRecordV1[];
}
export type HistoryGateIssue='INVALID_SCOPE'|'INVALID_HISTORY'|'INVALID_PROPOSAL'|
 'STALE_EVIDENCE'|'DUPLICATE_RECORD'|'INVALID_CLOCK';
type Rejected={readonly valid:false;readonly issue:HistoryGateIssue};
export type HistoryValidation=Rejected|{readonly valid:true;readonly history:FormativeBalanceHistoryV1};
export type HistoryAppendProposal=Rejected|{readonly valid:true;
 readonly state:'proposed-not-saved';readonly history:FormativeBalanceHistoryV1;
 readonly record:FormativeBalanceHistoryRecordV1};
type Row=Record<string,unknown>;
const fail=(issue:HistoryGateIssue):Rejected=>({valid:false,issue});
const idPattern=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const shaPattern=/^[a-f0-9]{64}$/;
const isoDate=/^\d{4}-\d{2}-\d{2}$/;
const isoInstant=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const envelopeKeys=['version','classId','schoolYear','subjectCode','records'] as const;
const contextKeys=['classId','schoolYear','subjectCode','studentId','period','from','to'] as const;
const recordKeys=['schemaVersion','kind','id','context','revision','supersedesRecordId',
 'previousDigest','confirmedByTeacher','confirmedAt','recordedAt','evidenceRevisionIds',
 'comparisons','teacherText','basisDigest','contentDigest'] as const;
const textKeys=['learning','progress','nextStep'] as const;
const pairKeys=['earlierRevisionId','laterRevisionId'] as const;
const scopeKeys=['classId','schoolYear','subjectCode','studentIds'] as const;
const maxRecords=5000;
const exact=(v:unknown,expected:readonly string[]):v is Row=>
 v!==null&&typeof v==='object'&&!Array.isArray(v)&&
 Object.keys(v).length===expected.length&&expected.every(k=>
  Object.prototype.hasOwnProperty.call(v,k));
function date(v:unknown):v is string{
 if(typeof v!=='string'||!isoDate.test(v))return false;
 const t=Date.parse(v+'T12:00:00.000Z');
 return Number.isFinite(t)&&new Date(t).toISOString().slice(0,10)===v;
}
function instant(v:unknown):v is string{
 if(typeof v!=='string'||!isoInstant.test(v))return false;
 const t=Date.parse(v);
 return Number.isFinite(t)&&new Date(t).toISOString()===v;
}
function year(v:unknown):v is string{
 if(typeof v!=='string'||!/^\d{4}\/\d{4}$/.test(v))return false;
 return Number(v.slice(5))===Number(v.slice(0,4))+1;
}
function approved(raw:unknown):raw is AssessmentScopeV1{
 if(!exact(raw,scopeKeys)||!idPattern.test(String(raw.classId))||
    !year(raw.schoolYear)||!idPattern.test(String(raw.subjectCode))||
    !Array.isArray(raw.studentIds)||raw.studentIds.length>10000)return false;
 const roster=raw.studentIds;
 return roster.every(v=>typeof v==='string'&&idPattern.test(v))&&
   new Set(roster).size===roster.length;
}
function contextValid(raw:unknown,scope:AssessmentScopeV1):raw is FormativeBalanceContext{
 if(!exact(raw,contextKeys))return false;
 if(raw.classId!==scope.classId||raw.schoolYear!==scope.schoolYear||
    raw.subjectCode!==scope.subjectCode||typeof raw.studentId!=='string'||
    !scope.studentIds.includes(raw.studentId)||
    (raw.period!=='Q1'&&raw.period!=='Q2')||
    !date(raw.from)||!date(raw.to))return false;
 const start=scope.schoolYear.slice(0,4)+'-09-01',end=scope.schoolYear.slice(5)+'-08-31';
 return raw.from>=start&&raw.to<=end&&raw.from<=raw.to;
}
function requestValid(r:Row):boolean{
 const ids=r.evidenceRevisionIds;
 if(!Array.isArray(ids)||ids.length<1||ids.length>2000||
    !ids.every(x=>typeof x==='string'&&idPattern.test(x))||
    new Set(ids).size!==ids.length)return false;
 const comparisons=r.comparisons;
 if(!Array.isArray(comparisons)||comparisons.length>1000)return false;
 const pairSet=new Set<string>();
 for(const p of comparisons){
  if(!exact(p,pairKeys)||typeof p.earlierRevisionId!=='string'||
     typeof p.laterRevisionId!=='string'||p.earlierRevisionId===p.laterRevisionId||
     !ids.includes(p.earlierRevisionId)||!ids.includes(p.laterRevisionId))return false;
  const key=JSON.stringify([p.earlierRevisionId,p.laterRevisionId]);
  if(pairSet.has(key))return false;
  pairSet.add(key);
 }
 if(!exact(r.teacherText,textKeys))return false;
 const text=r.teacherText;
 return textKeys.every(k=>typeof text[k]==='string'&&text[k].length<=2000)&&
   textKeys.some(k=>(text[k] as string).trim().length>0);
}
function recordValid(raw:unknown,scope:AssessmentScopeV1):raw is FormativeBalanceHistoryRecordV1{
 if(!exact(raw,recordKeys)||raw.schemaVersion!==1||
    raw.kind!=='teacher-authored-formative-balance'||
    typeof raw.id!=='string'||!idPattern.test(raw.id)||
    !contextValid(raw.context,scope)||
    !Number.isSafeInteger(raw.revision)||Number(raw.revision)<1||
    (raw.supersedesRecordId!==null&&
     (typeof raw.supersedesRecordId!=='string'||!idPattern.test(raw.supersedesRecordId)))||
    (raw.previousDigest!==null&&
     (typeof raw.previousDigest!=='string'||!shaPattern.test(raw.previousDigest)))||
    raw.confirmedByTeacher!==true||!instant(raw.confirmedAt)||
    !instant(raw.recordedAt)||raw.recordedAt<raw.confirmedAt||
    typeof raw.basisDigest!=='string'||!shaPattern.test(raw.basisDigest)||
    typeof raw.contentDigest!=='string'||!shaPattern.test(raw.contentDigest))return false;
 return requestValid(raw);
}
function group(c:FormativeBalanceContext):string{
 return JSON.stringify([c.classId,c.schoolYear,c.subjectCode,c.studentId,c.period]);
}
function tuple(r:Omit<FormativeBalanceHistoryRecordV1,'contentDigest'>):unknown[]{
 return ['VAL-01/S7d1/history-v1',r.schemaVersion,r.kind,r.id,
  r.context.classId,r.context.schoolYear,r.context.subjectCode,r.context.studentId,
  r.context.period,r.context.from,r.context.to,r.revision,r.supersedesRecordId,
  r.previousDigest,r.confirmedByTeacher,r.confirmedAt,r.recordedAt,
  [...r.evidenceRevisionIds],
  r.comparisons.map(x=>[x.earlierRevisionId,x.laterRevisionId]),
  [r.teacherText.learning,r.teacherText.progress,r.teacherText.nextStep],r.basisDigest];
}
async function digest(record:Omit<FormativeBalanceHistoryRecordV1,'contentDigest'>):Promise<string>{
 const raw=new TextEncoder().encode(JSON.stringify(tuple(record)));
 const hashed=await crypto.subtle.digest('SHA-256',raw);
 return Array.from(new Uint8Array(hashed),v=>v.toString(16).padStart(2,'0')).join('');
}

/** Read and validate a detached historical chain, with independent approved
 * scope/roster. Later withdrawal of an observation does not erase a history
 * previously confirmed and preserved with its earlier source digest.
 */
export async function validateFormativeBalanceHistoryV1(
 source:unknown,approvedScope:unknown
):Promise<HistoryValidation>{
 try{
  const scope=snapshotAssessmentData(approvedScope);
  const archive=snapshotAssessmentData(source);
  if(!approved(scope)||!exact(archive,envelopeKeys)||archive.version!==1||
     archive.classId!==scope.classId||archive.schoolYear!==scope.schoolYear||
     archive.subjectCode!==scope.subjectCode||!Array.isArray(archive.records)||
     archive.records.length>maxRecords)return fail('INVALID_HISTORY');
  const ids=new Set<string>(),last=new Map<string,FormativeBalanceHistoryRecordV1>();
  for(const raw of archive.records){
   if(!recordValid(raw,scope))return fail('INVALID_HISTORY');
   const item=raw as FormativeBalanceHistoryRecordV1;
   if(ids.has(item.id))return fail('INVALID_HISTORY');
   ids.add(item.id);
   const previous=last.get(group(item.context));
   if(item.revision!==(previous?previous.revision+1:1)||
      item.supersedesRecordId!==(previous?previous.id:null)||
      item.previousDigest!==(previous?previous.contentDigest:null)||
      (previous&&(item.recordedAt<previous.recordedAt||
        item.confirmedAt===previous.confirmedAt)))return fail('INVALID_HISTORY');
   const {contentDigest:_,...unsigned}=item;
   if(await digest(unsigned)!==item.contentDigest)return fail('INVALID_HISTORY');
   last.set(group(item.context),item);
  }
  return {valid:true,history:archive as unknown as FormativeBalanceHistoryV1};
 }catch{return fail('INVALID_HISTORY');}
}

/** Propose an append-only historical record from an independently rechecked
 * S7c candidate. The result has NO write permission or backup authority.
 * A future owner must revalidate while holding its encrypted commit lock.
 */
export async function proposeFormativeBalanceHistoryAppend(
 existing:unknown,rawCandidate:unknown,currentClass:ClassData,
 settings:Pick<AppSettings,'year'|'subject'>|undefined,rawClock:unknown
):Promise<HistoryAppendProposal>{
 try{
  const cls=snapshotAssessmentData(currentClass) as ClassData;
  const candidate=snapshotAssessmentData(rawCandidate) as FormativeBalanceCommitCandidateV1;
  const clock=snapshotAssessmentData(rawClock);
  if(!exact(clock,['id','recordedAt'])||typeof clock.id!=='string'||
     !idPattern.test(clock.id)||!instant(clock.recordedAt))return fail('INVALID_CLOCK');
  const recheck=await recheckFormativeBalanceCommitPreflight(cls,settings,candidate);
  if(!recheck.valid)return fail(recheck.issue==='UNVERIFIED_ARCHIVE'?'INVALID_SCOPE':'STALE_EVIDENCE');
  const c=candidate.context;
  const source=loadStudentFormativeReviewSource(cls,settings,c.studentId,c.period,c.from,c.to);
  if(source.status!=='ready')return fail('INVALID_SCOPE');
  const scope=source.scope;
  const current:FormativeBalanceHistoryV1=existing===undefined?
    {version:1,classId:scope.classId,schoolYear:scope.schoolYear,
     subjectCode:scope.subjectCode,records:[]}:
    await (async()=>{
      const checked=await validateFormativeBalanceHistoryV1(existing,scope);
      if(!checked.valid)throw Error('INVALID_HISTORY');
      return checked.history;
    })();
  if(current.records.length>=maxRecords)return fail('INVALID_HISTORY');
  if(current.records.some(r=>r.id===clock.id))return fail('DUPLICATE_RECORD');
  if(clock.recordedAt<candidate.sessionConfirmationAt)return fail('INVALID_CLOCK');
  const prior=[...current.records].reverse().find(r=>group(r.context)===group(c));
  if(prior&&(prior.confirmedAt===candidate.sessionConfirmationAt||
      clock.recordedAt<prior.recordedAt))return fail('DUPLICATE_RECORD');
  const unsigned:Omit<FormativeBalanceHistoryRecordV1,'contentDigest'>={
    schemaVersion:1,kind:'teacher-authored-formative-balance',id:clock.id,
    context:{...candidate.context},revision:prior?prior.revision+1:1,
    supersedesRecordId:prior?prior.id:null,
    previousDigest:prior?prior.contentDigest:null,confirmedByTeacher:true,
    confirmedAt:candidate.sessionConfirmationAt,recordedAt:clock.recordedAt,
    evidenceRevisionIds:[...candidate.evidenceRevisionIds],
    comparisons:candidate.comparisons.map(p=>({
      earlierRevisionId:p.earlierRevisionId,laterRevisionId:p.laterRevisionId
    })),
    teacherText:{learning:candidate.teacherText.learning,progress:candidate.teacherText.progress,
      nextStep:candidate.teacherText.nextStep},
    basisDigest:candidate.basisDigest
  };
  const record:FormativeBalanceHistoryRecordV1={...unsigned,contentDigest:await digest(unsigned)};
  const history:FormativeBalanceHistoryV1={...current,records:[...current.records,record]};
  const check=await validateFormativeBalanceHistoryV1(history,scope);
  if(!check.valid)return fail('INVALID_HISTORY');
  return {valid:true,state:'proposed-not-saved',history:check.history,record};
 }catch{return fail('INVALID_HISTORY');}
}

/** Conservative future restore rule: every old revision must remain in place
 * with the same proven content digest. Additions are allowed after validation.
 * This gate does not authorize the next backup version or any Vault mutation.
 */
export async function preservesFormativeBalanceHistory(
 previous:unknown,next:unknown,approvedScope:unknown
):Promise<boolean>{
 try{
  if(previous===undefined){
   return next===undefined||(await validateFormativeBalanceHistoryV1(next,approvedScope)).valid;
  }
  const a=await validateFormativeBalanceHistoryV1(previous,approvedScope);
  const b=await validateFormativeBalanceHistoryV1(next,approvedScope);
  if(!a.valid||!b.valid||a.history.records.length>b.history.records.length)return false;
  return a.history.records.every((x,i)=>x.id===b.history.records[i].id&&
    x.contentDigest===b.history.records[i].contentDigest);
 }catch{return false;}
}
