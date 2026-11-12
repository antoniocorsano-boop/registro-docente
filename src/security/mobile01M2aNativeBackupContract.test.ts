import { describe, expect, test } from 'bun:test';

const root = new URL('../../', import.meta.url);
const load = async (path: string) => Bun.file(new URL(path, root)).text();

describe('MOBILE-01/M2a native encrypted backup boundary', () => {
  test('Android chooses a local document and verifies actual read-back before issuing a receipt', async () => {
    const source = await load('mobile/android-probe/native/RegistroBackupFilesPlugin.java');
    for (const required of [
      'Intent.ACTION_CREATE_DOCUMENT', 'Intent.CATEGORY_OPENABLE', 'Intent.EXTRA_LOCAL_ONLY',
      'com.android.externalstorage.documents', 'com.android.providers.downloads.documents',
      'LOCAL_PROVIDERS.contains(uri.getAuthority())', 'UUID.randomUUID()', 'destinationToken = null',
      'validateEnvelope(encrypted)', 'REGISTRO_DOCENTE_AES_GCM_256', '600000',
      'resolver.openOutputStream(uri, "wt")', 'resolver.openInputStream(uri)',
      'count != bytes.length', 'MessageDigest.isEqual(expectedHash, actualHash)',
      'receipt.put("status", "verified")', 'Activity.RESULT_CANCELED',
    ]) expect(source).toContain(required);
    expect(source.indexOf('validateEnvelope(encrypted)')).toBeLessThan(source.indexOf('resolver.openOutputStream'));
    expect(source.indexOf('resolver.openInputStream')).toBeLessThan(source.indexOf('receipt.put("status", "verified")'));
    expect(source).not.toMatch(/MANAGE_EXTERNAL_STORAGE|WRITE_EXTERNAL_STORAGE|takePersistableUriPermission|https?:\/\//);
    expect(source).not.toMatch(/Log\.[a-z]|System\.out/);
  });
  test('plugin compiled inside Android package, debug logging off, no production declaration', async () => {
    const config = JSON.parse(await load('mobile/android-probe/capacitor.config.json'));
    expect(config.loggingBehavior).toBe('none');
    expect(config.appId).toBe('it.trama.registrodocente.prova');
    const main = await load('mobile/android-probe/native/MainActivity.java');
    expect(main.indexOf('registerPlugin(RegistroBackupFilesPlugin.class)')).toBeLessThan(main.indexOf('super.onCreate(savedInstanceState)'));
    const workflow = await load('.github/workflows/mobile-01-android-probe.yml');
    expect(workflow).toContain('cp native/MainActivity.java native/RegistroBackupFilesPlugin.java');
    expect(workflow).toContain('android_backup_device_qualified=false');
    expect(workflow).not.toContain('android_backup_device_qualified=true');
    expect(workflow).toContain('release_signing=false');
  });
  test('the actual privacy UI does not record Android backup on picker cancel, missing plugin or unmounted view', async () => {
    const source = await load('src/components/PrivacyView.tsx');
    const flow = source.slice(source.indexOf('const handleExportEncrypted'), source.indexOf('const handleImportEncrypted'));
    expect(flow).toContain('const androidNative = isAndroidBackupRuntime()');
    expect(flow).toContain('if (androidNative) {');
    expect(flow).toContain('await saveEncryptedBackupOnAndroid(');
    expect(flow).toContain("if (result === 'cancelled' || !mountedRef.current) return;");
    expect(flow.indexOf('await encryptDataWithPassword')).toBeLessThan(flow.indexOf('await saveEncryptedBackupOnAndroid'));
    expect(flow.indexOf("if (result === 'cancelled' || !mountedRef.current) return;")).toBeLessThan(flow.indexOf('await onRecordBackupExport(checkpoint);'));
    expect(flow).toContain('} else {\n        const blob = new Blob([encryptedString]');
    const bridge = await load('src/security/androidBackupExport.ts');
    expect(bridge).toContain('plugin.chooseBackupDestination({ filename })');
    expect(bridge).toContain('plugin.writeEncryptedBackup({ token: selection.token, encryptedText })');
    expect(bridge).toContain("receipt.sha256 !== expectedSha256");
    expect(bridge).not.toContain('document.createElement');
    expect(bridge).not.toContain('fetch(');
  });
});
