import {describe,test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
import type {ClassData,AppSettings,AppData} from '../types';
import type {FormativeBalanceCommitCandidateV1} from '../assessment/formativeBalanceCommitPreflight';
import type {FormativeBalanceHistoryV1} from '../assessment/formativeBalanceHistory';
import {boardDocument,boardScope} from '../../tests/browser/fixtures/val01-s6c-data';
import {prepareFormativeBalance,confirmFormativeBalance} from '../assessment/formativeBalance';
import {prepareFormativeBalanceCommitPreflight} from '../assessment/formativeBalanceCommitPreflight';
import {proposeFormativeBalanceHistoryAppend,validateFormativeBalanceHistoryV1,
 preservesFormativeBalanceHistory} from '../assessment/formativeBalanceHistory';
import {assertNoUnsupportedDocumentHistory,assertNoUnsupportedFormativeHistory} from './documentHistoryBackupFence';
import {SecureAppStorage} from './secureAppStorage';
import type {SecureVault} from './secureVault';
const settings={year:boardScope.schoolYear,subject:boardScope.subjectCode} as AppSettings;
const original=():ClassData=>({id:boardScope.classId,name:'Classe sintetica',
 students:boardScope.studentIds.map(id=>({id,name:'Alunno fittizio '+id})),
 grades:[],behaviors:[],
 assessmentEvidenceV1:{version:1,documents:[{document:structuredClone(boardDocument),bindings:[]}]}
} as ClassData);
const sourceContext={classId:boardScope.classId,schoolYear:boardScope.schoolYear,
 subjectCode:boardScope.subjectCode,studentId:'s1',period:'Q1' as const,
 from:'2026-09-01',to:'2027-01-31'};
async function candidate(cls:ClassData=original(),at='2027-02-01T10:00:00.000Z',
 learning='Testo documentato dal docente'):Promise<FormativeBalanceCommitCandidateV1>{
 const doc=cls.assessmentEvidenceV1!.documents[0].document;
 const request={evidenceRevisionIds:['r-1'],comparisons:[],
  teacherText:{learning,progress:'',nextStep:'Consolidare la filiera'}};
 const review=await prepareFormativeBalance(doc,boardScope,sourceContext,request);
 if(!review.valid)throw Error('fixture review: '+review.issue);
 const confirmed=await confirmFormativeBalance(doc,boardScope,sourceContext,review.preview,
  {confirmedByTeacher:true,confirmedAt:at});
 if(!confirmed.valid)throw Error('fixture confirm: '+confirmed.issue);
 const preflight=await prepareFormativeBalanceCommitPreflight(cls,settings,confirmed.balance);
 if(!preflight.valid)throw Error('fixture preflight: '+preflight.issue);
 return preflight.candidate;
}
async function first(cls=original()){
 const p=await candidate(cls);
 const result=await proposeFormativeBalanceHistoryAppend(undefined,p,cls,settings,
  {id:'s7d1-001',recordedAt:'2027-02-01T10:00:01.000Z'});
 if(!result.valid)throw Error('fixture append: '+result.issue);
 return {cls,p,...result};
}
const copy=<T>(value:T):T=>structuredClone(value);
describe('VAL-01/PRODUCT-05/S7d1 — append-only history without saving',()=>{
 test('minimal standalone record; exact approved owner, time and digest; no mutation',async()=>{
  const cls=original(),before=JSON.stringify(cls),p=await candidate(cls);
  const result=await proposeFormativeBalanceHistoryAppend(undefined,p,cls,settings,
   {id:'s7d1-001',recordedAt:'2027-02-01T10:00:01.000Z'});
  expect(result.valid).toBe(true);
  if(!result.valid)throw Error(result.issue);
  expect(result.state).toBe('proposed-not-saved');
  expect(result.history.version).toBe(1);
  expect(result.history.records).toHaveLength(1);
  expect(result.record.revision).toBe(1);
  expect(result.record.previousDigest).toBe(null);
  expect(result.record.supersedesRecordId).toBe(null);
  expect(result.record.contentDigest).toMatch(/^[a-f0-9]{64}$/);
  expect(result.record.context).toEqual(sourceContext);
  expect(result.record.confirmedAt).toBe('2027-02-01T10:00:00.000Z');
  const text=JSON.stringify(result.history);
  for(const forbidden of ['Scelta motivata','rubric-v1','Alunno fittizio',
   'assessmentEvidenceV1','rawFact','competenceLevel','"document":','"grade":'])
   expect(text).not.toContain(forbidden);
  expect(JSON.stringify(cls)).toBe(before);
  expect((await validateFormativeBalanceHistoryV1(result.history,boardScope)).valid).toBe(true);
 });
 test('second explicit session makes revision 2 and preserves original bytes',async()=>{
  const f=await first(),frozen=JSON.stringify(f.history);
  const q=await candidate(f.cls,'2027-02-01T10:01:00.000Z','Nuova formulazione docente');
  const result=await proposeFormativeBalanceHistoryAppend(f.history,q,f.cls,settings,
    {id:'s7d1-002',recordedAt:'2027-02-01T10:01:01.000Z'});
  expect(result.valid).toBe(true);
  if(!result.valid)throw Error(result.issue);
  expect(result.record.revision).toBe(2);
  expect(result.record.supersedesRecordId).toBe('s7d1-001');
  expect(result.record.previousDigest).toBe(f.record.contentDigest);
  expect(JSON.stringify(result.history.records[0])).toBe(JSON.stringify(f.record));
  expect(JSON.stringify(f.history)).toBe(frozen);
  expect(await preservesFormativeBalanceHistory(f.history,result.history,boardScope)).toBe(true);
  expect(await preservesFormativeBalanceHistory(result.history,f.history,boardScope)).toBe(false);
 });
 test('duplicate ID, replayed confirmation and wrong clock are rejected',async()=>{
  const f=await first();
  expect((await proposeFormativeBalanceHistoryAppend(f.history,f.p,f.cls,settings,
   {id:'s7d1-001',recordedAt:'2027-02-01T10:00:03.000Z'})).valid).toBe(false);
  expect((await proposeFormativeBalanceHistoryAppend(f.history,f.p,f.cls,settings,
   {id:'s7d1-other',recordedAt:'2027-02-01T10:00:03.000Z'})).valid).toBe(false);
  expect((await proposeFormativeBalanceHistoryAppend(undefined,f.p,f.cls,settings,
   {id:'another',recordedAt:'2027-02-01T09:59:59.000Z'})).valid).toBe(false);
  expect((await proposeFormativeBalanceHistoryAppend(undefined,f.p,f.cls,settings,
   {id:'another',recordedAt:'2027-02-01T10:00:02Z'})).valid).toBe(false);
  expect((await proposeFormativeBalanceHistoryAppend(undefined,f.p,f.cls,settings,
   {id:'another',recordedAt:'2027-02-01T10:00:02.000Z',extra:true})).valid).toBe(false);
 });
 test('tampering with text, digest, metadata or unknown keys fails closed',async()=>{
  const f=await first();
  for(const change of [
    (r:any)=>{r.teacherText.learning='Testo manipolato';},
    (r:any)=>{r.contentDigest='0'.repeat(64);},
    (r:any)=>{r.evidenceRevisionIds=['r-1','r-1'];},
    (r:any)=>{r.context.studentId='s2';},
    (r:any)=>{r.context.from='2026-11-31';},
    (r:any)=>{r.confirmedByTeacher=false;},
    (r:any)=>{r.unauthorized='foreign metadata';}
  ]){
   const h=copy(f.history);
   change((h.records as any[])[0]);
   expect((await validateFormativeBalanceHistoryV1(h,boardScope)).valid).toBe(false);
   expect(await preservesFormativeBalanceHistory(f.history,h,boardScope)).toBe(false);
  }
 });
 test('wrong independent owner and missing roster fail closed, no inference',async()=>{
  const f=await first();
  expect((await validateFormativeBalanceHistoryV1(f.history,
    {...boardScope,studentIds:['s2']})).valid).toBe(false);
  expect((await validateFormativeBalanceHistoryV1(f.history,
    {...boardScope,schoolYear:'2027/2028'})).valid).toBe(false);
  expect((await validateFormativeBalanceHistoryV1(f.history,
    {...boardScope,subjectCode:'MATH'})).valid).toBe(false);
  expect((await validateFormativeBalanceHistoryV1(f.history,
    {...boardScope,studentIds:['s1','s1']})).valid).toBe(false);
 });
 test('historical revisions survive later source edits; fresh proposals do not',async()=>{
  const f=await first();
  const old=f.history;
  const doc=f.cls.assessmentEvidenceV1!.documents[0].document;
  const assessment=doc.assessments.find(x=>x.revisionId==='a2');
  if(!assessment)throw Error('fixture missing');
  assessment.title='Changed after historical acquisition';
  expect((await validateFormativeBalanceHistoryV1(old,boardScope)).valid).toBe(true);
  expect((await proposeFormativeBalanceHistoryAppend(old,f.p,f.cls,settings,
    {id:'s7d1-second',recordedAt:'2027-02-01T10:00:05.000Z'})).valid).toBe(false);
  expect(await preservesFormativeBalanceHistory(old,old,boardScope)).toBe(true);
 });
 test('no missing, truncated, reordered or altered historical rows in future restoration',async()=>{
  const f=await first();
  const q=await candidate(f.cls,'2027-02-01T10:01:00.000Z','Revisione successiva');
  const next=await proposeFormativeBalanceHistoryAppend(f.history,q,f.cls,settings,
   {id:'s7d1-second',recordedAt:'2027-02-01T10:01:01.000Z'});
  if(!next.valid)throw Error(next.issue);
  const lost=copy(next.history) as any;lost.records.shift();
  const reordered=copy(next.history) as any;reordered.records.reverse();
  const parent=copy(next.history) as any;parent.records[1].previousDigest=null;
  expect((await validateFormativeBalanceHistoryV1(lost,boardScope)).valid).toBe(false);
  expect((await validateFormativeBalanceHistoryV1(reordered,boardScope)).valid).toBe(false);
  expect((await validateFormativeBalanceHistoryV1(parent,boardScope)).valid).toBe(false);
  expect(await preservesFormativeBalanceHistory(next.history,f.history,boardScope)).toBe(false);
  expect(await preservesFormativeBalanceHistory(undefined,next.history,boardScope)).toBe(true);
  expect(await preservesFormativeBalanceHistory(f.history,undefined,boardScope)).toBe(false);
 });
 test('reject malformed accessors and circular graphs without triggering getters',async()=>{
  const f=await first();
  let getterCalls=0;
  const malicious=copy(f.history) as any;
  Object.defineProperty(malicious.records[0],'teacherText',{enumerable:true,
   get(){getterCalls++;return {learning:'stolen',progress:'',nextStep:''};}});
  expect((await validateFormativeBalanceHistoryV1(malicious,boardScope)).valid).toBe(false);
  expect(getterCalls).toBe(0);
  const circular:any={...f.history};circular.records=[circular];
  expect((await validateFormativeBalanceHistoryV1(circular,boardScope)).valid).toBe(false);
 });
 test('old backup V6–V9 paths and ordinary AppData saves reject reserved S7d history',async()=>{
  const f=await first();
  const appData={classes:[{...f.cls,formativeBalanceHistoryV1:f.history}],
   currentClassId:f.cls.id} as unknown as AppData;
  expect(()=>assertNoUnsupportedDocumentHistory({snapshot:{appData}}))
    .toThrow('DOC01_HISTORY_BACKUP_UNSUPPORTED');
  expect(()=>assertNoUnsupportedFormativeHistory(appData))
    .toThrow('FORMATIVE_HISTORY_STORAGE_UNSUPPORTED');
  // Legitimate DOC-01/V2 remains writable by the ordinary AppData path.
  expect(()=>assertNoUnsupportedFormativeHistory({documentHistoryV2:{version:2}})).not.toThrow();
  let calls=0;
  const vault={put:async()=>{calls++},putMany:async()=>{calls++}} as unknown as SecureVault;
  const storage=new SecureAppStorage(vault);
  await expect(storage.saveAppData(appData)).rejects.toThrow('FORMATIVE_HISTORY_STORAGE_UNSUPPORTED');
  await expect(storage.saveAppDataAndMeta(appData,{changes:0,lastBackup:null}))
   .rejects.toThrow('FORMATIVE_HISTORY_STORAGE_UNSUPPORTED');
  expect(calls).toBe(0);
  for(const file of ['backupPayload.ts','assessmentBackupPayload.ts','documentBackupPayloadV8.ts','institutionalBackupPayloadV9.ts']){
   const source=readFileSync('src/security/'+file,'utf8');
   expect(source).toContain('assertNoUnsupportedDocumentHistory');
  }
 });
 test('history proposal is detached from app types and UI: no hidden persistence or release',()=>{
  const src=readFileSync('src/assessment/formativeBalanceHistory.ts','utf8');
  for(const blocked of ['vault.put','putMany(', 'saveAppData(', 'sessionStorage','indexedDB','fetch(',
    'window.print','setAppData(','localStorage','exportPdf'])
    expect(src).not.toContain(blocked);
  const type=readFileSync('src/types.ts','utf8');
  expect(type).not.toContain('formativeBalanceHistoryV1');
  expect(type).not.toContain('FormativeBalanceHistoryV1');
  const ui=readFileSync('src/components/StudentFormativeBalanceDraft.tsx','utf8');
  expect(ui).not.toContain('Salva bilancio cifrato');
 });
});
