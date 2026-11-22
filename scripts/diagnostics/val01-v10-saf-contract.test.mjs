// VAL-01 S7d.3f — narrow static guards for an isolated, synthetic SAF lab.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const get=x=>readFileSync(x,'utf8');
const native=get('scripts/diagnostics/v10-native/Val01V10SafPlugin.java');
const fixture=get('tests/browser/fixtures/val01-s7d3d-v10-physical.fixture.ts');
const ci=get('.github/workflows/val01-v10-physical-lab.yml');
test('SAF has hard debug-only package isolation and no broad storage grants',()=>{
 for(const required of ['it.trama.registrodocente.lab.v10','ApplicationInfo.FLAG_DEBUGGABLE',
  'PRODUCTION_FORBIDDEN','@CapacitorPlugin(name = "Val01V10Saf")',
  'Intent.ACTION_CREATE_DOCUMENT','Intent.ACTION_OPEN_DOCUMENT',
  'Intent.EXTRA_LOCAL_ONLY','LOCAL_PROVIDERS.contains(uri.getAuthority())'])
  assert.ok(native.includes(required),required);
 for(const forbidden of ['takePersistableUriPermission','MANAGE_EXTERNAL_STORAGE',
  'WRITE_EXTERNAL_STORAGE','getExternalStorageDirectory'])
  assert.ok(!native.includes(forbidden),forbidden);
 assert.ok(!get('mobile/android-probe/native/MainActivity.java').includes('Val01V10SafPlugin'));
});
test('SAF tokens are consumed once; content is reread and digested',()=>{
 for(const required of ['destinationToken = UUID.randomUUID()',
  'sourceToken = UUID.randomUUID()','clearSelections(); // one use',
  'resolver.openOutputStream(uri, "wt")','resolver.openInputStream(uri)',
  'MessageDigest.isEqual(hash, observed.digest())',
  'validated(text)','MAX_BYTES','READ_NOT_VERIFIED','WRITE_NOT_VERIFIED'])
  assert.ok(native.includes(required),required);
});
test('fixture has authenticated synthetic envelope and explicit empty-lab restore',()=>{
 for(const required of ["val01-v10-saf-synthetic","lab-only-not-official",
  "crypto.subtle.encrypt","crypto.subtle.decrypt",
  "openFormativeV10StagedMetadata(pair.encrypted,pair.journal",
  "explicitRestore","pristine-synthetic-lab",
  "lab-restored-not-official","lab-file-authenticated-not-restored",
  "Synthetic restore needs a freshly reset empty laboratory"])
  assert.ok(fixture.includes(required),required);
 assert.ok(!fixture.includes('SecureAppStorage.restoreSnapshot'));
});
test('native SAF component is injected only into disposable APK CI',()=>{
 for(const required of ['Val01V10SafPlugin.java',
  'registerPlugin(Val01V10SafPlugin.class)',
  'node --test scripts/diagnostics/val01-v10-saf-contract.test.mjs',
  'applicationId "it.trama.registrodocente.lab.v10"',
  "android:allowBackup=\"false\""])
  assert.ok(ci.includes(required),required);
});
