# AIC-05 Professional Memory Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a private, inspectable and reversible professional-memory foundation that reuses teacher-approved work without replaying full chat history or storing student-personal data.

**Architecture:** Add one encrypted `professionalMemory` record to the existing Secure Local Vault. Model memory as local events plus deterministic consolidated entries; retrieve at most five active relevant entries per request and expose only minimized summaries to already-authorized remote capabilities. Canonical UDA/Library/Planning state remains authoritative and memory writes never authorize canonical mutations.

**Tech Stack:** React + TypeScript, Bun, existing Secure Local Vault / IndexedDB / Web Crypto, existing `CopilotContextProjectionV1`, existing Library/Copilot flows, GitHub Actions PREDEPLOY, Playwright 1.64.1.

**Spec:** `docs/superpowers/specs/2026-10-27-aic-05-professional-memory-design.md`

## Global Constraints

- Baseline is `main@150824965336f63f6dd7e0969b116887b77bc32d`.
- Privacy-first outranks convenience and memory recall.
- Student-personal and ambiguous unsafe content never enters professional memory.
- All automatic memory categories default disabled.
- Enabling a category is an explicit durable teacher decision and is revocable.
- Memory is derived state and never a second source of truth.
- Event capture occurs only after the corresponding canonical durable action succeeds.
- Memory failure never rolls back an already successful canonical action.
- `Ricorda questo`, edit, remove and category cleanup are explicit memory mutations with truthful durable completion.
- Consolidation and retrieval are deterministic/local in AIC-05; no new provider/model/retry behavior.
- Retrieved working set is capped at 5 active entries.
- Remote-bound memory contains compact summaries/category only; never raw events/full provenance/canonical documents.
- No AIC-06 budget, AIC-07 proactivity, embeddings, remote sync or autonomous canonical writes.
- Every behavior change follows causal RED → GREEN.
- Final qualification freezes one exact candidate SHA and runs PREDEPLOY + Browser Qualification + fresh whole-slice review.
- No automatic merge, deploy or publication.

## Review Focus

1. **Student-bearing context presented as a memory candidate** — must fail closed and create no Vault write; Task 1 and Task 7 pin this.
2. **Canonical action succeeds but derived memory write fails** — canonical outcome stays committed while memory reports failure without false success; Task 4 pins this.
3. **Old active Vault/backup lacks `professionalMemory`** — unlock/restore must normalize to empty memory rather than require destructive migration; Task 2 pins this.
4. **Deleted/missing canonical reference remains in memory** — entry becomes stale and is excluded from retrieval without silently deleting teacher memory; Task 3 pins this.
5. **Large event history grows over time** — remote projection must still expose at most five compact entries and never raw history; Task 3 and Task 5 pin this.

---

## File structure

### New files

- `src/memory/types.ts` — v1 domain types and stable enums.
- `src/memory/emptyProfessionalMemoryState.ts` — backward-compatible empty/default state.
- `src/memory/memoryPolicy.ts` — privacy/category eligibility and never-memory gate.
- `src/memory/professionalMemory.ts` — pure event capture, consolidation and mutation functions.
- `src/memory/memoryRetrieval.ts` — deterministic working-set selection and minimized remote projection.
- `src/memory/professionalMemory.test.ts` — domain/policy/consolidation tests.
- `src/memory/memoryRetrieval.test.ts` — ranking/cap/stale/privacy tests.
- `src/components/ProfessionalMemoryPanel.tsx` — progressive inspect/manage controls.
- `tests/browser/aic-05-professional-memory.spec.cjs` — exact product journeys.
- `src/security/aic05ProfessionalMemoryContract.test.ts` — static security/persistence boundary contracts.

### Modified files

- `src/security/vaultTypes.ts` — add `professionalMemory` key.
- `src/security/vaultStore.ts` — accept the new key in IndexedDB record enumeration.
- `src/security/secureAppStorage.ts` — load/save memory and include it in verified snapshots.
- `src/security/backupPayload.ts` — backup v5 + old-version normalization.
- `src/security/secureAppStorage.test.ts` — atomic write/read/rollback coverage.
- `src/security/backupPayload.test.ts` and compatibility tests — v5 validation/round-trip and v4/v3/v2/legacy normalization.
- `src/App.tsx` — own normalized memory state, load/save callbacks, post-commit event hooks.
- `src/components/LibraryCopilotComposer.tsx` — memory disclosure, `Ricorda questo`, relevant-memory presentation.
- `src/copilot/contextProjection.ts` — local memory working-set attachment only; keep routing projection minimal.
- provider/proposal boundary tests that inspect remote payloads — prove no raw memory/event/provenance leak.
- `.github/workflows/browser-qualification.yml` — include AIC-05 browser spec.

---

### Task 1: Define memory schema and fail-closed eligibility

**Files:**
- Create: `src/memory/types.ts`
- Create: `src/memory/emptyProfessionalMemoryState.ts`
- Create: `src/memory/memoryPolicy.ts`
- Create: `src/memory/professionalMemory.test.ts`

**Interfaces:**
- Produces `ProfessionalMemoryCategory`, `ProfessionalMemoryEventKind`, `ProfessionalMemoryEventV1`, `ProfessionalMemoryEntryV1`, `ProfessionalMemorySettingsV1`, `ProfessionalMemoryStateV1`.
- Produces `createEmptyProfessionalMemoryState(): ProfessionalMemoryStateV1`.
- Produces `canPersistProfessionalMemoryCandidate(input: MemoryCandidatePolicyInput): MemoryCandidatePolicyDecision`.

- [ ] **Step 1: Write the causal RED tests**

Add tests asserting:

```ts
expect(createEmptyProfessionalMemoryState()).toEqual({
  schemaVersion: 1,
  events: [],
  entries: [],
  settings: {
    autoRemember: {
      'format-preference': false,
      'didactic-pattern': false,
      'material-reuse': false,
      'planning-continuity': false,
      'workflow-preference': false
    }
  }
});
```

Also assert `student-personal` and `ambiguous` candidates are denied, while approved professional classes are eligible.

- [ ] **Step 2: Run RED**

Run: `bun test src/memory/professionalMemory.test.ts`  
Expected: FAIL because the memory domain does not exist.

- [ ] **Step 3: Implement the minimum schema/policy GREEN**

Use exact v1 category names from the spec. The policy result must distinguish `ALLOW`, `DENY_STUDENT_PERSONAL` and `DENY_AMBIGUOUS` so UI can fail closed without provider calls.

- [ ] **Step 4: Verify GREEN**

Run: `bun test src/memory/professionalMemory.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/memory
git commit -m "feat: define professional memory privacy contract"
```

### Task 2: Extend Secure Local Vault and backup compatibility

**Files:**
- Modify: `src/security/vaultTypes.ts`
- Modify: `src/security/vaultStore.ts`
- Modify: `src/security/secureAppStorage.ts`
- Modify: `src/security/secureAppStorage.test.ts`
- Modify: `src/security/backupPayload.ts`
- Modify: `src/security/backupPayload.test.ts`
- Modify: relevant backup compatibility tests
- Create: `src/security/aic05ProfessionalMemoryContract.test.ts`

**Interfaces:**
- Consumes `ProfessionalMemoryStateV1` and `createEmptyProfessionalMemoryState()` from Task 1.
- Produces Vault key `'professionalMemory'`.
- Produces `saveProfessionalMemory(value)` and `saveProfessionalMemoryAndMeta(memory, meta)`.
- Advances backup format to `BACKUP_DATA_VERSION_V5 = 5`.

- [ ] **Step 1: Write RED for new Vault key and snapshot**

Assert that `VaultRecordKey`, Vault enumeration, `SecureAppSnapshot` and `CompleteSecureAppSnapshot` include `professionalMemory`, and that an absent old record normalizes to the empty v1 state at application/backup normalization boundaries.

- [ ] **Step 2: Write RED for backup v5**

Assert:
- v5 round-trips a valid memory state;
- v4/v3/v2/legacy normalize to empty memory;
- v5 with malformed memory or a persisted denied privacy class is rejected.

- [ ] **Step 3: Run RED**

Run: `bun test src/security/secureAppStorage.test.ts src/security/backupPayload.test.ts src/security/aic05ProfessionalMemoryContract.test.ts`  
Expected: FAIL only on missing AIC-05 contracts.

- [ ] **Step 4: Implement Vault/storage support**

Add `'professionalMemory'` to the existing encrypted `records` store key set; do **not** create a new IndexedDB store or database version. Add memory-specific save methods and complete-snapshot integration.

- [ ] **Step 5: Implement backup v5**

Keep old versions readable. `createBackupPayload()` emits v5; normalization supplies `createEmptyProfessionalMemoryState()` when older payloads lack memory.

- [ ] **Step 6: Verify GREEN**

Run the focused security/storage/backup tests.  
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/security src/memory
git commit -m "feat: persist professional memory in secure vault"
```

### Task 3: Implement deterministic event consolidation and working-set retrieval

**Files:**
- Create/Modify: `src/memory/professionalMemory.ts`
- Create: `src/memory/memoryRetrieval.ts`
- Modify: `src/memory/professionalMemory.test.ts`
- Create: `src/memory/memoryRetrieval.test.ts`

**Interfaces:**
- Produces `recordProfessionalMemoryEvent(state, input): ProfessionalMemoryStateV1`.
- Produces `rememberProfessionalItem(state, input): ProfessionalMemoryStateV1`.
- Produces `correctProfessionalMemoryEntry(state, input): ProfessionalMemoryStateV1`.
- Produces `removeProfessionalMemoryEntry(state, entryId): ProfessionalMemoryStateV1`.
- Produces `setAutoRememberCategory(state, category, enabled): ProfessionalMemoryStateV1`.
- Produces `removeProfessionalMemoryCategory(state, category): ProfessionalMemoryStateV1`.
- Produces `selectProfessionalMemoryWorkingSet(input): ProfessionalMemoryWorkingSetV1` with `items.length <= 5`.
- Produces `toRemoteProfessionalMemoryProjection(workingSet)` containing category + compact summary only.

- [ ] **Step 1: Write RED for event capture/consolidation**

Assert disabled categories ignore automatic events, enabled categories capture eligible events, explicit memories remain distinguishable by provenance, correction preserves provenance and sets `correctedByTeacherAt`, and removal changes memory only.

- [ ] **Step 2: Write RED for stale refs and retrieval cap**

Create more than five candidate entries. Assert stale entries are excluded, explicit/context-matching entries rank first and output length is exactly at most 5.

- [ ] **Step 3: Write RED for remote minimization**

Assert serialized remote projection contains no `events`, `sourceEventIds`, canonical payload or full provenance object.

- [ ] **Step 4: Run RED**

Run: `bun test src/memory/professionalMemory.test.ts src/memory/memoryRetrieval.test.ts`.

- [ ] **Step 5: Implement local deterministic GREEN**

Do not add embeddings or provider calls. Consolidated summaries must be derived from explicit text and safe event descriptors only; no personality/sensitive inference.

- [ ] **Step 6: Verify GREEN and commit**

```bash
bun test src/memory/professionalMemory.test.ts src/memory/memoryRetrieval.test.ts
git add src/memory
git commit -m "feat: consolidate and retrieve professional memory"
```

### Task 4: Integrate memory with durable product outcomes without widening canonical transactions

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/security/aic05ProfessionalMemoryContract.test.ts`
- Modify: focused AIC-02/LINK/PREPARE contract tests as required

**Interfaces:**
- Consumes pure memory functions from Task 3 and `saveProfessionalMemoryAndMeta()` from Task 2.
- Produces app callbacks for manual memory mutation and post-commit derived event capture.

- [ ] **Step 1: Write RED for ordering**

Pin existing LINK/PREPARE durable callbacks so memory event capture occurs only after the awaited canonical storage call and after canonical refs have been updated from the committed candidate.

- [ ] **Step 2: Write RED for derived-memory failure**

Simulate canonical save success followed by memory save failure. Assert canonical Library/UDA state remains committed, memory is not falsely published as saved, and a non-destructive memory error is exposed.

- [ ] **Step 3: Run RED**

Run focused AIC-02/AIC-04/AIC-05 contract tests.  
Expected: FAIL because memory hooks do not exist.

- [ ] **Step 4: Implement minimal integration**

Load absent memory as `createEmptyProfessionalMemoryState()`. Keep a memory ref aligned with committed state. For automatic events, check enabled category + privacy eligibility before writing. Do not add memory to `saveLibraryUdasAndMeta()` or other canonical compound transactions.

- [ ] **Step 5: Verify existing canonical flows remain GREEN**

Run focused LINK/PREPARE and secure persistence suites.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/security
git commit -m "feat: record memory after governed outcomes"
```

### Task 5: Attach only the small safe working set to Copilot context

**Files:**
- Modify: `src/copilot/contextProjection.ts`
- Modify: `src/library/agentIntent.ts` only if needed to carry local memory separately from routing projection
- Modify: provider/proposal request construction files identified by existing AIC-01/LIB-01E tests
- Modify/Create: focused remote-payload security tests

**Interfaces:**
- Consumes `ProfessionalMemoryWorkingSetV1` and minimized remote memory projection from Task 3.
- Preserves current `CopilotRemoteRoutingProjectionV1` fields for intent routing.

- [ ] **Step 1: Write RED proving routing minimization remains unchanged**

Assert `toRemoteRoutingProjection()` still exposes only surface/current-class/current-UDA/selected-source booleans and never professional memory.

- [ ] **Step 2: Write RED for governed proposal/review memory context**

Assert an already-authorized capability may receive up to 5 compact memory summaries, while payload inspection proves absence of raw events, full provenance and denied privacy classes.

- [ ] **Step 3: Run RED**

Run context/provider security tests.

- [ ] **Step 4: Implement the minimal separate memory projection**

Do not use memory to authorize actions. Do not add provider calls. Memory only augments context for a capability that is already allowed by existing Core/policy.

- [ ] **Step 5: Verify and commit**

```bash
bun test src/copilot src/library src/security
git add src/copilot src/library src/security
git commit -m "feat: supply safe professional memory context"
```

### Task 6: Add progressive teacher controls

**Files:**
- Create: `src/components/ProfessionalMemoryPanel.tsx`
- Modify: `src/components/LibraryCopilotComposer.tsx`
- Modify: `src/App.tsx`
- Modify/Create: component tests

**Interfaces:**
- Consumes app callbacks/state from Task 4.
- Produces stable test ids:
  - `copilot-memory-trigger`;
  - `copilot-memory-panel`;
  - `copilot-memory-remember-this`;
  - `copilot-memory-relevant`;
  - `copilot-memory-category-<category>`;
  - `copilot-memory-entry-<id>`.

- [ ] **Step 1: Write RED for progressive disclosure**

Assert the memory panel is secondary/closed by default, opening it shows category controls and entries, and normal Copilot submission remains primary.

- [ ] **Step 2: Write RED for explicit controls**

Assert `Ricorda questo` shows a confirmable category/summary for eligible professional context; denied contexts do not expose a successful remember path. Editing/removing requires explicit teacher action.

- [ ] **Step 3: Write RED for category semantics**

Disabling a category must not delete existing entries. Bulk deletion is a separate confirmed action.

- [ ] **Step 4: Implement minimal UI**

Use existing Composer progressive-disclosure patterns. Do not create a second global memory navigation surface.

- [ ] **Step 5: Verify component tests and commit**

```bash
git add src/components src/App.tsx
git commit -m "feat: add professional memory controls"
```

### Task 7: Exact-SHA browser qualification and regression gate

**Files:**
- Create: `tests/browser/aic-05-professional-memory.spec.cjs`
- Modify: `.github/workflows/browser-qualification.yml`

**Interfaces:**
- Consumes all AIC-05 product contracts.
- Produces exact-SHA desktop/mobile evidence and preserves historical regression inventory.

- [ ] **Step 1: Add browser journey — manual memory lifecycle**

Desktop 1280×900 with synthetic professional data:
`open Copilot -> Memoria professionale -> Ricorda questo -> confirm -> reload -> inspect provenance -> edit -> reload -> remove -> reload`.

Assert every durable success is visible only after persistence and canonical Library/UDA content is unchanged by memory edit/remove.

- [ ] **Step 2: Add browser journey — automatic category lifecycle**

Enable `material-reuse`, perform a governed synthetic source reuse/link, verify derived memory appears only after canonical success, disable the category, perform another eligible action, and verify no new automatic event while old memory remains.

- [ ] **Step 3: Add negative privacy journey**

From a synthetic student-bearing/evaluation context, attempt memory capture and assert fail-closed behavior, no memory write after reload and no provider request containing individual data.

- [ ] **Step 4: Add mobile 390×844 journey**

Verify memory trigger/panel/category/edit/remove controls are touch-safe, closable and do not overflow. Context change must invalidate pending retrieval.

- [ ] **Step 5: Add spec to Browser Qualification workflow and establish RED**

Push test-only RED first. Expected failure must be causally attributable to missing AIC-05 behavior, not harness setup.

- [ ] **Step 6: Complete GREEN and full qualification**

Required final evidence on one frozen exact SHA:
- PREDEPLOY SUCCESS;
- focused memory/security/backup suites PASS;
- historical Library/AIC-01…AIC-04 suites PASS;
- Browser Qualification PASS including AIC-05 desktop/mobile;
- UX-QA-01/02 PASS with 0 blocking findings;
- evidence artifact id/digest recorded;
- fresh whole-slice Codex review completed with 0 unresolved findings.

- [ ] **Step 7: Stop at human integration decision**

Update implementation/docs PR receipts to:
`AIC-05 PROFESSIONAL MEMORY — ENGINEERING + CODE REVIEW QUALIFIED / M3 / U2 / HUMAN INTEGRATION DECISION PENDING`.

Do not merge or deploy automatically.
