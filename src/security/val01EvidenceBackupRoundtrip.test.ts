import {describe,expect,test,beforeAll} from 'bun:test';
import type {AppData,ClassData} from '../types';
import type {AssessmentArchiveV1} from '../assessment/assessmentArchive';
import {validateAssessmentArchiveV1} from '../assessment/assessmentArchive';
import {resolveApprovedAssessmentScopes} from '../assessment/approvedAssessmentScopes';
import {deriveConfirmedEvidenceMutation,type EvidenceCommitRequest} from '../assessment/assessmentEvidenceMutation';
import {previewIndividualObservation} from '../assessment/individualObservation';
import {previewEvidenceRevision} from '../assessment/individualEvidenceRevision';
import {projectEvidenceBoard} from '../assessment/individualEvidenceBoard';
import {createAssessmentBackupPayloadV7,inspectAssessmentBackupPayload} from './assessmentBackupPayload';
import {createBackupPayload,normalizeBackupPayload} from './backupPayload';
import {createInitialArchiveSnapshot} from './initialArchiveSetup';
import {encryptDataWithPassword,decryptDataWithPassword} from '../cryptoUtils';
import {boardDocument,boardScope} from '../../tests/browser/fixtures/val01-s6c-data';

beforeAll(()=>{const root=globalThis as typeof globalThis & {window?:typeof globalThis};if(!root.window)root.window=globalThis;});
type EvidenceClass=ClassData & {assessmentEvidenceV1?:AssessmentArchiveV1};
const approved=[{classId:boardScope.classId,schoolYear:boardScope.schoolYear,subjectCode:boardScope.subjectCode}];
const stamp='2026-11-22T10:04:00.000Z';
const pass='synthetic-test-password';
function base(){
 const snapshot=createInitialArchiveSnapshot({mode:'professional',profile:{school:'Istituto sintetico',year:'2026/27',teacher:'Docente sintetico',subject:'Tecnologia'}});
 const klass:EvidenceClass={id:boardScope.classId,name:'Classe sintetica',students:boardScope.studentIds.map((id,i)=>({id,name:'Fittizio '+i})),
 grades:[{id:'g1',studentId:'s1',date:'2026-11-20',type:'disegno',period:'Q1',title:'Prova numerica',value:'8'}],behaviors:[]};
 snapshot.appData={classes:[klass],currentClassId:klass.id};
 return snapshot;
}
const doc=(a:AppData)=>(a.classes[0] as EvidenceClass).assessmentEvidenceV1!.documents[0].document;
function history(){
 const x=base();
 (x.appData.classes[0] as EvidenceClass).assessmentEvidenceV1={version:1,documents:[{document:structuredClone(boardDocument),bindings:[]}]};
 const created=previewIndividualObservation(doc(x.appData),boardScope,{evidenceId:'backup-e',revisionId:'backup-r1',observationEventId:'backup-event',assessmentRevisionId:'a2',criterionRevisionId:'c1',studentId:'s4',observedOn:'2026-11-20',recordedAt:'2026-11-22T10:01:00.000Z',state:'observed',fact:{kind:'product',description:'Schema sintetico riservato',method:'Elaborato'},interpretation:{kind:'level',levelId:'l2'}});
 if(!created.valid)throw Error(created.issue);
 const apply=(request:EvidenceCommitRequest,confirmedAt:string)=>{
   x.appData=deriveConfirmedEvidenceMutation(x.appData,approved,boardScope,request,{confirmedByTeacher:true,confirmedAt}).appData;
   x.meta={...x.meta,changes:x.meta.changes+1};
 };
 apply({kind:'new',preview:created.preview},'2026-11-22T10:01:30.000Z');
 const correction=previewEvidenceRevision(doc(x.appData),boardScope,{action:'correct',evidenceRevisionId:'backup-r1',revisionId:'backup-r2',recordedAt:'2026-11-22T10:02:00.000Z',state:'not_observed'});
 if(!correction.valid)throw Error(correction.issue);
 apply({kind:'revision',preview:correction.preview},'2026-11-22T10:02:30.000Z');
 const withdrawal=previewEvidenceRevision(doc(x.appData),boardScope,{action:'withdraw',evidenceRevisionId:'backup-r2',revisionId:'backup-r3',recordedAt:'2026-11-22T10:03:00.000Z',reason:'Ritiro sintetico'});
 if(!withdrawal.valid)throw Error(withdrawal.issue);
 apply({kind:'revision',preview:withdrawal.preview},'2026-11-22T10:03:30.000Z');
 return x;
}
describe('VAL-01/S6d.2b — committed evidence V7 recovery inspection',()=>{

 test('F3-CPL-01 V7 preserves raw teacher settings and historical evidence under canonical authority',async()=>{
  const original=history();
  for(const year of ['2026/27','2026-2027','2026/2027']){
   const source=structuredClone(original);
   source.settings.year=year;
   source.settings.subject=boardScope.subjectCode;
   const before=JSON.stringify(source);
   const scopes=resolveApprovedAssessmentScopes(source.appData,source.planning,source.settings);
   expect(scopes).toEqual(approved);
   const payload=await createAssessmentBackupPayloadV7(source,scopes,stamp);
   expect(payload.snapshot.settings.year).toBe(year);
   const inspected=await inspectAssessmentBackupPayload(payload,source,scopes);
   expect(inspected.sourceVersion).toBe(7);
   expect(inspected.snapshot.appData).toEqual(source.appData);
   expect(inspected.snapshot.settings.year).toBe(year);
   expect(JSON.stringify(source)).toBe(before);
  }
 });

 test('encrypted V7 roundtrip preserves confirmed, corrected and withdrawn revisions and grades',async()=>{
  const x=history(),before=structuredClone(x),payload=await createAssessmentBackupPayloadV7(x,approved,stamp);
  const encrypted=await encryptDataWithPassword(payload,pass);
  expect(JSON.stringify(encrypted)).not.toContain('Schema sintetico riservato');
  const decoded=await decryptDataWithPassword(encrypted,pass);
  const result=await inspectAssessmentBackupPayload(decoded,base(),approved);
  expect(result.sourceVersion).toBe(7);expect(result.snapshot.appData).toEqual(before.appData);
  expect(result.snapshot.meta.changes).toBe(3);
  expect(doc(result.snapshot.appData).evidence.slice(-3).map(e=>e.state)).toEqual(['observed','not_observed','withdrawn']);
  const projection=projectEvidenceBoard(doc(result.snapshot.appData),boardScope,'a2','c1');
  if(!projection.valid)throw Error('invalid projection');
  expect(projection.rows.find(r=>r.studentId==='s4')?.entries).toEqual([]);
  expect(result.snapshot.appData.classes[0].grades).toEqual(before.appData.classes[0].grades);
  expect(validateAssessmentArchiveV1(result.snapshot.appData,approved)).toEqual({valid:true,state:'present'});
  expect(x).toEqual(before);
 });
 test('incorrect password and scope refuse inspection or recovery candidate',async()=>{
  const x=history(),p=await createAssessmentBackupPayloadV7(x,approved,stamp);
  const encrypted=await encryptDataWithPassword(p,pass);
  await expect(decryptDataWithPassword(encrypted,'incorrect-synthetic-password')).rejects.toThrow();
  await expect(inspectAssessmentBackupPayload(p,base(),[])).rejects.toThrow();
  await expect(createAssessmentBackupPayloadV7(x,[{...approved[0],subjectCode:'OTHER'}],stamp)).rejects.toThrow();
 });
 test('legacy reader rejects V7; V7 inspection rejects domain under V6 label',async()=>{
  const p=await createAssessmentBackupPayloadV7(history(),approved,stamp);
  expect(()=>normalizeBackupPayload(p,base())).toThrow(/versione/i);
  await expect(inspectAssessmentBackupPayload({...p,backupDataVersion:6},base(),approved)).rejects.toThrow();
 });
 test('older valid backup reports replacement review, never modifies destination',async()=>{
  const current=history(),before=structuredClone(current);
  const p=createBackupPayload(base(),stamp);
  const result=await inspectAssessmentBackupPayload(p,current,approved);
  expect(result.replacementRequiresReview).toBe(true);
  expect(validateAssessmentArchiveV1(result.snapshot.appData,approved)).toEqual({valid:true,state:'absent'});
  expect(current).toEqual(before);
 });
});
