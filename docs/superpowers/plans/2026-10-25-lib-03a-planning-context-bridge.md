# LIB-03A Planning Context Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a pure, fail-closed read-only bridge between the operational UDA/lesson domain and the annual Planning domain so later Library relevance work can consume one trustworthy context without migrating or mutating either domain.

**Architecture:** Add one focused library module that normalizes school-year/subject/class-level identity, resolves exactly one compatible `TeachingProfile`, and optionally attaches exactly one authoritative Arena context. Keep all behavior pure and local; no UI, persistence, embeddings, providers, `MasterProgram` activation, or cross-dataset writes.

**Tech Stack:** TypeScript, Bun test, existing `UdaRecord`, `ResolvedLibraryTeachingContext`, `PlanningStateV1` and Arena context types.

**Spec:** `docs/superpowers/specs/2026-10-25-lib-03a-planning-context-bridge-design.md`

## Global Constraints

- Baseline: `main@c9dd66c35b65a9edfe0f508f6842eefe4be562bf`.
- No UI changes.
- No persistence/schema changes.
- No embedding/provider/network calls.
- No UDA → `MasterProgram` migration and no use of `planning.resources`.
- No link mutation in Library.
- No curriculum-coverage claims from Arena items.
- Fail closed on ambiguous profile or Arena-context matches.
- Exact-SHA qualification before any integration decision.

## Review Focus

- Class labels with malformed or out-of-range grade values must return unresolved rather than guessing.
- Equivalent school-year spellings (`2026-2027`, `2026/2027`, `2026/27`) must compare equal without mutating persisted values.
- Duplicate compatible planning profiles must return `ambiguous`, never first-match wins.
- Multiple authoritative Arena contexts for one resolved profile must return `ambiguous`, never newest/last wins.
- Provisional, non-vigente, or non-professional Arena contexts must never be surfaced as authoritative context.

---

### Task 1: Define the bridge contract with causal RED tests

**Files:**
- Create: `src/library/planningContextBridge.test.ts`
- Create after RED only: `src/library/planningContextBridge.ts`

**Interfaces:**
- Consumes: `ResolvedLibraryTeachingContext`, `PlanningStateV1`, `TeachingProfile`, `ArenaPlanningContext`.
- Produces: `resolveClassGradeLevel(className: string): number | null`, `normalizeSchoolYear(value: string): string | null`, `resolveLibraryPlanningContext(input: ResolveLibraryPlanningContextInput): LibraryPlanningContextResolution`.

- [ ] **Step 1: Write RED tests for identity helpers**

Tests must assert:
- `3ª C`, `3A`, `3 A`, `3^A` → `3`;
- malformed labels and values outside 1..5 → `null`;
- `2026-2027`, `2026/2027`, `2026/27` normalize to the same canonical comparison value;
- malformed school years → `null`.

- [ ] **Step 2: Write RED tests for profile resolution**

Construct a minimal `ResolvedLibraryTeachingContext` and `PlanningStateV1` fixture. Assert:
- missing teaching context → `{ status: 'unavailable', reason: 'TEACHING_CONTEXT_MISSING' }`;
- unresolved class grade → `GRADE_LEVEL_UNRESOLVED`;
- zero compatible profiles → `PLANNING_PROFILE_NOT_FOUND`;
- one compatible profile → `resolved` with that profile and `arenaContext: null`;
- two compatible profiles → `ambiguous` / `PLANNING_PROFILE_AMBIGUOUS`.

Profile compatibility is exact after normalization on school year, subject, and grade level. `cohortRef` is not derived from the operational class and therefore is not used to select between otherwise compatible profiles; duplicates remain ambiguous.

- [ ] **Step 3: Write RED tests for Arena resolution**

Assert:
- exactly one matching `APPROVED` + `VIGENTE` + `PROFESSIONAL_NON_PERSONAL` context for the resolved profile is returned;
- provisional/non-vigente/non-professional contexts are ignored;
- zero authoritative contexts leaves the overall result `resolved` with `arenaContext: null`;
- more than one authoritative matching context → `ambiguous` / `ARENA_CONTEXT_AMBIGUOUS`.

Arena compatibility must additionally match `profileId`, normalized school year, normalized subject, `gradeLevel`, and exact `cohortRef`.

- [ ] **Step 4: Commit RED tests only**

Commit message: `test(lib-03a): define planning context bridge contract`.

- [ ] **Step 5: Verify causal RED through PREDEPLOY**

Expected: `test:library` fails because `planningContextBridge.ts`/exports do not yet exist, while unrelated security/typecheck/build/startup remain unaffected as far as the runner can reach them.

---

### Task 2: Implement the minimal pure bridge

**Files:**
- Create: `src/library/planningContextBridge.ts`
- Test: `src/library/planningContextBridge.test.ts`

**Interfaces:**

```ts
export type LibraryPlanningContextReason =
  | 'TEACHING_CONTEXT_MISSING'
  | 'GRADE_LEVEL_UNRESOLVED'
  | 'PLANNING_PROFILE_NOT_FOUND'
  | 'PLANNING_PROFILE_AMBIGUOUS'
  | 'ARENA_CONTEXT_AMBIGUOUS'
  | 'RESOLVED';

export interface ResolveLibraryPlanningContextInput {
  teachingContext: ResolvedLibraryTeachingContext | null;
  planning: PlanningStateV1;
  schoolYear: string;
  subjectCode: string;
}

export type LibraryPlanningContextResolution =
  | { status: 'resolved'; reason: 'RESOLVED'; teachingContext: ResolvedLibraryTeachingContext; profile: TeachingProfile; arenaContext: ArenaPlanningContext | null }
  | { status: 'unavailable'; reason: 'TEACHING_CONTEXT_MISSING' | 'GRADE_LEVEL_UNRESOLVED' | 'PLANNING_PROFILE_NOT_FOUND' }
  | { status: 'ambiguous'; reason: 'PLANNING_PROFILE_AMBIGUOUS' | 'ARENA_CONTEXT_AMBIGUOUS' };

export function resolveClassGradeLevel(className: string): number | null;
export function normalizeSchoolYear(value: string): string | null;
export function resolveLibraryPlanningContext(input: ResolveLibraryPlanningContextInput): LibraryPlanningContextResolution;
```

- [ ] **Step 1: Implement `resolveClassGradeLevel` minimally**

Accept only a leading integer `1..5` followed by end-of-string or a conventional class separator/indicator; reject values outside range and malformed labels.

- [ ] **Step 2: Implement `normalizeSchoolYear` minimally**

Return canonical `YYYY-YYYY` only when the second year is exactly the next academic year; expand a two-digit trailing year using the first year's century.

- [ ] **Step 3: Implement profile matching**

Normalize input/profile school year and subject (trim + lowercase), require exact grade equality, and return not-found/ambiguous/resolved deterministically.

- [ ] **Step 4: Implement authoritative Arena matching**

Filter only contexts that match the resolved profile identity and are `APPROVED`, `VIGENTE`, `PROFESSIONAL_NON_PERSONAL`. Return null for zero, ambiguous for more than one.

- [ ] **Step 5: Run bridge tests and complete `test:library`**

Expected: all bridge tests PASS and all existing library tests remain PASS.

- [ ] **Step 6: Commit GREEN**

Commit message: `feat(lib-03a): add planning context bridge`.

---

### Task 3: Qualification and independent review

**Files:**
- No product files unless a causal finding requires a new TDD cycle.
- Update Draft PR body with exact evidence.

**Interfaces:**
- Consumes: exact GREEN commit from Task 2.
- Produces: a qualified LIB-03A candidate ready for human integration decision.

- [ ] **Step 1: Open/maintain Draft PR**

Title: `LIB-03A — Planning Context Bridge`.

State explicitly: no merge/deploy, pure read-only bridge, no UI/provider/persistence changes.

- [ ] **Step 2: Run PREDEPLOY on exact candidate**

Require PASS for typecheck, security tests, library tests, build, and production startup smoke.

- [ ] **Step 3: Inspect diff scope**

Require only spec/plan, bridge test, bridge implementation. Any other changed file requires explanation or removal.

- [ ] **Step 4: Request fresh independent Codex review on exact candidate**

Review focus: ambiguous identity fail-closed, year normalization, Arena authority filter, no hidden mutation/network/provider dependency.

- [ ] **Step 5: If review finds an issue, reproduce it with RED before production changes**

No direct patch from prose-only review findings.

- [ ] **Step 6: Freeze candidate**

Final state target: `LIB-03A ENGINEERING QUALIFIED / TERMINAL REVIEW PASS / READY FOR HUMAN INTEGRATION DECISION`.

No merge and no deploy.