# AIC-01 Unified Context Projection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish one privacy-safe, cross-surface Copilot context projection that the existing Agent-First router can consume without sending individual student data or adding any new AI capability.

**Architecture:** Add a new app-level `src/copilot/contextProjection.ts` boundary that represents local professional context separately from the minimized remote routing projection. Keep the existing agent request schema and Core authority intact; migrate the Composer from ad-hoc booleans/surface mapping to the new projection, then wire additional teacher surfaces through the same launch/context path.

**Tech Stack:** React 19, TypeScript, Bun test, existing `LibraryCopilotComposer`, existing `AgentRoutingRequestV1`, existing Contextual Copilot Core, GitHub Actions PREDEPLOY + Playwright 1.64.1.

**Spec:** `docs/superpowers/specs/2026-10-26-ai-teacher-copilot-v1-design.md`  
**Approval:** `docs/superpowers/specs/2026-10-26-ai-teacher-copilot-v1-approval.md`  
**Program:** `docs/superpowers/plans/2026-10-26-ai-teacher-copilot-v1-program.md`

## Global Constraints

- Prerequisite: AIC-00 live routing must be classified; do not expand this slice while the canonical live phrase still produces an unexplained fallback.
- No new intent/capability/provider/model/retry/secret.
- No change to `IntentEnvelopeV1` authority semantics.
- No source/document payload in the routing request.
- No individual student data in the local context projection or remote routing projection.
- `STUDENT_PERSONAL` remains remote-denied; this slice must not weaken existing free-text privacy guards.
- Existing LINK human confirmation and PREPARE governed disclosure/one-shot consent remain unchanged.
- No new persistence or storage schema.
- Existing traditional UI/navigation remains available.
- Causal RED → GREEN required for every behavior/contract change.
- Exact-SHA qualification, synthetic-only gate data, no auto-merge/deploy.

## Review Focus

1. **Evaluation/student-bearing surface with synthetic names/grades in the page state** — intercepted `/api/copilot/intent` body must contain no student name, student id, grade, behavior or per-student aggregate.
2. **Navigation while remote intent request is pending** — stale response must not reopen an old context or action after surface/class/UDA/source changes.
3. **Planning / online-test / evaluations surface mapping** — local surface remains exact for UI/context; remote surface is intentionally collapsed where appropriate and must not invent an unsupported server surface.
4. **No current UDA/source** — projection must truthfully emit `hasCurrentUda=false` / `hasSelectedSource=false`, never alias an absent target to current.
5. **Current REVIEW/LINK/PREPARE regression** — existing library/UDA flows must remain behaviorally identical after the request-builder migration.

---

## File Structure

**Create**
- `src/copilot/contextProjection.ts` — local context schema, exact local builder, privacy-safe minimized remote projection.
- `src/copilot/contextProjection.test.ts` — focused unit tests for surface mapping and minimization.
- `src/security/aic01ContextPrivacyContract.test.ts` — security contract proving forbidden individual fields never enter remote projection/request construction.
- `tests/browser/aic-01-context-projection.spec.cjs` — Chromium proof across teacher surfaces with intercepted agent-routing requests.

**Modify**
- `src/library/copilotLaunchContext.ts` — extend local launch surfaces while preserving current Teaching Context fail-closed resolution.
- `src/library/agentIntent.ts` — add projection-based request builder while preserving `AgentRoutingRequestV1` wire schema and the existing builder for compatibility.
- `src/components/LibraryCopilotComposer.tsx` — remove ad-hoc `agentRoutingSurface()` construction and build remote request from the unified local projection.
- `src/App.tsx` — emit the correct ambient/local Copilot surface for planning, online tests and evaluation-related teacher views without attaching student collections.
- `.github/workflows/browser-qualification.yml` — copy and execute the new permanent browser spec.

**Must not change**
- `src/server/geminiAgentIntentProvider.ts`
- `src/server/agentIntentRuntime.ts`
- `src/server/agentIntentRoute.ts` except only if a compile-time import adjustment is strictly required; no route/schema behavior change is expected.
- `src/library/agentIntentRouting.ts`
- `src/library/contextualCoreAdapter.ts`
- `vendor/contextual-copilot-core/**`
- provider/model/runtime budgets/retries.

---

### Task 1: Define the app-level local context projection and minimized remote projection

**Files:**
- Create: `src/copilot/contextProjection.ts`
- Create/Test: `src/copilot/contextProjection.test.ts`

**Interfaces:**
- Consumes: no product-domain object collections; only already-resolved professional references/metadata.
- Produces:
  - `CopilotLocalSurface`
  - `CopilotContextProjectionV1`
  - `BuildCopilotContextProjectionInput`
  - `CopilotRemoteRoutingProjectionV1`
  - `buildCopilotContextProjection(input: BuildCopilotContextProjectionInput): CopilotContextProjectionV1`
  - `toRemoteRoutingProjection(context: CopilotContextProjectionV1): CopilotRemoteRoutingProjectionV1`

**Required types:**

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
```

`online-tests`, `evaluations`, `global` and unknown/future teacher-local surfaces map remotely to `other-teacher-surface` unless the existing server schema is deliberately versioned in a later slice. `planning` remains `planning` because it is already supported by `AgentRoutingSurface`.

- [ ] **Step 1: Write the failing unit tests**

Add focused tests asserting:

```ts
expect(buildCopilotContextProjection({
  surface: 'evaluations',
  className: '3C',
  udaId: 'uda-energy'
})).toEqual({
  schema: 'registro.copilot-context/v1',
  surface: 'evaluations',
  className: '3C',
  udaId: 'uda-energy'
});

expect(toRemoteRoutingProjection(local)).toEqual({
  surface: 'other-teacher-surface',
  hasCurrentClass: true,
  hasCurrentUda: true,
  hasSelectedSource: false
});
```

Also assert `planning -> planning`, `library -> library`, and absence of UDA/source produces `false` rather than inferred truthy defaults.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
bun test src/copilot/contextProjection.test.ts
```

Expected: FAIL because the module/functions do not yet exist.

- [ ] **Step 3: Implement the minimal context projection module**

Implement only the signatures above plus a small internal surface mapping. Do not accept or retain student collections, grades, behaviors, submissions, reports or arbitrary payload blobs in `BuildCopilotContextProjectionInput`.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```bash
bun test src/copilot/contextProjection.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/copilot/contextProjection.ts src/copilot/contextProjection.test.ts
git commit -m "feat: add privacy-safe copilot context projection"
```

---

### Task 2: Extend local launch surfaces without changing Teaching Context authority

**Files:**
- Modify: `src/library/copilotLaunchContext.ts`
- Test: `src/library/copilotLaunchContext.test.ts`

**Interfaces:**
- Consumes: `CopilotLocalSurface` from Task 1.
- Produces: `CopilotLaunchContext.surface` aligned to the app-level local surface vocabulary while preserving the existing `resolveLaunchTeachingContext()` signature and fail-closed class/UDA validation.

- [ ] **Step 1: Write the failing launch-context tests**

Add cases proving:

```ts
const planning: CopilotLaunchContext = { surface: 'planning', className: '3C' };
const onlineTests: CopilotLaunchContext = { surface: 'online-tests', className: '3C' };
const evaluations: CopilotLaunchContext = { surface: 'evaluations', className: '3C' };
```

compile and remain session-only metadata. Preserve existing negative test: a mismatched `className` must make `resolveLaunchTeachingContext()` return `null`.

- [ ] **Step 2: Run the launch-context test and verify RED**

Run:

```bash
bun test src/library/copilotLaunchContext.test.ts
```

Expected: FAIL on unsupported new launch surfaces.

- [ ] **Step 3: Replace the duplicated surface union with `CopilotLocalSurface`**

In `src/library/copilotLaunchContext.ts`:

```ts
import type { CopilotLocalSurface } from '../copilot/contextProjection';
export type CopilotLaunchSurface = CopilotLocalSurface;
```

Keep all existing optional references and `resolveLaunchTeachingContext()` behavior unchanged.

- [ ] **Step 4: Run tests and verify GREEN**

Run:

```bash
bun test src/library/copilotLaunchContext.test.ts src/copilot/contextProjection.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/library/copilotLaunchContext.ts src/library/copilotLaunchContext.test.ts
git commit -m "feat: align copilot launch surfaces with unified context"
```

---

### Task 3: Build Agent routing requests from the privacy-safe projection

**Files:**
- Modify: `src/library/agentIntent.ts`
- Modify/Test: `src/library/agentIntent.test.ts`
- Create/Test: `src/security/aic01ContextPrivacyContract.test.ts`

**Interfaces:**
- Consumes: `CopilotContextProjectionV1`, `toRemoteRoutingProjection()` from Task 1.
- Produces:
  - `buildAgentRoutingRequestFromProjection(message: string, context: CopilotContextProjectionV1): AgentRoutingRequestV1`
- Preserves:
  - `buildAgentRoutingRequest(input: BuildAgentRoutingRequestInput): AgentRoutingRequestV1`
  - the exact `registro.agent-routing-request/v1` wire schema.

- [ ] **Step 1: Write the failing request-builder and privacy tests**

Unit assertion:

```ts
const request = buildAgentRoutingRequestFromProjection('Prepara una attività', localContext);
expect(request.context).toEqual({
  surface: 'other-teacher-surface',
  hasCurrentClass: true,
  hasCurrentUda: false,
  hasSelectedSource: false
});
```

Security assertion must serialize the request and prove it does **not** contain synthetic values representing individual student data, e.g. `Mario Rossi`, `7.5`, `student-001`, `nota disciplinare`. The test fixture may keep those values in a separate surrounding page-state object, but none may be passed into the projection builder.

Also assert that `Object.keys(request.context)` remains exactly:

```ts
['surface', 'hasCurrentClass', 'hasCurrentUda', 'hasSelectedSource']
```

- [ ] **Step 2: Run tests and verify causal RED**

Run:

```bash
bun test src/library/agentIntent.test.ts src/security/aic01ContextPrivacyContract.test.ts
```

Expected: FAIL because `buildAgentRoutingRequestFromProjection` does not exist.

- [ ] **Step 3: Implement the projection-based builder**

Signature:

```ts
export function buildAgentRoutingRequestFromProjection(
  message: string,
  context: CopilotContextProjectionV1
): AgentRoutingRequestV1
```

Implementation must delegate through `toRemoteRoutingProjection()` and the existing `buildAgentRoutingRequest()` / parser, so the server wire contract remains unchanged.

- [ ] **Step 4: Verify GREEN and existing runtime privacy regressions**

Run:

```bash
bun test src/library/agentIntent.test.ts src/security/aic01ContextPrivacyContract.test.ts src/security/agentIntentRuntimeContract.test.ts src/security/agentIntentDiagnosticsContract.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/library/agentIntent.ts src/library/agentIntent.test.ts src/security/aic01ContextPrivacyContract.test.ts
git commit -m "feat: route agent intent through minimized context projection"
```

---

### Task 4: Wire App and Composer to the unified context projection

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/LibraryCopilotComposer.tsx`
- Test: `src/security/aic01ContextPrivacyContract.test.ts`
- Test: existing Copilot/launch security tests as applicable.

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces: every Copilot submission constructs one `CopilotContextProjectionV1` before building the remote request.

- [ ] **Step 1: Extend the contract test with source-code assertions for the migration**

Require:

- `LibraryCopilotComposer.tsx` imports `buildCopilotContextProjection` and `buildAgentRoutingRequestFromProjection`;
- the local `agentRoutingSurface()` helper is removed;
- remote request construction no longer assembles `surface/hasCurrentClass/hasCurrentUda/hasSelectedSource` ad hoc in the Composer;
- `App.tsx` maps planning, online-tests and evaluation-related teacher tabs to explicit local Copilot surfaces without passing student arrays or grades into `ambientContext`.

- [ ] **Step 2: Run the security contract and verify RED**

Run:

```bash
bun test src/security/aic01ContextPrivacyContract.test.ts
```

Expected: FAIL because Composer/App still use the old ad-hoc path.

- [ ] **Step 3: Migrate `LibraryCopilotComposer`**

Before `interpretCopilotIntent()`:

1. build one local context from the active launch/ambient surface, effective class, resolved teaching context and selected source id;
2. call `buildAgentRoutingRequestFromProjection(message.trim(), contextProjection)`;
3. retain the existing epoch/stale-response invalidation logic and fallback diagnostics.

Do not add planning document payload, source text, UDA content, student data or memory in this slice.

- [ ] **Step 4: Expand `App.tsx` local surface mapping**

Map the current teacher surface to the richer local vocabulary. At minimum:

- home → `home`
- dashboard → `class-dashboard`
- biblioteca → `library`
- UDA workspace / lesson path → `uda` or `lesson` as currently resolved
- planning → `planning`
- online tests → `online-tests`
- evaluations → `evaluations`
- everything else → `other-teacher-surface`

Only pass metadata already allowed by `CopilotLaunchContext`; never pass `currentClass.students`, grades, behaviors, submissions or report structures.

- [ ] **Step 5: Run focused product/security tests**

Run:

```bash
bun test src/copilot/contextProjection.test.ts src/library/copilotLaunchContext.test.ts src/library/agentIntent.test.ts src/security/aic01ContextPrivacyContract.test.ts src/security/agentIntentRuntimeContract.test.ts src/security/agentIntentDiagnosticsContract.test.ts src/security/librarySingleCopilotSurfaceContract.test.ts
bun run lint
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/components/LibraryCopilotComposer.tsx src/security/aic01ContextPrivacyContract.test.ts
git commit -m "feat: wire unified context into the contextual copilot"
```

---

### Task 5: Add permanent cross-surface browser qualification

**Files:**
- Create: `tests/browser/aic-01-context-projection.spec.cjs`
- Modify: `.github/workflows/browser-qualification.yml`

**Interfaces:**
- Consumes: completed Tasks 1–4.
- Produces: permanent exact-SHA Chromium evidence for cross-surface context minimization and stale-context safety.

- [ ] **Step 1: Write the browser test and add it to the workflow**

The spec must use synthetic data only and intercept `/api/copilot/intent`.

Required journeys:

1. **Planning surface:** open Copilot, submit a request, assert request context surface is `planning` and no content payload is present.
2. **Online tests surface:** assert remote surface is `other-teacher-surface`, class presence is boolean-only and test/student answers are absent.
3. **Evaluations surface:** populate synthetic student/grade data in the app, open Copilot, submit, assert intercepted JSON contains none of those synthetic values.
4. **Library/UDA regression:** existing PREPARE phrase still emits `library`/`uda` remote context with correct booleans.
5. **Stale async context:** delay the mocked agent response, navigate/change context, release response, assert no obsolete action/disclosure is reopened.
6. Run at desktop and at least one critical 390×844 mobile journey.

Update `.github/workflows/browser-qualification.yml` to copy and execute `aic-01-context-projection.spec.cjs` in the permanent suite.

- [ ] **Step 2: Obtain causal RED**

Run the browser gate on the test-only head before the product migration is present, or otherwise ensure the new test fails specifically because the old ad-hoc context path cannot satisfy the new cross-surface privacy assertions.

Expected: FAIL for the new AIC-01 contract only; unrelated baseline journeys remain green.

- [ ] **Step 3: Re-run after Tasks 1–4 GREEN**

Use the repository's canonical GitHub Actions Browser Qualification on the exact candidate SHA.

Expected: all existing browser tests + AIC-01 tests PASS; UX-QA-01 and UX-QA-02 remain PASS with 0 findings.

- [ ] **Step 4: Run PREDEPLOY on the same exact candidate**

Expected:

- frozen install PASS;
- `bun run lint` PASS;
- security tests PASS;
- Library tests PASS;
- production build PASS;
- production startup smoke PASS.

- [ ] **Step 5: Freeze candidate and verify scope**

Compare against the AIC-01 baseline. Allowed changes are limited to the files listed in this plan plus test evidence/docs if needed. No provider/runtime/Core/vendor/persistence changes.

- [ ] **Step 6: Independent review**

Review focus: student-personal leakage, stale async context, explicit-context binding, accidental capability expansion, regression of LINK/PREPARE governance, and mobile UX.

Any finding requires a new causal RED → GREEN before final qualification.

- [ ] **Step 7: Commit final test/workflow changes**

```bash
git add tests/browser/aic-01-context-projection.spec.cjs .github/workflows/browser-qualification.yml
git commit -m "test: qualify copilot context projection across surfaces"
```

---

## Final AIC-01 Acceptance

Do not call AIC-01 complete until all of the following are true on one frozen exact candidate SHA:

- AIC-00 prerequisite is classified/closed enough to avoid unexplained live fallback;
- focused unit/security tests PASS;
- existing AGENT-INTENT runtime/diagnostic/privacy regressions PASS;
- full PREDEPLOY PASS;
- full Browser Qualification PASS including the permanent AIC-01 spec;
- desktop + 390×844 evidence PASS;
- no student-personal value appears in intercepted routing requests;
- no new capability/provider/model/retry/storage behavior exists in the diff;
- independent review has 0 unresolved significant findings;
- no merge/deploy/publication has occurred without a separate human decision.

Target terminal state:

`AIC-01 UNIFIED CONTEXT PROJECTION — ENGINEERING QUALIFIED / PRIVACY BOUNDARY PASS / HUMAN INTEGRATION DECISION READY`
