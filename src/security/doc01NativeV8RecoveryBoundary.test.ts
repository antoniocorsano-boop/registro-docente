/** DOC-01/D4c3d2 — native SAF V8 exact-data contract. Synthetic-only. */
import {describe,expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
const read=(p:string)=>readFileSync(p,'utf8');
describe('DOC-01/D4c3d2 — actual Android SAF V8 recovery boundary',()=>{
 test('native-only bridge and approved V8 DB2 intent remain separate from production entrypoints',()=>{
  const f=read('mobile/android-probe/val01-native-restore.fixture.ts');
  const d=read('tests/browser/fixtures/val01-s6d-db2.fixture.ts');
  expect(f).toContain('__doc01NativeRestore');
  expect(f).toContain('saveEncryptedBackupOnAndroid');
  expect(f).toContain('readEncryptedBackupOnAndroid');
  expect(f).toContain('document.addEventListener(ANDROID_SESSION_EVENT');
  expect(f).toContain('controller.signal.aborted');
  expect(f).toContain('await pending.commit(confirmed)');
  expect(d).toContain('export async function nativeDocumentRestoreCopies(');
  expect(d).toContain('export async function nativePrepareSelectedDocumentRestore(');
  expect(d).toContain('service.prepareDocumentRestore(');
  for(const path of ['src/App.tsx','src/components/SecureRegistroRoot.tsx']){
   const product=read(path);
   expect(product).not.toContain('__doc01NativeRestore');
   expect(product).not.toContain('nativePrepareSelectedDocumentRestore');
  }
 });
 test('native test driver requires actual selected bytes and new encrypted document file names',()=>{
  const f=read('mobile/android-probe/val01-native-restore.fixture.ts');
  const script=read('scripts/diagnostics/val01-native-evidence.mjs');
  expect(f).toContain('Backup_Cifrato_DOC01_V8_2031-01-15.enc.json');
  expect(f).toContain('Backup_Cifrato_DOC01_V8_2031-01-16.enc.json');
  expect(script).toContain('__doc01NativeRestore');
  expect(script).toContain("createHash('sha256').update(bytes)");
  expect(script).toContain("assert.deepEqual(await call('physicalDigest'),");
  expect(script).toContain("await docRestore('commit',true),'committed'");
  expect(script).toContain("await docRestore('commit',true),'rejected'");
 });
 test('native runner exercises V8 SAF selection, cancellation, physical restore and cold reopen',()=>{
  const script=read('scripts/diagnostics/val01-native-evidence.mjs');
  const workflow=read('.github/workflows/val01-native-evidence.yml');
  for(const phase of [
   'native-v8-document-history-commit',
   'native-v8-saf-write-readback',
   'native-v8-saf-cancellation',
   'native-v8-saf-selected-copies',
   'native-v8-authorized-restore-and-replay-refusal',
   'native-v8-restored-cold-reopen'
  ]){expect(script).toContain(phase);expect(workflow).toContain(phase);}
  expect(script).toContain("await forceRestart(installation)");
  expect(workflow).toContain('length)==5');
  expect(workflow).toContain('api: [32, 36]');
  expect(workflow).toContain('productionRelease==false');
 });
 test('native cold-open result must explicitly verify unchanged assessments, grade and entire DOC-01 chain',()=>{
  const d=read('tests/browser/fixtures/val01-s6d-db2.fixture.ts');
  const s=read('scripts/diagnostics/val01-native-evidence.mjs');
  expect(d).toContain('export function nativeDocumentRestoredSummary(');
  expect(d).toContain('validateDocumentHistory(');
  expect(s).toContain("await docRestore('summary')");
  expect(s).toContain('assessmentRevisions:8');
  expect(s).toContain("grades:['8']");
  expect(s).toContain('events:2');
  expect(s).not.toContain("'pm','clear'");
  expect(s).not.toContain("'uninstall'");
 });
});
