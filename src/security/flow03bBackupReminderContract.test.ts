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

  test('keeps explicit modal overrides and uses attention policy only by default', async () => {
    const app = await source('src/App.tsx');

    expect(app).toContain("import { shouldSuggestBackupReminder } from './persistence/backupReminderPolicy';");
    expect(app).toContain('showBackupModal === true');
    expect(app).toContain('showBackupModal === undefined');
    expect(app).toContain('shouldSuggestBackupReminder(previous.meta, candidate.meta)');
    expect(app).toContain('setIsBackupModalOpen(true)');
  });
});
