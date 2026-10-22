# PERSIST-01H — Mutation Contract Hardening Design

**Date:** 2026-10-22  
**Repository:** `antoniocorsano-boop/registro-docente`  
**Baseline under audit:** `70078d67dc1ae3ee49fbd975a7805cd112c9813d`  
**Parent program:** `PERSIST-01 — durable write semantics`  
**Status:** DESIGN DRAFT — awaiting human review  

## 1. Purpose

PERSIST-01H closes the remaining systemic integrity gaps discovered after PERSIST-01 introduced commit-first persistence, FIFO mutation ordering, committed-state refs and atomic `appData + meta` storage.

The read-only audit showed that the Vault/FIFO core is materially stronger than several UI mutation surfaces. The remaining failures are not independent defects: the durable mutation contract is not propagated uniformly from the Secure Local Vault up to teacher-facing controls, and backup/restore semantics are not yet governed as one coherent snapshot protocol.

The target property is:

> Every user-visible mutation has one uniform end-to-end contract from intent to durable commit: no success before persistence, no destructive UI transition on failure, no duplicate effect from a repeated pending action, no stale-state overwrite, and no backup receipt that overstates what was actually exported.

PERSIST-01H is a hardening extension of PERSIST-01, not a new product feature.

## 2. Evidence and current gate

The exact audited head is `70078d67dc1ae3ee49fbd975a7805cd112c9813d`.

PREDEPLOY #139 / run `39809329706` is PASS on that head. The following independent Codex review completed with four unresolved findings:

1. P1 — export can mark an older snapshot as current while a save was pending;
2. P1 — evaluation submission can be invoked twice while persistence is pending;
3. P2 — settings can report success before durable persistence resolves;
4. P2 — student add/import can clear input or report success before persistence resolves.

The systematic audit identified additional instances of the same root causes:

- durable callbacks that still terminate as `void` at the component boundary;
- action controls without reentrancy guards;
- backup change tracking that advances for `appData` but not uniformly for settings, UDA, tests and submissions;
- encrypted export built from render-time React data instead of an explicit committed checkpoint;
- full restore using sequential record writes rather than the available atomic multi-record Vault primitive;
- repeated submissions-to-register import not idempotent;
- StudentPortal result/confetti shown before submission persistence, explicitly remaining ONLINE-01.

The audit conclusion is therefore **systemic hardening required**, not a sequence of unrelated patches.

## 3. Scope

PERSIST-01H governs these existing mutation surfaces:

- class creation/deletion;
- evaluation create/edit/delete;
- behavior save;
- student add/remove/bulk import/name inversion;
- settings save and theme persistence;
- UDA create/edit/delete/dependency/lesson mutations;
- custom test create/edit/import;
- submission append/delete at the application persistence boundary;
- submission-to-register import;
- encrypted backup checkpoint/export receipt;
- encrypted restore orchestration.

It also governs the common contracts required by those paths:

- Promise propagation to invoking UI;
- local in-flight/reentrancy state;
- global backup-change accounting;
- serialized checkpoint/exclusive tasks;
- full-snapshot atomic persistence.

### Out of scope

The following remain separate:

- StudentPortal class-selection redesign;
- StudentPortal result/confetti timing and wording; these remain ONLINE-01;
- cloud sync, remote backups or background retry;
- AES-GCM/PBKDF2/key hierarchy changes;
- new IndexedDB stores or database-version migrations;
- curriculum, analytics or grading-formula changes;
- broad UI redesign unrelated to mutation truthfulness;
- deployment or release promotion.

## 4. Architectural decision

Use **one shared mutation contract with domain-specific adapters**.

The contract has four layers:

1. **Intent layer** — one accepted user action enters a local pending state.
2. **Application coordination layer** — FIFO execution reads latest committed state and derives the candidate at execution time.
3. **Vault layer** — all records belonging to one logical commit are persisted atomically with `putMany`.
4. **UI completion layer** — success message, input clearing, modal/editor closing and post-save navigation occur only after the returned Promise resolves.

Queue ordering and UI reentrancy are both required: FIFO prevents storage interleaving; it does not make two accepted clicks the same user intent.

## 5. Canonical mutation lifecycle

Every governed action follows:

1. validate local input;
2. reject/ignore reentrant submission of the same pending action;
3. set local pending state;
4. call a Promise-returning durable callback;
5. when its FIFO turn begins, read latest committed domain state and `meta`;
6. derive domain candidate and backup-ledger candidate;
7. persist the logical commit atomically;
8. publish committed refs and React state;
9. run success-only UI effects;
10. clear pending state in `finally`.

On failure:

- publish none of the candidate state;
- show no normal success;
- keep retry-relevant component draft intact;
- clear pending state;
- allow later FIFO work to continue.

Browser `prompt()` values are not resumable component drafts; class creation therefore remains allowed to require re-entry after an explicit persistence failure. It must still never show success or navigate as if committed before durable completion.

## 6. Promise contract at component boundaries

Any durable callback whose child can clear input, close an editor/modal, navigate, display success or repeat the same action must return a Promise representing durable completion.

Expected shapes include:

```ts
onSaveEvaluations(data): Promise<void>
onSaveBehaviors(records): Promise<void>
onAddStudent(name): Promise<void>
onRemoveStudent(id): Promise<void>
onBulkAddStudents(students): Promise<void>
onInvertNames(): Promise<void>
onUpdateSettings(intent): Promise<void>
onDeleteSubmission(id): Promise<void>
onImportSubmissionsToRegister(udaId?): Promise<void>
```

For consistency, governed deletion actions also return Promises even when their logical operation is naturally idempotent.

## 7. In-flight and reentrancy contract

Pending state is owned by the component/view that owns the user control; PERSIST-01H does not introduce a global spinner framework.

While an action is pending:

- its submit/action control is disabled;
- repeated keyboard submit is ignored;
- a second intent that depends on the same mutable draft is not accepted;
- draft fields may remain readable;
- fields that would make the pending intent ambiguous are disabled;
- failure restores retry capability without clearing the draft.

Prefer one minimal pending boundary per view or form rather than many unrelated flags. Examples: `isSavingEvaluation`, `isSavingBehavior`, `isStudentMutationPending`, `isSavingSettings`, `isSavingTest`, `isSavingUda`.

## 8. Domain rules

### 8.1 Classes

Create/delete remain commit-first.

- success/navigation only after durable commit;
- Home controls cannot invoke the same class mutation repeatedly while it is pending;
- class creation may use the existing browser prompt; on failure the teacher may need to re-enter the name, but the class is never falsely displayed as committed.

### 8.2 Evaluations

- `handleSaveEvaluations` returns the durable Promise;
- `EvaluationsView` owns a save-pending guard;
- one accepted new-evaluation intent has one stable `batchId`;
- `editingBatchId` clears only after success;
- navigation to history remains post-commit and navigation-version guarded.

### 8.3 Behaviors

- callback returns a Promise;
- save is disabled while pending;
- date/status draft remains intact on failure;
- dashboard navigation remains post-commit and navigation-version guarded.

### 8.4 Students

Single add:

- keep the typed name until durable success;
- disable submit while pending;
- clear only after resolved commit.

Bulk import:

- parsing and durable saving are separate phases;
- success message and file-input clearing happen only after durable success;
- persistence failure is not reported as parser failure.

Name inversion:

- one click equals one inversion intent;
- callback returns a Promise and the action is disabled while pending.

Delete:

- row action is disabled while its durable removal is pending.

### 8.5 Settings

Settings mutations derive against latest committed settings rather than blindly replacing committed state with a stale full snapshot.

Explicit form save:

- returns a Promise;
- shows success only after commit;
- preserves form data on failure.

Theme selection uses **immediate theme-only persistence**:

- selecting a theme updates the local form theme;
- the durable mutation is a patch against latest committed settings affecting only `theme`;
- unrelated unsaved form fields are never committed merely because a theme button was pressed;
- the theme control is guarded while its persistence is pending.

This preserves the existing immediate-theme behavior without leaking unrelated draft settings into the Vault.

### 8.6 UDA

Retain `createUdaSnapshotMutation` and its record/array delta-rebase semantics.

All mutating UDA actions share a pending boundary while a durable UDA save is in flight. Success/reset/close/detail updates remain post-commit only.

### 8.7 Custom tests

Retain the Promise-aware save contract already introduced by PERSIST-01.

Add a pending guard for:

- interactive editor save;
- manual text test creation;
- DOCX/ZIP parsed-test save.

A new test ID is created once per accepted intent; repeated submit while pending does not create a second test.

### 8.8 Submission append/delete

Both use the existing committed submissions ref and FIFO coordinator.

- append/delete participate in global backup-ledger accounting;
- delete returns a Promise to the invoking teacher UI;
- StudentPortal may continue to misuse the append Promise until ONLINE-01, but PERSIST-01H must keep the persistence boundary truthful and Promise-returning.

### 8.9 Submission-to-register import

Import becomes idempotent without schema changes.

Derive a deterministic grade batch identity from the existing submission ID:

```ts
batchId = `online_${submission.id}`
```

For each matched submission/student pair, reconcile/replace any existing grade with that deterministic batch ID instead of appending a fresh `uid()` batch.

Therefore:

- repeated import cannot duplicate the same submission grade;
- retry after an interrupted UI flow is safe;
- existing `Grade` shape and stored schema remain unchanged.

## 9. Global backup ledger

### 9.1 Rule

Every governed persisted domain mutation advances `meta.changes` in the **same atomic logical commit** as its data record.

This applies to:

- `appData`;
- settings;
- UDA;
- custom tests;
- submissions.

For ordinary data mutation:

```ts
nextMeta = {
  ...currentMeta,
  changes: currentMeta.changes + 1
}
```

### 9.2 Metadata-only exceptions

The following do **not** increment `changes`:

- writing the backup receipt itself;
- navigation-only state;
- Privacy Shield UI state;
- auto-lock preference outside the secure snapshot;
- full restore, which installs the metadata represented by the restored snapshot;
- factory reset, which clears the Vault entirely.

### 9.3 Storage API

`SecureAppStorage` exposes type-safe domain+meta operations, or type-safe public methods backed by one internal generic helper. React components never call `vault.putMany` directly.

No record key or persisted schema changes are required.

## 10. Serialized task/checkpoint primitive

Extend `durableMutationCoordinator` with a minimal serialized task primitive, conceptually:

```ts
enqueueTask<T>(task: () => Promise<T> | T): Promise<T>
```

Required semantics:

- task runs after all previously queued mutations settle;
- later work waits until the task returns;
- rejection does not poison later work;
- task may read a coherent set of committed refs.

A bare `whenIdle()` is explicitly rejected because it permits a time-of-check/time-of-use race between idle resolution and snapshot capture.

## 11. Backup checkpoint protocol

### 11.1 Prepare checkpoint

App prepares the backup checkpoint inside `enqueueTask` and returns an immutable/deep-cloned object containing:

- all committed domains;
- `includedChanges` = current local `meta.changes`;
- `checkpointAt` timestamp.

The **snapshot embedded in the backup file is self-consistent** and uses:

```ts
meta: {
  changes: 0,
  lastBackup: checkpointAt
}
```

This means a later restore of that file correctly represents “this state is exactly the state of this backup” rather than reviving a pre-export outstanding-change count.

The live local `meta` is not changed merely by preparing the checkpoint.

### 11.2 Encrypt/download

`PrivacyView` encrypts and initiates download from the prepared checkpoint, not from render-time `backupSnapshot` props.

The existing `backupSnapshot` prop should therefore no longer be authoritative for export; it may be removed if unused elsewhere.

### 11.3 Mark successful export

Only after encryption and download initiation succeed, App writes the local backup receipt through the coordinator:

```ts
changes = Math.max(0, currentMeta.changes - checkpoint.includedChanges)
lastBackup = checkpoint.checkpointAt
```

This receipt mutation is metadata-only and does not increment `changes`.

If later data mutations committed after checkpoint capture, they increased `currentMeta.changes`; subtracting only `includedChanges` leaves those later changes outstanding.

If encryption/download preparation fails, the live metadata is unchanged.

## 12. Full restore protocol

Restore executes as one serialized application task:

1. wait behind all previously queued application mutations;
2. normalize/sanitize the candidate backup against current complete state;
3. write the complete candidate snapshot atomically;
4. read it back and verify equivalence;
5. only then publish all committed refs and React domains;
6. reset navigation to Home and show success;
7. allow later queued mutations to continue.

`SecureAppStorage.restoreSnapshotVerified` must persist all six records through **one atomic `vault.putMany` transaction**:

- `appData`;
- settings;
- UDA;
- custom tests;
- submissions;
- meta.

If readback verification fails after an apparently successful atomic write, restore the previous complete snapshot through the same atomic full-snapshot primitive and verify rollback.

Failure publishes none of the candidate restored state.

## 13. Factory reset

Current reset semantics remain valid: `SecureVault.clearAll()` locks immediately and is serialized against Vault mutations; `SecureRegistroRoot` then returns to `SETUP_REQUIRED`.

PERSIST-01H does not redesign reset.

## 14. StudentPortal boundary

PERSIST-01H does not absorb ONLINE-01.

The submission callback remains Promise-returning so ONLINE-01 can later make the student-facing result truthful. These remain explicitly open after PERSIST-01H:

- hard-coded class selector;
- transition to result/confetti before persistence resolves;
- success wording before durable submission confirmation.

They must not be accidentally marked closed by PERSIST-01H qualification.

## 15. Required invariants

PERSIST-01H is acceptable only if all hold:

1. **Promise-to-UI** — governed success/destructive UI can observe durable completion.
2. **Single-intent** — one accepted pending action produces at most one logical mutation.
3. **Draft-preservation** — component-owned retry-relevant draft survives persistence failure.
4. **No-false-success** — success/navigation occurs only after durable success.
5. **Latest-committed** — queued derivation reads latest committed state at execution time.
6. **FIFO/failure-isolation** — one failure neither reorders nor poisons later work.
7. **Global-backup-ledger** — every governed data-domain commit advances backup tracking atomically with its data.
8. **Checkpoint-truth** — exported payload and receipt refer to the same committed checkpoint.
9. **Post-checkpoint preservation** — later committed changes remain outstanding after receipt.
10. **Backup-self-consistency** — exported snapshot metadata describes the exported snapshot itself (`changes=0`, `lastBackup=checkpointAt`).
11. **Atomic-restore** — full restore writes all snapshot records or none in one Vault transaction.
12. **Restore-isolation** — restore cannot interleave with ordinary application mutations.
13. **Import-idempotency** — re-importing one online submission does not duplicate its grade.
14. **Navigation-preservation** — post-commit callbacks cannot override newer navigation.
15. **Vault-format** — record keys, encryption format, DB version and key hierarchy remain unchanged.
16. **ONLINE-01 separation** — StudentPortal product gaps remain explicitly open unless separately implemented.

## 16. TDD strategy

Implementation remains RED → GREEN. The audit matrix becomes the test matrix rather than waiting for review to discover another instance.

Required RED cases include:

- evaluation double-submit while first save is pending;
- behavior repeat save while pending;
- single-student name retained on persistence failure;
- bulk import does not report success or clear file before durable success;
- name inversion cannot be invoked twice while pending;
- settings failure does not show success;
- theme change persists only the theme field, not unrelated form draft;
- UDA creation cannot duplicate from repeated pending submit;
- interactive/manual/imported test creation cannot duplicate while pending;
- repeated submissions-to-register import yields one deterministic batch per submission;
- settings/UDA/tests/submissions each increment `meta.changes` atomically with their domain record;
- backup checkpoint waits behind a pending mutation;
- backup file metadata is self-consistent;
- mutation committed after checkpoint remains outstanding after receipt;
- full restore uses one atomic multi-record persistence operation;
- restore waits behind prior mutation and blocks later mutation until complete.

Existing PERSIST-01 regression tests remain mandatory, including:

- FIFO coordinator semantics;
- failure isolation;
- lock recheck for queued Vault writes/deletes;
- appData+meta atomic commit;
- UDA stale-snapshot and array-delta rebasing;
- Home/navigation preservation;
- test editor await semantics.

## 17. Browser verification

After engineering GREEN, run a focused browser failure-injection pass only for behaviors that source/unit tests cannot establish sufficiently:

- evaluation submit pending/failure;
- student add/import pending/failure;
- settings save pending/failure;
- backup export while an earlier write is delayed;
- restore success/failure transition.

This is not a broad product UX review.

## 18. Expected implementation surface

Expected files, subject to the implementation plan:

- `src/persistence/durableMutationCoordinator.ts`;
- `src/security/secureAppStorage.ts`;
- `src/App.tsx`;
- `src/components/HomeView.tsx`;
- `src/components/EvaluationsView.tsx`;
- `src/components/BehaviorsView.tsx`;
- `src/components/StudentsManagementView.tsx`;
- `src/components/SettingsView.tsx`;
- `src/components/UdaGanttView.tsx`;
- `src/components/VerificheOnlineView.tsx`;
- `src/components/PrivacyView.tsx`;
- focused tests under `src/security/` and/or `src/persistence/`.

`StudentPortal.tsx` is not a behavioral implementation target for PERSIST-01H except for any type compatibility required by the unchanged Promise boundary.

## 19. Migration and compatibility

No IndexedDB migration or persisted record-schema migration is required.

The design reuses:

- existing record keys;
- existing `SecureMeta { changes, lastBackup }` shape;
- existing submission IDs for deterministic imported batch identity;
- existing encrypted backup payload shape;
- existing Vault crypto primitives.

Existing encrypted backups remain readable.

## 20. Rollback and branch isolation

PERSIST-01H is structurally reversible because it introduces no storage migration or format change.

PR #18 remains frozen on the audited head while this design is reviewed. This spec is kept on the separate branch `docs/persist-01h-mutation-contract-hardening`, branched from `70078d67dc1ae3ee49fbd975a7805cd112c9813d`.

Implementation must use a separate implementation branch derived from the approved baseline. No merge or deploy is authorized by this design.

## 21. Stop rules

Stop and require a separate decision if implementation would require:

- a new persisted metadata schema/version;
- background retry or autosave subsystem;
- distributed/cross-device locking;
- cloud backup or sync;
- StudentPortal redesign;
- cryptographic/key-management changes;
- broad UI redesign unrelated to pending/failure truthfulness.

## 22. Completion criteria

PERSIST-01H is engineering-qualified when:

- all 16 invariants have direct test or execution evidence;
- the four current unresolved Codex findings are resolved through the systemic contract, not ad hoc bypasses;
- all additional audit gaps in scope are closed or disproved with evidence;
- submission import is idempotent;
- backup ledger covers every governed persisted domain;
- backup export uses a serialized committed checkpoint, produces self-consistent backup metadata and preserves post-checkpoint changes;
- restore is application-serialized and atomically persisted as one complete snapshot;
- no governed teacher-facing success/destructive transition precedes durable completion;
- full PREDEPLOY passes on the exact final head;
- focused browser failure-injection passes where required;
- final independent Codex review has zero unresolved significant findings;
- ONLINE-01 remains separately tracked;
- no merge or deploy occurs without a separate decision.
