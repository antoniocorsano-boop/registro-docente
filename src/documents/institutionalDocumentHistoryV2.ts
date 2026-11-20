/** DOC-01/D4c3e3 — separate institutional document model.
 * Explicitly NOT a migration of the demo-only V1 history or V8 codec.
 * SHA256 provides accidental/causal tamper detection, NOT authorship or signatures. */
export type InstitutionalDocumentKindV2='final-report'|'program-completed'|'disciplinary-plan'|'council-disciplinary-contribution';
export type InstitutionalDocumentScopeV2=Readonly<{institutionCode:string;siteCode:string;schoolYear:string;schoolOrder:'lower-secondary';gradeLevel:1|2|3;classId:string;subjectCode:string;purpose:'disciplinary-plan'|'council-contribution'}>;
export type InstitutionalDocumentSectionV2=Readonly<{field:string;text:string}>;
export type InstitutionalDocumentRecordV2=Readonly<{
 schemaVersion:2;labOnly:false;official:false;approval:'teacher-confirmed';documentId:string;revisionId:string;
 revisionNumber:number;previousRevisionId:string|null;revisionReason:'initial'|'content-update'|'source-update'|'correction';
 kind:InstitutionalDocumentKindV2;scope:InstitutionalDocumentScopeV2;
 confirmedAt:string;title:string;sections:readonly InstitutionalDocumentSectionV2[];
 contentDigest:string;
}>;
export type InstitutionalDocumentEventV2=Readonly<{eventId:string;previousDigest:string|null;operation:
 |{kind:'append';record:InstitutionalDocumentRecordV2}
 |{kind:'revoke';documentId:string;revisionId:string;reason:'withdrawn'|'correction-required';confirmedAt:string;confirmedByTeacher:true};
 eventDigest:string}>;
export type InstitutionalDocumentHistoryV2=Readonly<{schemaVersion:2;labOnly:false;events:readonly InstitutionalDocumentEventV2[]}>;
export type InstitutionalDocumentInspectionV2={valid:true;archive:InstitutionalDocumentHistoryV2;head:string|null;confirmedCount:number;revokedCount:number}
 |{valid:false;issue:string};

import {
 detachHistoricalDocumentData,canonicalHistoricalDocumentData,freezeHistoricalDocumentData
} from './documentHistoricalValidation';
type Row=Record<string,unknown>;
type StateEntry={record:InstitutionalDocumentRecordV2;status:'confirmed'|'revoked';lastAt:string};
type Replay={events:InstitutionalDocumentEventV2[];head:string|null;documents:Map<string,StateEntry>;used:Set<string>};
const invalid=():never=>{throw Error('DOC01_INSTITUTIONAL_V2_REJECTED');};
const failure=(issue:string):InstitutionalDocumentInspectionV2=>({valid:false,issue});
const own=(v:object,k:string)=>Object.prototype.hasOwnProperty.call(v,k);
const row=(v:unknown):v is Row=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const exact=(v:unknown,keys:readonly string[]):v is Row=>row(v)&&Object.keys(v).length===keys.length&&keys.every(k=>own(v,k));
const uuid=(v:unknown):v is string=>typeof v==='string'&&
 /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
const digest=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{64}$/.test(v);
const stamp=(v:unknown):v is string=>{
 if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v))return false;
 const d=Date.parse(v);return Number.isFinite(d)&&new Date(d).toISOString()===v;
};
const professional=(v:unknown,max:number):v is string=>typeof v==='string'&&
 v.length<=max&&v.trim().length>=2&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v);
const scopeKeys=['institutionCode','siteCode','schoolYear','schoolOrder','gradeLevel','classId','subjectCode','purpose'];
const recordKeys=['schemaVersion','labOnly','official','approval','documentId','revisionId',
 'revisionNumber','previousRevisionId','revisionReason','kind','scope','confirmedAt','title','sections'];
const fields=new Set(['obiettivi','contenuti','attivita','verifiche','risultati','riflessioni','riferimenti']);
const kinds=new Set(['final-report','program-completed','disciplinary-plan','council-disciplinary-contribution']);
const reasons=new Set(['initial','content-update','source-update','correction']);
function validateScope(raw:unknown):raw is InstitutionalDocumentScopeV2{
 if(!exact(raw,scopeKeys))return false;
 if(typeof raw.institutionCode!=='string'||!/^[A-Z0-9]{8,12}$/.test(raw.institutionCode)||
    typeof raw.siteCode!=='string'||!/^[A-Z0-9]{8,12}$/.test(raw.siteCode)||
    raw.schoolYear!=='2026/2027'||raw.schoolOrder!=='lower-secondary'||
    ![1,2,3].includes(raw.gradeLevel as number)||typeof raw.classId!=='string'||
    !/^[123][A-Z]$/.test(raw.classId)||raw.classId[0]!==String(raw.gradeLevel)||
    typeof raw.subjectCode!=='string'||!/^[A-Z]{2,12}$/.test(raw.subjectCode)||
    !['disciplinary-plan','council-contribution'].includes(raw.purpose as string))return false;
 return true;
}
function isUnsignedRecord(raw:unknown):raw is Row{
 if(!exact(raw,recordKeys)||raw.schemaVersion!==2||raw.labOnly!==false||
    raw.official!==false||raw.approval!=='teacher-confirmed'||
    !uuid(raw.documentId)||!uuid(raw.revisionId)||raw.documentId===raw.revisionId||
    !Number.isSafeInteger(raw.revisionNumber)||(raw.revisionNumber as number)<1||
    (raw.revisionNumber as number)>500||
    !reasons.has(raw.revisionReason as string)||!kinds.has(raw.kind as string)||
    !validateScope(raw.scope)||!stamp(raw.confirmedAt)||
    !professional(raw.title,160)||!Array.isArray(raw.sections)||
    raw.sections.length<1||raw.sections.length>24)return false;
 if(raw.revisionNumber===1){
  if(raw.previousRevisionId!==null||raw.revisionReason!=='initial')return false;
 }else if(!uuid(raw.previousRevisionId)||raw.previousRevisionId===raw.revisionId||
          raw.previousRevisionId===raw.documentId||raw.revisionReason==='initial')return false;
 const council=raw.kind==='council-disciplinary-contribution';
 if(raw.scope.purpose!==(council?'council-contribution':'disciplinary-plan'))return false;
 const date=raw.confirmedAt.slice(0,10);
 if(date<'2026-09-01'||date>'2027-08-31')return false;
 const taken=new Set<string>();
 for(const section of raw.sections){
  if(!exact(section,['field','text'])||typeof section.field!=='string'||
     !fields.has(section.field)||taken.has(section.field)||
     !professional(section.text,4000))return false;
  taken.add(section.field);
 }
 return true;
}
async function hashed(tag:string,unsigned:unknown):Promise<string>{
 const copy=detachHistoricalDocumentData([tag,unsigned]);
 const bytes=new TextEncoder().encode(canonicalHistoricalDocumentData(copy));
 const result=await crypto.subtle.digest('SHA-256',bytes);
 return Array.from(new Uint8Array(result),value=>value.toString(16).padStart(2,'0')).join('');
}
async function checkedRecord(raw:unknown):Promise<InstitutionalDocumentRecordV2>{
 const record=detachHistoricalDocumentData(raw);
 if(!exact(record,[...recordKeys,'contentDigest'])||!digest(record.contentDigest))return invalid();
 const {contentDigest,...unsigned}=record;
 if(!isUnsignedRecord(unsigned)||contentDigest!==await hashed('DOC-01/institutional-record/v2',unsigned))return invalid();
 return freezeHistoricalDocumentData({...unsigned,contentDigest}) as InstitutionalDocumentRecordV2;
}
export async function createInstitutionalDocumentRecordV2(raw:unknown):Promise<InstitutionalDocumentRecordV2>{
 try{
  const unsigned=detachHistoricalDocumentData(raw);
  if(!isUnsignedRecord(unsigned))return invalid();
  const contentDigest=await hashed('DOC-01/institutional-record/v2',unsigned);
  return freezeHistoricalDocumentData({...unsigned,contentDigest}) as InstitutionalDocumentRecordV2;
 }catch{return invalid();}
}
const emptyState=():Replay=>({events:[],head:null,documents:new Map(),used:new Set()});
const eventKeys=['eventId','previousDigest','operation','eventDigest'];
function inspectInput(raw:unknown,scope:unknown):{history:Row;approved:InstitutionalDocumentScopeV2}|null{
 const copied=detachHistoricalDocumentData(raw),approved=detachHistoricalDocumentData(scope);
 if(!validateScope(approved)||!exact(copied,['schemaVersion','labOnly','events'])||
    copied.schemaVersion!==2||copied.labOnly!==false||!Array.isArray(copied.events)||
    copied.events.length>1000)return null;
 return {history:copied,approved};
}
async function acceptOperation(state:Replay,raw:unknown,approved:InstitutionalDocumentScopeV2):Promise<InstitutionalDocumentEventV2['operation']>{
 if(!row(raw))return invalid();
 if(raw.kind==='append'){
  if(!exact(raw,['kind','record']))return invalid();
  const record=await checkedRecord(raw.record);
  if(canonicalHistoricalDocumentData(record.scope)!==canonicalHistoricalDocumentData(approved)||
     state.used.has(record.documentId)&&!state.documents.has(record.documentId)||
     state.used.has(record.revisionId))return invalid();
  const previous=state.documents.get(record.documentId);
  if(!previous){
   if(record.revisionNumber!==1||record.previousRevisionId!==null||
      record.revisionReason!=='initial')return invalid();
  }else{
   if(record.revisionNumber!==previous.record.revisionNumber+1||
      record.previousRevisionId!==previous.record.revisionId||
      canonicalHistoricalDocumentData(record.scope)!==canonicalHistoricalDocumentData(previous.record.scope)||
      record.kind!==previous.record.kind||record.confirmedAt<previous.lastAt||
      (previous.status==='revoked'&&record.revisionReason!=='correction'))return invalid();
  }
  state.documents.set(record.documentId,{record,status:'confirmed',lastAt:record.confirmedAt});
  state.used.add(record.documentId);
  state.used.add(record.revisionId);
  return freezeHistoricalDocumentData({kind:'append',record});
 }
 if(raw.kind==='revoke'){
  if(!exact(raw,['kind','documentId','revisionId','reason','confirmedAt','confirmedByTeacher'])||
     !uuid(raw.documentId)||!uuid(raw.revisionId)||!stamp(raw.confirmedAt)||
     !['withdrawn','correction-required'].includes(raw.reason as string)||
     raw.confirmedByTeacher!==true)return invalid();
  const previous=state.documents.get(raw.documentId);
  if(!previous||previous.status!=='confirmed'||previous.record.revisionId!==raw.revisionId||
     raw.confirmedAt<previous.lastAt)return invalid();
  state.documents.set(raw.documentId,{...previous,status:'revoked',lastAt:raw.confirmedAt as string});
  return freezeHistoricalDocumentData({...raw}) as InstitutionalDocumentEventV2['operation'];
 }
 return invalid();
}
async function inspect(raw:unknown,scope:unknown):Promise<{state:Replay;approved:InstitutionalDocumentScopeV2}>{
 const input=inspectInput(raw,scope);
 if(!input)return invalid();
 const state=emptyState();
 for(const event of input.history.events as unknown[]){
  if(!exact(event,eventKeys)||!uuid(event.eventId)||state.used.has(event.eventId)||
     event.previousDigest!==state.head||!digest(event.eventDigest))return invalid();
  const operation=await acceptOperation(state,event.operation,input.approved);
  if(state.used.has(event.eventId))return invalid();
  const unsigned={eventId:event.eventId,previousDigest:state.head,operation};
  const newDigest=await hashed('DOC-01/institutional-event/v2',unsigned);
  if(newDigest!==event.eventDigest)return invalid();
  state.used.add(event.eventId);
  state.events.push(freezeHistoricalDocumentData({...unsigned,eventDigest:newDigest}));
  state.head=newDigest;
 }
 return {state,approved:input.approved};
}
function projection(state:Replay):InstitutionalDocumentInspectionV2{
 const confirmedCount=[...state.documents.values()].filter(x=>x.status==='confirmed').length;
 const revokedCount=[...state.documents.values()].filter(x=>x.status==='revoked').length;
 const archive:InstitutionalDocumentHistoryV2=freezeHistoricalDocumentData({
  schemaVersion:2,labOnly:false,events:state.events.slice()
 });
 return {valid:true,archive,head:state.head,confirmedCount,revokedCount};
}
export async function validateInstitutionalDocumentHistoryV2(raw:unknown,scope:unknown):Promise<InstitutionalDocumentInspectionV2>{
 try{return projection((await inspect(raw,scope)).state);}catch{return failure('INVALID_INSTITUTIONAL_HISTORY');}
}
async function transition(raw:unknown,scope:unknown,operation:unknown,expectedHead:string|null,eventId:string):Promise<InstitutionalDocumentInspectionV2>{
 try{
  const {state,approved}=await inspect(raw,scope);
  if(!uuid(eventId)||state.used.has(eventId)||expectedHead!==state.head||
     state.events.length>=1000)return failure('STALE_OR_CONFLICT');
  const safe=await acceptOperation(state,detachHistoricalDocumentData(operation),approved);
  if(state.used.has(eventId))return failure('CONFLICT');
  const unsigned={eventId,previousDigest:state.head,operation:safe};
  const eventDigest=await hashed('DOC-01/institutional-event/v2',unsigned);
  state.events.push(freezeHistoricalDocumentData({...unsigned,eventDigest}));
  state.used.add(eventId);state.head=eventDigest;
  return projection(state);
 }catch{return failure('INVALID_TRANSITION');}
}
export async function appendInstitutionalDocumentV2(history:unknown,scope:unknown,record:unknown,expectedHead:string|null,eventId:string):Promise<InstitutionalDocumentInspectionV2>{
 return transition(history,scope,{kind:'append',record},expectedHead,eventId);
}
export async function revokeInstitutionalDocumentV2(history:unknown,scope:unknown,revoke:unknown,expectedHead:string|null,eventId:string):Promise<InstitutionalDocumentInspectionV2>{
 return transition(history,scope,{kind:'revoke',...(row(revoke)?revoke:{})},expectedHead,eventId);
}
