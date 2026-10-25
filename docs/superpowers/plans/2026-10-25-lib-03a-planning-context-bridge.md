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
- Revalidate accepted Arena identity against the current profile; no stale-context reuse after profile edits.
- Exact-SHA qualification before any integration decision.

## Review Focus

- Class labels with malformed or out-of-range grade values must return unresolved rather than guessing.
- Equivalent school-year spellings (`2026-2027`, `2026/2027`, `2026/27`) must compare equal without mutating persisted values.
- Duplicate compatible planning profiles must return `ambiguous`, never first-match wins.
- Multiple authoritative Arena contexts for one resolved profile must return `ambiguous`, never newest/last wins.
- Provisional, non-vigente, non-professional or identity-stale Arena contexts must never be surfaced as authoritative context.
- Arena identity must remain coherent with the acceptance boundary, including `schoolOrder` and `normativeRegime/regimeRef`.

---

### Task 1: Define the bridge contract with causal RED tests

**Files:**
- Create: `src/library/planningContextBridge.test.ts`
- Create after RED only: `src/library/planningContextBridge.ts`

**Interfaces:**
- Consumes: `ResolvedLibraryTeachingContext`, `PlanningStateV1`, `TeachingProfile`, `ArenaPlanningContext`.
- Produces: `resolveClassGradeLevel(className: string): number | null`, `normalizeSchoolYear(value: string): string | null`, `resolveLibraryPlanningContext(input: ResolveLibraryPlanningContextInput): LibraryPlanningContextResolution`.

- [x] **Step 1: Write RED tests for identity helpers**

Tests assert:
- `3ª C`, `3A`, `3 A`, `3^A` → `3`;
- malformed labels and values outside 1..5 → `null`;
- `2026-2027`, `2026/2027`, `2026/27` normalize to the same canonical comparison value;
- malformed school years → `null`.

- [x] **Step 2: Write RED tests for profile resolution**

Construct a minimal `ResolvedLibraryTeachingContext` and `PlanningStateV1` fixture. Assert:
- missing teaching context → `{ status: 'unavailable', reason: 'TEACHING_CONTEXT_MISSING' }`;
- unresolved class grade → `GRADE_LEVEL_UNRESOLVED`;
- zero compatible profiles → `PLANNING_PROFILE_NOT_FOUND`;
- one compatible profile → `resolved` with that profile and `arenaContext: null`;
- two compatible profiles → `ambiguous` / `PLANNING_PROFILE_AMBIGUOUS`.

Profile compatibility is exact after normalization on school year, subject, and grade level. `cohortRef` is not derived from the operational class and therefore is not used to select between otherwise compatible profiles; duplicates remain ambiguous.

- [x] **Step 3: Write RED tests for Arena resolution**

Assert:
- exactly one matching `APPROVED` + `VIGENTE` + `PROFESSIONAL_NON_PERSONAL` context for the resolved profile is returned;
- provisional/non-vigente/non-professional contexts are ignored;
- zero authoritative contexts leaves the overall result `resolved` with `arenaContext: null`;
- more than one authoritative matching context → `ambiguous` / `ARENA_CONTEXT_AMBIGUOUS`.

Arena compatibility additionally matches `profileId`, normalized school year, current mapped `schoolOrder`, normalized subject, `gradeLevel`, exact `cohortRef`, and exact current `normativeRegime/regimeRef`.

- [x] **Step 4: Commit RED tests only**

Initial RED: `d9081a5b2909d248292cb58e17b395d3b9fc516f`.

- [x] **Step 5: Verify causal RED through PREDEPLOY**

PREDEPLOY #582 failed only in the nine new bridge contracts because the production bridge did not yet exist; security/typecheck/build/startup remained green.

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

- [x] **Step 1: Implement `resolveClassGradeLevel` minimally**

Accept only a leading integer `1..5` followed by end-of-string or a conventional class separator/indicator; reject values outside range and malformed labels.

- [x] **Step 2: Implement `normalizeSchoolYear` minimally**

Return canonical `YYYY-YYYY` only when the second year is exactly the next academic year; expand a two-digit trailing year using the first year's century.

- [x] **Step 3: Implement profile matching**

Normalize input/profile school year and subject (trim + lowercase), require exact grade equality, and return not-found/ambiguous/resolved deterministically.

- [x] **Step 4: Implement authoritative Arena matching**

Filter only contexts matching the current profile identity and `APPROVED`, `VIGENTE`, `PROFESSIONAL_NON_PERSONAL`. Identity includes mapped `schoolOrder` and exact `normativeRegime/regimeRef`, so a context accepted against an older profile configuration is not silently reused.

- [x] **Step 5: Initial GREEN**

Initial GREEN `14a705f79b477273ae10f8151f1afe9b539dc9c9`: PREDEPLOY #583 PASS. Coverage-only candidate `6a1c33bbc658ac8398c821973ad054a738cc8cf5`: PREDEPLOY #584 and Browser #304 PASS.

- [x] **Step 6: Reproduce stale Arena identity before fixing it**

Test-only RED `4051bfa84a4203f88dfbcbfff517f92fd1ed268a` added contexts with stale `schoolOrder` and `regimeRef`. PREDEPLOY #585 produced exactly one library failure while 370/370 security tests, typecheck, build and production startup remained green. The bridge returned `ambiguous` because stale contexts were still being counted.

- [x] **Step 7: Apply minimal stale-context fix**

Production matching now revalidates `schoolOrder` and `normativeRegime/regimeRef` against the current profile in addition to the pre-existing identity/authority filters.

---

### Task 3: Qualification and independent review

**Files:**
- No product files unless a causal finding requires a new TDD cycle.
- Update Draft PR body with exact evidence.

**Interfaces:**
- Consumes: exact final GREEN commit from Task 2.
- Produces: a qualified LIB-03A candidate ready for human integration decision.

- [ ] **Step 1: Maintain Draft PR #50**

State explicitly: no merge/deploy, pure read-only bridge, no UI/provider/persistence changes.

- [ ] **Step 2: Run PREDEPLOY on exact final candidate**

Require PASS for typecheck, security tests, library tests, build, and production startup smoke.

- [ ] **Step 3: Inspect diff scope**

Require only spec/plan, bridge test, bridge implementation. Any other changed file requires explanation or removal.

- [ ] **Step 4: Run browser regression on exact final candidate**

No LIB-03A UI exists, so Browser Qualification is regression-only. Require existing Chromium and UX-QA suites to remain green.

- [ ] **Step 5: Request fresh independent Codex review on exact final candidate**

Review focus: ambiguous identity fail-closed, year normalization, complete current-profile Arena identity, authority/privacy filter, no hidden mutation/network/provider dependency.

- [ ] **Step 6: If review finds an issue, reproduce it with RED before production changes**

No direct patch from prose-only review findings.

- [ ] **Step 7: Freeze candidate**

Final state target: `LIB-03A ENGINEERING QUALIFIED / BROWSER REGRESSION PASS / TERMINAL REVIEW PASS / READY FOR HUMAN INTEGRATION DECISION`.

No merge and no deploy.