import {describe,expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {createDocumentRecoverySupervisor} from './documentRecoverySupervisor';
import type {DocumentRecoveryDriver,DocumentRecoveryReview} from './documentRecoveryDecision';
const review:DocumentRecoveryReview={version:8,eventsBefore:1,eventsAfter:2,gradesPreserved:true,
 assessmentsPreserved:true,recoveryCopyVerified:true,replacementRequiresConfirmation:true};
function lab(){
 let commits=0,invalidations=0,reopen=false;
 const driver:DocumentRecoveryDriver={
  async prepare(){return {review,grant:Object.freeze({token:'opaque'})};},
  async commit(){commits++;},
  invalidate(){invalidations++;},
  async verifyAfterReopen(){return reopen;}
 };
 return {supervisor:createDocumentRecoverySupervisor(driver),counts:()=>({commits,invalidations}),setReopen:(v:boolean)=>{reopen=v;}};
}
describe('DOC-01/D4c3e3 — recovery supervisor independent of retiring React App',()=>{
 test('view detach retains an opaque one-use authorization after an owner retires',async()=>{
  const x=lab(),s=x.supervisor,d=s.decision;
  const got=await d.prepare();expect(got).toEqual(review);
  s.detachOldView();expect(s.isDetached()).toBe(true);
  expect(d.phase()).toBe('prepared');
  await d.confirm({accepted:true,phrase:'RIPRISTINA'});
  expect(d.phase()).toBe('verification-required');
  expect(x.counts().commits).toBe(1);
  await expect(d.confirm({accepted:true,phrase:'RIPRISTINA'})).rejects.toThrow();
 });
 test('postcommit verification is separate from the obsolete view and cannot falsely succeed',async()=>{
  const x=lab(),s=x.supervisor;
  await s.decision.prepare();s.detachOldView();
  await s.decision.confirm({accepted:true,phrase:'RIPRISTINA'});
  expect(await s.decision.verifyAfterReopen()).toBe(false);
  expect(s.decision.phase()).toBe('uncertain');
  expect(x.counts().commits).toBe(1);
 });
 test('successful new authentication permits completion without another write',async()=>{
  const x=lab(),s=x.supervisor;
  await s.decision.prepare();s.detachOldView();
  await s.decision.confirm({accepted:true,phrase:'RIPRISTINA'});
  x.setReopen(true);expect(await s.decision.verifyAfterReopen()).toBe(true);
  expect(s.decision.phase()).toBe('completed');
  expect(x.counts().commits).toBe(1);
 });
 test('disposing an unconfirmed supervisor revokes the pending grant and never commits',async()=>{
  const x=lab(),s=x.supervisor;
  await s.decision.prepare();s.dispose();
  expect(x.counts().commits).toBe(0);
  expect(x.counts().invalidations).toBeGreaterThan(0);
  await expect(s.decision.confirm({accepted:true,phrase:'RIPRISTINA'})).rejects.toThrow();
 });
 test('disposal cannot erase an unresolved physical commit or claim rollback',async()=>{
  const x=lab(),s=x.supervisor;
  await s.decision.prepare();await s.decision.confirm({accepted:true,phrase:'RIPRISTINA'});
  expect(()=>s.dispose()).toThrow();
  expect(s.decision.phase()).toBe('verification-required');
 });
 test('the injected component must outlive its old App, without cancelling on unmount',()=>{
  const ui=readFileSync('src/components/documents/DocumentRecoveryReview.tsx','utf8');
  const root=readFileSync('src/components/SecureRegistroRoot.tsx','utf8');
  expect(ui).toContain('decision?:DocumentRecoveryDecision');
  expect(ui).toContain('!decision &&');
  expect(ui).toContain('controllerRef.current?.phase()');
  expect(root).not.toContain('createDocumentRecoverySupervisor(');
  const browser=readFileSync('tests/browser/doc01-d4c3e3-supervisor-remount.spec.cjs','utf8');
  expect(browser).toContain('remount');
  expect(browser).toContain('verification-required');
  const wf=readFileSync('.github/workflows/beta2-reference-qualification.yml','utf8');
  expect(wf).toContain('doc01-d4c3e3-supervisor-remount.spec.cjs');
 });
});
