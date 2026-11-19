/** DOC-01/D4c1 — immutable synthetic archive candidate.
 * No persistent state, source copy, signature, real-data adapter or runtime wiring.
 * The caller supplies both the reviewed and current sources. Reconstructing a
 * review is not proof of a live authenticated session or an authoritative head.
 */
import {proposeDocumentRevision} from './documentRevisionIdentity';
import {createFinalRevisionReview} from './finalRevisionConfirmation';
import {createPlanningRevisionReview} from './planningRevisionConfirmation';
import {snapshotAssessmentData} from '../assessment/assessmentRevisionBindings';
type History=Extract<ReturnType<typeof proposeDocumentRevision>,{valid:true}>['history'];
type FinalPreview=Extract<ReturnType<typeof createFinalRevisionReview>,{valid:true}>['review']['preview'];
type PlanningPreview=Extract<ReturnType<typeof createPlanningRevisionReview>,{valid:true}>['review']['preview'];
export type DocumentArchiveCandidateV1=Readonly<{schemaVersion:1;labOnly:true;official:false;complete:false;identity:History['identity'];revision:History['revisions'][number];confirmedAt:string;confirmedByTeacher:true;preview:FinalPreview|PlanningPreview;contentDigest:string}>;
type Result={valid:true;record:DocumentArchiveCandidateV1}|{valid:false;issue:'INVALID_INPUT'|'INVALID_REVIEW'|'STALE_REVIEW'|'INVALID_DECISION'|'DIGEST_FAILED'};
type Row=Record<string,unknown>;
const fail=(issue:Extract<Result,{valid:false}>['issue']):Result=>({valid:false,issue});
function exact(v:unknown,keys:readonly string[]):v is Row{
 return v!==null&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v))&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>{const d=Object.getOwnPropertyDescriptor(v,k);return !!d&&d.enumerable&&'value' in d;});
}
function timestamp(v:unknown):v is string{
 if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v))return false;
 const t=Date.parse(v);return Number.isFinite(t)&&new Date(t).toISOString()===v;
}
// Canonical representation of internally derived JSON data only. Reject
// unsupported values rather than silently normalizing them for the digest.
function canonical(v:unknown):string{
 if(v===null||typeof v==='string'||typeof v==='boolean')return JSON.stringify(v);
 if(typeof v==='number'&&Number.isFinite(v))return JSON.stringify(v);
 if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';
 if(v!==null&&typeof v==='object'&&[Object.prototype,null].includes(Object.getPrototypeOf(v))){
  const r=v as Row;return '{'+Object.keys(r).sort().map(k=>JSON.stringify(k)+':'+canonical(r[k])).join(',')+'}';
 }
 throw Error('Non-portable archive candidate');
}
function freezeData<T>(v:T):T{
 if(v!==null&&typeof v==='object'){
  for(const item of Object.values(v))freezeData(item);
  Object.freeze(v);
 }
 return v;
}
export async function prepareDocumentArchiveCandidate(raw:unknown):Promise<Result>{
 try{
  const keys=['mode','reviewed','current','decision','confirmedAt'];
  if(!exact(raw,keys)||raw.mode!=='SYNTHETIC_ONLY'||!timestamp(raw.confirmedAt))return fail('INVALID_INPUT');
  // Detach both source views and decision before any asynchronous operation.
  // The existing snapshot boundary rejects getters, cycles and non-plain data.
  const input=snapshotAssessmentData(raw);
  if(!exact(input,keys)||!exact(input.reviewed,['mode','revision','source'])||!exact(input.current,['mode','revision','source'])||!timestamp(input.confirmedAt))return fail('INVALID_INPUT');
  const lineage=proposeDocumentRevision(input.reviewed.revision);
  if(!lineage.valid)return fail('INVALID_REVIEW');
  const {identity,revisions}=lineage.history;
  const revision=revisions.at(-1);if(!revision)return fail('INVALID_REVIEW');
  const reviewed=identity.kind==='final-report'||identity.kind==='program-completed'
   ?createFinalRevisionReview(input.reviewed):createPlanningRevisionReview(input.reviewed);
  if(!reviewed.valid)return fail('INVALID_REVIEW');
  const {preview}=reviewed.review;
  if(preview.kind!==identity.kind||preview.documentId!==identity.documentId||preview.revisionId!==revision.revisionId||preview.number!==revision.number)return fail('INVALID_REVIEW');
  if(reviewed.review.status(input.current)!=='draft')return fail('STALE_REVIEW');
  if(!reviewed.review.confirm(input.current,input.decision).valid||reviewed.review.status(input.current)!=='confirmed')return fail('INVALID_DECISION');
  // Retain exactly the reviewed projection, not the input or full history.
  // The D4a revision's state describes its lineage, not the confirmation.
  const unsigned=freezeData({schemaVersion:1 as const,labOnly:true as const,official:false as const,complete:false as const,identity,revision,confirmedAt:input.confirmedAt,confirmedByTeacher:true as const,preview});
  let contentDigest:string;
  try{
   const bytes=new TextEncoder().encode(canonical(['DOC-01/archive-candidate/v1',unsigned]));
   const digest=await crypto.subtle.digest('SHA-256',bytes);
   contentDigest=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
  }catch{return fail('DIGEST_FAILED');}
  return {valid:true,record:Object.freeze({...unsigned,contentDigest})};
 }catch{return fail('INVALID_INPUT');}
}
