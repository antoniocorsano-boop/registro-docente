import { describe, expect, test } from 'bun:test';

const source = await Bun.file('src/components/PrivacyView.tsx').text();
const flow = source.slice(source.indexOf('const handleExportEncrypted'), source.indexOf('const handleImportEncrypted'));

describe('BACKUP-02/B1 verified copy boundary', () => {
  test('web download cannot record a verified copy or reduce the outstanding change counter', () => {
    const nativeStart = flow.indexOf('if (androidNative) {');
    const webStart = flow.indexOf('} else {', nativeStart);
    const webClick = flow.indexOf('a.click();', webStart);
    const catchStart = flow.indexOf('} catch (err)', webClick);
    expect(nativeStart).toBeGreaterThanOrEqual(0);
    expect(webStart).toBeGreaterThan(nativeStart);
    expect(webClick).toBeGreaterThan(webStart);
    expect(catchStart).toBeGreaterThan(webClick);
    const native = flow.slice(nativeStart, webStart);
    const webAndCommon = flow.slice(webStart, catchStart);
    expect(native).toContain('await saveEncryptedBackupOnAndroid(');
    expect(native).toContain('await onRecordBackupExport(');
    expect(native.indexOf("if (result === 'cancelled' || !mountedRef.current) return;")).toBeGreaterThanOrEqual(0);
    expect(native.indexOf('await onRecordBackupExport(')).toBeGreaterThan(native.indexOf("if (result === 'cancelled' || !mountedRef.current) return;"));
    expect(webAndCommon).not.toContain('onRecordBackupExport(');
  });

  test('a browser download is not presented as a completed encrypted backup', () => {
    expect(flow).not.toContain('Backup protetto con crittografia AES-256-GCM esportato con successo!');
    expect(flow).toContain('Download avviato');
    expect(flow).toContain('verifica');
  });
});
