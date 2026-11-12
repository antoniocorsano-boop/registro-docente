import { describe, expect, test } from 'bun:test';
const root = new URL('../../', import.meta.url);
const load = (path: string) => Bun.file(new URL(path, root)).text();

describe('MOBILE-01/M4 separated Beta identity and owner-local signing', () => {
  test('keeps the already installed debug app separate and disables automatic archive transfer in the Beta', async () => {
    const probe = JSON.parse(await load('mobile/android-probe/capacitor.config.json'));
    const beta = JSON.parse(await load('mobile/android-probe/beta-identity.json'));
    expect(probe.appId).toBe('it.trama.registrodocente.prova');
    expect(beta.applicationId).toBe('it.trama.registrodocente');
    expect(beta.versionCode).toBeGreaterThanOrEqual(10001);
    expect(beta.status).toBe('UNSIGNED_CANDIDATE_NOT_RELEASED');
    const prepare = await load('mobile/android-probe/prepare-beta.mjs');
    for (const token of ['android:allowBackup="false"', 'android:fullBackupContent="false"', 'android:dataExtractionRules',
      '<cloud-backup>', '<device-transfer>', 'config.server?.url', 'config.loggingBehavior', 'Unexpected signing config',
      'it.trama.registrodocente.prova.MainActivity']) expect(prepare).toContain(token);
    expect(prepare).not.toContain('process.env.');
  });
  test('CI verifies release identity without signing credentials or publishing', async () => {
    const workflow = await load('.github/workflows/mobile-01-android-probe.yml');
    for (const token of ['assembleRelease', 'app-release-unsigned.apk', 'Unexpected signature on unsigned candidate',
      'application-debuggable', 'stable_owner_certificate_qualified=false', 'upgrade_device_qualified=false',
      'migration_device_qualified=false', 'real_data_authorized=false', 'mobile01-android-beta-unsigned-']) expect(workflow).toContain(token);
    expect(workflow).not.toContain('secrets.');
    expect(workflow).not.toContain('apksigner sign');
  });
  test('owner signer checks artifact integrity and stable certificate before returning an update', async () => {
    const script = await load('mobile/android-probe/sign-beta-locally.sh');
    for (const token of ['sha256sum "$unsigned"', 'Input must be unsigned', 'Previous signed Beta required',
      '"$version" -gt "$old_version"', 'Signing certificate differs', 'verify --print-certs', '--ks-key-alias registro-docente',
      'Debuggable candidate rejected', 'set -o noclobber', 'NOT released']) expect(script).toContain(token);
    expect(script).not.toMatch(/--ks-pass|--key-pass|curl|wget|gh release/);
  });
});
