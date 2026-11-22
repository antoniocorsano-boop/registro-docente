import { describe, expect, test } from 'bun:test';
import { createInitialArchiveSnapshot } from './initialArchiveSetup';
import { createVersionedBackupReceiptAuthority, verifiedBackupDateForVersion } from '../persistence/versionedBackupReceipt';
import { decryptDataWithPassword } from '../cryptoUtils';
import { projectAssessmentRestoreV7 } from './assessmentRestorePolicy';

const stamp = '2026-11-22T20:00:00.000Z';
const password = 'ap02-synthetic-only';
const empty = () => createInitialArchiveSnapshot({
  mode: 'professional',
  profile: { school: 'Istituto sintetico', teacher: 'Docente sintetico', year: '2026/2027', subject: 'Tecnologia' }
});

describe('AUDIT-PRE-01/AP-02 — operational V7 export and conservative recovery contract', () => {
  test('a decrypted V7 copy is exact, and byte-verified copy receipts are version-bound and one-use', async () => {
    const archive = empty();
    const authority = createVersionedBackupReceiptAuthority(7);
    const prepared = await authority.prepare(archive, [], password, stamp);
    const decoded = await decryptDataWithPassword(prepared.encryptedText, password);
    expect(decoded.backupDataVersion).toBe(7);
    expect(decoded.snapshot.appData).toEqual(archive.appData);
    expect(decoded.snapshot.meta).toEqual({ changes: 0, lastBackup: stamp });
    expect(prepared.receipt.payloadVersion).toBe(7);
    expect(() => authority.consume(archive.meta, prepared.receipt, 7)).toThrow();
    expect(await authority.verifyWeb(prepared.receipt, new Blob([prepared.encryptedText]), () => true)).toBe('verified');
    const saved = authority.consume(archive.meta, prepared.receipt, 7);
    expect(saved.verifiedBackupEvidence?.payloadVersion).toBe(7);
    expect(verifiedBackupDateForVersion(saved, 7)).toBe(stamp);
    expect(verifiedBackupDateForVersion(saved, 6)).toBeNull();
    expect(() => authority.consume(archive.meta, prepared.receipt, 7)).toThrow();
  });

  test('V7 restore requires an authenticated exact current-state recovery, not a matching label', async () => {
    const archive = empty();
    const authority = createVersionedBackupReceiptAuthority(7);
    const prepared = await authority.prepare(archive, [], password, stamp);
    const copy = await decryptDataWithPassword(prepared.encryptedText, password);
    const result = await projectAssessmentRestoreV7(archive, copy, copy, [], []);
    expect(result.appData).toEqual(archive.appData);
    await expect(projectAssessmentRestoreV7(archive, copy, null, [], [])).rejects.toThrow();
    await expect(projectAssessmentRestoreV7(archive, { ...copy, backupDataVersion: 6 }, copy, [], [])).rejects.toThrow();
    const forgedRecovery = structuredClone(copy);
    forgedRecovery.snapshot.settings.school = 'Scuola diversa';
    await expect(projectAssessmentRestoreV7(archive, copy, forgedRecovery, [], [])).rejects.toThrow();
  });

  test('production App serializes V7 authority and restoration before persistent writing', async () => {
    const app = await Bun.file('src/App.tsx').text();
    const v7Export = app.slice(app.indexOf('const prepareAssessmentV7Backup ='), app.indexOf('const bindBackupEvidence ='));
    expect(v7Export).toContain('mutationCoordinator.enqueueTask');
    expect(v7Export).toContain('resolveApprovedAssessmentScopes(snapshot.appData, snapshot.planning, snapshot.settings)');
    expect(v7Export).toContain('assessmentBackupAuthority.prepare(');
    expect(v7Export).toContain('assessmentBackupAuthority.verifyWeb(');
    expect(v7Export).toContain('assessmentBackupAuthority.verifyAndroid(');
    expect(v7Export).toContain('assessmentBackupAuthority.consume(current, receipt, 7)');
    expect(v7Export).toContain('secureStorage.saveMeta(candidate)');
    const restore = app.slice(app.indexOf('const handleImportEncryptedBackup ='), app.indexOf('const handleFactoryReset ='));
    const projection = restore.indexOf('projectAssessmentRestoreV7(');
    const persistence = restore.indexOf('secureStorage.restoreSnapshotVerified(');
    expect(projection).toBeGreaterThan(0);
    expect(persistence).toBeGreaterThan(projection);
    expect(restore).toContain('resolveApprovedAssessmentScopes(');
    expect(restore).toContain('assertHistoricalAssessmentRestoreAllowed(previousLogical.appData, decryptedData)');
    expect(restore).toContain('const handleImportEncryptedBackup = (decryptedData: unknown): Promise<void> =>');
    expect(restore).toContain('const handleImportAssessmentV7Backup = (decryptedData: unknown, recoveryData: unknown): Promise<void> =>');
    expect(restore).toContain('const restoreVerifiedCandidate = async (');
    expect(restore).toContain('assessmentBackupAuthority.invalidate()');
    expect(restore).toContain('wouldLoseCouncilEntries(');
  });

  test('Privacy V7 requires a separate recovery copy, protects legacy UI and never grants a web receipt on download', async () => {
    const privacy = await Bun.file('src/components/PrivacyView.tsx').text();
    expect(privacy).toContain('onPrepareAssessmentV7Backup(encryptPassword)');
    expect(privacy).toContain('onVerifyAssessmentV7AndroidBackup(');
    expect(privacy).toContain('onVerifyAssessmentV7WebBackup(');
    expect(privacy).toContain('onRecordAssessmentV7Backup(');
    expect(privacy).toContain('selectedV7RecoveryFile');
    expect(privacy).toContain('JSON.parse(recoveryText).version !== 2');
    expect(privacy).toContain('onImportAssessmentV7Backup(decryptedData, recoveryData)');
    expect(privacy).toContain('onImportEncryptedBackup(decryptedData)');
    const webExport = privacy.slice(privacy.indexOf('const handleExportAssessmentV7 ='), privacy.indexOf('const handleImportEncrypted ='));
    expect(webExport).toContain('v7VerificationRef.current = receipt');
    expect(webExport.indexOf('v7VerificationRef.current = receipt')).toBeGreaterThan(webExport.indexOf('link.click()'));
    expect(webExport).not.toContain('onRecordAssessmentV7Backup(receipt);\n      } else');
    expect(privacy).toContain('const payload = createBackupPayload(checkpoint.snapshot)');
    expect(privacy).toContain('onImportAssessmentV7Backup?: (decryptedData: unknown, recoveryData: unknown) => Promise<void>;');
  });
});
