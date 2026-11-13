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

/** In-memory, archive-session-scoped authority. Never serialize grants into backups.
 * A newer preparation supersedes an older one, even if wall-clock times coincide.
 * Consume before persistence: an uncertain write requires a fresh export, not replay.
 */
export function createBackupReceiptAuthority() {
  type Receipt = Pick<PreparedBackupCheckpoint, 'includedChanges' | 'checkpointAt'>;
  let pending: { identity: Receipt; value: Receipt } | null = null;
  return {
    issue(checkpoint: PreparedBackupCheckpoint): PreparedBackupCheckpoint {
      pending = {
        identity: checkpoint,
        value: { includedChanges: checkpoint.includedChanges, checkpointAt: checkpoint.checkpointAt }
      };
      return checkpoint;
    },
    invalidate(): void {
      pending = null;
    },
    consume(current: SecureMeta, receipt: Receipt): SecureMeta {
      if (!pending || pending.identity !== receipt) {
        throw new Error('Ricevuta della copia non valida o non più attuale.');
      }
      const checkpoint = pending.value;
      pending = null;
      if (receipt.includedChanges !== checkpoint.includedChanges || receipt.checkpointAt !== checkpoint.checkpointAt ||
          !Number.isSafeInteger(checkpoint.includedChanges) || checkpoint.includedChanges < 0 ||
          !Number.isSafeInteger(current.changes) || current.changes < checkpoint.includedChanges ||
          !Number.isFinite(Date.parse(checkpoint.checkpointAt))) {
        throw new Error('La ricevuta non corrisponde allo stato della copia.');
      }
      return { ...applyBackupReceipt(current, checkpoint), verifiedBackupAt: checkpoint.checkpointAt };
    }
  };
}

// Historical timestamps alone do not attest verified bytes. A restored archive
// must establish its own local evidence instead of inheriting another device's.
export function verifiedBackupDate(meta: SecureMeta): string | null {
  const at = meta.verifiedBackupAt;
  return typeof at === 'string' && at === meta.lastBackup && Number.isFinite(Date.parse(at)) ? at : null;
}

export function withoutLocalBackupVerification(meta: SecureMeta): SecureMeta {
  const { verifiedBackupAt: _localOnly, ...portable } = meta;
  return portable;
}
