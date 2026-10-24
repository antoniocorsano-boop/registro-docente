# EDU-PLAN-01B Arena Read-Only Handoff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish a governed, visible, fail-closed Arena → Registro Docente curriculum handoff without repurposing the existing Docente OS-targeted `CurriculumSnapshot v1`.

**Architecture:** This tranche is intentionally cross-repository. Arena first defines and validates `ARENA_REGISTRO_PLANNING_CONTEXT_V1`; Registro Docente then implements a narrow validator/adapter into its `ArenaPlanningContext` domain and a teacher-facing authority panel. Initial transport is explicit JSON import/export, not hidden runtime sync; runtime transport can replace the carrier later without changing the contract.

**Tech Stack:** Arena JSON Schema/Node validation patterns, TypeScript/Bun in Registro Docente, React UI, Secure Local Vault planning record from Tranche A.

**Spec:** `docs/superpowers/specs/2026-10-24-edu-plan-01-consolidation-amendment-v1.1.md`

## Global Constraints

- Arena remains the only curriculum authority.
- Do not mutate `CURRICULUM_SNAPSHOT_V1.schema.json` or change its `targetProduct = DOCENTE_OS` downstream contract.
- New identifiers use `CURRICOLO` vocabulary where they are not legacy compatibility identifiers.
- Contract must expose curriculum version, authority state, vigency, structural fingerprint, institution, school year, discipline, grade/cohort, applicability status/regime and planning requirement references.
- `PROVISIONAL_COMPLETE` must remain visibly non-vigente; Registro Docente must never relabel it as approved.
- Grade II/III cannot receive invented fingerprints merely because static Arena readability cases exist.
- Import is preview/read-only, requires teacher acceptance, and permits no automatic curriculum write.
- Registro Docente stores the accepted snapshot/context and provenance; it never writes back to Arena in this tranche.

## Review Focus

- Valid schema but `PROVISIONAL_COMPLETE` presented as “approvato” → must be impossible in adapter/UI.
- Grade/cohort/regime mismatch against the selected teaching profile → reject import, do not silently attach.
- Fingerprint or required provenance missing → reject even if human-readable curriculum text is present.
- Static Grade II/III Arena case without governed materialized fingerprint → reject as non-importable context.
- Re-import of newer Arena context after a master program exists → store as update-available; do not rewrite an approved program automatically.

---

## File structure

### Arena repository `antoniocorsano-boop/CurManLight_arena`

**Create**
- `docs/contracts/ARENA_REGISTRO_PLANNING_CONTEXT_V1.schema.json`
- `docs/contracts/fixtures/arena-registro-planning-context-tech-grade1.json`
- `docs/architecture/ARENA_REGISTRO_PLANNING_HANDOFF_V1.md`
- `scripts/validate-registro-planning-context.mjs`
- `tests/arena-registro-planning-context.test.mjs` or the repository's current equivalent contract-test location.

### Registro Docente repository

**Create**
- `src/planning/arena/arenaPlanningContract.ts`
- `src/planning/arena/arenaPlanningAdapter.ts`
- `src/components/planning/ArenaAuthorityPanel.tsx`
- `src/components/planning/PlanningProfileView.tsx`
- `src/security/arenaPlanningImport.test.ts`
- `src/security/arenaAuthorityUiContract.test.ts`

**Modify**
- `src/planning/types.ts`
- `src/types.ts` — add `ActiveTab` entry `programmazione` only in this tranche.
- `src/components/Navbar.tsx` — add “Programmazione didattica” under “Didattica e strumenti”.
- `src/App.tsx` — render planning profile view and persist accepted Arena context via `commitPlanningMutation`.

### Task 1: Define the Arena→Registro contract in Arena

**Files:** Arena files listed above.

**Interfaces:**
- Produces JSON contract `ARENA_REGISTRO_PLANNING_CONTEXT_V1`, `contractVersion: 1`.
- Required downstream policy: `targetProduct: "REGISTRO_DOCENTE"`, `importMode: "PREVIEW_ONLY"`, `acceptanceRequired: true`, `automaticWriteAllowed: false`.

- [ ] **Step 1: Write the failing Arena contract test**

Test that a Grade I Technology fixture must carry:
- source `curriculumVersionRef` and current fingerprint;
- `authorityState` in `APPROVED | PROVISIONAL_COMPLETE`;
- `vigencyStatus` in `VIGENTE | NON_VIGENTE`;
- institution, schoolYear, discipline, grade/cohort;
- explicit `applicabilityStatus` and `regimeRef`;
- planning `requirements[]` with stable references and provenance;
- Registro Docente downstream policy constants.

Also assert `PROVISIONAL_COMPLETE + VIGENTE` is invalid.

- [ ] **Step 2: Run Arena contract test**

Run the repository's focused Node/Bun contract-test command for the new file.
Expected: FAIL because schema/validator do not exist.

- [ ] **Step 3: Implement schema and validator**

Do not copy the Docente OS downstream policy. Reuse canonical reference/fingerprint semantics while creating a distinct consumer profile.

- [ ] **Step 4: Materialize only a governed Grade I Technology fixture**

The fixture must derive from a real current Arena source/fingerprint. Do not generate Grade II/III fingerprints if Arena has not materialized them.

- [ ] **Step 5: Run Arena contract/governance tests**

Expected: PASS with legacy `CurriculumSnapshot v1` unchanged.

- [ ] **Step 6: Commit in Arena**

```bash
git add docs/contracts docs/architecture scripts tests
git commit -m "feat: add Registro Docente planning handoff contract"
```

**Human checkpoint:** do not implement the Registro consumer until the new Arena contract/profile has passed Arena review and is explicitly accepted as the handoff boundary.

### Task 2: Validate the Arena contract in Registro Docente

**Files:**
- Create: `src/planning/arena/arenaPlanningContract.ts`
- Create: `src/security/arenaPlanningImport.test.ts`

**Interfaces:**
- Produces:
```ts
export function parseArenaPlanningContext(input: unknown): ArenaPlanningContext;
export class ArenaPlanningContextError extends Error {}
```

- [ ] **Step 1: Add failing parser tests**

Use copied test fixtures in the test body or a dedicated test fixture directory. Assert acceptance of the exact governed Grade I shape and rejection of wrong targetProduct, missing fingerprint, invalid authority/vigency combination and missing cohort/regime.

- [ ] **Step 2: Run focused test**

Run: `bun test src/security/arenaPlanningImport.test.ts`
Expected: FAIL because parser does not exist.

- [ ] **Step 3: Implement fail-closed parser**

Do not accept arbitrary Arena export JSON or `ARENA_ATLAS_CURRICULUM_EXPORT_V1`; only the dedicated planning context contract/version is accepted.

- [ ] **Step 4: Re-run focused test**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/planning/arena/arenaPlanningContract.ts src/security/arenaPlanningImport.test.ts
git commit -m "feat: validate Arena planning context"
```

### Task 3: Bind accepted Arena context to the selected teaching profile

**Files:**
- Create: `src/planning/arena/arenaPlanningAdapter.ts`
- Modify: `src/planning/types.ts`
- Modify: `src/security/arenaPlanningImport.test.ts`

**Interfaces:**
- Produces:
```ts
export function bindArenaContextToProfile(
  context: ArenaPlanningContext,
  profile: TeachingProfile
): ArenaProfileBindingResult;
```
- `ArenaProfileBindingResult` is either `{ status: 'bound'; context: ArenaPlanningContext }` or `{ status: 'rejected'; reasons: string[] }`.

- [ ] **Step 1: Add failing binding tests**

Pin school year, school order, grade/cohort and subject matching. A 2026/27 Grade I Technology context with 2025 regime must not bind to a Grade II profile; a Grade II profile must not be silently retrofitted to 2025.

- [ ] **Step 2: Run test and confirm RED**

- [ ] **Step 3: Implement exact matching/transition checks**

The adapter may read regime metadata from Arena; it must not derive a more authoritative regime than Arena supplied.

- [ ] **Step 4: Run test**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/planning/arena/arenaPlanningAdapter.ts src/planning/types.ts src/security/arenaPlanningImport.test.ts
git commit -m "feat: bind Arena context to teaching profile"
```

### Task 4: Make Arena provenance and authority state visible in the planning UI

**Files:**
- Create: `src/components/planning/ArenaAuthorityPanel.tsx`
- Create: `src/components/planning/PlanningProfileView.tsx`
- Create: `src/security/arenaAuthorityUiContract.test.ts`
- Modify: `src/types.ts`
- Modify: `src/components/Navbar.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- `ArenaAuthorityPanel` consumes `ArenaPlanningContext | null` and never transforms its authority state.
- `PlanningProfileView` consumes `PlanningStateV1`, classes, `onUpdatePlanning`, and exposes explicit JSON import + teacher acceptance.

- [ ] **Step 1: Write failing source/UI contract tests**

Assert source contains visible labels for `Arena`, curriculum version, regime, authority/vigency state and provenance action; assert `PROVISIONAL_COMPLETE` renders copy containing `provvisorio`/`non vigente`, never `approvato`.

- [ ] **Step 2: Run focused tests**

Run: `bun test src/security/arenaAuthorityUiContract.test.ts`
Expected: FAIL.

- [ ] **Step 3: Add `programmazione` navigation and profile screen**

Place it under existing “Didattica e strumenti”. Import is explicit and previews contract/profile match before a separate “Accetta riferimento Arena” action persists it.

- [ ] **Step 4: Persist acceptance via `commitPlanningMutation`**

Re-importing a distinct `curriculumVersionRef` stores the new context as available/current reference but does not mutate existing approved master versions.

- [ ] **Step 5: Run test/type/build**

```bash
bun test src/security/arenaPlanningImport.test.ts src/security/arenaAuthorityUiContract.test.ts
bun run lint
bun run build
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/planning src/types.ts src/components/Navbar.tsx src/App.tsx src/security
git commit -m "feat: show governed Arena curriculum context"
```

## Tranche exit gate

Browser qualification with synthetic/non-personal data must prove:
- Programmazione didattica is reachable from “Didattica e strumenti”.
- Accepted Arena source/version/status is always visible on the planning screen.
- PROVISIONAL_COMPLETE appears non-vigente.
- mismatched grade/cohort JSON cannot be accepted;
- refresh + vault lock/unlock preserves the accepted context;
- no Arena write-back endpoint/action exists;
- existing UDA and student workflows remain unaffected.
