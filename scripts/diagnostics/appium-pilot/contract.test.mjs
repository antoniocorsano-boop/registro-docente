import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const workflow=readFileSync('.github/workflows/qa-appium-replacement-pilot.yml','utf8');
const pilot=readFileSync('scripts/diagnostics/appium-pilot/pilot.py','utf8');
const runner=readFileSync('scripts/diagnostics/appium-pilot/run.sh','utf8');
const registry=JSON.parse(readFileSync('qualification/invariants.v1.json','utf8'));
test('Appium preflight exact and isolated before emulators',()=>{
  assert.match(workflow,/permissions:\n  contents: read/);
  assert.equal((workflow.match(/github.event.pull_request.number == 415/g)||[]).length,2);
  assert.match(workflow,/pilot:\n    needs: preflight/);
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
  assert.ok(workflow.includes('"professional-home","privacy-navigation","home-navigation","native-stop-verified"'));
  assert.ok(workflow.includes('.fullF2Qualified==false'));
});
