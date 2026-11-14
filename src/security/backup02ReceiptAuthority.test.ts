import { describe, expect, test } from 'bun:test';
import { createBackupReceiptAuthority, incrementBackupChanges, prepareBackupCheckpoint, verifiedBackupDate, withoutLocalBackupVerification } from '../persistence/backupCheckpoint';
import type { PreparedBackupCheckpoint } from '../persistence/backupCheckpoint';
import type { CompleteSecureAppSnapshot, SecureMeta } from './secureAppStorage';
import { createDurableMutationCoordinator } from '../persistence/durableMutationCoordinator';

const at = '2026-11-13T12:00:00.000Z';
const meta = (changes: number): SecureMeta => ({ changes, lastBackup: null });
const grant = (includedChanges = 3): PreparedBackupCheckpoint => ({
  snapshot: {} as CompleteSecureAppSnapshot, includedChanges, checkpointAt: at
});

describe('BACKUP-02/B1b one-use archive-scoped receipt authority', () => {
  test('subtracts only included changes, rejects replay after later work', () => {
    const authority = createBackupReceiptAuthority();
    const receipt = authority.issue(grant());
    expect(authority.consume(meta(5), receipt)).toEqual({ changes: 2, lastBackup: at, verifiedBackupAt: at });
    expect(() => authority.consume(meta(7), receipt)).toThrow();
  });
  test('rejects copied or foreign grants, even with identical timestamp and count', () => {
    const first = createBackupReceiptAuthority();
    const second = createBackupReceiptAuthority();
    const receipt = first.issue(grant());
    second.issue(grant());
    expect(() => second.consume(meta(5), receipt)).toThrow();
    expect(() => first.consume(meta(5), { ...receipt })).toThrow();
    expect(first.consume(meta(5), receipt).changes).toBe(2);
  });
  test('new preparation supersedes previous grant even with same timestamp', () => {
    const authority = createBackupReceiptAuthority();
    const older = authority.issue(grant());
    const newer = authority.issue(grant());
    expect(() => authority.consume(meta(5), older)).toThrow();
    expect(authority.consume(meta(5), newer).changes).toBe(2);
  });
  test('restore or reset invalidation rejects previously issued grant', () => {
    const authority = createBackupReceiptAuthority();
    const receipt = authority.issue(grant());
    authority.invalidate();
    expect(() => authority.consume(meta(5), receipt)).toThrow();
    expect(authority.consume(meta(5), authority.issue(grant(2))).changes).toBe(3);
  });
  test('tampering or impossible counts fail closed', () => {
    const authority = createBackupReceiptAuthority();
    const receipt = authority.issue(grant());
    receipt.includedChanges = 1;
    expect(() => authority.consume(meta(5), receipt)).toThrow();
    expect(() => authority.consume(meta(2), authority.issue(grant()))).toThrow();
    expect(() => authority.consume(meta(5), authority.issue(grant(-1)))).toThrow();
  });
  test('failed durable metadata write never publishes and cannot replay the consumed grant', async () => {
    const authority = createBackupReceiptAuthority();
    const coordinator = createDurableMutationCoordinator();
    let current = meta(5);
    const receipt = authority.issue(grant());
    const record = () => coordinator.enqueue<SecureMeta>({
      getCommitted: () => current,
      derive: previous => authority.consume(previous, receipt),
      persist: async () => { throw new Error('synthetic write failure'); },
      publish: next => { current = next; }
    });
    await expect(record()).rejects.toThrow('synthetic write failure');
    expect(current).toEqual(meta(5));
    await expect(record()).rejects.toThrow();
    expect(current).toEqual(meta(5));
  });
  test('actual App serializes receipt and invalidates grants across destructive boundaries', async () => {
    const app = await Bun.file('src/App.tsx').text();
    const restore = app.slice(app.indexOf('const handleImportEncryptedBackup'), app.indexOf('// Factory Reset'));
    const reset = app.slice(app.indexOf('const handleFactoryReset'), app.indexOf('  return (', app.indexOf('const handleFactoryReset')));
    expect(app).toContain('backupReceiptAuthority.issue(prepareBackupCheckpoint(');
    expect(app).toContain('derive: current => backupReceiptAuthority.consume(current, checkpoint)');
    expect(restore.indexOf('backupReceiptAuthority.invalidate();')).toBeGreaterThanOrEqual(0);
    expect(restore.indexOf('backupReceiptAuthority.invalidate();')).toBeLessThan(restore.indexOf('await secureStorage.restoreSnapshotVerified'));
    expect(reset).toContain('await mutationCoordinator.enqueueTask(async () => {');
    expect(reset.indexOf('backupReceiptAuthority.invalidate();')).toBeLessThan(reset.indexOf('await onFactoryReset();'));
  });
});

describe('BACKUP-02/B1c historical copy evidence', () => {
  test('historical timestamps are not evidence, and invalid or mismatched markers fail closed', () => {
    expect(verifiedBackupDate({ changes: 0, lastBackup: at })).toBeNull();
    expect(verifiedBackupDate({ changes: 0, lastBackup: at, verifiedBackupAt: 'invalid' })).toBeNull();
    expect(verifiedBackupDate({ changes: 0, lastBackup: 'invalid', verifiedBackupAt: 'invalid' })).toBeNull();
    expect(verifiedBackupDate({ changes: 0, lastBackup: at, verifiedBackupAt: '2026-11-12T12:00:00.000Z' })).toBeNull();
  });
  test('only current authority sets local verification and later mutations preserve it', () => {
    const authority = createBackupReceiptAuthority();
    const verified = authority.consume(meta(5), authority.issue(grant()));
    expect(verifiedBackupDate(verified)).toBe(at);
    expect(verifiedBackupDate(incrementBackupChanges(verified))).toBe(at);
    expect(incrementBackupChanges(verified).changes).toBe(3);
    expect(withoutLocalBackupVerification(verified)).toEqual({ changes: 2, lastBackup: at });
    const prepared = prepareBackupCheckpoint({ meta: verified } as CompleteSecureAppSnapshot, at);
    expect(verifiedBackupDate(prepared.snapshot.meta)).toBeNull();
  });
  test('Home treats old timestamps and later mutations as not fully protected', async () => {
    const app = await Bun.file('src/App.tsx').text();
    const home = await Bun.file('src/components/HomeView.tsx').text();
    expect(app).toContain('verifiedBackupDate={verifiedBackupDate(meta)}');
    const policy = await Bun.file('src/persistence/backupReminderPolicy.ts').text();
    expect(home).toContain('describeBackupCopy(lastBackupDate, verifiedBackupDate, unsavedChangesCount)');
    expect(policy).toContain('if (changes > 0)');
    expect(policy).toContain('Verifica non attestata');
    expect(home).not.toContain('modifiche da salvare');
  });
});
