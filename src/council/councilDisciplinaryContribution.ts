/** VAL-01/S8 — isolated teacher contribution, not a council decision.
 * Read existing class/session identity and a confirmed S7 balance. Revalidate
 * both against independent current scope. No grades, certification, admission,
 * official minutes, writes, disclosure or authority from this projection.
 */
import {confirmFormativeBalance,type FormativeBalanceConfirmation,type FormativeBalanceContext} from '../assessment/formativeBalance';
import {projectFormativeRestitution,type FormativeRestitutionPreview} from '../assessment/formativeRestitutionProjection';
import {snapshotAssessmentData} from '../assessment/assessmentRevisionBindings';
import {isCouncilSessionDateValid,normalizeSchoolYear,readCouncilSessions} from './councilModel';
import type {ClassData,CouncilSession} from '../types';
import type {AssessmentScopeV1} from '../assessment/assessmentEvidence';

export type ConfirmedFormativeBalance=Extract<FormativeBalanceConfirmation,{valid:true}>['balance'];
export interface CouncilContributionContext extends FormativeBalanceContext{
 readonly sessionId:string;
}
type TextKey=keyof FormativeRestitutionPreview['teacherText'];
const textKeys=['learning','progress','nextStep'] as const;
export interface CouncilContributionSelection{
 readonly sections:readonly TextKey[];
}
export interface CouncilContributionPreview{
 readonly kind:'teacher-disciplinary-contribution';
 readonly context:CouncilContributionContext;
 readonly session:CouncilSession;
 readonly balanceConfirmedAt:string;
 readonly balanceDigest:string;
 readonly evidence:FormativeRestitutionPreview['sources'];
 readonly teacherText:Partial<FormativeRestitutionPreview['teacherText']>;
 readonly decision:'not-a-council-decision';
 readonly competenceCertification:'not-assessed';
}
type Issue='INVALID_CONTEXT'|'INVALID_CLASS'|'INVALID_SESSION'|'INVALID_SELECTION'|'STALE_BALANCE'|'STALE_PREVIEW'|'INVALID_CONFIRMATION';
type Invalid={readonly valid:false;readonly issue:Issue};
export type CouncilContributionReview=Invalid|{readonly valid:true;readonly preview:CouncilContributionPreview};
export type CouncilContributionConfirmation=Invalid|{readonly valid:true;readonly contribution:CouncilContributionPreview&{readonly confirmedByTeacher:true;readonly confirmedAt:string}};
type Row=Record<string,unknown>;
const fail=(issue:Issue):Invalid=>({valid:false,issue});
function exact(x:unknown,keys:readonly string[]):x is Row{
 return x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.prototype.hasOwnProperty.call(x,k));
}
function instant(x:unknown):x is string{
 if(typeof x!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(x))return false;
 const t=Date.parse(x);return Number.isFinite(t)&&new Date(t).toISOString()===x;
}
function canonical(x:unknown):string{
 if(Array.isArray(x))return '['+x.map(canonical).join(',')+']';
 if(x!==null&&typeof x==='object')return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical((x as Row)[k])).join(',')+'}';
 return JSON.stringify(x)??'undefined';
}
export async function prepareCouncilContribution(document:unknown,scope:unknown,classData:unknown,context:unknown,balance:unknown,selection:unknown):Promise<CouncilContributionReview>{
 try{
  const d=snapshotAssessmentData(document),s=snapshotAssessmentData(scope) as AssessmentScopeV1;
  const cls=snapshotAssessmentData(classData) as ClassData;
  const c=snapshotAssessmentData(context),b=snapshotAssessmentData(balance),r=snapshotAssessmentData(selection);
  if(!exact(c,['classId','schoolYear','subjectCode','studentId','period','from','to','sessionId'])||
   typeof c.sessionId!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(c.sessionId))return fail('INVALID_CONTEXT');
  if(!s||!cls||cls.id!==s.classId||c.classId!==s.classId||c.schoolYear!==s.schoolYear||c.subjectCode!==s.subjectCode||
   !Array.isArray(cls.students)||!Array.isArray(s.studentIds))return fail('INVALID_CLASS');
  const roster=cls.students.map(x=>x.id);
  if(new Set(roster).size!==roster.length||new Set(s.studentIds).size!==s.studentIds.length||
   roster.length!==s.studentIds.length||roster.some(id=>!s.studentIds.includes(id))||
   typeof c.studentId!=='string'||!roster.includes(c.studentId))return fail('INVALID_CLASS');
  if(!Array.isArray(cls.councilSessions)||new Set(cls.councilSessions.map(x=>x.id)).size!==cls.councilSessions.length)return fail('INVALID_SESSION');
  const matching=readCouncilSessions(cls,s.schoolYear).filter(x=>x.id===c.sessionId);
  if(matching.length!==1)return fail('INVALID_SESSION');
  const session=matching[0];
  if(!exact(session,['id','schoolYear','kind','date','createdAt','updatedAt'])||
   normalizeSchoolYear(session.schoolYear)!==s.schoolYear||!isCouncilSessionDateValid(session.date,s.schoolYear)||
   !['ingresso','intermedia','monitoraggio','finale','altro'].includes(session.kind)||
   !instant(session.createdAt)||!instant(session.updatedAt)||session.updatedAt<session.createdAt||
   typeof c.to!=='string'||c.to>session.date)return fail('INVALID_SESSION');
  // A session kind never implies an official assessment period or a level.
  const {sessionId,...balanceContext}=c;
  if(!exact(b,['context','request','availableCount','sources','comparisons','basisDigest','basisLatestConfirmedAt','coverage','confirmedByTeacher','confirmedAt'])||
   b.confirmedByTeacher!==true||!instant(b.confirmedAt))return fail('STALE_BALANCE');
  const {confirmedByTeacher,confirmedAt,...reviewed}=b;
  const fresh=await confirmFormativeBalance(d,s,balanceContext,reviewed,{confirmedByTeacher,confirmedAt});
  if(!fresh.valid)return fail('STALE_BALANCE');
  if(!exact(r,['sections'])||!Array.isArray(r.sections)||new Set(r.sections).size!==r.sections.length||
   r.sections.some(k=>!(textKeys as readonly unknown[]).includes(k)))return fail('INVALID_SELECTION');
  const projection=projectFormativeRestitution(fresh.balance);
  const sections=r.sections as TextKey[];
  if(sections.some(k=>!projection.teacherText[k].trim()))return fail('INVALID_SELECTION');
  const teacherText=Object.fromEntries(textKeys.filter(k=>sections.includes(k)).map(k=>[k,projection.teacherText[k]]));
  return {valid:true,preview:{kind:'teacher-disciplinary-contribution',context:{...fresh.balance.context,sessionId},session,
   balanceConfirmedAt:fresh.balance.confirmedAt,balanceDigest:fresh.balance.basisDigest,evidence:projection.sources,teacherText,
   decision:'not-a-council-decision',competenceCertification:'not-assessed'}};
 }catch{return fail('INVALID_CONTEXT');}
}
export async function confirmCouncilContribution(document:unknown,scope:unknown,classData:unknown,context:unknown,balance:unknown,selection:unknown,reviewed:unknown,confirmation:unknown):Promise<CouncilContributionConfirmation>{
 try{
  const r=snapshotAssessmentData(reviewed),c=snapshotAssessmentData(confirmation);
  if(!exact(c,['confirmedByTeacher','confirmedAt'])||c.confirmedByTeacher!==true||!instant(c.confirmedAt))return fail('INVALID_CONFIRMATION');
  const fresh=await prepareCouncilContribution(document,scope,classData,context,balance,selection);
  if(!fresh.valid||canonical(r)!==canonical(fresh.preview))return fail('STALE_PREVIEW');
  if(c.confirmedAt<fresh.preview.balanceConfirmedAt||c.confirmedAt<fresh.preview.session.updatedAt)return fail('INVALID_CONFIRMATION');
  return {valid:true,contribution:{...fresh.preview,confirmedByTeacher:true,confirmedAt:c.confirmedAt}};
 }catch{return fail('INVALID_CONFIRMATION');}
}
