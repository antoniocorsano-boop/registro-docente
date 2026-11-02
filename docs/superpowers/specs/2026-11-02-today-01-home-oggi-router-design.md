# TODAY-01 — Home “Oggi” Router Design

**Baseline:** `main@3c3e55a0a1de9bca3905669e54e9c55d04808035`

**Parent governance:** UX-GOV-01 PR #103, CTX-01 PR #105, roadmap tracker #104.

## Intent

Transform the existing post-unlock Home from a class-first landing page into a thin professional task router built around `Prepara → Conduci → Registra → Rivedi`, without replacing the mature specialist workspaces and without weakening the neutral secure-entry contract.

TODAY-01 is orchestration only. It does not implement the later FLOW-01..04 specialist journeys.

## User outcome

After unlock, the teacher sees a clear `Oggi` entry point with four primary actions:

- `Prepara`
- `Conduci`
- `Registra`
- `Rivedi`

Selecting one of these actions records only a session-local navigation intent. If no class is known, the product asks the teacher to choose a class rather than inferring one. The existing `Classi`, `Sintesi` and `Confronto` views remain directly available as expert entry points.

Once the class is explicitly selected, the existing class Dashboard remains the safe context landing. A compact continuation strip may expose only links to existing specialist surfaces appropriate to the chosen intent; it must not duplicate forms, metrics, business rules or professional writes.

## Current-state constraints

- `App.tsx` initializes `activeTab` to `home` and deliberately resets persisted `currentClassId` to `null` on secure entry.
- `handleSelectClass()` is the explicit class-context entry and routes to `dashboard`.
- `handleNavigateHome()` clears class context and returns to neutral Home.
- `HomeView` already owns the `Classi / Sintesi / Confronto` expert views and class creation/deletion.
- `DashboardView` already exposes class-level specialist navigation.
- `ActiveTab` already contains all destinations TODAY-01 needs; no new tab is required.
- CTX-01 supplies the canonical Professional Context and fails closed on class/planning mismatch. TODAY-01 must not create a parallel context model.

## Approaches considered

### A. Add a new `oggi` ActiveTab and a separate page

Rejected. It would create a second Home/dashboard concept, duplicate navigation state, and weaken the existing neutral-home contract.

### B. Make the four actions jump directly to fixed specialist tabs

Rejected. `Registra` and `Prepara` legitimately span several authoritative surfaces. Picking one fixed destination would encode arbitrary product policy and would make TODAY-01 prematurely implement FLOW-01/FLOW-03.

### C. Keep `home` canonical and add a session-only task intent — selected

`HomeView` becomes task-first while preserving its expert views. A `TodayAction` is stored only in React session state. When a class is missing, the selected task changes the class-selection cue but never chooses a class. Explicit class selection keeps the existing `dashboard` transition. The Dashboard may then show a compact continuation strip containing navigation-only shortcuts to existing surfaces.

This is the thinnest change that satisfies the roadmap while preserving specialist authority.

## Domain contract

Create `src/today/todayRouter.ts` with a deliberately small UI-routing contract:

```ts
export type TodayAction = 'prepare' | 'conduct' | 'record' | 'review';

export type TodayRouteDecision =
  | { status: 'needs-class'; action: TodayAction }
  | { status: 'class-entry'; action: TodayAction; classId: string; target: 'dashboard' };

export interface TodayContinuationOption {
  tab: ActiveTab;
  label: string;
}

export function resolveTodayRoute(
  action: TodayAction,
  currentClassId: string | null | undefined
): TodayRouteDecision;

export function getTodayContinuationOptions(
  action: TodayAction
): readonly TodayContinuationOption[];
```

`resolveTodayRoute()` may only use an explicitly supplied current class. It never selects from the class list, never reads persisted navigation state and never calls AI/semantic resolution.

Continuation options are navigation hints only:

- `prepare`: `uda-gantt`, `programmazione`, `biblioteca`, `verifiche-online`;
- `conduct`: `uda-gantt`, `verifiche-online`;
- `record`: `voti`, `comportamenti`;
- `review`: `tabellone`, `analytics`, `storico`, `report`.

These options do not grant write authority and do not bypass any specialist validation.

## Session-state rules

`todayAction` lives only in `App.tsx` React state and initializes to `null`.

It must not be added to:

- `SecureAppSnapshot`;
- `AppData`;
- settings;
- backup payloads;
- local/session storage;
- Professional Memory;
- Copilot mission state.

Secure reload therefore returns to neutral `home` with `currentClassId=null` and `todayAction=null`.

TODAY-01 does not project the task label into CTX-01 `goal` and does not change Copilot behavior. The teacher’s chosen class remains the authoritative context boundary.

## Home interaction

The first visible Home section becomes `Oggi` and presents the four task actions as touch targets of at least 44 px.

When an action is selected without an active class:

1. store the session-local `TodayAction`;
2. keep the user on Home;
3. switch/focus the existing `Classi` view;
4. show a concise cue such as `Per continuare con Prepara, scegli una classe`;
5. provide an explicit cancel/reset action.

The existing class cards remain the class authority. Clicking a class still calls the established class-selection path; no class is preselected from timetable, recency or list order.

`Classi`, `Sintesi` and `Confronto` remain visible and usable. No existing aggregate metric is copied into the new `Oggi` section.

## Class continuation

After class selection, `dashboard` is still the canonical landing. When `todayAction` is non-null, `DashboardView` renders one compact continuation card above its existing content.

The card:

- names the chosen task;
- shows only the corresponding existing navigation destinations;
- contains no student-level data;
- contains no mutation form;
- provides an explicit dismiss action;
- clears the intent when a continuation destination is chosen.

If the teacher ignores the card, the ordinary Dashboard remains fully usable.

## Navigation wording

The global Home entry is renamed from `Classi` to `Oggi`, because Home now represents the professional starting point. The expert `Classi` view remains inside Home and retains its own label.

Back-to-home controls use `Oggi` rather than implying that the whole Home is only the class list.

No `ActiveTab` value is renamed; this is presentation copy only.

## Privacy and authority

TODAY-01 introduces no student identifiers into routing state. `TodayAction` is four fixed enum values only.

The router may not:

- infer a class;
- persist a task intent;
- create or mutate UDA, evaluations, behaviours, tests or planning data;
- execute Copilot actions;
- weaken Privacy Shield;
- bypass CTX-01 conflict handling.

## Mobile behavior

390×844 is a primary viewport.

- The four `Oggi` actions must fit without horizontal scrolling.
- Touch targets are at least 44 px.
- The class-choice cue must remain visible without covering class cards.
- The continuation card must wrap rather than overflow.
- Existing bottom class navigation must remain reachable after entering a class.

## Accessibility

- The four actions are real buttons with accessible names.
- Selected/pending task state is exposed textually; meaning cannot depend on color alone.
- The class-choice cue uses an appropriate status/region semantics without stealing focus unexpectedly.
- Cancel/dismiss controls have explicit labels.

## Qualification

Add invariant `TODAY-01-I01` covering:

> Home/Oggi is a session-only task router: it never infers class context, never persists task intent, preserves expert Home views, and routes only to existing authoritative specialist surfaces after explicit teacher choices.

Required evidence:

- RED → GREEN contract tests for the pure router;
- source/integration contract for Home/App/Dashboard session-only wiring;
- inherited secure-start/context/privacy contracts;
- typecheck, Security, Library, build and production-startup smoke;
- Browser Qualification including desktop and 390×844 mobile checks;
- Final Independent Review on exact SHA;
- Human Product/UX Review because the Home hierarchy and navigation wording are visibly changed.

## Non-goals

TODAY-01 does not:

- implement a dedicated lesson-conduction surface;
- merge Programmazione/UDA/Biblioteca/Verifiche;
- redesign evaluation or behaviour forms;
- add timetable inference;
- persist last-used class or task;
- redesign the whole navigation shell;
- implement FLOW-01, FLOW-02, FLOW-03 or FLOW-04.

## Exit criteria

TODAY-01 is ready for integration only when:

1. neutral secure entry still opens `home` with no active class and no task intent;
2. the teacher can start each of the four journeys with task selection plus, when required, one explicit class choice;
3. no class is inferred automatically;
4. `Classi`, `Sintesi`, `Confronto` and direct expert navigation remain available;
5. no specialist business logic is duplicated;
6. mobile 390×844 and desktop browser evidence are green;
7. exact-SHA independent review and Human Product/UX Review are PASS.