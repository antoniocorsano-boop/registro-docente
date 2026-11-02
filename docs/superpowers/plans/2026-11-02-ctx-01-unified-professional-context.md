# CTX-01 Unified Professional Context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce one canonical, session-only professional context contract and use it to drive the existing ambient Copilot context without changing visible navigation or specialist workspaces.

**Architecture:** Add a pure resolver under `src/context/` that composes existing class, teaching, planning and launch signals and fails closed on contradictions. Add small adapters to the existing Copilot/Biblioteca contracts, then replace the bespoke ambient Copilot context literal in `App.tsx` with the canonical resolver while preserving neutral re-entry and privacy boundaries.

**Tech Stack:** TypeScript, React, Bun tests, existing Qualification Invariants/PREDEPLOY/browser qualification.

**Spec:** `docs/superpowers/specs/2026-11-02-ctx-01-unified-professional-context-design.md`

## Global Constraints

- `ProfessionalContextV1` is session-only and never persisted.
- No visible Home/Oggi or work-flow UI changes in CTX-01.
- No student id/name, grades, behaviours, notes or student content in context.
- Existing `currentClassId: null` neutral-entry invariant remains unchanged.
- Existing Biblioteca teaching-context resolver remains authoritative for UDA/lesson selection.
- No AI/embedding/semantic inference is used to select context.
- Contradictions fail closed; no arbitrary tie-break.
- Existing specialist surfaces and durable domain models remain authoritative.

## Review Focus

- A class selected in App and a launch/teaching context for a different class must fail closed rather than silently switching class.
- Planning `ambiguous` must not be flattened into a resolved context.
- `STUDENT_PERSONAL_PRESENT` must never cause student fields to enter the context projection.
- Reload/unlock must still return to neutral Home with no active class context.
- Adapters must omit blank strings and unsupported payload fields rather than carrying accidental UI text.

---

### Task 1: Canonical professional-context contract and resolver

**Files:**
- Create: `src/context/professionalContext.ts`
- Create: `src/security/ctx01ProfessionalContext.test.ts`

**Interfaces:**
- Consumes: `CopilotLocalSurface`, `ResolvedLibraryTeachingContext`, `LibraryPlanningContextResolution`.
- Produces: `ProfessionalContextV1`, `ResolveProfessionalContextInput`, `ProfessionalContextResolutionV1`, `resolveProfessionalContext()`.

- [ ] **Step 1: Write failing contract tests**

Tests must assert:
- class-only input resolves `classId/className`;
- teaching context resolves `udaId/lessonId/className`;
- resolved planning context adds `planningProfileId` and optional `arenaContextId`;
- blank source/assessment/goal are omitted and non-blank values are trimmed;
- default time is `unspecified` and default privacy scope is `TEACHER_PROFESSIONAL`;
- current-class vs teaching-class mismatch returns `CLASS_MISMATCH`;
- ambiguous planning context returns `PLANNING_CONTEXT_AMBIGUOUS`.

- [ ] **Step 2: Run focused RED**

Run: `bun test src/security/ctx01ProfessionalContext.test.ts`

Expected: FAIL because `src/context/professionalContext.ts` does not exist.

- [ ] **Step 3: Implement minimal model and resolver**

Implement the exact types and resolution rules from the spec. No persistence/store code.

- [ ] **Step 4: Run focused GREEN**

Run the same focused test.

Expected: PASS.

- [ ] **Step 5: Run full Bun suite**

Run: `bun test`

Expected: all tests PASS.

- [ ] **Step 6: Commit**

Commit contract, resolver and tests only.

---

### Task 2: Adapters to existing Copilot and Biblioteca contracts

**Files:**
- Modify: `src/context/professionalContext.ts`
- Modify: `src/security/ctx01ProfessionalContext.test.ts`

**Interfaces:**
- Consumes Task 1 `ProfessionalContextV1`.
- Produces:
  - `toCopilotContextProjection(context: ProfessionalContextV1): CopilotContextProjectionV1`
  - `toLibraryTeachingContext(context: ProfessionalContextV1): LibraryTeachingContext | null`
  - `resolveProfessionalContextFromLaunch(...)`.

- [ ] **Step 1: Add failing adapter tests**

Assert:
- Copilot adapter maps surface/class/UDA/lesson/source/planning/assessment and omits unsupported context data;
- Biblioteca adapter returns null without UDA and returns `{ udaId, lessonId? }` with UDA;
- explicit launch context enriches ambient context when compatible;
- explicit launch class conflicting with ambient/current class returns `CLASS_MISMATCH`;
- resolved teaching context remains the source of lesson ownership.

- [ ] **Step 2: Run focused RED**

Expected: FAIL because adapter functions do not exist.

- [ ] **Step 3: Implement minimal adapters**

Reuse `buildCopilotContextProjection`; do not duplicate its normalization logic.

- [ ] **Step 4: Run focused GREEN and full suite**

Expected: focused test PASS and `bun test` PASS.

- [ ] **Step 5: Commit**

Commit adapters and tests.

---

### Task 3: Wire App ambient Copilot context through CTX-01

**Files:**
- Modify: `src/App.tsx`
- Create: `src/security/ctx01AppIntegrationContract.test.ts`
- Modify: existing AIC/privacy tests only if they assert obsolete implementation strings while preserving the same invariant.

**Interfaces:**
- Consumes Task 1/2 resolver and Copilot adapter.
- Produces: existing `ambientCopilotContext: CopilotLaunchContext` semantics through the canonical context projection.

- [ ] **Step 1: Write failing integration contract**

Assert `App.tsx`:
- imports `resolveProfessionalContext` and `toCopilotContextProjection`;
- derives ambient context from `activeTab` surface + `currentClass`;
- does not create a bespoke `{ surface, className }` ambient literal;
- contains no student/grades/behaviors in professional-context input;
- keeps persisted `currentClassId` reset to `null` on entry.

- [ ] **Step 2: Run focused RED**

Expected: FAIL on missing CTX-01 wiring.

- [ ] **Step 3: Implement minimal App wiring**

Build a resolved context from the existing active surface and current class. If resolution unexpectedly conflicts, fall back to a minimised neutral surface-only context for ambient Copilot metadata; do not mutate navigation or domain state.

- [ ] **Step 4: Update implementation-string tests only where necessary**

Preserve semantic assertions: student data excluded, surface mapping unchanged, neutral entry unchanged.

- [ ] **Step 5: Run focused tests + full suite**

Run CTX-01 tests, affected AIC/privacy tests, then `bun test`.

Expected: all PASS.

- [ ] **Step 6: Commit**

Commit App wiring and tests.

---

### Task 4: Qualification invariant and exact-SHA gate

**Files:**
- Modify: `qualification/invariants.v1.json`
- Create or modify: `src/security/ctx01QualificationContract.test.ts`
- Update: `docs/ux/UX-GOV-01-registro-docente-user-flow-baseline-v1.md` only with CTX-01 status/evidence when the parent baseline is present on this stacked branch.

**Interfaces:**
- Consumes Tasks 1–3.
- Produces: `CTX-01-I01` qualification coverage and durable roadmap evidence.

- [ ] **Step 1: Write failing qualification test**

Assert invariant registry contains `CTX-01-I01` covering:
- `src/context/professionalContext.ts`;
- CTX-01 security tests;
- `src/App.tsx`.

- [ ] **Step 2: Run RED**

Expected: FAIL because invariant is absent.

- [ ] **Step 3: Add invariant and status evidence**

Statement must match the spec: session-only, deterministic, minimised, contradictions fail closed, neutral-entry/student privacy preserved.

- [ ] **Step 4: Run GREEN + full qualification locally where available**

Expected: focused test PASS, `bun test` PASS, typecheck/build PASS.

- [ ] **Step 5: Commit**

Commit invariant/evidence.

---

### Task 5: Draft PR, RED→GREEN CI qualification, whole-branch review

**Files:** none unless review finds an Important/Critical issue.

**Interfaces:**
- Consumes exact candidate from Tasks 1–4.
- Produces: CTX-01 engineering qualification receipt and roadmap tracker update.

- [ ] **Step 1: Open Draft PR stacked on `docs/ux-gov-01-user-flow-baseline`**

PR body must reference UX-GOV-01 PR #103 and tracker #104.

- [ ] **Step 2: Verify CI exact SHA**

Expected: Qualification Invariants, PREDEPLOY and applicable browser gates PASS on the exact head.

- [ ] **Step 3: Fresh whole-branch review**

Review focus: no persistence, conflict fail-closed, privacy minimization, no UI change, no regression to neutral entry.

Expected: 0 Critical / 0 Important.

- [ ] **Step 4: Update tracker #104**

Record CTX-01 as engineering-qualified but not integrated while parent UX-GOV-01 remains unmerged.

- [ ] **Step 5: Keep Draft until Human Product/UX Review and parent integration decision**

No merge/deploy is implied by engineering qualification.