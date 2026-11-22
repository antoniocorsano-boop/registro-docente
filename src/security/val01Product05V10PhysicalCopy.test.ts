/** VAL-01 S7d.2c — invented school and student IDs, synthetic files only. */
import {beforeAll,describe,expect,test} from 'bun:test';
import type {AppSettings,ClassData} from '../types';
import type {CompleteSecureAppSnapshot} from './secureAppStorage';
import type {AndroidBackupRuntime} from './androidBackupExport';
import {readEncryptedBackupOnAndroid} from './androidBackupExport';
import {createInitialArchiveSnapshot} from './initialArchiveSetup';
import {boardDocument,boardScope} from '../../tests/browser/fixtures/val01-s6c-data';
import {prepareFormativeBalance,confirmFormativeBalance} from '../assessment/formativeBalance';
import {prepareFormativeBalanceCommitPreflight} from '../assessment/formativeBalanceCommitPreflight';
import {proposeFormativeBalanceHistoryAppend} from '../assessment/formativeBalanceHistory';
import {encryptFormativeBackupV10} from './formativeBackupPayloadV10';
import {createFormativeV10CopyLaboratory,previewFormativeV10PhysicalRecoveryLaboratory} from '../persistence/formativeV10CopyLaboratory';

beforeAll(()=>{const root=globalThis as typeof globalThis&{window?:typeof globalThis};if(!root.window)root.window=globalThis;});
const at='2027-02-01T10:10:00.000Z',pass='synthetic only v10 password';
const assessmentScopes=[{classId:boardScope.classId,schoolYear:boardScope.schoolYear,subjectCode:boardScope.subjectCode}];
const documentScope={institutionCode:'ZZIC00000A',siteCode:'ZZMM000001',schoolYear:'2026/2027',
 schoolOrder:'lower-secondary' as const,gradeLevel:2 as const,classId:'2C',subjectCode:boardScope.subjectCode,
 purpose:'disciplinary-plan' as const};
const formativeScopes=[boardScope];
const req={assessmentScopes,documentScope,formativeScopes,checkpointAt:at};
const scopes={currentAssessmentScopes:assessmentScopes,incomingAssessmentScopes:assessmentScopes,
 documentScope,currentFormativeScopes:formativeScopes,incomingFormativeScopes:formativeScopes};
const copy=<T>(v:T):T=>structuredClone(v);
function original():CompleteSecureAppSnapshot{
 const s=createInitialArchiveSnapshot({mode:'professional',profile:{school:'Fittizio',year:'2026/27',
  teacher:'Docente sintetico',subject:'Tecnologia'}});
 const c:ClassData={id:boardScope.classId,name:'Classe inventata',
  students:boardScope.studentIds.map(id=>({id,name:'Studente inventato '+id})),grades:[],behaviors:[],
  assessmentEvidenceV1:{version:1,documents:[{document:copy(boardDocument),bindings:[]}]}};
 s.appData={classes:[c],currentClassId:c.id};
 (s.appData as any).documentHistoryV2={schemaVersion:2,labOnly:false,events:[]};
 s.meta={changes:2,lastBackup:null};
 return s as CompleteSecureAppSnapshot;
}
const cls=(s:CompleteSecureAppSnapshot)=>s.appData.classes[0] as ClassData&{formativeBalanceHistoryV1?:any};
async function makeCandidate(c:ClassData,confirmedAt:string,text:string){
 const ctx={classId:boardScope.classId,schoolYear:boardScope.schoolYear,subjectCode:boardScope.subjectCode,
  studentId:'s1',period:'Q1' as const,from:'2026-09-01',to:'2027-01-31'};
 const doc=c.assessmentEvidenceV1!.documents[0].document;
 const first=await prepareFormativeBalance(doc,boardScope,ctx,{evidenceRevisionIds:['r-1'],comparisons:[],
  teacherText:{learning:text,progress:'',nextStep:'Consolidare'}});
 if(!first.valid)throw Error(first.issue);
 const second=await confirmFormativeBalance(doc,boardScope,ctx,first.preview,{confirmedByTeacher:true,confirmedAt});
 if(!second.valid)throw Error(second.issue);
 const third=await prepareFormativeBalanceCommitPreflight(c,
  {year:boardScope.schoolYear,subject:boardScope.subjectCode} as AppSettings,second.balance);
 if(!third.valid)throw Error(third.issue);
 return third.candidate;
}
async function historical(n=1){
 const snapshot=original(),c=cls(snapshot),settings={year:boardScope.schoolYear,subject:boardScope.subjectCode};
 const first=await proposeFormativeBalanceHistoryAppend(undefined,
  await makeCandidate(c,'2027-02-01T10:00:00.000Z','Testo riservato sintetico'),c,settings,
  {id:'synthetic-balance-one',recordedAt:'2027-02-01T10:00:01.000Z'});
 if(!first.valid)throw Error(first.issue);
 let h=first.history;
 if(n===2){
  const second=await proposeFormativeBalanceHistoryAppend(h,
   await makeCandidate(c,'2027-02-01T10:01:00.000Z','Secondo testo sintetico'),c,settings,
   {id:'synthetic-balance-two',recordedAt:'2027-02-01T10:01:01.000Z'});
  if(!second.valid)throw Error(second.issue);
  h=second.history;
 }
 c.formativeBalanceHistoryV1=h;
 return snapshot;
}
function owner(){
 let active=true,lab=true;
 return {authority:{isActive:()=>active,laboratoryApproved:()=>lab},
  revoke:()=>{active=false;},disable:()=>{lab=false;},enable:()=>{lab=true;}};
}
async function digest(text:string){
 const bytes=new TextEncoder().encode(text),value=await crypto.subtle.digest('SHA-256',bytes);
 return {bytes:bytes.length,sha256:Array.from(new Uint8Array(value),x=>x.toString(16).padStart(2,'0')).join('')};
}
function androidRuntime(onSelect:(filename:string)=>void,write:(ciphertext:string)=>Promise<unknown>):AndroidBackupRuntime{
 return {androidBridge:{},sessionAccess:async active=>active(),Capacitor:{
  getPlatform:()=> 'android',Plugins:{RegistroBackupFiles:{
   chooseBackupDestination:async({filename})=>{onSelect(filename);return {status:'selected',token:'synthetic-only-token'};},
   writeEncryptedBackup:async({token,encryptedText})=>{
    expect(token).toBe('synthetic-only-token');
    return write(encryptedText);
   }
  }}}};
}
describe('VAL-01/PRODUCT-05/S7d.2c — V10 actual-byte laboratory and non-restore',()=>{
 test('preparation authenticates V10 and holds no plaintext in one-use proof',async()=>{
  const s=await historical(2),before=copy(s),o=owner(),lab=createFormativeV10CopyLaboratory(o.authority);
  const p=await lab.prepare(s,pass,req);
  expect(p.receipt).toEqual({payloadVersion:10,checkpointAt:at,includedChanges:2});
  expect(p.evidence.payloadVersion).toBe(10);
  expect(p.evidence.sha256).toMatch(/^[a-f0-9]{64}$/);
  expect(p.encryptedText).not.toContain('Secondo testo sintetico');
  expect(p.encryptedText).not.toContain(pass);
  expect(s).toEqual(before);
  expect(()=>lab.consume(p.receipt,{changes:2})).toThrow();
 });
 test('Web copy requires actual byte-identical reselected Blob; receipt is one-use, no meta write',async()=>{
  const s=await historical(),m=copy(s.meta),o=owner(),lab=createFormativeV10CopyLaboratory(o.authority);
  const p=await lab.prepare(s,pass,req);
  expect(await lab.verifyWeb(p.receipt,new Blob([p.encryptedText]))).toBe('verified');
  const proof=lab.consume(p.receipt,s.meta);
  expect(proof).toMatchObject({state:'lab-verified-no-metadata-write',payloadVersion:10,
    source:'web-readback',sha256:p.evidence.sha256,bytes:p.evidence.bytes});
  expect(s.meta).toEqual(m);
  expect(()=>lab.consume(p.receipt,s.meta)).toThrow();
 });
 test('Web aborted, corrupted, unreadable files never produce verified state',async()=>{
  const o=owner(),lab=createFormativeV10CopyLaboratory(o.authority),s=await historical();
  const p=await lab.prepare(s,pass,req);
  await expect(lab.verifyWeb(p.receipt,new Blob([p.encryptedText.slice(0,-3)]))).rejects.toThrow();
  expect(()=>lab.consume(p.receipt,s.meta)).toThrow();
  const n=await lab.prepare(s,pass,req);
  await expect(lab.verifyWeb(n.receipt,{size:n.evidence.bytes,
   arrayBuffer:async()=>{throw Error('Synthetic disk read interrupted');}} as Blob)).rejects.toThrow();
  expect(()=>lab.consume(n.receipt,s.meta)).toThrow();
 });
 test('Android native plugin receives ciphertext only; its verified physical-byte receipt is required',async()=>{
  const o=owner(),lab=createFormativeV10CopyLaboratory(o.authority),s=await historical();
  const p=await lab.prepare(s,pass,req);
  let filename='',stored='';
  const rt=androidRuntime(x=>{filename=x;},async ciphertext=>{
   stored=ciphertext;
   return {status:'verified',...await digest(stored)};
  });
  expect(await lab.verifyAndroid(p.receipt,p.encryptedText,'s7d2c-synthetic.enc.json',rt)).toBe('verified');
  expect(filename).toBe('s7d2c-synthetic.enc.json');
  expect(stored).toBe(p.encryptedText);
  expect(stored).not.toContain('Testo riservato sintetico');
  const proof=lab.consume(p.receipt,s.meta);
  expect(proof.source).toBe('android-readback');
  expect(proof.payloadVersion).toBe(10);
 });
 test('Android cancellation, wrong digest and altered encrypted bytes cannot confirm save',async()=>{
  const o=owner(),lab=createFormativeV10CopyLaboratory(o.authority),s=await historical();
  const a=await lab.prepare(s,pass,req);
  const cancel:AndroidBackupRuntime={androidBridge:{},sessionAccess:async active=>active(),Capacitor:{
   getPlatform:()=> 'android',Plugins:{RegistroBackupFiles:{
    chooseBackupDestination:async()=>({status:'cancelled'}),
    writeEncryptedBackup:async()=>{throw Error('Cancelled picker must not write');}
   }}}};
  expect(await lab.verifyAndroid(a.receipt,a.encryptedText,'synthetic.enc.json',cancel)).toBe('cancelled');
  expect(()=>lab.consume(a.receipt,s.meta)).toThrow();
  const refused=await lab.prepare(s,pass,req);
  await expect(lab.verifyAndroid(refused.receipt,refused.encryptedText,'synthetic.enc.json',
   androidRuntime(()=>{},async()=>({status:'cancelled'})))).rejects.toThrow();
  const b=await lab.prepare(s,pass,req);
  await expect(lab.verifyAndroid(b.receipt,b.encryptedText,'synthetic.enc.json',
   androidRuntime(()=>{},async()=>({status:'verified',bytes:4,sha256:'bad'})))).rejects.toThrow();
  const c=await lab.prepare(s,pass,req);
  await expect(lab.verifyAndroid(c.receipt,c.encryptedText+' ','synthetic.enc.json',
   androidRuntime(()=>{},async ciphertext=>({status:'verified',...await digest(ciphertext)})))).rejects.toThrow();
 });
 test('session revocation, overlapping preparations, stale changes and repeated verification fail closed',async()=>{
  const o=owner(),lab=createFormativeV10CopyLaboratory(o.authority),s=await historical();
  const a=await lab.prepare(s,pass,req);
  const b=await lab.prepare(s,pass,req);
  await expect(lab.verifyWeb(a.receipt,new Blob([a.encryptedText]))).rejects.toThrow();
  expect(await lab.verifyWeb(b.receipt,new Blob([b.encryptedText]))).toBe('verified');
  expect(()=>lab.consume(b.receipt,{changes:3})).toThrow();
  const c=await lab.prepare(s,pass,req);
  o.revoke();
  await expect(lab.verifyWeb(c.receipt,new Blob([c.encryptedText]))).rejects.toThrow();
  expect(()=>lab.consume(c.receipt,s.meta)).toThrow();
 });
 test('future physical recovery preview validates two encrypted files, preserves history, never restores',async()=>{
  const o=owner(),before=await historical(),later=await historical(2),preserved=copy(before);
  const incoming=await encryptFormativeBackupV10(later,pass,assessmentScopes,documentScope,formativeScopes,at);
  const recovery=await encryptFormativeBackupV10(before,pass,assessmentScopes,documentScope,formativeScopes,at);
  const result=await previewFormativeV10PhysicalRecoveryLaboratory(o.authority,before,incoming,recovery,pass,scopes);
  expect(result).toEqual({state:'lab-projected-not-restored',payloadVersion:10,classCount:1,
   formativeRevisionCount:2});
  expect(before).toEqual(preserved);
  await expect(previewFormativeV10PhysicalRecoveryLaboratory(o.authority,later,
   recovery,incoming,pass,scopes)).rejects.toThrow();
  await expect(previewFormativeV10PhysicalRecoveryLaboratory(o.authority,before,
   incoming,recovery,'wrong password',scopes)).rejects.toThrow();
 });
 test('native read of a selected encrypted V10 copy returns only independently verified ciphertext',async()=>{
  const s=await historical(),o=owner(),lab=createFormativeV10CopyLaboratory(o.authority);
  const p=await lab.prepare(s,pass,req),proof=await digest(p.encryptedText);
  const bridge:AndroidBackupRuntime={androidBridge:{},sessionAccess:async active=>active(),Capacitor:{
   getPlatform:()=> 'android',Plugins:{RegistroBackupFiles:{
    chooseBackupDestination:async()=>({status:'cancelled'}),
    writeEncryptedBackup:async()=>({status:'cancelled'}),
    chooseBackupSource:async()=>({status:'selected',token:'isolated-reader'}),
    readEncryptedBackup:async({token})=>{
     expect(token).toBe('isolated-reader');
     return {status:'read',encryptedText:p.encryptedText,...proof};
    }
   }}}};
  const selected=await readEncryptedBackupOnAndroid(()=>o.authority.isActive(),bridge);
  expect(selected).toBe(p.encryptedText);
 });
 test('ordinary production formats and metadata remain fenced, no unauthorized AppData writes',async()=>{
  const s=await historical(),o=owner(),lab=createFormativeV10CopyLaboratory(o.authority);
  o.disable();
  await expect(lab.prepare(s,pass,req)).rejects.toThrow('FORMATIVE_V10_COPY_LAB_REJECTED');
  expect(s.meta.verifiedBackupEvidence).toBeUndefined();
 });
});
