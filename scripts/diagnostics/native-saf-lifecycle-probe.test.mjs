import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyResumedActivity, summarizeSafActivityTrail, startSafActivityProbe } from './native-saf-lifecycle-probe.mjs';

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
  const result = await probe.stop();
  assert.equal(result.observationCount, 3);
  assert.equal(result.observedDocumentsUi, true);
  assert.equal(result.observedReturnToAppAfterDocumentsUi, true);
  assert.equal(JSON.stringify(result).includes('MainActivity'), false);
});
