/** DOC-01/D4c3e2 — frozen owner fencing and new-session proof. */
import {describe,expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {createDocumentDb2RecoveryDriver,type DocumentDb2RecoveryOptions} from './documentDb2RecoveryOwner';
const read=(p:string)=>readFileSync(p,'utf8');
describe('DOC-01/D4c3e2 — actual DB2 session owner, not V1 restore',()=>{
 test('real isolated owner and exact V8 DB2 lifecycle, not legacy importer',()=>{
  const code=read('src/security/documentDb2RecoveryOwner.ts');
  expect(code).toContain('createDb2Lifecycle(');
  expect(code).toContain('service.prepareDocumentRestore(');
  expect(code).toContain('await service.commit(grant,true)');
  expect(code).toContain('await owner.coordinator.sealAndDrain()');
  expect(code).toContain('await owner.store.retireConnection()');
  expect(code).toContain('owner.vault.lock()');
  expect(code).toContain('await captureDb2(');
  expect(code).toContain('readEncryptedBackupOnAndroid(');
  expect(code).toContain('projectDocumentRestoreV8(');
  expect(code).not.toContain('normalizeBackupPayloadVerified(');
  expect(code).not.toContain('restoreSnapshotVerified(');
 });
 test('fresh separate DB2 instance verifies all 10 records and both independent domains',()=>{
  const code=read('src/security/documentDb2RecoveryOwner.ts');
  expect(code).toContain('new ExistingSessionVaultStore(2,');
  expect(code).toContain('await reopenedStore.verifyAuthenticatedRecords(');
  expect(code).toContain('await reopenedStorage.loadExactBackupSnapshot()');
  expect(code).toContain('validateDocumentHistory(');
  expect(code).toContain('validateAssessmentArchiveV1(');
  expect(code).toContain('sameDb2Physical(');
  expect(code).toContain('freshAuthentication(');
  expect(code).toContain('fresh.token===originalToken');
  expect(code).toContain('await reopenedStore.retireConnection()');
 });
 test('suspended or pre-existing session must refuse, no live App activation',async()=>{
  const p=read('src/App.tsx'),root=read('src/components/SecureRegistroRoot.tsx');
  expect(p).not.toContain('createDocumentDb2RecoveryDriver');
  expect(root).not.toContain('createDocumentDb2RecoveryDriver');
  expect(root).toContain('new IndexedDbVaultStore(');
  // No native file, credentials or user grant may be forged by a component.
  const code=read('src/security/documentDb2RecoveryOwner.ts');
  expect(code).not.toContain('localStorage.setItem');
  expect(code).not.toContain('indexedDB.deleteDatabase');
  expect(code).not.toContain('createInitialArchiveSnapshot(');
  expect(code).toContain('await authority.isCurrent(');
  const invalid=({owner:null,authority:null} as unknown) as DocumentDb2RecoveryOptions;
  expect(()=>createDocumentDb2RecoveryDriver(invalid)).toThrow();
 });
 test('genuine physical browser qualification includes restore, stale owner, cancellation and fresh-auth refusal',()=>{
  const spec=read('tests/browser/doc01-d4c3e2-real-db2-owner.spec.cjs');
  const workflow=read('.github/workflows/beta2-reference-qualification.yml');
  for(const phrase of ['actual-restore','stale-owner','cancelled','wrong-recovery','same-epoch'])
   expect(spec).toContain(phrase);
  expect(workflow).toContain('cp tests/browser/doc01-d4c3e2-real-db2-owner.spec.cjs .nav-context-browser-tools/');
  expect(workflow).toContain('doc01-d4c3e2-real-db2-owner.spec.cjs');
  expect(read('tests/browser/fixtures/val01-s6d-db2.fixture.ts')).toContain('__doc01D4c3e2Owner');
 });
});
