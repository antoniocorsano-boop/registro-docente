# EDU-PLAN-01D Master Program Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn a teaching profile, accepted Arena context and private teaching resources into a teacher-approved, versioned annual master program with explainable UDA, real-date capacity and protected reserve.

**Architecture:** `PlanningSupportMap` is a non-authoritative planning layer linking Arena requirement refs to private-resource chunks and optional extensions. The master-program engine remains deterministic: validation, budget, ordering, provenance and approval do not require AI. Optional local semantic similarity may suggest mappings, but a teacher confirmation is required before a mapping contributes to planning. The contextual generative copilot is deferred to Tranche F.

**Tech Stack:** TypeScript/Bun, React, existing `embeddingService` for local-only suggestion mode, persisted `PlanningStateV1`.

**Spec:** `docs/superpowers/specs/2026-10-24-edu-plan-01-programmazione-didattica-design.md`

## Global Constraints

- Never label `PlanningSupportMap` states as Arena `COVERAGE/GAP` authority conclusions.
- Arena requirement refs remain immutable provenance references inside approved master versions.
- Optional book/guide content has zero planned hours until explicitly selected by the teacher.
- Default reserve remains 15% unless the profile explicitly overrides it.
- Master approval is an explicit teacher action and creates an immutable `MasterProgramVersion` snapshot.
- UDA count is not fixed; the UI encourages consolidation and warns on fragmentation, but does not enforce an arbitrary number.
- UDA must include learning experiences and evidence/assessment strategies, not only a generated description.
- Educazione civica contributions are transversal and tracked separately from ordinary discipline-budget semantics.
- No approved master version is silently rewritten when Arena/resources/profile change.

## Review Focus

- Arena requirement loses resource support → remains a planning warning, not an authoritative curriculum `GAP` assertion.
- Optional extension selected while reserve would be consumed below configured threshold → requires explicit teacher override/confirmation.
- Arena context becomes newer after master approval → approved version preserves old provenance and reports update available.
- Master draft references a deleted private resource → approval is blocked with actionable source-missing error.
- Same UDA depends on itself or creates cycle → approval is blocked.

---

## File structure

**Create**
- `src/planning/supportMap.ts`
- `src/planning/masterProgram.ts`
- `src/planning/masterProgramValidation.ts`
- `src/planning/udaPlanning.ts`
- `src/components/planning/PlanningSupportMapView.tsx`
- `src/components/planning/MasterProgramWorkspace.tsx`
- `src/components/planning/MasterUdaEditor.tsx`
- `src/components/planning/PlanningBudgetSummary.tsx`
- `src/security/planningSupportMap.test.ts`
- `src/security/masterProgram.test.ts`
- `src/security/masterProgramUiContract.test.ts`

**Modify**
- `src/planning/types.ts`
- `src/components/planning/PlanningProfileView.tsx`
- `src/App.tsx`

### Task 1: Define non-authoritative planning support mappings

**Files:** `src/planning/supportMap.ts`, `src/planning/types.ts`, `src/security/planningSupportMap.test.ts`

**Interfaces:**
```ts
export type PlanningSupportStatus = 'supported' | 'partially_supported' | 'unsupported' | 'optional_extension';

export function createPlanningSupportMap(input: {
  arenaContext: ArenaPlanningContext;
  resources: PrivateTeachingResource[];
}): PlanningSupportMap;

export function confirmPlanningSupportMapping(
  map: PlanningSupportMap,
  decision: PlanningSupportDecision
): PlanningSupportMap;
```

- [ ] **Step 1: Write failing tests**

Assert all Arena requirements begin visible even without resources; `unsupported` means “no teaching resource currently linked”, not Arena `GAP`; optional editorial chunks can exist without Arena requirement refs and carry no planned hours.

- [ ] **Step 2: Run focused test**

Run: `bun test src/security/planningSupportMap.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement map/decision functions**

Each mapping stores Arena requirement ref, resource/chunk refs, source provenance, teacher confirmation state and optional suggestion confidence separately.

- [ ] **Step 4: Run test**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/planning/supportMap.ts src/planning/types.ts src/security/planningSupportMap.test.ts
git commit -m "feat: add planning support map"
```

### Task 2: Add optional local semantic mapping suggestions

**Files:** `src/planning/supportMap.ts`, `src/security/planningSupportMap.test.ts`

**Interfaces:**
```ts
export async function suggestPlanningSupportMappings(input: {
  arenaContext: ArenaPlanningContext;
  chunks: ResourceChunk[];
  embeddingConfig: LocalEmbeddingConfig;
}): Promise<PlanningSupportSuggestion[]>;
```

- [ ] **Step 1: Write failing suggestion tests with a fake embedder boundary**

Assert suggestions never become confirmed mappings; low similarity produces no suggestion; source refs/chunk refs survive ranking.

- [ ] **Step 2: Run focused test and confirm RED**

- [ ] **Step 3: Implement local-only suggestion path**

If configured provider is not local or local embeddings are unavailable, return `[]` and keep manual mapping fully usable. Do not trigger Gemini remote from this automatic background operation.

- [ ] **Step 4: Run tests**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/planning/supportMap.ts src/security/planningSupportMap.test.ts
git commit -m "feat: suggest local planning mappings"
```

### Task 3: Build master UDA and immutable versioning engine

**Files:** `src/planning/udaPlanning.ts`, `src/planning/masterProgram.ts`, `src/planning/masterProgramValidation.ts`, `src/security/masterProgram.test.ts`

**Interfaces:**
```ts
export function createMasterProgramDraft(profileId: string, arenaContextId: string): MasterProgram;
export function validateMasterProgramDraft(state: PlanningStateV1, program: MasterProgram): string[];
export function approveMasterProgramVersion(input: {
  state: PlanningStateV1;
  masterProgramId: string;
  approvedAt: string;
}): { state: PlanningStateV1; version: MasterProgramVersion };
```

UDA planning records must include: title, planned hours, window start/end, dependencies, Arena requirement refs, resource refs, `learningExperiences[]`, `evidenceStrategies[]`, classification `essential | consolidation | optional_extension`, and `transversalContributions[]`.

- [ ] **Step 1: Write failing master-program tests**

Cover missing Arena refs, missing resource refs, dependency cycles, reserve overflow, optional extension budget, first-period date fit, immutable version snapshot and re-approval creating a new version rather than editing prior version.

- [ ] **Step 2: Run focused test**

Run: `bun test src/security/masterProgram.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement pure draft/validation/version functions**

Use `calculateEffectiveCapacity()` from Tranche A. Approval fails if required planning references are structurally invalid; warnings that are pedagogical choices remain reviewable rather than hard failures.

- [ ] **Step 4: Run tests**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/planning/udaPlanning.ts src/planning/masterProgram.ts src/planning/masterProgramValidation.ts src/security/masterProgram.test.ts
git commit -m "feat: add versioned master programs"
```

### Task 4: Build the double-map and annual-program UI

**Files:** planning components listed above plus `PlanningProfileView.tsx`, `App.tsx`, `src/security/masterProgramUiContract.test.ts`

**Interfaces:**
- `PlanningSupportMapView` shows Arena requirement → private resource support, partial/none, source refs and confirmation controls.
- `MasterProgramWorkspace` shows ordered UDA, capacity/reserve and approval status.
- `MasterUdaEditor` edits one draft UDA only; it does not edit approved version snapshots.

- [ ] **Step 1: Write failing UI/source-contract tests**

Assert visible words/regions for Arena source, book/guide source, support state, optional extension, planned/effective/reserve hours and explicit “Approva programmazione madre”. Assert no `COVERAGE`/`GAP` authority copy is used for resource support.

- [ ] **Step 2: Run focused UI test**

- [ ] **Step 3: Implement progressive workflow**

Within `Programmazione didattica`: Profilo → Fonti → Mappa → Programmazione madre. Preserve teacher orientation on mobile rather than rendering a desktop Gantt table squeezed to phone width.

- [ ] **Step 4: Wire all saves through `commitPlanningMutation`**

Pending approval/save actions are disabled; success appears only post-commit.

- [ ] **Step 5: Run focused tests/type/build**

```bash
bun test src/security/planningSupportMap.test.ts src/security/masterProgram.test.ts src/security/masterProgramUiContract.test.ts
bun run lint
bun run build
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/planning src/App.tsx src/security/masterProgramUiContract.test.ts
git commit -m "feat: add master program workspace"
```

## Tranche exit gate

Browser qualification must prove one synthetic Technology level can: inspect Arena provenance; link book/guide support; identify unsupported and optional material without authority confusion; create a small set of UDA; maintain configured reserve; add learning experiences/evidence strategies; record a transversal civic contribution; approve master v1; reload/unlock and recover the immutable approved version.
