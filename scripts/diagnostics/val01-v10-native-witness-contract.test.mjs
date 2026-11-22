// Static safety contracts for the isolated S7d.3d.1 native witness lab.
// Real durability is tested separately on Android API 32/36 emulators.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const native=readFileSync('scripts/diagnostics/v10-native/Val01V10WitnessPlugin.java','utf8');
const fixture=readFileSync('tests/browser/fixtures/val01-s7d3d-v10-physical.fixture.ts','utf8');
const workflow=readFileSync('.github/workflows/val01-v10-physical-lab.yml','utf8');

test('S7d.3d.1 witness is hard-gated to dedicated synthetic debug package',()=>{
 assert.match(native,/it\.trama\.registrodocente\.lab\.v10/);
 assert.match(native,/ApplicationInfo\.FLAG_DEBUGGABLE/);
 assert.match(native,/PRODUCTION_FORBIDDEN/);
 assert.match(native,/@CapacitorPlugin\(name = "Val01V10Witness"\)/);
});
test('native witness requires synchronous physical commit and exact readback',()=>{
 assert.match(native,/preferences\(\)\.edit\(\)\.putString\(RECORD, next\)\.commit\(\)/);
 assert.match(native,/Objects\.equals\(preferences\(\)\.getString\(RECORD, null\), next\)/);
 assert.match(native,/nextHead\.getInt\("epoch"\) != oldEpoch \+ 1/);
});
test('synthetic native rollback remains explicitly possible, no fake monotonicity',()=>{
 assert.match(native,/seedForTest/);
 assert.match(native,/SharedPreferences/);
 assert.match(native,/NOT an independent non-rollback monotonic root/);
});
test('on native failure the fixture cannot silently fall back to localStorage',()=>{
 assert.match(fixture,/if\(!n\.bridge\)throw Error\('Missing synthetic Android witness plugin'\)/);
 assert.match(fixture,/n\.bridge\.compareAndAdvance/);
 assert.match(fixture,/if\(!n\.native\)return localStorage\.getItem\(TRUST\)/);
 assert.match(fixture,/witnessStore:nativeWitness\(\)\.native\?'android-sharedpreferences'/);
});
test('plugin is only injected into the disposable Android build',()=>{
 assert.match(workflow,/cp \.\.\/\.\.\/scripts\/diagnostics\/v10-native\/Val01V10WitnessPlugin\.java/);
 assert.match(workflow,/registerPlugin\(Val01V10WitnessPlugin\.class\)/);
 assert.match(workflow,/applicationId "it\.trama\.registrodocente\.lab\.v10"/);
 assert.match(workflow,/android:allowBackup="false"/);
 assert.doesNotMatch(readFileSync('mobile/android-probe/native/MainActivity.java','utf8'),/Val01V10WitnessPlugin/);
});
