# FLOW-01 — Prepara orchestration design

**Status:** implementation-ready design  
**Date:** 2026-11-02  
**Baseline:** `main@74c9ef35e46e4e5825a56034645041b4053fbda2`  
**Roadmap:** UX-GOV-01 Phase 3A

## Intent

FLOW-01 makes `Prepara` a coherent professional entry point without creating a new specialist application. The teacher starts from `Oggi`, explicitly chooses a class through TODAY-01, then sees preparation choices expressed as teacher intentions rather than internal product modules.

The implementation must preserve the UX-GOV-01 principle: **the teacher chooses the work; the application keeps the professional context; specialist tools appear only when needed.**

## Goals

- Turn the current generic `Continua: Prepara` strip into a dedicated, compact preparation router.
- Keep the explicitly selected class active across Programmazione, UDA, Biblioteca, Verifiche and Copilota handoffs.
- Present preparation choices in professional language while still routing to the existing authoritative surfaces.
- Open Copilota with explicit preparation intent and the already-known class context.
- Preserve CTX-01 as the canonical professional-context resolver.
- Keep the entire FLOW-01 orchestration session-only: no new persisted navigation or preparation state.
- Keep mobile 390×844 a primary qualification viewport.

## Non-goals

- No new persisted `PreparationContext` schema.
- No new UDA, lesson, activity, verification or planning creation logic in the router.
- No automatic UDA/activity selection.
- No automatic Copilota execution.
- No rewrite of Programmazione, UDA, Biblioteca or Verifiche.
- No changes to professional authority, evaluation rules, planning authority, Secure Local Vault or Local Semantic Memory.
- No attempt to solve the pre-existing mobile Copilota-FAB/card overlap or long synthetic class-name collisions; those remain MOBILE-01/shell concerns.

## User journey

```text
Oggi
→ Prepara
→ explicit class choice when not already selected
→ class Dashboard
→ compact preparation router
   ├─ Definisci la cornice → Programmazione
   ├─ Sviluppa UDA o lezione → UDA
   ├─ Trova o usa un materiale → Biblioteca
   ├─ Prepara una verifica → Verifiche online
   └─ Chiedi supporto → Copilota
→ existing specialist workspace
→ current class context remains available
```

FLOW-01 does not add a second context-selection step merely for the sake of orchestration. UDA/lesson/source selection remains inside the specialist surface that owns it. When one of those surfaces already has an explicit UDA/lesson/source context, existing CTX-01 / Biblioteca / Copilota contracts continue to carry it without asking the teacher to repeat it.

## Approaches considered

### A. New standalone `Prepara` page

A dedicated page could collect class, UDA, lesson, material, verification and Copilota choices in one place.

**Rejected:** it would become another navigation silo and would duplicate selection/business logic already owned by specialist workspaces.

### B. Thin preparation router inside the existing class Dashboard — chosen

TODAY-01 already lands on the authoritative class Dashboard after explicit class selection. FLOW-01 replaces only the `prepare` continuation strip with a purpose-built router that explains five teacher intentions and delegates each one to an existing surface.

**Chosen because:** it is the smallest coherent change, preserves TODAY-01 and CTX-01, avoids new persistence, and lets the teacher begin preparation without needing to know which internal module owns the work.

### C. Automatically infer the next preparation workspace

The system could guess UDA, material or verification from time/current work and jump directly.

**Rejected:** this weakens fail-closed context rules, hides important professional choices and would require assumptions that UX-GOV-01 explicitly forbids when multiple targets are plausible.

## Interaction model

### Router placement

When `todayAction === 'prepare'` and a class is explicitly active, `DashboardView` renders a dedicated preparation section in the same top position currently used by the generic TODAY continuation card.

Other TODAY actions (`Conduci`, `Registra`, `Rivedi`) keep their existing continuation behavior in FLOW-01.

### Preparation choices

The router exposes exactly five choices:

1. **Definisci la cornice** — description: `Programmazione e riferimenti professionali.` — destination: `programmazione`.
2. **Sviluppa UDA o lezione** — description: `Organizza il percorso e le attività.` — destination: `uda-gantt`.
3. **Trova o usa un materiale** — description: `Apri la Biblioteca nel contesto della classe.` — destination: `biblioteca`.
4. **Prepara una verifica** — description: `Costruisci o gestisci una verifica online.` — destination: `verifiche-online`.
5. **Chiedi supporto** — description: `Apri il Copilota con il contesto già noto.` — destination: Copilota with `intent: 'prepare'`.

The labels intentionally describe teacher intent first. Surface names may appear in supporting copy, not as the primary mental model.

### Class context

The current class remains the session authority established by TODAY-01. Navigating to a preparation surface must not clear `currentClassId`.

The preparation router shows a compact context line such as `Stai preparando per 2ª C` and never changes the class implicitly.

### Copilota handoff

Copilota launch from FLOW-01 must be explicit and fail closed:

- if no current class exists, no launch occurs;
- context uses the canonical class name already selected;
- `surface` is `class-dashboard`;
- `intent` is `prepare`;
- no student, grade, behavior or assessment evidence is included;
- opening Copilota does not authorize a mission or professional write.

No new Copilota authority is introduced.

## Architecture

### New focused module

Create `src/preparation/preparationRouter.ts` as the sole source of FLOW-01 option semantics.

It owns:

```ts
export type PreparationIntent =
  | 'curriculum-frame'
  | 'uda-lesson'
  | 'material'
  | 'assessment'
  | 'copilot';

export type PreparationDestination =
  | { kind: 'tab'; tab: ActiveTab }
  | { kind: 'copilot'; intent: 'prepare' };

export interface PreparationOption {
  id: PreparationIntent;
  label: string;
  description: string;
  destination: PreparationDestination;
}

export function getPreparationOptions(): readonly PreparationOption[];

export function buildPreparationCopilotLaunchContext(
  currentClass: { name: string } | null | undefined
): CopilotLaunchContext | null;
```

The Copilota builder trims and validates `className`; blank/missing class returns `null`.

### New presentation component

Create `src/components/PreparationRouterPanel.tsx`.

Responsibilities:

- render the active class cue;
- render the five preparation choices from `getPreparationOptions()`;
- delegate tab choices through `onNavigateTab`;
- delegate Copilota through `onOpenCopilot`;
- expose `Chiudi` through `onDismiss`;
- contain no domain mutation logic.

### TODAY router refinement

`src/today/todayRouter.ts` remains the source for `TodayAction` and non-Prepara continuations. Its generic continuation map becomes responsible only for `conduct`, `record`, and `review`; `prepare` is owned by FLOW-01.

### App integration

`src/App.tsx` adds one explicit handler for Copilota preparation launch. The handler calls `buildPreparationCopilotLaunchContext(currentClass)` and, when non-null, opens the existing Copilota surface. Tab navigation continues through `handleContinueToday`, so the class remains active and the TODAY intent is cleared before entering the specialist workspace.

No persisted state is added to `AppData`, backups, planning, library, professional memory or Copilota state.

## Failure and edge-case behavior

- Missing/blank class on Copilota handoff: fail closed; no Copilota launch.
- Current class removed before a click: existing App navigation guards remain authoritative; no new fallback class is selected.
- Back/Home/popstate: TODAY intent clearing remains unchanged.
- Specialist surface has multiple UDA/material candidates: that specialist surface asks; FLOW-01 does not guess.
- Projected/read-only UDA: existing UDA/catalog authority remains unchanged; FLOW-01 does not create/edit projected UDA records.
- Privacy-sensitive surfaces are not entered by any FLOW-01 preparation option.

## Qualification

### Contract tests

Add focused security/contract tests for:

- exact five preparation intentions and destinations;
- no hidden sixth option or duplicate specialist business logic;
- Copilota launch context includes class + `intent: 'prepare'` only and fails closed without class;
- `todayRouter` no longer owns generic `prepare` continuation options;
- App integration remains session-only and does not add preparation data to persistence/backup schemas.

### Browser qualification

Dedicated Chromium journey on desktop and 390×844:

1. unlock seeded vault;
2. `Oggi → Prepara`;
3. confirm class selection is explicit;
4. select class;
5. verify preparation router and class cue;
6. verify each tab destination opens without losing the selected class context;
7. verify Copilota opens from `Chiedi supporto` without asking for the class again;
8. close/return and verify no automatic UDA/activity creation occurred.

The router must not introduce horizontal overflow at 390×844.

## Human Product/UX review criteria

PASS requires that a teacher can answer “what do I want to prepare?” without understanding product architecture. The five choices must feel like professional intentions, the selected class must remain obvious, and the router must remain visibly subordinate to the class Dashboard rather than becoming another dashboard.
