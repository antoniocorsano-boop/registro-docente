import { describe, expect, test } from 'bun:test';

describe('SEC-1 secure backup UI boundary', () => {
  test('routes generic backup actions to the protected Privacy area instead of plaintext JSON files', async () => {
    const app = await Bun.file('src/App.tsx').text();

    expect(app).not.toContain("input.accept = '.json'");
    expect(app).not.toContain('new Blob([JSON.stringify(payload');
    expect(app).toContain("const handleExportBackup = () => {\n    setActiveTab('privacy');");
    expect(app).toContain("const handleImportBackup = () => {\n    setActiveTab('privacy');");
  });

  test('PrivacyView uses a prepared secure checkpoint and avoids absolute cloud claims', async () => {
    const privacy = await Bun.file('src/components/PrivacyView.tsx').text();

    expect(privacy).not.toContain('backupSnapshot');
    expect(privacy).toContain('onPrepareEncryptedBackup');
    expect(privacy).toContain('onRecordBackupExport');
    expect(privacy).toContain('createBackupPayload(checkpoint.snapshot)');
    expect(privacy).not.toContain('Zero-Cloud');
    expect(privacy).not.toContain('100% Archiviazione Locale');
    expect(privacy).not.toContain('Nessun dato personale o voto viene mai inviato a server esterni.');
    expect(privacy).toContain('provider remoto');
  });
});
