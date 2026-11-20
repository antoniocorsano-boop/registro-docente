/** DOC-01/D4c3d2 — invariant for actual Android SAF V8 readback and
 * physically authenticated DB2 recovery, fixture/debug package only.
 * The emulator runner provides the execution evidence; these static tests
 * preserve the mandatory connections and fail closed if a gate disappears.
 */
import {describe,expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
const read=(p:string)=>readFileSync(p,'utf8');
describe('DOC-01/D4c3d2 — Android SAF V8 encrypted history restoration',()=>{
 test('native fixture persists original documentary event and prepares a separately encrypted revocation backup',()=>{
  const s=read('tests/browser/fixtures/val01-s6d-db2.fixture.ts');
  expect(s).toContain('export async function nativeDocumentCopies()');
  expect(s).toContain('const receipt=await commitDocumentHistoryOperation(');
  expect(s).toContain('createDocumentBackupPayloadV8(current,approved,[docScope],stamp)');
  expect(s).toContain('createDocumentBackupPayloadV8(incoming,approved,[docScope],stamp)');
  expect(s).toContain('encryptDataWithPassword(recovery,copyPassword)');
  expect(s).toContain('encryptDataWithPassword(target,copyPassword)');
  expect(s).toContain('service.prepareDocumentRestore(');
  expect(s).toContain("operation:'restore-document'");
  expect(s).toContain('controller.signal.aborted');
 });
 test('V8 uses the real existing Android SAF picker, strict byte readback and foreground authorization',()=>{
  const s=read('mobile/android-probe/val01-native-restore.fixture.ts');
  expect(s).toContain('__doc01NativeRestore');
  expect(s).toContain('registerAndroidFileAccess(access)');
  expect(s).toContain('saveEncryptedBackupOnAndroid(expected,names[kind],active)');
  expect(s).toContain('readEncryptedBackupOnAndroid(active)');
  expect(s).toContain('actual.bytes!==wanted.bytes||actual.sha256!==wanted.sha256');
  expect(s).toContain('nativePrepareSelectedDocumentRestore(new Blob([recovery]),new Blob([target]),controller.signal,wrong)');
  expect(s).toContain('document.addEventListener(ANDROID_SESSION_EVENT');
  expect(s).toContain('await pending.commit(confirmed)');
  expect(s).toContain('return \'rejected\'');
 });
 test('native runner uses two distinct V8 external files, verifies actual OS bytes and cold authenticated reopening',()=>{
  const s=read('scripts/diagnostics/val01-native-evidence.mjs');
  expect(s).toContain('window.__doc01NativeRestore');
  expect(s).toContain('Backup_DOC01_V8_2031-01-17.enc.json');
  expect(s).toContain('Backup_DOC01_V8_2031-01-18.enc.json');
  expect(s).toContain("adb',['exec-out','cat'");
  expect(s).toContain("createHash('sha256').update(bytes)");
  for(const stage of ['native-v8-document-seeded','native-v8-saf-write-readback','native-v8-saf-cancellation',
   'native-v8-saf-selected-copies','native-v8-authorized-restore-and-replay-refusal','native-v8-restored-cold-reopen']){
   expect(s).toContain("stage('"+stage+"'");
  }
  expect(s).toContain("await nativeDocumentRestore('commit',true),'rejected'");
  expect(s).toContain('const documentStop=await forceRestart(installation)');
  expect(s).toContain('assert.equal(finalDocument.eventDigests[0],docSeed.eventDigests[0])');
 });
 test('CI requires all V8 stages on real native emulators API 32 and 36 without releasing a build',()=>{
  const w=read('.github/workflows/val01-native-evidence.yml');
  expect(w).toContain('api: [32, 36]');
  expect(w).toContain('bun build mobile/android-probe/val01-native-restore.fixture.ts');
  expect(w).toContain('it.trama.registrodocente.lab.val01');
  expect(w).toContain('productionRelease==false');
  expect(w).toContain('length)==5');
  for(const stage of ['native-v8-document-seeded','native-v8-saf-write-readback','native-v8-saf-cancellation',
   'native-v8-saf-selected-copies','native-v8-authorized-restore-and-replay-refusal','native-v8-restored-cold-reopen']){
   expect(w).toContain(stage);
  }
  expect(w).not.toContain('assembleRelease');
 });
 test('no V8 lab feature is reachable through the application entrypoints',()=>{
  for(const p of ['src/App.tsx','src/components/SecureRegistroRoot.tsx']){
   const s=read(p);
   expect(s).not.toContain('__doc01NativeRestore');
   expect(s).not.toContain('nativePrepareSelectedDocumentRestore');
   expect(s).not.toContain('nativeDocumentCopies');
  }
 });
});
