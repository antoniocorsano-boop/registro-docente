# AIC-01 Unified Context Projection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish one privacy-safe, cross-surface Copilot context projection that the existing Agent-First router can consume without sending individual student data or adding any new AI capability.

**Architecture:** Add an app-level `src/copilot/contextProjection.ts` boundary that separates rich local professional context from the minimized remote routing projection. Keep the current `registro.agent-routing-request/v1` wire contract, Contextual Copilot Core authority and provider runtime unchanged; migrate the Composer away from ad-hoc request-context construction and wire additional teacher surfaces through the same projection.

**Tech Stack:** React 19, TypeScript, Bun, existing `LibraryCopilotComposer`, existing `AgentRoutingRequestV1`, existing Contextual Copilot Core, GitHub Actions exact-SHA gates, Playwright 1.64.1.

**Spec:** `docs/superpowers/specs/2026-10-26-ai-teacher-copilot-v1-design.md`  
**Approval:** `docs/superpowers/specs/2026-10-26-ai-teacher-copilot-v1-approval.md`  
**Program:** `docs/superpowers/plans/2026-10-26-ai-teacher-copilot-v1-program.md`

## Global Constraints

- AIC-00 live routing must first be classified: no unexplained canonical live fallback.
- No new intent, capability, provider, model, retry, secret or persistence schema.
- No source/document payload in the agent-routing request.
- No individual student data in local Copilot context or remote routing projection.
- Existing student-personal free-text guard remains fail-closed.
- LINK remains Core-authorized + human-confirmed.
- PREPARE retains existing provider disclosure + one-shot consent.
- Causal RED → GREEN for changed behavior/contracts.
- Exact-SHA qualification; synthetic-only gate data; no auto-merge/deploy.

## Review Focus

1. **Student-bearing tabs (`voti`, `tabellone`, `report`, etc.)** — intercepted `/api/copilot/intent` body contains no student name/id, grade, behavior, report data or per-student aggregate.
2. **Navigation during pending remote interpretation** — stale output cannot reopen actions/disclosure for a previous class/UDA/source/surface.
3. **Surface mapping** — local context keeps meaningful teacher surface; remote context never invents a wire-surface unsupported by `AgentRoutingSurface`.
4. **Missing target** — absent class/UDA/source stays absent; no implicit alias to current.
5. **REVIEW/LINK/PREPARE regression** — current qualified journeys remain behaviorally unchanged.

---

## File Structure

**Create**
- `src/copilot/contextProjection.ts` — local schema + minimized remote projection.
- `src/security/aic01ContextProjection.test.ts` — unit/contract tests; deliberately under `src/security` so PREDEPLOY always runs them.
- `src/security/aic01ContextPrivacyContract.test.ts` — negative privacy/wiring contract.
- `tests/browser/aic-01-context-projection.spec.cjs` — permanent Chromium cross-surface proof.

**Modify**
- `src/library/copilotLaunchContext.ts`
- `src/library/copilotLaunchContext.test.ts`
- `src/library/agentIntent.ts`
- `src/library/agentIntent.test.ts`
- `src/components/LibraryCopilotComposer.tsx`
- `src/App.tsx`
- `.github/workflows/browser-qualification.yml`

**Must not change**
- Gemini provider/runtime behavior;
- `src/library/agentIntentRouting.ts` authority semantics;
- `src/library/contextualCoreAdapter.ts` capability authorization;
- `vendor/contextual-copilot-core/**`;
- persistence/storage implementation.

---

### Task 1: App-level local context projection

**Files:**
- Create: `src/copilot/contextProjection.ts`
- Create/Test: `src/security/aic01ContextProjection.test.ts`

**Interfaces:**

```ts
export type CopilotLocalSurface =
  | 'global'
  | 'home'
  | 'class-dashboard'
  | 'library'
  | 'uda'
  | 'lesson'
  | 'planning'
  | 'online-tests'
  | 'evaluations'
  | 'other-teacher-surface';

export interface CopilotContextProjectionV1 {
  schema: 'registro.copilot-context/v1';
  surface: CopilotLocalSurface;
  className?: string;
  udaId?: string;
  lessonId?: string;
  sourceId?: string;
  planningProfileId?: string;
  assessmentId?: string;
}

export interface BuildCopilotContextProjectionInput {
  surface: CopilotLocalSurface;
  className?: string | null;
  udaId?: string | null;
  lessonId?: string | null;
  sourceId?: string | null;
  planningProfileId?: string | null;
  assessmentId?: string | null;
}

export interface CopilotRemoteRoutingProjectionV1 {
  surface:
    | 'home'
    | 'class-dashboard'
    | 'library'
    | 'uda'
    | 'lesson'
    | 'planning'
    | 'other-teacher-surface';
  hasCurrentClass: boolean;
  hasCurrentUda: boolean;
  hasSelectedSource: boolean;
}

export function buildCopilotContextProjection(
  input: BuildCopilotContextProjectionInput
): CopilotContextProjectionV1;

export function toRemoteRoutingProjection(
  context: CopilotContextProjectionV1
): CopilotRemoteRoutingProjectionV1;
```

Remote mapping: `planning -> planning`; `home/class-dashboard/library/uda/lesson` remain exact; `global`, `online-tests`, `evaluations`, and `other-teacher-surface` collapse to `other-teacher-surface` until a later intentional wire-version change.

- [ ] **Step 1: Write RED tests**

Assert an `evaluations` local projection retains only professional references and maps remotely to:

```ts
{
  surface: 'other-teacher-surface',
  hasCurrentClass: true,
  hasCurrentUda: true,
  hasSelectedSource: false
}
```

Also assert `planning -> planning`, `library -> library`, and absent UDA/source produce `false`.

- [ ] **Step 2: Run RED**

```bash
bun test src/security/aic01ContextProjection.test.ts
```

Expected: FAIL because module/functions do not exist.

- [ ] **Step 3: Implement minimal module**

The input contract must not accept students, grades, behaviors, submissions, reports or arbitrary payload blobs.

- [ ] **Step 4: Run GREEN**

```bash
bun test src/security/aic01ContextProjection.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/copilot/contextProjection.ts src/security/aic01ContextProjection.test.ts
git commit -m "feat: add privacy-safe copilot context projection"
```

---

### Task 2: Align session-only launch context

**Files:**
- Modify: `src/library/copilotLaunchContext.ts`
- Modify/Test: `src/library/copilotLaunchContext.test.ts`

**Interfaces:**
- Consume `CopilotLocalSurface`.
- Preserve `resolveLaunchTeachingContext(launch, udas): ResolvedLibraryTeachingContext | null` exactly.

- [ ] **Step 1: Write RED tests**

Require these valid session-only contexts:

```ts
{ surface: 'planning', className: '3C' }
{ surface: 'online-tests', className: '3C' }
{ surface: 'evaluations', className: '3C' }
```

Preserve the negative rule: mismatched launch `className` vs resolved UDA returns `null`.

- [ ] **Step 2: Run RED**

```bash
bun test src/library/copilotLaunchContext.test.ts
```

- [ ] **Step 3: Replace duplicated surface union**

```ts
import type { CopilotLocalSurface } from '../copilot/contextProjection';
export type CopilotLaunchSurface = CopilotLocalSurface;
```

No other launch-authority behavior changes.

- [ ] **Step 4: Run GREEN**

```bash
bun test src/library/copilotLaunchContext.test.ts src/security/aic01ContextProjection.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/library/copilotLaunchContext.ts src/library/copilotLaunchContext.test.ts
git commit -m "feat: align copilot launch surfaces with unified context"
```

---

### Task 3: Agent routing request from minimized projection

**Files:**
- Modify: `src/library/agentIntent.ts`
- Modify/Test: `src/library/agentIntent.test.ts`
- Create/Test: `src/security/aic01ContextPrivacyContract.test.ts`

**Produces:**

```ts
export function buildAgentRoutingRequestFromProjection(
  message: string,
  context: CopilotContextProjectionV1
): AgentRoutingRequestV1;
```

Preserve the existing `buildAgentRoutingRequest()` and exact `registro.agent-routing-request/v1` schema.

- [ ] **Step 1: Write RED tests**

Assert projection-based construction produces exactly these context keys:

```ts
['surface', 'hasCurrentClass', 'hasCurrentUda', 'hasSelectedSource']
```

In a synthetic surrounding fixture containing `Mario Rossi`, `student-001`, `7.5`, `nota disciplinare`, serialize the built routing request and assert none of those values occur.

- [ ] **Step 2: Run RED**

```bash
bun test src/library/agentIntent.test.ts src/security/aic01ContextPrivacyContract.test.ts
```

Expected: FAIL because the new builder does not exist.

- [ ] **Step 3: Implement builder**

Delegate through `toRemoteRoutingProjection()` and the existing request builder/parser. Do not version or widen the server wire contract.

- [ ] **Step 4: Run GREEN + privacy regressions**

```bash
bun test \
  src/library/agentIntent.test.ts \
  src/security/aic01ContextProjection.test.ts \
  src/security/aic01ContextPrivacyContract.test.ts \
  src/security/agentIntentRuntimeContract.test.ts \
  src/security/agentIntentDiagnosticsContract.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/library/agentIntent.ts src/library/agentIntent.test.ts src/security/aic01ContextPrivacyContract.test.ts
git commit -m "feat: route agent intent through minimized context projection"
```

---

### Task 4: Wire Composer and real app tabs

**Files:**
- Modify: `src/components/LibraryCopilotComposer.tsx`
- Modify: `src/App.tsx`
- Modify/Test: `src/security/aic01ContextPrivacyContract.test.ts`

**Interfaces:**
- Every remote intent submission builds one `CopilotContextProjectionV1` first.
- Existing epoch/stale-response protection remains in force.

- [ ] **Step 1: Add RED source/wiring assertions**

Require:
- Composer imports `buildCopilotContextProjection` and `buildAgentRoutingRequestFromProjection`;
- old local `agentRoutingSurface()` helper is removed;
- Composer no longer assembles routing booleans ad hoc;
- `App.tsx` does not pass student arrays/grades/behaviors/submissions into `ambientContext`.

- [ ] **Step 2: Run RED**

```bash
bun test src/security/aic01ContextPrivacyContract.test.ts
```

- [ ] **Step 3: Migrate Composer**

Build the projection from: active launch/ambient surface, effective class name, resolved teaching context and selected source id. Then call `buildAgentRoutingRequestFromProjection()`.

Do not add source text, UDA content, planning document content, memory or student data in this slice.

- [ ] **Step 4: Map actual `ActiveTab` values in `App.tsx`**

Use the existing tab vocabulary exactly:

- `home` → `home`
- `dashboard` → `class-dashboard`
- `biblioteca` → `library`
- `programmazione` → `planning`
- `verifiche-online` → `online-tests`
- `voti` and `tabellone` → `evaluations`
- `uda-gantt` → `uda` when an UDA context is explicitly available, otherwise `other-teacher-surface`
- `comportamenti`, `analytics`, `storico`, `report`, `dati`, `impostazioni`, `privacy` → `other-teacher-surface`

Only session/professional metadata may enter `CopilotLaunchContext`.

- [ ] **Step 5: Run focused GREEN**

```bash
bun test \
  src/security/aic01ContextProjection.test.ts \
  src/library/copilotLaunchContext.test.ts \
  src/library/agentIntent.test.ts \
  src/security/aic01ContextPrivacyContract.test.ts \
  src/security/agentIntentRuntimeContract.test.ts \
  src/security/agentIntentDiagnosticsContract.test.ts \
  src/security/librarySingleCopilotSurfaceContract.test.ts
bun run lint
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/components/LibraryCopilotComposer.tsx src/security/aic01ContextPrivacyContract.test.ts
git commit -m "feat: wire unified context into the contextual copilot"
```

---

### Task 5: Permanent browser qualification

**Files:**
- Create: `tests/browser/aic-01-context-projection.spec.cjs`
- Modify: `.github/workflows/browser-qualification.yml`

- [ ] **Step 1: Add test-only browser RED**

The spec uses synthetic data and intercepts `/api/copilot/intent`.

Required journeys:
1. `programmazione` → remote `planning` and no planning content payload.
2. `verifiche-online` → remote `other-teacher-surface`; no answers/submissions/student data.
3. `voti` or `tabellone` with synthetic students/grades → no synthetic individual value anywhere in intercepted JSON.
4. Library/UDA canonical PREPARE route unchanged.
5. Delayed intent response + navigation/context change → obsolete result does not reopen action/disclosure.
6. At least one critical journey at 390×844 plus desktop coverage.

Add the spec to both copy and Playwright invocation lists in `browser-qualification.yml`.

- [ ] **Step 2: Prove causal RED**

Run Browser Qualification on a test-only head before product wiring. The new AIC-01 assertions must fail for the expected old-context-path cause; unrelated baseline tests remain green.

- [ ] **Step 3: Run exact-candidate Browser Qualification after GREEN**

Expected: full suite PASS including AIC-01; UX-QA-01/02 remain PASS with 0 findings.

- [ ] **Step 4: Run PREDEPLOY on the same exact candidate**

Expected: frozen install, typecheck, **all security tests including both AIC-01 files**, Library tests, build and production startup smoke PASS.

- [ ] **Step 5: Scope audit + independent review**

Review specifically for student-personal leakage, stale async context, explicit-context binding, accidental capability expansion, LINK/PREPARE governance regression and mobile UX.

Any finding requires new causal RED → GREEN and requalification.

- [ ] **Step 6: Commit permanent browser gate**

```bash
git add tests/browser/aic-01-context-projection.spec.cjs .github/workflows/browser-qualification.yml
git commit -m "test: qualify copilot context projection across surfaces"
```

---

## Final AIC-01 Acceptance

One frozen exact candidate SHA must have:

- AIC-00 prerequisite classified;
- focused unit/security GREEN;
- existing AGENT-INTENT runtime/diagnostic/privacy regressions GREEN;
- PREDEPLOY PASS;
- Browser Qualification PASS with permanent AIC-01 test;
- desktop + 390×844 evidence PASS;
- zero student-personal synthetic value in intercepted routing requests;
- no provider/model/retry/Core/vendor/persistence expansion;
- independent review with 0 unresolved significant findings;
- no merge/deploy/publication without separate human decision.

Target state:

`AIC-01 UNIFIED CONTEXT PROJECTION — ENGINEERING QUALIFIED / PRIVACY BOUNDARY PASS / HUMAN INTEGRATION DECISION READY`
