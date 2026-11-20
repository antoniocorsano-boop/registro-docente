import {describe,expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
const read=(p:string)=>readFileSync(p,'utf8');
describe('VAL-01/S6d.2c.2 — native evidence laboratory wiring',()=>{
 test('only synthetic debug package and qualified DB2 fixture are built, for API 32 and 36',()=>{
  const w=read('.github/workflows/val01-native-evidence.yml');
  expect(w).toContain('api: [32, 36]');
  expect(w).toContain('needs: preflight');
  expect(w).toContain('bun build mobile/android-probe/val01-native-restore.fixture.ts');
  expect(w).toContain('it.trama.registrodocente.lab.val01');
  expect(w).toContain('assembleDebug');
  expect(w).toContain('node --test scripts/diagnostics/native-process-probe.test.mjs');
  expect(w).toContain('productionRelease==false');
  expect(w).not.toContain('assembleRelease');
 });
 test('native runner checks process absence and authenticated reopen without clearing the archive',()=>{
  const s=read('scripts/diagnostics/val01-native-evidence.mjs');
  expect(s).toContain('verifiedProcessStop({probe');
  expect(s).toContain("assert.deepEqual(identity(),expectedIdentity)");
  expect(s).toContain("await assert.rejects(call('summary')");
  expect(s).toContain("await call('open')");
  expect(s.match(/=await forceRestart\(installation\)/g)?.length).toBe(5);
  expect(s).not.toContain("'pm','clear'");
  expect(s).not.toContain("'uninstall'");
  expect(s).toContain('productionRelease:false');
 });
});

describe('VAL-01/S6d.2c.4 — native SAF restore isolation',()=>{
 test('native fixture uses real bridge and selected bytes, with revocation and no production entrypoint',()=>{
  const s=read('mobile/android-probe/val01-native-restore.fixture.ts');
  expect(s).toContain('saveEncryptedBackupOnAndroid(expected,names[kind],active)');
  expect(s).toContain('readEncryptedBackupOnAndroid(active)');
  expect(s).toContain('new Blob([recovery]),new Blob([target]),controller.signal');
  expect(s).toContain('document.addEventListener(ANDROID_SESSION_EVENT');
  expect(s).toContain('abort?.abort()');
  expect(s).toContain('await pending.commit(confirmed)');
  expect(read('tests/browser/fixtures/val01-s6d-db2.fixture.ts')).toContain('export async function nativePrepareSelectedRestore');
 });
 test('CI requires exact native files, cancellation, one-use replacement and cold restart evidence',()=>{
  const s=read('scripts/diagnostics/val01-native-evidence.mjs');
  const w=read('.github/workflows/val01-native-evidence.yml');
  for(const phase of ['native-v7-saf-write-readback','native-v7-saf-cancellation','native-v7-saf-selected-copies','native-v7-authorized-restore-and-replay-refusal','native-v7-restored-cold-reopen']){
   expect(s).toContain(phase);expect(w).toContain(phase);
  }
  expect(s).toContain("createHash('sha256').update(bytes)");
  expect(s).toContain("await nativeRestore('commit',true),'rejected'");
  expect(s).toContain('await forceRestart(installation)');
  expect(w).toContain('length)==5');
 });
});
