/** DOC-01/D4c3c2 — isolated V8 plaintext data codec and lossless pre-restore policy.
 * Existing V2 encrypted envelope and V6/V7 downgrade fence remain unchanged.
 * No production export, DB2/Android commit, SAF readback, authenticated recovery
 * grant or UI authority. A logical checkpoint is not a physical backup.
 */
import type {CompleteSecureAppSnapshot} from './secureAppStorage';
import type {DocumentHistoryV1} from '../documents/documentHistoryTransitions';
import type {AppData} from '../types';
import {validateDocumentHistory} from '../documents/documentHistoryTransitions';
import {inspectDocumentHistoryRecovery} from './documentHistoryRecovery';
import {assertNoUnsupportedDocumentHistory} from './documentHistoryBackupFence';
import {createAssessmentBackupPayloadV7,inspectAssessmentBackupPayload} from './assessmentBackupPayload';
import {preservesAssessmentHistory} from './assessmentRestorePolicy';
import {sameDb2Physical} from './db2PhysicalLifecycle';
import {withoutLocalBackupVerification} from '../persistence/backupCheckpoint';
import {normalizeLoadedCopilotState} from '../copilot/state';

export const DOCUMENT_BACKUP_DATA_VERSION_V8=8;
export type DocumentSnapshotV8=Omit<CompleteSecureAppSnapshot,'appData'>&{appData:AppData&{documentHistoryV1:DocumentHistoryV1}};
export interface DocumentBackupPayloadV8{
 readonly app:'registro-docente';
 readonly backupDataVersion:8;
 readonly exportedAt:string;
 readonly snapshot:DocumentSnapshotV8;
}
export interface DocumentBackupInspectionV8{
 readonly sourceVersion:8;
 readonly snapshot:DocumentSnapshotV8;
 /** Conservatively requires later explicit consent, never authorizes restore. */
 readonly replacementRequiresReview:boolean;
}

type Row=Record<string,unknown>;
const own=(v:object,k:string)=>Object.prototype.hasOwnProperty.call(v,k);
const row=(v:unknown):v is Row=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const invalid=():never=>{throw Error('DOC01_V8_REJECTED');};
const ROOT=['app','backupDataVersion','exportedAt','snapshot'];
const emptyHistory=():DocumentHistoryV1=>({schemaVersion:1,labOnly:true,events:[]});
const exact=(v:unknown,keys:readonly string[]):v is Row=>row(v)&&Object.keys(v).length===keys.length&&keys.every(k=>own(v,k));

/** Descriptor-only bounded JSON copy; never executes getters, toJSON or
 * prototype setters. Unlike the bounded DOC-01 record copier, this one also
 * accommodates large existing library and planning datasets in a V8 snapshot.
 * V7 performs the final portable-settings/assessment/schema validation.
 */
function detachJson(raw:unknown):unknown{
 const ancestors=new Set<object>();
 let budget=1000000;
 function visit(v:unknown,depth:number):unknown{
  if(--budget<0||depth>64)return invalid();
  if(v===null||typeof v==='boolean'||typeof v==='string')return v;
  if(typeof v==='number'&&Number.isFinite(v))return v;
  if(typeof v!=='object'||v===null||ancestors.has(v))return invalid();
  ancestors.add(v);
  try{
   const proto=Object.getPrototypeOf(v),keys=Reflect.ownKeys(v);
   if(Array.isArray(v)){
    const length=Object.getOwnPropertyDescriptor(v,'length')?.value;
    if(proto!==Array.prototype||!Number.isSafeInteger(length)||length<0||length>100000||keys.length!==length+1)return invalid();
    const out:unknown[]=[];
    for(let i=0;i<length;i++){
     const d=Object.getOwnPropertyDescriptor(v,String(i));
     if(!d||!d.enumerable||!own(d,'value'))return invalid();
     out.push(visit(d.value,depth+1));
    }
    return out;
   }
   if(proto!==Object.prototype&&proto!==null)return invalid();
   const out:Row={};
   for(const k of keys){
    if(typeof k!=='string'||['__proto__','constructor','prototype','toJSON'].includes(k))return invalid();
    const d=Object.getOwnPropertyDescriptor(v,k);
    if(!d||!d.enumerable||!own(d,'value'))return invalid();
    out[k]=visit(d.value,depth+1);
   }
   return out;
  }finally{ancestors.delete(v);}
 }
 return visit(raw,0);
}

function peel(raw:unknown,requireHistory:boolean):{clean:CompleteSecureAppSnapshot;history:unknown|null}{
 const x=detachJson(raw);
 if(!row(x)||!row(x.appData))return invalid();
 const a=x.appData;
 if(requireHistory&&!own(a,'documentHistoryV1'))return invalid();
 const history=own(a,'documentHistoryV1')?a.documentHistoryV1:null;
 delete a.documentHistoryV1;
 // V6/V7 must still refuse every reserved alias. Only this explicit root
 // may be removed for V8's separate independently validated domain.
 assertNoUnsupportedDocumentHistory(x);
 return {clean:x as unknown as CompleteSecureAppSnapshot,history};
}
async function validatedHistory(raw:unknown,scopes:unknown):Promise<DocumentHistoryV1>{
 const result=await validateDocumentHistory(raw,scopes);
 if(!result.valid)return invalid();
 return result.archive;
}

/** Explicit V8 selection only: never auto-upgrade, invent an empty document
 * history on a V6/V7 archive, or modify the historic backup serializer.
 */
export async function createDocumentBackupPayloadV8(
 snapshot:unknown,assessmentScopes:unknown,documentScopes:unknown,exportedAt:string
):Promise<DocumentBackupPayloadV8>{
 try{
  const detached=peel(snapshot,true);
  const docs=await validatedHistory(detached.history,detachJson(documentScopes));
  const v7=await createAssessmentBackupPayloadV7(detached.clean,detachJson(assessmentScopes),exportedAt);
  return {app:'registro-docente',backupDataVersion:8,exportedAt,
   snapshot:{...v7.snapshot,appData:{...v7.snapshot.appData,documentHistoryV1:docs}}};
 }catch{return invalid();}
}

/** Inspection only, deliberately outside V6/V7. Both sets of independent
 * scopes are supplied by the caller; no permission inferred from the file.
 */
export async function inspectDocumentBackupPayloadV8(
 payload:unknown,current:CompleteSecureAppSnapshot,assessmentScopes:unknown,documentScopes:unknown
):Promise<DocumentBackupInspectionV8>{
 try{
  const p=detachJson(payload),prior=peel(current,false),scopes=detachJson(documentScopes);
  if(!exact(p,ROOT)||p.app!=='registro-docente'||p.backupDataVersion!==8)return invalid();
  const candidate=peel(p.snapshot,true);
  const previousDocs=await validatedHistory(prior.history??emptyHistory(),scopes);
  const incomingDocs=await validatedHistory(candidate.history,scopes);
  const converted={app:'registro-docente',backupDataVersion:7,exportedAt:p.exportedAt,snapshot:candidate.clean};
  const inspected=await inspectAssessmentBackupPayload(converted,prior.clean,detachJson(assessmentScopes));
  if(inspected.sourceVersion!==7)return invalid();
  return {sourceVersion:8,
   snapshot:{...inspected.snapshot,appData:{...inspected.snapshot.appData,documentHistoryV1:incomingDocs}},
   replacementRequiresReview:previousDocs.events.length>0||inspected.replacementRequiresReview};
 }catch{return invalid();}
}

/** Pure replacement preparation, not a restore grant. Preserve every
 * historical document event and confirmed assessment revision, require an
 * independently inspected exact V8 recovery copy of current logical state.
 * No physical bytes are written or regarded as durably verified here.
 */
export async function projectDocumentRestoreV8(
 current:CompleteSecureAppSnapshot,incoming:unknown,recovery:unknown,
 currentAssessmentScopes:unknown,incomingAssessmentScopes:unknown,documentScopes:unknown
):Promise<CompleteSecureAppSnapshot>{
 try{
  const committed=detachJson(current) as CompleteSecureAppSnapshot;
  const incomingCopy=detachJson(incoming);
  const recoveryCopy=detachJson(recovery);
  const oldAssessment=detachJson(currentAssessmentScopes);
  const nextAssessment=detachJson(incomingAssessmentScopes);
  const docs=detachJson(documentScopes);
  if(!row(recoveryCopy)||typeof recoveryCopy.exportedAt!=='string')return invalid();
  const previous=await createDocumentBackupPayloadV8(committed,oldAssessment,docs,recoveryCopy.exportedAt);
  const checkpoint=await inspectDocumentBackupPayloadV8(recoveryCopy,committed,oldAssessment,docs);
  const proposed=await inspectDocumentBackupPayloadV8(incomingCopy,committed,nextAssessment,docs);
  const cleanCurrent={...committed,meta:withoutLocalBackupVerification(committed.meta)};
  if(!sameDb2Physical(previous.snapshot,cleanCurrent))return invalid();
  const canonicalCheckpoint={...previous.snapshot,meta:{changes:0,lastBackup:recoveryCopy.exportedAt}};
  if(!sameDb2Physical(checkpoint.snapshot,previous.snapshot)&&
     !sameDb2Physical(checkpoint.snapshot,canonicalCheckpoint))return invalid();
  const check=await inspectDocumentHistoryRecovery(
    previous.snapshot.appData.documentHistoryV1,
    proposed.snapshot.appData.documentHistoryV1,
    checkpoint.snapshot.appData.documentHistoryV1,docs);
  if(!check.valid)return invalid();
  if(!preservesAssessmentHistory(previous.snapshot.appData,proposed.snapshot.appData,
     oldAssessment as Parameters<typeof preservesAssessmentHistory>[2],
     nextAssessment as Parameters<typeof preservesAssessmentHistory>[3]))return invalid();
  return {...proposed.snapshot,
   copilotState:normalizeLoadedCopilotState(proposed.snapshot.copilotState),
   meta:withoutLocalBackupVerification(proposed.snapshot.meta)};
 }catch{return invalid();}
}
