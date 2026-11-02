# TODAY-01 Home “Oggi” Router Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing neutral Home into a task-first `Oggi` router for `Prepara`, `Conduci`, `Registra`, `Rivedi`, while preserving explicit class authority and all existing specialist surfaces.

**Architecture:** Keep `activeTab='home'` as the only Home. Add a tiny pure `TodayAction` routing contract, keep the chosen task only in App React session state, use existing class selection as the context gate, and show a navigation-only continuation strip on the existing class Dashboard. No new domain store or specialist business logic is introduced.

**Tech Stack:** React 19, TypeScript, Bun tests, existing Secure Local Vault, Vite, Playwright browser qualification, qualification invariant registry.

**Spec:** `docs/superpowers/specs/2026-11-02-today-01-home-oggi-router-design.md`

## Global Constraints

- Baseline is `main@3c3e55a0a1de9bca3905669e54e9c55d04808035`.
- No new `ActiveTab` value for Oggi.
- Secure entry remains `home` with `currentClassId=null` and `todayAction=null`.
- `TodayAction` is session-only and is never persisted or projected into Copilot/Professional Memory.
- No automatic class selection from timetable, recency, list order or AI.
- Home retains `Classi`, `Sintesi`, `Confronto` and class-management functions.
- Continuation options only navigate to existing specialist surfaces.
- No mutation form or business rule is duplicated in Home/Dashboard orchestration.
- Mobile 390×844 is a primary qualification viewport.
- Human Product/UX Review is required before integration.

## Review Focus

- **Neutral reload:** a reload/unlock after a previously selected Oggi task must not restore that task or class.
- **No inferred class:** multiple classes and a selected task must still require explicit class selection.
- **Stale intent:** cancel/dismiss and continuation navigation must not leave an obsolete task banner on later unrelated work.
- **Expert escape:** Classi/Sintesi/Confronto and direct drawer navigation must remain usable regardless of pending Oggi intent.
- **Mobile fit:** four task actions, class cue and continuation strip must not create horizontal overflow at 390×844.

---

### Task 1: Introduce the pure TODAY-01 routing contract

**Files:**
- Create: `src/today/todayRouter.ts`
- Create: `src/security/today01RouterContract.test.ts`

**Interfaces:**
- Consumes: existing `ActiveTab` from `src/types.ts`.
- Produces: `TodayAction`, `TodayRouteDecision`, `TodayContinuationOption`, `resolveTodayRoute()`, `getTodayContinuationOptions()` exactly as specified in the design.

- [ ] **Step 1: Write RED tests for explicit-class routing**

In `src/security/today01RouterContract.test.ts`, assert:

```ts
expect(resolveTodayRoute('prepare', null)).toEqual({ status: 'needs-class', action: 'prepare' });
expect(resolveTodayRoute('review', 'class-2c')).toEqual({
  status: 'class-entry',
  action: 'review',
  classId: 'class-2c',
  target: 'dashboard'
});
```

Also assert all four actions return `needs-class` when no class id is supplied.

- [ ] **Step 2: Run the focused test and capture RED**

Run:

```bash
bun test src/security/today01RouterContract.test.ts
```

Expected: FAIL because `src/today/todayRouter.ts` does not exist.

- [ ] **Step 3: Implement the minimum pure router**

Create `src/today/todayRouter.ts` with the exact interfaces from the spec. Trim the supplied class id; empty/blank ids behave as missing. Do not inspect a class list or any persisted state.

- [ ] **Step 4: Add continuation-option assertions**

Assert exact ordered destinations:

```ts
prepare -> ['uda-gantt', 'programmazione', 'biblioteca', 'verifiche-online']
conduct -> ['uda-gantt', 'verifiche-online']
record  -> ['voti', 'comportamenti']
review  -> ['tabellone', 'analytics', 'storico', 'report']
```

Assert the returned structures contain only `tab` and `label` navigation metadata.

- [ ] **Step 5: Run focused tests GREEN**

```bash
bun test src/security/today01RouterContract.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/today/todayRouter.ts src/security/today01RouterContract.test.ts
git commit -m "feat: add TODAY-01 routing contract"
```

---

### Task 2: Make Home task-first without removing expert views

**Files:**
- Modify: `src/components/HomeView.tsx`
- Create: `src/security/today01HomeUiContract.test.ts`

**Interfaces:**
- Consumes: `TodayAction`.
- Produces new Home props:

```ts
onStartTodayAction: (action: TodayAction) => void;
pendingTodayAction: TodayAction | null;
onCancelTodayAction: () => void;
```

Existing props remain unchanged.

- [ ] **Step 1: Write RED Home contract tests**

Read `HomeView.tsx` as source and assert it contains visible labels `Oggi`, `Prepara`, `Conduci`, `Registra`, `Rivedi`, keeps `Classi`, `Sintesi`, `Confronto`, and still calls the existing class callbacks rather than embedding domain forms.

Assert all four task buttons are `type="button"` and use the existing minimum-touch convention (`min-h-[44px]` or stronger).

- [ ] **Step 2: Run focused test RED**

```bash
bun test src/security/today01HomeUiContract.test.ts
```

Expected: FAIL because the Oggi task controls are absent.

- [ ] **Step 3: Add the Oggi task section above existing expert Home content**

The section contains four task buttons. When `pendingTodayAction` is non-null, show a textual status cue asking for explicit class selection, force the local Home mode to `classes`, and expose `Annulla`.

Do not remove or duplicate current Classi/Sintesi/Confronto content.

- [ ] **Step 4: Ensure class authority remains unchanged**

Class cards continue calling `onSelectClass(classData.id)`. The Home component must not pick a class itself.

- [ ] **Step 5: Run focused test GREEN**

```bash
bun test src/security/today01HomeUiContract.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/HomeView.tsx src/security/today01HomeUiContract.test.ts
git commit -m "feat: make Home an Oggi task router"
```

---

### Task 3: Wire session-only task intent through App without persistence

**Files:**
- Modify: `src/App.tsx`
- Create: `src/security/today01SessionContextContract.test.ts`

**Interfaces:**
- Consumes: `TodayAction`, `resolveTodayRoute()`.
- Produces App callbacks for Home start/cancel and Dashboard continuation.

- [ ] **Step 1: Write RED integration/source contracts**

Assert `App.tsx` initializes:

```ts
const [todayAction, setTodayAction] = useState<TodayAction | null>(null);
```

Assert the Home props are wired to this state and that no `todayAction` field is added to `AppData`, snapshot normalization, backup payloads, settings, Professional Memory or Copilot state.

Assert a task started without `currentClassId` remains on Home and does not assign any class id.

- [ ] **Step 2: Run focused test RED**

```bash
bun test src/security/today01SessionContextContract.test.ts
```

Expected: FAIL because the state/wiring does not yet exist.

- [ ] **Step 3: Add session-only App state and callbacks**

Import `TodayAction`/`resolveTodayRoute`. Add `todayAction` local state initialized to `null`.

`handleStartTodayAction(action)`:
- resolve against `currentClassIdRef.current`;
- set `todayAction=action`;
- if resolution is `needs-class`, keep `activeTab='home'` and do not change class;
- if resolution is `class-entry`, route through the existing class Dashboard path without changing class identity.

`handleCancelTodayAction()` sets only `todayAction=null`.

`handleNavigateHome()` additionally clears `todayAction` so returning Home is neutral.

Do not write the value to browser storage or secure persistence.

- [ ] **Step 4: Preserve explicit class-selection history behavior**

Do not replace `handleSelectClass()`. When a pending task exists, normal class selection still performs the established `{ classId, tab:'dashboard' }` user navigation and leaves `todayAction` available for the Dashboard continuation strip.

- [ ] **Step 5: Run contracts and inherited context/security checks**

```bash
bun test src/security/today01SessionContextContract.test.ts src/security/ctx01AppIntegrationContract.test.ts src/security/aic01ContextPrivacyContract.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/security/today01SessionContextContract.test.ts
git commit -m "feat: wire session-only Oggi intent"
```

---

### Task 4: Add a thin Dashboard continuation strip

**Files:**
- Modify: `src/components/DashboardView.tsx`
- Modify: `src/App.tsx`
- Create: `src/security/today01ContinuationContract.test.ts`

**Interfaces:**
- Consumes: `TodayAction`, `getTodayContinuationOptions()`.
- Extends `DashboardViewProps` with:

```ts
todayAction?: TodayAction | null;
onContinueToday?: (tab: ActiveTab) => void;
onDismissToday?: () => void;
```

- [ ] **Step 1: Write RED continuation tests**

Assert Dashboard renders the continuation block only when `todayAction` is present, obtains destinations from `getTodayContinuationOptions()`, and exposes dismiss/navigation callbacks.

Assert no evaluation, behaviour, UDA or planning mutation callback is added to the continuation component.

- [ ] **Step 2: Run focused test RED**

```bash
bun test src/security/today01ContinuationContract.test.ts
```

Expected: FAIL because Dashboard has no TODAY-01 props/strip.

- [ ] **Step 3: Implement compact continuation UI**

Render the block above the existing Dashboard overview. Use navigation buttons only. The existing Dashboard metrics and action grid remain authoritative and unchanged.

- [ ] **Step 4: Wire continuation in App**

`onContinueToday(tab)` routes using the existing user-navigation path and then clears `todayAction`. `onDismissToday()` clears only the task intent.

Do not clear `currentClassId` when dismissing.

- [ ] **Step 5: Run focused and Dashboard-related tests GREEN**

```bash
bun test src/security/today01ContinuationContract.test.ts src/security/today01SessionContextContract.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/DashboardView.tsx src/App.tsx src/security/today01ContinuationContract.test.ts
git commit -m "feat: add Oggi continuation routing"
```

---

### Task 5: Align navigation wording and register the invariant

**Files:**
- Modify: `src/components/Navbar.tsx`
- Modify: `qualification/invariants.v1.json`
- Create: `src/security/today01QualificationContract.test.ts`

**Interfaces:**
- Consumes: existing navigation callbacks only.
- Produces invariant `TODAY-01-I01`.

- [ ] **Step 1: Write RED qualification contract**

Assert the invariant registry contains `TODAY-01-I01` with impact paths for:

```text
src/today/
src/components/HomeView.tsx
src/components/DashboardView.tsx
src/components/Navbar.tsx
src/App.tsx
src/security/today01*.test.ts
```

Tests include all TODAY-01 security contracts and browser smoke includes `tests/browser/qualification-invariant-smoke.spec.cjs`.

- [ ] **Step 2: Add invariant entry**

Use this statement exactly:

> Home/Oggi is a session-only task router: it never infers class context, never persists task intent, preserves expert Home views, and routes only to existing authoritative specialist surfaces after explicit teacher choices.

- [ ] **Step 3: Update global Home wording**

In `Navbar.tsx`, rename the general Home entry and back-to-home labels from `Classi` to `Oggi`. Do not rename the internal Home `Classi` expert view or the `home` ActiveTab.

- [ ] **Step 4: Run qualification/source tests**

```bash
bun test src/security/today01QualificationContract.test.ts src/security/qualificationInvariantFramework.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/Navbar.tsx qualification/invariants.v1.json src/security/today01QualificationContract.test.ts
git commit -m "test: qualify TODAY-01 Oggi invariant"
```

---

### Task 6: Whole-line regression and exact-SHA qualification

**Files:**
- Modify only if a causal failure requires repair.
- Evidence: GitHub qualification runs and Human Product/UX Review.

**Interfaces:**
- Consumes the complete TODAY-01 candidate.
- Produces one exact candidate SHA suitable for independent and human review.

- [ ] **Step 1: Run full local regression**

```bash
bun run test:security
bun run test:library
bun run lint
bun run build
```

Expected: all PASS.

- [ ] **Step 2: Verify the diff is limited to TODAY-01**

Compare against `3c3e55a0a1de9bca3905669e54e9c55d04808035`. No persistence schema, specialist business-rule module or unrelated product surface may appear without a causal explanation.

- [ ] **Step 3: Run exact-SHA Qualification Invariants, PREDEPLOY and Browser Qualification**

Require all selected gates PASS on one exact SHA. Browser evidence must include:

- neutral Home after secure entry;
- four Oggi actions;
- task → explicit class selection → Dashboard continuation;
- cancel/dismiss path;
- expert Classi/Sintesi/Confronto access;
- desktop plus mobile 390×844 without horizontal overflow.

- [ ] **Step 4: Final Independent Review**

Review the whole branch against the design, including stale-intent and secure-reload risks. Required result before Human Review: `0 Critical / 0 Important`.

- [ ] **Step 5: Human Product/UX Review**

Review the exact same SHA. Required checks:

- `Oggi` is immediately understandable;
- four actions do not feel like a second dashboard;
- class selection is explicit and obvious;
- expert views remain discoverable;
- continuation strip is useful but subordinate;
- 390×844 touch/scroll behavior is acceptable.

- [ ] **Step 6: Stop before merge**

Keep the PR Draft or Ready according to review state. Do not merge TODAY-01 until all exact-SHA technical gates and Human Product/UX Review are PASS and the integration decision is explicit.