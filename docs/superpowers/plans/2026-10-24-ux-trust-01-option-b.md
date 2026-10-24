# UX-TRUST-01 Option B Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the approved Option B remediation across mobile usability and teacher-facing analytical trust without redesigning the application shell or changing persistence/security/grading contracts.

**Architecture:** Keep the current application structure. Add only two shared presentation contracts (`VaultControls` and a reusable mobile touch-target class/primitive) plus pure semantic helpers for competency and UDA decisions; apply targeted responsive changes where the audit found proven friction. Each slice is independently RED→GREEN and ends with exact-SHA qualification.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, Bun tests, Vite, Playwright/Chromium through the existing browser-qualification workflow.

**Spec:** `docs/superpowers/specs/2026-10-24-ux-trust-01-option-b-design.md`

## Global Constraints

- Preserve `main@ad4dfcc2fabacbb05ce7d9a080ad06be73de0fed` product semantics unless this spec explicitly changes teacher-facing UX semantics.
- Preserve `pb-36 md:pb-20`; UXT-A must not solve viewport occupation by adding more generic bottom padding.
- No change to Vault encryption, persistence, auto-lock timing values (`0|15|30|60`), Student Portal isolation, grading mathematics or fail-closed analytics.
- Preserve the UDA evaluation-batch contribution in `calcUdaCompetenceCredits`.
- Synthetic-only browser qualification; no canonical student data.
- No new infrastructure, telemetry, remote account requirement or paid dependency.
- No merge, deployment, publication or production-data mutation is authorized by this plan.

## Review Focus

1. Mobile Vault controls remain directly reachable and auto-lock state remains discoverable while the compact cluster no longer occupies ~300 px of viewport width — pinned in Task 1 browser assertions.
2. Backup links do not accidentally invoke legacy/plain export handlers while copy changes to `Backup cifrato` — pinned in Task 2 source/browser assertions.
3. Strong competency profiles never receive an absolute `Area da consolidare` merely because one dimension is relatively lowest — pinned in Task 3 unit cases.
4. UDA severity varies with real calendar position and evidence state; absence of a test alone is never critical — pinned in Task 4 table-driven unit cases.
5. Mobile progressive disclosure does not hide data or alter desktop dense views — pinned in Task 5/6 mobile+desktop browser cases.

---

### Task 1: UXT-A — Mobile Vault + touch contract

**Files:**
- Create: `src/components/VaultControls.tsx`
- Create: `src/components/mobileTouch.ts`
- Modify: `src/components/SecureRegistroRoot.tsx`
- Modify: selected high-impact controls in `src/components/EvaluationsView.tsx`, `src/components/BehaviorsView.tsx`, `src/components/HistoryView.tsx`, `src/components/UdaGanttView.tsx`
- Create/modify test: `src/security/uxTrust01Integrity.test.ts`
- Create/modify browser test: `tests/browser/ux-trust-01-qualification.spec.cjs`

**Interfaces:**
- Consumes: `AutoLockMinutes = 0 | 15 | 30 | 60`, `handleAutoLockChange`, `handleLock`, existing `pb-36 md:pb-20` shell clearance.
- Produces: `VaultControls({ autoLockMinutes, onAutoLockChange, onLock })` and `MOBILE_TOUCH_TARGET_CLASS` used by later presentation work.

- [ ] **Step 1: Write failing source contract**
  - Assert `SecureRegistroRoot.tsx` delegates READY controls to `VaultControls`.
  - Assert the old monolithic `fixed bottom-16 md:bottom-3 ...` toolbar is absent from `SecureRegistroRoot.tsx`.
  - Assert `App.tsx` still contains `pb-36 md:pb-20`.
  - Assert `VaultControls.tsx` contains separate mobile `md:hidden` and desktop `hidden md:flex` presentations and exposes direct `Blocca` action.

- [ ] **Step 2: Run RED**
  - Run: `bun test src/security/uxTrust01Integrity.test.ts`
  - Expected: FAIL because `VaultControls.tsx`/compact contract do not exist yet, while existing security tests stay otherwise untouched.

- [ ] **Step 3: Implement minimal shared controls**
  - `VaultControls` receives current value and callbacks only; it owns no security state.
  - Mobile: compact touch-safe selector + direct lock button; target total control-cluster width <= 200 CSS px at 390 px viewport.
  - Desktop: preserve existing visible select + `Blocca Registro` semantics.
  - `mobileTouch.ts` exports the shared mobile hit-area class; apply first to the audited high-impact operational controls above without changing their actions.

- [ ] **Step 4: GREEN source tests**
  - Run targeted new test plus `bun run test:security`.
  - Expected: all PASS.

- [ ] **Step 5: Browser proof**
  - At 390×844, unlock synthetic Vault and assert the mobile Vault cluster bounding box width <= 200 px, lock button >=44×44, auto-lock control >=44 px high, and primary route content remains visible above bottom navigation.
  - At 1280×900, assert the desktop controls remain visible and functional.

- [ ] **Step 6: Commit UXT-A**
  - Commit only Task 1 files.

### Task 2: UXT-B — Backup vocabulary + sufficiency denominator

**Files:**
- Modify: `src/components/HomeView.tsx`
- Modify: `src/components/Navbar.tsx`
- Modify: `src/components/SettingsView.tsx`
- Modify: `src/components/DashboardView.tsx`
- Modify: `src/security/uxTrust01Integrity.test.ts`
- Modify: `tests/browser/ux-trust-01-qualification.spec.cjs`

**Interfaces:**
- Consumes: existing encrypted backup/restore flow in `PrivacyView.tsx` and existing navigation callback route to `privacy`.
- Produces: one teacher-facing backup vocabulary and explicit sufficiency numerator/valid-average denominator.

- [ ] **Step 1: Write failing vocabulary/KPI tests**
  - Reject teacher-facing `Esporta Backup JSON`, `Ultimo backup JSON`, `Esporta File Backup (.json)`, `Ripristina Registro da File JSON` outside canonical historical docs/tests.
  - Require `Backup cifrato`, `Esporta backup cifrato`, `Ripristina backup cifrato` and Privacy routing.
  - Require Dashboard helper text exposing students with valid average as denominator.

- [ ] **Step 2: Run RED**
  - Run: `bun test src/security/uxTrust01Integrity.test.ts`.
  - Expected: FAIL on current legacy copy/denominator omission.

- [ ] **Step 3: Implement minimal copy/navigation changes**
  - Do not change encryption/export implementation.
  - Home/drawer/Settings backup actions navigate to Privacy rather than implying a separate plaintext JSON workflow.
  - Dashboard computes/displays numerator and count of students with valid average using the same existing average set used for `suffRate`.

- [ ] **Step 4: GREEN + browser check**
  - Full security suite PASS.
  - Browser proves the backup CTA reaches Privacy and the KPI denominator matches synthetic data.

- [ ] **Step 5: Commit UXT-B**

### Task 3: UXT-C — Competency evidence + growth semantics

**Files:**
- Create: `src/analytics/competencySemantics.ts`
- Modify: `src/components/StudentReportView.tsx`
- Create/modify: `src/security/uxTrust01Integrity.test.ts`
- Modify: `tests/browser/ux-trust-01-qualification.spec.cjs`

**Interfaces:**
- Produces pure helpers:
  - `getCompetencyEvidenceCoverage(evaluatedCount: number, totalCount: number)`;
  - `getGrowthRecommendation(scores: Array<{ label: string; score: number }>, absoluteThreshold: number)` returning `absolute | relative | none` semantics.
- Consumes existing evaluated-only radar data; must not impute missing scores.

- [ ] **Step 1: Write RED unit cases**
  - 3 evidenced of 6 => coverage label/data `3/6`.
  - scores `[9.4, 9.1, 9.0]` => no absolute `Area da consolidare`.
  - a score below the explicit absolute threshold => absolute consolidation recommendation.
  - fewer than 3 evidenced dimensions => existing fail-closed unreliable profile behavior remains.

- [ ] **Step 2: Run RED**
  - Expected: current `growthCompetency = sortedStrengths[last]` behavior fails strong-profile case.

- [ ] **Step 3: Implement pure helper + view copy**
  - Keep radar filtering unchanged.
  - Expose evidence coverage in the competencies mode label/helper.
  - Use absolute wording only when helper returns `absolute`; relative wording may be shown for `relative` without remedial imperative.

- [ ] **Step 4: GREEN + browser synthetic strong/weak profiles**

- [ ] **Step 5: Commit UXT-C**

### Task 4: UXT-D — UDA calendar, severity and activity semantics

**Files:**
- Create: `src/analytics/udaSemantics.ts`
- Modify: `src/components/UdaGanttView.tsx`
- Modify: `src/security/uxTrust01Integrity.test.ts`
- Modify: `tests/browser/ux-trust-01-qualification.spec.cjs`

**Interfaces:**
- Produces:
  - `getSchoolMonthIndex(date: Date): number` using the existing school-year month order;
  - `getUdaGapSeverity({ currentMonthIndex, startMonthIndex, endMonthIndex, gapCount, formalEvidenceCount })` returning `planning | watch | due | critical | clear`;
  - remediation copy helper that prioritizes plan/link evidence.
- Consumes `calcUdaCompetenceCredits`; does not alter its weighted-hours + distinct-evaluation-batch contribution.

- [ ] **Step 1: Write table-driven RED cases**
  - upcoming/no formal evidence => `planning`;
  - active/no formal evidence => `watch` or planning-equivalent, not `critical`;
  - ending-now with unresolved gap => `due`;
  - ended with unresolved gap => `critical`;
  - gapCount 0 with adequate evidence => `clear`;
  - dates after October prove the result no longer depends on `currentSchoolMonthIndex = 1`.
  - source guard preserves evaluation-batch contribution in `calcUdaCompetenceCredits`.

- [ ] **Step 2: Run RED**
  - Expected: fail on frozen October and `formalTestSessions.length === 0` critical promotion.

- [ ] **Step 3: Implement helper and wire view**
  - Replace frozen month and inline critical decision with helpers.
  - Replace grade-target language with planning/link-evidence language.
  - Clarify/de-emphasize the two activity scales while preserving the composite formula.

- [ ] **Step 4: GREEN + browser calendar/severity scenarios**

- [ ] **Step 5: Commit UXT-D**

### Task 5: UXT-E — Targeted mobile presentation

**Files:**
- Modify as proven by browser fixtures: `src/components/AnalyticsView.tsx`, `src/components/StudentReportView.tsx`, `src/components/ClassComparisonBarChart.tsx`, `src/components/UdaGanttView.tsx`
- Modify: `src/security/uxTrust01Integrity.test.ts`
- Modify: `tests/browser/ux-trust-01-qualification.spec.cjs`

**Interfaces:**
- Consumes existing data and calculation outputs only.
- Produces responsive disclosure/card layouts without changing desktop data tables or ordering semantics.

- [ ] **Step 1: Write RED browser/source contracts**
  - Mobile Analytics shows class summary first and student detail behind explicit disclosure/search/sort affordance.
  - Mobile dense dossier/comparison sections are readable without document-level horizontal overflow.
  - Desktop retains dense matrix/table presentation where currently available.

- [ ] **Step 2: Run RED**

- [ ] **Step 3: Implement the minimum responsive variants**
  - Do not convert unaffected screens.
  - Preserve all values and fail-closed unavailable states.

- [ ] **Step 4: GREEN mobile + desktop browser cases**

- [ ] **Step 5: Commit UXT-E**

### Task 6: UXT-F — Full regression qualification and release receipt

**Files:**
- Modify/create: `tests/browser/ux-trust-01-qualification.spec.cjs`
- Modify only if needed to register test: `.github/workflows/browser-qualification.yml`
- Create: `docs/superpowers/receipts/2026-10-24-ux-trust-01-qualification.md`

**Interfaces:**
- Consumes all UXT-A…E exact behavior.
- Produces final exact-SHA qualification evidence; no product change is allowed in this task unless a causal failure reopens the owning slice.

- [ ] **Step 1: Full browser inventory**
  - 390×844 and 1280×900.
  - Home, Riepilogo, Valutazioni, Comportamento, Tabellone, Analisi, Storico, Scheda alunno, Gestione alunni, Verifiche online, UDA, Impostazioni, Privacy, Privacy Shield, Student Portal.
  - Assert no page error, unexpected console error or document-level horizontal overflow.

- [ ] **Step 2: Contract-specific proofs**
  - compact Vault + touch targets;
  - encrypted-backup vocabulary/routing;
  - sufficiency denominator;
  - competency coverage/growth semantics;
  - calendar-correct UDA severity and planning-first remediation;
  - preserved Student Portal viewport isolation.

- [ ] **Step 3: Exact-head engineering gates**
  - `bun install --frozen-lockfile`;
  - `bun run lint`;
  - `bun run test:security`;
  - `bun run build`;
  - production startup smoke;
  - browser qualification.

- [ ] **Step 4: Independent final review on the same SHA**
  - 0 unresolved Important/Critical findings required.

- [ ] **Step 5: Write qualification receipt**
  - Record exact SHA, canonical run IDs, browser artifact ID/digest, test counts and review state.

- [ ] **Step 6: Stop at human integration decision**
  - Do not mark ready/merge/deploy without explicit authorization.

## Self-review result

- Spec coverage: all audited Option B domains map to UXT-A…F; no persistence/security architecture task is introduced.
- Shared interfaces: `VaultControls`/mobile touch contract are owned by UXT-A; competency and UDA semantics are isolated in pure helpers owned by UXT-C/D.
- TDD: every product slice starts with a failing test and requires observed RED before implementation.
- Regression control: UXT-F repeats full mobile/desktop inventory and exact-SHA review.
- Proportion: the plan fixes the decisions and proofs but leaves implementation details to the existing component patterns.
