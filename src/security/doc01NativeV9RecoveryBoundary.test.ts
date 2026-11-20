/** DOC-01/D4c3e6 — isolated native Android V9 contract on synthetic data. */
import {describe,expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
const read=(p:string)=>readFileSync(p,'utf8');

describe('DOC-01/D4c3e6 — institutional V9 Android native recoverability',()=>{
 test('the V9 fixture has fresh synthetic ownership and never converts the V8 demonstration history',()=>{
  const fixture=read('tests/browser/fixtures/val01-s6d-db2.fixture.ts');
  for(const phrase of [
   'export async function nativeSeedInstitutionalHistory()',
   "await v9Seed('actual-restore')",
   'export async function nativeInstitutionalRestoreCopies()',
   'export async function nativePrepareSelectedInstitutionalRestore(',
   "service.prepareInstitutionalRestore({",
   "operation:'restore-institutional'",
   'await close()',
   'export async function nativeInstitutionalRestoredSummary()',
   'validateInstitutionalDocumentHistoryV2(history,v9School)',
   'validateAssessmentArchiveV1(snapshot.appData,approved)',
   "documentHistoryV1!==undefined"
  ])expect(fixture).toContain(phrase);
  expect(fixture).not.toContain('await deleteDatabase(');
  expect(fixture).not.toContain('indexedDB.deleteDatabase(');
 });
 test('two V9 encrypted SAF files are selected and byte/hash checked independently from V8',()=>{
  const fixture=read('mobile/android-probe/val01-native-restore.fixture.ts');
  for(const phrase of [
   '__doc01NativeV9Restore',
   'nativeSeedInstitutionalHistory',
   'nativePrepareSelectedInstitutionalRestore(',
   'Backup_Cifrato_GDPR_2031-01-19.enc.json',
   'Backup_Cifrato_GDPR_2031-01-20.enc.json',
   'saveEncryptedBackupOnAndroid(expected,v9Names[kind],active)',
   'readEncryptedBackupOnAndroid(active)',
   'v9Selected[kind]=text',
   'document.addEventListener(ANDROID_SESSION_EVENT,()=>clearV9Grant())',
   'controller.signal.aborted',
   'await pending.commit(confirmed)',
  ])expect(fixture).toContain(phrase);
  expect(fixture).toContain('__doc01NativeRestore'); // preserve older V8 adapter
  for(const path of ['src/App.tsx','src/components/SecureRegistroRoot.tsx']){
   const product=read(path);
   expect(product).not.toContain('__doc01NativeV9Restore');
   expect(product).not.toContain('nativePrepareSelectedInstitutionalRestore(');
  }
 });
 test('native runner proves real selected bytes, cancellation, one-use CAS and process cold reopen',()=>{
  const script=read('scripts/diagnostics/doc01-native-v9-evidence.mjs');
  const workflow=read('.github/workflows/val01-native-evidence.yml');
  for(const phase of [
   'native-v9-institutional-history-seed',
   'native-v9-saf-write-readback',
   'native-v9-saf-cancellation',
   'native-v9-saf-selected-copies',
   'native-v9-authorized-restore-and-replay-refusal',
   'native-v9-authenticated-cold-reopen'
  ]){expect(script).toContain(phase);expect(workflow).toContain(phase);}
  expect(script).toContain("createHash('sha256').update(bytes)");
  expect(script).toContain("await v9('commit',true),'committed'");
  expect(script).toContain("await v9('commit',true),'rejected'");
  expect(script).toContain('await forceRestart(installation)');
  expect(script).toContain("assert.equal(restored.events,2)");
  expect(script).toContain("assert.equal(restored.assessmentRevisions,baseline.assessmentRevisions)");
  expect(script).toContain("assert.deepEqual(restored.grades,baseline.grades)");
  expect(script).toContain("assert.deepEqual(await call('physicalDigest'),after)");
  expect(script).not.toContain("'pm','clear'");
  expect(script).not.toContain("'uninstall'");
 });
 test('CI isolates V9 from V7/V8 in separate emulators on API32/36, no release APK',()=>{
  const workflow=read('.github/workflows/val01-native-evidence.yml');
  expect(workflow).toContain('api: [32, 36]');
  expect(workflow).toContain('mode: [legacy, v9]');
  expect(workflow).toContain('node --check scripts/diagnostics/doc01-native-v9-evidence.mjs');
  expect(workflow).toContain('node scripts/diagnostics/doc01-native-v9-evidence.mjs');
  expect(workflow).toContain('node scripts/diagnostics/val01-native-evidence.mjs');
  expect(workflow).toContain('VAL01_MODE: ${{ matrix.mode }}');
  expect(workflow).toContain('val01-native-evidence-${{ matrix.mode }}-api');
  expect(workflow).toContain('(.beforePids|length)>0');
  expect(workflow).toContain('.absenceSamples==2');
  expect(workflow).toContain('productionRelease==false');
  expect(workflow).not.toContain('assembleRelease');
 });
});
