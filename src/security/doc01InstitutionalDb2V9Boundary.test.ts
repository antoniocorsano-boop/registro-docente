/** DOC-01/D4c3e5 — V9 institutional native-owner boundary, synthetic only. */
import {describe,expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {createInstitutionalRecoveryDecision,type InstitutionalRecoveryDriver,
 type InstitutionalRecoveryReview} from './institutionalRecoveryDecision';
import {createInstitutionalRecoverySupervisor} from './institutionalRecoverySupervisor';
import {createInstitutionalDb2RecoveryDriver} from './institutionalDb2RecoveryOwner';
const read=(p:string)=>readFileSync(p,'utf8');
const review:InstitutionalRecoveryReview={
 version:9,eventsBefore:1,eventsAfter:2,gradesPreserved:true,
 assessmentsPreserved:true,recoveryCopyVerified:true,replacementRequiresConfirmation:true
};
const mocked=()=>{
 const grant=Object.freeze({version:9}),calls:{commits:number;invalidates:number}={commits:0,invalidates:0};
 const driver:InstitutionalRecoveryDriver={
  async prepare(){return {review,grant};},
  async commit(candidate,consent){if(candidate!==grant||consent!==true)throw Error('invalid grant');calls.commits++;},
  invalidate(){calls.invalidates++;},
  async verifyAfterReopen(){return true;}
 };
 return {driver,calls};
};
describe('DOC-01/D4c3e5 institutional physical recovery',()=>{
 test('V9 is a distinct DB2 restore gate using exact encrypted copies and the full physical CAS',()=>{
  const code=read('src/security/db2Lifecycle.ts');
  expect(code).toContain('async prepareInstitutionalRestore(');
  expect(code).toContain('projectInstitutionalRestoreV9(current,incoming,recovery,');
  expect(code).toContain('readEncryptedAssessmentCopy(file,backupPassword)');
  expect(code).toContain('readEncryptedAssessmentCopy(recoveryFile,recoveryPassword)');
  expect(code).toContain("operation:'restore-institutional' as const");
  expect(code).toContain('pending={grant,previous,next,controller:attempt}');
  expect(code).toContain('await replaceDb2(factory,previous,next,attempt.signal)');
  expect(code).toContain('pending.grant!==grant||confirmed!==true');
  expect(code).toContain('sameDb2Physical(verified,next)');
 });
 test('session owner seals, retires, requires new authentication and verifies all ten records and institutional V2',()=>{
  const code=read('src/security/institutionalDb2RecoveryOwner.ts');
  for(const phrase of [
   'await owner.coordinator.sealAndDrain()','await owner.store.retireConnection()',
   'owner.vault.lock()','await captureDb2(','await authority.isCurrent(',
   'service.prepareInstitutionalRestore(','await service.commit(grant,true,stillAuthorized)',
   'freshAuthentication(','fresh.token===originalToken',
   'new ExistingSessionVaultStore(2,','await reopenedStore.verifyAuthenticatedRecords(',
   'await reopenedStorage.loadExactBackupSnapshot()','validateInstitutionalDocumentHistoryV2(',
   'validateAssessmentArchiveV1(','sameDb2Physical(','await reopenedStore.retireConnection()'
  ])expect(code).toContain(phrase);
  // Epoch revocation must reach the live physical transaction, not merely
  // change the result displayed after an already completed replacement.
  expect(code).toContain('subscribeEpochChanges(token,');
  expect(code).toContain('service.invalidate();');
  expect(code).toContain('const stillAuthorized=()=>authority.currentToken()===token');
  const physical=read('src/security/db2PhysicalLifecycle.ts');
  expect(physical).toContain('if(!active()||!sameDb2Physical(actual,previous))throw db2Failure()');
  expect(physical).toContain('const active=()=>');
  expect(read('tests/browser/doc01-d4c3e5-institutional-v9-db2.spec.cjs'))
   .toContain('old inventory survives unchanged');
  expect(code).not.toContain('projectDocumentRestoreV8(');
  expect(code).not.toContain('documentHistoryV1');
  expect(()=>createInstitutionalDb2RecoveryDriver({} as any)).toThrow();
 });
 test('explicit teacher decision cannot double commit, success requires separate verification',async()=>{
  const {driver,calls}=mocked(),d=createInstitutionalRecoveryDecision(driver);
  expect(await d.prepare()).toMatchObject({version:9,eventsBefore:1,eventsAfter:2});
  await expect(d.confirm({accepted:true,phrase:'NO'})).rejects.toThrow();
  expect(d.phase()).toBe('prepared');
  await d.confirm({accepted:true,phrase:'RIPRISTINA'});
  expect(calls.commits).toBe(1);expect(d.phase()).toBe('verification-required');
  await expect(d.confirm({accepted:true,phrase:'RIPRISTINA'})).rejects.toThrow();
  expect(await d.verifyAfterReopen()).toBe(true);
  expect(d.phase()).toBe('completed');
 });
 test('cancel and wrong-version preview fail closed',async()=>{
  const mock=mocked(),d=createInstitutionalRecoveryDecision(mock.driver);
  d.cancel();expect(d.phase()).toBe('cancelled');
  await expect(d.prepare()).rejects.toThrow();
  const fake=mocked(),forged=createInstitutionalRecoveryDecision({...fake.driver,
   prepare:async()=>({review:{...review,version:8} as unknown as InstitutionalRecoveryReview,grant:{}})});
  await expect(forged.prepare()).rejects.toThrow();
  expect(forged.phase()).toBe('cancelled');
  expect(fake.calls.commits).toBe(0);
 });
 test('old-view retirement does not dispose the V9 supervisor before confirmation',async()=>{
  const {driver}=mocked(),s=createInstitutionalRecoverySupervisor(driver);
  await s.decision.prepare();s.detachOldView();expect(s.isDetached()).toBe(true);
  await s.decision.confirm({accepted:true,phrase:'RIPRISTINA'});
  expect(()=>s.dispose()).toThrow();
  expect(await s.decision.verifyAfterReopen()).toBe(true);
  s.dispose();
 });
 test('production Root and App never enable V9 or the synthetic document selector',()=>{
  for(const path of ['src/App.tsx','src/components/SecureRegistroRoot.tsx']){
   const s=read(path);
   expect(s).not.toContain('createInstitutionalDb2RecoveryDriver(');
   expect(s).not.toContain('prepareInstitutionalRestore(');
  }
 });
});
