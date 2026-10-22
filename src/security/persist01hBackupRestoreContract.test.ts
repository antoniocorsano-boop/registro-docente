import { describe, expect, test } from 'bun:test';

const appSource = await Bun.file('src/App.tsx').text();
const privacySource = await Bun.file('src/components/PrivacyView.tsx').text();

function sectionBetween(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
}

describe('PERSIST-01H serialized backup and restore contract', () => {
  test('App prepares backup from committed refs inside one serialized checkpoint task', () => {
    expect(appSource).toContain('prepareBackupCheckpoint');
    expect(appSource).toContain('PreparedBackupCheckpoint');
    expect(appSource).toContain('const getCompleteCommittedSnapshot = (): CompleteSecureAppSnapshot =>');

    const prepare = sectionBetween(appSource, 'const prepareEncryptedBackup', 'const recordEncryptedBackupExport');
    expect(prepare).toContain('mutationCoordinator.enqueueTask');
    expect(prepare).toContain('prepareBackupCheckpoint(getCompleteCommittedSnapshot(), new Date().toISOString())');
    expect(prepare).not.toContain('appData,');
  });

  test('backup receipt is serialized and subtracts only the checkpoint changes from current meta', () => {
    expect(appSource).toContain('applyBackupReceipt');
    const receipt = sectionBetween(appSource, 'const recordEncryptedBackupExport', '// Import Encrypted Backup');
    expect(receipt).toContain('mutationCoordinator.enqueue<SecureMeta>');
    expect(receipt).toContain('getCommitted: () => metaRef.current');
    expect(receipt).toContain('derive: current => applyBackupReceipt(current, checkpoint)');
    expect(receipt).toContain('persist: candidate => secureStorage.saveMeta(candidate)');
    expect(receipt).toContain('metaRef.current = candidate');
    expect(receipt).toContain('setMeta(candidate)');
  });

  test('restore is one serialized application task using the explicit previous logical snapshot', () => {
    const restore = sectionBetween(appSource, '// Import Encrypted Backup', '// Factory Reset');
    expect(restore).toContain('const handleImportEncryptedBackup = (decryptedData: unknown): Promise<void> =>');
    expect(restore).toContain('return mutationCoordinator.enqueueTask(async () => {');
    expect(restore).toContain('const previousLogical = getCompleteCommittedSnapshot();');
    expect(restore).toContain('normalizeBackupPayload(decryptedData, previousLogical)');
    expect(restore).toContain('await secureStorage.restoreSnapshotVerified(candidate, previousLogical)');
    expect(restore.indexOf('await secureStorage.restoreSnapshotVerified(candidate, previousLogical)')).toBeLessThan(restore.indexOf('appDataRef.current = restored.appData'));
    expect(restore).toContain("setActiveTab('home')");
  });

  test('PrivacyView exports the prepared checkpoint and records receipt only after download initiation', () => {
    expect(privacySource).not.toContain('backupSnapshot: CompleteSecureAppSnapshot;');
    expect(privacySource).toContain('onPrepareEncryptedBackup: () => Promise<PreparedBackupCheckpoint>;');
    expect(privacySource).toContain("onRecordBackupExport: (checkpoint: Pick<PreparedBackupCheckpoint, 'includedChanges' | 'checkpointAt'>) => Promise<void>;");

    const exportSection = sectionBetween(privacySource, 'const handleExportEncrypted', 'const handleImportEncrypted');
    expect(exportSection).toContain('let downloadInitiated = false;');
    expect(exportSection).toContain('const checkpoint = await onPrepareEncryptedBackup();');
    expect(exportSection).toContain('createBackupPayload(checkpoint.snapshot)');
    expect(exportSection).toContain('a.click();');
    expect(exportSection).toContain('downloadInitiated = true;');
    expect(exportSection).toContain('await onRecordBackupExport(checkpoint);');
    expect(exportSection.indexOf('a.click();')).toBeLessThan(exportSection.indexOf('await onRecordBackupExport(checkpoint);'));
    expect(exportSection.indexOf('await onRecordBackupExport(checkpoint);')).toBeLessThan(exportSection.indexOf("setEncryptPassword('');"));
    expect(exportSection).toContain('Il download è stato avviato, ma lo stato del backup nel Registro non è stato aggiornato. Le modifiche restano segnalate come da salvare.');
  });

  test('App wires PrivacyView to checkpoint and receipt callbacks instead of render-time snapshot export', () => {
    const privacyRender = sectionBetween(appSource, '<PrivacyView', '/>');
    expect(privacyRender).not.toContain('backupSnapshot=');
    expect(privacyRender).not.toContain('onExportEncryptedBackup=');
    expect(privacyRender).toContain('onPrepareEncryptedBackup={prepareEncryptedBackup}');
    expect(privacyRender).toContain('onRecordBackupExport={recordEncryptedBackupExport}');
    expect(privacyRender).toContain('onImportEncryptedBackup={handleImportEncryptedBackup}');
  });
});
