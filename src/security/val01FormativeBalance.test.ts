import {describe,expect,test} from 'bun:test';
import {boardDocument,boardScope} from '../../tests/browser/fixtures/val01-s6c-data';
import {validateAssessmentEvidenceV1,type AssessmentEvidenceV1,type IndividualEvidenceRevision,type AssessmentDefinitionRevision} from '../assessment/assessmentEvidence';
import {prepareFormativeBalance,confirmFormativeBalance,type FormativeBalanceContext,type FormativeBalanceRequest} from '../assessment/formativeBalance';

const context:FormativeBalanceContext={classId:boardScope.classId,schoolYear:boardScope.schoolYear,subjectCode:boardScope.subjectCode,studentId:'s1',period:'Q1',from:'2026-09-01',to:'2027-01-31'};
const empty={learning:'',progress:'',nextStep:''};
const at={confirmedByTeacher:true,confirmedAt:'2027-02-01T10:00:00.000Z'};
const text={learning:'Collega le fasi della filiera.',progress:'Rilevo una motivazione più articolata.',nextStep:'Motivare la scelta delle risorse.'};
const original=boardDocument.evidence[0];
if(original.state!=='observed')throw Error('Expected fixture');
const assessment=boardDocument.assessments.find(a=>a.revisionId==='a2')!;
const second:AssessmentDefinitionRevision={...assessment,assessmentId:'b',revisionId:'b1',date:'2026-12-01',completedOn:'2026-12-01',confirmedAt:'2026-12-01T09:00:00.000Z',source:{kind:'explicit-activity',activityId:'activity-b'}};
delete (second as {supersedesRevisionId?:string}).supersedesRevisionId;
const later:IndividualEvidenceRevision={...original,evidenceId:'later',revisionId:'later-r',observationEventId:'later-event',assessmentRevisionId:'b1',observedOn:'2026-12-01',recordedAt:'2026-12-01T10:00:00.000Z',confirmedAt:'2026-12-01T10:01:00.000Z',fact:{...original.fact,description:'Collegamenti motivati'},interpretation:{kind:'level',levelId:'l2'}};
const source=():AssessmentEvidenceV1=>({...structuredClone(boardDocument),assessments:[...structuredClone(boardDocument.assessments),structuredClone(second)],evidence:[...structuredClone(boardDocument.evidence),structuredClone(later)]});
const request=(ids:readonly string[]=['r-1'],teacherText=empty,comparisons:FormativeBalanceRequest['comparisons']=[]):FormativeBalanceRequest=>({evidenceRevisionIds:ids,teacherText,comparisons});
const pair={earlierRevisionId:'r-1',laterRevisionId:'later-r'};
const compareRequest=()=>request(['later-r','r-1'],text,[pair]);
const preview=(d:AssessmentEvidenceV1=source(),r:FormativeBalanceRequest=request(),c:FormativeBalanceContext=context)=>prepareFormativeBalance(d,boardScope,c,r);
async function review(d=source(),r=compareRequest(),c=context){
 const result=await preview(d,r,c);if(!result.valid)throw Error(result.issue);return result.preview;
}
const correction=(e:IndividualEvidenceRevision):IndividualEvidenceRevision=>({...e,revisionId:'corrected-r',supersedesRevisionId:e.revisionId,recordedAt:'2026-12-10T10:00:00.000Z',confirmedAt:'2026-12-10T10:01:00.000Z'});
function withdrawn(e:IndividualEvidenceRevision):IndividualEvidenceRevision{
 const {fact:_f,interpretation:_i,...identity}=e as Extract<IndividualEvidenceRevision,{state:'observed'}>;
 return {...identity,revisionId:'withdrawn-r',supersedesRevisionId:e.revisionId,state:'withdrawn',reason:'Ritiro sintetico',recordedAt:'2026-12-10T10:00:00.000Z',confirmedAt:'2026-12-10T10:01:00.000Z'};
}

describe('VAL-01/S7a — formative balance of explicitly selected individual evidence',()=>{
 test('selection, period, provenance, historical rubric and detached source; never infer progress',async()=>{
  const d=source(),before=JSON.stringify(d);expect(validateAssessmentEvidenceV1(d,boardScope).valid).toBe(true);
  const p=await review(d);
  expect(p.sources.map(s=>s.evidence.revisionId)).toEqual(['r-1','later-r']);
  expect(p.sources.map(s=>s.rubric?.revisionId)).toEqual(['rubric-v1','rubric-v1']);
  expect(p.sources[0].targets.map(r=>r.text)).toEqual(['Rappresentare la filiera']);
  expect(p.sources[1].evidence.state).toBe('observed');
  expect(p.comparisons).toEqual([{...pair,status:'matching-recorded-context',conclusion:'teacher-review-required'}]);
  expect(p.request.teacherText).toEqual(text);expect(p.coverage).toBe('undetermined');expect(p.availableCount).toBe(2);
  expect(p.basisDigest).toMatch(/^[a-f0-9]{64}$/);
  expect(JSON.stringify(p)).not.toContain('Scelta motivata');
  expect(JSON.stringify(p)).not.toContain('Nuova versione');expect(JSON.stringify(d)).toBe(before);
  expect(await confirmFormativeBalance(d,boardScope,context,p,at)).toMatchObject({valid:true,balance:{confirmedByTeacher:true,confirmedAt:at.confirmedAt}});
 });
 test('one real observation cannot support a progress statement; no automatic comparison or text',async()=>{
  expect(await preview(source(),request(['r-1'],text))).toEqual({valid:false,issue:'INVALID_COMPARISON'});
  const p=await review(source(),request(['r-1']));
  expect(p.comparisons).toEqual([]);expect(p.request.teacherText).toEqual(empty);
  expect(p.sources).toHaveLength(1);expect(p.availableCount).toBe(2);
  expect(JSON.stringify(p)).not.toContain('Collegamenti motivati');
 });
 test('missing, not observed and not applicable do not become a level or a negative conclusion',async()=>{
  const absent=await review(source(),request([]),{...context,studentId:'s4'});
  expect(absent.availableCount).toBe(0);expect(absent.sources).toEqual([]);
  expect(await confirmFormativeBalance(source(),boardScope,{...context,studentId:'s4'},absent,at)).toEqual({valid:false,issue:'NO_SOURCES'});
  for(const [studentId,id,state] of [['s2','r-2','not_observed'],['s3','r-3','not_applicable']]){
   const p=await review(source(),request([id]),{...context,studentId});
   expect(p.sources[0].evidence.state).toBe(state);expect(p.sources[0].evidence).not.toHaveProperty('interpretation');
   expect(await preview(source(),request([id],{...empty,learning:'Non sufficiente'}),{...context,studentId})).toEqual({valid:false,issue:'NO_SOURCES'});
  }
 });
 test('rejects other recipient, unselected or duplicate IDs, mismatched period and date bounds',async()=>{
  for(const ids of [['r-2'],['r-1','r-1'],['unknown']])expect((await preview(source(),request(ids))).valid).toBe(false);
  expect(await preview(source(),request(['later-r']),{...context,to:'2026-11-30'})).toEqual({valid:false,issue:'INVALID_SOURCE'});
  expect(await preview(source(),request(['r-1']),{...context,period:'Q2'})).toEqual({valid:false,issue:'INVALID_SOURCE'});
  for(const c of [{...context,from:'2026-02-01'},{...context,to:'2027-02-30'},{...context,subjectCode:'OTHER'},{...context,studentId:'foreign'}])expect((await preview(source(),request(),c)).valid).toBe(false);
 });
 test('rejects comparison of non-observation, same event, same date, different methods or historical rubric',async()=>{
  for(const p of [{earlierRevisionId:'r-1',laterRevisionId:'r-1'},{earlierRevisionId:'later-r',laterRevisionId:'r-1'}])expect(await preview(source(),request(['r-1','later-r'],empty,[p]))).toEqual({valid:false,issue:'INVALID_COMPARISON'});
  for(const modified of [
   {...later,observedOn:original.observedOn},
   {...later,fact:{...later.fact,method:'Colloquio'}},
   {...later,fact:{...later.fact,support:'visual' as const}},
   {...later,fact:{...later.fact,phase:'Fase diversa'}}
  ]){
   const d={...source(),evidence:[...boardDocument.evidence,modified]};
   expect(validateAssessmentEvidenceV1(d,boardScope).valid).toBe(true);
   expect(await preview(d,compareRequest())).toEqual({valid:false,issue:'INVALID_COMPARISON'});
  }
  const {fact:_f,interpretation:_i,...identity}=later;
  const missing:IndividualEvidenceRevision={...identity,state:'not_observed'};
  expect(await preview({...source(),evidence:[...boardDocument.evidence,missing]},compareRequest())).toEqual({valid:false,issue:'INVALID_COMPARISON'});
  const updated={...second,criteria:second.criteria.map(c=>c.criterionRevisionId==='c1'?{...c,rubricRevisionId:'rubric-v2'}:c)};
  const changed={...later,interpretation:{kind:'level' as const,levelId:'new'}};
  const d={...source(),assessments:[...boardDocument.assessments,updated],evidence:[...boardDocument.evidence,changed]};
  expect(validateAssessmentEvidenceV1(d,boardScope).valid).toBe(true);
  expect(await preview(d,compareRequest())).toEqual({valid:false,issue:'INVALID_COMPARISON'});
 });
 test('correction, withdrawal, unselected relevant addition and edited dependency invalidate review',async()=>{
  const d=source(),p=await review(d,request(['r-1']));
  const corrected=correction(later);
  const added={...later,evidenceId:'extra',revisionId:'extra-r',observationEventId:'extra-event'};
  for(const changed of [
   {...d,evidence:[...d.evidence,corrected]},
   {...d,evidence:[...d.evidence,withdrawn(later)]},
   {...d,evidence:[...d.evidence,added]},
   {...d,criteria:d.criteria.map(c=>c.revisionId==='c1'?{...c,description:'Testo alterato'}:c)}
  ]){
   expect(validateAssessmentEvidenceV1(changed,boardScope).valid).toBe(true);
   expect(await confirmFormativeBalance(changed,boardScope,context,p,at)).toEqual({valid:false,issue:'STALE_PREVIEW'});
  }
  const w={...d,evidence:[...d.evidence,withdrawn(original)]};
  expect(await preview(w,request(['r-1']))).toEqual({valid:false,issue:'INVALID_SOURCE'});
 });
 test('other students and other periods are isolated; source order does not alter digest',async()=>{
  const d=source(),p=await review(d);
  const other=boardDocument.evidence.find(e=>e.studentId==='s5')!;
  const changed={...d,evidence:[...d.evidence,correction(other)].reverse()};
  expect(await confirmFormativeBalance(changed,boardScope,context,p,at)).toMatchObject({valid:true});
  const q2={...second,assessmentId:'q2',revisionId:'q2-a',source:{kind:'explicit-activity' as const,activityId:'q2'},period:'Q2' as const,date:'2027-03-01',completedOn:'2027-03-01',confirmedAt:'2027-03-01T09:00:00.000Z'};
  const q2e={...later,evidenceId:'q2-e',revisionId:'q2-r',observationEventId:'q2-event',assessmentRevisionId:'q2-a',observedOn:'2027-03-01',recordedAt:'2027-03-01T10:00:00.000Z',confirmedAt:'2027-03-01T10:01:00.000Z'};
  expect(await confirmFormativeBalance({...d,assessments:[...d.assessments,q2],evidence:[...d.evidence,q2e]},boardScope,context,p,at)).toMatchObject({valid:true});
 });
 test('edited preview, recipient, dates, malformed confirmation and pre-source confirmation fail closed',async()=>{
  const d=source(),p=await review(d);
  for(const altered of [{...p,basisDigest:'0'.repeat(64)},{...p,request:{...p.request,teacherText:{...text,learning:'Modifica non rivista'}}},{...p,coverage:'complete'}])expect((await confirmFormativeBalance(d,boardScope,context,altered,at)).valid).toBe(false);
  for(const c of [{...context,studentId:'s2'},{...context,to:'2027-02-01'}])expect((await confirmFormativeBalance(d,boardScope,c,p,at)).valid).toBe(false);
  for(const a of [{...at,confirmedByTeacher:false},{...at,confirmedAt:'2026-11-20T10:00:00.000Z'},{...at,confirmedAt:'2027-02-30T10:00:00.000Z'}])expect((await confirmFormativeBalance(d,boardScope,context,p,a)).valid).toBe(false);
 });
 test('reject active getters without evaluating them; changes during await cannot mutate detached review',async()=>{
  let invoked=false;const r=Object.defineProperty({...request()},'teacherText',{enumerable:true,get(){invoked=true;return empty;}});
  expect((await prepareFormativeBalance(source(),boardScope,context,r)).valid).toBe(false);expect(invoked).toBe(false);
  const d=source(),req=structuredClone(compareRequest());const pending=prepareFormativeBalance(d,boardScope,context,req);
  (req.teacherText as {learning:string}).learning='Mutazione successiva';
  const result=await pending;expect(result.valid).toBe(true);if(result.valid)expect(result.preview.request.teacherText.learning).toBe(text.learning);
 });
});
