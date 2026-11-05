/**
 * HEADER-01 — Pure, evidence-based projection for the future save indicator.
 *
 * This is intentionally NOT wired to App.tsx or to the durable mutation
 * coordinator. It cannot attest a successful save until the caller supplies
 * the outcome of an actual successful durable write. Informational toasts
 * are deliberately absent from this input contract.
 */

export type HeaderSaveScope =
  | 'registro'
  | 'programmazione'
  | 'biblioteca'
  | 'impostazioni'
  | 'verifiche'
  | 'altro';

export interface HeaderDurableCommitEvidence {
  /** Nonempty ID of the actual persisted operation, not a UI notification. */
  operationId: string;
  scope: HeaderSaveScope;
  /** Must be set only after the storage promise has fulfilled. */
  durableConfirmed: boolean;
}

export interface HeaderDurableFailureEvidence {
  operationId: string;
  scope: HeaderSaveScope;
  /**
   * The owner of the durable lifecycle keeps this true until a verified
   * recovery; a new toast or unrelated successful write must not clear it.
   */
  unresolved: boolean;
}

export interface HeaderPersistenceEvidence {
  /** Number of actual durable writes in flight, not editing fields. */
  pendingWrites?: number;
  /** Only if a domain-specific editor confirms uncommitted changes. */
  verifiedUnsavedChanges?: boolean;
  confirmedCommit?: HeaderDurableCommitEvidence | null;
  unresolvedFailure?: HeaderDurableFailureEvidence | null;
}

export type HeaderSaveNotice =
  | { kind: 'unknown'; message: null; scope: null }
  | { kind: 'saving'; message: 'Salvataggio in corso'; scope: null }
  | { kind: 'unsaved'; message: 'Modifiche da salvare'; scope: null }
  | { kind: 'saved-local'; message: "Salvato nell'archivio locale"; scope: HeaderSaveScope }
  | { kind: 'error'; message: 'Salvataggio non riuscito'; scope: HeaderSaveScope };

/**
 * An unresolved error has priority over new writes and previous successes.
 * When pending writes exist, no stale "saved" confirmation can be shown.
 */
export function resolveHeaderSaveNotice(
  evidence: Readonly<HeaderPersistenceEvidence>,
): HeaderSaveNotice {
  const failure = evidence.unresolvedFailure;
  // A missing operation ID must never suppress a known unresolved failure.
  if (failure?.unresolved === true) {
    return {
      kind: 'error',
      message: 'Salvataggio non riuscito',
      scope: failure.scope,
    };
  }

  if (Number.isFinite(evidence.pendingWrites) && (evidence.pendingWrites ?? 0) > 0) {
    return {
      kind: 'saving',
      message: 'Salvataggio in corso',
      scope: null,
    };
  }

  if (evidence.verifiedUnsavedChanges === true) {
    return {
      kind: 'unsaved',
      message: 'Modifiche da salvare',
      scope: null,
    };
  }

  const commit = evidence.confirmedCommit;
  if (commit?.durableConfirmed === true && commit.operationId.trim()) {
    return {
      kind: 'saved-local',
      message: "Salvato nell'archivio locale",
      scope: commit.scope,
    };
  }

  return {
    kind: 'unknown',
    message: null,
    scope: null,
  };
}
