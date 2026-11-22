import {describe,test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
import type {ClassData,AppSettings} from '../types';
import {boardDocument,boardScope} from '../../tests/browser/fixtures/val01-s6c-data';
import {prepareFormativeBalance,confirmFormativeBalance} from '../assessment/formativeBalance';
import {prepareFormativeBalanceCommitPreflight} from '../assessment/formativeBalanceCommitPreflight';
import {proposeFormativeBalanceHistoryAppend,validateFormativeBalanceHistory} from '../assessment/formativeBalanceHistory';
const settings={year:boardScope.schoolYear,subject:boardScope.subjectCode} as AppSettings;
const cls=():ClassData=>({id:boardScope.classId,name:'Fittizia',
 students:boardScope.studentIds.map(id=>({id,name:'Sintetico '+id})),grades:[],behaviors:[],
 assessmentEvidenceV1:{version:1,documents:[{document:structuredClone(boardDocument),bindings:[]}]}} as ClassData);
const ctx={classId:boardScope.classId,schoolYear:boardScope.schoolYear,subjectCode:boardScope.subjectCode,
 studentId:'s1',period:'Q1' as const,from:'2026-09-01',to:'2027-01-31'};
const at='2027-02-01T10:00:00.000Z';
async function candidate(c:ClassData){
 const d=c.assessmentEvidenceV1!.documents[0].document;
 const p=await prepareFormativeBalance(d,boardScope,ctx,{evidenceRevisionIds:['r-1'],comparisons:[],
  teacherText:{learning:'Testo docente',progress:'',nextStep:'Approfondire'}});
 if(!p.valid)throw Error(p.issue);
 const v=await confirmFormativeBalance(d,boardScope,ctx,p.preview,{confirmedByTeacher:true,confirmedAt:at});
 if(!v.valid)throw Error(v.issue);
 const r=await prepareFormativeBalanceCommitPreflight(c,settings,v.balance);
 if(!r.valid)throw Error(r.issue);
 return r.candidate;
}
const empty=()=>({schemaVersion:1 as const,entries:[]});
const req={id:'balance-1',recordedAt:'2027-02-01T10:01:00.000Z',expectedPreviousId:null};
describe('VAL-01/PRODUCT-05/S7d.1 — append-only schema proposal',()=>{
 test('detached proposal is append-only, never a durable save',async()=>{
  const c=cls(),before=JSON.stringify(c),v=await candidate(c),h=empty();
  const r=await proposeFormativeBalanceHistoryAppend(c,settings,h,v,req);
  expect(r.valid).toBe(true);if(!r.valid)throw Error(r.issue);
  expect(r.status).toBe('proposed-not-persisted');
  expect(r.history.entries[0].revision).toBe(1);
  expect(r.history.entries[0].supersedes).toBe(null);
  expect(validateFormativeBalanceHistory(r.history)).toBe(true);
  expect(h.entries).toHaveLength(0);
  expect(JSON.stringify(c)).toBe(before);
 });
 test('duplicate id and stale expected head are rejected',async()=>{
  const c=cls(),v=await candidate(c);
  const first=await proposeFormativeBalanceHistoryAppend(c,settings,empty(),v,req);
  if(!first.valid)throw Error(first.issue);
  expect(await proposeFormativeBalanceHistoryAppend(c,settings,first.history,v,req)).toEqual({valid:false,issue:'CONFLICT'});
  expect(await proposeFormativeBalanceHistoryAppend(c,settings,first.history,v,{...req,id:'balance-2'}))
   .toEqual({valid:false,issue:'CONFLICT'});
  const next=await proposeFormativeBalanceHistoryAppend(c,settings,first.history,v,{
   id:'balance-2',recordedAt:'2027-02-01T10:02:00.000Z',expectedPreviousId:'balance-1'});
  expect(next.valid).toBe(true);if(!next.valid)throw Error(next.issue);
  expect(next.history.entries[1].revision).toBe(2);
  expect(next.history.entries[1].supersedes).toBe('balance-1');
 });
 test('reject removal, reordered revision, invalid chain, foreign context',async()=>{
  const c=cls(),v=await candidate(c);
  const first=await proposeFormativeBalanceHistoryAppend(c,settings,empty(),v,req);
  if(!first.valid)throw Error(first.issue);
  const next=await proposeFormativeBalanceHistoryAppend(c,settings,first.history,v,{
   id:'balance-2',recordedAt:'2027-02-01T10:02:00.000Z',expectedPreviousId:'balance-1'});
  if(!next.valid)throw Error(next.issue);
  expect(validateFormativeBalanceHistory({...next.history,entries:next.history.entries.slice(1)})).toBe(false);
  expect(validateFormativeBalanceHistory({...next.history,entries:[...next.history.entries].reverse()})).toBe(false);
  expect(validateFormativeBalanceHistory({...next.history,entries:next.history.entries.map((x,i)=>i?{...x,supersedes:'other'}:x)})).toBe(false);
  expect(validateFormativeBalanceHistory({...first.history,entries:[{...first.history.entries[0],
   candidate:{...v,context:{...v.context,studentId:'other'}}}]})).toBe(true);
  expect(await proposeFormativeBalanceHistoryAppend(c,settings,empty(),
   {...v,context:{...v.context,studentId:'other'}},req)).toEqual({valid:false,issue:'STALE_EVIDENCE'});
 });
 test('source change and absent archive invalidate future append',async()=>{
  const c=cls(),v=await candidate(c);
  const selected=c.assessmentEvidenceV1!.documents[0].document.assessments.find(a=>a.revisionId==='a2');
  if(!selected)throw Error('Missing selected assessment');
  selected.title='Revised';
  expect((await proposeFormativeBalanceHistoryAppend(c,settings,empty(),v,req)).valid).toBe(false);
  delete c.assessmentEvidenceV1;
  expect((await proposeFormativeBalanceHistoryAppend(c,settings,empty(),v,req)).valid).toBe(false);
 });
 test('malformed records, timestamps, hidden keys, and noncanonical schema rejected',async()=>{
  const c=cls(),v=await candidate(c);
  expect(validateFormativeBalanceHistory({schemaVersion:2,entries:[]})).toBe(false);
  expect(validateFormativeBalanceHistory({schemaVersion:1,entries:[],unexpected:'data'})).toBe(false);
  expect((await proposeFormativeBalanceHistoryAppend(c,settings,empty(),v,{...req,id:'bad id'})).valid).toBe(false);
  expect((await proposeFormativeBalanceHistoryAppend(c,settings,empty(),v,{...req,recordedAt:'2026-01-01T00:00:00.000Z'})).valid).toBe(false);
  expect((await proposeFormativeBalanceHistoryAppend(c,settings,empty(),{...v,unknown:true},req)).valid).toBe(false);
 });
 test('no storage wiring, new AppData field, backup version, network or release',()=>{
  const s=readFileSync('src/assessment/formativeBalanceHistory.ts','utf8');
  for(const forbidden of ['SecureVault','SecureAppStorage','saveAppData','vault.put','putMany(', 'fetch(', 'indexedDB','localStorage','window.print'])
   expect(s).not.toContain(forbidden);
  expect(readFileSync('src/types.ts','utf8')).not.toContain('formativeBalanceHistoryV1');
 });
});
