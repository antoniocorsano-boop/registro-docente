/** DOC-01/D3b — synthetic protected individual document review.
 * Reuse S7/S8. No production activation, access-control assertion, persistence
 * or permission to disclose. A caller must supply the current protected context
 * on every read; this is not a mechanism to revoke already copied values.
 */
import {confirmFormativeBalance} from '../assessment/formativeBalance';
import {projectFormativeRestitution,type FormativeRestitutionPreview} from '../assessment/formativeRestitutionProjection';
import {confirmCouncilContribution} from '../council/councilDisciplinaryContribution';
import {snapshotAssessmentData} from '../assessment/assessmentRevisionBindings';
type Row=Record<string,unknown>;
type Section=keyof FormativeRestitutionPreview['teacherText'];
type Destination='student-restitution'|'council-disciplinary-contribution';
type Source=Readonly<Omit<FormativeRestitutionPreview['sources'][number],'objectives'>&{objectives:readonly string[]}>;
type Presentation=Readonly<{destination:Destination;labOnly:true;official:false;complete:false;canExport:false;coverage:'undetermined';period:FormativeRestitutionPreview['period'];from:string;to:string;sessionDate:string|null;sources:readonly Source[];teacherText:Readonly<Partial<FormativeRestitutionPreview['teacherText']>>;decision:'not-a-council-decision';competenceCertification:'not-assessed'}>;
type Failure={valid:false;issue:'INVALID_INPUT'|'PROTECTION_REQUIRED'|'INVALID_TARGET'|'STALE_BALANCE'|'STALE_CONTRIBUTION'|'STALE_REVIEW'|'INVALID_CONFIRMATION'};
type Inspection=Failure|{valid:true;presentation:Presentation;basis:string;latestConfirmedAt:string};
type Read=Failure|{valid:true;presentation:Presentation};
type Confirmation=Failure|{valid:true;confirmed:true;official:false;canExport:false};
type Review=Readonly<{readCurrent:(input:unknown)=>Promise<Read>;confirmCurrent:(input:unknown,confirmation:unknown)=>Promise<Confirmation>}>;
type Result=Failure|{valid:true;review:Review};
const fail=(issue:Failure['issue']):Failure=>({valid:false,issue});
const rootKeys=['mode','privacyShieldActive','document','scope','context','balance','target'];
const balanceKeys=['context','request','availableCount','sources','comparisons','basisDigest','basisLatestConfirmedAt','coverage','confirmedByTeacher','confirmedAt'];
const contributionKeys=['kind','context','session','balanceConfirmedAt','balanceDigest','evidence','teacherText','decision','competenceCertification','confirmedByTeacher','confirmedAt'];
const sections=['learning','progress','nextStep'] as const;
function exact(v:unknown,keys:readonly string[]):v is Row{
 return v!==null&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v))&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>{const d=Object.getOwnPropertyDescriptor(v,k);return !!d&&d.enumerable&&Object.prototype.hasOwnProperty.call(d,'value');});
}
function instant(v:unknown):v is string{
 if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v))return false;
 const t=Date.parse(v);return Number.isFinite(t)&&new Date(t).toISOString()===v;
}
const canonical=(v:unknown):string=>{
 if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';
 if(v!==null&&typeof v==='object'){const r=v as Row;return '{'+Object.keys(r).sort().map(k=>JSON.stringify(k)+':'+canonical(r[k])).join(',')+'}';}
 return JSON.stringify(v)??'undefined';
};
async function inspect(raw:unknown):Promise<Inspection>{
 try{
  if(!exact(raw,rootKeys)||raw.mode!=='SYNTHETIC_ONLY')return fail('INVALID_INPUT');
  if(raw.privacyShieldActive!==true)return fail('PROTECTION_REQUIRED');
  if(!exact(raw.target,['kind','sections'])&&!exact(raw.target,['kind','classData','sessionId','sections','contribution']))return fail('INVALID_TARGET');
  if(raw.target.kind!=='student-restitution'&&raw.target.kind!=='council-disciplinary-contribution')return fail('INVALID_TARGET');
  const input=snapshotAssessmentData(raw);
  if(!exact(input,rootKeys)||!exact(input.context,['classId','schoolYear','subjectCode','studentId','period','from','to'])||!exact(input.balance,balanceKeys))return fail('INVALID_INPUT');
  const {document,scope,context,balance,target}=input;
  if(!exact(target,['kind','sections'])&&!exact(target,['kind','classData','sessionId','sections','contribution']))return fail('INVALID_TARGET');
  const chosen=target.sections;
  if(!Array.isArray(chosen)||chosen.length>3||new Set(chosen).size!==chosen.length||chosen.some(k=>!(sections as readonly unknown[]).includes(k)))return fail('INVALID_TARGET');
  const {confirmedByTeacher,confirmedAt,...reviewed}=balance;
  if(confirmedByTeacher!==true||!instant(confirmedAt))return fail('STALE_BALANCE');
  const b=await confirmFormativeBalance(document,scope,context,reviewed,{confirmedByTeacher,confirmedAt});
  if(!b.valid)return fail('STALE_BALANCE');
  const projection=projectFormativeRestitution(b.balance);
  const selected=sections.filter(k=>chosen.includes(k));
  if(selected.some(k=>!projection.teacherText[k].trim()))return fail('INVALID_TARGET');
  let destination:Destination, sessionDate:string|null=null, latestConfirmedAt=confirmedAt, sessionBasis:unknown=null;
  let teacherText:Partial<FormativeRestitutionPreview['teacherText']>, evidence:FormativeRestitutionPreview['sources'];
  if(target.kind==='student-restitution'&&exact(target,['kind','sections'])){
   destination='student-restitution';
   teacherText=Object.fromEntries(selected.map(k=>[k,projection.teacherText[k]])) as Partial<FormativeRestitutionPreview['teacherText']>;
   evidence=projection.sources;
  }else if(target.kind==='council-disciplinary-contribution'&&exact(target,['kind','classData','sessionId','sections','contribution'])){
   destination='council-disciplinary-contribution';
   if(!exact(target.contribution,contributionKeys))return fail('STALE_CONTRIBUTION');
   const {confirmedByTeacher:confirmed,confirmedAt:at,...contribution}=target.contribution;
   if(confirmed!==true||!instant(at))return fail('STALE_CONTRIBUTION');
   const c=await confirmCouncilContribution(document,scope,target.classData,{...context,sessionId:target.sessionId},b.balance,{sections:chosen},contribution,{confirmedByTeacher:confirmed,confirmedAt:at});
   if(!c.valid)return fail('STALE_CONTRIBUTION');
   teacherText=c.contribution.teacherText;evidence=c.contribution.evidence;
   sessionDate=c.contribution.session.date;latestConfirmedAt=c.contribution.confirmedAt;
   sessionBasis={session:c.contribution.session,confirmedAt:latestConfirmedAt};
  }else return fail('INVALID_TARGET');
  const presentation:Presentation=Object.freeze({destination,labOnly:true,official:false,complete:false,canExport:false,coverage:'undetermined',
   period:projection.period,from:projection.from,to:projection.to,sessionDate,
   sources:Object.freeze(evidence.map(s=>Object.freeze({date:s.date,activity:s.activity,criterion:s.criterion,objectives:Object.freeze([...s.objectives]),state:s.state}))),
   teacherText:Object.freeze({...teacherText}),decision:'not-a-council-decision',competenceCertification:'not-assessed'});
  // Bind current recipient, scope, original confirmed basis and destination
  // privately. The current result is recomputed, not stored as a document.
  const basis=canonical({context,scope,destination,selected,balanceDigest:b.balance.basisDigest,balanceConfirmedAt:confirmedAt,sessionBasis,presentation});
  return {valid:true,presentation,basis,latestConfirmedAt};
 }catch{return fail('INVALID_INPUT');}
}
export async function preparePrivateDocumentReview(input:unknown):Promise<Result>{
 const first=await inspect(input);if(!first.valid)return first;
 const basis=first.basis,latestConfirmedAt=first.latestConfirmedAt;
 const readCurrent=async(next:unknown):Promise<Read>=>{
  const r=await inspect(next);if(!r.valid)return r;
  if(r.basis!==basis)return fail('STALE_REVIEW');
  return {valid:true,presentation:r.presentation};
 };
 const confirmCurrent=async(next:unknown,confirmation:unknown):Promise<Confirmation>=>{
  if(!exact(confirmation,['confirmedByTeacher','confirmedAt'])||confirmation.confirmedByTeacher!==true||!instant(confirmation.confirmedAt)||confirmation.confirmedAt<latestConfirmedAt)return fail('INVALID_CONFIRMATION');
  const r=await readCurrent(next);if(!r.valid)return r;
  return {valid:true,confirmed:true,official:false,canExport:false};
 };
 return {valid:true,review:Object.freeze({readCurrent,confirmCurrent})};
}
