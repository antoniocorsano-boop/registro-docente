import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {execFileSync,spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {dirname,join} from 'node:path';
import {readGuardedNativeSnapshot,waitNativeOpenOrReturn} from '../native-lab-transitions.mjs';
import {LabFailure,classifyFailure} from '../native-lab-runtime.mjs';
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
  assert.ok(f2.includes("inputs.candidate_sha == '' && (github.event.pull_request.number == 412 || (github.head_ref == 'candidate/cand-prod-01' && github.base_ref == 'main'))"));
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


test('dual diagnostic remains separate and official Q4 requires dual-native evidence',()=>{
  const historic=readFileSync('scripts/diagnostics/ap02-native-device-v7.mjs','utf8');
  for(const marker of ["'appium:autoLaunch':false","'appium:autoWebview':false","Q5_DUAL_DIAGNOSTIC_PASS","fullF2Qualified:false","nativeReauthCount,4","dual-diagnostic"])assert.ok(historic.includes(marker),marker);
  assert.match(historic,/^function nativeNodes\(\)\s*\{\s*if\s*\(dualNative\)\s*\{\s*const nodes\s*=\s*readGuardedNativeSnapshot\(\{\s*session:\s*nativeSession\s*,\s*foreground:\s*documentsForeground\s*,\s*read:\s*appiumSnapshot\s*,\s*onState:\s*state\s*=>\s*\{\s*nativeUiObservation\s*=\s*state;\s*\}\s*\}\);\s*nativeSnapshots\+\+;\s*return nodes;\s*\}/m,
    'nativeNodes must return the guarded Appium snapshot for the active native session');
  assert.ok(q4.includes('dual_diagnostic: true'));
  assert.ok(q4.includes('mode: qualification'));
  assert.ok(f2.includes('Q5_DUAL_QUALIFICATION:'));
  assert.ok(f2.includes('Require native-only dual-channel evidence in approved candidates'));
  assert.ok(f2.includes('ap02-device-evidence/dual-channel.json'));
  assert.ok(historic.includes('DUAL_MODES_MUTUALLY_EXCLUSIVE'));
  assert.ok(historic.includes("const out = dualDiagnostic?'ap02-device-evidence/dual-diagnostic':'ap02-device-evidence'"));
  assert.ok(historic.includes("if(dualNative)await startNativeSession()"));
  assert.ok(historic.includes("if(dualNative&&nativeSession)"));
  assert.ok(historic.includes('sessionClosed:true'));
  assert.ok(runner.includes('Q5_DUAL_QUALIFICATION'));
  assert.ok(registry.invariants.some(x=>x.id==='QA-STABILITY-01-APPIUM-I04'));
  assert.equal(q4.split("needs.preflight.outputs.mode == 'qualification'").length-1,3);
  assert.ok(workflow.includes('Require isolated dual-channel diagnostic evidence'));
});

test('Q5-SYS-13 admission: exact promoted product and unchanged Q4 fail closed',()=>{
  const dir=mkdtempSync(join(tmpdir(),'q5-admission-'));
  const git=(...args)=>execFileSync('git',args,{cwd:dir,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
  const put=(path,value)=>{const dest=join(dir,path);mkdirSync(dirname(dest),{recursive:true});writeFileSync(dest,value);};
  const commit=message=>{git('add','.');git('commit','-qm',message);return git('rev-parse','HEAD');};
  const paths=['src/App.tsx','src/assessment/approvedAssessmentScopes.ts','src/assessment/assessmentSubjectScope.ts','src/security/ap02F1HistoricalRestore.test.ts','src/security/ap03HistoricalAssessmentScopes.test.ts','src/security/assessmentRestorePolicy.ts'];
  try{
    git('init','-q');git('config','user.name','Synthetic');git('config','user.email','synthetic@example.invalid');
    put('scripts/diagnostics/appium-pilot/pilot.py','# synthetic\n');for(const path of paths)put(path,'initial');
    const base=commit('base');
    put('scripts/diagnostics/appium-pilot/pilot.py','# approved lab\n');
    const lab=commit('lab');
    put(paths[3],'red');put(paths[4],'red');const red=commit('red');
    for(const path of paths)put(path,'green');
    const green=commit('green');
    put('.github/workflows/qa-appium-replacement-pilot.yml','approved workflow');
    put('scripts/diagnostics/appium-pilot/contract.test.mjs','approved test');
    put('scripts/diagnostics/ap02-native-device-v7.mjs','approved canonical observation');
    put('scripts/diagnostics/native-lab-transitions.mjs','approved observation primitive');
    const candidate=commit('candidate');
    const source=workflow.split('      - name: Verify frozen product and approved laboratory-only delta\n')[1].split('      - uses:')[0].split('        run: |\n')[1].split('\n').map(line=>line.slice(10)).join('\n');
    const run=(pr,sha,overrides={})=>{
      let script=source;
      const refs={'80378e9daab60fe6c389e372c3c79e3dcd09aac0':base,'72dd969863d6fa74229f04a8c95eabda0095ebb8':lab,'239c9b07a65dd9363073eb133c286f9a154ce622':red,'69d56478081077eef07aa3c1873bf4710f17807c':green,...overrides};
      for(const [from,to] of Object.entries(refs))script=script.replaceAll(from,to);
      const result=spawnSync('bash',['-c',script],{cwd:dir,env:{...process.env,PR_NUMBER:String(pr),CANDIDATE_SHA:sha},encoding:'utf8'});
      rmSync(join(dir,'scripts/diagnostics/appium-pilot/__pycache__'),{recursive:true,force:true});
      return result;
    };
    const pass=(pr,sha,overrides)=>{const result=run(pr,sha,overrides);assert.equal(result.status,0,result.stderr);};
    const fail=(pr,sha,overrides)=>{const result=run(pr,sha,overrides);assert.equal(typeof result.status,'number');assert.notEqual(result.status,0);};
    pass(412,candidate);
    fail(415,candidate);
    fail(412,green);
    fail(412,candidate,{'239c9b07a65dd9363073eb133c286f9a154ce622':base});
    fail(414,candidate);
    put(paths[0],'unauthorized');const badApp=commit('unauthorized app');fail(412,badApp);
    git('checkout','-q','--detach',candidate);
    put('scripts/diagnostics/appium-pilot/unapproved.mjs','unauthorized');const badLab=commit('unauthorized lab');fail(412,badLab);
    git('checkout','-q','--detach',lab);pass(414,lab);fail(412,lab);
    put('src/unapproved.ts','unauthorized');const q4Bad=commit('q4 unauthorized');fail(414,q4Bad);
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test('Q5-SYS-14 reads only: foreground loss between checks is transient, missing session is fatal',()=>{
  const session='11111111-2222-4333-8444-555555555555';
  const reads=[],states=[];
  const read=actualSession=>{reads.push(actualSession);return ['synthetic'];};
  assert.throws(()=>readGuardedNativeSnapshot({session,foreground:()=>false,read,onState:s=>states.push(s)}),{code:'NATIVE_UI_TREE_UNAVAILABLE'});
  assert.deepEqual(states,['foreground-transition']);
  assert.throws(()=>readGuardedNativeSnapshot({session:null,foreground:()=>true,read}),{code:'INVALID_HARNESS_ARGUMENT'});
  assert.deepEqual(reads,[]);
  assert.deepEqual(readGuardedNativeSnapshot({session,foreground:()=>true,read}),['synthetic']);
  assert.deepEqual(reads,[session]);
});
test('Q5-SYS-14 documentsui-to-unknown-to-application recovers only with positive return evidence',async()=>{
  let now=0,reads=0;const states=[];
  const frames=['documentsui','unknown','application'];
  const activity=()=>frames.shift()??'application';
  const result=await waitNativeOpenOrReturn({activity,
    read:()=>readGuardedNativeSnapshot({session:'synthetic',foreground:()=>activity()==='documentsui',read:()=>{reads++;return [];}}),
    select:()=>null,now:()=>now,sleep:async ms=>{now+=ms;},onState:s=>states.push(s)});
  assert.equal(result,'returned');assert.equal(reads,0);
  assert.deepEqual(states,['NATIVE_UI_TREE_UNAVAILABLE','open-return-observed']);
  // Old assertion is not a transient read and must still be classified as an assertion.
  assert.equal(classifyFailure({code:'ERR_ASSERTION'}).code,'ASSERTION_FAILED');
});
test('Q5-SYS-14 stale samples are discarded and unknown never qualifies as return',async()=>{
  let now=0,reads=0;const states=[];
  const frame=['documentsui','documentsui','documentsui','unknown','documentsui','documentsui','documentsui','documentsui'];
  const item={key:'confirm',value:{synthetic:true}};
  const result=await waitNativeOpenOrReturn({activity:()=>frame.shift()??'unknown',read:()=>{reads++;return [];},
    select:()=>item,now:()=>now,sleep:async ms=>{now+=ms;},onState:s=>states.push(s)});
  assert.deepEqual(result,item.value);assert.equal(reads,4);
  assert.deepEqual(states,['open-single-sample','open-foreground-transition','open-single-sample','open-stable']);
  now=0;
  await assert.rejects(waitNativeOpenOrReturn({activity:()=> 'unknown',read:()=>assert.fail('must not read'),select:()=>null,
    timeoutMs:1000,now:()=>now,sleep:async ms=>{now+=ms;}}),{code:'OBSERVATION_DEADLINE'});
  now=0;
  await assert.rejects(waitNativeOpenOrReturn({activity:()=> 'documentsui',read:()=>{throw new LabFailure('INVALID_HARNESS_ARGUMENT');},select:()=>null,
    now:()=>now,sleep:async ms=>{now+=ms;}}),{code:'INVALID_HARNESS_ARGUMENT'});
  assert.equal(now,0);
});
test('Q5-SYS-14 canonical F2 uses guarded observation and one-shot actions',()=>{
  const source=readFileSync('scripts/diagnostics/ap02-native-device-v7.mjs','utf8');
  const choose=source.split('async function nativeChoose(filename) {')[1].split('\nlet socket=')[0];
  assert.ok(source.includes('readGuardedNativeSnapshot({session:nativeSession,foreground:documentsForeground'));
  assert.ok(!source.includes("assert.ok(nativeSession&&documentsForeground()"));
  assert.ok(choose.includes('waitNativeOpenOrReturn({activity:activitySurface,read:nativeNodes'));
  assert.equal(choose.split('tap(sourceControl)').length-1,1);
  assert.equal(choose.split('tap(next)').length-1,1);
  assert.ok(choose.includes("await until(()=>activitySurface()==='application','RETURN_FROM_OPEN',45000)"));
  assert.ok(choose.indexOf("await until(()=>activitySurface()==='application'")<choose.indexOf('noteSafReturned()'));
});

test('CAND-PROD-01 admission requires exact composed product and mandatory dual gates',()=>{
  const route="github.head_ref == 'candidate/cand-prod-01' && github.base_ref == 'main'";
  const baseRef='1e9bcd0eb8bd5c7e72ea059b3f90f72805f9cdd1';
  const compositionRef='c0b9b1e0c5b5e6976fcb22fcffd4008a45b1829a';
  const treeRef='361e07245112478461e904109a89d81b4ebbdfe3';
  const admissionRef='177cab29ecbc8e216d656a9d4c9dc66664932892';
  assert.ok(workflow.includes(route+" && github.event.pull_request.base.sha == '"+baseRef+"'"));
  assert.ok(workflow.includes('github.event.pull_request.head.repo.full_name == github.repository'));
  assert.ok(workflow.includes('github.event.pull_request.base.repo.full_name == github.repository'));
  for(const flag of ['USE_HYBRID','Q5_DUAL_QUALIFICATION']){
    const line=f2.split('\n').find(l=>l.trimStart().startsWith(flag+':'));
    assert.ok(line?.includes(route),flag);
  }
  const hybrid=f2.split('hybrid-evidence:\n')[1].split('\n  installed-professional-v7:')[0];
  assert.ok(hybrid.includes(route));
  assert.ok(registry.invariants.some(i=>i.id==='CAND-PROD-01-ADMISSION-I01'));
  const paths=['.github/workflows/ap02-f2-native-device.yml','.github/workflows/qa-appium-replacement-pilot.yml','scripts/diagnostics/appium-pilot/contract.test.mjs','qualification/invariants.v1.json'];
  const r3aPaths=[".github/workflows/qa-appium-replacement-pilot.yml","qualification/invariants.v1.json","scripts/diagnostics/appium-pilot/contract.test.mjs","src/App.tsx","src/assessment/assessmentEvidenceMutation.ts","src/assessment/assessmentSubjectScope.ts","src/assessment/dailyAssessmentSetup.ts","src/assessment/dailyCriterionRecordingContext.ts","src/assessment/dailyPlannedAssessmentCompletion.ts","src/assessment/studentCriterionReadModel.ts","src/security/candProdHistoricalSubject.test.ts"];
  const dir=mkdtempSync(join(tmpdir(),'cand-prod-admission-'));
  const git=(...args)=>execFileSync('git',args,{cwd:dir,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
  const put=(path,value)=>{const dest=join(dir,path);mkdirSync(dirname(dest),{recursive:true});writeFileSync(dest,value);};
  const commit=message=>{git('add','.');git('commit','-qm',message);return git('rev-parse','HEAD');};
  try{
    git('init','-q');git('config','user.name','Synthetic');git('config','user.email','synthetic@example.invalid');
    put('src/App.tsx','base');const base=commit('base');
    put('src/App.tsx','qualified');put('scripts/diagnostics/appium-pilot/pilot.py','# synthetic\n');
    const composition=commit('composition');const tree=git('rev-parse',composition+'^{tree}');
    for(const path of paths)put(path,'approved admission');const admission=commit('admission');
    for(const path of r3aPaths)put(path,'approved R3a correction');const candidate=commit('R3a');
    const source=workflow.split('      - name: Verify frozen product and approved laboratory-only delta\n')[1].split('      - uses:')[0].split('        run: |\n')[1].split('\n').map(line=>line.slice(10)).join('\n');
    const run=(sha,{eventBase=base,candidateSha=sha,route='production',overrides={}}={})=>{
      git('checkout','-q','--detach',sha);
      let script=source;
      const refs={[baseRef]:base,[compositionRef]:composition,[treeRef]:tree,[admissionRef]:admission,...overrides};
      for(const [from,to] of Object.entries(refs))script=script.replaceAll(from,to);
      const result=spawnSync('bash',['-c',script],{cwd:dir,env:{...process.env,PR_NUMBER:'999',CANDIDATE_SHA:candidateSha,EVENT_BASE_SHA:eventBase,ADMISSION_ROUTE:route},encoding:'utf8'});
      rmSync(join(dir,'scripts/diagnostics/appium-pilot/__pycache__'),{recursive:true,force:true});
      return result;
    };
    const pass=(sha,options)=>{const r=run(sha,options);assert.equal(r.status,0,r.stderr);};
    const fail=(sha,options)=>{const r=run(sha,options);assert.equal(typeof r.status,'number');assert.notEqual(r.status,0);};
    pass(candidate);
    fail(candidate,{eventBase:composition});
    fail(candidate,{candidateSha:composition});
    fail(candidate,{overrides:{[treeRef]:'0'.repeat(40)}});
    fail(candidate,{eventBase:composition,overrides:{[baseRef]:composition}});
    fail(composition);
    fail(admission);
    fail(candidate,{overrides:{[admissionRef]:composition}});
    fail(candidate,{route:'legacy'});
    git('checkout','-q','--detach',candidate);put('src/unauthorized.ts','unauthorized');fail(commit('unauthorized product'));
    git('checkout','-q','--detach',candidate);put('scripts/diagnostics/extra.mjs','unauthorized');fail(commit('unauthorized laboratory'));
    git('checkout','-q','--detach',candidate);put('src/App.tsx','qualified');fail(commit('missing approved product change'));
  }finally{rmSync(dir,{recursive:true,force:true});}
});
