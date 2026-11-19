import {describe,expect,test} from 'bun:test';
import type {AppData,ClassData} from '../types';
import type {AssessmentArchiveV1} from '../assessment/assessmentArchive';
import {validateAssessmentArchiveV1} from '../assessment/assessmentArchive';
import {deriveConfirmedEvidenceMutation,type EvidenceCommitRequest} from '../assessment/assessmentEvidenceMutation';
import {previewIndividualObservation} from '../assessment/individualObservation';
import {previewEvidenceRevision} from '../assessment/individualEvidenceRevision';
import {projectEvidenceBoard} from '../assessment/individualEvidenceBoard';
import {createDurableMutationCoordinator} from '../persistence/durableMutationCoordinator';
import {incrementBackupChanges} from '../persistence/backupCheckpoint';
import {SecureAppStorage,type SecureMeta} from './secureAppStorage';
import {SecureVault} from './secureVault';
import type {VaultStore} from './vaultStore';
import type {EncryptedVaultRecord,VaultMetadataV1,VaultRecordKey} from './vaultTypes';
import {boardDocument,boardScope} from '../../tests/browser/fixtures/val01-s6c-data';

type EvidenceClass=ClassData & {assessmentEvidenceV1?:AssessmentArchiveV1};
const approved=[{classId:boardScope.classId,schoolYear:boardScope.schoolYear,subjectCode:boardScope.subjectCode}];
const stamp='2026-11-22T10:01:00.000Z';
const confirmation={confirmedByTeacher:true,confirmedAt:'2026-11-22T10:01:30.000Z'};
const identity={evidenceId:'persist-evidence',revisionId:'persist-r1',observationEventId:'persist-event',assessmentRevisionId:'a2',criterionRevisionId:'c1',studentId:'s4',observedOn:'2026-11-20',recordedAt:stamp};
function source():AppData{
 const klass:EvidenceClass={id:boardScope.classId,name:'Classe sintetica',students:boardScope.studentIds.map((id,i)=>({id,name:'Fittizio '+i})),
  grades:[{id:'g1',studentId:'s1',date:'2026-11-20',type:'disegno',period:'Q1',title:'Prova numerica',value:'8'}],behaviors:[],
  assessmentEvidenceV1:{version:1,documents:[{document:structuredClone(boardDocument),bindings:[]}]}};
 return {classes:[klass,{id:'other',name:'Altra classe sintetica',students:[],grades:[],behaviors:[]}],currentClassId:klass.id};
}
const section=(a:AppData)=>(a.classes[0] as EvidenceClass).assessmentEvidenceV1!.documents[0];
const newReview=(a:AppData):EvidenceCommitRequest=>{
 const r=previewIndividualObservation(section(a).document,boardScope,{...identity,state:'observed',fact:{kind:'product',description:'Schema sintetico riservato',method:'Elaborato'},interpretation:{kind:'level',levelId:'l2'}});
 if(!r.valid)throw Error(r.issue);return {kind:'new',preview:r.preview};
};
function revision(a:AppData,input:unknown):EvidenceCommitRequest{
 const r=previewEvidenceRevision(section(a).document,boardScope,input);
 if(!r.valid)throw Error(r.issue);return {kind:'revision',preview:r.preview};
}
const derive=(a:AppData,r:EvidenceCommitRequest,c:unknown=confirmation)=>deriveConfirmedEvidenceMutation(a,approved,boardScope,r,c);
const json=(v:unknown)=>JSON.stringify(v);

class SyntheticVaultStore implements VaultStore{
 private metadata:VaultMetadataV1|null=null;
 private records=new Map<VaultRecordKey,EncryptedVaultRecord>();
 rejectNext=false;
 batches=0;
 async getMetadata(){return this.metadata;}
 async putMetadata(v:VaultMetadataV1){this.metadata=v;}
 async getRecord(k:VaultRecordKey){return this.records.get(k)??null;}
 async putRecord(v:EncryptedVaultRecord){this.records.set(v.recordKey as VaultRecordKey,v);}
 async putRecords(values:EncryptedVaultRecord[]){
  this.batches++;
  if(this.rejectNext){this.rejectNext=false;throw Error('synthetic atomic failure');}
  for(const v of values)this.records.set(v.recordKey as VaultRecordKey,v);
 }
 async deleteRecord(k:VaultRecordKey){this.records.delete(k);}
 async listRecordKeys(){return [...this.records.keys()];}
 async clearAll(){this.metadata=null;this.records.clear();}
}
async function harness(){
 const store=new SyntheticVaultStore(),vault=new SecureVault(store);
 await vault.initializeActive('synthetic-lab-only-password');
 const storage=new SecureAppStorage(vault),coordinator=createDurableMutationCoordinator();
 let state={appData:source(),meta:{changes:0,lastBackup:null} as SecureMeta};
 await storage.saveAppDataAndMeta(state.appData,state.meta);
 const commit=(reviewed:EvidenceCommitRequest,c:unknown=confirmation)=>coordinator.enqueue({
   getCommitted:()=>state,
   derive:previous=>({appData:derive(previous.appData,reviewed,c).appData,meta:incrementBackupChanges(previous.meta)}),
   persist:next=>storage.saveAppDataAndMeta(next.appData,next.meta),
   publish:next=>{state=next;}
 });
 return {store,vault,storage,coordinator,commit,state:()=>state};
}

describe('VAL-01/S6d.2a — isolated confirmed evidence mutation',()=>{
 test('one appended revision, exact scope, old graph, other class and numeric grades preserved',()=>{
  const a=source(),before=json(a),r=derive(a,newReview(a));
  expect(json(a)).toBe(before);expect(validateAssessmentArchiveV1(r.appData,approved)).toEqual({valid:true,state:'present'});
  expect(section(r.appData).document.evidence).toHaveLength(boardDocument.evidence.length+1);
  expect(json(section(r.appData).document.evidence.slice(0,-1))).toBe(json(boardDocument.evidence));
  expect(json(r.appData.classes[0].grades)).toBe(json(a.classes[0].grades));
  expect(json(r.appData.classes[1])).toBe(json(a.classes[1]));
  expect(json(section(r.appData).bindings)).toBe(json(section(a).bindings));
 });
 test('refuses absent document, wrong class, changed roster, unapproved scope and unconfirmed request',()=>{
  const a=source(),r=newReview(a);
  const absent=structuredClone(a);delete (absent.classes[0] as EvidenceClass).assessmentEvidenceV1;
  expect(()=>derive(absent,r)).toThrow();
  expect(()=>derive({...a,currentClassId:'other'},r)).toThrow();
  const changed=structuredClone(a);changed.classes[0].students.reverse();expect(()=>derive(changed,r)).toThrow();
  expect(()=>deriveConfirmedEvidenceMutation(a,[],boardScope,r,confirmation)).toThrow();
  expect(()=>derive(a,r,{...confirmation,confirmedByTeacher:false})).toThrow();
 });
 test('duplicate confirmation and stale correction fail closed',()=>{
  const a=source(),r=newReview(a),saved=derive(a,r).appData;
  expect(()=>derive(saved,r)).toThrow();
  const p=revision(saved,{action:'correct',evidenceRevisionId:'persist-r1',revisionId:'persist-r2',recordedAt:'2026-11-22T10:02:00.000Z',state:'not_observed'});
  const changed=derive(saved,p,{confirmedByTeacher:true,confirmedAt:'2026-11-22T10:02:30.000Z'}).appData;
  expect(()=>derive(changed,p,{confirmedByTeacher:true,confirmedAt:'2026-11-22T10:03:00.000Z'})).toThrow();
 });
 test('correction and motivated withdrawal are append-only, with active projection updated',()=>{
  const a=source(),saved=derive(a,newReview(a)).appData;
  const p=revision(saved,{action:'correct',evidenceRevisionId:'persist-r1',revisionId:'persist-r2',recordedAt:'2026-11-22T10:02:00.000Z',state:'not_observed'});
  const changed=derive(saved,p,{confirmedByTeacher:true,confirmedAt:'2026-11-22T10:02:30.000Z'}).appData;
  const w=revision(changed,{action:'withdraw',evidenceRevisionId:'persist-r2',revisionId:'persist-r3',recordedAt:'2026-11-22T10:03:00.000Z',reason:'Ritiro sintetico'});
  const final=derive(changed,w,{confirmedByTeacher:true,confirmedAt:'2026-11-22T10:03:30.000Z'}).appData;
  expect(section(final).document.evidence.slice(-3).map(e=>e.state)).toEqual(['observed','not_observed','withdrawn']);
  const projection=projectEvidenceBoard(section(final).document,boardScope,'a2','c1');
  if(!projection.valid)throw Error('invalid projection');
  expect(projection.rows.find(r=>r.studentId==='s4')?.entries).toEqual([]);
  expect(json(final.classes[0].grades)).toBe(json(a.classes[0].grades));
 });
 test('canonical coordinator and encrypted appData+meta write, then independent authenticated reopening',async()=>{
  const h=await harness(),before=h.store.batches;
  const committed=await h.commit(newReview(h.state().appData));
  expect(h.store.batches).toBe(before+1);expect(committed.meta.changes).toBe(1);
  const physical=await h.store.getRecord('appData');
  expect(physical).not.toBeNull();
  expect(new TextDecoder().decode(physical!.ciphertext)).not.toContain('Schema sintetico riservato');
  await h.coordinator.sealAndDrain();h.vault.lock();
  const reopened=new SecureVault(h.store);await reopened.unlock('synthetic-lab-only-password');
  const restored=await new SecureAppStorage(reopened).loadSnapshot();
  expect(json(restored.appData)).toBe(json(committed.appData));expect(restored.meta).toEqual(committed.meta);
  expect(validateAssessmentArchiveV1(restored.appData,approved)).toEqual({valid:true,state:'present'});
  reopened.lock();
 });
 test('atomic failure preserves prior ciphertext and metadata, no publish; retry once',async()=>{
  const h=await harness(),before=json(h.state()),r=newReview(h.state().appData);
  const physical=await h.store.getRecord('appData'),meta=await h.store.getRecord('meta');
  h.store.rejectNext=true;await expect(h.commit(r)).rejects.toThrow('synthetic atomic failure');
  expect(json(h.state())).toBe(before);expect(await h.store.getRecord('appData')).toBe(physical);expect(await h.store.getRecord('meta')).toBe(meta);
  await h.commit(r);expect(h.state().meta.changes).toBe(1);
  await expect(h.commit(r)).rejects.toThrow();expect(h.state().meta.changes).toBe(1);
  await h.coordinator.sealAndDrain();h.vault.lock();
 });
 test('sealed session admits no evidence writes or publication',async()=>{
  const h=await harness(),before=h.store.batches,r=newReview(h.state().appData);
  await h.coordinator.sealAndDrain();
  await expect(h.commit(r)).rejects.toThrow();
  expect(h.store.batches).toBe(before);expect(h.state().meta.changes).toBe(0);h.vault.lock();
 });
});
