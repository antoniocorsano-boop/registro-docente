# PERSIST-01 Durable Write Semantics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every governed teacher mutation durable before it becomes committed React state, with atomic `appData + meta` persistence, FIFO ordering, failure isolation, and no false-success UI.

**Architecture:** Add one atomic multi-record write primitive at the IndexedDB/Vault boundary, expose an application-level `saveAppDataAndMeta` domain commit, and route governed React mutations through a small generic FIFO coordinator. React publishes candidates only after persistence succeeds; queued mutations derive from explicit committed-state refs at execution time rather than from render-time closures.

**Tech Stack:** TypeScript 7, React 19, Bun test runner, IndexedDB, Web Crypto, Vite 8, Express production startup smoke.

**Spec:** `docs/superpowers/specs/2026-10-22-persist-01-durable-write-semantics-design.md`

## Global Constraints

- Baseline for the implementation branch: `main@8afb734a184403f03153d493e1ea677f6d1e5abb`, unless `main` advances before execution; if it advances, rebase/recreate the isolated worktree from the then-current qualified `main` and record the new baseline before writing code.
- No change to AES-GCM, PBKDF2, vault key hierarchy, `VaultRecordKey`, encrypted record schema, IndexedDB database version, or persisted payload schemas.
- No new cloud persistence, synchronization, background retry subsystem, or Student Portal redesign.
- No plaintext fallback for sensitive data.
- `settings` persistence remains sanitized through `sanitizePersistedSettings`; session-only secrets may remain in committed React memory but must not be persisted.
- `ONLINE-01` remains separate: PERSIST-01 preserves the async submission contract but does not redesign the student-facing success screen.
- No deploy or merge is implied by engineering qualification.
- TDD order is mandatory: test-only RED → minimal GREEN → focused regression → commit.
- Existing PREDEPLOY contract remains authoritative: `bun run lint`, `bun run test:security`, `bun run build`, and production startup smoke.

## Review Focus

1. **Two rapid mutations in the same domain:** the second must derive from the first successfully committed result, not from a stale render snapshot. Task 3 pins FIFO execution; Task 4 pins `appData` derivation through committed refs.
2. **First mutation fails, second succeeds:** the failed candidate must never publish and must not poison the queue; the second executes against the last committed state. Task 3 owns this test.
3. **Atomic pair failure:** a failed `appData + meta` batch must leave both records on the previous values. Tasks 1–2 pin batch usage and all-or-nothing domain semantics.
4. **Settings with a session-only API key:** persistence must strip the key while React may publish the logical candidate only after sanitized persistence succeeds. Tasks 2 and 5 pin both sides of this boundary.
5. **Vault becomes locked before a queued mutation executes:** persistence rejection must prevent publication/success UI, and the queue must remain usable for a later valid operation. Tasks 3 and 5 pin this behavior.

---

## File Structure

### New files

- `src/persistence/durableMutationCoordinator.ts` — generic FIFO coordinator; no React imports and no domain business logic.
- `src/security/durableMutationCoordinator.test.ts` — runtime tests for ordering, execution-time state reads, rejection isolation, and publication timing.
- `src/security/durableAppMutationIntegrity.test.ts` — source/integration contract ensuring `App.tsx` uses the durable path and no legacy fire-and-forget save patterns remain.

### Modified files

- `src/security/vaultStore.ts` — add atomic `putRecords` storage primitive; keep `putRecord` compatibility.
- `src/security/secureVault.ts` — add serialized `putMany` after encrypting the full batch.
- `src/security/secureVault.test.ts` — update test doubles and add batch/queue tests.
- `src/security/secureAppStorage.ts` — add `saveAppDataAndMeta`; preserve settings sanitization and verified restore.
- `src/security/secureAppStorage.test.ts` — prove coupled commit and settings sanitization.
- `src/App.tsx` — add committed-state refs, coordinator wiring, commit-first mutation helpers, and migrate governed handlers.

No component redesign or dependency addition is expected.

---

### Task 1: Atomic multi-record Vault boundary

**Files:**
- Modify: `src/security/vaultStore.ts`
- Modify: `src/security/secureVault.ts`
- Modify/Test: `src/security/secureVault.test.ts`

**Interfaces:**
- Produces: `VaultStore.putRecords(records: EncryptedVaultRecord[]): Promise<void>`
- Produces: `SecureVault.putMany(entries: readonly VaultWriteEntry[]): Promise<void>`
- Produces: `export interface VaultWriteEntry { key: VaultRecordKey; value: unknown; schemaVersion?: number }`
- Preserves: `VaultStore.putRecord(record)` and `SecureVault.put(key, value, schemaVersion?)`

- [ ] **Step 1: Write the RED contract for the storage interface and test doubles**

Extend the `MemoryVaultStore` and `BlockingVaultStore` test doubles in `src/security/secureVault.test.ts` with `putRecords(records)` and add a test named:

`writes a logical batch through one store batch call`

Assertions:
- `SecureVault.putMany([{ key: 'appData', ... }, { key: 'meta', ... }])` results in exactly one `putRecords` call;
- both records are subsequently readable through `vault.get`;
- `put` still works for one record.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
bun test src/security/secureVault.test.ts
```

Expected: FAIL because `VaultStore.putRecords` / `SecureVault.putMany` do not exist.

- [ ] **Step 3: Add `VaultStore.putRecords` and implement one IndexedDB transaction**

In `src/security/vaultStore.ts`:

```ts
putRecords(records: EncryptedVaultRecord[]): Promise<void>;
```

Implementation requirements for `IndexedDbVaultStore.putRecords`:
- open one `db.transaction(RECORDS_STORE, 'readwrite')`;
- issue all `put` requests against that transaction's `records` store;
- await all request results and `transactionDone(tx)`;
- reject on request failure or transaction abort;
- make existing `putRecord(record)` delegate to `putRecords([record])`.

Do not change the database version or object stores.

- [ ] **Step 4: Add `SecureVault.putMany` with encrypt-before-write semantics**

In `src/security/secureVault.ts` add:

```ts
export interface VaultWriteEntry {
  key: VaultRecordKey;
  value: unknown;
  schemaVersion?: number;
}

putMany(entries: readonly VaultWriteEntry[]): Promise<void>
```

Required algorithm:
- call `requireUnlocked()` before enqueueing;
- inside the existing `enqueueMutation`, encrypt every entry first with `encryptJsonRecord`;
- only after the entire encrypted array exists, call `store.putRecords(records)` once;
- change `put` to delegate through `putMany([{ key, value, schemaVersion }])` or preserve equivalent single-record behavior through the same queue path.

- [ ] **Step 5: Add RED/GREEN tests for encrypt-before-write and queue isolation**

Add tests:

`does not call putRecords when one entry cannot be encrypted`
- use a value that causes JSON serialization/encryption to reject (for example a `BigInt` payload if the crypto helper rejects it);
- assert `putRecords` call count remains zero.

`a rejected batch does not poison a later vault mutation`
- make the first `putRecords` reject;
- make a second valid `put` succeed;
- assert the second value is readable.

Run:

```bash
bun test src/security/secureVault.test.ts
```

Expected: PASS.

- [ ] **Step 6: Add a structural guard for the IndexedDB atomic path**

Add one test to `src/security/secureVault.test.ts` (or a focused source-contract test if clearer) that reads `src/security/vaultStore.ts` and asserts:
- `putRecords` exists;
- it opens `db.transaction(RECORDS_STORE, 'readwrite')` once within the batch method;
- `putRecord` delegates to `putRecords([record])`;
- the batch method does not call `putRecord` in a loop.

This is a regression guard for the concrete IndexedDB implementation; behavioral queue tests remain runtime tests.

- [ ] **Step 7: Run focused regression and commit**

Run:

```bash
bun test src/security/secureVault.test.ts
bun run lint
```

Expected: PASS.

Commit:

```bash
git add src/security/vaultStore.ts src/security/secureVault.ts src/security/secureVault.test.ts
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
- Preserves: `saveAppData`, `saveMeta`, `saveSettings`, `restoreSnapshotVerified`.

- [ ] **Step 1: Write the failing domain-commit test**

In `src/security/secureAppStorage.test.ts`, update `MemoryVaultStore` for the new `VaultStore.putRecords` interface and add:

`commits appData and meta through one vault batch`

Assertions:
- initialize active vault;
- call `saveAppDataAndMeta({ classes: [], currentClassId: null }, { changes: 3, lastBackup: null })`;
- read snapshot;
- both values match;
- the test double records one batch containing keys `appData` and `meta` in that order.

- [ ] **Step 2: Verify RED**

Run:

```bash
bun test src/security/secureAppStorage.test.ts
```

Expected: FAIL because `saveAppDataAndMeta` is missing.

- [ ] **Step 3: Implement the domain commit**

Add to `SecureAppStorage`:

```ts
saveAppDataAndMeta(appData: AppData, meta: SecureMeta): Promise<void>
```

Implementation requirement: exactly one `vault.putMany` containing `appData` and `meta`.

Do not replace the independent methods because verified restore and other code may still need them.

- [ ] **Step 4: Pin settings sanitation and restore compatibility**

Keep/update tests so that:
- `saveSettings` still strips `embeddingConfig.apiKey` from persisted data;
- `restoreSnapshotVerified` tests remain unchanged and pass;
- `loadSnapshot` still returns all six logical datasets.

Add no byte-for-byte equality requirement between in-memory settings and sanitized persisted settings.

- [ ] **Step 5: Run focused regression and commit**

Run:

```bash
bun test src/security/secureAppStorage.test.ts src/security/backupRestore.test.ts
bun run lint
```

Expected: PASS.

Commit:

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
- Produces:

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

- Constraint: module has no React imports and no domain-specific imports.

- [ ] **Step 1: Write RED tests for execution order and publication timing**

Create `src/security/durableMutationCoordinator.test.ts` with tests:

`publishes only after persistence resolves`
- block `persist` on a promise;
- assert `publish` and `afterCommit` have not run;
- release persistence;
- assert `publish` then `afterCommit` run in order.

`reads committed state when queued work starts`
- enqueue A and block it;
- enqueue B;
- A publishes committed value `1` to a test holder;
- B's `getCommitted` must read `1`, not the value from B's enqueue time;
- final value is `2`.

- [ ] **Step 2: Verify RED**

Run:

```bash
bun test src/security/durableMutationCoordinator.test.ts
```

Expected: FAIL because the coordinator module is missing.

- [ ] **Step 3: Implement the minimal FIFO coordinator**

Use one internal `tail: Promise<void> = Promise.resolve()`.

For each `enqueue`:
- chain work from `tail.then(run, run)`;
- inside `run`, call `getCommitted()`, `derive()`, `await persist()`, `publish()`, then `afterCommit?.()`;
- return the candidate to the caller;
- reset `tail` from the run promise with both fulfillment and rejection mapped to `undefined` so one failure cannot poison later work;
- propagate the operation's own rejection to its caller.

- [ ] **Step 4: Add failure-isolation and locked-Vault-style rejection tests**

Add tests:

`does not publish a rejected candidate and later work still runs`
- first persist rejects;
- assert first `publish` and `afterCommit` never run;
- second mutation succeeds against unchanged committed holder.

`caller receives the original persistence error`
- reject with a sentinel error;
- assert `enqueue` rejects with that error rather than swallowing it.

- [ ] **Step 5: Run focused tests and commit**

Run:

```bash
bun test src/security/durableMutationCoordinator.test.ts
bun run lint
```

Expected: PASS.

Commit:

```bash
git add src/persistence/durableMutationCoordinator.ts src/security/durableMutationCoordinator.test.ts
git commit -m "feat(persist-01): add durable mutation coordinator"
```

---

### Task 4: Route `appData + meta` mutations through commit-first semantics

**Files:**
- Modify: `src/App.tsx`
- Create/Test: `src/security/durableAppMutationIntegrity.test.ts`
- Modify/Test: `src/security/appVaultWiring.test.ts` only if existing wiring assertions need extension rather than duplication.

**Interfaces:**
- Consumes: `createDurableMutationCoordinator()` from Task 3.
- Consumes: `secureStorage.saveAppDataAndMeta(appData, meta)` from Task 2.
- Produces inside `App`: one committed-state holder for `appData` and `meta`, plus a single `commitAppDataMutation` helper used by all governed `appData` handlers.

- [ ] **Step 1: Write the RED source/integration contract for legacy unsafe patterns**

Create `src/security/durableAppMutationIntegrity.test.ts` and assert current `App.tsx` fails these requirements:
- contains `saveAppDataAndMeta` after implementation;
- does not contain the legacy `Promise.all([ secureStorage.saveAppData(...), secureStorage.saveMeta(...) ])` persistence path;
- contains the canonical failure copy `Salvataggio non riuscito. La modifica non è stata applicata.`;
- class/student/evaluation/behavior/import handlers no longer call success toast/navigation immediately after invoking `persistAppData`;
- the import-success alert `Importazione completata con successo!` is emitted only from a post-commit callback path.

Keep assertions structural and narrow; do not snapshot the whole component.

- [ ] **Step 2: Verify RED**

Run:

```bash
bun test src/security/durableAppMutationIntegrity.test.ts
```

Expected: FAIL on the legacy persistence and post-save behavior.

- [ ] **Step 3: Add committed-state refs and one coordinator instance**

In `App.tsx`:
- import `useRef` if not already imported;
- create the coordinator exactly once per App instance using a ref or equivalent stable holder;
- add committed refs initialized from the same initial values used by React state for `appData` and `meta`;
- update those refs synchronously only in the successful publish phase.

Do not use render-time `appData` / `meta` closures as `getCommitted` sources for queued mutations.

- [ ] **Step 4: Replace `persistAppData(newAppData, showModal)` with a mutation-based helper**

Define an App-local helper with an interface equivalent to:

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
- `getCommitted` reads the committed refs at execution time;
- `derive` is called inside the coordinator execution;
- `nextMeta.changes = (previousMeta.changes || 0) + 1` is derived from the committed meta ref;
- `persist` calls `secureStorage.saveAppDataAndMeta(candidateAppData, candidateMeta)`;
- `publish` updates committed refs and React `appData`/`meta` only after persistence succeeds;
- post-commit success toast, backup modal, navigation, and alerts execute only after publish;
- catch logs technical detail and shows exactly `Salvataggio non riuscito. La modifica non è stata applicata.`;
- the returned promise rejects after user-facing failure handling so callers that need composition can still detect failure.

- [ ] **Step 5: Migrate every `appData` mutation to derive from latest committed state**

Migrate these handlers:
- add/delete class;
- save evaluations;
- save behaviors;
- delete evaluation batch;
- add/remove/bulk-add/invert students;
- import submissions into register.

For each handler:
- capture only the user intent needed to identify the target (IDs, entered values, batch payload);
- perform array/class lookups inside the `derive(current)` function;
- do not build `nextAppData` from render-time `appData` or `currentClass` before enqueueing.

Move these effects to `afterCommit` when they signify successful persistence:
- evaluation navigation to `storico`;
- behavior navigation to `dashboard`;
- class creation navigation to `dati` where applicable;
- success toasts;
- import-success alert.

Pure navigation actions that do not mutate persistent records remain outside PERSIST-01.

- [ ] **Step 6: Add focused tests for post-commit ordering**

Extend `durableAppMutationIntegrity.test.ts` to pin:
- no direct `secureStorage.saveAppData(` + `saveMeta(` pair remains in `App.tsx`;
- `saveAppDataAndMeta` is the coupled persistence method;
- `commitAppDataMutation` accepts a derive callback rather than a precomputed `AppData` candidate;
- success strings `Classe creata`, `Valutazione eliminata`, `Alunno inserito`, `Alunno rimosso`, `Nomi invertiti`, and `Importazione completata con successo!` are associated with the post-commit path, not immediately after enqueue.

- [ ] **Step 7: Run focused regression and commit**

Run:

```bash
bun test src/security/durableMutationCoordinator.test.ts src/security/durableAppMutationIntegrity.test.ts src/security/appVaultWiring.test.ts
bun run lint
```

Expected: PASS.

Commit:

```bash
git add src/App.tsx src/security/durableAppMutationIntegrity.test.ts src/security/appVaultWiring.test.ts
git commit -m "feat(persist-01): commit register mutations after vault writes"
```

---

### Task 5: Route settings, UDA, tests, and submissions through the same durable queue

**Files:**
- Modify: `src/App.tsx`
- Modify/Test: `src/security/durableAppMutationIntegrity.test.ts`
- Modify/Test: `src/security/secureAppStorage.test.ts` if additional settings sanitation coverage is needed.

**Interfaces:**
- Consumes: coordinator from Task 3.
- Produces: committed refs and commit-first helpers for `settings`, `udas`, `tests`, and `submissions`.
- Preserves: `handleSaveStudentSubmission(submission): Promise<void>` async contract expected by `StudentPortal`.

- [ ] **Step 1: Add RED assertions for remaining fire-and-forget paths**

Extend `durableAppMutationIntegrity.test.ts` so it fails while `App.tsx` still contains any of these legacy forms:
- `setTests(updatedTests)` before `secureStorage.saveCustomTests`;
- `setUdas(newUdas)` before `secureStorage.saveUdas`;
- `setSettings(newSettings)` before `secureStorage.saveSettings`;
- `setSubmissions(updated)` before `secureStorage.saveSubmissions` in delete/append handlers;
- `.catch(error => console.error(...))` as the only teacher-visible response to these save failures.

- [ ] **Step 2: Add committed refs for each remaining persisted domain**

Initialize refs from the same initial snapshots/state values as:
- `settings`;
- `udas`;
- `tests`;
- `submissions`.

Each `getCommitted` in queued work reads `.current` at execution time. Update `.current` only in successful publish.

- [ ] **Step 3: Migrate settings with logical-vs-persisted semantics**

Route `handleUpdateSettings(newSettings)` through the coordinator:
- derive returns the new logical settings candidate;
- persist calls `secureStorage.saveSettings(candidate)` and therefore sanitizes persistence;
- publish writes the original logical candidate to the committed ref and React state only after save resolves;
- a failed save leaves the previous theme/settings active;
- teacher-facing failure uses the canonical message.

Do not read back sanitized settings and overwrite the session-only API key in memory.

- [ ] **Step 4: Migrate UDA and custom-test saves**

Route `handleSaveUdas` and `handleSaveNewTest` through the coordinator.

For custom tests, derive from the latest committed tests ref at execution time:

```ts
current => ({ ...current, [newTest.id]: newTest })
```

For UDA, the supplied `newUdas` is the intended complete candidate; persistence still precedes publication.

- [ ] **Step 5: Migrate submission append and delete**

Route both through the coordinator.

For append:
- derive from latest committed submissions;
- preserve `handleSaveStudentSubmission` as an `async` function that resolves only after durable publication and rejects on persistence failure;
- remove optimistic `setSubmissions` and rollback code because the candidate is never published before commit.

For delete:
- derive by filtering the latest committed submissions at execution time;
- success toast only after commit.

Do not change StudentPortal success-screen copy or state timing in this task; `ONLINE-01` owns that UX.

- [ ] **Step 6: Pin failure behavior and settings sanitation**

Tests must assert:
- the canonical failure message is shared by these governed paths;
- success messages occur only in post-commit callbacks;
- existing `secureAppStorage.test.ts` still proves API key stripping;
- no direct optimistic setter-before-save legacy patterns remain.

- [ ] **Step 7: Run focused regression and commit**

Run:

```bash
bun test src/security/durableMutationCoordinator.test.ts src/security/durableAppMutationIntegrity.test.ts src/security/secureAppStorage.test.ts
bun run lint
```

Expected: PASS.

Commit:

```bash
git add src/App.tsx src/security/durableAppMutationIntegrity.test.ts src/security/secureAppStorage.test.ts
git commit -m "feat(persist-01): make remaining vault writes commit first"
```

---

### Task 6: Whole-branch qualification and independent review gate

**Files:**
- No new product files expected unless a valid finding produces a new RED.
- Update implementation evidence in the PERSIST-01 PR body/comments; do not rewrite the approved spec to manufacture completion state.

**Interfaces:**
- Consumes all prior task outputs.
- Produces one exact qualified head SHA and one independent review result.

- [ ] **Step 1: Run the complete local/security qualification**

Run:

```bash
bun run test:security
bun run lint
bun run build
```

Expected:
- all security tests PASS;
- TypeScript PASS;
- production build PASS.

Then run the same startup smoke as PREDEPLOY:

```bash
set +e
NODE_ENV=production PORT=0 timeout 5s node server.ts
code=$?
if [[ "$code" -eq 124 ]]; then exit 0; fi
exit "$code"
```

Expected: PASS by timeout code `124` (server stayed up) or clean zero exit if startup behavior changes legitimately.

- [ ] **Step 2: Audit the final diff against the approved spec**

Verify:
- no database version/schema migration;
- no crypto/key-management changes;
- no plaintext writes;
- no cloud/retry/Student Portal redesign;
- no new runtime dependencies;
- only expected product/test files changed;
- `restoreSnapshotVerified` semantics remain intact.

If scope leakage exists, remove it before qualification.

- [ ] **Step 3: Decide whether a real-browser persistence-failure check is needed**

A browser check is **required** if final code changed teacher-visible navigation/timing in a way not fully exercised by the pure coordinator plus structural App tests.

If required, test at minimum:
- a successful evaluation save navigates only after the durable operation resolves;
- a forced save failure leaves the current screen/state unchanged and shows the canonical error;
- no success toast appears on failure.

If not required, record why the unit/source contracts fully cover the observable ordering.

- [ ] **Step 4: Push the exact implementation head and require PREDEPLOY PASS**

Record:
- exact head SHA;
- PREDEPLOY run number and run ID;
- test PASS/FAIL totals;
- typecheck, build, startup smoke conclusions.

Do not qualify a moving head.

- [ ] **Step 5: Request independent Codex review on the same exact head**

Review focus:
- transaction atomicity;
- encryption-before-write;
- queue failure isolation;
- stale closure/ref correctness;
- settings secret sanitation;
- false-success/navigation regressions;
- scope leakage.

Required state before merge decision:
- review completed;
- zero unresolved significant findings.

Any valid finding must become a new RED, be fixed minimally, and then re-run Steps 1–5 on the new exact head.

- [ ] **Step 6: Stop at merge decision**

Canonical terminal state for this plan:

`PERSIST-01 = ENGINEERING QUALIFIED / INDEPENDENT REVIEW PASS / READY FOR MERGE DECISION`

No merge and no deploy without a separate authorization.
