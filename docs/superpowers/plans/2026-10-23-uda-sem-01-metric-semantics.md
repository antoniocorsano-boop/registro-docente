# UDA-SEM-01 Semantic Clarity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clarify UDA progress metrics without changing calculations or data behavior.

**Architecture:** Keep the existing StudentReportView and UdaGanttView structures and data flows. Change only teacher-facing copy, backed by a static semantic contract that also pins the current 60/40 calculation.

**Tech Stack:** React 19, TypeScript, Bun tests, Tailwind CSS.

**Spec:** `docs/superpowers/specs/2026-10-23-uda-sem-01-metric-semantics-design.md`

## Global Constraints
- Baseline: `main@023a6a036c4a43b71fcd408f6ecda1d92bf7a787`.
- No formula, threshold, target, data-model, persistence, Vault, analytics, or export changes.
- The 60/40 value is an internal planning indicator, never a ministerial/prescribed assessment rule.
- Preserve `completionPct = Math.round((hoursRatio * 0.6 + evalRatio * 0.4) * 100)` and `targetEvals = 2`.

## Review Focus
- A teacher must not read weighted internal hours as hours actually taught.
- `% del monte ore` must refer only to raw diary hours divided by planned hours.
- 60/40 copy must say internal/non-prescriptive while formula remains unchanged.
- D.M. 221/2025 must remain curricular context, not formula authority.
- Mobile copy must remain readable without hover-only explanations.

---

### Task 1: Semantic contract RED

**Files:**
- Modify: `src/security/valuationSemanticIntegrity.test.ts`

**Interfaces:**
- Consumes: source text of `StudentReportView.tsx` and `UdaGanttView.tsx`.
- Produces: one static contract covering canonical vocabulary and formula invariants.

- [ ] **Step 1:** Add a failing test named `UDA progress metrics distinguish diary hours weighted activity and internal composite progress` asserting the canonical labels, internal/non-prescriptive 60/40 copy, curricular-context label, and exact unchanged formula/target.
- [ ] **Step 2:** Run `bun test src/security/valuationSemanticIntegrity.test.ts` and verify exactly the new semantic contract fails while existing tests pass.
- [ ] **Step 3:** Commit the RED test-only state.

### Task 2: Minimal semantic GREEN

**Files:**
- Modify: `src/components/StudentReportView.tsx`
- Modify: `src/components/UdaGanttView.tsx`

**Interfaces:**
- Consumes: canonical vocabulary pinned by Task 1.
- Produces: clarified teacher-facing copy only.

- [ ] **Step 1:** Replace ambiguous dossier labels with `Monte ore previsto`, `Ore registrate nel diario`, and `% del monte ore`; retain weighted values as explicitly internal.
- [ ] **Step 2:** Rename raw-hour Gantt progress to `Avanzamento ore nel diario`; rename the 60/40 summary to `Indice di avanzamento didattico (interno)` and add visible compact methodological copy stating 60/40 is an internal planning criterion, not a prescribed assessment rule.
- [ ] **Step 3:** Relabel nearby D.M. 221/2025 text as `Contesto curricolare: D.M. 221/2025`.
- [ ] **Step 4:** Run the focused test, typecheck, build, and full security suite; verify formula and behavior remain unchanged.
- [ ] **Step 5:** Commit the minimal GREEN.

### Task 3: Qualification

**Files:** none unless a verified defect requires a new RED→GREEN cycle.

**Interfaces:**
- Consumes: exact GREEN commit.
- Produces: CI, browser, and independent-review evidence.

- [ ] **Step 1:** Publish a Draft PR and require PREDEPLOY PASS on the exact GREEN SHA.
- [ ] **Step 2:** Browser-check mobile and desktop with synthetic data: Student dossier labels, UDA KPI/raw-hour progress, 60/40 internal indicator copy, no layout overflow, zero console/page errors.
- [ ] **Step 3:** Request independent Codex review on the same exact SHA and stop at human integration decision.
