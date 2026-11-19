/** DOC-01/D4c3d1: the real IndexedDB behavior is tested by Playwright.
 * These guards prevent silent removal of the isolated entrypoint/gate.
 */
import {describe,expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
const read=(p:string)=>readFileSync(p,'utf8');
describe('DOC-01/D4c3d1 — V8 physical restore integrity boundary',()=>{
 test('a distinct V8 preparation validates the independently approved V8 chain before any physical commit',()=>{
  const s=read('src/security/db2Lifecycle.ts');
  expect(s).toContain('async prepareDocumentRestore(');
  expect(s).toContain('projectDocumentRestoreV8(current,incoming,recovery,');
  expect(s).toContain("readEncryptedAssessmentCopy(file,backupPassword)");
  expect(s).toContain("operation:'restore-document' as const");
  expect(s).toContain('pending={grant,previous,next,controller:attempt}');
 });
 test('the shared commit retains one-use exact full-inventory CAS, encrypted readback, revocation and no rollback',()=>{
  const s=read('src/security/db2Lifecycle.ts');
  expect(s).toContain('pending.grant!==grant||confirmed!==true');
  expect(s).toContain('await replaceDb2(factory,previous,next,attempt.signal)');
  expect(s).toContain('const verified=await captureDb2(factory,attempt.signal)');
  expect(s).toContain('sameDb2Physical(verified,next)');
 });
 test('the existing product entrypoints do not enable the synthetic DOC-01 restore',()=>{
  for(const p of ['src/App.tsx','src/components/SecureRegistroRoot.tsx']){
   const s=read(p);
   expect(s).not.toContain('__doc01Db2Restore');
   expect(s).not.toContain('prepareDocumentRestore(');
  }
 });
 test('exact-sha browser qualification runs all real DB2 V8 synthetic cases',()=>{
  const w=read('.github/workflows/beta2-reference-qualification.yml');
  expect(w).toContain('cp tests/browser/doc01-d4c3d1-db2-restore.spec.cjs .nav-context-browser-tools/');
  expect(w).toContain('doc01-d4c3d1-db2-restore.spec.cjs \\');
  const t=read('tests/browser/doc01-d4c3d1-db2-restore.spec.cjs');
  for(const term of ['physical full replacement','cold reopen','replayRejected','bad-recovery','wrong-scope','refuse','revoke','abort','race','after-commit']){
   expect(t).toContain(term);
  }
 });
});
