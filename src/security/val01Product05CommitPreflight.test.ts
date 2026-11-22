import {describe,expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
import type {ClassData,AppSettings} from '../types';
import {boardDocument,boardScope} from '../../tests/browser/fixtures/val01-s6c-data';
import {prepareFormativeBalance,confirmFormativeBalance} from '../assessment/formativeBalance';
import {prepareFormativeBalanceCommitPreflight,recheckFormativeBalanceCommitPreflight} from '../assessment/formativeBalanceCommitPreflight';
import {snapshotAssessmentData} from '../assessment/assessmentRevisionBindings';
const cfg={year:boardScope.schoolYear,subject:boardScope.subjectCode} as AppSettings;
const cls=():ClassData=>({id:boardScope.classId,name:'Classe fittizia',
 students:boardScope.studentIds.map(id=>({id,name:'Alunno '+id})),grades:[],behaviors:[],
 assessmentEvidenceV1:{version:1,documents:[{document:structuredClone(boardDocument),bindings:[]}]}
} as ClassData);
const context={classId:boardScope.classId,schoolYear:boardScope.schoolYear,
 subjectCode:boardScope.subjectCode,studentId:'s1',period:'Q1' as const,
 from:'2026-09-01',to:'2027-01-31'};
const request={evidenceRevisionIds:['r-1'],comparisons:[],
 teacherText:{learning:'Testo originale del docente',progress:'',nextStep:'Consolidare la filiera'}};
const stamp='2027-02-01T10:00:00.000Z';
async function confirmed(c:ClassData=cls()){
 const d=c.assessmentEvidenceV1!.documents[0].document;
 const p=await prepareFormativeBalance(d,boardScope,context,request);
 if(!p.valid)throw Error('Synthetic review not valid: '+p.issue);
 const r=await confirmFormativeBalance(d,boardScope,context,p.preview,
  {confirmedByTeacher:true,confirmedAt:stamp});
 if(!r.valid)throw Error('Synthetic confirmation not valid: '+r.issue);
 return r.balance;
}
describe('VAL-01/PRODUCT-05/S7c — encrypted-commit preflight without writes',()=>{
 test('confirmed individual review becomes a minimal proposal, not a stored record',async()=>{
  const c=cls(),before=JSON.stringify(c),receipt=await confirmed(c);
  const result=await prepareFormativeBalanceCommitPreflight(c,cfg,receipt);
  expect(result.valid).toBe(true);if(!result.valid)throw Error(result.issue);
  expect(result.state).toBe('verified-no-write');
  expect(result.candidate.state).toBe('proposal-only-not-saved');
  expect(result.candidate.context).toEqual(context);
  expect(result.candidate.evidenceRevisionIds).toEqual(['r-1']);
  expect(result.candidate.teacherText.learning).toBe('Testo originale del docente');
  expect(result.candidate.basisDigest).toMatch(/^[a-f0-9]{64}$/);
  expect(result.candidate.sessionConfirmationAt).toBe(stamp);
  const serialized=JSON.stringify(result.candidate);
  for(const secret of ['Scelta motivata','rubric-v1','Alunno s2','productRef','interpretation','fact','availableCount','sources'])expect(serialized).not.toContain(secret);
  expect(JSON.stringify(c)).toBe(before);
  expect(await recheckFormativeBalanceCommitPreflight(c,cfg,result.candidate))
   .toEqual({valid:true,state:'verified-no-write'});
 });
 test('unconfirmed preview, malformed evidence and foreign scope are rejected',async()=>{
  const c=cls();
  const receipt=await confirmed(c);
  const {confirmedByTeacher:ignored,confirmedAt:missing,...preview}=receipt;
  expect((await prepareFormativeBalanceCommitPreflight(c,cfg,preview)).valid).toBe(false);
  expect((await prepareFormativeBalanceCommitPreflight(c,{...cfg,subject:'OTHER'},receipt)).valid).toBe(false);
  expect((await prepareFormativeBalanceCommitPreflight(c,{...cfg,year:'2027/28'},receipt)).valid).toBe(false);
  expect((await prepareFormativeBalanceCommitPreflight(c,cfg,{...receipt,context:{...context,studentId:'s2'}})).valid).toBe(false);
 });
 test('withdrawn or changed source invalidates old session consent and proposal',async()=>{
  const c=cls(),receipt=await confirmed(c);
  const p=await prepareFormativeBalanceCommitPreflight(c,cfg,receipt);
  expect(p.valid).toBe(true);if(!p.valid)throw Error(p.issue);
  const doc=c.assessmentEvidenceV1!.documents[0].document;
  const assessment=doc.assessments.find(a=>a.revisionId==='a2');
  if(!assessment)throw Error('Fixture missing assessment');
  assessment.title='Attività modificata';
  expect((await prepareFormativeBalanceCommitPreflight(c,cfg,receipt)).valid).toBe(false);
  expect(await recheckFormativeBalanceCommitPreflight(c,cfg,p.candidate))
   .toEqual({valid:false,issue:'STALE_EVIDENCE'});
 });
 test('candidate cannot be forged by extra keys, altered text, time or checksum',async()=>{
  const c=cls(),receipt=await confirmed(c);
  const p=await prepareFormativeBalanceCommitPreflight(c,cfg,receipt);
  if(!p.valid)throw Error(p.issue);
  const r=(change:Record<string,unknown>)=>recheckFormativeBalanceCommitPreflight(c,cfg,{...p.candidate,...change});
  expect((await r({extra:'undocumented'})).valid).toBe(false);
  expect((await r({state:'saved'})).valid).toBe(false);
  expect((await r({basisDigest:'bad'})).valid).toBe(false);
  expect((await r({teacherText:{...p.candidate.teacherText,learning:'Testo riscritto'}})).valid).toBe(false);
  expect((await r({evidenceRevisionIds:['r-1','r-1']})).valid).toBe(false);
  expect((await r({sessionConfirmationAt:'2020-02-02T12:00:00.000Z'})).valid).toBe(false);
 });
 test('misleading no-data cases fail closed, not a negative learning judgment',async()=>{
  const c=cls(),receipt=await confirmed(c);
  delete c.assessmentEvidenceV1;
  expect(await prepareFormativeBalanceCommitPreflight(c,cfg,receipt)).toEqual({valid:false,issue:'UNVERIFIED_ARCHIVE'});
  const p=await prepareFormativeBalanceCommitPreflight(cls(),cfg,receipt);
  expect(p.valid).toBe(true);
  if(!p.valid)throw Error(p.issue);
  expect(await recheckFormativeBalanceCommitPreflight(c,cfg,p.candidate)).toEqual({valid:false,issue:'UNVERIFIED_ARCHIVE'});
 });
 test('strictly read-only boundary, no new appData field or backup schema',()=>{
  const text=readFileSync('src/assessment/formativeBalanceCommitPreflight.ts','utf8');
  for(const forbidden of ['saveAppData','saveFormativeBalance','SecureVault','SecureAppStorage','vault.put',
    'putMany(', 'localStorage', 'indexedDB', 'window.print', 'fetch(', 'exportPdf'])
    expect(text).not.toContain(forbidden);
  const type=readFileSync('src/types.ts','utf8');
  expect(type).not.toContain('formativeBalanceCommitCandidate');
  const d=snapshotAssessmentData({id:'synthetic',active:true});
  expect(d).toEqual({id:'synthetic',active:true});
 });
});
