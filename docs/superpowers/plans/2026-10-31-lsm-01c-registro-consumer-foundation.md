# LSM-01C-A Registro consumer foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collegare Registro Docente alla Local Semantic Memory condivisa come indice derivato opzionale per Biblioteca e Professional Memory, preservando authority, privacy e percorsi locali esistenti.

**Architecture:** Vendor the exact LSM-01A shared contract, then add a session-only loopback HTTP adapter, governed projection builders, an endpoint-scoped CAS ledger and explicit refresh orchestration. `LibraryView` prefers the shared LSM only when an explicitly connected session is healthy; otherwise the existing local semantic retrieval remains unchanged.

**Tech Stack:** React 19, TypeScript 7, Bun tests, Vite, vendored `@trama/contextual-copilot-semantic-memory@0.1.0`, browser `fetch`, localStorage metadata-only ledger.

**Spec:** `docs/superpowers/specs/2026-10-31-lsm-01c-registro-consumer-foundation-design.md`

## Global Constraints

- Baseline is `main@d496b51a5a1677c1c6893010c28bea2ba43dc91b`; work only on `feat/lsm-01c-registro-adoption`.
- LSM is derived/rebuildable and never canonical authority.
- Only `PUBLIC_APP`, `TEACHER_PROFESSIONAL`, `CURRICOLO`, `AGGREGATED_NON_IDENTIFIABLE` may leave Registro for LSM.
- `student-personal`, `unknown`, ambiguous and restricted/failed Library content must not be projected.
- Token is session-only: never AppSettings, backup, IndexedDB or localStorage.
- Endpoint must be HTTP loopback only; no LAN/remote fallback and no automatic startup probe.
- First loopback request must be caused by explicit user gesture.
- Synchronization is explicit in v1; no background or mutation-triggered indexing.
- CAS conflicts are surfaced; no forced overwrite or revision ordering.
- Existing Library semantic retrieval remains available and unchanged when LSM is not connected/ready.
- Synthetic-only qualification data; no merge/deploy/publish from qualification.

## Review Focus

1. **Privacy regression:** a Library source whose privacy changes from teacher-professional to student-personal must disappear from desired projections and be removed only with CAS.
2. **Lost/stale ledger:** a runtime containing Registro projections while the local ledger is empty must surface revision conflict rather than overwrite.
3. **Runtime reset:** `health.indexRevision === "0"` must invalidate the endpoint ledger before first upsert.
4. **Stale semantic hit:** an LSM hit referencing a deleted or newly ineligible Library source must not appear as a usable result.
5. **Browser local-network boundary:** constructing/rendering the adapter/settings must make zero loopback requests until explicit connect/search/sync action.

---

### Task 1: Vendor the exact shared semantic-memory contract

**Files:**
- Create: `vendor/contextual-copilot-semantic-memory/README.md`
- Create: `vendor/contextual-copilot-semantic-memory/index.d.ts`
- Create: `vendor/contextual-copilot-semantic-memory/package.json`
- Create: `vendor/contextual-copilot-semantic-memory/src/index.js`
- Create: `vendor/contextual-copilot-semantic-memory.provenance.json`
- Modify: `package.json`
- Modify: `bun.lock`
- Create: `src/security/lsm01cSemanticMemoryVendorContract.test.ts`

**Interfaces:**
- Consumes: LSM-01A distribution from `trama-ecosistema@947e18de...`, package source commit `fc85d33f...`.
- Produces: importable `@trama/contextual-copilot-semantic-memory@0.1.0` validators/types with no external registry requirement.

- [ ] **Step 1: Write failing vendor contract test**

Assert package/lock local dependency, exact package version, provenance source commit/path, network flags, expected file list, and runtime validator availability.

- [ ] **Step 2: Run RED**

Run: `bun test src/security/lsm01cSemanticMemoryVendorContract.test.ts`

Expected: FAIL because the semantic-memory vendor package/dependency does not exist.

- [ ] **Step 3: Vendor package and update root dependency/lock**

Copy the four distribution files byte-for-byte, create provenance receipt from the shared distribution, add `"@trama/contextual-copilot-semantic-memory": "file:vendor/contextual-copilot-semantic-memory"` to root package + Bun lock package map.

- [ ] **Step 4: Run GREEN**

Run: `bun test src/security/lsm01cSemanticMemoryVendorContract.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `feat(lsm): vendor shared semantic memory contract`

---

### Task 2: Add session-only loopback HTTP client

**Files:**
- Create: `src/semanticMemory/httpClient.ts`
- Create: `src/semanticMemory/httpClient.test.ts`
- Modify: `package.json` only if test script must include `src/semanticMemory/*.test.ts`

**Interfaces:**
- Consumes: shared validators/types from Task 1.
- Produces: `createSemanticMemoryHttpClient(config): LocalSemanticMemoryPort`, typed session config and typed `SemanticMemoryHttpError`/revision-conflict error.

- [ ] **Step 1: Write failing endpoint/client tests**

Tests cover: non-loopback rejection before `fetch`; constructor performs zero requests; health GET has no bearer requirement; POST uses bearer, `redirect:'error'`, `cache:'no-store'`, `credentials:'omit'`, timeout signal and loopback target address space; 409 becomes revision conflict; malformed response fails validation.

- [ ] **Step 2: Run RED**

Run: `bun test src/semanticMemory/httpClient.test.ts`

Expected: FAIL because module/client does not exist.

- [ ] **Step 3: Implement minimal client**

Signatures:

```ts
export interface SemanticMemorySessionConfig { endpointUrl: string; token: string }
export function createSemanticMemoryHttpClient(config: SemanticMemorySessionConfig): LocalSemanticMemoryPort
```

Normalize endpoint, allow only HTTP loopback, never probe in constructor, validate every envelope with shared validators.

- [ ] **Step 4: Run GREEN + security suite**

Run: `bun test src/semanticMemory/httpClient.test.ts && bun run test:security`

Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `feat(lsm): add session loopback client`

---

### Task 3: Build governed Registro projections

**Files:**
- Create: `src/semanticMemory/projections.ts`
- Create: `src/semanticMemory/projections.test.ts`

**Interfaces:**
- Consumes: `LibrarySource[]`, `ProfessionalMemoryStateV1`, shared projection types/validator.
- Produces:
  - `buildLibrarySemanticMemoryProjections(sources): Promise<SemanticMemoryProjectionV1[]>`
  - `buildProfessionalMemoryProjections(state): Promise<SemanticMemoryProjectionV1[]>`
  - `buildRegistroSemanticMemorySnapshot(input): Promise<SemanticMemoryProjectionV1[]>`

- [ ] **Step 1: Write failing Library projection tests**

Assert teacher-professional allowed; student-personal/unknown/restricted/failed/no-text excluded; semantic text order matches existing Library retrieval; namespace/source/canonicalRef exact; revision stable for identical content and changes when text/metadata changes.

- [ ] **Step 2: Run Library RED**

Run: `bun test src/semanticMemory/projections.test.ts`

Expected: FAIL because projection builder is missing.

- [ ] **Step 3: Implement Library projection builder**

Use Web Crypto SHA-256 over a deterministic serialized projection seed; revision is opaque lowercase hex digest.

- [ ] **Step 4: Add Professional Memory failing tests**

Assert active-only, explicit class mapping, summary text, canonicalRef, updatedAt, deterministic revision; stale excluded.

- [ ] **Step 5: Run RED then implement mapping**

Run before implementation and confirm new tests fail causally; then implement and rerun.

- [ ] **Step 6: Review Focus privacy test**

Pin teacher-professional -> student-personal transition as absence from desired snapshot.

- [ ] **Step 7: Run GREEN**

Run: `bun test src/semanticMemory/projections.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit**

Commit message: `feat(lsm): project governed registro sources`

---

### Task 4: Add CAS ledger and explicit refresh orchestration

**Files:**
- Create: `src/semanticMemory/syncLedger.ts`
- Create: `src/semanticMemory/syncLedger.test.ts`
- Create: `src/semanticMemory/sync.ts`
- Create: `src/semanticMemory/sync.test.ts`

**Interfaces:**
- Consumes: `LocalSemanticMemoryPort`, governed projection snapshot from Task 3.
- Produces:
  - endpoint-scoped metadata-only ledger load/save/clear helpers;
  - `syncRegistroSemanticMemory(input): Promise<SemanticMemorySyncResult>`.

- [ ] **Step 1: Write ledger RED tests**

Assert no token/text stored, endpoint-scoped key, malformed payload -> empty, clear works.

- [ ] **Step 2: Implement ledger and GREEN**

Use injectable Storage in tests; production default `window.localStorage` only when explicitly invoked.

- [ ] **Step 3: Write sync RED tests**

Cover create/upsert CAS, unchanged receipts, replacement expectedRevision, removal of no-longer-desired sources, health rebuild-required stop, indexRevision `0` resets ledger, partial failure preserves receipts already committed.

- [ ] **Step 4: Add lost-ledger conflict test**

Port returns revision conflict for `expectedRevision:null`; result must be `reconciliation-required`, with no retry/overwrite.

- [ ] **Step 5: Implement sync orchestrator and GREEN**

No automatic invocation; return a summary containing counts/status only, no professional text.

- [ ] **Step 6: Run full semantic-memory tests**

Run: `bun test src/semanticMemory/*.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

Commit message: `feat(lsm): add explicit cas synchronization`

---

### Task 5: Add LSM-backed Library retrieval with canonical revalidation

**Files:**
- Create: `src/semanticMemory/libraryRetrieval.ts`
- Create: `src/semanticMemory/libraryRetrieval.test.ts`

**Interfaces:**
- Consumes: `LocalSemanticMemoryPort`, current `LibraryStateV1`.
- Produces: `retrieveLibrarySourcesFromSemanticMemory(input): Promise<SemanticLibraryResolution>` compatible with the current Library presentation contract.

- [ ] **Step 1: Write retrieval RED tests**

Assert namespace/dataClass/limit request, dedupe multiple chunks per source with top score, deterministic order, deleted source ignored, privacy-changed source ignored, empty/no hits -> `NO_SEMANTIC_MATCH`.

- [ ] **Step 2: Run RED**

Run: `bun test src/semanticMemory/libraryRetrieval.test.ts`

Expected: FAIL because module is missing.

- [ ] **Step 3: Implement minimal resolver**

Resolve each hit back to current `LibrarySource`; never return source solely because hit exists.

- [ ] **Step 4: Run GREEN**

Run: `bun test src/semanticMemory/libraryRetrieval.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `feat(lsm): resolve library hits through canonical state`

---

### Task 6: Add explicit connection/sync UI and progressive Library adoption

**Files:**
- Create: `src/components/SemanticMemorySettings.tsx`
- Create: `src/components/SemanticMemorySettings.test.tsx` or contract test under `src/security/`
- Modify: `src/App.tsx`
- Modify: `src/components/LibraryView.tsx`
- Modify: tests/contracts that own the existing Library semantic-search behavior.

**Interfaces:**
- Consumes: client Task 2, snapshot/sync Task 3-4, LSM retrieval Task 5, existing `retrieveLibrarySourcesByMeaning` fallback.
- Produces: session-only App-owned LSM connection state and explicit UI controls.

- [ ] **Step 1: Write failing no-auto-probe/UI contract tests**

Assert render/constructor causes zero LSM calls; `Connetti memoria locale` causes first health; token input is password and not bound to AppSettings; sync button disabled until valid session; copy identifies local-only behavior.

- [ ] **Step 2: Implement `SemanticMemorySettings`**

Default endpoint `http://127.0.0.1:8765`; session-only token; surface health ready/degraded/rebuild-required and sync summary.

- [ ] **Step 3: Write Library adoption RED tests**

When LSM session ready, explicit semantic search uses LSM resolver. When absent/not ready, same action uses existing `retrieveLibrarySourcesByMeaning`; no remote fallback introduced.

- [ ] **Step 4: Integrate App + LibraryView and GREEN**

App owns the client/session and explicit sync callback; no effect performs network probing or synchronization.

- [ ] **Step 5: Run application suites**

Run:

```bash
bun run lint
bun run test:security
bun run test:library
bun run build
```

Expected: all PASS.

- [ ] **Step 6: Commit**

Commit message: `feat(lsm): adopt shared memory in registro ui`

---

### Task 7: Exact-SHA qualification and consumer smoke

**Files:**
- Modify only if required by existing qualification registry/receipts; do not weaken gates.
- Update `docs/memory/LESSONS_LEARNED.md` only if this cycle produces reusable learning.

**Interfaces:**
- Consumes: finished branch exact SHA.
- Produces: PREDEPLOY + browser evidence and targeted Android/Termux consumer evidence.

- [ ] **Step 1: Open/maintain Draft PR and freeze exact candidate SHA**

- [ ] **Step 2: PREDEPLOY exact-SHA qualification**

Require frozen install, inherited invariants, typecheck, security tests, library tests, build, startup smoke.

- [ ] **Step 3: Canonical browser qualification**

Use existing GitHub-hosted Playwright workflow; synthetic-only. Verify Settings can render without probe, explicit connect interaction degrades safely when no device loopback is present, normal Library textual/local flows remain usable.

- [ ] **Step 4: Final whole-branch review**

Review authority, privacy, CAS, loopback boundary, and Review Focus cases. Critical/Important findings require one RED->GREEN repair pass and exact-SHA requalification.

- [ ] **Step 5: Targeted Android/Termux consumer smoke**

On the final exact SHA, use the already-qualified LSM-01B runtime with synthetic Registro projections. Prove explicit connect, sync, LSM Library search, canonical-ref resolution and no startup probe. Do not repeat the full runtime qualification.

- [ ] **Step 6: Stop at human gate**

Report candidate and evidence. No merge/deploy without a new explicit decision.

## Self-review

- Spec coverage: vendor, network boundary, projection privacy/mapping, CAS ledger, explicit sync, canonical hit resolution, UI progressive adoption and qualification all have owning tasks.
- Shared interfaces: Task 2 provides the port consumed by Tasks 4-6; Task 3 provides projections consumed by Task 4; Task 5 preserves the existing `SemanticLibraryResolution` presentation contract consumed by Task 6.
- Type consistency: package types are the sole LSM envelope authority; Registro-only types remain adapters.
- Review Focus: all five listed failure classes have explicit tests in Tasks 3-6.
- Proportion: Planning projection and Copilot cross-corpus retrieval are deliberately deferred to later increments.
