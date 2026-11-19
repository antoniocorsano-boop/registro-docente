import {describe,expect,test} from 'bun:test';
import type {ClassData} from '../types';
import {boardDocument,boardScope} from '../../tests/browser/fixtures/val01-s6c-data';
import type {AssessmentArchiveV1} from '../assessment/assessmentArchive';
import {createInitialArchiveSnapshot} from './initialArchiveSetup';
import {createAssessmentBackupPayloadV7} from './assessmentBackupPayload';
import {preservesAssessmentHistory,projectAssessmentRestoreV7} from './assessmentRestorePolicy';
import {deriveConfirmedEvidenceMutation} from '../assessment/assessmentEvidenceMutation';
import {previewIndividualObservation} from '../assessment/individualObservation';
const scopes=[{classId:boardScope.classId,schoolYear:boardScope.schoolYear,subjectCode:boardScope.subjectCode}];
const stamp='2026-11-22T10:04:00.000Z';
type C=ClassData & {assessmentEvidenceV1?:AssessmentArchiveV1};
function base(){
 const s=createInitialArchiveSnapshot({mode:'professional',profile:{school:'Istituto sintetico',year:'2026/27',teacher:'Docente sintetico',subject:'Tecnologia'}});
 const c:C={id:boardScope.classId,name:'Classe sintetica',students:boardScope.studentIds.map((id,i)=>({id,name:'Fittizio '+i})),grades:[],behaviors:[],assessmentEvidenceV1:{version:1,documents:[{document:structuredClone(boardDocument),bindings:[]}]}};
 s.appData={classes:[c],currentClassId:c.id};return s;
}
function newer(){
 const s=base();
 const r=previewIndividualObservation(boardDocument,boardScope,{evidenceId:'v7-e',revisionId:'v7-r1',observationEventId:'v7-event',assessmentRevisionId:'a2',criterionRevisionId:'c1',studentId:'s4',observedOn:'2026-11-20',recordedAt:'2026-11-22T10:01:00.000Z',state:'not_observed'});
 if(!r.valid)throw Error(r.issue);
 s.appData=deriveConfirmedEvidenceMutation(s.appData,scopes,boardScope,{kind:'new',preview:r.preview},{confirmedByTeacher:true,confirmedAt:'2026-11-22T10:01:30.000Z'}).appData;
 s.meta={changes:1,lastBackup:null};
 return s;
}
const payload=(s:ReturnType<typeof base>)=>createAssessmentBackupPayloadV7(s,scopes,stamp);
describe('VAL-01/S6d.2c.3 — conservative restore policy',()=>{
 test('append-only validated history permits newer but not older backup',async()=>{
  const old=base(),next=newer();
  expect(preservesAssessmentHistory(old.appData,next.appData,scopes,scopes)).toBe(true);
  expect(preservesAssessmentHistory(next.appData,old.appData,scopes,scopes)).toBe(false);
  expect((await projectAssessmentRestoreV7(old,await payload(next),await payload(old),scopes,scopes)).appData).toEqual(next.appData);
  await expect(projectAssessmentRestoreV7(next,await payload(old),await payload(next),scopes,scopes)).rejects.toThrow();
 });
 test('rejects rewritten criterion, lost document, foreign scope and a changed historical fact',()=>{
  const old=base().appData;
  const noDoc=structuredClone(old);delete (noDoc.classes[0] as C).assessmentEvidenceV1;
  expect(preservesAssessmentHistory(old,noDoc,scopes,scopes)).toBe(false);
  const changed=structuredClone(old);const section=(changed.classes[0] as C).assessmentEvidenceV1!.documents[0];
  (section.document.criteria[0] as any).description='Criterio sostituito';
  expect(preservesAssessmentHistory(old,changed,scopes,scopes)).toBe(false);
  const altered=structuredClone(old);( (altered.classes[0] as C).assessmentEvidenceV1!.documents[0].document.evidence[0] as any).fact.description='Fatto alterato';
  expect(preservesAssessmentHistory(old,altered,scopes,scopes)).toBe(false);
  expect(preservesAssessmentHistory(old,old,[],scopes)).toBe(false);
  expect(preservesAssessmentHistory(old,old,scopes,[])).toBe(false);
 });
 test('requires an exact recovery copy, except permitted checkpoint counters',async()=>{
  const old=base(),next=newer(),target=await payload(next);
  await expect(projectAssessmentRestoreV7(old,target,target,scopes,scopes)).rejects.toThrow();
  const checkpoint=await payload({...old,meta:{changes:0,lastBackup:stamp}});
  expect((await projectAssessmentRestoreV7(old,target,checkpoint,scopes,scopes)).appData).toEqual(next.appData);
  const changed=structuredClone(old);changed.settings.school='Altra scuola sintetica';
  await expect(projectAssessmentRestoreV7(old,target,await payload(changed),scopes,scopes)).rejects.toThrow();
 });
 test('legacy copy and missing recovery cannot authorize V7 restoration',async()=>{
  const old=base(),target=await payload(newer()),recovery=await payload(old);
  await expect(projectAssessmentRestoreV7(old,target,null,scopes,scopes)).rejects.toThrow();
  await expect(projectAssessmentRestoreV7(old,{...target,backupDataVersion:6},recovery,scopes,scopes)).rejects.toThrow();
 });
});
