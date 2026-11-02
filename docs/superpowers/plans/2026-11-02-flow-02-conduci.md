# FLOW-02 Conduci Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the generic TODAY `Conduci` continuation with a compact, mobile-first lesson surface that preserves explicit class context, exposes existing lesson resources and controls, keeps rapid notes transient, and hands off explicitly to FLOW-03 `Registra` without hidden writes.

**Architecture:** Add a small pure `conductSession` resolver plus a focused `ConductLessonPanel`. `DashboardView` renders it only for `todayAction === 'conduct'`; `App` supplies existing UDA state, Privacy Shield control, explicit Copilota launch and the session-only transition to `record`. Specialist workspaces remain authoritative and no new durable lesson-session model is created.

**Tech Stack:** React, TypeScript, existing `UdaRecord`/`UdaLesson`, TODAY-01 session routing, CTX-01 professional context, existing Privacy Shield/Copilota hooks, Bun tests, Playwright Chromium qualification.

**Spec:** `docs/superpowers/specs/2026-11-02-flow-02-conduci-design.md`

## Global Constraints

- Baseline is `main@981ed5a24036b1c9c39141ad14a23e26f57cc331`.
- No new durable lesson-session record or persistence key.
- No automatic professional writes from `Conduci`.
- No arbitrary UDA/lesson selection under ambiguity.
- No student-personal data or rapid-note contents to Copilota/professional memory.
- Existing UDA, Biblioteca, Verifiche, Privacy Shield and Copilota surfaces remain authoritative.
- `Registra` durable semantics are deferred to FLOW-03.
- Mobile 390×844 is a primary qualification surface.
- Every product change uses RED → GREEN and exact-SHA qualification.

## Review Focus

- Multiple UDA/lesson candidates for one class must fail closed to class-only/ambiguous mode rather than selecting one silently; covered in Task 1.
- A rapid note must never flow into secure persistence, UDA, memory or Copilota by incidental prop/callback wiring; covered in Tasks 2–3.
- Privacy Shield must delegate the existing application state/action and remain reachable on mobile; covered in Tasks 2 and 5.
- `Vai a Registra` must change only session intent while retaining the explicit class and performing no durable mutation; covered in Tasks 3–4.
- Mobile sticky header, keyboard-safe textarea and critical touch controls must not overlap or overflow; covered in Task 5.

---

### Task 1: Deterministic conduct-context resolver

**Files:**
- Create: `src/conduct/conductSession.ts`
- Create: `src/security/flow02ConductSessionContract.test.ts`

**Interfaces:**
- Consumes: `UdaRecord`, `UdaLesson` from `src/types.ts`.
- Produces: `ConductContextInput`, `ConductContextResolution`, `resolveConductContext(input)`.

- [ ] **Step 1: Write failing resolver tests**
  - unique lesson dated `todayIsoDate` across matching class UDAs → `resolved` with UDA + lesson;
  - one matching class UDA but no unique dated lesson → `resolved` at UDA level without invented lesson;
  - no matching class UDA → `class-only`;
  - multiple equally plausible class UDAs → `ambiguous`;
  - two dated lessons for same class/date → `ambiguous`;
  - class matching is exact after trimming only; no fuzzy matching.

- [ ] **Step 2: Run the focused contract and verify RED**

Run: `bun test src/security/flow02ConductSessionContract.test.ts`

Expected: FAIL because `src/conduct/conductSession.ts` does not yet exist.

- [ ] **Step 3: Implement the minimal pure resolver**

Signature:

```ts
export function resolveConductContext(input: ConductContextInput): ConductContextResolution
```

No I/O, storage, AI or current-time reads inside the resolver; `todayIsoDate` is injected.

- [ ] **Step 4: Re-run focused test and verify GREEN**

Run: `bun test src/security/flow02ConductSessionContract.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `feat: add FLOW-02 conduct context resolver`

---

### Task 2: Dedicated mobile-first ConductLessonPanel

**Files:**
- Create: `src/components/ConductLessonPanel.tsx`
- Create: `src/security/flow02ConductUiContract.test.ts`

**Interfaces:**
- Consumes: `ConductContextResolution` from Task 1.
- Produces component props:

```ts
interface ConductLessonPanelProps {
  context: ConductContextResolution;
  privacyShieldActive: boolean;
  onTogglePrivacyShield: () => void;
  onNavigateUda: () => void;
  onNavigateLibrary: () => void;
  onNavigateAssessment: () => void;
  onOpenCopilot: () => void;
  onGoToRecord: () => void;
  onDismiss: () => void;
}
```

- [ ] **Step 1: Write failing UI contract**
  - contains visible `Oggi · Conduci` and current class cue;
  - resolved UDA/activity is rendered only from resolver output;
  - `Materiali`, `Verifica / attività`, `Apri UDA`, `Chiedi supporto`, `Vai a Registra` actions exist;
  - rapid note textarea exists with exact helper `Temporanea — non ancora registrata`;
  - component contains local React state for note and no persistence imports/callback;
  - Privacy Shield displays `Attivo`/`Disattivo` and delegates toggle;
  - critical buttons use at least 44px minimum height.

- [ ] **Step 2: Run focused contract and verify RED**

Run: `bun test src/security/flow02ConductUiContract.test.ts`

Expected: FAIL because the component does not yet exist.

- [ ] **Step 3: Implement `ConductLessonPanel`**

Use local `useState('')` only for the rapid note. Keep the layout sparse, vertically stacked on mobile, with no fixed bottom element that can cover the textarea.

- [ ] **Step 4: Re-run focused test and verify GREEN**

Run: `bun test src/security/flow02ConductUiContract.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `feat: add compact FLOW-02 conduct panel`

---

### Task 3: App integration, Privacy Shield, Copilota and record handoff

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/library/copilotLaunchContext.ts` only if a narrow `conduct` launch intent is required by current Copilota typing.
- Create: `src/security/flow02AppIntegrationContract.test.ts`

**Interfaces:**
- Consumes: current `udas`, `currentClass`, existing Privacy Shield state/handler, `openLibraryCopilot`, TODAY action state.
- Produces:
  - deterministic `resolveConductContext({ className, udas, todayIsoDate })` input;
  - explicit Copilota launch using only class + optional UDA/lesson + conduct-support intent/goal;
  - `handleContinueFromConductToRecord()` that changes TODAY session intent to `record` without durable mutation.

- [ ] **Step 1: Write failing App integration contract**
  - App passes existing UDA state into Dashboard/FLOW-02;
  - existing Privacy Shield boolean and toggle callback are delegated, not duplicated;
  - Copilota launch does not contain students, grades, behaviours or rapid-note text;
  - `Vai a Registra` only changes session-only action state and retains current class;
  - no `secureStorage.save*`, UDA mutation, professional-memory mutation or evaluation mutation is called by FLOW-02 handlers.

- [ ] **Step 2: Run focused contract and verify RED**

Run: `bun test src/security/flow02AppIntegrationContract.test.ts`

- [ ] **Step 3: Implement minimal App wiring**

If extending `LibraryLaunchIntent`, add only `'conduct'`; do not change execution authority or mission behavior.

- [ ] **Step 4: Re-run focused test plus existing CTX/Copilota privacy contracts**

Run:

```bash
bun test src/security/flow02AppIntegrationContract.test.ts src/security/ctx01AppIntegrationContract.test.ts src/security/aic01ContextPrivacyContract.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `feat: wire FLOW-02 conduct context and handoffs`

---

### Task 4: Replace generic TODAY conduct continuation

**Files:**
- Modify: `src/components/DashboardView.tsx`
- Modify: `src/today/todayRouter.ts`
- Modify: `src/security/today01ContinuationContract.test.ts`
- Modify: `src/security/today01RouterContract.test.ts` only where the generic continuation type changes.
- Create: `src/security/flow02DashboardIntegrationContract.test.ts`

**Interfaces:**
- Consumes: `ConductLessonPanel` and App callbacks from Tasks 2–3.
- Produces: dedicated rendering for `todayAction === 'conduct'`; generic continuation remains only for `record` and `review`.

- [ ] **Step 1: Write failing integration contracts**
  - `TodayContinuationAction` excludes both `prepare` and `conduct`;
  - generic continuation map contains only `record` and `review`;
  - Dashboard renders `PreparationRouterPanel` for `prepare`, `ConductLessonPanel` for `conduct`, generic strip for `record/review`;
  - direct expert Dashboard content remains below the orchestration panel and unchanged.

- [ ] **Step 2: Run contracts and verify RED**

Run:

```bash
bun test src/security/flow02DashboardIntegrationContract.test.ts src/security/today01ContinuationContract.test.ts src/security/today01RouterContract.test.ts
```

- [ ] **Step 3: Implement minimal TODAY/Dashboard changes**

Do not remove direct access to existing Dashboard metrics/actions.

- [ ] **Step 4: Re-run contracts and verify GREEN**

Same command; expected PASS.

- [ ] **Step 5: Commit**

Commit message: `feat: delegate TODAY conduct to FLOW-02`

---

### Task 5: Browser qualification and mobile evidence

**Files:**
- Create: `tests/browser/flow-02-conduci.spec.cjs`
- Modify: `.github/workflows/browser-qualification.yml`
- Create: `src/security/flow02BrowserQualificationContract.test.ts`

**Interfaces:**
- Consumes: production UI from Tasks 1–4.
- Produces: deterministic desktop/mobile Chromium evidence for FLOW-02.

- [ ] **Step 1: Write failing browser-qualification contract**
  - workflow invokes dedicated FLOW-02 spec;
  - artifact captures desktop conduct panel, mobile conduct panel, mobile rapid-note state, mobile Privacy Shield state and handoff to `Registra`;
  - viewport-only mobile screenshot is required in addition to any full-page evidence.

- [ ] **Step 2: Run focused contract and verify RED**

Run: `bun test src/security/flow02BrowserQualificationContract.test.ts`

- [ ] **Step 3: Add Playwright FLOW-02 journey**

Journey:
1. enter Oggi;
2. choose `Conduci`;
3. explicitly select fixture class if required;
4. assert class/activity cue;
5. type a rapid note and assert temporary-copy visibility;
6. toggle Privacy Shield and verify state change through existing control;
7. open/close Copilota and assert class context without rapid-note leakage;
8. click `Vai a Registra` and assert same class + `Registra` continuation;
9. verify mobile 390×844 no horizontal overflow and no sticky-header overlap.

Geometry assertions:
- sticky header bottom <= conduct panel first critical-content top;
- `Vai a Registra` and Privacy Shield control each have height >= 44;
- textarea bounding box is not covered by a fixed/sticky bottom control.

- [ ] **Step 4: Run dedicated Chromium locally/CI as available and repair only causal failures**

Expected: desktop and 390×844 PASS with evidence files emitted.

- [ ] **Step 5: Commit**

Commit message: `test: qualify FLOW-02 conduct journey`

---

### Task 6: Qualification invariant and final exact-SHA gates

**Files:**
- Modify: `qualification/invariants.v1.json`
- Create: `src/security/flow02QualificationContract.test.ts`
- Update docs/PR body only with observed final run identifiers.

**Interfaces:**
- Produces invariant `FLOW-02-I01` guarding the dedicated conduct surface, context resolver, App/Dashboard integration and browser evidence.

Proposed statement:

`Conduci is a mobile-first session orchestrator: it preserves the explicitly selected class, resolves lesson context deterministically, keeps rapid observations transient, exposes existing Privacy Shield and specialist tools, hands off explicitly to Registra, and performs no durable professional write.`

- [ ] **Step 1: Write qualification contract before registering the invariant**

Assert invariant id, owner, statement, guarded impact paths, focused contract tests and browser smoke path.

- [ ] **Step 2: Run Qualification Invariants and capture the causal RED**

Expected: FLOW-02 guarded paths are uncovered before registration.

- [ ] **Step 3: Register `FLOW-02-I01` with exact impact paths/tests**

Include at minimum:
- `qualification/invariants.v1.json`
- `src/App.tsx`
- `src/conduct/`
- `src/components/ConductLessonPanel.tsx`
- `src/components/DashboardView.tsx`
- `src/today/todayRouter.ts`
- FLOW-02 security contracts
- `tests/browser/flow-02-conduci.spec.cjs`
- `.github/workflows/browser-qualification.yml`

- [ ] **Step 4: Run focused tests, typecheck and build**

Run repository-standard Bun tests for changed contracts, then typecheck/build commands used by PREDEPLOY.

Expected: PASS.

- [ ] **Step 5: Push exact candidate and run fresh exact-SHA gates**

Required:
- Qualification Invariants — PASS;
- PREDEPLOY Security Qualification — PASS;
- Browser Qualification — PASS including dedicated FLOW-02 desktop/mobile and historical regression.

- [ ] **Step 6: Final Independent Review**

Require 0 Critical / 0 Important or rework before Human Product/UX Review.

- [ ] **Step 7: Human Product/UX Review**

Review automatic evidence together. Decision must be PASS or causal REWORK before integration.

- [ ] **Step 8: Do not merge without separate explicit authorization**

Keep PR open/Ready only after all gates and Human Product/UX PASS.
