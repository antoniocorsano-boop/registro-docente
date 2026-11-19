/** DOC-01/D4c2b — isolated append-only historical document collection.
 * A consistent chain of digests is neither authentication nor anti-rollback.
 * All inputs and the authoritative head are caller-supplied in this laboratory.
 * No storage, session authority, retention policy, export or runtime wiring.
 */
import type {DocumentArchiveCandidateV1} from './documentArchiveCandidate';
import {validateHistoricalDocumentRecord,detachHistoricalDocumentData as detach,canonicalHistoricalDocumentData as canonical,freezeHistoricalDocumentData as freeze,isHistoricalDocumentScope as validScope} from './documentHistoricalValidation';
type Append=Readonly<{kind:'append';record:DocumentArchiveCandidateV1}>;
type Revoke=Readonly<{kind:'revoke';documentId:string;revisionId:string;contentDigest:string;revokedAt:string;reason:'withdrawn'|'correction-required';confirmedByTeacher:true}>;
type Operation=Append|Revoke;
export type DocumentHistoryEventV1=Readonly<{eventId:string;previousEventDigest:string|null;operation:Operation;eventDigest:string}>;
export type DocumentHistoryV1=Readonly<{schemaVersion:1;labOnly:true;events:readonly DocumentHistoryEventV1[]}>;
type Head=Readonly<{documentId:string;revisionId:string;contentDigest:string;status:'confirmed'|'revoked'}>;
type Failure={valid:false;issue:'INVALID_HISTORY'|'INVALID_SCOPE'|'INVALID_REQUEST'|'STALE_HEAD'|'CONFLICT'|'INVALID_RECORD'};
type Success={valid:true;archive:DocumentHistoryV1;heads:readonly Head[]};
type Row=Record<string,unknown>;
type DocumentState={record:DocumentArchiveCandidateV1;status:Head['status'];lastAt:string};
type Replay={events:DocumentHistoryEventV1[];documents:Map<string,DocumentState>;ids:Set<string>;byEvent:Map<string,DocumentHistoryEventV1>;scopes:Map<string,Row>;head:string|null};
type Inspection={valid:true;state:Replay}|Failure;
const fail=(issue:Failure['issue']):Failure=>({valid:false,issue});
const row=(v:unknown):v is Row=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const exact=(v:unknown,keys:readonly string[]):v is Row=>row(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.prototype.hasOwnProperty.call(v,k));
const demo=(v:unknown):v is string=>typeof v==='string'&&/^demo-[a-z0-9-]{1,64}$/.test(v);
const digest=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{64}$/.test(v);
const utc=(v:unknown):v is string=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
const maxEvents=1000;
async function eventHash(unsigned:Omit<DocumentHistoryEventV1,'eventDigest'>):Promise<string>{
 const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical(['DOC-01/document-history-event/v1',unsigned])));
 return Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
}
function scopeMap(raw:unknown):Map<string,Row>|null{
 if(!Array.isArray(raw)||raw.length>1000)return null;
 const scopes=new Map<string,Row>();
 for(const s of raw){
  if(!validScope(s))return null;
  const k=canonical(s);
  if(scopes.has(k))return null;
  scopes.set(k,s);
 }
 return scopes;
}
// Consume one operation against a private, disposable replay state. Only a
// successful replay/transition is published as a new immutable projection.
async function accept(state:Replay,eventId:string,raw:unknown):Promise<{valid:true;operation:Operation}|Failure>{
 if(state.ids.has(eventId))return fail('CONFLICT');
 if(!row(raw))return fail('INVALID_REQUEST');
 if(raw.kind==='append'){
  if(!exact(raw,['kind','record'])||!row(raw.record)||!row(raw.record.identity))return fail('INVALID_RECORD');
  const approved=state.scopes.get(canonical(raw.record.identity.scope));
  if(!approved)return fail('INVALID_SCOPE');
  const result=await validateHistoricalDocumentRecord(raw.record,approved);
  if(!result.valid)return fail('INVALID_RECORD');
  const record=result.record,id=record.identity.documentId,revision=record.revision;
  const previous=state.documents.get(id);
  if(revision.revisionId===eventId||id===eventId||state.ids.has(revision.revisionId))return fail('CONFLICT');
  if(previous){
   if(canonical(previous.record.identity)!==canonical(record.identity)||
      revision.number!==previous.record.revision.number+1||
      revision.previousRevisionId!==previous.record.revision.revisionId||
      record.confirmedAt<previous.lastAt||
      (previous.status==='revoked'&&revision.reason!=='correction'))return fail('CONFLICT');
  }else if(state.ids.has(id)||revision.number!==1||revision.previousRevisionId!==null||revision.reason!=='initial')return fail('CONFLICT');
  state.ids.add(eventId);state.ids.add(id);state.ids.add(revision.revisionId);
  state.documents.set(id,{record,status:'confirmed',lastAt:record.confirmedAt});
  return {valid:true,operation:freeze({kind:'append',record})};
 }
 if(raw.kind==='revoke'){
  if(!exact(raw,['kind','documentId','revisionId','contentDigest','revokedAt','reason','confirmedByTeacher'])||
     !demo(raw.documentId)||!demo(raw.revisionId)||!digest(raw.contentDigest)||!utc(raw.revokedAt)||
     (raw.reason!=='withdrawn'&&raw.reason!=='correction-required')||raw.confirmedByTeacher!==true)return fail('INVALID_REQUEST');
  const previous=state.documents.get(raw.documentId);
  if(!previous||previous.status!=='confirmed'||previous.record.revision.revisionId!==raw.revisionId||
     previous.record.contentDigest!==raw.contentDigest||raw.revokedAt<previous.lastAt)return fail('CONFLICT');
  state.ids.add(eventId);
  state.documents.set(raw.documentId,{record:previous.record,status:'revoked',lastAt:raw.revokedAt});
  const operation:Revoke=freeze({kind:'revoke',documentId:raw.documentId,revisionId:raw.revisionId,contentDigest:raw.contentDigest,revokedAt:raw.revokedAt,reason:raw.reason,confirmedByTeacher:true});
  return {valid:true,operation};
 }
 return fail('INVALID_REQUEST');
}
async function inspect(raw:unknown,approved:unknown):Promise<Inspection>{
 const scopes=scopeMap(approved);if(!scopes)return fail('INVALID_SCOPE');
 if(!exact(raw,['schemaVersion','labOnly','events'])||raw.schemaVersion!==1||raw.labOnly!==true||
    !Array.isArray(raw.events)||raw.events.length>maxEvents)return fail('INVALID_HISTORY');
 const state:Replay={events:[],documents:new Map(),ids:new Set(),byEvent:new Map(),scopes,head:null};
 for(const event of raw.events){
  if(!exact(event,['eventId','previousEventDigest','operation','eventDigest'])||!demo(event.eventId)||
     event.previousEventDigest!==state.head||!digest(event.eventDigest))return fail('INVALID_HISTORY');
  const accepted=await accept(state,event.eventId,event.operation);
  if(!accepted.valid)return accepted;
  const unsigned={eventId:event.eventId,previousEventDigest:state.head,operation:accepted.operation};
  const hash=await eventHash(unsigned);
  if(hash!==event.eventDigest)return fail('INVALID_HISTORY');
  const copy:DocumentHistoryEventV1=freeze({...unsigned,eventDigest:hash});
  state.events.push(copy);state.byEvent.set(copy.eventId,copy);state.head=hash;
 }
 return {valid:true,state};
}
function projection(state:Replay):Success{
 const heads:Head[]=Array.from(state.documents,([documentId,entry])=>freeze({documentId,revisionId:entry.record.revision.revisionId,contentDigest:entry.record.contentDigest,status:entry.status}));
 const archive:DocumentHistoryV1=freeze({schemaVersion:1,labOnly:true,events:state.events.slice()});
 return {valid:true,archive,heads:freeze(heads)};
}
export async function validateDocumentHistory(raw:unknown,approvedScopes:unknown):Promise<Success|Failure>{
 try{
  // Snapshot all caller inputs before the first asynchronous operation.
  const copy=detach(raw),scopes=detach(approvedScopes);
  const checked=await inspect(copy,scopes);
  return checked.valid?projection(checked.state):checked;
 }catch{return fail('INVALID_HISTORY');}
}
export async function applyDocumentHistoryOperation(raw:unknown,approvedScopes:unknown,request:unknown):Promise<(Success&{changed:boolean})|Failure>{
 try{
  const copy=detach(raw),scopes=detach(approvedScopes),q=detach(request);
  if(!exact(q,['mode','eventId','expectedHead','operation'])||q.mode!=='SYNTHETIC_ONLY'||!demo(q.eventId)||
     !(q.expectedHead===null||digest(q.expectedHead)))return fail('INVALID_REQUEST');
  const checked=await inspect(copy,scopes);if(!checked.valid)return checked;
  const state=checked.state,prior=state.byEvent.get(q.eventId);
  // A retry is recognized by the entire original operation and original
  // expected head, not just its ID or payload digest. Return current state.
  if(prior){
   if(prior.previousEventDigest!==q.expectedHead||canonical(prior.operation)!==canonical(q.operation))return fail('CONFLICT');
   return {...projection(state),changed:false};
  }
  if(q.expectedHead!==state.head)return fail('STALE_HEAD');
  if(state.events.length>=maxEvents)return fail('INVALID_HISTORY');
  const accepted=await accept(state,q.eventId,q.operation);if(!accepted.valid)return accepted;
  const unsigned={eventId:q.eventId,previousEventDigest:state.head,operation:accepted.operation};
  const hash=await eventHash(unsigned);
  state.events.push(freeze({...unsigned,eventDigest:hash}));
  // Ensure the new collection satisfies the same bounded data contract as
  // a historical read; never emit an archive that cannot be detached again.
  detach({schemaVersion:1,labOnly:true,events:state.events});
  return {...projection(state),changed:true};
 }catch{return fail('INVALID_REQUEST');}
}
