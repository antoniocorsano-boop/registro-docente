import type { CompleteSecureAppSnapshot, SecureMeta } from '../security/secureAppStorage';

export interface PreparedBackupCheckpoint {
  snapshot: CompleteSecureAppSnapshot;
  includedChanges: number;
  checkpointAt: string;
}

function cloneSnapshot(snapshot: CompleteSecureAppSnapshot): CompleteSecureAppSnapshot {
  return structuredClone(snapshot);
}

function normalizeBackupChanges(changes: unknown): number {
  return typeof changes === 'number' && Number.isFinite(changes)
    ? Math.max(0, changes)
    : 0;
}

export function incrementBackupChanges(meta: SecureMeta): SecureMeta {
  return {
    ...meta,
    changes: normalizeBackupChanges(meta.changes) + 1
  };
}

export function prepareBackupCheckpoint(
  snapshot: CompleteSecureAppSnapshot,
  checkpointAt: string
): PreparedBackupCheckpoint {
  const cloned = cloneSnapshot(snapshot);
  return {
    snapshot: {
      ...cloned,
      meta: {
        changes: 0,
        lastBackup: checkpointAt
      }
    },
    includedChanges: snapshot.meta.changes,
    checkpointAt
  };
}

export function applyBackupReceipt(
  current: SecureMeta,
  checkpoint: Pick<PreparedBackupCheckpoint, 'includedChanges' | 'checkpointAt'>
): SecureMeta {
  const currentChanges = normalizeBackupChanges(current.changes);
  const includedChanges = normalizeBackupChanges(checkpoint.includedChanges);

  return {
    changes: Math.max(0, currentChanges - includedChanges),
    lastBackup: checkpoint.checkpointAt
  };
}
