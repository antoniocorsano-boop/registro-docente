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

// DOC-01/D4c3d2 — native SAF recovery entrypoint reserved for RED.
// The V8 physical DB2 service exists (D4c3d1); only real Android-selected
// encrypted bytes will be permitted to reach it after the GREEN phase.
export async function nativeDocumentCopies():Promise<{recovery:string;target:string}>{
 throw Error('DOC01_D4C3D2_NOT_IMPLEMENTED');
}
export async function nativePrepareSelectedDocumentRestore(
 _recovery:Blob,_target:Blob,_signal:AbortSignal,_wrong=false
):Promise<{commit(confirmed:boolean):Promise<void>}>{
 throw Error('DOC01_D4C3D2_NOT_IMPLEMENTED');
}
export async function nativeRestoredDocumentSummary():Promise<unknown>{
 throw Error('DOC01_D4C3D2_NOT_IMPLEMENTED');
}
