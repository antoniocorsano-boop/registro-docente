import {describe, expect, test} from 'bun:test';
import {type Server} from 'node:http';
import {once} from 'node:events';
import {mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  createAndroidReviewApp, isApprovedSyntheticRequest, validReviewAuthorization,
  REVIEW_CLASS, REVIEW_SOURCE_TITLE, REVIEW_SOURCE_TEXT, REVIEW_OBJECTIVE
} from '../../scripts/hpr/androidReviewApp.ts';
import {buildAiBudgetAssessmentKey} from '../library/assessmentGeneration.ts';

const SECRET = 'safe-test-secret-is-not-a-real-password-0000000000000';
const SHA = '1'.repeat(40);
const EXPIRY = '2099-01-01T00:00:00Z';
const AUTH = 'Basic ' + Buffer.from('docente-prova:' + SECRET).toString('base64');
const fixture = {
  schemaVersion: 1,
  action: 'generate-assessment-draft',
  classification: 'TEACHER_PROFESSIONAL',
  explicitTeacherOptIn: true,
  source: {
    kind: 'concept',
    status: 'ready',
    privacy: 'teacher-professional',
    title: REVIEW_SOURCE_TITLE,
    text: REVIEW_SOURCE_TEXT
  },
  context: {className: REVIEW_CLASS, objective: REVIEW_OBJECTIVE},
  budget: {
    schemaVersion: 1,
    profile: 'balanced',
    activityKey: buildAiBudgetAssessmentKey(REVIEW_CLASS)
  }
};

async function withServer(fn: (base: string) => Promise<void>, staticRoot?: string) {
  const app = createAndroidReviewApp({
    accessSecret: SECRET,
    expectedSha: SHA,
    deployedSha: SHA,
    expiresAt: EXPIRY,
    staticRoot
  });
  const server: Server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const addr = server.address();
  if (!addr || typeof addr === 'string') throw new Error('Invalid test listener');
  try {
    await fn('http://127.0.0.1:' + addr.port);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close(error => error ? reject(error) : resolve())
    );
  }
}

describe('S3d Android HPR — fail-closed environment independent of normal app', () => {
  test('rejects unpinned, expired, or weakly protected deployments', () => {
    const valid = {accessSecret: SECRET, expectedSha: SHA, deployedSha: SHA, expiresAt: EXPIRY};
    expect(() => createAndroidReviewApp({...valid, accessSecret: 'weak'})).toThrow();
    expect(() => createAndroidReviewApp({...valid, deployedSha: '2'.repeat(40)})).toThrow();
    expect(() => createAndroidReviewApp({...valid, expiresAt: '2020-01-01T00:00:00Z'})).toThrow();
    expect(validReviewAuthorization(undefined, SECRET)).toBe(false);
    expect(validReviewAuthorization(AUTH, SECRET)).toBe(true);
    expect(validReviewAuthorization('Basic ' + Buffer.from('docente-prova:wrong').toString('base64'), SECRET)).toBe(false);
  });

  test('only the exact fixed synthetic source, class, and objective are accepted', () => {
    expect(isApprovedSyntheticRequest(fixture)).toBe(true);
    expect(isApprovedSyntheticRequest({...fixture, context: {...fixture.context, className: '2C Reale'}})).toBe(false);
    expect(isApprovedSyntheticRequest({...fixture, source: {...fixture.source, text: 'Dati reali'}})).toBe(false);
    expect(isApprovedSyntheticRequest({...fixture, explicitTeacherOptIn: false})).toBe(false);
  });

  test('enforces authentication, blocks other APIs, returns simulated draft without a provider key', async () => {
    await withServer(async base => {
      const unauthorized = await fetch(base + '/api/copilot/assessment-draft/provider');
      expect(unauthorized.status).toBe(401);
      expect(unauthorized.headers.get('cache-control')).toContain('no-store');

      const status = await fetch(base + '/__hpr/status', {headers: {Authorization: AUTH}});
      expect(status.status).toBe(200);
      const statusBody = await status.json();
      expect(statusBody.remoteCalls).toBe(false);
      expect(statusBody.syntheticDataOnly).toBe(true);
      expect(statusBody.commitSha).toBe(SHA);

      const availability = await fetch(base + '/api/copilot/assessment-draft/provider', {headers: {Authorization: AUTH}});
      expect(availability.status).toBe(200);
      expect((await availability.json()).provider).toContain('simulato');

      const blocked = await fetch(base + '/api/copilot/assessment-draft', {
        method: 'POST', headers: {Authorization: AUTH, 'Content-Type': 'application/json'},
        body: JSON.stringify({...fixture, source: {...fixture.source, text: 'Dato non fittizio'}})
      });
      expect(blocked.status).toBe(403);

      const disallowed = await fetch(base + '/api/copilot/intent/provider', {headers: {Authorization: AUTH}});
      expect(disallowed.status).toBe(403);

      const generated = await fetch(base + '/api/copilot/assessment-draft', {
        method: 'POST', headers: {Authorization: AUTH, 'Content-Type': 'application/json'},
        body: JSON.stringify(fixture)
      });
      const response = await generated.json();
      expect(generated.status).toBe(200);
      expect(response.draft.schemaVersion).toBe(1);
      expect(response.draft.questions).toHaveLength(2);
      expect(response.receipt.provider).toBe('s3d-android-local-simulation');
      expect(JSON.stringify(response)).not.toMatch(/GEMINI_API_KEY|google-gemini/);
    });
  });

  test('serves only local HTML dependencies without third-party font or script requests', async () => {
    const temp = mkdtempSync(path.join(os.tmpdir(), 'hpr-android-'));
    try {
      writeFileSync(path.join(temp, 'index.html'),
        '<!doctype html><head><title>Registro Docente</title>'
        + '<link href="https://fonts.googleapis.com/css2" rel="stylesheet">'
        + '<script src="https://cdnjs.cloudflare.com/example.js"></script>'
        + '</head><body><div id="root"></div></body>');
      await withServer(async base => {
        const response = await fetch(base + '/', {headers: {Authorization: AUTH}});
        const html = await response.text();
        expect(response.status).toBe(200);
        expect(html).toContain('SOLO PROVA');
        expect(html).not.toContain('fonts.googleapis');
        expect(html).not.toContain('cdnjs.cloudflare');
        expect(response.headers.get('content-security-policy')).toContain("connect-src 'self'");
      }, temp);
    } finally {
      rmSync(temp, {recursive: true, force: true});
    }
  });
});
