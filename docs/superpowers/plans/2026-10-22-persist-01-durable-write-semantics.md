# PERSIST-01 Durable Write Semantics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every governed teacher mutation durable before it becomes committed React state, with atomic `appData + meta` persistence, FIFO ordering, failure isolation, and no false-success UI.

**Architecture:** Add one atomic multi-record write primitive at the IndexedDB/Vault boundary, expose an application-level `saveAppDataAndMeta` domain commit, and route governed React mutations through a small generic FIFO coordinator. React publishes candidates only after persistence succeeds; queued mutations derive from explicit committed-state refs at execution time rather than render-time closures.

**Tech Stack:** TypeScript 7, React 19, Bun test runner, IndexedDB, Web Crypto, Vite 8, Express production startup smoke.

**Spec:** `docs/superpowers/specs/2026-10-22-persist-01-durable-write-semantics-design.md`

## Global Constraints

- Product baseline is `main@8afb734a184403f03153d493e1ea677f6d1e5abb`; implementation must start from the approved spec/plan branch head or a later qualified `main` containing these docs. Record the exact execution baseline before touching product code.
- No change to AES-GCM, PBKDF2, vault key hierarchy, `VaultRecordKey`, encrypted record schema, IndexedDB database version, or persisted payload schemas.
- No new cloud persistence, synchronization, background retry subsystem, or Student Portal redesign.
- No plaintext fallback for sensitive data.
- `settings` persistence remains sanitized through `sanitizePersistedSettings`; session-only secrets may remain in committed React memory but must not be persisted.
- `ONLINE-01` remains separate: PERSIST-01 preserves the async submission contract but does not redesign the student-facing success screen.
- No new runtime dependency is expected.
- No deploy or merge is implied by engineering qualification.
- TDD order is mandatory: test-only RED → minimal GREEN → focused regression → commit.
- Existing PREDEPLOY contract remains authoritative: `bun run lint`, `bun run test:security`, `bun run build`, production startup smoke.

## Review Focus

1. **Two rapid mutations in one domain:** the second derives from the first successfully committed result, never a stale render snapshot. Task 3 pins FIFO execution; Tasks 4–5 pin committed refs.
2. **First mutation fails, second succeeds:** failed candidate never publishes, queue continues, second derives from last committed state. Task 3 owns the runtime proof.
3. **Atomic pair failure:** `appData + meta` must both change or neither change. Tasks 1–2 pin one-batch persistence and all-or-nothing domain semantics.
4. **Settings with a session-only API key:** persisted settings strip the key while React publishes the logical candidate only after persistence succeeds. Tasks 2 and 5 pin both sides.
5. **Vault locked before queued work executes:** persistence rejects, no publish/success UI occurs, and later valid work can still run. Tasks 3 and 5 pin this failure mode.

---

## File Structure

### Create

- `src/persistence/durableMutationCoordinator.ts` — generic FIFO coordinator; no React/domain imports.
- `src/security/durableMutationCoordinator.test.ts` — runtime ordering/failure tests.
- `src/security/durableAppMutationIntegrity.test.ts` — narrow App source/integration contract for commit-first wiring.

### Modify

- `src/security/vaultStore.ts` — atomic `putRecords` primitive.
- `src/security/secureVault.ts` — serialized `putMany`.
- `src/security/secureVault.test.ts` — batch and queue tests; update test double.
- `src/security/secureAppStorage.ts` — `saveAppDataAndMeta`.
- `src/security/secureAppStorage.test.ts` — coupled commit + sanitation tests; update test double.
- `src/security/backupRestore.test.ts` — update `VaultStore` test double only; preserve restore behavior.
- `src/security/legacyMigration.test.ts` — update `VaultStore` test double only; preserve migration behavior.
- `src/App.tsx` — committed refs, coordinator wiring, commit-first handlers.
- `src/security/appVaultWiring.test.ts` — extend only if an existing assertion is the right home.

No component redesign is expected.

---

### Task 1: Atomic multi-record Vault boundary

**Files:**
- Modify: `src/security/vaultStore.ts`
- Modify: `src/security/secureVault.ts`
- Modify/Test: `src/security/secureVault.test.ts`
- Modify/Test-double compatibility: `src/security/backupRestore.test.ts`
- Modify/Test-double compatibility: `src/security/legacyMigration.test.ts`
- Modify/Test-double compatibility: `src/security/secureAppStorage.test.ts`

**Interfaces:**
- Produces: `VaultStore.putRecords(records: EncryptedVaultRecord[]): Promise<void>`
- Produces: `SecureVault.putMany(entries: readonly VaultWriteEntry[]): Promise<void>`
- Produces: `export interface VaultWriteEntry { key: VaultRecordKey; value: unknown; schemaVersion?: number }`
- Preserves: `VaultStore.putRecord(record)` and `SecureVault.put(key, value, schemaVersion?)`.

- [ ] **Step 1: Write the RED batch contract**

In `src/security/secureVault.test.ts`, extend its `MemoryVaultStore` with a `putRecords` call counter and add `writes a logical batch through one store batch call`.

Assertions:
- `vault.putMany` with `appData` and `meta` causes exactly one store batch call;
- both records are readable after success;
- legacy single-record `vault.put` still works.

- [ ] **Step 2: Verify RED**

Run:

```bash
bun test src/security/secureVault.test.ts
```

Expected: FAIL because `putRecords` / `putMany` do not exist.

- [ ] **Step 3: Add `VaultStore.putRecords` and update every interface implementation**

Add:

```ts
putRecords(records: EncryptedVaultRecord[]): Promise<void>;
```

Update every `VaultStore` implementation/test double found by repository search:
- production `IndexedDbVaultStore`;
- `MemoryVaultStore` in `secureVault.test.ts`;
- `MemoryVaultStore` in `secureAppStorage.test.ts`;
- `RestoreTestStore` in `backupRestore.test.ts`;
- `MemoryVaultStore` in `legacyMigration.test.ts`.

Test doubles may implement atomic batch semantics by staging copies then swapping only on success; preserve any existing fault-injection counters used by restore/migration tests.

- [ ] **Step 4: Implement one IndexedDB transaction**

For `IndexedDbVaultStore.putRecords(records)`:
- open exactly one `db.transaction(RECORDS_STORE, 'readwrite')`;
- issue every `put` against that transaction's object store;
- await all request results and `transactionDone(tx)`;
- reject on request failure or abort;
- make `putRecord(record)` delegate to `putRecords([record])`.

No DB version or object-store change.

- [ ] **Step 5: Add `SecureVault.putMany`**

Add:

```ts
export interface VaultWriteEntry {
  key: VaultRecordKey;
  value: unknown;
  schemaVersion?: number;
}

putMany(entries: readonly VaultWriteEntry[]): Promise<void>
```

Required semantics:
- `requireUnlocked()` before mutation;
- run through existing `enqueueMutation`;
- encrypt the complete entry set before calling storage;
- only after all encryption succeeds call `store.putRecords(records)` once;
- preserve one queue for single and batch writes.

- [ ] **Step 6: Pin encrypt-before-write and failure isolation**

Add tests:

`does not call putRecords when one entry cannot be encrypted`
- force serialization/encryption failure with a non-serializable candidate accepted by TypeScript as `unknown`;
- assert batch call count is zero.

`a rejected batch does not poison a later vault mutation`
- first batch rejects;
- later valid `put` succeeds and is readable.

- [ ] **Step 7: Add a structural regression guard for concrete IndexedDB atomicity**

Read `src/security/vaultStore.ts` in a focused source-contract test and assert:
- `putRecords` exists;
- the batch method opens one `db.transaction(RECORDS_STORE, 'readwrite')`;
- `putRecord` delegates to `putRecords([record])`;
- `putRecords` does not loop by calling `putRecord`.

This guards the concrete transaction shape; runtime tests guard queue behavior.

- [ ] **Step 8: Run focused regression and commit**

Run:

```bash
bun test src/security/secureVault.test.ts src/security/backupRestore.test.ts src/security/legacyMigration.test.ts src/security/secureAppStorage.test.ts
bun run lint
```

Expected: PASS.

Commit:

```bash
git add src/security/vaultStore.ts src/security/secureVault.ts src/security/secureVault.test.ts src/security/backupRestore.test.ts src/security/legacyMigration.test.ts src/security/secureAppStorage.test.ts
git commit -m "feat(persist-01): add atomic vault batch writes"
```

---

### Task 2: Atomic `appData + meta` domain commit

**Files:**
- Modify: `src/security/secureAppStorage.ts`
- Modify/Test: `src/security/secureAppStorage.test.ts`

**Interfaces:**
- Consumes: `SecureVault.putMany(entries)` from Task 1.
- Produces: `SecureAppStorage.saveAppDataAndMeta(appData: AppData, meta: SecureMeta): Promise<void>`
- Preserves all existing single-domain save methods and `restoreSnapshotVerified`.

- [ ] **Step 1: Write the RED domain-commit test**

Add `commits appData and meta through one vault batch`.

Assertions:
- active vault;
- call `saveAppDataAndMeta({ classes: [], currentClassId: null }, { changes: 3, lastBackup: null })`;
- snapshot contains both values;
- test double records one batch containing `appData` and `meta`.

- [ ] **Step 2: Verify RED**

```bash
bun test src/security/secureAppStorage.test.ts
```

Expected: FAIL because method is absent.

- [ ] **Step 3: Implement `saveAppDataAndMeta`**

```ts
saveAppDataAndMeta(appData: AppData, meta: SecureMeta): Promise<void>
```

Implementation: exactly one `vault.putMany` containing the two existing record keys. Keep `saveAppData` and `saveMeta` for restore/compatibility paths.

- [ ] **Step 4: Preserve settings sanitation and restore semantics**

Tests must continue proving:
- `saveSettings` strips `embeddingConfig.apiKey` from persisted data;
- `restoreSnapshotVerified` behavior is unchanged;
- `loadSnapshot` returns all six logical datasets.

No byte-for-byte equality requirement between logical in-memory settings and sanitized persisted settings.

- [ ] **Step 5: Run regression and commit**

```bash
bun test src/security/secureAppStorage.test.ts src/security/backupRestore.test.ts
bun run lint
```

Expected: PASS.

```bash
git add src/security/secureAppStorage.ts src/security/secureAppStorage.test.ts
git commit -m "feat(persist-01): add atomic app data commit"
```

---

### Task 3: Generic durable mutation coordinator

**Files:**
- Create: `src/persistence/durableMutationCoordinator.ts`
- Create/Test: `src/security/durableMutationCoordinator.test.ts`

**Interfaces:**

```ts
export interface DurableMutation<T> {
  getCommitted: () => T;
  derive: (committed: T) => T;
  persist: (candidate: T, previous: T) => Promise<void>;
  publish: (candidate: T, previous: T) => void;
  afterCommit?: (candidate: T, previous: T) => void;
}

export interface DurableMutationCoordinator {
  enqueue<T>(mutation: DurableMutation<T>): Promise<T>;
}

export function createDurableMutationCoordinator(): DurableMutationCoordinator;
```

Constraint: no React/domain imports.

- [ ] **Step 1: RED — publication waits for persistence**

Test `publishes only after persistence resolves`:
- block persist;
- assert publish/afterCommit not called;
- release persist;
- assert publish runs before afterCommit.

- [ ] **Step 2: RED — queued work reads committed state at execution time**

Test `reads committed state when queued work starts`:
- enqueue A and block it;
- enqueue B;
- A publishes value `1` into a holder;
- B's `getCommitted` reads `1`;
- final holder is `2`.

Run:

```bash
bun test src/security/durableMutationCoordinator.test.ts
```

Expected: FAIL because module is absent.

- [ ] **Step 3: Implement minimal FIFO coordinator**

Use one internal `tail: Promise<void> = Promise.resolve()`.

For `enqueue`:
- chain `run` from `tail.then(run, run)`;
- inside `run`: `getCommitted` → `derive` → `await persist` → `publish` → `afterCommit`;
- return candidate;
- update `tail` from the run promise with both fulfillment/rejection mapped to `undefined`;
- propagate operation rejection to its own caller.

- [ ] **Step 4: Pin failure isolation and original-error propagation**

Tests:
- `does not publish a rejected candidate and later work still runs`;
- `caller receives the original persistence error`.

The second successful operation must derive from the unchanged committed holder after the first failure.

- [ ] **Step 5: Run and commit**

```bash
bun test src/security/durableMutationCoordinator.test.ts
bun run lint
```

Expected: PASS.

```bash
git add src/persistence/durableMutationCoordinator.ts src/security/durableMutationCoordinator.test.ts
git commit -m "feat(persist-01): add durable mutation coordinator"
```

---

### Task 4: Route `appData + meta` mutations through commit-first semantics

**Files:**
- Modify: `src/App.tsx`
- Create/Test: `src/security/durableAppMutationIntegrity.test.ts`
- Modify/Test: `src/security/appVaultWiring.test.ts` only where existing wiring assertions are the better home.

**Interfaces:**
- Consumes coordinator from Task 3.
- Consumes `secureStorage.saveAppDataAndMeta` from Task 2.
- Produces App-local committed refs for `appData`/`meta` and one `commitAppDataMutation` helper.

- [ ] **Step 1: Write RED integrity assertions**

Create `durableAppMutationIntegrity.test.ts` and assert the target state:
- App uses `saveAppDataAndMeta`;
- legacy `Promise.all([saveAppData, saveMeta])` path is absent;
- canonical failure copy exists: `Salvataggio non riuscito. La modifica non è stata applicata.`;
- success navigation/toasts for persistent mutations are not executed immediately after enqueue;
- `Importazione completata con successo!` is post-commit only.

Keep assertions narrow; no whole-file snapshots.

- [ ] **Step 2: Verify RED**

```bash
bun test src/security/durableAppMutationIntegrity.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Add stable coordinator and committed refs**

In `App.tsx`:
- create one coordinator instance per App instance using `useRef` or equivalent;
- create committed refs initialized from the same initial values as React `appData` and `meta`;
- update refs only during successful publish;
- never use render-time `appData`/`meta` closures as queued `getCommitted` sources.

- [ ] **Step 4: Replace `persistAppData(newAppData, showModal)` with a derive-based helper**

Target interface:

```ts
commitAppDataMutation(
  derive: (current: AppData) => AppData,
  options?: {
    showBackupModal?: boolean;
    successMessage?: string;
    afterCommit?: () => void;
  }
): Promise<AppData>
```

Required behavior:
- derive `nextMeta.changes` from committed meta at execution time;
- persist via one `saveAppDataAndMeta` call;
- publish refs + React only after success;
- success toast/modal/navigation/alerts only after publish;
- on failure log technical detail, show canonical teacher message, reject caller promise.

- [ ] **Step 5: Migrate every `appData` mutation**

Migrate:
- add/delete class;
- save evaluations;
- save behaviors;
- delete batch;
- add/remove/bulk-add/invert students;
- import submissions to register.

Capture only user intent (IDs/input payload). Perform class/array lookup inside `derive(current)`, not against render-time `appData` or `currentClass`.

Move persistence-dependent effects into `afterCommit`, including evaluation/behavior navigation, creation/deletion success toasts, backup modal, and import-success alert.

- [ ] **Step 6: Pin post-commit ordering structurally**

Tests must assert:
- no direct `saveAppData` + `saveMeta` pair remains;
- helper accepts a derive callback, not precomputed `AppData`;
- success strings for class/student/evaluation/import flows sit behind the post-commit path.

- [ ] **Step 7: Run and commit**

```bash
bun test src/security/durableMutationCoordinator.test.ts src/security/durableAppMutationIntegrity.test.ts src/security/appVaultWiring.test.ts
bun run lint
```

Expected: PASS.

```bash
git add src/App.tsx src/security/durableAppMutationIntegrity.test.ts src/security/appVaultWiring.test.ts
git commit -m "feat(persist-01): commit register mutations after vault writes"
```

---

### Task 5: Route settings, UDA, tests, and submissions through the durable queue

**Files:**
- Modify: `src/App.tsx`
- Modify/Test: `src/security/durableAppMutationIntegrity.test.ts`
- Modify/Test: `src/security/secureAppStorage.test.ts` only if needed for explicit sanitation coverage.

**Interfaces:**
- Consumes coordinator from Task 3.
- Produces committed refs and commit-first helpers for `settings`, `udas`, `tests`, `submissions`.
- Preserves: `handleSaveStudentSubmission(submission): Promise<void>` contract.

- [ ] **Step 1: RED — remaining optimistic paths must disappear**

Add assertions that fail while App still performs any of these:
- `setTests` before `saveCustomTests`;
- `setUdas` before `saveUdas`;
- `setSettings` before `saveSettings`;
- `setSubmissions` before `saveSubmissions` in append/delete;
- console-only handling as the sole visible response to save failure.

- [ ] **Step 2: Add committed refs for remaining domains**

Initialize refs from the same initial values as React state. Every queued `getCommitted` reads `.current` at execution time. Update `.current` only after persistence success.

- [ ] **Step 3: Migrate settings**

For `handleUpdateSettings(newSettings)`:
- logical candidate is `newSettings`;
- persist via `saveSettings(candidate)` so the storage boundary sanitizes secrets;
- after success publish original logical candidate to ref + React;
- on failure preserve previous settings/theme and show canonical error;
- never read back sanitized settings into React merely to prove persistence.

- [ ] **Step 4: Migrate UDA and custom tests**

- UDA: persist supplied complete candidate before publish.
- Tests: derive from latest committed tests ref: `current => ({ ...current, [newTest.id]: newTest })`.
- Success toast only post-commit.

- [ ] **Step 5: Migrate submission append/delete**

Append:
- derive from latest committed submissions;
- persist before publish;
- preserve async promise contract to `StudentPortal`;
- remove optimistic publish + rollback.

Delete:
- derive filter from latest committed submissions;
- success toast only post-commit.

Do not change StudentPortal result wording/timing; that remains `ONLINE-01`.

- [ ] **Step 6: Run and commit**

```bash
bun test src/security/durableMutationCoordinator.test.ts src/security/durableAppMutationIntegrity.test.ts src/security/secureAppStorage.test.ts
bun run lint
```

Expected: PASS.

```bash
git add src/App.tsx src/security/durableAppMutationIntegrity.test.ts src/security/secureAppStorage.test.ts
git commit -m "feat(persist-01): make remaining vault writes commit first"
```

---

### Task 6: Whole-branch qualification and independent review gate

**Files:**
- No new product files expected unless a valid review finding creates a new RED.
- Evidence goes in the implementation PR body/comments, not by rewriting the approved spec into a completion receipt.

**Interfaces:**
- Produces one exact qualified implementation head and one independent review result.

- [ ] **Step 1: Run full local qualification**

```bash
bun run test:security
bun run lint
bun run build
set +e
NODE_ENV=production PORT=0 timeout 5s node server.ts
code=$?
if [[ "$code" -eq 124 ]]; then exit 0; fi
exit "$code"
```

Expected: tests/typecheck/build/startup smoke PASS.

- [ ] **Step 2: Audit final diff against spec**

Confirm:
- no DB/schema migration;
- no crypto/key changes;
- no plaintext writes;
- no cloud/retry/Student Portal redesign;
- no new runtime dependency;
- `restoreSnapshotVerified` behavior preserved;
- only planned code/tests changed.

Remove scope leakage before qualification.

- [ ] **Step 3: Decide whether browser failure injection is necessary**

Browser verification becomes mandatory only if final implementation changes teacher-visible timing/navigation in a way the coordinator runtime tests plus App integrity tests do not fully prove.

If required, verify at minimum:
- successful evaluation navigation happens only after durable success;
- forced persistence failure leaves current state/screen unchanged;
- canonical error appears;
- no success toast appears.

If not required, record the evidence showing why the behavior is already fully covered.

- [ ] **Step 4: Push one exact head and require PREDEPLOY PASS**

Record exact SHA, PREDEPLOY run number/ID, test totals, typecheck/build/startup conclusions. Do not qualify a moving head.

- [ ] **Step 5: Independent Codex review on the same exact head**

Review focus:
- IndexedDB transaction atomicity;
- encrypt-before-write;
- FIFO/failure isolation;
- stale closure/ref correctness;
- settings secret sanitation;
- false-success/navigation regressions;
- scope leakage.

Required before merge decision: review completed with zero unresolved significant findings. Any valid finding becomes a new RED, minimal fix, and full requalification on the new exact head.

- [ ] **Step 6: Stop at merge decision**

Terminal state:

`PERSIST-01 = ENGINEERING QUALIFIED / INDEPENDENT REVIEW PASS / READY FOR MERGE DECISION`

No merge and no deploy without separate authorization.

## Plan Review Result

Self-review completed on 2026-10-22:

- spec coverage: complete;
- interface/type consistency: checked;
- every `VaultStore` implementation/test double identified by repository search is included;
- no placeholder requirements;
- no dependency addition required by the plan;
- `ONLINE-01`, deployment and crypto changes remain explicitly out of scope.

## Execution Handoff

Execution method is intentionally not selected by this document. After human review of the plan, choose either:

- **Subagent-driven** — fresh implementer/reviewer per task, then whole-branch review;
- **Native** — one implementation session task-by-task, then one independent whole-branch review.

For PERSIST-01, **Native is recommended** because Tasks 1–5 form a tight interface chain (`VaultStore` → `SecureVault` → `SecureAppStorage` → coordinator → `App.tsx`), so keeping one implementation context reduces integration drift; the final exact-head Codex review remains mandatory.
