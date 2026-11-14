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

describe('BACKUP-02/B3 explicit web verification boundary', () => {
  test('export retains expected bytes only after download, and readback alone authorizes the receipt', () => {
    const verify = source.slice(source.indexOf('const handleVerifyDownloadedCopy'), source.indexOf('  return (\n    <div className="space-y-4">'));
    expect(flow).toContain('await expectedBackupEvidence(encryptedString)');
    expect(flow.indexOf('await expectedBackupEvidence(encryptedString)')).toBeLessThan(flow.indexOf('a.click();'));
    expect(flow.indexOf('a.click();')).toBeLessThan(flow.indexOf('webVerificationRef.current = { receipt: checkpoint.receipt, evidence }'));
    expect(verify).toContain('await matchesDownloadedBackup(file, pending.evidence)');
    expect(verify).toContain('if (!matches)');
    expect(verify.indexOf('if (!matches)')).toBeLessThan(verify.indexOf('await onRecordBackupExport(pending.receipt)'));
    expect(verify.indexOf('webVerificationRef.current = null')).toBeLessThan(verify.indexOf('await onRecordBackupExport(pending.receipt)'));
    expect(verify).not.toContain('onImportEncryptedBackup');
    expect(verify).not.toContain('decryptDataWithPassword');
    expect(source).toContain('mountedRef.current = false; webVerificationRef.current = null;');
    expect(source).toContain('id="verify-downloaded-backup"');
  });
});
