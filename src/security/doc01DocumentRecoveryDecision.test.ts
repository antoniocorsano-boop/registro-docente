/** DOC-01/D4c3e1 — synthetic teacher-review decision contracts.
 * Do not change these tests to obtain GREEN; change only implementation.
 */
import {describe,expect,test} from 'bun:test';
import {createDocumentRecoveryDecision,type DocumentRecoveryReview} from './documentRecoveryDecision';
const review:DocumentRecoveryReview={version:8,eventsBefore:1,eventsAfter:2,gradesPreserved:true,
 assessmentsPreserved:true,recoveryCopyVerified:true,replacementRequiresConfirmation:true};
const grant=Object.freeze({kind:'synthetic-db2-v8-grant'});
function lab(outcome:'ok'|'commit-fail'|'verify-fail'='ok'){
 const calls:string[]=[];
 const driver={
  async prepare(){calls.push('prepare');return {review,grant};},
  async commit(g:object,consent:true){expect(g).toBe(grant);expect(consent).toBe(true);calls.push('commit');if(outcome==='commit-fail')throw Error('Uncertain physical result');},
  invalidate(){calls.push('invalidate');},
  async verifyAfterReopen(){calls.push('verify');return outcome!=='verify-fail';}
 };
 return {decision:createDocumentRecoveryDecision(driver),calls};
}
describe('DOC-01/D4c3e1 — explicit teacher authority and non-misleading result',()=>{
 test('preview is non-writing and requires human review before any DB2 commit',async()=>{
  const {decision,calls}=lab();
  expect(decision.phase()).toBe('idle');
  const r=await decision.prepare();
  expect(r).toEqual(review);
  expect(decision.phase()).toBe('prepared');
  expect(decision.review()).toEqual(review);
  expect(calls).toEqual(['prepare']);
 });
 test('missing consent, incorrect phrase or unprepared review cannot commit',async()=>{
  const {decision,calls}=lab();
  await expect(decision.confirm({accepted:true,phrase:'RIPRISTINA'})).rejects.toThrow();
  await decision.prepare();
  await expect(decision.confirm({accepted:false,phrase:'RIPRISTINA'})).rejects.toThrow();
  await expect(decision.confirm({accepted:true,phrase:'conferma'})).rejects.toThrow();
  expect(calls).toEqual(['prepare']);
  expect(decision.phase()).toBe('prepared');
 });
 test('confirmation is one-use, commits once and never announces success before fresh verification',async()=>{
  const {decision,calls}=lab();
  await decision.prepare();
  await decision.confirm({accepted:true,phrase:'RIPRISTINA'});
  expect(decision.phase()).toBe('verification-required');
  expect(decision.review()).toBeNull();
  await expect(decision.confirm({accepted:true,phrase:'RIPRISTINA'})).rejects.toThrow();
  expect(calls.filter(x=>x==='commit')).toHaveLength(1);
  expect(await decision.verifyAfterReopen()).toBe(true);
  expect(decision.phase()).toBe('completed');
  expect(calls.filter(x=>x==='commit')).toHaveLength(1);
 });
 test('cancel invalidates grant and cannot write, nor be used to roll back a committed restore',async()=>{
  const {decision,calls}=lab();
  await decision.prepare();decision.cancel();
  expect(decision.phase()).toBe('cancelled');
  expect(calls).toEqual(['prepare','invalidate']);
  await expect(decision.confirm({accepted:true,phrase:'RIPRISTINA'})).rejects.toThrow();
  await expect(decision.verifyAfterReopen()).rejects.toThrow();
 });
 test('after a physical commit error, state is uncertain and no replay or rollback is allowed',async()=>{
  const {decision,calls}=lab('commit-fail');
  await decision.prepare();
  await expect(decision.confirm({accepted:true,phrase:'RIPRISTINA'})).rejects.toThrow();
  expect(decision.phase()).toBe('uncertain');
  expect(calls.filter(x=>x==='commit')).toHaveLength(1);
  await expect(decision.confirm({accepted:true,phrase:'RIPRISTINA'})).rejects.toThrow();
  expect(calls.filter(x=>x==='commit')).toHaveLength(1);
 });
 test('failed cold-reopen verification never reports success or retries physical writes',async()=>{
  const {decision,calls}=lab('verify-fail');
  await decision.prepare();
  await decision.confirm({accepted:true,phrase:'RIPRISTINA'});
  expect(await decision.verifyAfterReopen()).toBe(false);
  expect(decision.phase()).toBe('uncertain');
  expect(calls.filter(x=>x==='commit')).toHaveLength(1);
 });
 test('concurrent prepare and confirm are refused rather than creating multiple grants',async()=>{
  const {decision,calls}=lab();
  const p=decision.prepare();
  await expect(decision.prepare()).rejects.toThrow();
  await p;
  await decision.confirm({accepted:true,phrase:'RIPRISTINA'});
  await expect(decision.prepare()).rejects.toThrow();
  expect(calls.filter(x=>x==='prepare')).toHaveLength(1);
 });
 test('invalid review flags, regressions, fake versions and non-integer counts fail without commit',async()=>{
  for(const bad of [
   {...review,version:7},{...review,eventsAfter:0},{...review,eventsBefore:-1},
   {...review,eventsAfter:2.5},{...review,recoveryCopyVerified:false},
   {...review,gradesPreserved:false},{...review,assessmentsPreserved:false},
   {...review,replacementRequiresConfirmation:false}
  ]){
   let commits=0;
   const decision=createDocumentRecoveryDecision({
    async prepare(){return {review:bad as DocumentRecoveryReview,grant};},
    async commit(){commits++;},
    invalidate(){},
    async verifyAfterReopen(){return true;}
   });
   await expect(decision.prepare()).rejects.toThrow();
   expect(commits).toBe(0);
   expect(decision.phase()).not.toBe('prepared');
  }
 });
});
