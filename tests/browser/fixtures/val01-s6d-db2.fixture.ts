import {createInstitutionalDocumentRecordV2,appendInstitutionalDocumentV2,
 revokeInstitutionalDocumentV2,validateInstitutionalDocumentHistoryV2} from '../../../src/documents/institutionalDocumentHistoryV2';
import {createInstitutionalBackupPayloadV9} from '../../../src/security/institutionalBackupPayloadV9';
import {createInstitutionalDb2RecoveryDriver} from '../../../src/security/institutionalDb2RecoveryOwner';
import {createInstitutionalRecoveryDecision} from '../../../src/security/institutionalRecoveryDecision';
import {createDocumentDb2RecoveryDriver} from '../../../src/security/documentDb2RecoveryOwner';
import {createDocumentRecoveryDecision} from '../../../src/security/documentRecoveryDecision';
// Synthetic browser fixture only. Never imported by the product entrypoint.
import {boardDocument,boardScope} from './val01-s6c-data';
import {createInitialArchiveSnapshot} from '../../../src/security/initialArchiveSetup';
import {IndexedDbVaultStore} from '../../../src/security/vaultStore';
import {SecureVault} from '../../../src/security/secureVault';
import {SecureAppStorage,type CompleteSecureAppSnapshot} from '../../../src/security/secureAppStorage';
import {ExistingSessionVaultStore} from '../../../src/security/existingSessionVaultStore';
import {createAuthorizedVaultMigration} from '../../../src/security/authorizedVaultMigration';
import {captureDb2,sameDb2Physical} from '../../../src/security/db2PhysicalLifecycle';
import {createDb2Lifecycle} from '../../../src/security/db2Lifecycle';
import {createBackupPayload} from '../../../src/security/backupPayload';
import {encryptDataWithPassword,decryptDataWithPassword} from '../../../src/cryptoUtils';
import {createVersionedBackupReceiptAuthority} from '../../../src/persistence/versionedBackupReceipt';
import {inspectAssessmentBackupPayload,createAssessmentBackupPayloadV7} from '../../../src/security/assessmentBackupPayload';
import {createDurableMutationCoordinator} from '../../../src/persistence/durableMutationCoordinator';
import {commitAssessmentEvidence} from '../../../src/persistence/assessmentEvidenceCommit';
import {incrementBackupChanges} from '../../../src/persistence/backupCheckpoint';
import {validateAssessmentArchiveV1,type AssessmentArchiveV1} from '../../../src/assessment/assessmentArchive';
import {deriveConfirmedEvidenceMutation,type EvidenceCommitRequest} from '../../../src/assessment/assessmentEvidenceMutation';
import {previewIndividualObservation} from '../../../src/assessment/individualObservation';
import {previewEvidenceRevision} from '../../../src/assessment/individualEvidenceRevision';
import {projectEvidenceBoard} from '../../../src/assessment/individualEvidenceBoard';
import type {AppData,ClassData} from '../../../src/types';
import {commitDocumentHistoryOperation} from '../../../src/persistence/documentHistoryCommit';
import {applyDocumentHistoryOperation,validateDocumentHistory} from '../../../src/documents/documentHistoryTransitions';
import {createDocumentBackupPayloadV8} from '../../../src/security/documentBackupPayloadV8';


const name='registro-docente-secure-vault',password='synthetic-db2-laboratory-only',copyPassword='synthetic-copy-laboratory-only';
const stamp='2026-11-22T10:04:00.000Z';
const approved=[{classId:boardScope.classId,schoolYear:boardScope.schoolYear,subjectCode:boardScope.subjectCode}];
type EvidenceClass=ClassData & {assessmentEvidenceV1?:AssessmentArchiveV1};
const section=(a:AppData)=>(a.classes[0] as EvidenceClass).assessmentEvidenceV1!.documents[0];
const demand=(ok:unknown)=>{if(!ok)throw Error('Synthetic DB2 assertion failed');};
const versions=async()=> (await indexedDB.databases()).find(x=>x.name===name)?.version??0;
let owner:{store:ExistingSessionVaultStore;vault:SecureVault;storage:SecureAppStorage;coordinator:ReturnType<typeof createDurableMutationCoordinator>;state:CompleteSecureAppSnapshot}|null=null;
const requireOwner=()=>{if(!owner)throw Error('Synthetic owner absent');return owner;};
async function close(){
 const current=owner;owner=null;
 if(current){await current.coordinator.sealAndDrain();current.vault.lock();await current.store.retireConnection();}
}
async function open(){
 if(owner)throw Error('Synthetic owner already active');
 const store=new ExistingSessionVaultStore(2),vault=new SecureVault(store);
 try{
  await vault.unlock(password);await store.verifyAuthenticatedRecords(password);
  const storage=new SecureAppStorage(vault),state=await storage.loadExactBackupSnapshot();
  if(!state)throw Error('Incomplete archive');
  demand(validateAssessmentArchiveV1(state.appData,approved).valid);
  owner={store,vault,storage,coordinator:createDurableMutationCoordinator(),state};
 }catch(e){vault.lock();await store.retireConnection();throw e;}
}
function freshSnapshot(){
 const x=createInitialArchiveSnapshot({mode:'professional',profile:{school:'Istituto sintetico',year:'2026/27',teacher:'Docente sintetico',subject:'Tecnologia'}});
 const klass:ClassData={id:boardScope.classId,name:'Classe sintetica',students:boardScope.studentIds.map((id,i)=>({id,name:'Fittizio '+i})),grades:[{id:'g1',studentId:'s1',date:'2026-11-20',type:'disegno',period:'Q1',title:'Prova numerica',value:'8'}],behaviors:[]};
 x.appData={classes:[klass],currentClassId:klass.id};return x;
}
async function seed(){
 demand(await versions()===0); // test on a fresh isolated origin only
 const x=freshSnapshot(),store=new IndexedDbVaultStore(),vault=new SecureVault(store);
 const storage=new SecureAppStorage(vault);
 await vault.initializeActive(password);
 let exact:CompleteSecureAppSnapshot;
 try{await storage.restoreSnapshotVerified(x);const loaded=await storage.loadExactBackupSnapshot();if(!loaded)throw Error('Incomplete synthetic seed');exact=loaded;}
 finally{vault.lock();await store.retireConnection();}
 const migration=createAuthorizedVaultMigration();
 try{
  const encrypted=await encryptDataWithPassword(createBackupPayload(exact,stamp),copyPassword);
  const grant=await migration.prepare(password,new Blob([encrypted]),copyPassword);
  await migration.migrate(grant,true);
 }finally{migration.invalidate();}
 demand(await versions()===2);
 await open();
 // Seed a prepared document only AFTER the DB2 fence. This is a synthetic
 // fixture setup, not an implementation of production preparation persistence.
 const o=requireOwner();
 const appData:AppData={...o.state.appData,classes:o.state.appData.classes.map(c=>({...c,assessmentEvidenceV1:{version:1,documents:[{document:structuredClone(boardDocument),bindings:[]}]}}))};
 demand(validateAssessmentArchiveV1(appData,approved).valid);
 await o.coordinator.enqueue({getCommitted:()=>o.state,derive:s=>({...s,appData}),persist:s=>o.storage.saveAppDataAndMeta(s.appData,s.meta),publish:s=>{o.state=s;}});
 return summary();
}
function summary(){
 const o=requireOwner(),d=section(o.state.appData).document;
 const p=projectEvidenceBoard(d,boardScope,'a2','c1');
 if(!p.valid)throw Error('Projection invalid');
 return {changes:o.state.meta.changes,states:d.evidence.filter(e=>e.evidenceId==='db2-e').map(e=>e.state),active:p.rows.find(r=>r.studentId==='s4')?.entries.map(e=>e.state),grades:o.state.appData.classes[0].grades.map(g=>g.value),records:d.evidence.length};
}
function review(action:'new'|'correct'|'withdraw'):EvidenceCommitRequest{
 const d=section(requireOwner().state.appData).document;
 if(action==='new'){
  const r=previewIndividualObservation(d,boardScope,{evidenceId:'db2-e',revisionId:'db2-r1',observationEventId:'db2-event',assessmentRevisionId:'a2',criterionRevisionId:'c1',studentId:'s4',observedOn:'2026-11-20',recordedAt:'2026-11-22T10:01:00.000Z',state:'observed',fact:{kind:'product',description:'Schema sintetico DB2',method:'Elaborato'},interpretation:{kind:'level',levelId:'l2'}});
  if(!r.valid)throw Error(r.issue);return {kind:'new',preview:r.preview};
 }
 const r=previewEvidenceRevision(d,boardScope,action==='correct'?{action:'correct',evidenceRevisionId:'db2-r1',revisionId:'db2-r2',recordedAt:'2026-11-22T10:02:00.000Z',state:'not_observed'}:{action:'withdraw',evidenceRevisionId:'db2-r2',revisionId:'db2-r3',recordedAt:'2026-11-22T10:03:00.000Z',reason:'Ritiro sintetico DB2'});
 if(!r.valid)throw Error(r.issue);return {kind:'revision',preview:r.preview};
}
async function commit(action:'new'|'correct'|'withdraw',abort=false){
 const o=requireOwner(),r=review(action);
 const confirmedAt=action==='new'?'2026-11-22T10:01:30.000Z':action==='correct'?'2026-11-22T10:02:30.000Z':'2026-11-22T10:03:30.000Z';
 const old=IDBObjectStore.prototype.put;
 let triggered=false,rejected=false;
 if(abort)IDBObjectStore.prototype.put=function(value:any,key?:IDBValidKey){
  const req=key===undefined?old.call(this,value):old.call(this,value,key);
  if(!triggered&&this.name==='records'&&value?.recordKey==='meta'&&this.transaction.mode==='readwrite'){triggered=true;this.transaction.abort();}
  return req;
 };
 try{
  await o.coordinator.enqueue({getCommitted:()=>o.state,
   derive:s=>({...s,appData:deriveConfirmedEvidenceMutation(s.appData,approved,boardScope,r,{confirmedByTeacher:true,confirmedAt}).appData,meta:incrementBackupChanges(s.meta)}),
   persist:s=>o.storage.saveAppDataAndMeta(s.appData,s.meta),publish:s=>{o.state=s;}});
 }catch(e){if(!abort)throw e;rejected=true;}
 finally{IDBObjectStore.prototype.put=old;}
 return {triggered,rejected,summary:summary()};
}
async function backup(){
 const o=requireOwner();
 return o.coordinator.enqueueTask(async()=>{
  const x=await o.storage.loadExactBackupSnapshot();if(!x)throw Error('Incomplete archive');
  const old=createVersionedBackupReceiptAuthority(6);
  let v6Rejected=false;try{await old.prepare(x,approved,copyPassword,stamp);}catch{v6Rejected=true;}
  const authority=createVersionedBackupReceiptAuthority(7);
  const p=await authority.prepare(x,approved,copyPassword,stamp);
  const verified=await authority.verifyWeb(p.receipt,new Blob([p.encryptedText]),()=>owner===o);
  const decoded=await decryptDataWithPassword(p.encryptedText,copyPassword);
  const inspected=await inspectAssessmentBackupPayload(decoded,freshSnapshot(),approved);
  // No durable receipt in this increment: legacy SecureMeta is V6 only.
  authority.invalidate();
  return {version:inspected.sourceVersion,verified,v6Rejected,exact:sameDb2Physical(inspected.snapshot.appData,x.appData),changes:summary().changes,encryptedText:p.encryptedText};
 });
}
async function rejectLegacy(){
 const before=await captureDb2(indexedDB),service=createDb2Lifecycle();
 const v6=await encryptDataWithPassword(createBackupPayload(freshSnapshot(),stamp),copyPassword);
 let rejected=false;try{await service.prepare({operation:'restore',password,file:new Blob([v6]),backupPassword:copyPassword});}catch{rejected=true;}finally{service.invalidate();}
 return {rejected,unchanged:sameDb2Physical(before,await captureDb2(indexedDB))};
}
async function physicalDigest(){
 const p=await captureDb2(indexedDB);if(p.state!=='active')throw Error('Not active');
 const out:Record<string,string>={};
 for(const r of p.records){const h=await crypto.subtle.digest('SHA-256',r.ciphertext);out[r.recordKey]=Array.from(new Uint8Array(h),v=>v.toString(16).padStart(2,'0')).join('');}
 return out;
}
async function downgrade(){
 const s=new IndexedDbVaultStore();let rejected=false;
 try{await s.getMetadata();}catch{rejected=true;}finally{await s.retireConnection();}
 return {rejected,version:await versions()};
}

// Synthetic restore qualification. No production caller or file picker.
async function restoreAssessment(mode:'approve'|'refuse'|'revoke'|'old'|'bad-recovery'|'wrong-scope'|'wrong-password'|'race'|'abort'|'after-commit'){
 const o=requireOwner(),current=await o.storage.loadExactBackupSnapshot();
 if(!current)throw Error('Incomplete synthetic archive');
 const generation=await o.store.getMetadata();if(!generation)throw Error('Missing generation');
 const recovery=await createAssessmentBackupPayloadV7(current,approved,stamp);
 let incoming=current;
 if(mode==='old'){
  incoming={...current,appData:{...current.appData,classes:current.appData.classes.map(c=>({...c,assessmentEvidenceV1:{version:1,documents:[{document:structuredClone(boardDocument),bindings:[]}]}}))}};
 }else{
  const candidate=deriveConfirmedEvidenceMutation(current.appData,approved,boardScope,review('new'),{confirmedByTeacher:true,confirmedAt:'2026-11-22T10:01:30.000Z'});
  incoming={...current,appData:candidate.appData,meta:incrementBackupChanges(current.meta)};
 }
 const target=await createAssessmentBackupPayloadV7(incoming,approved,stamp);
 const targetText=await encryptDataWithPassword(target,copyPassword);
 const recoveryText=await encryptDataWithPassword(mode==='bad-recovery'?target:recovery,copyPassword);
 const service=createDb2Lifecycle();
 const heldStore=new ExistingSessionVaultStore(2),held=new SecureVault(heldStore);
 await held.unlock(password);
 await close();
 const before=await captureDb2(indexedDB);
 let prepared=false,committed=false,replayRejected=false,oldOwnerRejected=false,triggered=false;
 let baseline=before;
 const oldPut=IDBObjectStore.prototype.put;
 try{
  let grant;
  try{
   grant=await service.prepareAssessmentRestore({operation:'restore-assessment',password:mode==='wrong-password'?'wrong':password,
    file:new Blob([targetText]),backupPassword:copyPassword,recoveryFile:new Blob([recoveryText]),recoveryPassword:copyPassword,
    currentScopes:approved,incomingScopes:mode==='wrong-scope'?[]:approved},generation);
   prepared=true;
  }catch{/* expected negative cases */}
  if(grant){
   if(mode==='race'){
    await held.put('meta',{changes:99,lastBackup:null});baseline=await captureDb2(indexedDB);
   }
   if(mode==='revoke')service.invalidate();
   if(mode==='abort'||mode==='after-commit')IDBObjectStore.prototype.put=function(value:any,key?:IDBValidKey){
    const req=key===undefined?oldPut.call(this,value):oldPut.call(this,value,key);
    if(!triggered&&this.name==='metadata'&&key==='current'&&this.transaction.mode==='readwrite'){
     triggered=true;
     if(mode==='abort')service.invalidate();
     else this.transaction.addEventListener('complete',()=>service.invalidate(),{once:true});
    }
    return req;
   };
   try{await service.commit(grant,mode!=='refuse');committed=true;}catch{/* negative or uncertain */}
   try{await service.commit(grant,true);}catch{replayRejected=true;}
   if(mode==='approve'||mode==='after-commit'){
    try{await held.put('meta',{changes:1000,lastBackup:null});}catch{oldOwnerRejected=true;}
   }
  }
 }finally{IDBObjectStore.prototype.put=oldPut;service.invalidate();held.lock();await heldStore.retireConnection();}
 const after=await captureDb2(indexedDB),unchanged=sameDb2Physical(baseline,after);
 const rotated=!sameDb2Physical(before.metadata,after.metadata);
 await open();
 const reopened=requireOwner().state;
 const exact=sameDb2Physical(reopened.appData,incoming.appData);
 return {prepared,committed,replayRejected,oldOwnerRejected,triggered,unchanged,rotated,exact,summary:summary()};
}

Object.assign(globalThis,{__val01Db2Evidence:{seed,open,close,summary,commit,backup,rejectLegacy,physicalDigest,downgrade,versions,restoreAssessment}});
document.getElementById('status')!.textContent='Laboratorio DB2 pronto';

// Native synthetic adapter: the wrapper supplies actual SAF-selected copies.
// No method is exposed through the product entrypoint or browser global.
export async function nativeRestoreCopies(){
 const o=requireOwner();
 return o.coordinator.enqueueTask(async()=>{
  const current=await o.storage.loadExactBackupSnapshot();if(!current)throw Error('Incomplete archive');
  const r=previewIndividualObservation(section(current.appData).document,boardScope,{evidenceId:'native-extra',revisionId:'native-extra-r1',observationEventId:'native-extra-event',assessmentRevisionId:'a2',criterionRevisionId:'c2',studentId:'s4',observedOn:'2026-11-20',recordedAt:'2026-11-22T10:05:00.000Z',state:'not_observed'});
  if(!r.valid)throw Error(r.issue);
  const incoming={...current,appData:deriveConfirmedEvidenceMutation(current.appData,approved,boardScope,{kind:'new',preview:r.preview},{confirmedByTeacher:true,confirmedAt:'2026-11-22T10:05:30.000Z'}).appData,meta:incrementBackupChanges(current.meta)};
  const recovery=await createAssessmentBackupPayloadV7(current,approved,stamp),target=await createAssessmentBackupPayloadV7(incoming,approved,stamp);
  return {recovery:await encryptDataWithPassword(recovery,copyPassword),target:await encryptDataWithPassword(target,copyPassword)};
 });
}
export async function nativePrepareSelectedRestore(recovery:Blob,target:Blob,signal:AbortSignal,wrong=false){
 const o=requireOwner();
 const generation=await o.store.getMetadata();
 if(!generation||signal.aborted)throw Error('Synthetic session expired');
 await close();
 const service=createDb2Lifecycle();
 const invalidate=()=>service.invalidate();
 signal.addEventListener('abort',invalidate,{once:true});
 try{
  if(signal.aborted)throw Error('Synthetic session expired');
  const grant=await service.prepareAssessmentRestore({operation:'restore-assessment',password,file:target,backupPassword:wrong?'wrong-synthetic':copyPassword,recoveryFile:recovery,recoveryPassword:copyPassword,currentScopes:approved,incomingScopes:approved},generation);
  if(signal.aborted)throw Error('Synthetic session expired');
  return {async commit(confirmed:boolean){
   try{if(signal.aborted)throw Error('Synthetic session expired');await service.commit(grant,confirmed);}
   finally{invalidate();signal.removeEventListener('abort',invalidate);}
  }};
 }catch(e){invalidate();signal.removeEventListener('abort',invalidate);throw e;}
}
export function nativeRestoredSummary(){
 const o=requireOwner(),d=section(o.state.appData).document;
 return {...summary(),extra:d.evidence.filter(e=>e.evidenceId==='native-extra').map(e=>({state:e.state,studentId:e.studentId,criterionRevisionId:e.criterionRevisionId}))};
}

// S6d.3: same real DB2 owner and canonical queue, consumed by the operational
// React fixture. Fault injection is limited to this synthetic adapter.
let operationalFault:'none'|'abort'|'hold'='none';
let releaseOperationalHold:(()=>void)|null=null;
export function armOperationalFault(fault:'abort'|'hold'){
 if(operationalFault!=='none'||releaseOperationalHold)throw Error('Synthetic fault already armed');
 operationalFault=fault;
}
export function releaseOperationalWrite(){if(!releaseOperationalHold)throw Error('No held synthetic write');releaseOperationalHold();}
export function operationalState(){
 const o=requireOwner();
 return {appData:structuredClone(o.state.appData),document:structuredClone(section(o.state.appData).document),changes:o.state.meta.changes};
}
export async function openOperationalArchive(){
 if(await versions()===0)await seed();else await open();
 return operationalState();
}
export async function recoverOperationalArchive(){
 await close();await open();return operationalState();
}
export async function commitOperationalEvidence(request:EvidenceCommitRequest,confirmation:unknown){
 const o=requireOwner(),fault=operationalFault;
 operationalFault='none';
 return commitAssessmentEvidence({
  coordinator:o.coordinator,isActive:()=>owner===o&&o.vault.isUnlocked(),
  getCommitted:()=>({appData:o.state.appData,meta:o.state.meta}),
  publish:next=>{o.state={...o.state,...next};},
  storage:{async saveAppDataAndMeta(appData,meta){
   if(fault==='hold'){
    await new Promise<void>(resolve=>{releaseOperationalHold=()=>{releaseOperationalHold=null;resolve();};});
    if(owner!==o)throw Error('Synthetic session expired');
   }
   const original=IDBObjectStore.prototype.put;
   if(fault==='abort')IDBObjectStore.prototype.put=function(value:any,key?:IDBValidKey){
    const r=key===undefined?original.call(this,value):original.call(this,value,key);
    if(this.name==='records'&&value?.recordKey==='meta'&&this.transaction.mode==='readwrite')this.transaction.abort();
    return r;
   };
   try{await o.storage.saveAppDataAndMeta(appData,meta);}
   finally{IDBObjectStore.prototype.put=original;}
  }}
 },approved,boardScope,request,confirmation);
}
export const operationalDiagnostics={
 arm:armOperationalFault,release:releaseOperationalWrite,held:()=>releaseOperationalHold!==null,
 physicalDigest,committed:()=>{
  const s=operationalState();
  return {changes:s.changes,revisionIds:s.document.evidence.map(e=>e.revisionId),grades:s.appData.classes[0].grades.map(g=>g.value)};
 }
};


/** DOC-01/D4c3d1 laboratory: v8 physical DB2 replacement, never a product
 * surface. Real IndexedDB v2 and actual encryption are used on synthetic
 * content; this fixture does not prove Android SAF or external copy readback.
 */
const docScope={institutionRef:'demo-school',siteRef:'demo-site',classId:'demo-synthetic-board',cohortRef:'demo-cohort',
 schoolYear:'2026/2027',schoolOrder:'lower_secondary',gradeLevel:2,subjectCode:'tecnologia',regimeRef:'demo-regime',
 purpose:'disciplinary-plan'};
const docPeriod={from:'2026-09-01',to:'2027-08-31'};
const docCanonical=(v:unknown):string=>Array.isArray(v)?'['+v.map(docCanonical).join(',')+']':
 v!==null&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+docCanonical((v as Record<string,unknown>)[k])).join(',')+'}':JSON.stringify(v);
async function docRecord(){
 const unsigned={
  schemaVersion:1,labOnly:true,official:false,complete:false,
  identity:{documentId:'demo-document',kind:'program-completed',scope:docScope,period:docPeriod,
   model:'disciplinary-second-third',mappingVersion:'2026-27-map-v1'},
  revision:{revisionId:'demo-revision-one',number:1,previousRevisionId:null,reason:'initial',state:'draft'},
  confirmedAt:'2026-11-19T16:00:00.000Z',confirmedByTeacher:true,
  preview:{official:false,complete:false,labOnly:true,kind:'program-completed',documentId:'demo-document',
   revisionId:'demo-revision-one',number:1,content:{official:false,complete:false,labOnly:true,
    coverage:'selected-only',period:docPeriod,recorded:{status:'selected',count:1,hours:1,
     activities:[{date:'2026-11-17',hours:1,title:'Attività dimostrativa'}]},
    coverageAssessment:'not-established',institutionalModel:'reference-only'}}
 };
 const h=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(docCanonical(['DOC-01/archive-candidate/v1',unsigned])));
 return {...unsigned,contentDigest:Array.from(new Uint8Array(h),b=>b.toString(16).padStart(2,'0')).join('')};
}
async function seedDocument(){
 await seed();
 const o=requireOwner(),record=await docRecord();
 const receipt=await commitDocumentHistoryOperation({
  coordinator:o.coordinator,storage:o.storage,
  isActive:()=>owner===o&&o.vault.isUnlocked(),
  getCommitted:()=>({appData:o.state.appData,meta:o.state.meta}),
  publish:next=>{o.state={...o.state,...next};},
  invalidate:()=>{o.vault.lock();}
 },[docScope],{mode:'SYNTHETIC_ONLY',eventId:'demo-event-one',expectedHead:null,operation:{kind:'append',record}});
 demand(receipt.verified&&receipt.changed);
 return docSummary();
}
function docSummary(){
 const o=requireOwner();
 const h=(o.state.appData as AppData&{documentHistoryV1?:unknown}).documentHistoryV1 as {events:unknown[]}|undefined;
 return {events:h?.events.length??0,changes:o.state.meta.changes,grades:o.state.appData.classes[0].grades.map(g=>g.value),
  assessmentRevisions:section(o.state.appData).document.evidence.length};
}
async function restoreDocument(mode:'approve'|'old'|'bad-recovery'|'wrong-scope'|'wrong-password'|'refuse'|'revoke'|'race'|'abort'|'after-commit'){
 const o=requireOwner(),current=await o.storage.loadExactBackupSnapshot();
 if(!current)throw Error('Incomplete document lab archive');
 const generation=await o.store.getMetadata();
 if(!generation)throw Error('No DB2 owner generation');
 const history=(current.appData as AppData&{documentHistoryV1?:any}).documentHistoryV1;
 if(!history||history.events.length!==1)throw Error('Document baseline unavailable');
 const record=await docRecord();
 const q={mode:'SYNTHETIC_ONLY',eventId:'demo-event-two',expectedHead:history.events[0].eventDigest,
  operation:{kind:'revoke',documentId:record.identity.documentId,revisionId:record.revision.revisionId,
   contentDigest:record.contentDigest,revokedAt:'2026-11-19T16:02:00.000Z',
   reason:'withdrawn',confirmedByTeacher:true}};
 const nextHistory=await applyDocumentHistoryOperation(history,[docScope],q);
 if(!nextHistory.valid)throw Error(nextHistory.issue);
 const targetData={...current,appData:{...current.appData,documentHistoryV1:
  mode==='old'?{schemaVersion:1,labOnly:true,events:[]}:nextHistory.archive},
  meta:incrementBackupChanges(current.meta)};
 const recoveryPayload=await createDocumentBackupPayloadV8(current,approved,[docScope],stamp);
 const targetPayload=await createDocumentBackupPayloadV8(targetData,approved,[docScope],stamp);
 const targetText=await encryptDataWithPassword(targetPayload,copyPassword);
 const recoveryText=await encryptDataWithPassword(mode==='bad-recovery'?targetPayload:recoveryPayload,copyPassword);
 const service=createDb2Lifecycle();
 const heldStore=new ExistingSessionVaultStore(2),held=new SecureVault(heldStore);
 await held.unlock(password);
 await close();
 const before=await captureDb2(indexedDB);
 let prepared=false,committed=false,replayRejected=false,oldOwnerRejected=false,triggered=false;
 let baseline=before;
 const oldPut=IDBObjectStore.prototype.put;
 try{
  let grant;
  try{
   grant=await service.prepareDocumentRestore({operation:'restore-document',
    password:mode==='wrong-password'?'incorrect':password,file:new Blob([targetText]),
    backupPassword:copyPassword,recoveryFile:new Blob([recoveryText]),recoveryPassword:copyPassword,
    currentAssessmentScopes:approved,incomingAssessmentScopes:approved,
    documentScopes:mode==='wrong-scope'?[]:[docScope]},generation);
   prepared=true;
  }catch{/* all rejected cases must leave DB unchanged */}
  if(grant){
   if(mode==='race'){await held.put('meta',{changes:99,lastBackup:null});baseline=await captureDb2(indexedDB);}
   if(mode==='revoke')service.invalidate();
   if(mode==='abort'||mode==='after-commit')IDBObjectStore.prototype.put=function(value:any,key?:IDBValidKey){
    const request=key===undefined?oldPut.call(this,value):oldPut.call(this,value,key);
    if(!triggered&&this.name==='metadata'&&key==='current'&&this.transaction.mode==='readwrite'){
     triggered=true;
     if(mode==='abort')service.invalidate();
     else this.transaction.addEventListener('complete',()=>service.invalidate(),{once:true});
    }
    return request;
   };
   try{await service.commit(grant,mode!=='refuse');committed=true;}catch{/* denied, aborted or uncertain */}
   try{await service.commit(grant,true);}catch{replayRejected=true;}
   if(mode==='approve'||mode==='after-commit'){
    try{await held.put('meta',{changes:1000,lastBackup:null});}catch{oldOwnerRejected=true;}
   }
  }
 }finally{IDBObjectStore.prototype.put=oldPut;service.invalidate();held.lock();await heldStore.retireConnection();}
 const after=await captureDb2(indexedDB);
 const unchanged=sameDb2Physical(baseline,after);
 const rotated=!sameDb2Physical(before.metadata,after.metadata);
 await open();
 const reopened=requireOwner().state;
 const check=await validateDocumentHistory((reopened.appData as AppData&{documentHistoryV1?:unknown}).documentHistoryV1,[docScope]);
 const exact=sameDb2Physical(reopened.appData,targetData.appData);
 const assessmentPreserved=sameDb2Physical(section(reopened.appData).document,section(current.appData).document);
 return {prepared,committed,replayRejected,oldOwnerRejected,triggered,unchanged,rotated,exact,
  assessmentPreserved,historyValid:check.valid,summary:docSummary()};
}
Object.assign(globalThis,{__doc01Db2Restore:{seed:seedDocument,restore:restoreDocument,summary:docSummary,close,open,physicalDigest}});


/** DOC-01/D4c3d2 — real DB2 V8 Android SAF evidence, synthetic only.
 * These exports are bundled exclusively into the isolated Android debug fixture.
 */
export async function nativeSeedDocumentHistory(){
 const o=requireOwner();
 if((o.state.appData as AppData&{documentHistoryV1?:unknown}).documentHistoryV1)throw Error('Synthetic history already exists');
 const record=await docRecord();
 const receipt=await commitDocumentHistoryOperation({
  coordinator:o.coordinator,storage:o.storage,
  isActive:()=>owner===o&&o.vault.isUnlocked(),
  getCommitted:()=>({appData:o.state.appData,meta:o.state.meta}),
  publish:next=>{o.state={...o.state,...next};},
  invalidate:()=>{o.vault.lock();}
 },[docScope],{mode:'SYNTHETIC_ONLY',eventId:'demo-event-one',expectedHead:null,operation:{kind:'append',record}});
 demand(receipt.verified&&receipt.changed);
 return nativeDocumentRestoredSummary();
}

export async function nativeDocumentRestoreCopies(){
 const o=requireOwner();
 return o.coordinator.enqueueTask(async()=>{
  const current=await o.storage.loadExactBackupSnapshot();
  if(!current)throw Error('Incomplete V8 archive');
  const history=(current.appData as AppData&{documentHistoryV1?:any}).documentHistoryV1;
  if(!history||history.events.length!==1)throw Error('Synthetic history is not ready');
  const record=await docRecord();
  const q={mode:'SYNTHETIC_ONLY',eventId:'demo-event-two',expectedHead:history.events[0].eventDigest,
   operation:{kind:'revoke',documentId:record.identity.documentId,revisionId:record.revision.revisionId,
    contentDigest:record.contentDigest,revokedAt:'2026-11-19T16:02:00.000Z',
    reason:'withdrawn',confirmedByTeacher:true}};
  const transition=await applyDocumentHistoryOperation(history,[docScope],q);
  if(!transition.valid)throw Error(transition.issue);
  const next={...current,appData:{...current.appData,documentHistoryV1:transition.archive},
   meta:incrementBackupChanges(current.meta)};
  const recovery=await createDocumentBackupPayloadV8(current,approved,[docScope],stamp);
  const target=await createDocumentBackupPayloadV8(next,approved,[docScope],stamp);
  // Only complete ciphertext leaves the synthetic preparation layer.
  return {recovery:await encryptDataWithPassword(recovery,copyPassword),
   target:await encryptDataWithPassword(target,copyPassword)};
 });
}

export async function nativePrepareSelectedDocumentRestore(recovery:Blob,target:Blob,signal:AbortSignal,wrong=false){
 const o=requireOwner();
 const generation=await o.store.getMetadata();
 if(!generation||signal.aborted)throw Error('Synthetic document session expired');
 await close();
 const service=createDb2Lifecycle();
 const invalidate=()=>service.invalidate();
 signal.addEventListener('abort',invalidate,{once:true});
 try{
  if(signal.aborted)throw Error('Synthetic document session expired');
  const grant=await service.prepareDocumentRestore({operation:'restore-document',password,
   file:target,backupPassword:wrong?'wrong-synthetic':copyPassword,
   recoveryFile:recovery,recoveryPassword:copyPassword,
   currentAssessmentScopes:approved,incomingAssessmentScopes:approved,documentScopes:[docScope]},generation);
  if(signal.aborted)throw Error('Synthetic document session expired');
  return {async commit(confirmed:boolean){
   try{if(signal.aborted)throw Error('Synthetic document session expired');await service.commit(grant,confirmed);}
   finally{invalidate();signal.removeEventListener('abort',invalidate);}
  }};
 }catch(e){invalidate();signal.removeEventListener('abort',invalidate);throw e;}
}

export function nativeDocumentRestoredSummary(){return inspectNativeDocumentRestoredSummary();}
async function inspectNativeDocumentRestoredSummary(){
 const o=requireOwner();
 const history=(o.state.appData as AppData&{documentHistoryV1?:unknown}).documentHistoryV1;
 const inspected=await validateDocumentHistory(history,[docScope]);
 if(!inspected.valid)throw Error('DOC-01 historical integrity failure');
 return {...docSummary(),historyValid:true,
  eventKinds:inspected.archive.events.map(event=>event.operation.kind),
  version:await versions()};
}


/** DOC-01/D4c3e2: isolated real DB2 owner adapter, no production binding.
 * This fixture executes actual IndexedDB2, the V8 cipher and one-use commit.
 * The native Android picker was separately qualified in DOC-01/D4c3d2.
 */
let docOwnerScenario='actual-restore';
let docOwnerToken='synthetic-epoch-1';
let docOwnerDriver:ReturnType<typeof createDocumentRecoveryDecision>|null=null;
let docOwnerOld:ReturnType<typeof requireOwner>|null=null;
let docOwnerCopies:Awaited<ReturnType<typeof nativeDocumentRestoreCopies>>|null=null;
const ownerDecision=()=>{if(!docOwnerDriver)throw Error('DOC-01 owner not initialized');return docOwnerDriver;};
async function docOwnerSeed(mode:string){
 if(!['actual-restore','stale-owner','cancelled','wrong-recovery','same-epoch'].includes(mode))throw Error('Unknown scenario');
 docOwnerScenario=mode;docOwnerToken='synthetic-epoch-1';
 await seedDocument();
 docOwnerOld=requireOwner();
 docOwnerCopies=await nativeDocumentRestoreCopies();
 const original=docOwnerOld;
 const driver=createDocumentDb2RecoveryDriver({
  owner:{store:original.store,vault:original.vault,storage:original.storage,coordinator:original.coordinator},
  authority:{
   currentToken:()=>docOwnerToken,
   isCurrent:async token=>token===docOwnerToken,
   onRetired:()=>{if(owner===original)owner=null;},
   async freshAuthentication(previousToken){
    if(docOwnerScenario==='same-epoch')return {token:previousToken,password};
    docOwnerToken='synthetic-epoch-2';
    return {token:docOwnerToken,password};
   }
  },
  vaultPassword:password,recoveryPassword:copyPassword,targetPassword:copyPassword,
  approvedCurrentAssessmentScopes:approved,approvedIncomingAssessmentScopes:approved,
  approvedDocumentScopes:[docScope],factory:indexedDB,
  async selectCiphertext(kind,isActive){
   if(!isActive())return null;
   if(docOwnerScenario==='cancelled'&&kind==='target')return null;
   const copy=docOwnerCopies![kind];
   if(docOwnerScenario==='stale-owner'&&kind==='recovery')
    docOwnerToken='synthetic-epoch-2';
   if(docOwnerScenario==='wrong-recovery'&&kind==='recovery')
    return docOwnerCopies!.target;
   return copy;
  }
 });
 docOwnerDriver=createDocumentRecoveryDecision(driver);
 return docSummary();
}
async function docOwnerOldRejected(){
 const old=docOwnerOld;if(!old)return false;
 if(old.vault.isUnlocked())return false;
 try{await old.store.getMetadata();return false;}catch{return true;}
}
Object.assign(globalThis,{__doc01D4c3e2Owner:{
 seed:docOwnerSeed,
 prepare:()=>ownerDecision().prepare(),
 confirm:async()=>{await ownerDecision().confirm({accepted:true,phrase:'RIPRISTINA'});return ownerDecision().phase();},
 verify:()=>ownerDecision().verifyAfterReopen(),
 phase:()=>ownerDecision().phase(),
 physicalDigest,oldOwnerRejected:docOwnerOldRejected,
 reopenSummary:async()=>{
  await open();
  const check=await nativeDocumentRestoredSummary();
  return check;
 },
 close
}});


/** DOC-01/D4c3e5 — separate institutional V9 physical DB2 laboratory.
 * All names, dates, passwords, school identifiers and document contents are fabricated.
 * Never imported by the live application or connected to a real Android backup.
 */
const v9School={
 institutionCode:'ZZIC00000A',siteCode:'ZZMM000001',schoolYear:'2026/2027',
 schoolOrder:'lower-secondary' as const,gradeLevel:2 as const,
 classId:'2C',subjectCode:'TECH',purpose:'disciplinary-plan' as const
};
const v9At='2026-11-20T06:30:00.000Z';
const v9Ids={
 document:'11111111-1111-4111-8111-111111111111',
 revision:'22222222-2222-4222-8222-222222222222',
 event:'33333333-3333-4333-8333-333333333333',
 revocation:'44444444-4444-4444-8444-444444444444'
};
let institutionalMode='actual-restore';
let institutionalEpoch='institutional-epoch-1';
const institutionalEpochListeners=new Set<()=>void>();
const changeInstitutionalEpoch=(next:string)=>{
 institutionalEpoch=next;
 for(const listener of [...institutionalEpochListeners])listener();
};
let institutionalBlocker:{db:IDBDatabase;released:boolean}|null=null;
async function holdInstitutionalCas(){
 if(institutionalBlocker)throw Error('CAS already blocked');
 const db=await new Promise<IDBDatabase>((resolve,reject)=>{
  const req=indexedDB.open('registro-docente-secure-vault',2);
  req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  req.onupgradeneeded=()=>req.transaction?.abort();
 });
 const blocker={db,released:false};institutionalBlocker=blocker;
 const tx=db.transaction(['records'],'readwrite');
 const cleanup=()=>{db.close();if(institutionalBlocker===blocker)institutionalBlocker=null;};
 tx.oncomplete=cleanup;tx.onabort=cleanup;tx.onerror=cleanup;
 const keepAlive=()=>{
  const req=tx.objectStore('records').get('__v9-transaction-barrier__');
  req.onsuccess=()=>{if(!blocker.released)keepAlive();};
 };
 keepAlive();
}
const releaseInstitutionalCas=()=>{
 if(!institutionalBlocker)throw Error('No active CAS blocker');
 institutionalBlocker.released=true;
};
let institutionalCommitResult:'none'|'pending'|'accepted'|'rejected'='none';
let institutionalDecision:ReturnType<typeof createInstitutionalRecoveryDecision>|null=null;
let institutionalOld:ReturnType<typeof requireOwner>|null=null;
let institutionalCopies:{recovery:string;target:string}|null=null;
const requireInstitutional=()=>{
 if(!institutionalDecision)throw Error('Missing V9 recovery decision');
 return institutionalDecision;
};
async function v9Seed(mode:string){
 if(!['actual-restore','cancelled','stale-owner','wrong-recovery','same-epoch','wrong-scope','wrong-password'].includes(mode))
  throw Error('Unknown institutional scenario');
 institutionalMode=mode;institutionalEpoch='institutional-epoch-1';
 institutionalEpochListeners.clear();institutionalCommitResult='none';
 await seed();
 const o=requireOwner();
 const current=await o.storage.loadExactBackupSnapshot();
 if(!current)throw Error('Missing synthetic V9 source');
 const record=await createInstitutionalDocumentRecordV2({
  schemaVersion:2,labOnly:false,official:false,approval:'teacher-confirmed',
  documentId:v9Ids.document,revisionId:v9Ids.revision,
  revisionNumber:1,previousRevisionId:null,revisionReason:'initial',
  kind:'disciplinary-plan',scope:v9School,confirmedAt:'2026-11-20T09:00:00.000Z',
  title:'Programmazione sintetica',sections:[{field:'obiettivi',text:'Apprendere una procedura didattica sintetica.'}]
 });
 const first=await appendInstitutionalDocumentV2(
  {schemaVersion:2,labOnly:false,events:[]},v9School,record,null,v9Ids.event
 );
 if(!first.valid)throw Error('Unverifiable V9 initial history');
 await o.coordinator.enqueue({
  getCommitted:()=>o.state,
  derive:s=>({...s,appData:{...s.appData,documentHistoryV2:first.archive}}),
  persist:s=>o.storage.saveAppDataAndMeta(s.appData,s.meta),
  publish:s=>{o.state=s;}
 });
 const now=await o.storage.loadExactBackupSnapshot();
 if(!now)throw Error('Incomplete V9 seed');
 const second=await revokeInstitutionalDocumentV2(first.archive,v9School,{
  documentId:v9Ids.document,revisionId:v9Ids.revision,
  reason:'withdrawn',confirmedAt:'2026-11-20T11:00:00.000Z',confirmedByTeacher:true
 },first.head,v9Ids.revocation);
 if(!second.valid)throw Error('Unverifiable V9 target history');
 const target={...now,appData:{...now.appData,documentHistoryV2:second.archive},
  meta:incrementBackupChanges(now.meta)};
 const recovery=await createInstitutionalBackupPayloadV9(now,approved,v9School,v9At);
 const destination=await createInstitutionalBackupPayloadV9(target,approved,v9School,v9At);
 institutionalCopies={
  recovery:await encryptDataWithPassword(recovery,copyPassword),
  target:await encryptDataWithPassword(destination,copyPassword)
 };
 institutionalOld=o;
 const driver=createInstitutionalDb2RecoveryDriver({
  owner:{store:o.store,vault:o.vault,storage:o.storage,coordinator:o.coordinator},
  authority:{
   currentToken:()=>institutionalEpoch,
   isCurrent:async token=>token===institutionalEpoch,
   subscribeEpochChanges(token,onRevoked){
    const listener=()=>{if(institutionalEpoch!==token)onRevoked();};
    institutionalEpochListeners.add(listener);listener();
    return ()=>{institutionalEpochListeners.delete(listener);};
   },
   onRetired:()=>{if(owner===o)owner=null;},
   async freshAuthentication(previousToken){
    if(institutionalMode==='same-epoch')return {token:previousToken,password};
    changeInstitutionalEpoch('institutional-epoch-2');
    return {token:institutionalEpoch,password};
   }
  },
  vaultPassword:password,recoveryPassword:copyPassword,
  targetPassword:institutionalMode==='wrong-password'?'invalid-synthetic-password':copyPassword,
  approvedCurrentAssessmentScopes:approved,approvedIncomingAssessmentScopes:approved,
  approvedInstitutionalScope:institutionalMode==='wrong-scope'?{...v9School,subjectCode:'MATH'}:v9School,
  factory:indexedDB,
  async selectCiphertext(kind,isActive){
   if(!isActive())return null;
   if(institutionalMode==='cancelled'&&kind==='target')return null;
   if(institutionalMode==='stale-owner'&&kind==='recovery')changeInstitutionalEpoch('institutional-epoch-2');
   if(institutionalMode==='wrong-recovery'&&kind==='recovery')return institutionalCopies!.target;
   return institutionalCopies![kind];
  }
 });
 institutionalDecision=createInstitutionalRecoveryDecision(driver);
 return {events:1,grades:now.appData.classes[0].grades.map(g=>g.value)};
}
async function v9ReopenSummary(){
 await open();
 const o=requireOwner(),snapshot=await o.storage.loadExactBackupSnapshot();
 if(!snapshot)throw Error('Missing V9 reopened data');
 const h=(snapshot.appData as AppData&{documentHistoryV2?:unknown}).documentHistoryV2;
 const result=await validateInstitutionalDocumentHistoryV2(h,v9School);
 return {historyValid:result.valid,events:result.valid?result.archive.events.length:0,
  grades:snapshot.appData.classes[0].grades.map(g=>g.value)};
}
async function v9OldRejected(){
 const old=institutionalOld;
 if(!old||old.vault.isUnlocked())return false;
 try{await old.store.getMetadata();return false;}catch{return true;}
}
Object.assign(globalThis,{__doc01D4c3e5Owner:{
 seed:v9Seed,
 prepare:()=>requireInstitutional().prepare(),
 confirm:async()=>{
  await requireInstitutional().confirm({accepted:true,phrase:'RIPRISTINA'});
  return requireInstitutional().phase();
 },
 verify:()=>requireInstitutional().verifyAfterReopen(),
 phase:()=>requireInstitutional().phase(),
 holdCas:holdInstitutionalCas,releaseCas:releaseInstitutionalCas,
 expireEpoch:()=>changeInstitutionalEpoch('institutional-epoch-expired'),
 startCommit:()=>{
  institutionalCommitResult='pending';
  void requireInstitutional().confirm({accepted:true,phrase:'RIPRISTINA'})
   .then(()=>{institutionalCommitResult='accepted';})
   .catch(()=>{institutionalCommitResult='rejected';});
 },
 commitResult:()=>institutionalCommitResult,
 physicalDigest,oldOwnerRejected:v9OldRejected,
 reopenSummary:v9ReopenSummary,close
}});


/** DOC-01/D4c3e6 — opt-in native V9 test functions on a fresh V9-only
 * synthetic vault. No V8 records are deleted or migrated: the CI matrix runs
 * the V9 script in its own emulator installation and data directory.
 */
export async function nativeSeedInstitutionalHistory(){
 await v9Seed('actual-restore');
 return nativeInstitutionalRestoredSummary();
}
export async function nativeInstitutionalRestoreCopies(){
 if(!institutionalCopies)throw Error('Synthetic V9 ciphertext missing');
 return {...institutionalCopies};
}
export async function nativePrepareSelectedInstitutionalRestore(
 recovery:Blob,target:Blob,signal:AbortSignal,wrong=false
){
 const o=requireOwner();
 const generation=await o.store.getMetadata();
 if(!generation||signal.aborted)throw Error('Synthetic V9 authorization expired');
 await close();
 const service=createDb2Lifecycle();
 const invalidate=()=>service.invalidate();
 signal.addEventListener('abort',invalidate,{once:true});
 try{
  if(signal.aborted)throw Error('Synthetic V9 authorization expired');
  const grant=await service.prepareInstitutionalRestore({
   operation:'restore-institutional',password,
   file:target,backupPassword:wrong?'incorrect-synthetic-password':copyPassword,
   recoveryFile:recovery,recoveryPassword:copyPassword,
   currentAssessmentScopes:approved,incomingAssessmentScopes:approved,
   institutionalScope:v9School
  },generation);
  if(signal.aborted)throw Error('Synthetic V9 authorization expired');
  return {async commit(confirmed:boolean){
   try{
    if(signal.aborted)throw Error('Synthetic V9 authorization expired');
    await service.commit(grant,confirmed);
   }finally{
    invalidate();
    signal.removeEventListener('abort',invalidate);
   }
  }};
 }catch(error){
  invalidate();
  signal.removeEventListener('abort',invalidate);
  throw error;
 }
}
export async function nativeInstitutionalRestoredSummary(){
 const o=requireOwner();
 const snapshot=await o.storage.loadExactBackupSnapshot();
 if(!snapshot)throw Error('Missing V9 snapshot on authenticated readback');
 const history=(snapshot.appData as AppData&{documentHistoryV2?:unknown}).documentHistoryV2;
 const doc=await validateInstitutionalDocumentHistoryV2(history,v9School);
 if(!doc.valid)throw Error('Invalid V9 institution-scoped document sequence');
 if(!validateAssessmentArchiveV1(snapshot.appData,approved).valid)throw Error('Assessment history mismatch');
 if((snapshot.appData as AppData&{documentHistoryV1?:unknown}).documentHistoryV1!==undefined)
  throw Error('V8 history unexpectedly present in V9 archive');
 return {
  events:doc.archive.events.length,historyValid:true,
  eventKinds:doc.archive.events.map(e=>e.operation.kind),
  grades:snapshot.appData.classes[0].grades.map(g=>g.value),
  assessmentRevisions:section(snapshot.appData).document.evidence.length,
  changes:snapshot.meta.changes,version:await versions()
 };
}
