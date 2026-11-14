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

// Status is independent of the historical attention threshold: even one
// committed change means the last verified copy is not current.
export function describeBackupCopy(
  lastBackup: string | null,
  verifiedBackup: string | null | undefined,
  changes: number
): { kind: 'unverified' | 'outdated' | 'current'; label: string; detail: string | null } {
  const historical = typeof lastBackup === 'string' && Number.isFinite(Date.parse(lastBackup)) ? lastBackup : null;
  const verified = historical !== null && historical === verifiedBackup;
  const date = historical ? new Date(historical).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : null;
  if (!verified) return {
    kind: 'unverified', label: 'Copia di sicurezza da verificare',
    detail: date ? 'Copia precedente: ' + date + ' · Verifica non attestata' : null
  };
  if (!Number.isSafeInteger(changes) || changes < 0) return {
    kind: 'outdated', label: 'Copia da aggiornare', detail: 'Numero di modifiche non disponibile'
  };
  if (changes > 0) return {
    kind: 'outdated', label: 'Copia da aggiornare',
    detail: changes === 1 ? '1 modifica da includere' : changes + ' modifiche da includere'
  };
  return { kind: 'current', label: 'Copia verificata', detail: date };
}
