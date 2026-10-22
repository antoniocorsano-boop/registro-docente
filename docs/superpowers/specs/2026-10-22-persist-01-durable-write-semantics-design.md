# PERSIST-01 — Durable Write Semantics Design

**Date:** 2026-10-22  
**Repository:** `antoniocorsano-boop/registro-docente`  
**Baseline:** `main@8afb734a184403f03153d493e1ea677f6d1e5abb`  
**Status:** APPROACH APPROVED / WRITTEN SPEC PENDING USER REVIEW  
**Selected approach:** commit-first centralized mutation coordination + atomic multi-record IndexedDB writes

## 1. Purpose

PERSIST-01 closes a data-integrity gap between the React application state and the Secure Local Vault.

The product currently has several mutation paths that update visible React state before durable persistence has been confirmed. If the Secure Local Vault write fails, the teacher can continue interacting with state that appears saved but is not actually durable. Some paths show an error, some log only to the console, and only the student-submission path currently performs an explicit rollback.

The target property is:

> A state change is considered committed only after the corresponding Secure Local Vault write succeeds. The teacher-facing UI must never present an uncommitted change as durable.

This design does not change the encryption model, storage format, business formulas, curriculum semantics, privacy policy, navigation model or deployment model.

## 2. Scope

PERSIST-01 governs application mutations that persist through `SecureAppStorage`:

- `appData` and `meta` writes used by class, student, evaluation and behavior mutations;
- `settings` writes;
- `udas` writes;
- `customTests` writes;
- `submissions` writes.

PERSIST-01 also defines the common ordering and error semantics that these mutation paths must follow.

### Out of scope

The following are explicitly not part of PERSIST-01:

- redesign of `StudentPortal` success/failure UX beyond adopting the new persistence contract;
- restructuring UDA, Analytics, evaluation or privacy features;
- changing AES-GCM, PBKDF2, the vault key hierarchy or IndexedDB database version;
- changing persisted record keys or payload schemas;
- adding cloud synchronization or remote persistence;
- changing backup/import semantics except where existing helpers are reused for tests;
- deployment or release promotion.

`ONLINE-01` remains the separate follow-up for student-facing submission semantics.

## 3. Current-state findings

### 3.1 React state can advance before persistence

`App.tsx` contains paths that call React setters and then start a Secure Vault write asynchronously. For example, `persistAppData` updates `appData` and `meta` before `saveAppData` and `saveMeta` have completed. On failure it shows an error but does not restore the previous React state.

The same pattern exists for custom tests, UDA and settings. Submission deletion also updates React state first and has no rollback. The student-submission append path is stronger because it restores the previous submissions array if persistence fails.

### 3.2 `appData` and `meta` are not one atomic commit

`persistAppData` conceptually commits two records: `appData` and `meta`.

`SecureVault` serializes `put` operations through `mutationTail`, but each `put` delegates to a separate `VaultStore.putRecord` call. `IndexedDbVaultStore.putRecord` opens one IndexedDB read/write transaction for one record.

Therefore this failure is currently possible:

1. `appData` write succeeds;
2. `meta` write fails;
3. React state has already advanced;
4. Vault state is partially updated.

Serialization prevents interleaving of individual `put` operations but does not create atomicity across the two records.

### 3.3 Existing precedent: verified restore

`SecureAppStorage.restoreSnapshotVerified` already follows a stronger integrity pattern:

1. capture previous state;
2. write candidate state;
3. read it back;
4. verify equivalence;
5. restore the previous snapshot if verification fails.

PERSIST-01 does not copy this full readback strategy to every normal mutation because it would be unnecessarily expensive. It does reuse the same fail-closed principle: persistence success is the authority for accepting state.

## 4. Architectural decision

The selected architecture has two layers of protection:

1. **atomic persistence at the Vault boundary** for records that belong to the same logical commit;
2. **commit-first mutation coordination at the application boundary** so React advances only after the Vault confirms durability.

These two layers solve different problems. Atomic storage prevents partial persistence. Commit-first UI semantics prevents false success in memory.

## 5. Storage-layer design

### 5.1 `VaultStore` multi-record primitive

Add a method conceptually equivalent to:

```ts
putRecords(records: EncryptedVaultRecord[]): Promise<void>
```

For `IndexedDbVaultStore`, the implementation must:

- open exactly one `readwrite` transaction on the `records` object store;
- enqueue all `put` requests within that transaction;
- resolve only after the transaction completes;
- reject if any request fails or the transaction aborts.

No database-version change is required because the existing `records` object store already accepts all vault records.

The existing single-record `putRecord` remains supported and may delegate internally to `putRecords([record])` to keep one persistence path.

### 5.2 `SecureVault.putMany`

Add a serialized multi-record mutation primitive conceptually equivalent to:

```ts
putMany(entries: Array<{ key: VaultRecordKey; value: unknown; schemaVersion?: number }>): Promise<void>
```

Required semantics:

- require the vault to be unlocked before mutation;
- execute inside the existing `mutationTail` queue;
- encrypt every entry before durable storage begins;
- if encryption of any entry fails, write nothing;
- pass all encrypted records to `VaultStore.putRecords` as one atomic storage transaction;
- resolve only when the IndexedDB transaction is complete.

This preserves the existing cryptographic format and mutation serialization while adding logical atomicity.

### 5.3 `SecureAppStorage` domain commits

`SecureAppStorage` remains the application-facing persistence API.

Add a specific operation for the coupled `appData + meta` commit, conceptually:

```ts
saveAppDataAndMeta(appData: AppData, meta: SecureMeta): Promise<void>
```

It must use `vault.putMany` so both records commit atomically.

The existing single-domain operations (`saveSettings`, `saveUdas`, `saveCustomTests`, `saveSubmissions`) remain valid but inherit the same serialized Vault semantics.

Do not expose `putMany` directly to React components.

## 6. Application-layer mutation coordinator

### 6.1 Responsibility

Introduce one focused coordinator for durable application mutations. It owns ordering, commit status and failure propagation; it does not own domain calculations.

The coordinator must serialize user mutations in FIFO order so two rapid operations cannot both derive from the same stale committed snapshot.

A mutation follows this sequence:

1. when the mutation reaches the head of the queue, read the latest committed in-memory state needed by that domain;
2. derive the candidate next state from that current committed state;
3. persist the candidate through `SecureAppStorage`;
4. after persistence succeeds, publish the new committed state to React;
5. execute post-commit navigation/toast behavior;
6. on failure, keep the previous committed state and expose a teacher-facing failure.

### 6.2 Location and API

Prefer a small standalone module rather than embedding queue semantics inside the already-large `App.tsx`.

Expected location:

`src/persistence/durableMutationCoordinator.ts`

The module should expose a minimal FIFO helper that accepts an async mutation operation and guarantees that a rejected operation does not poison later operations.

The coordinator must invoke the mutation operation only when that operation reaches the head of the queue. Callers must not enqueue a precomputed candidate state.

It must not import React. `App.tsx` remains responsible for state setters and domain-specific state derivation.

### 6.3 Latest-committed-state rule

Queued operations must not derive candidates from ordinary render closures captured when the user clicked.

`App.tsx` must maintain current committed references for each governed domain, synchronized only after a successful commit. A queued mutation reads those references at execution time, derives its candidate, persists it, then advances both the committed reference and the corresponding React state.

This is required for the FIFO guarantee. Without it, two queued operations could still serialize correctly but both derive from the same stale render snapshot.

### 6.4 Commit-first versus optimistic UI

PERSIST-01 uses **commit-first** semantics for the governed writes.

Reason:

- these operations modify teacher records, grades, students, UDA, tests, settings or submissions;
- the local IndexedDB Vault is expected to be low-latency;
- correctness is more important than shaving a few milliseconds of perceived latency;
- commit-first removes rollback complexity and avoids exposing impossible intermediate states.

Optimistic updates with rollback are therefore not the default PERSIST-01 mechanism.

## 7. Domain-specific mutation behavior

### 7.1 `appData + meta`

Class/student/evaluation/behavior mutations use one atomic `saveAppDataAndMeta` commit.

React `appData` and `meta` must be updated only after that commit succeeds. Their committed references advance in the same post-commit step.

Any navigation that semantically depends on save success — for example leaving an edit screen after saving an evaluation — must execute after commit success.

### 7.2 Settings

`saveSettings` continues to apply the existing persistence sanitization policy, including removal of secrets that are intentionally session-only.

The logical candidate settings are published to React only after the sanitized persistence operation succeeds. React state is not required to be byte-for-byte identical to the stored settings record: session-only secret fields may remain in memory while being deliberately absent from persistent storage.

The current theme must not visually switch and then silently revert because of a failed save. A failed settings commit leaves the previous committed logical settings active.

### 7.3 UDA

`udas` are updated only after `saveUdas` resolves. Failed saves leave the previous UDA state intact.

### 7.4 Custom tests

New or modified tests become visible in committed application state only after `saveCustomTests` resolves.

### 7.5 Submissions

Append and delete operations use the same coordinator.

The existing rollback logic in `handleSaveStudentSubmission` becomes unnecessary once commit-first behavior is authoritative, but the public async contract remains useful because `StudentPortal` needs a Promise to know whether persistence succeeded.

PERSIST-01 does not yet change the student-facing success screen wording or timing; that remains `ONLINE-01`.

## 8. Concurrency semantics

### 8.1 FIFO

All governed mutations must execute in submission order.

Example:

- teacher adds Student A;
- immediately adds Student B;
- operation B must derive from the committed result of operation A, not from the pre-A snapshot.

### 8.2 Failure isolation

If operation A fails:

- A does not update committed references or React state;
- the queue continues;
- operation B executes against the latest actually committed state;
- B is not automatically discarded merely because A failed.

### 8.3 No hidden coalescing

PERSIST-01 does not batch unrelated teacher actions into a delayed autosave. Each user mutation remains an explicit logical commit.

## 9. Teacher-facing failure semantics

A failed durable mutation must be visible and actionable without technical detail.

Canonical message:

**“Salvataggio non riuscito. La modifica non è stata applicata.”**

Additional rules:

- do not show the normal success toast;
- do not navigate to a success/next screen that assumes persistence;
- do not expose IndexedDB, cryptographic or stack details in the teacher-facing message;
- log technical detail to the console for diagnosis;
- keep the application usable for a retry unless the Vault itself transitions to a locked/error state through existing mechanisms.

PERSIST-01 does not introduce a persistent error banner or retry queue UI. A subsequent explicit user action is the retry.

## 10. Invariants

The implementation is acceptable only if all of the following hold:

1. **Committed-state invariant** — teacher-visible committed React state corresponds to the latest successfully accepted logical domain state; policy-sanitized persisted fields may differ only where existing security rules intentionally keep data session-only.
2. **Atomic-pair invariant** — `appData` and `meta` either both change or neither changes.
3. **Ordering invariant** — governed mutations commit in FIFO order and derive their candidate from the latest committed state at execution time.
4. **Failure-isolation invariant** — one failed mutation does not poison later mutations.
5. **No false-success invariant** — no success toast or post-save navigation occurs before persistence succeeds.
6. **Vault-format invariant** — existing record keys, encrypted record schema and crypto primitives remain unchanged.
7. **Restore invariant** — `restoreSnapshotVerified` behavior remains functionally unchanged.
8. **Privacy invariant** — no sensitive payload is moved outside the Secure Local Vault or written to plaintext storage.

## 11. TDD and verification strategy

Implementation must follow RED → GREEN.

### 11.1 Storage RED contracts

Add tests that prove the current implementation lacks required atomicity and then pin the new behavior:

- multi-record store write commits all records in one transaction;
- a forced failure during the multi-record transaction leaves all prior records unchanged;
- `SecureVault.putMany` encrypts all entries before persistence;
- one rejected batch does not poison the Vault mutation queue.

### 11.2 Application RED contracts

Add focused tests for the application mutation boundary:

- failed `appData + meta` commit does not advance committed references or visible state;
- successful commit advances both states together;
- two rapid mutations execute in FIFO order and the second derives from the first committed result rather than a stale render closure;
- failed mutation followed by valid mutation leaves the app on the valid committed result;
- failed save does not emit normal success messaging;
- post-save navigation occurs only after durable success;
- settings, UDA, custom tests and submission delete do not publish failed candidates;
- successful settings persistence permits the existing intentional difference between session-only in-memory secrets and sanitized stored settings.

### 11.3 Regression suite

Final exact head must pass:

- complete `bun test src/security/*.test.ts` suite;
- TypeScript `tsc --noEmit`;
- Vite production build;
- production server startup smoke;
- existing SEC-0/1, privacy, analytics, valuation and P2 contracts.

### 11.4 Review

Before merge decision:

- inspect final diff for scope leakage;
- independent Codex review on the exact qualified head;
- zero unresolved Critical/Important findings;
- any valid finding becomes a new RED before the fix.

A real-browser check is required only if implementation changes teacher-visible timing/navigation behavior that static/integration tests cannot prove adequately. No broad UX review is part of PERSIST-01.

## 12. Expected implementation surface

Expected files, subject to the implementation plan:

- `src/security/vaultStore.ts` — atomic multi-record storage primitive;
- `src/security/secureVault.ts` — serialized `putMany`;
- `src/security/secureAppStorage.ts` — atomic domain commit for `appData + meta`;
- `src/persistence/durableMutationCoordinator.ts` — application FIFO coordinator;
- `src/App.tsx` — maintain latest committed references and route governed mutations through commit-first semantics;
- focused new or extended tests under `src/security/`.

No component redesign is expected.

## 13. Migration and compatibility

No data migration is required.

Existing IndexedDB stores and encrypted records remain readable without conversion. The new atomic primitive changes only how multiple existing records are written together.

Existing backups remain compatible because payload schemas and record keys do not change.

## 14. Rollback strategy

The implementation is structurally reversible:

- no database migration;
- no schema bump;
- no data rewrite;
- no deployment required for qualification.

If PERSIST-01 is rejected before merge, `main` remains unaffected. If a future revert is required after merge, the code can be reverted without transforming stored data.

## 15. Governance and stop rules

PERSIST-01 must stop rather than expand scope if implementation reveals a requirement for:

- a new persisted record schema;
- cloud synchronization;
- cross-device coordination;
- a new background retry subsystem;
- a broad Student Portal redesign;
- modification of encryption primitives or key management.

Any such requirement becomes a separate design decision.

## 16. Completion criteria

PERSIST-01 is engineering-qualified when:

- all eight invariants are covered by tests or direct evidence;
- atomic `appData + meta` persistence is proven;
- all governed React mutation paths are commit-first;
- FIFO and latest-committed-state derivation are proven;
- failure isolation is proven;
- no false success/navigation remains on persistence failure;
- full PREDEPLOY is PASS on the exact head;
- independent final review is PASS with zero unresolved significant findings;
- no deploy has occurred unless separately authorized.

At that point the only remaining action is a separate merge decision.
