/** DOC-01/D4c3e4 — V9 institutional backup: exact version, lossless, isolated.
 * All names and identifiers in these tests are invented fictional context.
 */
import {beforeAll,describe,expect,test} from 'bun:test';
import {createInitialArchiveSnapshot} from './initialArchiveSetup';
import type {CompleteSecureAppSnapshot} from './secureAppStorage';
import {createInstitutionalDocumentRecordV2,appendInstitutionalDocumentV2,revokeInstitutionalDocumentV2,
 type InstitutionalDocumentHistoryV2} from '../documents/institutionalDocumentHistoryV2';
import {createAssessmentBackupPayloadV7,inspectAssessmentBackupPayload} from './assessmentBackupPayload';
import {createDocumentBackupPayloadV8,inspectDocumentBackupPayloadV8} from './documentBackupPayloadV8';
import {createBackupPayload} from './backupPayload';
import {BACKUP_VERSION_V2,decryptDataWithPassword} from '../cryptoUtils';
import {createInstitutionalBackupPayloadV9,inspectInstitutionalBackupPayloadV9,
 projectInstitutionalRestoreV9,encryptInstitutionalBackupV9,decryptAndInspectInstitutionalBackupV9} from './institutionalBackupPayloadV9';
beforeAll(()=>{const g=globalThis as typeof globalThis&{window?:typeof globalThis};if(!g.window)g.window=globalThis;});
const at='2026-11-20T06:30:00.000Z',password='only-for-this-synthetic-v9-laboratory';
const school={institutionCode:'ZZIC00000A',siteCode:'ZZMM000001',schoolYear:'2026/2027',
 schoolOrder:'lower-secondary' as const,gradeLevel:2 as const,classId:'2C',subjectCode:'TECH',purpose:'disciplinary-plan' as const};
const ids={doc:'11111111-1111-4111-8111-111111111111',rev:'22222222-2222-4222-8222-222222222222',event:'33333333-3333-4333-8333-333333333333',revoke:'44444444-4444-4444-8444-444444444444'};
const empty=():InstitutionalDocumentHistoryV2=>({schemaVersion:2,labOnly:false,events:[]});
const copy=<T>(v:T):T=>structuredClone(v);
function base(){
 const s=createInitialArchiveSnapshot({mode:'professional',profile:{school:'Istituto sintetico',year:'2026/27',teacher:'Docente sintetico',subject:'Tecnologia'}});
 s.appData={classes:[{id:'class-tech',name:'2C',students:[],grades:[],behaviors:[]}],currentClassId:'class-tech'};
 s.meta={changes:4,lastBackup:null};
 return s;
}
async function histories(){
 const first=await createInstitutionalDocumentRecordV2({
  schemaVersion:2,labOnly:false,official:false,approval:'teacher-confirmed',
  documentId:ids.doc,revisionId:ids.rev,revisionNumber:1,previousRevisionId:null,
  revisionReason:'initial',kind:'disciplinary-plan',scope:school,confirmedAt:'2026-11-20T09:00:00.000Z',
  title:'Programmazione didattica',sections:[{field:'obiettivi',text:'Comprendere le relazioni fra tecnologie e ambiente.'}]
 });
 const a=await appendInstitutionalDocumentV2(empty(),school,first,null,ids.event);
 if(!a.valid)throw Error('Invalid synthetic initial document');
 const b=await revokeInstitutionalDocumentV2(a.archive,school,{documentId:ids.doc,revisionId:ids.rev,
  reason:'withdrawn',confirmedAt:'2026-11-20T11:00:00.000Z',confirmedByTeacher:true},a.head,ids.revoke);
 if(!b.valid)throw Error('Invalid synthetic revocation');
 return {initial:a.archive,revoked:b.archive};
}
async function snapshot(history?:InstitutionalDocumentHistoryV2){
 const s=base();(s.appData as typeof s.appData&{documentHistoryV2:InstitutionalDocumentHistoryV2}).documentHistoryV2=history??(await histories()).initial;return s;
}
const create=(s:unknown)=>createInstitutionalBackupPayloadV9(s,[],school,at);
const inspect=(v:unknown,s:CompleteSecureAppSnapshot)=>inspectInstitutionalBackupPayloadV9(v,s,[],school);
const project=(s:CompleteSecureAppSnapshot,i:unknown,r:unknown)=>projectInstitutionalRestoreV9(s,i,r,[],[],school);
const reject=async(p:Promise<unknown>)=>expect(p).rejects.toThrow('DOC01_V9_REJECTED');
describe('DOC-01/D4c3e4 — versioned encrypted institutional V9 without V8 downgrade',()=>{
 test('exports complete ten-dataset V9 with V2 school history, never invents older demo history',async()=>{
  const s=await snapshot(),prior=copy(s);
  const p=await create(s),read=await inspect(p,s);
  expect(p).toMatchObject({app:'registro-docente',backupDataVersion:9,exportedAt:at});
  expect(Object.keys(p.snapshot).sort()).toEqual(['appData','settings','udas','customTests','submissions','planning','library','professionalMemory','copilotState','meta'].sort());
  expect(p.snapshot).toEqual(prior);expect(read.snapshot).toEqual(prior);
  expect(read.sourceVersion).toBe(9);expect(read.replacementRequiresReview).toBe(true);
  expect('documentHistoryV1' in p.snapshot.appData).toBe(false);
  expect(s).toEqual(prior);
 });
 test('same proven AES-GCM V2 envelope encrypts entire V9 and roundtrips exact historical revisions',async()=>{
  const s=await snapshot((await histories()).revoked);
  const ciphertext=await encryptInstitutionalBackupV9(s,password,[],school,at);
  const envelope=JSON.parse(ciphertext);
  expect(envelope.version).toBe(BACKUP_VERSION_V2);
  expect(envelope).not.toHaveProperty('snapshot');
  expect(ciphertext).not.toContain('Programmazione didattica');
  const raw=await decryptDataWithPassword(ciphertext,password);
  expect(raw.backupDataVersion).toBe(9);
  const inspected=await decryptAndInspectInstitutionalBackupV9(ciphertext,password,s,[],school);
  expect(inspected.snapshot.appData.documentHistoryV2.events).toHaveLength(2);
  expect(inspected.snapshot).toEqual(raw.snapshot);
  await reject(decryptAndInspectInstitutionalBackupV9(ciphertext,'wrong password',s,[],school));
 });
 test('old V6/V7/V8 encoders and readers refuse institutional V2 in both directions',async()=>{
  const s=await snapshot(),p=await create(s);
  expect(()=>createBackupPayload(s,at)).toThrow('DOC01_HISTORY_BACKUP_UNSUPPORTED');
  await expect(createAssessmentBackupPayloadV7(s,[],at)).rejects.toThrow('DOC01_HISTORY_BACKUP_UNSUPPORTED');
  await expect(createDocumentBackupPayloadV8(s,[],[],at)).rejects.toThrow();
  await expect(inspectAssessmentBackupPayload(p,base(),[])).rejects.toThrow();
  await expect(inspectDocumentBackupPayloadV8(p,base(),[],[])).rejects.toThrow();
  await reject(inspect(await create(s),{...base(),appData:{...base().appData,documentHistoryV1:{schemaVersion:1,labOnly:true,events:[]}}} as CompleteSecureAppSnapshot));
 });
 test('no fake V1→V2 conversion, absent V2, loose root or wrong version',async()=>{
  const s=await snapshot(),p=await create(s);
  await reject(create(base()));
  await reject(inspect({...p,backupDataVersion:8},s));
  await reject(inspect({...p,app:'other'},s));
  await reject(inspect({...p,unexpected:true},s));
  await reject(inspect({...p,exportedAt:'not-a-date'},s));
  const loose=copy(p);delete (loose.snapshot.appData as any).documentHistoryV2;await reject(inspect(loose,s));
 });
 test('legacy V1 and V2 cannot coexist silently in the same V9 archive',async()=>{
  const s=await snapshot();
  (s.appData as any).documentHistoryV1={schemaVersion:1,labOnly:true,events:[]};
  await reject(create(s));
  const clean=await snapshot(),p=await create(clean);
  (p.snapshot.appData as any).documentHistoryV1={schemaVersion:1,labOnly:true,events:[]};
  await reject(inspect(p,clean));
 });
 test('forged V2 digest, approved school mismatch, nested alias and getters fail closed',async()=>{
  const s=await snapshot(),p=await create(s);
  const altered=copy(p);altered.snapshot.appData.documentHistoryV2.events[0].eventDigest='0'.repeat(64);
  await reject(inspect(altered,s));
  await reject(createInstitutionalBackupPayloadV9(s,[],{...school,subjectCode:'MATH'},at));
  const nested=copy(s);(nested.settings as any).extra={documentHistoryV2:empty()};await reject(create(nested));
  const accessor=copy(s);let accessed=false;
  Object.defineProperty(accessor.appData,'documentHistoryV2',{enumerable:true,get(){accessed=true;return empty();}});
  await reject(create(accessor));expect(accessed).toBe(false);
 });
 test('V9 requires an independently approved scope and preserves all previous V2 events',async()=>{
  const h=await histories(),current=await snapshot(h.initial),incoming=await snapshot(h.revoked);
  const old=copy(current),p=await create(incoming),recovery=await create(current);
  const restored=await project(current,p,recovery);
  expect((restored.appData as any).documentHistoryV2.events).toHaveLength(2);
  expect((restored.appData as any).documentHistoryV2.events[0]).toEqual(h.initial.events[0]);
  expect(current).toEqual(old);
  await reject(createInstitutionalBackupPayloadV9(current,[],null,at));
 });
 test('V9 recovery rejects missing events, stale/mismatched checkpoint or split V7 assessments',async()=>{
  const h=await histories(),current=await snapshot(h.revoked),older=await snapshot(h.initial);
  await reject(project(current,await create(older),await create(current)));
  await reject(project(current,await create(current),await create(older)));
  const forged=copy(await create(current));(forged.snapshot.appData as any).classes=[];
  await reject(project(current,forged,await create(current)));
 });
 test('V9 never loses previously recorded class, student, grade, behavior or council rows',async()=>{
  const current=await snapshot();
  const cls=current.appData.classes[0];
  cls.students=[{id:'s1',name:'Alunno sintetico'}];
  cls.grades=[{id:'g1',studentId:'s1',date:'2026-11-20',type:'disegno',period:'Q1',title:'Prova sintetica',value:'8'}];
  cls.behaviors=[{id:'b1',studentId:'s1',date:'2026-11-20',status:'Costruttivo 👍',note:'Osservazione sintetica'}];
  cls.councilSessions=[{id:'c1',schoolYear:'2026/2027',kind:'intermedia',date:'2026-11-20',createdAt:at,updatedAt:at}];
  const baseline=await create(current);
  for(const field of ['students','grades','behaviors','councilSessions'] as const){
   const stripped=copy(current);
   (stripped.appData.classes[0] as any)[field]=[];
   await reject(project(current,await create(stripped),baseline));
  }
  const omitted=copy(current);omitted.appData.classes=[];
  await reject(project(current,await create(omitted),baseline));
  const modified=copy(current);modified.appData.classes[0].grades[0].value='6';
  await reject(project(current,await create(modified),baseline));
 });
 test('V9 encryption excludes local-only backup verification but never silently removes professional data',async()=>{
  const s=await snapshot();s.meta={...s.meta,verifiedBackupAt:at,
   verifiedBackupEvidence:{bytes:150,sha256:'a'.repeat(64),source:'android-readback',payloadVersion:6,checkpointAt:at}};
  const p=await create(s);
  expect(p.snapshot.meta.verifiedBackupAt).toBeUndefined();
  expect(p.snapshot.meta.verifiedBackupEvidence).toBeUndefined();
  expect(s.meta.verifiedBackupAt).toBe(at);
  const restored=await inspect(p,s);
  expect(restored.snapshot.appData.documentHistoryV2.events).toHaveLength(1);
 });
});
