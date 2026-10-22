# PERSIST-01H — Mutation Contract Hardening Design

**Date:** 2026-10-22  
**Repository:** `antoniocorsano-boop/registro-docente`  
**Baseline under audit:** `70078d67dc1ae3ee49fbd975a7805cd112c9813d`  
**Parent program:** `PERSIST-01 — durable write semantics`  
**Status:** DESIGN DRAFT — awaiting human review  

## 1. Purpose

PERSIST-01H closes the remaining systemic integrity gaps discovered after PERSIST-01 introduced commit-first persistence, FIFO mutation ordering, committed-state refs and atomic `appData + meta` storage.

The follow-up audit showed that the storage core is materially stronger than several UI mutation surfaces. The remaining failures are not independent defects: they arise because the durable mutation contract is not propagated uniformly from the Secure Local Vault up to the teacher-facing controls and because backup/restore semantics are not yet treated as one coherent snapshot protocol.

The target property is:

> Every user-visible mutation must have one uniform end-to-end contract from intent to durable commit: no success before persistence, no destructive UI transition on failure, no duplicate effect from repeated submission, no stale-state overwrite, and no backup receipt that overstates what was actually exported.

PERSIST-01H is a hardening extension of PERSIST-01, not a new product feature.

## 2. Evidence that motivates this design

The exact audited head is `70078d67dc1ae3ee49fbd975a7805cd112c9813d`.

PREDEPLOY #139 / run `39809329706` is PASS on that head, while the subsequent independent Codex review completed with four unresolved findings:

1. P1 — export may mark an older snapshot as current while a save was pending;
2. P1 — evaluation submission can be invoked twice while persistence is pending;
3. P2 — settings can report success before durable persistence resolves;
4. P2 — student add/import can clear input or report success before persistence resolves.

A read-only systematic audit then identified additional instances of the same underlying classes of risk:

- mutation callbacks that still terminate as `void`, preventing the view from awaiting durable completion;
- submit/action controls without reentrancy guards;
- backup change tracking that advances for `appData` mutations but not uniformly for settings, UDA, custom tests and submissions;
- encrypted export built from the current React snapshot instead of an explicit committed checkpoint;
- full restore using sequential record writes rather than the already available atomic multi-record Vault primitive;
- repeated submissions-to-register import not idempotent;
- StudentPortal success shown before submission persistence, intentionally still assigned to ONLINE-01.

The audit conclusion is that the central Vault/FIFO architecture remains valid; the missing layer is a uniform application mutation contract and coherent snapshot protocol.

## 3. Scope

PERSIST-01H governs the teacher-facing mutation surfaces already routed through PERSIST-01:

- class creation/deletion;
- evaluation create/edit/delete;
- behavior save;
- student add/remove/bulk import/name inversion;
- settings save and theme persistence;
- UDA create/edit/delete/dependency/lesson mutations;
- custom test create/edit/import;
- submission delete;
- submission-to-register import;
- encrypted backup checkpoint/export receipt;
- encrypted restore orchestration.

It also governs the common application contracts required by those paths:

- Promise propagation to the invoking UI;
- in-flight/reentrancy state;
- global backup-change accounting;
- mutation queue checkpoint/exclusive execution;
- full-snapshot atomic persistence.

### Out of scope

The following remain outside PERSIST-01H:

- StudentPortal class-selection redesign;
- StudentPortal result/confetti timing and wording beyond preserving the existing async callback boundary; those remain ONLINE-01;
- cloud sync, remote backups or background retry;
- changes to AES-GCM/PBKDF2/key hierarchy;
- new IndexedDB stores or version migrations;
- changes to curriculum, analytics or grading formulas;
- product redesign unrelated to mutation integrity;
- deployment or release promotion.

## 4. Architectural decision

The selected approach is **one shared mutation contract with domain-specific adapters**, not a sequence of local fixes.

The contract has four layers:

1. **Intent layer** — the component creates one user intent and enters a local pending state before invoking persistence.
2. **Application coordination layer** — the mutation is serialized, derives from the latest committed state and carries global backup metadata with it.
3. **Vault layer** — all records belonging to one logical commit are written atomically with `putMany`.
4. **UI completion layer** — success-only UI, input clearing, editor closing, navigation and success messages happen only after the returned Promise resolves.

This design preserves commit-first semantics and removes the remaining ambiguity between “button clicked”, “operation queued”, “Vault committed” and “UI may declare success”.

## 5. Canonical mutation lifecycle

Every governed mutating action follows this sequence:

1. validate local input;
2. reject or ignore reentrant submission of the same in-flight action;
3. set local `isSaving` / pending marker;
4. call a Promise-returning mutation callback;
5. when its FIFO turn begins, read the latest committed domain state;
6. derive the candidate from that committed state;
7. derive the next global backup metadata in the same logical commit;
8. persist all records belonging to the logical commit atomically;
9. publish committed refs and React state;
10. run success-only navigation/toast/reset behavior;
11. clear local pending state in `finally`.

Failure lifecycle:

1. persistence rejects;
2. no candidate is published;
3. no success-only UI executes;
4. draft/input remains available where retry is meaningful;
5. local pending state is cleared;
6. later FIFO mutations remain usable.

## 6. Promise contract at component boundaries

### 6.1 Rule

Any callback that causes durable mutation and whose invoking component can clear input, navigate, close an editor, display success or allow repeated invocation must return a Promise representing durable completion.

The child component must await that Promise before success-only effects.

### 6.2 Expected callback shape

Examples:

```ts
onSaveEvaluations(data): Promise<void>
onSaveBehaviors(records): Promise<void>
onAddStudent(name): Promise<void>
onBulkAddStudents(students): Promise<void>
onInvertNames(): Promise<void>
onUpdateSettings(settings): Promise<void>
onDeleteSubmission(id): Promise<void>
onImportSubmissionsToRegister(udaId?): Promise<void>
```

Delete callbacks may remain fire-and-forget only when the child performs no success/destructive local state transition and repeated invocation is impossible after committed publication. For consistency, PERSIST-01H prefers Promise-returning mutation callbacks throughout the governed surfaces.

## 7. In-flight and reentrancy contract

### 7.1 Local ownership

The component that owns the user control owns the pending UI state for that action. PERSIST-01H does not introduce a global spinner or generic loading framework.

### 7.2 Required behavior

While a mutation is pending:

- the same submit/action control is disabled;
- repeated keyboard submit is ignored;
- a second logical intent requiring the same mutable draft is not accepted;
- fields may remain readable;
- fields that would create ambiguity for the pending intent should be disabled until settlement;
- failure restores the ability to retry without destroying the draft.

### 7.3 Why a local guard is still required with FIFO

FIFO serialization prevents storage interleaving but does not make repeated user intent idempotent. Two clicks can enqueue two valid operations. Therefore queue ordering and UI reentrancy protection solve different problems and both are required.

## 8. Domain rules

### 8.1 Evaluations

- `handleSaveEvaluations` returns the durable Promise.
- `EvaluationsView` owns `isSaving` and disables the submit control while pending.
- for a new evaluation, the batch identity is stable for the in-flight intent;
- `editingBatchId` is cleared only after success;
- navigation to history remains navigation-version guarded after commit.

### 8.2 Behaviors

- save callback returns a Promise;
- save control is disabled while pending;
- the editable date/status draft is not discarded on failure;
- dashboard navigation remains post-commit and navigation-version guarded.

### 8.3 Students

Single add:

- do not clear the name field before durable success;
- disable submit while pending;
- clear only after resolved commit.

Bulk import:

- parsing and durable save are separate states;
- do not show “import completed” until the durable callback resolves;
- do not clear the file input until durable success;
- persistence failure is not reported as parser failure.

Name inversion:

- return a Promise and disable the action while pending;
- one click equals one inversion intent.

Delete:

- repeated delete remains logically idempotent, but the row action should not be reinvoked while its commit is pending.

### 8.4 Settings

Settings use a mutation intent derived against latest committed settings rather than blindly replacing committed state with an arbitrary stale full candidate.

Explicit form save:

- returns a Promise;
- success message appears only after durable completion;
- form remains available on failure.

Theme change:

- must not persist unrelated unsaved form fields merely because the teacher selected a theme;
- either persist a theme-only patch against latest committed settings or keep theme as local preview until explicit save;
- selected implementation must preserve the invariant that unrelated draft fields are not committed implicitly.

### 8.5 UDA

The existing `createUdaSnapshotMutation` delta/rebase model is retained.

All UDA actions that can be repeated while the first commit is pending must expose a pending guard at the invoking control or modal. Existing success/reset/close behavior remains after durable resolution only.

### 8.6 Custom tests

The existing Promise-aware save paths are retained.

Add an in-flight guard for:

- interactive editor save;
- manual test creation;
- DOCX/ZIP import save.

A new test ID is created once per accepted intent. Repeated submit while pending does not create a second test.

### 8.7 Submission deletion

Deletion returns a Promise and may expose row-level pending state. No additional rollback layer is required because commit-first publication remains authoritative.

### 8.8 Submission-to-register import

Import must be idempotent without changing persisted schemas.

Use the existing submission ID to derive a deterministic grade batch identity, conceptually:

```ts
batchId = `online_${submission.id}`
```

Before adding the grade derived from that submission, replace/reconcile any existing grade with the same deterministic batch identity rather than appending a fresh `uid()` batch every time.

Consequences:

- repeated import does not duplicate grades;
- a retry after ambiguous UI interruption is safe;
- import remains compatible with existing `Grade` shape;
- no schema migration is required.

## 9. Global backup change accounting

### 9.1 Problem

`meta.changes` currently advances with `appData` commits but not uniformly with settings, UDA, tests and submissions. Therefore backup status can under-report changes.

### 9.2 Decision

Every persisted domain mutation governed by PERSIST-01H must update backup metadata in the same logical durable commit.

For ordinary domain mutations:

```ts
nextMeta = {
  ...currentMeta,
  changes: currentMeta.changes + 1
}
```

The domain record and `meta` are persisted atomically through `SecureVault.putMany`.

This applies to:

- appData;
- settings;
- UDA;
- customTests;
- submissions.

### 9.3 Storage API

`SecureAppStorage` should expose type-safe domain+meta operations or an internal generic helper used by type-safe public methods. React components must not call `vault.putMany` directly.

No record key or schema change is required.

## 10. Backup checkpoint protocol

### 10.1 Requirements

An exported backup must represent an explicit committed checkpoint. The metadata receipt must describe that same checkpoint and must not erase changes committed after the checkpoint was captured.

### 10.2 Coordinator primitive

Extend the durable mutation coordinator with a minimal serialized task/checkpoint primitive, conceptually:

```ts
enqueueTask<T>(task: () => Promise<T> | T): Promise<T>
```

or an equivalent API with these semantics:

- the task runs after all previously queued mutations settle;
- later queued mutations wait until the task returns;
- a failed task does not poison the queue;
- the task can read a coherent set of committed refs.

A bare `whenIdle()` is insufficient because it creates a time-of-check/time-of-use window in which a new mutation can enter between “idle” and snapshot capture.

### 10.3 Preparing the checkpoint

The App prepares the backup checkpoint inside the serialized task and returns an immutable/deep-cloned structure containing:

- complete committed snapshot;
- `includedChanges`, equal to the checkpoint metadata change count.

The Privacy view encrypts and initiates the download from that checkpoint, not from render-time React props.

### 10.4 Marking the export

After encryption/download initiation succeeds, App records the receipt through the mutation coordinator.

Do not blindly reset `changes` to zero. Instead derive:

```ts
changes = Math.max(0, currentMeta.changes - checkpoint.includedChanges)
lastBackup = exportedAt
```

This preserves mutations committed after the checkpoint but before the receipt is written.

If export encryption/download preparation fails, metadata is not advanced.

## 11. Full restore protocol

### 11.1 Application serialization

Restore must execute as one exclusive/serialized application task so it cannot interleave with ordinary mutations.

The task starts only after prior queued application mutations have settled. Later mutations wait until restore completes.

### 11.2 Atomic Vault write

`SecureAppStorage.restoreSnapshotVerified` must write the complete sanitized snapshot using one atomic multi-record Vault transaction rather than six sequential `put` operations.

Conceptually the transaction contains:

- `appData`;
- `settings`;
- `udas`;
- `customTests`;
- `submissions`;
- `meta`.

The existing readback verification remains.

If readback verification fails after an apparently successful atomic write, restore the previous complete snapshot using the same atomic full-snapshot primitive and verify the rollback.

### 11.3 Publication

Only after verified restore succeeds:

- update all committed refs;
- publish all React domains;
- reset navigation to Home;
- show success.

Failure publishes none of the candidate restored state.

## 12. Factory reset

The current Vault `clearAll()` behavior remains valid because it locks immediately and serializes against queued Vault mutations.

PERSIST-01H does not redesign reset. Existing failure semantics remain.

## 13. StudentPortal boundary

PERSIST-01H does not absorb ONLINE-01.

The parent callback remains Promise-returning so ONLINE-01 can later make student-facing success truthful. The current hard-coded classes and pre-persistence result/confetti behavior remain explicitly open and must not be falsely closed by PERSIST-01H.

## 14. Required invariants

PERSIST-01H is acceptable only if all of the following hold:

1. **Promise-to-UI invariant** — every governed success/destructive UI transition can observe durable completion.
2. **Single-intent invariant** — one accepted user action produces at most one logical mutation while it is pending.
3. **Draft-preservation invariant** — persistence failure does not destroy retry-relevant teacher input.
4. **No-false-success invariant** — success messaging/navigation occurs only after durable success.
5. **Latest-committed invariant** — queued mutations derive from latest committed state at execution time.
6. **FIFO/failure-isolation invariant** — one failure does not reorder or poison later work.
7. **Global-backup-ledger invariant** — all governed domain commits advance backup change tracking atomically with their data.
8. **Checkpoint-truth invariant** — backup receipt corresponds to the exact committed checkpoint exported.
9. **Post-checkpoint preservation invariant** — mutations committed after backup snapshot capture remain counted as outstanding.
10. **Atomic-restore invariant** — complete restore writes all snapshot records or none within one Vault transaction.
11. **Restore-isolation invariant** — restore does not interleave with ordinary application mutations.
12. **Import-idempotency invariant** — re-importing the same online submission does not duplicate a grade.
13. **Navigation-preservation invariant** — post-commit callbacks cannot overwrite newer user navigation.
14. **Vault-format invariant** — no record keys, encryption format, database version or key hierarchy change.
15. **ONLINE-01 separation invariant** — StudentPortal product gaps remain explicitly open unless separately implemented and qualified.

## 15. Test strategy

Implementation remains TDD RED → GREEN.

### 15.1 Contract tests

Add a focused mutation-contract suite that checks common properties across surfaces instead of only isolated string patterns.

Required RED cases include:

- evaluation double-submit while first save is pending;
- behavior repeat action while pending;
- single-student input retained on persistence failure;
- bulk import does not report success or clear file before persistence;
- settings failure does not show success;
- theme change does not commit unrelated unsaved fields;
- UDA/test creation cannot duplicate from repeated pending submit;
- submissions import repeated twice produces one deterministic imported batch per submission;
- settings/UDA/tests/submissions increment `meta.changes` atomically with domain commit;
- backup checkpoint waits behind prior mutation;
- mutation after checkpoint remains outstanding after backup receipt;
- full restore uses one atomic multi-record persistence operation;
- restore does not interleave with queued normal mutation.

### 15.2 Existing suites

All existing PERSIST-01 tests remain regression requirements, including:

- FIFO coordinator semantics;
- lock recheck on queued Vault writes/deletes;
- appData+meta atomic commit;
- UDA stale-snapshot rebasing;
- Home/navigation preservation;
- test editor await behavior.

### 15.3 Full qualification

Final exact head must pass:

- full security/product test suite;
- TypeScript typecheck;
- production build;
- production startup smoke;
- PREDEPLOY exact-head qualification;
- independent Codex review with zero unresolved significant findings.

A focused browser failure-injection pass is required after engineering GREEN for the teacher-visible pending/failure flows that cannot be proven adequately by source/runtime tests alone.

## 16. Expected implementation surface

Expected files, subject to the implementation plan:

- `src/persistence/durableMutationCoordinator.ts` — serialized task/checkpoint primitive;
- `src/security/secureAppStorage.ts` — domain+meta atomic operations and atomic full snapshot write;
- `src/App.tsx` — Promise propagation, global meta tracking, backup checkpoint/restore orchestration;
- `src/components/EvaluationsView.tsx`;
- `src/components/BehaviorsView.tsx`;
- `src/components/StudentsManagementView.tsx`;
- `src/components/SettingsView.tsx`;
- `src/components/UdaGanttView.tsx`;
- `src/components/VerificheOnlineView.tsx`;
- `src/components/PrivacyView.tsx`;
- focused tests under `src/security/` and/or `src/persistence/`.

`StudentPortal.tsx` is not an implementation target for PERSIST-01H except if a type signature must remain compatible; behavioral changes there remain ONLINE-01.

## 17. Migration and compatibility

No IndexedDB migration or record-schema migration is required.

The design deliberately reuses:

- existing record keys;
- existing `SecureMeta { changes, lastBackup }` shape;
- deterministic `batchId` derived from existing submission IDs;
- existing encrypted backup payload shape.

Existing encrypted backups remain readable.

## 18. Rollback

PERSIST-01H is structurally reversible because it introduces no storage migration and no format change.

The current PERSIST-01 PR #18 remains frozen while this design is reviewed. Implementation must occur on a separate implementation branch derived from the audited head unless a later explicit integration decision says otherwise.

No merge or deploy is authorized by this design.

## 19. Stop rules

Stop and require a separate decision if implementation would require:

- a new persisted metadata schema/version;
- background retry or autosave subsystem;
- distributed/cross-device locking;
- cloud backup or sync;
- StudentPortal redesign;
- crypto/key-management changes;
- a broad UI redesign unrelated to pending/failure truthfulness.

## 20. Completion criteria

PERSIST-01H is engineering-qualified when:

- all 15 invariants have direct test or execution evidence;
- the four current unresolved Codex findings are resolved by the systemic contract rather than ad hoc bypasses;
- all additional audit gaps in scope are closed or explicitly disproved with evidence;
- import of online submissions is idempotent;
- backup status covers every governed persisted domain;
- backup export uses a serialized committed checkpoint and preserves post-checkpoint changes;
- restore is application-serialized and atomically persisted as a complete snapshot;
- no teacher-facing success/destructive transition precedes durable completion;
- full PREDEPLOY passes on the exact final head;
- focused browser failure-injection passes where required;
- final independent Codex review has zero unresolved significant findings;
- no merge or deploy occurs without a separate decision.
