# PERSIST-01H — Mutation Contract Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the systemic mutation-integrity gaps left after PERSIST-01 by propagating one Promise-aware, reentrancy-safe, backup-truthful contract from teacher UI actions through the FIFO coordinator to atomic Vault persistence.

**Architecture:** Keep the existing commit-first/FIFO/Vault design. Extend the coordinator with serialized application tasks, extend `SecureAppStorage` with atomic domain+meta and complete-snapshot writes, then propagate Promise/pending semantics to every governed teacher-facing mutation. Backup/export/restore use a serialized committed checkpoint; submission import becomes deterministic and idempotent.

**Tech Stack:** React 19, TypeScript, Bun test runner, Vite, IndexedDB, Web Crypto API, existing Secure Local Vault.

**Spec:** `docs/superpowers/specs/2026-10-22-persist-01h-mutation-contract-hardening-design.md`

## Global Constraints

- Implementation starts from the approved PERSIST-01H baseline; the audited product code is `70078d67dc1ae3ee49fbd975a7805cd112c9813d` and the approved docs branch adds documentation only.
- Use an isolated implementation branch/worktree; do not implement directly on `main` or on the frozen PR #18 branch.
- Preserve record keys, encrypted record format, IndexedDB database version, AES-GCM/PBKDF2 primitives and key hierarchy.
- No new runtime dependency.
- No cloud sync, remote backup, autosave/background retry or distributed locking.
- No curriculum, analytics or grading-formula changes.
- Do not absorb ONLINE-01: StudentPortal hard-coded classes and pre-persistence result/confetti remain separately open.
- All governed changes follow TDD RED → GREEN; a generic failing CI run is not evidence unless the expected failure is isolated.
- No merge and no deploy without a separate decision.
- Keep teacher-facing durable failure copy canonical: `Salvataggio non riuscito. La modifica non è stata applicata.`

## Review Focus

1. **Queue boundary races:** a checkpoint or restore requested while another mutation is pending must observe/replace a coherent committed state, with later work blocked until the serialized task completes. Task 1 and Task 7 pin this.
2. **Failure after download but before receipt:** the backup file may already exist, but local metadata must not falsely say that later or unrecorded changes are backed up. Task 3 and Task 7 pin this.
3. **Repeated user intent:** double click/Enter during a slow save must create at most one logical class/evaluation/UDA/test/student mutation. Tasks 4–6 pin this.
4. **Settings draft leakage:** immediate theme persistence must never commit unrelated unsaved settings fields. Task 3 and Task 5 pin this.
5. **Fresh-vault restore rollback:** restore must remain safe even when the pre-restore logical snapshot contains defaults that were not yet stored as all six physical records. Task 2 and Task 7 pin this by passing an explicit complete previous logical snapshot to verified restore.

---

## File Structure

**Create**
- `src/persistence/backupCheckpoint.ts` — pure backup checkpoint/receipt calculations and types.
- `src/persistence/settingsMutation.ts` — pure top-level settings diff/patch helper.
- `src/persistence/submissionGradeImport.ts` — deterministic idempotent submission→grade reconciliation.
- `src/security/persist01hCoordinatorContract.test.ts` — serialized task/FIFO contract.
- `src/security/persist01hStorageContract.test.ts` — domain+meta atomicity and complete restore contract.
- `src/security/persist01hMutationHelpers.test.ts` — settings patch, backup ledger/checkpoint and import idempotency.
- `src/security/persist01hUiContract.test.ts` — Promise/pending/source-contract coverage across teacher mutation surfaces.

**Modify**
- `src/persistence/durableMutationCoordinator.ts` — add serialized task primitive.
- `src/security/secureAppStorage.ts` — atomic domain+meta methods and complete atomic snapshot write/rollback.
- `src/App.tsx` — global ledger integration, Promise-returning mutation callbacks, deterministic import, serialized backup/restore orchestration.
- `src/components/HomeView.tsx` — class mutation pending guards.
- `src/components/EvaluationsView.tsx` — Promise-aware save and in-flight guard.
- `src/components/BehaviorsView.tsx` — Promise-aware save and in-flight guard.
- `src/components/StudentsManagementView.tsx` — preserve draft/file input and guard add/import/invert/delete.
- `src/components/SettingsView.tsx` — patch-based save/theme semantics and in-flight guards.
- `src/components/UdaGanttView.tsx` — shared UDA pending boundary.
- `src/components/VerificheOnlineView.tsx` — test-save and submission teacher-action pending guards.
- `src/components/PrivacyView.tsx` — prepare checkpoint → encrypt/download → receipt flow; Promise-aware restore.
- Existing PERSIST-01 security tests as needed when interfaces intentionally change.

---

### Task 1: Serialize application-level checkpoint and exclusive tasks

**Files:**
- Modify: `src/persistence/durableMutationCoordinator.ts`
- Create: `src/security/persist01hCoordinatorContract.test.ts`

**Interfaces:**
- Consumes: existing `DurableMutationCoordinator.enqueue<T>(mutation): Promise<T>`.
- Produces: `DurableMutationCoordinator.enqueueTask<T>(task: () => Promise<T> | T): Promise<T>`.
- Required semantics: same FIFO tail as mutations; waits for earlier work; blocks later work until settlement; rejection does not poison the queue.

- [ ] **Step 1: Write the failing coordinator contract tests**

Add tests named:
- `serialized task waits for an earlier mutation before reading committed state`
- `mutation enqueued after a serialized task waits for the task`
- `rejected serialized task does not poison later mutation`

Use deferred Promises so ordering is asserted explicitly, not by timers.

- [ ] **Step 2: Run the focused RED**

Run: `bun test src/security/persist01hCoordinatorContract.test.ts`

Expected: FAIL because `enqueueTask` does not exist; no unrelated failures.

- [ ] **Step 3: Implement `enqueueTask<T>` using the same coordinator tail**

Do not add a second queue. Both `enqueue` and `enqueueTask` must serialize through one internal tail and normalize success/failure back to `Promise<void>` for failure isolation.

- [ ] **Step 4: Run focused GREEN plus existing coordinator regressions**

Run:
- `bun test src/security/persist01hCoordinatorContract.test.ts`
- `bun test src/security/durableMutationCoordinator.test.ts src/security/persist01FinalIntegrity.test.ts` if the first path exists; otherwise run the existing PERSIST-01 coordinator/final-integrity test files discovered in the repo.

Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `feat(persist): serialize application checkpoint tasks`

---

### Task 2: Make every logical storage commit atomic, including complete restore

**Files:**
- Modify: `src/security/secureAppStorage.ts`
- Test: `src/security/persist01hStorageContract.test.ts`
- Modify existing secure-storage tests where the verified-restore signature changes.

**Interfaces:**
- Consumes: existing `SecureVault.putMany(entries)`.
- Produces:
  - `saveSettingsAndMeta(settings: AppSettings, meta: SecureMeta): Promise<void>`
  - `saveUdasAndMeta(udas: UdaRecord[], meta: SecureMeta): Promise<void>`
  - `saveCustomTestsAndMeta(tests: Record<string, OnlineTest>, meta: SecureMeta): Promise<void>`
  - `saveSubmissionsAndMeta(submissions: OnlineSubmission[], meta: SecureMeta): Promise<void>`
  - private or internal `writeCompleteSnapshotAtomic(snapshot: CompleteSecureAppSnapshot): Promise<void>`
  - `restoreSnapshotVerified(candidate: CompleteSecureAppSnapshot, previousLogical: CompleteSecureAppSnapshot): Promise<CompleteSecureAppSnapshot>`

- [ ] **Step 1: Write RED tests for domain+meta atomicity**

For settings, UDA, tests and submissions assert that each public method calls one batch containing the domain record and `meta`, and that a forced batch failure leaves both prior records unchanged.

- [ ] **Step 2: Write RED tests for full restore atomicity and rollback**

Pin:
- candidate six-record snapshot is written in one `putMany` operation;
- readback mismatch triggers one atomic write of `previousLogical`, then verifies rollback;
- a previous logical snapshot is accepted even when the physical store had missing records before restore (fresh-vault case).

- [ ] **Step 3: Run focused RED**

Run: `bun test src/security/persist01hStorageContract.test.ts`

Expected: FAIL on missing domain+meta methods, sequential full snapshot write, and old restore signature.

- [ ] **Step 4: Implement the type-safe storage methods and atomic restore**

Keep `sanitizePersistedSettings` at the storage boundary. Do not expose `vault.putMany` to React components.

- [ ] **Step 5: Run focused GREEN and Secure Vault regressions**

Run:
- `bun test src/security/persist01hStorageContract.test.ts`
- `bun test src/security/*.test.ts`

Expected: PASS before proceeding.

- [ ] **Step 6: Commit**

Commit message: `feat(persist): atomically commit domain metadata and restore`

---

### Task 3: Introduce pure mutation helpers for settings, backup truth and import idempotency

**Files:**
- Create: `src/persistence/settingsMutation.ts`
- Create: `src/persistence/backupCheckpoint.ts`
- Create: `src/persistence/submissionGradeImport.ts`
- Create: `src/security/persist01hMutationHelpers.test.ts`

**Interfaces:**
- Produces:
  - `diffSettings(base: AppSettings, candidate: AppSettings): Partial<AppSettings>`
  - `applySettingsPatch(current: AppSettings, patch: Partial<AppSettings>): AppSettings`
  - `incrementBackupChanges(meta: SecureMeta): SecureMeta`
  - `PreparedBackupCheckpoint { snapshot: CompleteSecureAppSnapshot; includedChanges: number; checkpointAt: string }`
  - `prepareBackupCheckpoint(snapshot: CompleteSecureAppSnapshot, checkpointAt: string): PreparedBackupCheckpoint`
  - `applyBackupReceipt(current: SecureMeta, checkpoint: Pick<PreparedBackupCheckpoint, 'includedChanges' | 'checkpointAt'>): SecureMeta`
  - `reconcileSubmissionGrades(classes: ClassData[], submissions: OnlineSubmission[], targetUdaId?: string): { classes: ClassData[]; importedCount: number }`
- Deterministic imported batch ID: ``online_${submission.id}``.

- [ ] **Step 1: Write settings RED cases**

Pin that `diffSettings` includes only changed top-level fields and that applying `{ theme: 'matrix' }` to newer committed settings changes only `theme`.

- [ ] **Step 2: Write backup RED cases**

Pin:
- prepared snapshot uses `meta.changes = 0` and `meta.lastBackup = checkpointAt`;
- `includedChanges` captures the live pre-export count;
- live source snapshot is not mutated;
- receipt uses `max(0, current.changes - includedChanges)` and preserves changes committed after checkpoint capture.

- [ ] **Step 3: Write import-idempotency RED cases**

Pin:
- first import creates deterministic batch `online_<submission-id>`;
- second import of the same submission replaces/reconciles that batch rather than appending another;
- two different submission IDs produce two batches;
- unmatched class/student creates no grade and does not count as imported.

- [ ] **Step 4: Run RED**

Run: `bun test src/security/persist01hMutationHelpers.test.ts`

Expected: FAIL because helpers do not exist.

- [ ] **Step 5: Implement the three pure helper modules**

Keep helpers React-free and storage-free. Preserve current matching and grade-conversion semantics for submission import except for deterministic reconciliation.

- [ ] **Step 6: Run GREEN**

Run: `bun test src/security/persist01hMutationHelpers.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

Commit message: `feat(persist): add mutation truth and idempotency helpers`

---

### Task 4: Route all App mutation boundaries through Promise + global ledger semantics

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/security/durableAppMutationIntegrity.test.ts`
- Modify/create: `src/security/persist01hUiContract.test.ts`

**Interfaces:**
- Consumes Task 1 `enqueueTask`, Task 2 domain+meta storage methods, Task 3 helpers.
- Produces Promise-returning handlers for classes/evaluations/behaviors/students/settings/submission deletion/import and existing Promise-aware UDA/tests/submission append.
- Domain coordinators for settings/UDA/tests/submissions operate on `{ domain, meta }`, derive latest committed state at FIFO execution time, persist domain+meta atomically, then publish both refs/states.

- [ ] **Step 1: Write RED contracts for the global backup ledger**

Pin in runtime/source contracts that settings, UDA, tests and submissions pair their domain mutation with latest `meta`, increment `changes`, use the Task 2 atomic storage method, and publish `metaRef/setMeta` only after persistence.

- [ ] **Step 2: Write RED contracts for Promise-returning App handlers**

Pin exact handler signatures/behavior so `handleSaveEvaluations`, `handleSaveBehaviors`, student mutations, settings update, submission delete and submission import return durable Promises rather than swallowing them with `void ...catch`.

- [ ] **Step 3: Write RED contract for deterministic submission import**

Require `handleImportSubmissionsToRegister` to call `reconcileSubmissionGrades` against submissions read when queued derivation executes, and return its Promise.

- [ ] **Step 4: Run RED**

Run: `bun test src/security/durableAppMutationIntegrity.test.ts src/security/persist01hUiContract.test.ts`

Expected: FAIL only on the new PERSIST-01H contracts.

- [ ] **Step 5: Implement App-level domain+meta coordinators and Promise handlers**

Preserve navigation-version guards already proven by PERSIST-01. Catch only at component boundaries that intentionally consume failure; do not convert rejection into false success.

- [ ] **Step 6: Run GREEN plus PERSIST-01 regressions**

Run: `bun test src/security/*.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

Commit message: `refactor(persist): propagate durable mutation promises and ledger`

---

### Task 5: Harden Home, evaluations, behaviors, students and settings UI boundaries

**Files:**
- Modify: `src/components/HomeView.tsx`
- Modify: `src/components/EvaluationsView.tsx`
- Modify: `src/components/BehaviorsView.tsx`
- Modify: `src/components/StudentsManagementView.tsx`
- Modify: `src/components/SettingsView.tsx`
- Test: `src/security/persist01hUiContract.test.ts`

**Interfaces:**
- Consumes Promise-returning callbacks from Task 4.
- Settings uses Task 3 `diffSettings`; theme sends a theme-only patch.
- Produces one local pending boundary per form/view; retry-relevant draft survives failure.

- [ ] **Step 1: Write RED for evaluation and behavior reentrancy**

Pin that both views await save callbacks, set pending before await, clear in `finally`, disable submit while pending, and do not clear/navigate locally before resolution.

- [ ] **Step 2: Write RED for student draft preservation**

Pin:
- single add clears `newStudentName` only after resolved add;
- add button is disabled while pending;
- bulk import distinguishes parsing from durable save, reports success only after resolved save, and does not clear the file input on persistence failure;
- invert/delete controls are guarded while their mutation is pending.

- [ ] **Step 3: Write RED for settings truthfulness**

Pin:
- explicit form save awaits Promise before success;
- save failure preserves form data;
- theme action persists only `{ theme }` against latest committed settings and cannot submit unrelated draft fields;
- theme/save controls are guarded while their respective persistence is pending.

- [ ] **Step 4: Write RED for repeated class actions**

Pin Home create/delete controls cannot accept a duplicate same action while the first class mutation is pending. Browser-prompt text itself need not be preserved after explicit failure.

- [ ] **Step 5: Run RED**

Run: `bun test src/security/persist01hUiContract.test.ts`

Expected: FAIL on pending/await contracts only.

- [ ] **Step 6: Implement minimal local pending states and await boundaries**

Do not redesign layouts or introduce a global loading system. Disabled controls must retain existing labels plus a minimal in-progress label only where already natural.

- [ ] **Step 7: Run GREEN and typecheck**

Run:
- `bun test src/security/persist01hUiContract.test.ts`
- `bun run lint`

Expected: PASS.

- [ ] **Step 8: Commit**

Commit message: `fix(persist): make core teacher forms failure truthful`

---

### Task 6: Harden UDA, test and submissions teacher actions against repeated pending intent

**Files:**
- Modify: `src/components/UdaGanttView.tsx`
- Modify: `src/components/VerificheOnlineView.tsx`
- Test: `src/security/persist01hUiContract.test.ts`

**Interfaces:**
- Consumes existing Promise-aware `onSaveUdas`/`onSaveNewTest` and Task 4 Promise-aware submission delete/import handlers.
- Produces shared UDA pending boundary and test-save pending boundary.

- [ ] **Step 1: Write UDA RED cases**

Pin that create/edit/delete/dependency/lesson mutating controls cannot enqueue a second UDA mutation while the shared UDA save is pending, and that success/reset/modal-close remains after durable resolution.

- [ ] **Step 2: Write test-editor RED cases**

Pin interactive save, manual creation and DOCX/ZIP save share an in-flight guard; a generated test ID is created only for one accepted intent; success/clear/close remains after resolved persistence.

- [ ] **Step 3: Write teacher-submission action RED cases**

Pin row deletion and register import cannot be reinvoked while their durable action is pending; import success is emitted only after durable completion.

- [ ] **Step 4: Run RED**

Run: `bun test src/security/persist01hUiContract.test.ts`

Expected: FAIL only on these pending guards.

- [ ] **Step 5: Implement the minimal pending boundaries**

Do not alter StudentPortal result/confetti behavior; that remains ONLINE-01.

- [ ] **Step 6: Run GREEN and full security suite**

Run: `bun test src/security/*.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

Commit message: `fix(persist): guard UDA test and submission actions in flight`

---

### Task 7: Implement serialized, truthful backup export and isolated atomic restore

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/PrivacyView.tsx`
- Modify: `src/security/secureAppStorage.ts` only if integration reveals a Task 2 signature correction.
- Test: `src/security/persist01hMutationHelpers.test.ts`
- Test: `src/security/persist01hUiContract.test.ts`
- Test: `src/security/persist01hCoordinatorContract.test.ts`

**Interfaces:**
- Consumes Task 1 `enqueueTask`, Task 2 atomic restore, Task 3 `PreparedBackupCheckpoint`/receipt helpers.
- Produces App callbacks conceptually:
  - `prepareEncryptedBackup(): Promise<PreparedBackupCheckpoint>`
  - `markEncryptedBackupExported(checkpoint): Promise<void>`
  - `handleImportEncryptedBackup(decryptedData): Promise<void>` serialized through `enqueueTask`.

- [ ] **Step 1: Write RED for checkpoint ordering**

Pin with deferred coordinator work that backup preparation waits behind an earlier mutation and captures the committed refs only when its serialized task begins.

- [ ] **Step 2: Write RED for post-checkpoint preservation**

Pin the sequence: checkpoint includes N changes → later domain commit adds one change → receipt leaves exactly one outstanding change and sets `lastBackup = checkpointAt`.

- [ ] **Step 3: Write RED for PrivacyView export order**

Require: await checkpoint → create payload from `checkpoint.snapshot` → encrypt → initiate download → await receipt → clear passwords/show success. A failure before receipt must not claim success. A receipt failure after download leaves local outstanding metadata conservative and surfaces a non-success state rather than claiming synchronization.

- [ ] **Step 4: Write RED for restore serialization/publication**

Pin: restore receives an explicit complete `previousLogical` snapshot built from committed refs; runs inside `enqueueTask`; publishes all refs/React state only after `restoreSnapshotVerified` succeeds; resets navigation to Home only after success; later mutation waits behind restore.

- [ ] **Step 5: Run RED**

Run:
- `bun test src/security/persist01hCoordinatorContract.test.ts`
- `bun test src/security/persist01hMutationHelpers.test.ts`
- `bun test src/security/persist01hUiContract.test.ts`

Expected: FAIL only on backup/restore integration contracts.

- [ ] **Step 6: Implement App and PrivacyView checkpoint/receipt/restore flow**

Remove render-time `backupSnapshot` as the authoritative export source. Preserve existing encrypted backup payload compatibility.

- [ ] **Step 7: Run GREEN and complete security regression**

Run: `bun test src/security/*.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit**

Commit message: `feat(persist): make backup and restore snapshot truthful`

---

### Task 8: Whole-branch qualification, browser failure injection and independent review

**Files:**
- No product changes unless a valid qualification finding first receives its own RED.
- Update PR/qualification metadata only after exact-head evidence is available.

**Interfaces:**
- Consumes the completed Tasks 1–7.
- Produces an exact-head qualification record and independent review outcome.

- [ ] **Step 1: Run the complete local/CI-equivalent suite on the exact candidate head**

Run:
- `bun test src/security/*.test.ts`
- `bun run lint`
- `bun run build`
- production startup smoke using the repository's existing PREDEPLOY command/workflow.

Expected: all PASS with exact counts recorded; no skipped PERSIST-01/PERSIST-01H integrity suite.

- [ ] **Step 2: Audit the final diff against scope**

Verify no dependency, workflow, DB-version, record-key, crypto/key-management, analytics/curriculum or StudentPortal product redesign leaked into the branch.

- [ ] **Step 3: Execute focused browser failure-injection**

Verify exactly these journeys against the qualified build:
- evaluation submit pending/failure preserves draft and blocks duplicate submit;
- student add/import pending/failure preserves retry state and avoids false success;
- settings pending/failure avoids false success and theme draft leakage;
- backup export requested behind a delayed prior write exports the later committed checkpoint;
- restore publishes only after verified success and leaves prior state visible on failure.

If this chat environment has no interactive browser capability, stop at this gate and perform it in ChatGPT Work/Cloud Browser or the repository's existing browser harness before claiming browser-qualified status.

- [ ] **Step 4: Resolve the four currently open Codex threads with systemic evidence**

For each thread, reply with the exact RED commit/run and GREEN exact-head qualification that proves the class of defect is closed. Do not resolve a thread merely because a nearby code path changed.

- [ ] **Step 5: Request fresh independent Codex review on the exact qualified head**

Freeze the implementation branch during review. Require `status=completed` and zero unresolved significant findings before terminal qualification.

- [ ] **Step 6: If Codex finds a valid new instance, classify against the 16 invariants before changing code**

If the finding is already covered by an invariant but escaped tests, add a RED to the owning contract suite, fix it, rerun exact-head qualification and restart final review. If it requires a new persisted schema, cloud sync, background retry, StudentPortal redesign or crypto change, stop under the spec's stop rules.

- [ ] **Step 7: Record terminal state without merge/deploy**

Terminal engineering state is:

`PERSIST-01H = ENGINEERING QUALIFIED / BROWSER QUALIFIED / INDEPENDENT REVIEW PASS / READY FOR SEPARATE INTEGRATION DECISION`

Do not merge or deploy in this task.
