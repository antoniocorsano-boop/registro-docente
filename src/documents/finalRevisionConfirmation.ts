/** DOC-01/D4b1 — in-memory review of an exact final document revision.
 * The only content producer is D3c; no caller-supplied payload or signature.
 * Confirmation is local to this review instance, not an authenticated receipt
 * or a persistent state. The caller must supply the current draft and sources.
 */
import {proposeDocumentRevision} from './documentRevisionIdentity';
import {createFinalDocumentReview} from './finalDocumentReview';
import {snapshotAssessmentData} from '../assessment/assessmentRevisionBindings';

type Row=Record<string,unknown>;
type SourceReview=Extract<ReturnType<typeof createFinalDocumentReview>,{valid:true}>['review'];
type FinalContent=SourceReview['presentation'];
type ProgramContent=Readonly<Pick<FinalContent,'official'|'complete'|'labOnly'|'coverage'|'period'|'recorded'|'coverageAssessment'|'institutionalModel'>>;
type Preview=Readonly<{official:false;complete:false;labOnly:true;kind:'final-report'|'program-completed';documentId:string;revisionId:string;number:number;content:FinalContent|ProgramContent}>;
type Status='draft'|'confirmed'|'review-required'|'revoked';
type Confirmation={valid:false}|{valid:true;confirmed:true;official:false;complete:false};
type Review=Readonly<{preview:Preview;status:(current:unknown)=>Status;confirm:(current:unknown,decision:unknown)=>Confirmation;revoke:(decision:unknown)=>boolean}>;
type Failure={valid:false;issue:'INVALID_INPUT'|'INVALID_REVISION'|'INVALID_SOURCE'|'CONTEXT_MISMATCH'|'UNSUPPORTED_KIND'};
type Inspected={valid:true;preview:Preview;basis:string;source:unknown;sourceReview:SourceReview};
type Result=Failure|{valid:true;review:Review};
const fail=(issue:Failure['issue']):Failure=>({valid:false,issue});
function exact(v:unknown,keys:readonly string[]):v is Row{
 return v!==null&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v))&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>{const d=Object.getOwnPropertyDescriptor(v,k);return !!d&&d.enumerable&&'value' in d;});
}
function canonical(v:unknown):string{
 if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';
 if(v!==null&&typeof v==='object'){const r=v as Row;return '{'+Object.keys(r).sort().map(k=>JSON.stringify(k)+':'+canonical(r[k])).join(',')+'}';}
 return JSON.stringify(v)??'undefined';
}
function inspect(raw:unknown):Failure|Inspected{
 try{
  if(!exact(raw,['mode','revision','source'])||raw.mode!=='SYNTHETIC_ONLY')return fail('INVALID_INPUT');
  const revision=proposeDocumentRevision(raw.revision);
  if(!revision.valid)return fail('INVALID_REVISION');
  const {identity,revisions}=revision.history;
  const {kind,documentId}=identity;
  if(kind!=='final-report'&&kind!=='program-completed')return fail('UNSUPPORTED_KIND');
  const result=createFinalDocumentReview(raw.source);
  if(!result.valid)return fail('INVALID_SOURCE');
  const r=snapshotAssessmentData(raw.revision) as Row,s=snapshotAssessmentData(raw.source) as Row;
  if(!['scope','classes','bindings','modelSelection','period'].every(k=>canonical(r[k])===canonical(s[k])))return fail('CONTEXT_MISMATCH');
  const p=result.review.presentation;
  let content:FinalContent|ProgramContent=p;
  if(kind==='program-completed'){
   if(s.assessment!==null||p.recorded.status!=='selected'||p.summary.length||p.links.length)return fail('INVALID_SOURCE');
   content=Object.freeze({official:false,complete:false,labOnly:true,coverage:p.coverage,period:p.period,recorded:p.recorded,coverageAssessment:p.coverageAssessment,institutionalModel:p.institutionalModel});
  }
  const head=revisions.at(-1);
  if(!head)return fail('INVALID_REVISION');
  const preview:Preview=Object.freeze({official:false,complete:false,labOnly:true,kind,documentId,revisionId:head.revisionId,number:head.number,content});
  return {valid:true,preview,basis:canonical([revision.history,r.scope,r.classes,r.bindings,r.modelSelection,r.period]),source:raw.source,sourceReview:result.review};
 }catch{return fail('INVALID_INPUT');}
}
export function createFinalRevisionReview(input:unknown):Result{
 const r=inspect(input);if(!r.valid)return r;
 const {preview,basis,sourceReview}=r;
 let state:Status='draft';
 const status=(current:unknown):Status=>{
  if(state==='revoked'||state==='review-required')return state;
  const fresh=inspect(current);
  if(!fresh.valid||fresh.basis!==basis||canonical(fresh.preview)!==canonical(preview)||!sourceReview.isCurrent(fresh.source))state='review-required';
  return state;
 };
 const matches=(decision:unknown,key:'confirmedByTeacher'|'revokedByTeacher',keys:string[]):decision is Row=>
  exact(decision,keys)&&decision[key]===true&&decision.documentId===preview.documentId&&decision.revisionId===preview.revisionId;
 const confirm=(current:unknown,decision:unknown):Confirmation=>{
  try{
   if(status(current)!=='draft'||!matches(decision,'confirmedByTeacher',['confirmedByTeacher','documentId','revisionId','reviewed'])||canonical(snapshotAssessmentData(decision.reviewed))!==canonical(preview))return {valid:false};
   state='confirmed';return {valid:true,confirmed:true,official:false,complete:false};
  }catch{return {valid:false};}
 };
 const revoke=(decision:unknown):boolean=>{
  try{
   if(state!=='confirmed'||!matches(decision,'revokedByTeacher',['revokedByTeacher','documentId','revisionId']))return false;
   state='revoked';return true;
  }catch{return false;}
 };
 return {valid:true,review:Object.freeze({preview,status,confirm,revoke})};
}
