import type { BackupVerificationEvidence, CompleteSecureAppSnapshot, SecureMeta } from '../security/secureAppStorage';

export interface PreparedBackupCheckpoint {
  snapshot: CompleteSecureAppSnapshot;
  includedChanges: number;
  checkpointAt: string;
}

export type BackupReceipt = Pick<PreparedBackupCheckpoint, 'includedChanges' | 'checkpointAt'>;
export type AuthorizedBackupCheckpoint = PreparedBackupCheckpoint & { receipt: BackupReceipt };
export type ExpectedCopyEvidence = Omit<BackupVerificationEvidence, 'checkpointAt'>;

function validEvidence(value: unknown): value is ExpectedCopyEvidence {
  if (!value || typeof value !== 'object') return false;
  const e = value as Partial<ExpectedCopyEvidence>;
  return typeof e.bytes === 'number' && Number.isSafeInteger(e.bytes) && e.bytes > 0 && e.bytes <= 32 * 1024 * 1024
    && typeof e.sha256 === 'string' && /^[0-9a-f]{64}$/.test(e.sha256)
    && (e.source === 'android-readback' || e.source === 'web-readback') && e.payloadVersion === 6;
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
  let pending: { identity: BackupReceipt; value: BackupReceipt; evidence: ExpectedCopyEvidence | null } | null = null;
  return {
    issue(checkpoint: PreparedBackupCheckpoint): AuthorizedBackupCheckpoint {
      // Neither the identity nor the authority retains the plaintext snapshot.
      const receipt: BackupReceipt = { includedChanges: checkpoint.includedChanges, checkpointAt: checkpoint.checkpointAt };
      pending = { identity: receipt, value: { ...receipt }, evidence: null };
      return { ...checkpoint, receipt };
    },
    bindEvidence(receipt: BackupReceipt, evidence: ExpectedCopyEvidence): void {
      if (!pending || pending.identity !== receipt || pending.evidence !== null || !validEvidence(evidence)) {
        throw new Error('Evidenza della copia non valida o non più attuale.');
      }
      // Copy only the permitted fields; never retain extra caller properties.
      pending.evidence = { bytes: evidence.bytes, sha256: evidence.sha256, source: evidence.source, payloadVersion: evidence.payloadVersion };
    },
    invalidate(): void {
      pending = null;
    },
    consume(current: SecureMeta, receipt: BackupReceipt): SecureMeta {
      if (!pending || pending.identity !== receipt) {
        throw new Error('Ricevuta della copia non valida o non più attuale.');
      }
      const checkpoint = pending.value;
      const evidence = pending.evidence;
      pending = null;
      if (!evidence || receipt.includedChanges !== checkpoint.includedChanges || receipt.checkpointAt !== checkpoint.checkpointAt ||
          !Number.isSafeInteger(checkpoint.includedChanges) || checkpoint.includedChanges < 0 ||
          !Number.isSafeInteger(current.changes) || current.changes < checkpoint.includedChanges ||
          !Number.isFinite(Date.parse(checkpoint.checkpointAt))) {
        throw new Error('La ricevuta non corrisponde allo stato della copia.');
      }
      return {
        ...applyBackupReceipt(current, checkpoint),
        verifiedBackupAt: checkpoint.checkpointAt,
        verifiedBackupEvidence: { ...evidence, checkpointAt: checkpoint.checkpointAt }
      };
    }
  };
}

// Historical timestamps alone do not attest verified bytes. A restored archive
// must establish its own local evidence instead of inheriting another device's.
export function verifiedBackupDate(meta: SecureMeta): string | null {
  const at = meta.verifiedBackupAt;
  const evidence = meta.verifiedBackupEvidence;
  return typeof at === 'string' && at === meta.lastBackup && Number.isFinite(Date.parse(at))
    && evidence?.checkpointAt === at && validEvidence(evidence) ? at : null;
}

export function withoutLocalBackupVerification(meta: SecureMeta): SecureMeta {
  const { verifiedBackupAt: _localOnly, verifiedBackupEvidence: _localEvidence, ...portable } = meta;
  return portable;
}
