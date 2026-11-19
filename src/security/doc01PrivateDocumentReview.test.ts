import {describe,expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {boardDocument,boardScope} from '../../tests/browser/fixtures/val01-s6c-data';
import {prepareFormativeBalance,confirmFormativeBalance,type FormativeBalanceContext} from '../assessment/formativeBalance';
import {prepareCouncilContribution,confirmCouncilContribution} from '../council/councilDisciplinaryContribution';
import {appendCouncilSession} from '../council/councilModel';
import {preparePrivateDocumentReview} from '../documents/privateDocumentReview';
import type {ClassData} from '../types';
import type {IndividualEvidenceRevision} from '../assessment/assessmentEvidence';

const context:FormativeBalanceContext={classId:boardScope.classId,schoolYear:boardScope.schoolYear,subjectCode:boardScope.subjectCode,studentId:'s1',period:'Q1',from:'2026-09-01',to:'2027-01-31'};
const text={learning:'Apprendimento dimostrativo.',progress:'',nextStep:'Passo successivo dimostrativo.'};
const empty={learning:'',progress:'',nextStep:''};
const at={confirmedByTeacher:true,confirmedAt:'2027-02-10T10:00:00.000Z'};
const cls:ClassData={id:boardScope.classId,name:'Classe dimostrativa',students:boardScope.studentIds.map(id=>({id,name:'Fittizio '+id})),grades:[],behaviors:[]};
const klass=appendCouncilSession(appendCouncilSession({classes:[cls],currentClassId:cls.id},cls.id,boardScope.schoolYear,'intermedia','2027-02-05','first','2027-02-01T10:00:00.000Z'),cls.id,boardScope.schoolYear,'monitoraggio','2027-02-08','second','2027-02-06T10:00:00.000Z').classes[0];
async function fixture(studentId='s1',ids=['r-1'],teacherText=text,sections:string[]=['learning']){
 const c={...context,studentId};
 const p=await prepareFormativeBalance(boardDocument,boardScope,c,{evidenceRevisionIds:ids,comparisons:[],teacherText});
 if(!p.valid)throw Error(p.issue);
 const b=await confirmFormativeBalance(boardDocument,boardScope,c,p.preview,{confirmedByTeacher:true,confirmedAt:'2027-02-01T10:00:00.000Z'});
 if(!b.valid)throw Error(b.issue);
 return {mode:'SYNTHETIC_ONLY',privacyShieldActive:true,document:boardDocument,scope:boardScope,context:c,balance:b.balance,target:{kind:'student-restitution',sections}};
}
async function councilFixture(){
 const f=await fixture();
 const c={...f.context,sessionId:'first'};
 const selection={sections:['learning']};
 const p=await prepareCouncilContribution(f.document,f.scope,klass,c,f.balance,selection);
 if(!p.valid)throw Error(p.issue);
 const confirmed=await confirmCouncilContribution(f.document,f.scope,klass,c,f.balance,selection,p.preview,at);
 if(!confirmed.valid)throw Error(confirmed.issue);
 return {...f,target:{kind:'council-disciplinary-contribution',classData:klass,sessionId:'first',sections:selection.sections,contribution:confirmed.contribution}};
}
const ready=async(f:unknown)=>{const r=await preparePrivateDocumentReview(f);if(!r.valid)throw Error(r.issue);return r.review;};
const correction=(e:IndividualEvidenceRevision):IndividualEvidenceRevision=>({...e,revisionId:'demo-correction',supersedesRevisionId:e.revisionId,recordedAt:'2026-12-10T10:00:00.000Z',confirmedAt:'2026-12-10T10:01:00.000Z'});
describe('DOC-01/D3b protected individual document review (synthetic)',()=>{
 test('revalidates S7 and exposes only explicitly selected teacher text and minimized sources on demand',async()=>{
  const f=await fixture();const r=await ready(f);
  expect(Object.keys(r).sort()).toEqual(['confirmCurrent','readCurrent']);
  const a=await r.readCurrent(f);if(!a.valid)throw Error(a.issue);
  expect(a.presentation).toMatchObject({destination:'student-restitution',official:false,complete:false,labOnly:true,canExport:false,coverage:'undetermined',sessionDate:null,teacherText:{learning:text.learning},sources:[{date:'2026-11-20',activity:'Filiera sintetica',criterion:'Relazioni tra fasi',objectives:['Rappresentare la filiera'],state:'observed'}]});
  for(const value of ['Collegamenti esplicitati','Elaborato','Motivazione pertinente','rubric-v1','studentId','basisDigest','r-1','s1','Fittizio',text.nextStep])expect(JSON.stringify(a.presentation)).not.toContain(value);
  expect(Object.isFrozen(a.presentation.sources[0].objectives)).toBe(true);
 });
 test('requires privacy shield, lab mode, and an explicit individual destination before reading protected content',async()=>{
  const f=await fixture();let accessed=false;
  const bad={...f,privacyShieldActive:false};Object.defineProperty(bad,'document',{enumerable:true,get(){accessed=true;return f.document;}});
  expect((await preparePrivateDocumentReview(bad)).valid).toBe(false);expect(accessed).toBe(false);
  for(const x of [{...f,privacyShieldActive:false},{...f,mode:'PRODUCTION'},{...f,target:{kind:'class-programme',sections:['learning']}},{...f,target:{kind:'annual-report',sections:['learning']}}])expect((await preparePrivateDocumentReview(x)).valid).toBe(false);
 });
 test('wrong recipient or context, unconfirmed balance and extraneous text selections are rejected',async()=>{
  const f=await fixture();const {confirmedByTeacher,confirmedAt,...unconfirmed}=f.balance;
  for(const x of [{...f,context:{...f.context,studentId:'s2'}},{...f,context:{...f.context,subjectCode:'OTHER'}},{...f,balance:unconfirmed},{...f,target:{...f.target,sections:['progress']}},{...f,target:{...f.target,sections:['learning','learning']}},{...f,target:{...f.target,sections:['grade']}},{...f,target:{...f.target,teacherText:text}}])expect((await preparePrivateDocumentReview(x)).valid).toBe(false);
 });
 test('changing privacy, recipient, selected text, period or related source hides the current result',async()=>{
  const f=await fixture();const r=await ready(f);
  for(const x of [{...f,privacyShieldActive:false},{...f,context:{...f.context,studentId:'s2'}},{...f,target:{...f.target,sections:['nextStep']}},{...f,context:{...f.context,to:'2027-01-30'}},{...f,document:{...f.document,evidence:[...f.document.evidence,correction(f.document.evidence[0])]}}]){
   const result=await r.readCurrent(x);expect(result.valid).toBe(false);expect(result).not.toHaveProperty('presentation');
   expect((await r.confirmCurrent(x,at)).valid).toBe(false);
  }
 });
 test('unrelated student revision does not alter a still-valid selected individual review',async()=>{
  const f=await fixture();const r=await ready(f);
  const changed={...f,document:{...f.document,evidence:[...f.document.evidence,correction(f.document.evidence[1])]}};
  expect((await r.readCurrent(changed)).valid).toBe(true);
  expect(await r.confirmCurrent(changed,at)).toEqual({valid:true,confirmed:true,official:false,canExport:false});
  expect((await r.confirmCurrent(f,{...at,confirmedAt:'2026-11-01T10:00:00.000Z'})).valid).toBe(false);
  expect((await r.confirmCurrent(f,{...at,confirmedByTeacher:false})).valid).toBe(false);
 });
 test('absence states remain descriptive, not inferred results or coverage',async()=>{
  for(const [studentId,id,state] of [['s2','r-2','not_observed'],['s3','r-3','not_applicable']]){
   const f=await fixture(studentId,[id],empty,[]);const r=await ready(f);
   const a=await r.readCurrent(f);if(!a.valid)throw Error(a.issue);
   expect(a.presentation.sources.map(s=>s.state)).toEqual([state]);expect(a.presentation.teacherText).toEqual({});expect(a.presentation.coverage).toBe('undetermined');expect(a.presentation).not.toHaveProperty('level');
  }
 });
 test('council document reuses a separately confirmed S8 contribution for the exact session',async()=>{
  const f=await councilFixture();const r=await ready(f);
  const a=await r.readCurrent(f);if(!a.valid)throw Error(a.issue);
  expect(a.presentation).toMatchObject({destination:'council-disciplinary-contribution',sessionDate:'2027-02-05',teacherText:{learning:text.learning},official:false,canExport:false,decision:'not-a-council-decision',competenceCertification:'not-assessed'});
  expect(JSON.stringify(a.presentation)).not.toMatch(/first|Fittizio|studentId|basisDigest|sessionId|Collegamenti esplicitati/);
  const {confirmedByTeacher,confirmedAt,...unconfirmed}=f.target.contribution;
  for(const target of [{...f.target,sessionId:'second'},{...f.target,sections:['nextStep']},{...f.target,contribution:unconfirmed},{...f.target,classData:{...klass,students:klass.students.slice(1)}}])expect((await r.readCurrent({...f,target})).valid).toBe(false);
  const changed={...f,target:{...f.target,classData:{...klass,councilSessions:klass.councilSessions!.map(s=>s.id==='first'?{...s,date:'2027-02-06'}:s)}}};
  expect((await r.readCurrent(changed)).valid).toBe(false);
 });
 test('new layer has no production host, transport, archive, print or automatic generation',()=>{
  for(const path of ['src/App.tsx','src/components/SecureRegistroRoot.tsx','src/components/StudentReportView.tsx','src/components/CouncilView.tsx'])expect(readFileSync(path,'utf8')).not.toContain('preparePrivateDocumentReview');
  const source=readFileSync('src/documents/privateDocumentReview.ts','utf8');
  expect(source).not.toMatch(/localStorage|sessionStorage|indexedDB|fetch\(|window\.print|download\(|exportPdf/i);
 });
});
