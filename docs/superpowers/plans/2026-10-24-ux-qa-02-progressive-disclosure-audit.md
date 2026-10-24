# UX-QA-02 Product-wide Progressive Disclosure Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing deterministic UX-QA system to detect overloaded product surfaces, obtain a causal browser RED on the current product, and correct the blocking progressive-disclosure defects in Programmazione and UDA without weakening existing gates.

**Architecture:** Reuse `scripts/ux-qa/analyzer.mjs` and the existing GitHub-hosted Browser Qualification. Add one UXPD contract and one Playwright explorer that records evidence for Programmazione, UDA, Biblioteca, Impostazioni, Privacy, Valutazioni and class-card destructive actions. P0/P1 remain blocking; P2 remain report-only. Product changes are limited to the two blocking surfaces in this cycle.

**Tech Stack:** React 19, TypeScript, Bun test, Node/Bun ESM, Playwright 1.64.1, existing secure local vault/browser qualification infrastructure.

**Spec:** `docs/superpowers/specs/2026-10-24-ux-qa-02-progressive-disclosure-audit-design.md`

## Global Constraints

- Baseline is `main@46920f957daca12f8d4f5d9bd28b37efd4212a1f`.
- Canonical browser certification uses the existing GitHub-hosted ephemeral runner on the exact candidate SHA.
- Qualification data is synthetic only.
- Every product behavior change requires a causal RED before GREEN.
- Reuse `scripts/ux-qa/analyzer.mjs`; do not introduce a second analyzer engine.
- UX-QA-01 navigation contract and browser gates must remain intact.
- No external AI/provider token or recurring-cost dependency.
- No router framework migration, vault migration, auth/privacy-boundary change, auto-merge or auto-deploy.
- P2 findings are report-only in this cycle and must not be silently fixed without a dedicated task.

## Review Focus

- Programmazione with an existing complete profile must open read-first and preserve every existing value when a single section is edited and saved.
- Programmazione with an incomplete/new profile must still expose all required fields and validation without forcing multiple sections into simultaneous edit mode.
- UDA with zero records, one record, and several records must keep the primary `UDA` view useful without depending on Gantt or gap-analysis data.
- Changing UDA local views must not mutate UDA data, class filters or current navigation context.
- Mobile 390×844 must keep the new section/view selectors >=44px and avoid horizontal overflow while existing pageerror fail-closed behavior remains active.

---

### Task 1: UXPD contract and security surface

**Files:**
- Create: `ux/qa/progressive-disclosure-contract.v1.json`
- Create: `src/security/uxQa02ProgressiveDisclosureContract.test.ts`

**Interfaces:**
- Consumes: existing `analyzeUxEvidence(contract, evidence)` from `scripts/ux-qa/analyzer.mjs`.
- Produces: contract IDs `UXPD-001` through `UXPD-011` with severities fixed by the design spec.

- [ ] **Step 1: Write the failing contract-surface test**

Assert that `ux/qa/progressive-disclosure-contract.v1.json` exists, has schema `registro.ux-qa-progressive-disclosure/v1`, viewports `390x844` and `1280x900`, IDs `UXPD-001..011`, and fixed severities from the spec.

- [ ] **Step 2: Run the test and verify RED**

Run: `bun test src/security/uxQa02ProgressiveDisclosureContract.test.ts`

Expected: FAIL because the UXPD contract does not exist.

- [ ] **Step 3: Add the minimal contract**

Create the JSON contract exactly from the design spec; do not change `analyzer.mjs`.

- [ ] **Step 4: Extend the test with analyzer classification**

Use synthetic evidence containing one P1 FAIL and one P2 FAIL. Assert overall result `FAIL`, only the P1 appears in `blockingFindings`, and both appear in `findings`. A P2-only evidence set must return `PASS` with a non-empty `findings` array.

- [ ] **Step 5: Verify GREEN and the full security suite**

Run: `bun test src/security/uxQa02ProgressiveDisclosureContract.test.ts && bun run test:security`

Expected: PASS with zero failures.

- [ ] **Step 6: Commit Task 1**

Commit message: `test: add UX-QA-02 progressive disclosure contract`

---

### Task 2: Product-wide browser explorer and causal RED

**Files:**
- Create: `tests/browser/ux-qa-02-progressive-disclosure.spec.cjs`
- Modify: `.github/workflows/browser-qualification.yml`

**Interfaces:**
- Consumes: UXPD contract from Task 1 and existing browser helper conventions.
- Produces: `browser-evidence/ux-qa-02-evidence.json`, screenshots for each audited surface, and `ux-qa-02-report.json/.md` through the existing analyzer CLI.

- [ ] **Step 1: Add the explorer without changing product code**

The explorer must use a synthetic vault and navigate all seven audited surfaces. It must record an observation for every `UXPD-*` ID and continue evidence collection when a UX expectation fails.

For Programmazione record whether a read-first summary and the three section selectors exist and whether a full set of editable controls is simultaneously visible on entry.

For UDA record whether `UDA / Avanzamento / Pianificazione / Analisi` selectors exist and whether KPI, Gantt/dependencies and gap-analysis families are simultaneously dominant on the default view.

For Biblioteca, Impostazioni, Privacy, Valutazioni and Home class cards record the P2 observations defined by the contract.

For all audited mobile nodes record horizontal overflow, primary selector dimensions and pageerror state after the last evidence operation.

- [ ] **Step 2: Register the explorer and analyzer in Browser Qualification**

Copy/run `ux-qa-02-progressive-disclosure.spec.cjs` alongside the existing specs. After the UX-QA-01 analyzer, run:

`bun scripts/ux-qa/analyze.mjs browser-evidence/ux-qa-02-evidence.json ux/qa/progressive-disclosure-contract.v1.json browser-evidence/ux-qa-02`

Use a separate output directory or output names so UX-QA-01 artifacts are not overwritten.

- [ ] **Step 3: Push the test-only head and verify causal RED**

Expected PREDEPLOY: PASS because product code is unchanged.

Expected Browser Qualification: all journeys reach evidence capture; UXPD analyzer returns FAIL with blocking findings including `UXPD-001`, `UXPD-002`, `UXPD-003`, `UXPD-004`. P2 findings may also be present but must not be the blocking cause.

- [ ] **Step 4: Record exact RED evidence in the PR body**

Record exact SHA, run IDs, Playwright pass/fail counts, analyzer result and exact invariant IDs. If the journey fails before analysis because of fixture/locator/bootstrap, fix the harness first; that is not a product RED.

- [ ] **Step 5: Commit Task 2**

Commit message: `test: audit progressive disclosure across product`

---

### Task 3: Programmazione read-first progressive disclosure

**Files:**
- Modify: `src/components/planning/PlanningProfileEditor.tsx`
- Modify only if semantic source-contract expectations require it: `src/security/planningProfileUiContract.test.ts`
- Extend: `tests/browser/ux-qa-02-progressive-disclosure.spec.cjs`

**Interfaces:**
- Preserves: `PlanningProfileEditorProps` and `onSave(profile: TeachingProfile)`.
- Produces: local section state `profile | calendar | organization` plus read/edit mode with at most one edited section at a time.

- [ ] **Step 1: Pin the RED to the existing UXPD browser contract**

Use the Task 2 RED for `UXPD-001` and `UXPD-002`; do not create weaker source-only substitutes.

- [ ] **Step 2: Implement read-first section summaries**

Default state with an existing profile shows three section cards/selectors: `Profilo`, `Calendario e normativa`, `Organizzazione`. Each shows a compact summary and `Modifica`. No full-page form is rendered by default.

For a new/incomplete profile, default to `Profilo` edit mode only; the other sections remain available but not simultaneously editable.

- [ ] **Step 3: Preserve validation and save semantics**

Editing a section updates the same `draft` object. `Salva profilo` validates the complete `TeachingProfile`; failures remain explicit and successful save uses the unchanged `onSave` contract.

- [ ] **Step 4: Run focused and security tests**

Run: `bun test src/security/planningProfileUiContract.test.ts src/security/uxQa02ProgressiveDisclosureContract.test.ts && bun run test:security`

Expected: PASS.

- [ ] **Step 5: Commit Task 3**

Commit message: `feat: make planning profile progressively disclosed`

---

### Task 4: UDA workspace local views

**Files:**
- Modify: `src/components/UdaGanttView.tsx`
- Extend: `tests/browser/ux-qa-02-progressive-disclosure.spec.cjs`
- Modify only if an existing vocabulary/security contract requires semantic alignment: the exact failing contract file only.

**Interfaces:**
- Preserves all UDA calculations and mutation callbacks.
- Produces local view state `uda | progress | planning | analysis`, default `uda`.

- [ ] **Step 1: Pin the RED to `UXPD-003` and `UXPD-004`**

Use the Task 2 evidence; no calculation or data mutation changes are permitted to obtain GREEN.

- [ ] **Step 2: Add four >=44px local view selectors**

Expose `UDA`, `Avanzamento`, `Pianificazione`, `Analisi`; default `UDA`.

- [ ] **Step 3: Partition existing content without deleting functionality**

`UDA`: class filter, dependency status, `Nuova UDA`, primary UDA list/context.

`Avanzamento`: activity index, internal points, diary hours, civic education, tasks/lab and other progress metrics.

`Pianificazione`: Gantt and dependency controls.

`Analisi`: gap analysis and advanced diagnostic indicators.

Keep existing calculations, labels with normative caveats, and mutation callbacks unchanged.

- [ ] **Step 4: Verify empty/one/many UDA states and no mutation on view switch**

Extend the browser spec to select each local view and return to `UDA`, asserting the selected class/filter and UDA data remain unchanged.

- [ ] **Step 5: Run focused/security tests**

Run the relevant UDA security tests identified by the diff plus `bun run test:security`.

Expected: PASS.

- [ ] **Step 6: Commit Task 4**

Commit message: `feat: split UDA workspace into focused views`

---

### Task 5: Exact-SHA qualification, P2 ledger and review

**Files:**
- Modify: PR body only for evidence during qualification.
- Modify `docs/memory/LESSONS_LEARNED.md` only if this cycle produces a reusable new lesson beyond existing UX-QA/process rules.

**Interfaces:**
- Consumes: unchanged UX-QA-01 and new UXPD contract.
- Produces: exact candidate with PREDEPLOY + Browser Qualification evidence and explicit residual P2 list.

- [ ] **Step 1: Run Browser Qualification on the exact candidate**

Expected: existing browser suites PASS; UX-QA-01 PASS; UXPD blocking findings = 0. P2 findings are allowed and must remain visible in `findings`.

- [ ] **Step 2: Run PREDEPLOY on the same exact candidate**

Expected: frozen install, typecheck, security suite, production build and startup smoke PASS.

- [ ] **Step 3: Review the full diff**

Confirm no persistence schema, AI provider, privacy/auth boundary, deployment workflow or unrelated domain behavior changed. Confirm no legacy gate was weakened.

- [ ] **Step 4: Record residual P2 backlog**

Record `UXPD-005..009` status individually in the PR body. Do not mark UX-QA-02 complete by hiding or deleting P2 evidence.

- [ ] **Step 5: Independent code review**

Request/re-run independent review on the exact candidate. Any real finding returns to RED→GREEN and requires requalification on the new exact SHA.

- [ ] **Step 6: Human integration decision**

Stop at `READY FOR HUMAN INTEGRATION DECISION`. No merge or deploy without explicit authorization.

---

## Completion

The first UX-QA-02 implementation cycle is complete when Programmazione and UDA have no blocking UXPD findings, existing UX-QA-01 remains green, PREDEPLOY and Browser Qualification are green on the exact same candidate SHA, residual P2 findings are explicitly recorded, and independent review has no unresolved findings.
