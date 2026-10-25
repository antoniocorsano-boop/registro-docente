# UX-QA-02-P2 Residual Progressive Disclosure Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close `UXPD-009`, `UXPD-005`, and `UXPD-006` without changing data semantics or reopening the qualified UX-QA-02 P1 scope.

**Architecture:** Keep all changes local to the three existing UI surfaces. Use native disclosure controls/state, preserve current mutation handlers and persistence contracts, and strengthen the existing real-browser UX-QA-02 evidence so each residual finding has a causal RED → GREEN cycle.

**Tech Stack:** React 19, TypeScript, Playwright, Bun, Vite.

**Spec:** `docs/superpowers/specs/2026-10-25-ux-qa-02-p2-residual-cleanup-design.md`

## Global Constraints

- Baseline is `main@2151cf2a8cedb760d3e0efa0242b22833e49b774`.
- No persistence, vault, routing, migration, AI-provider or data-model changes.
- No opportunistic refactoring.
- Touch targets on modified management/disclosure controls are at least 44×44 CSS px.
- No new horizontal overflow at 390×844.
- Class deletion retains explicit confirmation.
- No auto-merge and no manual deploy.

## Review Focus

- Opening class management must not accidentally activate the primary class action; Browser test clicks management and verifies the page remains Home.
- Canceling the delete confirmation must leave the class intact; Browser test exercises dismissal before continuing.
- Filenames with extensions/separators must produce a readable primary title while exact provenance remains visible; intake unit test pins the transformation.
- Evaluation weighting controls must remain editable after disclosure and preserve the current save path; Browser test opens the disclosure and verifies the section.
- Mobile modified controls must remain touch-safe and overflow-free; final Browser audit measures the affected nodes.

---

### Task 1: UXPD-009 — disclose destructive class maintenance

**Files:**
- Modify: `tests/browser/ux-qa-02-progressive-disclosure.spec.cjs`
- Modify: `src/components/HomeView.tsx`

**Interfaces:**
- Consumes: existing `onDeleteClass(classId: string): Promise<void>` and `handleDeleteClass`.
- Produces: accessible `Gestisci classe <name>` disclosure and conditional `Elimina classe <name>` action.

- [ ] **Step 1: Write the failing browser assertion**
  Require the class card to expose `Gestisci classe ${CLASS_NAME}`, require `Elimina classe ${CLASS_NAME}` to be absent before disclosure, click management, then require delete to become visible. Dismiss the existing confirmation and assert the class card remains present.

- [ ] **Step 2: Run Browser Qualification and verify causal RED**
  Expected: failure only because the new management disclosure contract is absent; PREDEPLOY remains green.

- [ ] **Step 3: Implement the minimal HomeView disclosure**
  Add local managed-class state. Replace the direct delete icon with a 44×44 secondary management button. Render the existing deletion action inside the card only when that class is managed; preserve the confirmation string and `handleDeleteClass` path.

- [ ] **Step 4: Run Browser Qualification and verify GREEN for UXPD-009**
  Expected: the new assertions pass and UX-QA-02 no longer reports `UXPD-009`.

- [ ] **Step 5: Commit**
  `fix: disclose destructive class maintenance`

### Task 2: UXPD-005 — human-readable library file title

**Files:**
- Modify: `src/library/intake.ts`
- Modify: `src/library/intake.test.ts`
- Modify: `tests/browser/ux-qa-02-progressive-disclosure.spec.cjs`

**Interfaces:**
- Produces: deterministic local helper `deriveFileDisplayTitle(filename: string): string` used by `createFileSource`.
- Preserves: exact `input.file.name` in `source.origin`.

- [ ] **Step 1: Add failing unit and browser assertions**
  Unit case: `TECNOLOGIA_VERDE_2026_2027.json` → `TECNOLOGIA VERDE 2026 2027`, while `origin` remains the exact filename. Browser evidence requires that readable title as the heading and the technical filename as secondary text.

- [ ] **Step 2: Run focused/unit and Browser checks to verify RED**
  Expected: title assertions fail on the current direct-filename behavior.

- [ ] **Step 3: Implement deterministic title derivation**
  Remove only the final extension, replace `_`/`-` runs with spaces, collapse whitespace, trim, and fall back to `Fonte senza nome` when empty. Do not inspect file contents.

- [ ] **Step 4: Run tests and Browser Qualification to verify GREEN for UXPD-005**
  Expected: unit case passes; browser shows readable heading and technical provenance; `UXPD-005` disappears.

- [ ] **Step 5: Commit**
  `fix: use readable library file titles`

### Task 3: UXPD-006 — disclose evaluation weighting in Settings

**Files:**
- Modify: `src/components/SettingsView.tsx`
- Modify: `tests/browser/ux-qa-02-progressive-disclosure.spec.cjs`

**Interfaces:**
- Consumes: current `formData.evaluationWeights`, `useWeightedAverage`, preset handlers and `handleSave`.
- Produces: native disclosure labelled `Ponderazione delle valutazioni`; all current controls remain inside it unchanged semantically.

- [ ] **Step 1: Add failing browser assertion**
  Require weighting copy to be hidden on Settings entry, require `Ponderazione delle valutazioni` disclosure visible, open it, and require weighting controls to appear.

- [ ] **Step 2: Run Browser Qualification and verify causal RED**
  Expected: current always-visible weighting section violates the new assertion.

- [ ] **Step 3: Wrap the current weighting block in native disclosure**
  Use a touch-safe `summary`; keep all current preset buttons, inputs, checkbox state and submit semantics.

- [ ] **Step 4: Run Browser Qualification and verify GREEN for UXPD-006**
  Expected: initial weighting content is hidden, appears on demand, and `UXPD-006` disappears.

- [ ] **Step 5: Commit**
  `fix: disclose advanced evaluation weighting`

### Task 4: Final exact-SHA qualification

**Files:**
- No product files beyond Tasks 1–3.

- [ ] **Step 1: Run PREDEPLOY on the final exact SHA**
  Expected: PASS including typecheck, security tests, build and production startup smoke.

- [ ] **Step 2: Run complete Browser Qualification on the same exact SHA**
  Expected: full Playwright suite PASS.

- [ ] **Step 3: Verify analyzers**
  Expected: UX-QA-01 `PASS` with `findings: []`; UX-QA-02 `PASS` with no `UXPD-005`, `UXPD-006`, or `UXPD-009`.

- [ ] **Step 4: Verify governance**
  Confirm PR remains open/not merged, `main` remains `2151cf2a8cedb760d3e0efa0242b22833e49b774`, and no manual deploy was started.
