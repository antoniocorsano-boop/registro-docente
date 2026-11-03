import type { SecureMeta } from '../security/secureAppStorage';

export const BACKUP_REMINDER_INTERVAL = 10;

function normalizedChanges(meta: SecureMeta): number {
  return Number.isFinite(meta.changes) ? Math.max(0, Math.trunc(meta.changes)) : 0;
}

export function shouldSuggestBackupReminder(previous: SecureMeta, next: SecureMeta): boolean {
  const previousChanges = normalizedChanges(previous);
  const nextChanges = normalizedChanges(next);

  if (nextChanges <= previousChanges || nextChanges < BACKUP_REMINDER_INTERVAL) return false;

  return Math.floor(previousChanges / BACKUP_REMINDER_INTERVAL)
    < Math.floor(nextChanges / BACKUP_REMINDER_INTERVAL);
}
