import type { CompleteSecureAppSnapshot, SecureMeta } from '../security/secureAppStorage';

export interface PreparedBackupCheckpoint {
  snapshot: CompleteSecureAppSnapshot;
  includedChanges: number;
  checkpointAt: string;
}

function cloneSnapshot(snapshot: CompleteSecureAppSnapshot): CompleteSecureAppSnapshot {
  return structuredClone(snapshot);
}

export function incrementBackupChanges(meta: SecureMeta): SecureMeta {
  return {
    ...meta,
    changes: meta.changes + 1
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
  return {
    changes: Math.max(0, current.changes - checkpoint.includedChanges),
    lastBackup: checkpoint.checkpointAt
  };
}
