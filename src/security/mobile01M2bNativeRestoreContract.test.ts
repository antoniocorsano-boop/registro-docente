import { describe, expect, test } from 'bun:test';

const root = new URL('../../', import.meta.url);
const load = async (path: string) => Bun.file(new URL(path, root)).text();

describe('MOBILE-01/M2b encrypted restore integrity', () => {
  test('native reader uses local one-use URI access and bounded read, never emits plaintext legacy documents', async () => {
    const source = await load('mobile/android-probe/native/RegistroBackupFilesPlugin.java');
    for (const token of ['Intent.ACTION_OPEN_DOCUMENT', 'sourceToken = null', 'LOCAL_PROVIDERS.contains(uri.getAuthority())',
      'n > MAX_BYTES - out.size()', 'Arrays.equals(bytes, encrypted.getBytes(StandardCharsets.UTF_8))',
      'validateEnvelopeForRead(encrypted)', 'reply.put("encryptedText", encrypted)', 'READ_NOT_VERIFIED']) expect(source).toContain(token);
    const start = source.indexOf('public void readEncryptedBackup');
    const flow = source.slice(start, source.indexOf('private static void validateEnvelopeForRead', start));
    expect(flow.indexOf('validateEnvelopeForRead(encrypted)')).toBeLessThan(flow.indexOf('reply.put("encryptedText", encrypted)'));
    expect(flow).not.toContain('openOutputStream');
    expect(source).not.toMatch(/takePersistableUriPermission|MANAGE_EXTERNAL_STORAGE|WRITE_EXTERNAL_STORAGE/);
  });
  test('decrypt/authenticate, confirmation, and active-view guards precede the existing restore transaction', async () => {
    const view = await load('src/components/PrivacyView.tsx');
    const start = view.indexOf('const handleImportEncrypted');
    const flow = view.slice(start, view.indexOf('if (!selectedEncryptedFile)', start));
    for (const token of ['await readEncryptedBackupOnAndroid', 'await decryptDataWithPassword(encryptedText, decryptPassword)',
      'window.confirm(', 'if (!mountedRef.current) return;', 'await onImportEncryptedBackup(decryptedData)']) expect(flow).toContain(token);
    expect(flow.indexOf('await decryptDataWithPassword')).toBeLessThan(flow.indexOf('window.confirm('));
    expect(flow.indexOf('window.confirm(')).toBeLessThan(flow.indexOf('await onImportEncryptedBackup'));
    expect(flow).not.toContain('JSON.parse');
    const app = await load('src/App.tsx');
    expect(app).toContain('normalizeBackupPayloadVerified(decryptedData, previousLogical)');
    expect(app).toContain('secureStorage.restoreSnapshotVerified(candidate, previousLogical)');
  });
});
