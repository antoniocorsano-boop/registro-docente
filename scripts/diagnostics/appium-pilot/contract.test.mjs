import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const workflow=readFileSync('.github/workflows/qa-appium-replacement-pilot.yml','utf8');
const q4=readFileSync('.github/workflows/qa-stability-01-q4.yml','utf8');
const f2=readFileSync('.github/workflows/ap02-f2-native-device.yml','utf8');
const pilot=readFileSync('scripts/diagnostics/appium-pilot/pilot.py','utf8');
const runner=readFileSync('scripts/diagnostics/appium-pilot/run.sh','utf8');
const registry=JSON.parse(readFileSync('qualification/invariants.v1.json','utf8'));
test('Appium preflight exact and isolated before emulators',()=>{
  assert.match(workflow,/permissions:\n  contents: read/);
  assert.equal((workflow.match(/github.event.pull_request.number == 414/g)||[]).length,1);
  assert.equal((workflow.match(/github.event.pull_request.number == 412/g)||[]).length,1);
  assert.ok(!workflow.includes('github.event.pull_request.number == 415'));
  assert.match(workflow,/on:\n  workflow_call:/);
  assert.equal((workflow.match(/inputs.candidate_sha == github.event.pull_request.head.sha/g)||[]).length,1);
  assert.match(workflow,/pilot:\n    needs: preflight/);
  assert.ok(workflow.includes('test "$APPROVED_CALLER" = true'));
  assert.ok(!workflow.includes('if: ${{ github.event_name'));
  assert.match(workflow,/node scripts\/qualification\/impact\.mjs/);
  assert.match(workflow,/go run github\.com\/rhysd\/actionlint/);
  assert.ok(!workflow.includes('${{ runner.temp }}'));
  assert.ok(workflow.includes('export APPIUM_HOME="$RUNNER_TEMP/appium-q5"'));
  const sdk = workflow.indexOf("packages: 'platform-tools platforms;android-36 build-tools;36.0.0 emulator'");
  const emulator = workflow.indexOf('test -x "$ANDROID_HOME/emulator/emulator"');
  const doctor = workflow.indexOf('appium driver doctor uiautomator2');
  assert.ok(sdk>=0&&sdk<emulator&&emulator<doctor&&doctor<workflow.indexOf('bun run build'));
  assert.match(workflow,/api: \[32, 36\]/);
});
test('pinned direct versions and non-release evidence',()=>{
  for(const x of ['appium@3.8.0','uiautomator2@8.6.0','Appium-Python-Client==6.1.2','.fullF2Qualified==false','.status=="PASS"'])assert.ok(workflow.includes(x),x);
  assert.match(runner,/--address 127\.0\.0\.1/);
  assert.ok(!runner.includes('--relaxed-security'));
  assert.ok(!workflow.includes('q5-appium.log'));
  assert.ok(pilot.includes('fullF2Qualified=False'));
});
test('protected UI, explicit actions and cold stop evidence',()=>{
  assert.equal((pilot.match(/click\(driver, "form button\[type=submit\]"\)/g)||[]).length,2);
  for(const x of ["!document.querySelector('#vault-password')",'consecutive >= 2','PUBLIC_GATE_ERROR','assert_running()','time.sleep(0.5)','result.stderr.strip()'])assert.ok(pilot.includes(x),x);
});
test('all pilot paths have dedicated invariant coverage',()=>{
  const inv=registry.invariants.find(x=>x.id==='QA-STABILITY-01-APPIUM-I01');
  assert.ok(inv);
  for(const path of [".github/workflows/qa-appium-replacement-pilot.yml","qualification/invariants.v1.json","scripts/diagnostics/appium-pilot/pilot.py","scripts/diagnostics/appium-pilot/run.sh","scripts/diagnostics/appium-pilot/contract.test.mjs"])assert.ok(inv.impactPaths.some(p=>p.endsWith('/')?path.startsWith(p):path===p),path);
  assert.ok(inv.tests.includes('scripts/diagnostics/appium-pilot/contract.test.mjs'));
});

test('navigation uses real unique controls and exact destination evidence',()=>{
  for(const x of ['#registro-navigation-drawer button','Torna a Oggi','PUBLIC_RELOCK_AFTER_AUTH','Esporta copia completa V7','Scegli file e ripristina','restore-v7-recovery-password','consecutive >= 2','assert_native_foreground(d)'])assert.ok(pilot.includes(x),x);
  assert.ok(pilot.includes('navigate(driver, "Privacy", "privacy")'));
  assert.ok(pilot.includes('navigate(driver, "Oggi", "home")'));
  assert.ok(workflow.includes('"professional-home","privacy-navigation","home-navigation","target-class"'));
  assert.ok(workflow.includes('.fullF2Qualified==false'));
});

test('backup and restore pilot retains physical encrypted copies and real SAF boundaries',()=>{
  for(const x of ['adb_read("pull", remote, str(local))','REGISTRO_DOCENTE_AES_GCM_256','DISTINCT_ENCRYPTED_COPY_NOT_VERIFIED','picker_return(driver, "target-source", CONSENT)','picker_return(driver, "recovery-source"','assert_class_state(driver, False)','stage("cold-restored-content", "complete")'])assert.ok(pilot.includes(x),x);
  assert.ok(workflow.includes('.safReturns==["target-export","recovery-export","target-source","recovery-source"]'));
  assert.ok(workflow.includes('.physicalCopies[0].sha256!=.physicalCopies[1].sha256'));
});

test('native picker delegates to the existing qualified F2 primitives',()=>{
  const bridge=readFileSync('scripts/diagnostics/appium-pilot/native-picker.mjs','utf8');
  assert.ok(!pilot.includes('By.XPATH, "//*"'));
  assert.ok(!pilot.includes('def native_candidate'));
  assert.ok(!bridge.includes('readNativeSnapshot'));
  assert.ok(!bridge.includes("'uiautomator','dump'"));
  assert.ok(pilot.includes('"sessionId": driver.session_id'));
  for(const x of ['appiumSnapshot','parseNativeNodes','waitNativeSelection','uniqueNativeControl','requireDocumentsUiTap','classifyResumedActivity','nativeReadRetryCodes'])assert.ok(bridge.includes(x),x);
  for(const x of ['native_picker(driver, "save")','native_picker(driver, "open", name)','saf-wait-protected-lock','saf-wait-exact-public-dialog','session-device-readiness','CANONICAL_NATIVE_PICKER_FAILED'])assert.ok(pilot.includes(x),x);
  assert.ok(workflow.includes('native-picker.test.mjs'));
  assert.ok(workflow.includes('python3 -m unittest discover -s scripts/diagnostics/appium-pilot'));
});

test('canonical Q4 and direct F2 coordinate hybrid without weakening inherited gates',()=>{
  assert.match(q4,/hybrid:\n    needs: preflight/);
  assert.match(q4,/startup:\n    needs: \[preflight, hybrid\]/);
  assert.match(q4,/pilot:\n    needs: \[preflight, hybrid, startup\]/);
  assert.match(q4,/q4:\n    needs: \[preflight, hybrid, pilot\]/);
  assert.equal((q4.match(/uses: \.\/\.github\/workflows\/qa-appium-replacement-pilot\.yml/g)||[]).length,1);
  assert.match(f2,/hybrid-evidence:\n    if:.*inputs\.candidate_sha == '' && github\.event\.pull_request\.number == 412/);
  assert.match(f2,/uses: \.\/\.github\/workflows\/qa-appium-replacement-pilot\.yml/);
  for(const marker of ['Require exact complete acceptance evidence','Require complete Q3 environment and readiness evidence','nativeReauthCount>=4','absenceSamples==2','surface-readiness.json','environment.json','AP02_STARTUP_ONLY'])assert.ok(f2.includes(marker),marker);
  assert.ok(workflow.includes('.fullF2Qualified==false'));
  assert.ok(workflow.includes('git merge-base --is-ancestor 80378e9daab60fe6c389e372c3c79e3dcd09aac0 HEAD'));
  assert.ok(registry.invariants.some(x=>x.id==='QA-STABILITY-01-APPIUM-I02'));
});

test('hybrid workflow has one build, one emulator run and a fail-closed delta check',()=>{
  for(const marker of ['      - name: Install isolated open-source automation stack','      - name: Build exact real Web UI and separate debug-only Android laboratory','      - name: Appium real installed application pilot','      - name: Require actual pilot evidence, never F2 qualification'])assert.equal(workflow.split(marker).length,2,marker);
  assert.ok(!workflow.split('\n').some(line=>line.length&&/^\S/.test(line)&&! /^(name:|on:|permissions:|jobs:|#)/.test(line)));
  assert.ok(workflow.includes('changed=$(git diff --name-only'));
  assert.ok(workflow.includes('UNAPPROVED_LAB_DELTA'));
  assert.ok(workflow.includes('done <<< "$changed"'));
  assert.ok(!workflow.includes('|| true'));
});

test('canonical F2 uses hybrid for PR 414 and 412, with real Q3 and startup proofs',()=>{
  assert.ok(f2.includes("HYBRID_QUALIFICATION_MODE:"));
  assert.ok(f2.includes('bash scripts/diagnostics/appium-pilot/run.sh'));
  assert.ok(f2.includes('node scripts/diagnostics/ap02-native-device-v7.mjs'));
  for(const marker of ['prove_launch(driver,"setup")','prove_launch(driver,"lock")','canonical_ready(driver,"class-detail"','canonical_ready(driver,"class"','canonical_records(evidence,environment,destinations,MODE','before_pids = assert_running()','stopped = assert_stopped()'])assert.ok(pilot.includes(marker),marker);
  const q3=readFileSync('scripts/diagnostics/appium-pilot/q3-evidence.mjs','utf8');
  for(const marker of ['waitBootReadiness','emulatorIdentity','versionFacts','publicSurfaceFrame','classifySurface'])assert.ok(q3.includes(marker),marker);
  assert.ok(f2.includes('ap02-device-evidence/appium-pilot.json'));
});
