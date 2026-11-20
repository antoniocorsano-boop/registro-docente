# A4-R2B Docente OS → Registro Teaching Projection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Docente OS class/UDA planning available to Registro Docente as a governed, privacy-minimized, read-only teaching projection that survives reload and can be used by Copilot/Biblioteca without cloning or mutating the source UDA.

**Architecture:** Docente OS produces a versioned JSON projection from canonical class/plan state and an explicit export action. Registro validates the same contract/corpus, previews class reconciliation, persists accepted projections inside an explicitly versioned encrypted Planning state, and derives a unified `TeachingUdaCandidate` read model consumed by context-selection surfaces. No live API, Supabase consumer or write-back is introduced.

**Tech Stack:** Docente OS: Next.js 16, React 19, TypeScript 5.9, Node 22, `tsx --test`; Registro: React 19, TypeScript 7, Bun test, Secure Local Vault, Playwright Browser Qualification.

**Spec:** `docs/superpowers/specs/2026-10-29-a4-r2-canonical-class-uda-projection-design.md`

## Global Constraints

- Producer baseline starts from `docente-os-2026-27 develop@2b4464a1c18382f887689df175d0da5dfa84d178` unless fresh A0 proves movement before implementation.
- Consumer baseline for R2B is the exact integrated A4-R2A merge, not the docs branch and not stale `main@a6ede2...`.
- Contract ID is exactly `DOCENTE_OS_REGISTRO_TEACHING_PROJECTION_V1`, version `1`.
- `sourceProduct='DOCENTE_OS'`, `targetProduct='REGISTRO_DOCENTE'`, `importMode='READ_ONLY_PROJECTION'`, `acceptanceRequired=true`, `automaticWriteAllowed=false`, `privacyClass='PROFESSIONAL_NON_PERSONAL'`.
- No student-personal field may be exported.
- Initial transport is explicit JSON export/import only; no background sync, direct Supabase query, webhook or shared-auth dependency.
- Accepted projection is persisted encrypted in Planning state; projected UDA are never copied into the Registro `udas` record.
- Projected UDA are `writableByRegistro=false`; no local UDA mutation may target them.
- Preserve Arena authority, Contextual Copilot Core authority, A4-R1/A4-R2A teacher-first behavior, commit-first persistence and human confirmation boundaries.
- No deploy/publication or merge without separate human decisions in each repository.

## Review Focus

- A malformed or future contract must fail closed before it influences class/UDA context; Tasks 1 and 3 exercise strict positive/negative corpus parity.
- A projection containing any prohibited student-personal field must be rejected even if all required professional fields are valid; Tasks 1 and 3 pin this.
- Re-import of the same fingerprint must be idempotent, while a new fingerprint must not replace the committed projection before explicit acceptance and durable success; Tasks 4–5 test this.
- A projected UDA must be selectable for read-only professional context but must never flow into `Adotta e aggiungi all'UDA` or any Registro-local UDA mutation; Task 6 tests this boundary.
- A local class change that makes an accepted source-section mapping ambiguous must surface ambiguity at read-model time instead of silently retargeting the projection; Tasks 5–7 test this.

---

### Task 1: Freeze the cross-product contract and conformance corpus in Docente OS

**Repository:** `antoniocorsano-boop/docente-os-2026-27`

**Files:**
- Create: `product/src/core/application/registro-teaching-projection.ts`
- Create: `product/src/core/application/registro-teaching-projection.test.ts`
- Create: `docs/contracts/fixtures/docente-os-registro-teaching-projection-v1.json`
- Create: `docs/contracts/fixtures/docente-os-registro-teaching-projection-v1-negative-corpus.json`

**Interfaces:**
- Produces contract types from the spec and:
  - `buildRegistroTeachingProjection(input: RegistroTeachingProjectionInput): DocenteOsRegistroTeachingProjectionV1`
  - `validateRegistroTeachingProjection(payload: unknown): RegistroTeachingProjectionValidationResult`
  - deterministic `projectedUdaId = docente-os:<sourceSectionId>:<canonicalGenerationId>:<sourceUdaRef>`.
- Later Registro tasks mirror the fixture/corpus semantics exactly.

- [ ] **Step 1: Write contract tests before the implementation**

Required tests:
- exact envelope constants;
- producer creates class entries from source section IDs and canonical plan identity;
- duplicate source-section ID rejected;
- duplicate projected UDA ID rejected;
- source commit must be 40 lowercase hex chars;
- fingerprint must be SHA-256/64 lowercase hex chars;
- unknown/unexpected root/class/UDA properties rejected;
- prohibited student-personal properties in any projected class/UDA are rejected;
- positive fixture validates.

- [ ] **Step 2: Run targeted RED**

From `product/`:

Run: `npx tsx --test src/core/application/registro-teaching-projection.test.ts`

Expected: FAIL because the producer/validator module does not exist.

- [ ] **Step 3: Implement the minimal contract builder/validator**

Use existing canonical plan/section inputs; do not read student/session/evaluation repositories. Keep validation strict and allowlisted.

- [ ] **Step 4: Materialize positive and negative JSON corpus**

Negative corpus must include every case required by the spec, including one explicit prohibited student-personal property.

- [ ] **Step 5: Run targeted tests + typecheck**

Run:
- `npx tsx --test src/core/application/registro-teaching-projection.test.ts`
- `npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add product/src/core/application/registro-teaching-projection.ts product/src/core/application/registro-teaching-projection.test.ts docs/contracts/fixtures/docente-os-registro-teaching-projection-v1*.json
git commit -m "feat(a4-r2): define Registro teaching projection contract"
```

### Task 2: Add explicit Docente OS export without remote push

**Repository:** `antoniocorsano-boop/docente-os-2026-27`

**Files:**
- Create: `product/src/app/piano-annuale/registro-projection-export-model.ts`
- Create: `product/src/app/piano-annuale/registro-projection-export-model.test.ts`
- Create: `product/src/app/piano-annuale/registro-projection-export-client.tsx`
- Modify: `product/src/app/piano-annuale/page.tsx`

**Interfaces:**
- Consumes `AnnualPlanSection`, current discipline metadata and canonical plan source/block model.
- Produces one accepted producer-side payload for download; no network push.
- UI action label: `Esporta per Registro Docente`.

- [ ] **Step 1: Write model RED**

Tests assert:
- one source section becomes one projected class with `sourceSectionId`, grade, section labels/status and canonical plan identity;
- repeated CAN-PLAN blocks are grouped into unique projected UDA by `sourceUdaRef`;
- projected UDA carries title/focus/planned hours/period/pack refs;
- no student/session/evaluation object is accepted by the model input;
- output ordering is deterministic.

- [ ] **Step 2: Run targeted RED**

Run: `npx tsx --test src/app/piano-annuale/registro-projection-export-model.test.ts`

Expected: FAIL because the export model does not exist.

- [ ] **Step 3: Implement export model using Task 1 builder**

Fingerprint the canonical payload deterministically with Node `crypto` SHA-256 after excluding the fingerprint field itself from the fingerprint input.

- [ ] **Step 4: Add the client download action**

`registro-projection-export-client.tsx` receives the validated payload and downloads one `.json` file on explicit click. It must not call Registro or any remote sync endpoint.

- [ ] **Step 5: Wire the control into Piano annuale with progressive disclosure**

Keep it secondary to the planning workflow. Do not add a new top-level navigation destination.

- [ ] **Step 6: Run focused/full producer gates**

Run:
- targeted Task 1–2 tests;
- `npm run typecheck`;
- `npm run lint`;
- `npm run build` or Product CI exact-head qualification according to repository policy.

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add product/src/app/piano-annuale/registro-projection-export-* product/src/app/piano-annuale/page.tsx
git commit -m "feat(a4-r2): export read-only teaching projection"
```

### Task 3: Mirror and validate the projection contract in Registro

**Repository:** `antoniocorsano-boop/registro-docente`

**Files:**
- Create: `src/planning/docenteOsTeachingProjection.ts`
- Create: `src/security/a4R2DocenteOsProjectionContract.test.ts`
- Create: `docs/contracts/fixtures/docente-os-registro-teaching-projection-v1.json`
- Create: `docs/contracts/fixtures/docente-os-registro-teaching-projection-v1-negative-corpus.json`

**Interfaces:**
- Produces:
  - `previewDocenteOsTeachingProjection(payload: unknown): DocenteOsProjectionPreviewResult`
  - typed projection interfaces matching Task 1 exactly.
- Must not accept a superset of the producer contract.

- [ ] **Step 1: Copy the exact producer fixtures only after the Docente OS contract candidate is frozen**

Record producer source commit in the Registro PR body/receipt. Do not hand-edit mirrored JSON semantics.

- [ ] **Step 2: Write consumer RED against the shared corpus**

Assertions:
- canonical fixture accepted;
- every producer-negative case rejected with a stable consumer error class;
- unexpected properties rejected;
- student-personal negative rejected;
- no acceptance/persistence occurs in this pure preview function.

- [ ] **Step 3: Run consumer RED**

Run: `bun test src/security/a4R2DocenteOsProjectionContract.test.ts`

Expected: FAIL because the consumer module does not exist.

- [ ] **Step 4: Implement strict allowlisted consumer**

Do not reuse `JSON.parse` success as validation. Validate nested keys/values, fingerprint/provenance shape and duplicate IDs.

- [ ] **Step 5: Run consumer contract + security suite**

Run:
- `bun test src/security/a4R2DocenteOsProjectionContract.test.ts`
- `bun run test:security`
- `bun run lint`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/planning/docenteOsTeachingProjection.ts src/security/a4R2DocenteOsProjectionContract.test.ts docs/contracts/fixtures/docente-os-registro-teaching-projection-v1*.json
git commit -m "feat(a4-r2): validate Docente OS teaching projection"
```

### Task 4: Advance encrypted Planning state to v2 and preserve compatibility

**Repository:** `antoniocorsano-boop/registro-docente`

**Files:**
- Modify: `src/planning/types.ts`
- Modify: `src/planning/emptyPlanningState.ts`
- Create: `src/planning/normalizePlanningState.ts`
- Create: `src/planning/normalizePlanningState.test.ts`
- Modify: `src/security/secureAppStorage.ts`
- Modify: `src/security/backupPayload.ts`
- Modify/add planning/backup security tests that currently pin `PlanningStateV1`.

**Interfaces:**
- Produces:
  - historical `PlanningStateV1` type retained for normalization tests;
  - `PlanningStateV2` with `docenteOsProjections`;
  - `type PlanningState = PlanningStateV2` for current application state;
  - `normalizePlanningState(value: unknown): PlanningStateV2`.
- `SecureAppSnapshot.planning` and current App planning state use normalized v2 after load.

- [ ] **Step 1: Write migration RED**

Tests:
- canonical v1 -> v2 preserves profiles/Arena/resources/masterPrograms/classInstances byte-for-value and adds empty projections;
- canonical v2 round-trips unchanged;
- malformed/unknown planning state fails closed or normalizes according to existing bootstrap policy, never fabricating accepted projections.

- [ ] **Step 2: Run migration RED**

Run: `bun test src/planning/normalizePlanningState.test.ts`

Expected: FAIL before v2 normalizer exists.

- [ ] **Step 3: Implement types + normalizer**

Keep existing fields unchanged. Accepted projection wrapper contains the validated payload, `acceptedAt`, and class reconciliation decisions/metadata required by Task 5.

- [ ] **Step 4: Normalize planning at SecureAppStorage read boundary**

After decrypt/read, current application state must receive `PlanningStateV2`; writes remain in the existing encrypted `planning` record. Do not add a VaultRecordKey.

- [ ] **Step 5: Add backup/restore compatibility tests**

Cover:
- old backup containing Planning v1 -> restore -> current v2;
- current v2 backup -> restore preserves accepted projection;
- verified rollback restores prior projection after failed candidate restore.

- [ ] **Step 6: Run persistence/security suites**

Run:
- focused planning tests;
- `bun run test:security`;
- `bun run test:library`;
- `bun run lint`.

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/planning src/security/secureAppStorage.ts src/security/backupPayload.ts src/security/*.test.ts
git commit -m "feat(a4-r2): persist accepted projections in planning v2"
```

### Task 5: Reconcile projected classes and bind accepted projection commit-first

**Repository:** `antoniocorsano-boop/registro-docente`

**Files:**
- Create: `src/planning/docenteOsProjectionReconciliation.ts`
- Create: `src/planning/docenteOsProjectionReconciliation.test.ts`
- Modify: `src/planning/docenteOsTeachingProjection.ts`
- Modify: `src/App.tsx`
- Add focused persistence contract test under `src/security/`.

**Interfaces:**
- Consumes Task 3 validated preview, A4-R2A canonical class resolver, `AppData.classes`, current `PlanningStateV2`.
- Produces:
  - reconciliation result per `sourceSectionId`: `resolved | ambiguous | unresolved`;
  - `bindAcceptedDocenteOsTeachingProjection(current, preview, reconciliation, decision): PlanningStateV2` pure mutation;
  - App durable handler that persists `planning + meta` before publishing state/success.

- [ ] **Step 1: Write reconciliation tests**

Cover:
- source `compactLabel='1A'`, local real `1A` -> resolved to its `ClassData.id`;
- source `displayLabel='1ª A'` must not create a second local class;
- two local real class IDs with semantic key `1:A` -> ambiguous;
- no local class -> unresolved;
- accepted mapping becomes invalid after class-list drift -> read-time ambiguity/unresolved, no silent retarget.

- [ ] **Step 2: Write binding/idempotency RED**

Cover:
- same fingerprint already accepted -> no duplicate;
- new fingerprint remains uncommitted until explicit accepted decision;
- replacement occurs only in derived candidate after teacher acceptance;
- failed durable save does not publish new planning or success.

- [ ] **Step 3: Implement pure reconciliation + bind helper**

Use A4-R2A semantic resolver. Store source IDs + chosen Registro class IDs, not just labels.

- [ ] **Step 4: Wire commit-first App mutation**

Reuse existing durable mutation coordinator / `savePlanningAndMeta`. Publish state only after persistence resolves.

- [ ] **Step 5: Run focused + persistence suites**

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/planning/docenteOsProjectionReconciliation* src/planning/docenteOsTeachingProjection.ts src/App.tsx src/security
git commit -m "feat(a4-r2): accept and reconcile Docente OS projections"
```

### Task 6: Unified read-only UDA catalog for Copilot/Biblioteca

**Repository:** `antoniocorsano-boop/registro-docente`

**Files:**
- Create: `src/teaching/teachingUdaCatalog.ts`
- Create: `src/teaching/teachingUdaCatalog.test.ts`
- Modify: `src/library/teachingContext.ts`
- Modify: `src/components/LibraryCopilotComposer.tsx`
- Modify as needed: `src/library/relevancePresentation.ts`, `src/components/LibraryRelevancePanel.tsx`
- Add: `src/security/a4R2ProjectedUdaAuthorityContract.test.ts`

**Interfaces:**
- Produces `TeachingUdaCandidate` from the spec and:
  - `buildTeachingUdaCatalog({ localUdas, acceptedProjections, classReconciliation, classes }): TeachingUdaCandidate[]`
  - `resolveTeachingUdaCandidate(id, catalog): TeachingUdaCandidate | null`.
- Projected IDs remain the deterministic `docente-os:...` IDs.
- `writableByRegistro=false` is enforced at mutation/outcome boundaries, not merely displayed.

- [ ] **Step 1: Write catalog RED**

Tests:
- local and projected UDA for reconciled `1A` coexist under one canonical class ID;
- projected UDA carries `origin='docente-os'`, provenance/sourceRef, `writableByRegistro=false`;
- ambiguous/unresolved projected class mapping produces no selectable projected UDA;
- same projected ID cannot duplicate after re-import.

- [ ] **Step 2: Write authority RED**

Assert that any current compound outcome path equivalent to `Adotta e aggiungi all'UDA` refuses/hides mutation for `writableByRegistro=false`, while ordinary read-only context selection remains available.

- [ ] **Step 3: Implement catalog and adapt Teaching Context resolution**

Keep legacy local UDA behavior compatible. Do not clone projected UDA into `UdaRecord[]`.

- [ ] **Step 4: Wire Copilot/Biblioteca/relevance surfaces**

Show concise provenance `Da Docente OS`. Class selection remains canonical from A4-R2A. Only projected UDA with resolved real class bindings are selectable.

- [ ] **Step 5: Run library/security tests**

Run:
- focused catalog/authority tests;
- `bun run test:library`;
- `bun run test:security`;
- `bun run lint`;
- `bun run build`.

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/teaching/teachingUdaCatalog* src/library src/components/LibraryCopilotComposer.tsx src/components/LibraryRelevancePanel.tsx src/security/a4R2ProjectedUdaAuthorityContract.test.ts
git commit -m "feat(a4-r2): expose projected UDA as read-only teaching context"
```

### Task 7: Projection import/preview UI in Registro

**Repository:** `antoniocorsano-boop/registro-docente`

**Files:**
- Create: `src/components/planning/DocenteOsProjectionPanel.tsx`
- Modify: `src/components/planning/PlanningProfileView.tsx`
- Modify: `src/security/planningProfileUiContract.test.ts` or create a dedicated A4-R2 projection UI contract test.

**Interfaces:**
- Consumes Task 3 preview validator and Task 5 reconciliation/bind App handler.
- Produces explicit file import -> preview -> acceptance UX.

- [ ] **Step 1: Write UI contract RED**

Require:
- `Importa da Docente OS` or equivalent teacher-language entry;
- JSON file chosen locally;
- preview displays source commit, generated date, school year, discipline, class/UDA counts and reconciliation status;
- acceptance button disabled/blocked when required reconciliation is unresolved;
- no success before durable App handler resolves.

- [ ] **Step 2: Run focused RED**

Expected: FAIL because panel is absent.

- [ ] **Step 3: Implement progressive import/preview UI**

Do not place raw JSON or technical contract taxonomy in the default planning viewport. Show validation failures in teacher language plus a compact technical detail disclosure if needed for diagnostics.

- [ ] **Step 4: Wire explicit acceptance**

Call the App handler only after valid preview + resolved reconciliation + explicit teacher acceptance.

- [ ] **Step 5: Run source/security/build tests**

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/planning/DocenteOsProjectionPanel.tsx src/components/planning/PlanningProfileView.tsx src/security
git commit -m "feat(a4-r2): add Docente OS projection import preview"
```

### Task 8: Cross-product browser qualification and integration boundary

**Repositories:** both Docente OS and Registro Docente

**Files:**
- Registro create: `tests/browser/a4-r2-docente-os-projection.spec.cjs`
- Registro modify: `.github/workflows/browser-qualification.yml`
- Docente OS add/extend its appropriate Browser/HVA gate for export visibility and payload generation if the existing harness can exercise downloads.

**Interfaces:**
- Consumes frozen producer contract/export candidate + frozen consumer candidate.
- Produces exact-SHA evidence in both repositories and one synthetic end-to-end fixture journey.

- [ ] **Step 1: Freeze producer exact SHA and regenerate/copy the canonical synthetic payload from that SHA**

Record producer SHA and fixture digest. Consumer qualification must name that producer source.

- [ ] **Step 2: Add Registro browser journey**

At 390×844 and desktop:
1. create synthetic real classes `1A`, `1C`;
2. import canonical synthetic projection with Docente OS `1A` + projected UDA;
3. preview provenance/counts;
4. accept;
5. reload/unlock;
6. open Copilot and enter `Attività per le classi prime`;
7. assert one `1A` choice, no duplicate ordinal variant;
8. choose `1A` and select a projected UDA labelled `Da Docente OS`;
9. assert projected UDA write mutation outcome is unavailable;
10. assert no unexpected pageerror/console error/overflow.

- [ ] **Step 3: Add persistence-failure browser injection**

Delay/reject the projection planning save. Assert no success/new projection is published; previous accepted projection remains active and retryable.

- [ ] **Step 4: Run producer exact-SHA qualification**

Require Product CI/typecheck/lint/build and browser/HVA gates relevant to the export UI. Fresh review with zero unresolved Important/Critical findings.

- [ ] **Step 5: Run consumer exact-SHA PREDEPLOY + Browser Qualification**

Require:
- all security/library/planning tests PASS;
- historical A4-R1 + A4-R2A browser tests PASS;
- new projection desktop/mobile tests PASS;
- UX-QA-01/02 zero blocking findings;
- artifact IDs/digests recorded.

- [ ] **Step 6: Fresh cross-boundary review**

Review both frozen diffs with focus on contract drift, privacy leakage, stale fingerprint handling, planning migration, write-back bypass and class retargeting.

- [ ] **Step 7: Human integration sequence**

Integrate/verify producer first so the contract/export source is canonical. Then revalidate the consumer against that exact producer contract receipt before a separate consumer integration decision.

- [ ] **Step 8: Stop before deployment**

Canonical state after integration may become `A4-R2B INTEGRATED / POST-MERGE QUALIFIED / NO DEPLOY`. Publication to AI Studio remains a separate explicit human action and live A4 revalidation is required afterward.
