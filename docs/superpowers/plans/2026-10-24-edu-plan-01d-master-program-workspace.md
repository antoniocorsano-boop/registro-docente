# EDU-PLAN-01D Master Program Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn a teaching profile, accepted Arena context and private teaching resources into a teacher-approved, versioned annual master program with explainable UDA, real-date capacity and protected reserve.

**Architecture:** `PlanningSupportMap` is a non-authoritative planning layer linking Arena requirement refs to private-resource chunks and optional extensions. The master-program engine remains deterministic: validation, budget, ordering, provenance and approval do not require AI. Optional local semantic similarity may suggest mappings, but teacher confirmation is required before a mapping contributes to planning. Resource-edition checks produce review warnings only; Arena remains authoritative. The generative copilot is deferred to Tranche F.

**Tech Stack:** TypeScript/Bun, React, existing `embeddingService` for local-only suggestion mode, persisted `PlanningStateV1`.

**Spec:** `docs/superpowers/specs/2026-10-24-edu-plan-01-programmazione-didattica-design.md`

## Global Constraints

- Never label `PlanningSupportMap` states as Arena `COVERAGE/GAP` authority conclusions.
- Arena requirement refs remain immutable provenance references inside approved master versions.
- Optional book/guide content has zero planned hours until explicitly selected by the teacher.
- Book-edition age/regime checks are warnings, never claims that a book is “wrong” or non-compliant.
- Default reserve remains 15% unless the profile explicitly overrides it.
- Master approval is an explicit teacher action and creates an immutable `MasterProgramVersion` snapshot.
- UDA count is not fixed; the UI encourages consolidation and warns on fragmentation but does not enforce an arbitrary number.
- UDA include learning experiences and evidence/assessment strategies, not only a description.
- Educazione civica contributions are transversal and tracked separately from ordinary discipline-budget semantics.
- No approved master version is silently rewritten when Arena/resources/profile change.

## Review Focus

- Arena requirement has no linked resource → planning warning only, never authoritative Arena `GAP`.
- Textbook predates the selected new-regime cohort → visible “verifica allineamento” warning, not hard rejection.
- Optional extension would consume protected reserve → explicit teacher decision required.
- Newer Arena context after master approval → old version provenance preserved and update reported.
- Master draft references deleted private resource or has dependency cycle → approval blocked with actionable error.

---

## File structure

**Create**
- `src/planning/supportMap.ts`
- `src/planning/resourceCompatibility.ts`
- `src/planning/masterProgram.ts`
- `src/planning/masterProgramValidation.ts`
- `src/planning/udaPlanning.ts`
- `src/components/planning/PlanningSupportMapView.tsx`
- `src/components/planning/MasterProgramWorkspace.tsx`
- `src/components/planning/MasterUdaEditor.tsx`
- `src/components/planning/PlanningBudgetSummary.tsx`
- `src/security/planningSupportMap.test.ts`
- `src/security/resourceCompatibility.test.ts`
- `src/security/masterProgram.test.ts`
- `src/security/masterProgramUiContract.test.ts`

**Modify**
- `src/planning/types.ts`
- `src/components/planning/PlanningProfileView.tsx`
- `src/App.tsx`

### Task 1: Define non-authoritative planning support mappings

**Interfaces:**
```ts
export type PlanningSupportStatus =
  | 'supported'
  | 'partially_supported'
  | 'unsupported'
  | 'optional_extension';

export function createPlanningSupportMap(input: {
  arenaContext: ArenaPlanningContext;
  resources: PrivateTeachingResource[];
}): PlanningSupportMap;

export function confirmPlanningSupportMapping(
  map: PlanningSupportMap,
  decision: PlanningSupportDecision
): PlanningSupportMap;
```

- [ ] **Step 1: Write failing tests**: all Arena requirements remain visible with no resources; `unsupported` means “no teaching resource linked”, not Arena `GAP`; optional editorial chunks can exist without Arena refs and carry no hours.
- [ ] **Step 2: Run** `bun test src/security/planningSupportMap.test.ts` → FAIL.
- [ ] **Step 3: Implement mapping/decision functions** storing Arena refs, resource/chunk refs, provenance, teacher-confirmation state and suggestion confidence separately.
- [ ] **Step 4: Re-run** → PASS.
- [ ] **Step 5: Commit** `feat: add planning support map`.

### Task 2: Add resource-edition/regime review warnings

**Interfaces:**
```ts
export type ResourceCompatibilityStatus =
  | 'no_signal'
  | 'review_recommended'
  | 'teacher_confirmed';

export function assessResourceCompatibility(input: {
  resource: PrivateTeachingResource;
  profile: TeachingProfile;
  arenaContext: ArenaPlanningContext;
}): ResourceCompatibilityAssessment;
```

- [ ] **Step 1: Write failing tests**

For a Grade I 2026/27 context explicitly governed by the new 2025 regime, a textbook edition whose publication metadata predates that transition yields `review_recommended`; missing publication year yields `no_signal`; teacher confirmation can mark the warning reviewed without changing Arena authority.

- [ ] **Step 2: Run** `bun test src/security/resourceCompatibility.test.ts` → FAIL.
- [ ] **Step 3: Implement heuristic warning only**; never infer legal non-compliance and never block use solely because of publication year.
- [ ] **Step 4: Re-run** → PASS.
- [ ] **Step 5: Commit** `feat: flag teaching resource alignment review`.

### Task 3: Add optional local semantic mapping suggestions

**Interfaces:**
```ts
export async function suggestPlanningSupportMappings(input: {
  arenaContext: ArenaPlanningContext;
  chunks: ResourceChunk[];
  embeddingConfig: LocalEmbeddingConfig;
}): Promise<PlanningSupportSuggestion[]>;
```

- [ ] **Step 1: Write failing tests with an injected fake embedder**; suggestions never become confirmed mappings; low similarity produces no suggestion; source refs survive ranking.
- [ ] **Step 2: Run focused test** → FAIL.
- [ ] **Step 3: Implement local-only suggestion path**; if provider is remote/unavailable return `[]`, keeping manual mapping fully usable. Do not silently send private chunks to Gemini.
- [ ] **Step 4: Re-run** → PASS.
- [ ] **Step 5: Commit** `feat: suggest local planning mappings`.

### Task 4: Build master UDA and immutable versioning engine

**Interfaces:**
```ts
export function createMasterProgramDraft(
  profileId: string,
  arenaContextId: string
): MasterProgram;

export function validateMasterProgramDraft(
  state: PlanningStateV1,
  program: MasterProgram
): string[];

export function approveMasterProgramVersion(input: {
  state: PlanningStateV1;
  masterProgramId: string;
  approvedAt: string;
}): { state: PlanningStateV1; version: MasterProgramVersion };
```

UDA planning records include title, planned hours, start/end window, dependencies, Arena requirement refs, resource refs, `learningExperiences[]`, `evidenceStrategies[]`, `essential | consolidation | optional_extension`, and `transversalContributions[]`.

- [ ] **Step 1: Write failing tests** for missing refs, cycles, reserve overflow, optional-extension budget, first/other assessment-period date fit, immutable version snapshot and re-approval creating a new version.
- [ ] **Step 2: Run** `bun test src/security/masterProgram.test.ts` → FAIL.
- [ ] **Step 3: Implement pure draft/validation/version functions** using `calculateEffectiveCapacity()` from Tranche A. Structural invalidity blocks approval; pedagogical warnings remain teacher-reviewable.
- [ ] **Step 4: Re-run** → PASS.
- [ ] **Step 5: Commit** `feat: add versioned master programs`.

### Task 5: Build double-map and annual-program UI

**Interfaces:**
- `PlanningSupportMapView` shows Arena requirement → private-resource support, partial/none, source refs and confirmation controls.
- `MasterProgramWorkspace` shows ordered UDA, capacity/reserve, resource-alignment warnings and approval status.
- `MasterUdaEditor` edits draft UDA only, never approved version snapshots.

- [ ] **Step 1: Write failing UI contract tests** requiring visible Arena source, book/guide provenance, support state, optional extension, resource-alignment warning, planned/effective/reserve hours and explicit “Approva programmazione madre”. Assert no Arena-authority `COVERAGE/GAP` copy is used for resource support.
- [ ] **Step 2: Run** `bun test src/security/masterProgramUiContract.test.ts` → FAIL.
- [ ] **Step 3: Implement workflow** `Profilo → Fonti → Mappa → Programmazione madre`, with mobile-specific layout rather than a squeezed desktop Gantt.
- [ ] **Step 4: Wire saves/approval through `commitPlanningMutation`**; pending actions disabled and success post-commit only.
- [ ] **Step 5: Run**

```bash
bun test src/security/planningSupportMap.test.ts src/security/resourceCompatibility.test.ts src/security/masterProgram.test.ts src/security/masterProgramUiContract.test.ts
bun run lint
bun run build
```

Expected: PASS.

- [ ] **Step 6: Commit** `feat: add master program workspace`.

## Tranche exit gate

Browser qualification proves one synthetic Technology level can inspect Arena provenance; see an old-edition review warning without false prohibition; link book/guide support; distinguish unsupported vs optional material without authority confusion; create a small set of UDA; preserve reserve; add learning experiences/evidence strategies and a transversal civic contribution; approve master v1; reload/unlock and recover the immutable approved version.
