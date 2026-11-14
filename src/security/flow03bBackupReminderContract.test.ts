import { describe, expect, test } from 'bun:test';

async function source(path: string) {
  return Bun.file(path).text();
}

describe('FLOW-03B backup reminder contract', () => {
  test('suggests backup only when a durable-change checkpoint is crossed', async () => {
    const policyModule = await import('../persistence/backupReminderPolicy').catch(() => null);

    expect(policyModule).not.toBeNull();
    if (!policyModule) return;

    const { shouldSuggestBackupReminder } = policyModule;
    expect(typeof shouldSuggestBackupReminder).toBe('function');

    expect(shouldSuggestBackupReminder(
      { changes: 9, lastBackup: null },
      { changes: 10, lastBackup: null }
    )).toBe(true);
    expect(shouldSuggestBackupReminder(
      { changes: 10, lastBackup: null },
      { changes: 11, lastBackup: null }
    )).toBe(false);
    expect(shouldSuggestBackupReminder(
      { changes: 19, lastBackup: '2026-11-01T08:00:00.000Z' },
      { changes: 20, lastBackup: '2026-11-01T08:00:00.000Z' }
    )).toBe(true);
    expect(shouldSuggestBackupReminder(
      { changes: 0, lastBackup: '2026-11-03T08:00:00.000Z' },
      { changes: 1, lastBackup: '2026-11-03T08:00:00.000Z' }
    )).toBe(false);
  });

  test('durable saves never open backup maintenance, including at the former attention threshold', async () => {
    const app = await source('src/App.tsx');
    const commit = app.slice(app.indexOf('const commitAppDataMutation'), app.indexOf('const commitSettingsMutation'));
    expect(commit).toContain('incrementBackupChanges');
    expect(commit).toContain('afterCommit?.();');
    expect(commit).not.toContain('shouldSuggestBackupReminder');
    expect(app).not.toContain('setIsBackupModalOpen');
    expect(app).not.toContain('<BackupReminderModal');
  });
  test('copy status is truthful even below ten changes and for historical or invalid metadata', async () => {
    const { describeBackupCopy } = await import('../persistence/backupReminderPolicy');
    const at = '2026-11-13T12:00:00.000Z';
    expect(describeBackupCopy(at, null, 0).kind).toBe('unverified');
    expect(describeBackupCopy(null, null, 0).kind).toBe('unverified');
    expect(describeBackupCopy('invalid', 'invalid', 0).kind).toBe('unverified');
    expect(describeBackupCopy(at, at, 0).kind).toBe('current');
    expect(describeBackupCopy(at, at, 1)).toEqual({ kind: 'outdated', label: 'Copia da aggiornare', detail: '1 modifica da includere' });
    expect(describeBackupCopy(at, at, 10).detail).toBe('10 modifiche da includere');
    expect(describeBackupCopy(at, at, NaN).kind).toBe('outdated');
    expect(describeBackupCopy(at, at, -1).kind).toBe('outdated');
  });
  test('only one quiet Home indicator routes to Privacy, outside operational views', async () => {
    const home = await source('src/components/HomeView.tsx');
    const app = await source('src/App.tsx');
    expect(home.match(/data-testid="backup-copy-indicator"/g)?.length).toBe(1);
    expect(home).toContain('onClick={onExportBackup}');
    expect(home).toContain('aria-label="Esporta backup cifrato"');
    expect(app).toContain("const handleExportBackup = () => {\n    setActiveTab('privacy');");
    expect(app.match(/<HomeView\b/g)?.length).toBe(1);
  });
});
