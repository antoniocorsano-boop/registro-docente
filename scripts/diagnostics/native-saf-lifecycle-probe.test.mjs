import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyResumedActivity, summarizeSafActivityTrail, startSafActivityProbe } from './native-saf-lifecycle-probe.mjs';
import { classifyAdbCommand, createAdbTransportTrace } from './native-adb-transport-probe.mjs';
import { classifyHomeNavigationFrame, safeHomeNavigationReport } from './native-home-navigation-probe.mjs';
import {labV7Date,isOriginalV7Name,selectNewLabV7Name,quotedLabV7Path,pullLabV7Bytes} from './native-v7-document-discovery.mjs';

const app = 'it.trama.registrodocente.lab.ap02v7';
test('F2-DIAG-03 recognizes app, DocumentsUI and unrelated foreground activities without raw data', () => {
  const line = name => 'mResumedActivity: ActivityRecord{a5 u0 ' + name + '/.MainActivity t14}';
  assert.equal(classifyResumedActivity(line(app), app), 'application');
  assert.equal(classifyResumedActivity(line('com.google.android.documentsui'), app), 'documentsui');
  assert.equal(classifyResumedActivity(line('com.android.settings'), app), 'other');
  assert.equal(classifyResumedActivity('mResumedActivity: null', app), 'unknown');
  assert.equal(classifyResumedActivity('ADB unavailable', app), 'unknown');
});
test('F2-DIAG-03 shows a documented picker return and only categorical transitions', () => {
  const result = summarizeSafActivityTrail([
    { elapsedMs: 0, surface: 'application' },
    { elapsedMs: 1400, surface: 'documentsui' },
    { elapsedMs: 2800, surface: 'documentsui' },
    { elapsedMs: 4200, surface: 'application' }
  ]);
  assert.equal(result.observedDocumentsUi, true);
  assert.equal(result.observedReturnToAppAfterDocumentsUi, true);
  assert.equal(result.firstDocumentsUiMs, 1400);
  assert.deepEqual(result.transitions.map(e => e.surface), ['application','documentsui','application']);
  assert.equal(JSON.stringify(result).includes('com.google'), false);
});
test('F2-DIAG-03 does not infer an absent picker from missing or unrelated observations', () => {
  const result = summarizeSafActivityTrail([
    { elapsedMs: 0, surface: 'unknown' },
    { elapsedMs: 1400, surface: 'application' },
    { elapsedMs: 2800, surface: 'other' }
  ]);
  assert.equal(result.observedDocumentsUi, false);
  assert.equal(result.observedReturnToAppAfterDocumentsUi, false);
  assert.equal(result.firstDocumentsUiMs, null);
});
test('F2-DIAG-03 samples an injected activity source and stops without storing raw snapshots', async () => {
  const frames = [
    'topResumedActivity=ActivityRecord{11 u0 '+app+'/.MainActivity t1}',
    'topResumedActivity=ActivityRecord{12 u0 com.google.android.documentsui/.files.FilesActivity t2}',
    'topResumedActivity=ActivityRecord{13 u0 '+app+'/.MainActivity t1}'
  ];
  let index = 0;
  const probe = startSafActivityProbe({
    appPackage: app, readActivityDump: () => frames[Math.min(index++,2)],
    now: () => index * 1000, pause: async () => {}, maxSamples: 3
  });
  // Flush injected, zero-delay sampling before stopping the probe.
  // Immediate stop legitimately preserves only the first observation.
  for (let i = 0; i < 4; i++) await Promise.resolve();
  const result = await probe.stop();
  assert.equal(result.observationCount, 3);
  assert.equal(result.observedDocumentsUi, true);
  assert.equal(result.observedReturnToAppAfterDocumentsUi, true);
  assert.equal(JSON.stringify(result).includes('MainActivity'), false);
});

test('F2-DIAG-04 classifies ADB calls without retaining raw argument values', () => {
  assert.equal(classifyAdbCommand(['shell','dumpsys','activity','activities']), 'activity-state');
  assert.equal(classifyAdbCommand(['shell','uiautomator','dump','/sdcard/private.xml']), 'native-ui-dump');
  assert.equal(classifyAdbCommand(['shell','input','text','synthetic-secret']), 'native-input');
  assert.equal(classifyAdbCommand(['forward','tcp:9222','localabstract:webview_devtools_remote_1234']), 'webview-forward');
  assert.equal(classifyAdbCommand(['shell','cat','/sdcard/Download/secret.enc.json']), 'native-file-read');
  assert.equal(classifyAdbCommand(['shell','getprop','ro.build.version.sdk']), 'device-property');
});
test('F2-DIAG-04 retains only a bounded, synthetic transport trace and allowed reauth stages', () => {
  let now = 100;
  const trace = createAdbTransportTrace({now:()=>now,maxCalls:2});
  trace.record(['shell','input','text','synthetic-secret'], 80, 'ok');
  now = 140;
  trace.mark('picker-returned');
  trace.record(['shell','dumpsys','activity','activities'], 100, 'timeout');
  now = 180;
  trace.mark('lock-wait-start');
  trace.mark('hidden-secret');
  trace.record(['forward','tcp:9222','synthetic-secret'], 150, 'failed');
  const actual=trace.snapshot();
  assert.equal(actual.totalCalls,3);
  assert.equal(actual.omittedCalls,1);
  assert.deepEqual(actual.calls.map(x=>x.kind), ['activity-state','webview-forward']);
  assert.deepEqual(actual.calls.map(x=>x.result), ['timeout','failed']);
  assert.deepEqual(actual.milestones.map(x=>x.stage), ['picker-returned','lock-wait-start']);
  assert.equal(actual.rawOutputStored,false);
  assert.equal(actual.syntheticOnly,true);
  assert.equal(JSON.stringify(actual).includes('synthetic-secret'),false);
  assert.equal(JSON.stringify(actual).includes('private.xml'),false);
});

test('F2-DIAG-05 requires a complete, interactive Home and never accepts protected or stale views', () => {
  const valid={
    locked:false,confirmationVisible:false,todayHeadingVisible:true,
    classHeadingVisible:true,newClassButtonVisible:true,brandInteractive:true,
    documentVisible:true
  };
  assert.equal(classifyHomeNavigationFrame(valid),'home-ready');
  assert.equal(classifyHomeNavigationFrame({...valid,locked:true}),'locked');
  assert.equal(classifyHomeNavigationFrame({...valid,confirmationVisible:true}),'confirmation');
  assert.equal(classifyHomeNavigationFrame({...valid,documentVisible:false}),'background');
  assert.equal(classifyHomeNavigationFrame({...valid,todayHeadingVisible:false}),'other-view');
  assert.equal(classifyHomeNavigationFrame({...valid,brandInteractive:false}),'home-not-interactive');
  assert.equal(classifyHomeNavigationFrame({...valid,newClassButtonVisible:false}),'home-not-interactive');
  assert.equal(classifyHomeNavigationFrame(null),'unavailable');
});
test('F2-DIAG-05 retains only classified navigation stages, not raw private UI details', () => {
  const trace=safeHomeNavigationReport([
    {stage:'other-view',elapsedMs:100,privateField:'secret-user'},
    {stage:'locked',elapsedMs:200,secret:'secret-user'},
    {stage:'home-ready',elapsedMs:1000},
    {stage:'UNEXPECTED_NAME',elapsedMs:1500}
  ],{locked:false,todayHeadingVisible:true,documentVisible:true,
    classHeadingVisible:true,newClassButtonVisible:true,brandInteractive:true,
    password:'secret-user',className:'secret-user'});
  assert.equal(trace.lastStage,'home-ready');
  assert.deepEqual(trace.transitions.map(x=>x.stage),
    ['other-view','locked','home-ready','unavailable']);
  assert.equal(trace.rawDomStored,false);
  assert.equal(JSON.stringify(trace).includes('secret-user'),false);
});

test('F2-DIAG-06 recognizes Android numbered collision files but rejects arbitrary paths', () => {
  const base='Backup_Valutazioni_V7_2026-11-24.enc.json';
  const variants=[
    'Backup_Valutazioni_V7_2026-11-24(1).enc.json',
    'Backup_Valutazioni_V7_2026-11-24 (1).enc.json',
    'Backup_Valutazioni_V7_2026-11-24.enc(1).json',
    'Backup_Valutazioni_V7_2026-11-24.enc (1).json',
    'Backup_Valutazioni_V7_2026-11-24.enc.json(1)'
  ];
  assert.equal(isOriginalV7Name(base),true);
  assert.equal(labV7Date(base),'2026-11-24');
  for(const name of variants){
    assert.equal(labV7Date(name),'2026-11-24');
    assert.equal(selectNewLabV7Name([base],[base,name]),name);
    assert.equal(quotedLabV7Path(name),"'"+'/sdcard/Download/'+name+"'");
  }
  for(const name of ['../../secret.enc.json','Backup_Valutazioni_V7_2026-11-24;rm.enc.json',
    'Backup_Valutazioni_V7_2026-11-24.enc.json.bak']){
    assert.equal(labV7Date(name),null);
    assert.throws(()=>quotedLabV7Path(name),/INVALID_LAB_V7_FILE_NAME/);
  }
});
test('F2-DIAG-06 never treats overwrite, missing source or wrong date as two backups', () => {
  const original='Backup_Valutazioni_V7_2026-11-24.enc.json';
  const second='Backup_Valutazioni_V7_2026-11-24.enc(1).json';
  assert.equal(selectNewLabV7Name([],[original]),original);
  assert.throws(()=>selectNewLabV7Name([],[]),/V7_FIRST_FILE_NOT_UNIQUE/);
  assert.throws(()=>selectNewLabV7Name([original],[original]),/V7_SECOND_DISTINCT_DOCUMENT_MISSING/);
  assert.throws(()=>selectNewLabV7Name([original],[second]),/V7_SECOND_DISTINCT_DOCUMENT_MISSING/);
  assert.throws(()=>selectNewLabV7Name([original],[original,
    'Backup_Valutazioni_V7_2026-11-25.enc(1).json']),/V7_SECOND_DISTINCT_DOCUMENT_MISSING/);
  assert.throws(()=>selectNewLabV7Name([original],[original,second,second]),/INVALID_LAB_V7_FILE_LIST/);
  assert.throws(()=>selectNewLabV7Name([original],[original,second,'foreign']),/INVALID_LAB_V7_FILE_LIST/);
});

import { existsSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

test('F2-DIAG-07 pulls exact original and collision paths without shell quotes, returns exact bytes and cleans temp data',()=>{
  for(const name of ['Backup_Valutazioni_V7_2026-11-24.enc.json','Backup_Valutazioni_V7_2026-11-24 (1).enc.json']){
    const expected=Buffer.from([0,255,10,13,123,125]);
    let local;
    const bytes=pullLabV7Bytes(name,(command,args,options)=>{
      assert.equal(command,'adb');
      assert.deepEqual(args.slice(0,2),['pull','/sdcard/Download/'+name]);
      // Capture stderr in memory for transport classification; never emit it.
      assert.deepEqual(options.stdio,['ignore','ignore','pipe']);
      assert.equal(options.killSignal,'SIGKILL');
      assert.equal(options.timeout,30000);
      local=args[2];
      writeFileSync(local,expected);
    });
    assert.deepEqual(bytes,expected);
    assert.equal(existsSync(dirname(local)),false);
  }
});
test('F2-DIAG-07 refuses invalid paths and never accepts a partial failed pull',()=>{
  for(const name of ['../secret','Backup_Valutazioni_V7_2026-11-24.enc.json\n']){
    assert.throws(()=>pullLabV7Bytes(name,()=>assert.fail('unexpected transfer')),/INVALID_LAB_V7_FILE_NAME/);
  }
  let local;
  assert.throws(()=>pullLabV7Bytes('Backup_Valutazioni_V7_2026-11-24.enc.json',(_command,args)=>{
    local=args[2];writeFileSync(local,'partial');throw Error('simulated pull failure');
  }),/simulated pull failure/);
  assert.equal(existsSync(dirname(local)),false);
});

test('F2-DIAG-07 captured transport failures preserve safe classification and clean partial bytes',()=>{
  const name='Backup_Valutazioni_V7_2026-11-24.enc.json';
  for(const [error,code] of [
    [Object.assign(new Error('private command details'),{status:1,stderr:'adb: device offline\n'}),'ADB_TRANSPORT_OFFLINE'],
    [Object.assign(new Error('private timeout details'),{code:'ETIMEDOUT'}),'ADB_TRANSPORT_TIMEOUT']
  ]){
    let local,calls=0;
    assert.throws(()=>pullLabV7Bytes(name,(_cmd,args,options)=>{
      calls++;local=args[2];assert.deepEqual(options.stdio,['ignore','ignore','pipe']);
      writeFileSync(local,'partial');throw error;
    }),e=>e.code===code&&e.message===code);
    assert.equal(calls,1);
    assert.equal(existsSync(dirname(local)),false);
  }
});
