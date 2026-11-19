import {describe,expect,test} from 'bun:test';
import type {AppData,ClassData} from '../types';
import {boardDocument,boardScope} from '../../tests/browser/fixtures/val01-s6c-data';
import type {AssessmentArchiveV1} from '../assessment/assessmentArchive';
import {previewIndividualObservation} from '../assessment/individualObservation';
import {commitAssessmentEvidence,type EvidenceCommittedState,type EvidenceMutationOwner} from '../persistence/assessmentEvidenceCommit';
import {createDurableMutationCoordinator} from '../persistence/durableMutationCoordinator';
type C=ClassData & {assessmentEvidenceV1?:AssessmentArchiveV1};
const approved=[{classId:boardScope.classId,schoolYear:boardScope.schoolYear,subjectCode:boardScope.subjectCode}];
function initial():EvidenceCommittedState{
 const c:C={id:boardScope.classId,name:'Classe sintetica',students:boardScope.studentIds.map(id=>({id,name:'Fittizio'})),grades:[],behaviors:[],assessmentEvidenceV1:{version:1,documents:[{document:structuredClone(boardDocument),bindings:[]}]}};
 return {appData:{classes:[c],currentClassId:c.id},meta:{changes:0,lastBackup:null}};
}
function request(){
 const r=previewIndividualObservation(boardDocument,boardScope,{evidenceId:'op-e',revisionId:'op-r1',observationEventId:'op-event',assessmentRevisionId:'a2',criterionRevisionId:'c1',studentId:'s4',observedOn:'2026-11-20',recordedAt:'2026-11-22T10:01:00.000Z',state:'not_observed'});
 if(!r.valid)throw Error(r.issue);return {kind:'new' as const,preview:r.preview};
}
const confirmation={confirmedByTeacher:true,confirmedAt:'2026-11-22T10:01:30.000Z'};
function harness(persist:()=>Promise<void>=async()=>{}){
 let state=initial(),active=true,writes=0,publishes=0;
 const owner:EvidenceMutationOwner={coordinator:createDurableMutationCoordinator(),isActive:()=>active,getCommitted:()=>state,publish:next=>{state=next;publishes++;},storage:{async saveAppDataAndMeta(){writes++;await persist();}}};
 return {owner,state:()=>state,writes:()=>writes,publishes:()=>publishes,revoke:()=>{active=false;},replace:(a:AppData)=>{state={...state,appData:a};}};
}
const commit=(h:ReturnType<typeof harness>)=>commitAssessmentEvidence(h.owner,approved,boardScope,request(),confirmation);
function latch(){let release!:()=>void;const promise=new Promise<void>(r=>{release=r;});return {promise,release};}
describe('VAL-01/S6d.3 — durable receipt contract',()=>{
 test('receipt and publish follow actual persistence, duplicate rejected',async()=>{
  const entered=latch(),gate=latch();const h=harness(async()=>{entered.release();await gate.promise;});
  let settled=false;const pending=commit(h).then(r=>{settled=true;return r;});
  await entered.promise;expect(settled).toBe(false);expect(h.publishes()).toBe(0);expect(h.state().meta.changes).toBe(0);
  gate.release();const receipt=await pending;
  expect(receipt.revisionId).toBe('op-r1');expect(receipt.document.evidence.at(-1)?.revisionId).toBe('op-r1');expect(h.state().meta.changes).toBe(1);
  await expect(commit(h)).rejects.toThrow();expect(h.writes()).toBe(1);expect(h.publishes()).toBe(1);
 });
 test('failed persist never publishes; identical confirmed request can retry',async()=>{
  let fail=true;const h=harness(async()=>{if(fail)throw Error('Synthetic abort');});
  await expect(commit(h)).rejects.toThrow();expect(h.publishes()).toBe(0);expect(h.state().meta.changes).toBe(0);
  fail=false;expect((await commit(h)).revisionId).toBe('op-r1');expect(h.state().meta.changes).toBe(1);
 });
 test('revoked session during admitted commit never receives success receipt',async()=>{
  const entered=latch(),gate=latch();const h=harness(async()=>{entered.release();await gate.promise;});
  const pending=commit(h);await entered.promise;h.revoke();gate.release();
  await expect(pending).rejects.toThrow();expect(h.publishes()).toBe(1);
  await expect(commit(h)).rejects.toThrow();expect(h.writes()).toBe(1);
 });
 test('queued mutation revalidates current roster and scope, no write after removal',async()=>{
  const h=harness(),gate=latch();const wait=h.owner.coordinator.enqueueTask(()=>gate.promise);
  const pending=commit(h);const a=structuredClone(h.state().appData);a.classes[0].students=a.classes[0].students.filter(s=>s.id!=='s4');h.replace(a);
  gate.release();await wait;await expect(pending).rejects.toThrow();expect(h.writes()).toBe(0);expect(h.publishes()).toBe(0);
 });
});
