import {beforeAll,describe,expect,test} from 'bun:test';
import type {AppSettings,ClassData} from '../types';
import type {CompleteSecureAppSnapshot} from './secureAppStorage';
import {createInitialArchiveSnapshot} from './initialArchiveSetup';
import {boardDocument,boardScope} from '../../tests/browser/fixtures/val01-s6c-data';
import {prepareFormativeBalance,confirmFormativeBalance} from '../assessment/formativeBalance';
import {prepareFormativeBalanceCommitPreflight} from '../assessment/formativeBalanceCommitPreflight';
import {proposeFormativeBalanceHistoryAppend} from '../assessment/formativeBalanceHistory';
import {createFormativeBackupPayloadV10,inspectFormativeBackupPayloadV10,
 projectFormativeRestoreV10,encryptFormativeBackupV10,decryptAndInspectFormativeBackupV10} from './formativeBackupPayloadV10';
import {createInstitutionalBackupPayloadV9} from './institutionalBackupPayloadV9';
import {createAssessmentBackupPayloadV7} from './assessmentBackupPayload';
import {createBackupPayload} from './backupPayload';
import {BACKUP_VERSION_V2,decryptDataWithPassword} from '../cryptoUtils';
beforeAll(()=>{const x=globalThis as typeof globalThis&{window?:typeof globalThis};if(!x.window)x.window=globalThis;});
const at='2027-02-01T10:10:00.000Z',password='synthetic v10 laboratory password';
const approved=[{classId:boardScope.classId,schoolYear:boardScope.schoolYear,subjectCode:boardScope.subjectCode}];
const docs={institutionCode:'ZZIC00000A',siteCode:'ZZMM000001',schoolYear:'2026/2027',
 schoolOrder:'lower-secondary' as const,gradeLevel:2 as const,
 classId:boardScope.classId,subjectCode:boardScope.subjectCode,purpose:'disciplinary-plan' as const};
const scope=[boardScope],copy=<T>(v:T):T=>structuredClone(v);
const klass=(s:CompleteSecureAppSnapshot)=>s.appData.classes[0] as ClassData&{formativeBalanceHistoryV1?:any};
function basic():CompleteSecureAppSnapshot{
 const s=createInitialArchiveSnapshot({mode:'professional',
   profile:{school:'Istituto sintetico',year:'2026/27',teacher:'Docente sintetico',subject:'Tecnologia'}});
 const c:ClassData={id:boardScope.classId,name:'Fittizia',
   students:boardScope.studentIds.map(id=>({id,name:'Studente sintetico '+id})),
   grades:[],behaviors:[],
   assessmentEvidenceV1:{version:1,documents:[{document:copy(boardDocument),bindings:[]}]}};
 s.appData={classes:[c],currentClassId:c.id};
 (s.appData as any).documentHistoryV2={schemaVersion:2,labOnly:false,events:[]};
 s.meta={changes:2,lastBackup:null};
 return s as CompleteSecureAppSnapshot;
}
async function candidate(c:ClassData,stamp:string,learning:string){
 const context={classId:boardScope.classId,schoolYear:boardScope.schoolYear,
   subjectCode:boardScope.subjectCode,studentId:'s1',period:'Q1' as const,from:'2026-09-01',to:'2027-01-31'};
 const r=await prepareFormativeBalance(c.assessmentEvidenceV1!.documents[0].document,boardScope,context,
   {evidenceRevisionIds:['r-1'],comparisons:[],teacherText:{learning,progress:'',nextStep:'Consolidare'}});
 if(!r.valid)throw Error(r.issue);
 const confirmed=await confirmFormativeBalance(c.assessmentEvidenceV1!.documents[0].document,boardScope,context,r.preview,
   {confirmedByTeacher:true,confirmedAt:stamp});
 if(!confirmed.valid)throw Error(confirmed.issue);
 const p=await prepareFormativeBalanceCommitPreflight(c,
   {year:boardScope.schoolYear,subject:boardScope.subjectCode} as AppSettings,confirmed.balance);
 if(!p.valid)throw Error(p.issue);
 return p.candidate;
}
async function historical(revisions=1):Promise<CompleteSecureAppSnapshot>{
 const s=basic(),c=klass(s);
 const settings={year:boardScope.schoolYear,subject:boardScope.subjectCode};
 const one=await proposeFormativeBalanceHistoryAppend(undefined,
   await candidate(c,'2027-02-01T10:00:00.000Z','Osservazione sintetica del docente'),c,settings,
   {id:'formative-1',recordedAt:'2027-02-01T10:00:01.000Z'});
 if(!one.valid)throw Error(one.issue);
 let h=one.history;
 if(revisions===2){
   const two=await proposeFormativeBalanceHistoryAppend(h,
     await candidate(c,'2027-02-01T10:01:00.000Z','Nuova formulazione sintetica del docente'),c,settings,
     {id:'formative-2',recordedAt:'2027-02-01T10:01:01.000Z'});
   if(!two.valid)throw Error(two.issue);
   h=two.history;
 }
 c.formativeBalanceHistoryV1=h;
 return s;
}
const create=(s:unknown,approvedForm:unknown=scope)=>
 createFormativeBackupPayloadV10(s,approved,docs,approvedForm,at);
const inspect=(p:unknown,s:CompleteSecureAppSnapshot,oldForm:unknown=scope,newForm:unknown=scope)=>
 inspectFormativeBackupPayloadV10(p,s,approved,docs,oldForm,newForm);
const project=(s:CompleteSecureAppSnapshot,i:unknown,r:unknown)=>
 projectFormativeRestoreV10(s,i,r,approved,approved,docs,scope,scope);
const reject=async(p:Promise<unknown>)=>expect(p).rejects.toThrow('FORMATIVE_V10_REJECTED');
describe('VAL-01/PRODUCT-05/S7d.2b — isolated V10 lossless encrypted backup',()=>{
 test('V10 retains original V9 document, assessment and two linked formative revisions',async()=>{
  const s=await historical(2),before=copy(s);
  const p=await create(s),read=await inspect(p,s);
  expect(p.backupDataVersion).toBe(10);
  expect(read.sourceVersion).toBe(10);
  expect(read.replacementRequiresReview).toBe(true);
  expect(read.snapshot).toEqual(before);
  expect(klass(read.snapshot).formativeBalanceHistoryV1.records.map((x:any)=>x.revision)).toEqual([1,2]);
  expect(s).toEqual(before);
 });
 test('AES-GCM V2 ciphertext hides text; authenticated decrypt roundtrips, wrong password rejects',async()=>{
  const s=await historical(2);
  const ciphertext=await encryptFormativeBackupV10(s,password,approved,docs,scope,at);
  expect(JSON.parse(ciphertext).version).toBe(BACKUP_VERSION_V2);
  expect(ciphertext).not.toContain('Nuova formulazione sintetica del docente');
  const raw=await decryptDataWithPassword(ciphertext,password);
  const read=await decryptAndInspectFormativeBackupV10(ciphertext,password,s,approved,docs,scope,scope);
  expect(raw.backupDataVersion).toBe(10);
  expect(read.snapshot).toEqual(raw.snapshot);
  await reject(decryptAndInspectFormativeBackupV10(ciphertext,'incorrect',s,approved,docs,scope,scope));
 });
 test('V6-V9 encoders reject formative history; V10 never auto-downgrades',async()=>{
  const s=await historical(),p=await create(s);
  expect(()=>createBackupPayload(s,at)).toThrow();
  await expect(createAssessmentBackupPayloadV7(s,approved,at)).rejects.toThrow();
  await expect(createInstitutionalBackupPayloadV9(s,approved,docs,at)).rejects.toThrow();
  await reject(inspect({...p,backupDataVersion:9},s));
  await reject(inspect({...p,unknown:true},s));
  const wrong=copy(p);delete (wrong.snapshot.appData as any).documentHistoryV2;
  await reject(inspect(wrong,s));
 });
 test('independent roster and scope; nested alias and getters fail closed',async()=>{
  const s=await historical();
  await reject(create(s,[]));
  await reject(create(s,[{...boardScope,studentIds:['s1']}]));
  await reject(create(s,[{...boardScope,subjectCode:'OTHER'}]));
  await reject(create(s,[boardScope,boardScope]));
  const wrong=copy(s);klass(wrong).formativeBalanceHistoryV1.classId='other';
  await reject(create(wrong));
  const nested=copy(s);(nested.settings as any).alias={formativeBalanceHistoryV1:{}};
  await reject(create(nested));
  let calls=0,accessor=copy(s);
  Object.defineProperty(klass(accessor),'formativeBalanceHistoryV1',{enumerable:true,
    get(){calls++;return klass(s).formativeBalanceHistoryV1;}});
  await reject(create(accessor));expect(calls).toBe(0);
 });
 test('forged SHA chain or truncated revision never becomes a valid backup',async()=>{
  const s=await historical(2);
  const text=copy(s);klass(text).formativeBalanceHistoryV1.records[0].teacherText.learning='altered';
  await reject(create(text));
  const dropped=copy(s);klass(dropped).formativeBalanceHistoryV1.records.shift();
  await reject(create(dropped));
 });
 test('conservative V10 recovery protects revisions and requires exact checkpoint',async()=>{
  const older=await historical(),newer=await historical(2);
  const incoming=await create(newer),checkpoint=await create(older);
  const projection=await project(older,incoming,checkpoint);
  expect(klass(projection).formativeBalanceHistoryV1.records).toHaveLength(2);
  expect((projection.appData as any).documentHistoryV2).toEqual((older.appData as any).documentHistoryV2);
  await reject(project(newer,await create(older),await create(newer)));
  await reject(project(newer,await create(newer),await create(older)));
  const missing=copy(older);delete klass(missing).formativeBalanceHistoryV1;
  await reject(project(older,await create(missing,[]),checkpoint));
 });
 test('explicit V9 professional source without history produces empty V10 history, no inference',async()=>{
  const s=basic(),saved=copy(s);
  const p=await create(s,[]);
  expect(p.backupDataVersion).toBe(10);
  expect(klass(p.snapshot).formativeBalanceHistoryV1).toBeUndefined();
  const read=await inspect(p,s,[],[]);
  expect(klass(read.snapshot).formativeBalanceHistoryV1).toBeUndefined();
  expect(s).toEqual(saved);
 });
});
