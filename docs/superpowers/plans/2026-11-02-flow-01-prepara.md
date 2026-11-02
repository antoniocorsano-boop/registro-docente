# FLOW-01 — Prepara Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn TODAY-01 `Prepara` into a compact, context-preserving teacher-intent router across Programmazione, UDA, Biblioteca, Verifiche and Copilota without creating a new specialist workspace.

**Architecture:** Keep TODAY-01 class selection authoritative and add a FLOW-01-only preparation semantics module plus a presentational router panel inside the existing class Dashboard. Existing tab navigation preserves the selected class; Copilota receives an explicit class-only preparation launch context. No preparation state is persisted.

**Tech Stack:** React 19, TypeScript 7, Bun tests, Vite, existing Secure Local Vault, CTX-01 Professional Context, Playwright Chromium qualification.

**Spec:** `docs/superpowers/specs/2026-11-02-flow-01-prepara-design.md`

## Global Constraints

- Baseline is `main@74c9ef35e46e4e5825a56034645041b4053fbda2`.
- No new persisted `PreparationContext` or navigation schema.
- No automatic class/UDA/activity selection.
- No UDA/activity/verification creation in the router.
- No Copilota execution or professional write from inference.
- Programmazione, UDA, Biblioteca, Verifiche and Copilota remain authoritative specialist implementations.
- CTX-01 remains canonical professional-context authority.
- TODAY-01 behavior for `Conduci`, `Registra`, `Rivedi` must not regress.
- Mobile 390×844 is a primary qualification viewport.
- Human Product/UX Review is required before integration.

## Review Focus

- Missing or stale current class during Copilota launch must fail closed rather than choose another class.
- Opening a specialist preparation surface must preserve the explicitly selected class while clearing the transient TODAY action.
- Multiple UDA/material candidates must remain unresolved until the owning specialist surface asks the teacher.
- FLOW-01 must not leak student/grade/behavior data into Copilota launch context.
- The mobile router must fit 390×844 without horizontal overflow or hiding the `Chiudi` action.

---

### Task 1: Preparation routing semantics

**Files:**
- Create: `src/preparation/preparationRouter.ts`
- Create: `src/security/flow01PreparationRouterContract.test.ts`

**Interfaces:**
- Consumes: `ActiveTab` from `src/types.ts`; `CopilotLaunchContext` from `src/library/copilotLaunchContext.ts`.
- Produces: `PreparationIntent`, `PreparationDestination`, `PreparationOption`, `getPreparationOptions()`, `buildPreparationCopilotLaunchContext()`.

- [ ] **Step 1: Write failing contract tests**

Test names/assertions:

```ts
expect(getPreparationOptions().map(option => option.id)).toEqual([
  'curriculum-frame',
  'uda-lesson',
  'material',
  'assessment',
  'copilot'
]);
expect(getPreparationOptions().map(option => option.destination)).toEqual([
  { kind: 'tab', tab: 'programmazione' },
  { kind: 'tab', tab: 'uda-gantt' },
  { kind: 'tab', tab: 'biblioteca' },
  { kind: 'tab', tab: 'verifiche-online' },
  { kind: 'copilot', intent: 'prepare' }
]);
expect(buildPreparationCopilotLaunchContext({ name: ' 2ª C ' })).toEqual({
  surface: 'class-dashboard',
  className: '2ª C',
  intent: 'prepare'
});
expect(buildPreparationCopilotLaunchContext(null)).toBeNull();
expect(buildPreparationCopilotLaunchContext({ name: '   ' })).toBeNull();
```

Also assert that labels/descriptions match the spec exactly and that no option targets student-personal tabs.

- [ ] **Step 2: Run test to verify RED**

Run: `bun test src/security/flow01PreparationRouterContract.test.ts`
Expected: FAIL because `src/preparation/preparationRouter.ts` does not exist.

- [ ] **Step 3: Implement the minimal routing module**

Signatures:

```ts
export function getPreparationOptions(): readonly PreparationOption[];
export function buildPreparationCopilotLaunchContext(
  currentClass: { name: string } | null | undefined
): CopilotLaunchContext | null;
```

Use one immutable option table. Trim class name; return `null` for missing/blank values. Do not read UDA, grades, students, behaviors or persistence state.

- [ ] **Step 4: Run GREEN verification**

Run: `bun test src/security/flow01PreparationRouterContract.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/preparation/preparationRouter.ts src/security/flow01PreparationRouterContract.test.ts
git commit -m "feat: add FLOW-01 preparation routing semantics"
```

---

### Task 2: Dedicated preparation router panel

**Files:**
- Create: `src/components/PreparationRouterPanel.tsx`
- Modify: `src/components/DashboardView.tsx`
- Modify: `src/today/todayRouter.ts`
- Create: `src/security/flow01PreparationUiContract.test.ts`
- Update as needed: existing TODAY-01 continuation contract tests

**Interfaces:**
- Consumes Task 1 `PreparationOption[]` via `getPreparationOptions()`.
- Produces `PreparationRouterPanel` props:

```ts
interface PreparationRouterPanelProps {
  className: string;
  onNavigateTab: (tab: ActiveTab) => void;
  onOpenCopilot: () => void;
  onDismiss: () => void;
}
```

- [ ] **Step 1: Write failing UI source-contract tests**

Assert:
- `DashboardView` renders `PreparationRouterPanel` only when `todayAction === 'prepare'`.
- `Conduci`, `Registra`, `Rivedi` still use generic TODAY continuation.
- `PreparationRouterPanel` imports `getPreparationOptions()` rather than defining a second option table.
- context copy contains `Stai preparando per` and the supplied class name.
- `Chiudi` has a minimum 44px target.
- the component contains no AppData mutation or persistence imports.
- `todayRouter.ts` generic continuation map no longer owns `prepare` options.

- [ ] **Step 2: Run tests to verify RED**

Run: `bun test src/security/flow01PreparationUiContract.test.ts src/security/today01ContinuationContract.test.ts`
Expected: FLOW-01 assertions fail before product code changes.

- [ ] **Step 3: Implement `PreparationRouterPanel` and Dashboard branch**

Render five intent cards/buttons using the exact labels/descriptions from Task 1. Tab destinations call `onNavigateTab`; Copilota destination calls `onOpenCopilot`. Keep the panel visually compact and subordinate to the Dashboard.

In `DashboardView`, use:

```tsx
todayAction === 'prepare'
  ? <PreparationRouterPanel ... />
  : <existing generic TODAY continuation ... />
```

Refine `todayRouter.ts` so generic continuation options accept only `Exclude<TodayAction, 'prepare'>`.

- [ ] **Step 4: Run GREEN verification**

Run: `bun test src/security/flow01PreparationUiContract.test.ts src/security/today01ContinuationContract.test.ts src/security/today01HomeUiContract.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/PreparationRouterPanel.tsx src/components/DashboardView.tsx src/today/todayRouter.ts src/security/flow01PreparationUiContract.test.ts src/security/today01ContinuationContract.test.ts
git commit -m "feat: add dedicated Prepara router panel"
```

---

### Task 3: Explicit Copilota preparation handoff and session-only integration

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/DashboardView.tsx`
- Create: `src/security/flow01AppIntegrationContract.test.ts`

**Interfaces:**
- Consumes Task 1 `buildPreparationCopilotLaunchContext()`.
- Produces App handler:

```ts
const handleOpenPreparationCopilot = useCallback(() => { ... }, [currentClass, openLibraryCopilot]);
```

- [ ] **Step 1: Write failing integration contract tests**

Assert source-level integration:
- App imports `buildPreparationCopilotLaunchContext`.
- handler derives launch context from `currentClass` and calls existing `openLibraryCopilot` only for non-null context.
- `DashboardView` receives `onOpenPreparationCopilot` only for the prepare panel.
- the launch context is not written into `AppData`, backup payload, PlanningState, LibraryState, ProfessionalMemoryState or CopilotState.
- existing `handleContinueToday()` clears `todayAction` before tab navigation and still preserves `currentClassId`.
- restore/reset/Home/popstate still clear transient TODAY intent.
- no student/grades/behaviors fields appear in the FLOW-01 Copilota launch path.

- [ ] **Step 2: Run RED verification**

Run: `bun test src/security/flow01AppIntegrationContract.test.ts`
Expected: FAIL before App integration.

- [ ] **Step 3: Implement explicit Copilota handoff**

Add the handler using Task 1 builder and existing `openLibraryCopilot`. Do not add state. Pass it into the prepare panel through `DashboardView`.

- [ ] **Step 4: Run GREEN + inherited contracts**

Run:

```bash
bun test src/security/flow01AppIntegrationContract.test.ts \
  src/security/ctx01AppIntegrationContract.test.ts \
  src/security/aic01ContextPrivacyContract.test.ts \
  src/security/librarySingleCopilotSurfaceContract.test.ts \
  src/security/today01SessionContextContract.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/components/DashboardView.tsx src/security/flow01AppIntegrationContract.test.ts
git commit -m "feat: preserve class context across Prepara handoffs"
```

---

### Task 4: Dedicated Chromium qualification for FLOW-01

**Files:**
- Create: `tests/browser/flow-01-prepara.spec.cjs`
- Modify: `.github/workflows/browser-qualification.yml`
- Create: `src/security/flow01BrowserQualificationContract.test.ts`

**Interfaces:**
- Consumes product UI from Tasks 1–3.
- Produces deterministic desktop + mobile screenshots/evidence for Human Product/UX Review.

- [ ] **Step 1: Write qualification-contract RED test**

Assert workflow contains a dedicated `Run FLOW-01 Chromium qualification` step and the test file is bound into the Browser workflow.

- [ ] **Step 2: Run RED verification**

Run: `bun test src/security/flow01BrowserQualificationContract.test.ts`
Expected: FAIL because dedicated browser evidence is not yet wired.

- [ ] **Step 3: Add Playwright journey**

Desktop and viewport `390×844` must verify:
- `Oggi → Prepara` leaves class unselected until teacher choice;
- after class selection, heading/context cue identifies the exact selected class;
- all five preparation intentions are visible;
- Programmazione/UDA/Biblioteca/Verifiche route to their existing surfaces while the class remains the active class in navigation state;
- `Chiedi supporto` opens Copilota and the visible Copilota context contains the selected class without a second class prompt;
- no UDA/activity is created merely by opening the router;
- no horizontal overflow is introduced.

Save evidence:
- `flow-01-desktop-router.png`
- `flow-01-desktop-copilot.png`
- `flow-01-mobile-router.png`
- `flow-01-mobile-copilot.png`

- [ ] **Step 4: Wire Browser workflow and run contract GREEN**

Run: `bun test src/security/flow01BrowserQualificationContract.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/browser/flow-01-prepara.spec.cjs .github/workflows/browser-qualification.yml src/security/flow01BrowserQualificationContract.test.ts
git commit -m "test: qualify FLOW-01 preparation journey in Chromium"
```

---

### Task 5: Qualification invariant, complete regression and PR evidence

**Files:**
- Modify: `qualification/invariants.v1.json`
- Create: `src/security/flow01QualificationContract.test.ts`
- Update only if a causal regression is exposed: affected historical tests/workflow paths

**Interfaces:**
- Consumes all FLOW-01 changed paths.
- Produces a fail-closed qualification boundary for the complete increment.

- [ ] **Step 1: Add FLOW-01 invariant contract test first**

Assert registry contains a FLOW-01 invariant whose impact paths include:
- `src/preparation/preparationRouter.ts`
- `src/components/PreparationRouterPanel.tsx`
- `src/components/DashboardView.tsx`
- `src/today/todayRouter.ts`
- `src/App.tsx`
- all FLOW-01 security tests
- `tests/browser/flow-01-prepara.spec.cjs`
- `.github/workflows/browser-qualification.yml`

Browser smoke must bind the dedicated FLOW-01 spec.

- [ ] **Step 2: Run RED verification**

Run: `bun test src/security/flow01QualificationContract.test.ts`
Expected: FAIL before registry change.

- [ ] **Step 3: Register FLOW-01 fail-closed qualification impact**

Add the invariant without weakening CTX-01 or TODAY-01 coverage.

- [ ] **Step 4: Run complete local qualification commands**

```bash
bun run test:security
bun run test:library
bun run lint
bun run build
```

Expected: all PASS / exit 0.

- [ ] **Step 5: Commit**

```bash
git add qualification/invariants.v1.json src/security/flow01QualificationContract.test.ts
git commit -m "test: register FLOW-01 qualification invariant"
```

- [ ] **Step 6: Open Draft PR and collect exact-SHA evidence**

PR title: `FLOW-01 — Prepara come ingresso coerente al lavoro`

Required exact-head gates:
- Qualification Invariants: PASS
- PREDEPLOY: PASS
- Browser Qualification: PASS including dedicated FLOW-01 desktop + 390×844
- Final Independent Review: PASS / 0 Critical / 0 Important before Human Product/UX Review

Keep PR Draft until technical qualification and Human Product/UX Review are both complete. No merge or deploy is implied.

---

## Self-review

- **Spec coverage:** five professional intents, class continuity, Copilota explicit context, no persistence, no automatic UDA/activity creation, mobile qualification and Human Review each have an owning task.
- **Type consistency:** Task 1 owns all preparation option and Copilota builder types used by Tasks 2–3.
- **Failure coverage:** missing class, ambiguous specialist candidates, privacy leak, stale transient intent and mobile overflow are explicitly tested or browser-qualified.
- **Scope discipline:** no specialist business logic is moved into FLOW-01; no new persisted context model is introduced.
- **Proportion:** implementation is split into five independently reviewable increments rather than one large UI/code change.
