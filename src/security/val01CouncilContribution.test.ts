import {describe,expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {boardDocument,boardScope} from '../../tests/browser/fixtures/val01-s6c-data';
import {prepareFormativeBalance,confirmFormativeBalance} from '../assessment/formativeBalance';
import {prepareCouncilContribution,confirmCouncilContribution,type CouncilContributionContext} from '../council/councilDisciplinaryContribution';
import {appendCouncilSession} from '../council/councilModel';
import type {ClassData} from '../types';
import type {IndividualEvidenceRevision} from '../assessment/assessmentEvidence';
const context:CouncilContributionContext={classId:boardScope.classId,schoolYear:boardScope.schoolYear,subjectCode:boardScope.subjectCode,studentId:'s1',period:'Q1',from:'2026-09-01',to:'2027-01-31',sessionId:'first'};
const at={confirmedByTeacher:true,confirmedAt:'2027-02-10T10:00:00.000Z'};
const selection={sections:['learning'] as const};
const text={learning:'Relazioni documentate.',progress:'',nextStep:'Passo da valutare.'};
const cls:ClassData={id:boardScope.classId,name:'Sintetica',students:boardScope.studentIds.map(id=>({id,name:'Fittizio '+id})),grades:[],behaviors:[]};
const data=appendCouncilSession(appendCouncilSession({classes:[cls],currentClassId:cls.id},cls.id,boardScope.schoolYear,'intermedia','2027-02-05','first','2027-02-01T10:00:00.000Z'),cls.id,boardScope.schoolYear,'monitoraggio','2027-02-08','second','2027-02-06T10:00:00.000Z');
const klass=data.classes[0];
async function balance(studentId='s1',ids=['r-1'],teacherText=text){
 const {sessionId,...ctx}=context;
 const c={...ctx,studentId};
 const r=await prepareFormativeBalance(boardDocument,boardScope,c,{evidenceRevisionIds:ids,comparisons:[],teacherText});
 if(!r.valid)throw Error(r.issue);
 const b=await confirmFormativeBalance(boardDocument,boardScope,c,r.preview,{confirmedByTeacher:true,confirmedAt:'2027-02-01T10:00:00.000Z'});
 if(!b.valid)throw Error(b.issue);return b.balance;
}
const prepare=async(b:unknown,c=context,k=klass,s:unknown=selection,d=boardDocument)=>prepareCouncilContribution(d,boardScope,k,c,b,s);
async function validReview(b:Awaited<ReturnType<typeof balance>>){
 const r=await prepare(b);if(!r.valid)throw Error(r.issue);return r.preview;
}
describe('VAL-01/S8 — disciplinary contribution and institutional boundaries',()=>{
 test('reuses confirmed balance and explicit sections for exact session; no grades or official decision',async()=>{
  const b=await balance(),p=await validReview(b),before=JSON.stringify({b,klass,boardDocument});
  expect(p.teacherText).toEqual({learning:text.learning});expect(p.evidence).toEqual([{date:'2026-11-20',activity:'Filiera sintetica',criterion:'Relazioni tra fasi',objectives:['Rappresentare la filiera'],state:'observed'}]);
  expect(p.session.id).toBe('first');expect(p.kind).toBe('teacher-disciplinary-contribution');
  expect(p.decision).toBe('not-a-council-decision');expect(p.competenceCertification).toBe('not-assessed');
  for(const privateText of ['Collegamenti esplicitati','Elaborato','Passo da valutare','Scelta motivata','Fittizio','rubric-v1'])expect(JSON.stringify(p)).not.toContain(privateText);
  expect(await confirmCouncilContribution(boardDocument,boardScope,klass,context,b,selection,p,at)).toMatchObject({valid:true,contribution:{confirmedByTeacher:true,decision:'not-a-council-decision'}});
  expect(JSON.stringify({b,klass,boardDocument})).toBe(before);
 });
 test('requires confirmed exact balance, explicit student, scope and matching roster',async()=>{
  const b=await balance();const {confirmedByTeacher,confirmedAt,...unconfirmed}=b;
  expect(await prepare(unconfirmed)).toEqual({valid:false,issue:'STALE_BALANCE'});
  expect((await prepare(b,{...context,studentId:'s2'})).valid).toBe(false);
  expect((await prepare(b,{...context,subjectCode:'OTHER'})).valid).toBe(false);
  expect((await prepare(b,{...context,schoolYear:'2025/2026'})).valid).toBe(false);
  expect((await prepare(b,context,{...klass,students:klass.students.slice(1)})).valid).toBe(false);
  expect((await prepare(b,context,{...klass,students:[...klass.students,klass.students[0]]})).valid).toBe(false);
 });
 test('exact existing session, not inferred from kind; rejects ambiguous identity and future period',async()=>{
  const b=await balance();
  expect(await prepare(b,{...context,sessionId:'unknown'})).toEqual({valid:false,issue:'INVALID_SESSION'});
  const duplicate={...klass,councilSessions:[...klass.councilSessions!,{...klass.councilSessions![0],schoolYear:'2025/2026'}]};
  expect(await prepare(b,context,duplicate)).toEqual({valid:false,issue:'INVALID_SESSION'});
  const early={...klass,councilSessions:klass.councilSessions!.map(s=>s.id==='first'?{...s,date:'2026-11-25'}:s)};
  expect(await prepare(b,context,early)).toEqual({valid:false,issue:'INVALID_SESSION'});
  const second=await prepare(b,{...context,sessionId:'second'});
  expect(second).toMatchObject({valid:true,preview:{session:{id:'second',kind:'monitoraggio'},context:{period:'Q1'}}});
 });
 test('selection must be explicit, unique and nonblank; no automatic copy of text',async()=>{
  const b=await balance();
  expect(await prepare(b,context,klass,{sections:[]})).toMatchObject({valid:true,preview:{teacherText:{}}});
  for(const sections of [['learning','learning'],['progress'],['grade'],['decision']])expect(await prepare(b,context,klass,{sections})).toEqual({valid:false,issue:'INVALID_SELECTION'});
  expect(await prepare(b,context,klass,{sections:['nextStep']})).toMatchObject({valid:true,preview:{teacherText:{nextStep:text.nextStep}}});
 });
 test('changing session, source, selection or confirmation invalidates review',async()=>{
  const b=await balance(),p=await validReview(b);
  const confirm=(d=boardDocument,k=klass,c=context,s:unknown=selection,r:unknown=p,a:unknown=at)=>confirmCouncilContribution(d,boardScope,k,c,b,s,r,a);
  expect(await confirm(boardDocument,klass,{...context,sessionId:'second'})).toEqual({valid:false,issue:'STALE_PREVIEW'});
  expect(await confirm(boardDocument,{...klass,councilSessions:klass.councilSessions!.map(s=>s.id==='first'?{...s,date:'2027-02-06'}:s)})).toEqual({valid:false,issue:'STALE_PREVIEW'});
  expect(await confirm(boardDocument,klass,context,{sections:['nextStep']})).toEqual({valid:false,issue:'STALE_PREVIEW'});
  expect(await confirm(boardDocument,klass,context,selection,{...p,decision:'approved'})).toEqual({valid:false,issue:'STALE_PREVIEW'});
  expect(await confirm(boardDocument,klass,context,selection,p,{...at,confirmedByTeacher:false})).toEqual({valid:false,issue:'INVALID_CONFIRMATION'});
  expect(await confirm(boardDocument,klass,context,selection,p,{...at,confirmedAt:'2026-11-20T10:00:00.000Z'})).toEqual({valid:false,issue:'INVALID_CONFIRMATION'});
  const e=boardDocument.evidence[0];const correction:IndividualEvidenceRevision={...e,revisionId:'s8-correction',supersedesRevisionId:e.revisionId,recordedAt:'2026-12-10T10:00:00.000Z',confirmedAt:'2026-12-10T10:01:00.000Z'};
  const changed={...boardDocument,evidence:[...boardDocument.evidence,correction]};
  expect(await prepare(b,context,klass,selection,changed)).toEqual({valid:false,issue:'STALE_BALANCE'});
  expect(await confirm(changed)).toEqual({valid:false,issue:'STALE_PREVIEW'});
 });
 test('not observed remains a state, no text or official outcome; unrelated student change does not alter review',async()=>{
  const b=await balance('s2',['r-2'],{learning:'',progress:'',nextStep:''});
  const p=await prepare(b,{...context,studentId:'s2'},klass,{sections:[]});
  expect(p).toMatchObject({valid:true,preview:{evidence:[{state:'not_observed'}],teacherText:{},competenceCertification:'not-assessed'}});
  const e=boardDocument.evidence[0];const correction:IndividualEvidenceRevision={...e,revisionId:'s8-other',supersedesRevisionId:e.revisionId,recordedAt:'2026-12-10T10:00:00.000Z',confirmedAt:'2026-12-10T10:01:00.000Z'};
  if(!p.valid)throw Error(p.issue);
  expect(await confirmCouncilContribution({...boardDocument,evidence:[...boardDocument.evidence,correction]},boardScope,klass,{...context,studentId:'s2'},b,{sections:[]},p.preview,at)).toMatchObject({valid:true});
 });
 test('synthetic slot only; no production wiring, write/export or generated judgments',()=>{
  for(const path of ['src/App.tsx','src/components/SecureRegistroRoot.tsx']){
   const s=readFileSync(path,'utf8');expect(s).not.toContain('laboratoryContribution');expect(s).not.toContain('councilDisciplinaryContribution');
  }
  const view=readFileSync('src/components/CouncilView.tsx','utf8');
  expect(view).toContain('laboratoryContribution.render(current,schoolYear,openedSession)');
  expect(view).toContain('isPrivacyShieldActive ? laboratoryContribution.render');
  expect(view).toContain('laboratoryContribution.requestChange(open)');
  const panel=readFileSync('tests/browser/fixtures/val01-s8-contribution.tsx','utf8');
  expect(panel).not.toMatch(/localStorage|sessionStorage|indexedDB|fetch\(|window\.print|download|exportPdf/i);
  const host=readFileSync('tests/browser/fixtures/val01-s6d-operational.fixture.tsx','utf8');
  expect(host).toContain('onSave={noWrite} onCreateSession={noWrite} onPrepareSnapshot={noWrite} onConfirmSnapshot={noWrite}');
  expect(host).toContain('const dirty=()=>evidenceDirty.current||balanceDirty.current||contributionDirty.current');
 });
});
