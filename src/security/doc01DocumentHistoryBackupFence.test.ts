import {describe,expect,test} from 'bun:test';
import {createBackupPayload,normalizeBackupPayload} from './backupPayload';
import {createAssessmentBackupPayloadV7,inspectAssessmentBackupPayload} from './assessmentBackupPayload';
import {createInitialArchiveSnapshot} from './initialArchiveSetup';
import {SecureAppStorage} from './secureAppStorage';
import type {SecureVault} from './secureVault';
import {assertNoUnsupportedDocumentHistory} from './documentHistoryBackupFence';
import type {CompleteSecureAppSnapshot} from './secureAppStorage';

const at='2026-11-19T21:00:00.000Z';
const domain={schemaVersion:1 as const,labOnly:true as const,events:[]};
const base=():CompleteSecureAppSnapshot=>{
 const s=createInitialArchiveSnapshot({mode:'professional',profile:{school:'Istituto dimostrativo',year:'2026/27',teacher:'Docente sintetico',subject:'Tecnologia'}});
 s.appData={classes:[{id:'demo-class',name:'2C',students:[],grades:[],behaviors:[]}],currentClassId:'demo-class'};
 s.meta={changes:4,lastBackup:null};
 return s;
};
const protectedSnapshot=():CompleteSecureAppSnapshot=>{
 const s=base();
 (s.appData as typeof s.appData & {documentHistoryV1:typeof domain}).documentHistoryV1=structuredClone(domain);
 return s;
};
const clone=<T>(v:T):T=>structuredClone(v);
const v6=()=>createBackupPayload(base(),at);
const v7=async()=>createAssessmentBackupPayloadV7(base(),[],at);
describe('DOC-01/D4c3b — stop silent document-history loss across unversioned backups',()=>{
 test('any DOC-01 marker is excluded from a v6/v7 serializer without a new version contract',()=>{
  expect(()=>assertNoUnsupportedDocumentHistory(protectedSnapshot())).toThrow('DOC01_HISTORY_BACKUP_UNSUPPORTED');
  expect(()=>assertNoUnsupportedDocumentHistory({some:{other:[{documentHistoryV1:domain}]}})).toThrow('DOC01_HISTORY_BACKUP_UNSUPPORTED');
 });
 test('an accessor cannot conceal an archive marker or execute while inspected',()=>{
  let touched=false;
  const data={};
  Object.defineProperty(data,'documentHistoryV1',{enumerable:true,get(){touched=true;return domain;}});
  expect(()=>assertNoUnsupportedDocumentHistory(data)).toThrow('DOC01_HISTORY_BACKUP_UNSUPPORTED');
  expect(touched).toBe(false);
 });
 test('legacy v6 writer cannot claim to include a new history without an explicit codec',()=>{
  expect(()=>createBackupPayload(protectedSnapshot(),at)).toThrow('DOC01_HISTORY_BACKUP_UNSUPPORTED');
 });
 test('v6 parser rejects smuggled DOC-01 domain instead of silently trusting the v6 label',()=>{
  const payload=v6();
  const modified=clone(payload);
  (modified.snapshot.appData as typeof modified.snapshot.appData & {documentHistoryV1:typeof domain}).documentHistoryV1=domain;
  expect(()=>normalizeBackupPayload(modified,base())).toThrow('DOC01_HISTORY_BACKUP_UNSUPPORTED');
 });
 test('a clean older v6 backup cannot replace an archive containing document history',()=>{
  expect(()=>normalizeBackupPayload(v6(),protectedSnapshot())).toThrow('DOC01_HISTORY_BACKUP_UNSUPPORTED');
 });
 test('v7 assessment writer refuses any unversioned document-history coexistence',async()=>{
  await expect(createAssessmentBackupPayloadV7(protectedSnapshot(),[],at)).rejects.toThrow('DOC01_HISTORY_BACKUP_UNSUPPORTED');
 });
 test('v7 inspection does not admit incoming DOC-01 data disguised as version seven',async()=>{
  const payload=await v7();
  const modified=clone(payload);
  (modified.snapshot.appData as typeof modified.snapshot.appData & {documentHistoryV1:typeof domain}).documentHistoryV1=domain;
  await expect(inspectAssessmentBackupPayload(modified,base(),[])).rejects.toThrow('DOC01_HISTORY_BACKUP_UNSUPPORTED');
 });
 test('v7 restore inspection blocks deletion of document history from current archive',async()=>{
  await expect(inspectAssessmentBackupPayload(await v7(),protectedSnapshot(),[])).rejects.toThrow('DOC01_HISTORY_BACKUP_UNSUPPORTED');
 });
 test('direct verified restore checks physical state, not only caller-supplied previous snapshot',async()=>{
  const current=protectedSnapshot();
  let writes=0;
  const vault={
   async get(key:string){return clone((current as unknown as Record<string,unknown>)[key]??null);},
   async putMany(){writes++;}
  };
  const storage=new SecureAppStorage(vault as unknown as SecureVault);
  await expect(storage.restoreSnapshotVerified(base(),base())).rejects.toThrow('DOC01_HISTORY_BACKUP_UNSUPPORTED');
  expect(writes).toBe(0);
 });
 test('historical v6 and v7 backups without DOC-01 remain accepted unchanged',async()=>{
  const payload=v6();
  expect(normalizeBackupPayload(payload,base()).appData).toEqual(base().appData);
  const inspection=await inspectAssessmentBackupPayload(await v7(),base(),[]);
  expect(inspection.sourceVersion).toBe(7);
  expect(inspection.snapshot.appData).toEqual(base().appData);
 });
});
