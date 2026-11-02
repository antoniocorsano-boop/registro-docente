# CTX-01 — Unified Professional Context Design

**Status:** APPROVED FOR IMPLEMENTATION  
**Date:** 2026-11-02  
**Parent governance:** UX-GOV-01 / PR #103  
**Product baseline:** `main@f332d63a9e26df41072f9b726142e612d408e7d0`

## Intent

Create one canonical, session-only professional context model that can be derived from the signals Registro Docente already owns and reused across Home, Class, UDA, Biblioteca, Planning and Copilota.

CTX-01 does **not** create a new persisted navigation authority and does not change the visible information architecture. It establishes the context contract that later lines (`TODAY-01`, `FLOW-01..04`) will consume.

Guiding principle inherited from UX-GOV-01:

> Il docente sceglie il lavoro da svolgere; l'app mantiene il contesto. Gli strumenti specialistici compaiono soltanto quando servono.

## Goals

- Define a canonical `ProfessionalContextV1`.
- Resolve context deterministically from explicit existing signals.
- Detect contradictions instead of choosing an arbitrary target.
- Preserve the neutral Home invariant after unlock/reload.
- Keep student-personal data out of the professional context payload.
- Carry only identifiers/labels required for routing and professional continuity.
- Provide adapters to existing Copilot and Biblioteca context contracts.
- Allow future `Oggi` and work flows to consume the same contract without rewriting specialist workspaces.

## Non-goals

- No new Home/Oggi UI.
- No `Prepara / Conduci / Registra / Rivedi` UI yet.
- No persistent `currentProfessionalContext` in Secure Local Vault, AppData, backup or browser storage.
- No automatic restoration of class/UDA/student context after reload.
- No AI inference, embeddings or text similarity to select context.
- No automatic mutation of UDA, planning, Biblioteca or class records.
- No student identifiers, grades, behaviours, notes or student-personal content in the context.
- No change to remote-provider consent or Local Semantic Memory authority.

## Existing authoritative signals

CTX-01 composes but does not replace:

- `AppData.currentClassId` and the resolved current `ClassData`.
- `ResolvedLibraryTeachingContext` (`udaId`, `lessonId?`, `className`, `period`, activity metadata).
- `LibraryPlanningContextResolution` (teaching profile and authoritative Arena context when uniquely resolved).
- `CopilotLaunchContext` (`surface`, class/UDA/lesson/source and explicit intent).
- current application surface.
- explicit professional goal/intent when supplied by a future work-flow router.
- explicit privacy scope supplied by the owning surface.

## Canonical model

Create `src/context/professionalContext.ts`.

```ts
export type ProfessionalPrivacyScopeV1 =
  | 'TEACHER_PROFESSIONAL'
  | 'STUDENT_PERSONAL_PRESENT';

export type ProfessionalTimeKindV1 =
  | 'today'
  | 'upcoming'
  | 'past'
  | 'unspecified';

export interface ProfessionalTimeContextV1 {
  kind: ProfessionalTimeKindV1;
  date?: string;
}

export interface ProfessionalContextV1 {
  schema: 'registro.professional-context/v1';
  surface: CopilotLocalSurface;
  classId?: string;
  className?: string;
  udaId?: string;
  lessonId?: string;
  sourceId?: string;
  planningProfileId?: string;
  arenaContextId?: string;
  assessmentId?: string;
  goal?: string;
  time: ProfessionalTimeContextV1;
  privacyScope: ProfessionalPrivacyScopeV1;
}
```

The model deliberately remains flat and minimal because it is a routing/context projection, not a domain aggregate.

## Resolver

```ts
export interface ResolveProfessionalContextInput {
  surface: CopilotLocalSurface;
  currentClass?: { id: string; name: string } | null;
  teachingContext?: ResolvedLibraryTeachingContext | null;
  planningContext?: LibraryPlanningContextResolution | null;
  sourceId?: string | null;
  assessmentId?: string | null;
  goal?: string | null;
  time?: ProfessionalTimeContextV1 | null;
  privacyScope?: ProfessionalPrivacyScopeV1;
}

export type ProfessionalContextConflictCode =
  | 'CLASS_MISMATCH'
  | 'PLANNING_CONTEXT_AMBIGUOUS';

export type ProfessionalContextResolutionV1 =
  | { status: 'resolved'; context: ProfessionalContextV1 }
  | {
      status: 'conflict';
      conflicts: readonly ProfessionalContextConflictCode[];
    };
```

### Resolution rules

1. `surface` is always explicit and required.
2. `currentClass` may contribute `classId/className`.
3. A valid `teachingContext` may contribute class/UDA/lesson.
4. If current class and teaching context declare different classes, return `CLASS_MISMATCH`; do not pick either silently.
5. A `planningContext.status === 'resolved'` contributes `planningProfileId` and optional `arenaContextId`.
6. A `planningContext.status === 'ambiguous'` returns `PLANNING_CONTEXT_AMBIGUOUS`; unavailable planning context is simply omitted.
7. `sourceId`, `assessmentId`, `goal` are explicit-only and trimmed; blank strings are omitted.
8. `time` defaults to `{ kind: 'unspecified' }`.
9. `privacyScope` defaults to `TEACHER_PROFESSIONAL`; surfaces handling student data must opt into `STUDENT_PERSONAL_PRESENT` explicitly.
10. The resolver never selects an UDA/lesson/source from a list. Existing deterministic selectors remain upstream and authoritative.

## Privacy and minimization

`ProfessionalContextV1` must never contain:

- student id/name;
- grades;
- behaviour records;
- student notes;
- library source body/URL/image/extract;
- UDA title/description/competence text;
- lesson topic/notes;
- generated prompts or model output.

`privacyScope` is a routing guard, not permission to copy sensitive content into context.

## Session-only invariant

CTX-01 must not add professional context to:

- `AppData`;
- `SecureSnapshot` / vault payload;
- encrypted backup payload;
- localStorage/sessionStorage/IndexedDB as a new context record.

After vault unlock/reload the existing `currentClassId: null` invariant remains unchanged. A future Oggi surface may show safe continuity suggestions, but active class/UDA/student authority still requires a fresh explicit choice or deterministic, reviewable workflow signal.

## Adapters

### Copilot adapter

```ts
export function toCopilotContextProjection(
  context: ProfessionalContextV1
): CopilotContextProjectionV1;
```

It maps only supported routing fields and reuses the current `buildCopilotContextProjection` contract. Student-personal content is never added.

### Biblioteca teaching-context adapter

```ts
export function toLibraryTeachingContext(
  context: ProfessionalContextV1
): LibraryTeachingContext | null;
```

It returns null when no UDA exists; when lesson exists it remains subordinate to the same `udaId`.

### Launch-context adapter

```ts
export function resolveProfessionalContextFromLaunch(
  ambient: ProfessionalContextV1,
  launch: CopilotLaunchContext | null,
  resolvedTeachingContext?: ResolvedLibraryTeachingContext | null,
  planningContext?: LibraryPlanningContextResolution | null
): ProfessionalContextResolutionV1;
```

Explicit launch fields may enrich the ambient context. Contradictory class targets fail closed.

## Initial integration boundary

CTX-01 rewires the existing ambient Copilot projection to derive from `ProfessionalContextV1` instead of constructing a parallel class/surface object in `App.tsx`.

The existing Biblioteca deterministic teaching-context resolver remains authoritative and is adapted into the canonical context; CTX-01 does not replace its suggestion algorithm.

No visible copy, navigation tab or specialist form changes in this slice.

## Failure behaviour

- current class vs teaching class mismatch -> conflict, no context projection dispatched;
- ambiguous planning profile/Arena context -> conflict for operations requiring that planning signal;
- unavailable planning context -> resolved context without planning ids;
- stale teaching context -> upstream resolver returns null; CTX-01 does not resurrect it;
- blank ids/goal -> omitted;
- student-personal surface -> privacy scope marks presence but payload remains minimised;
- unknown surface -> TypeScript contract prevents unsupported values.

## Qualification invariants

Add `CTX-01-I01` covering the canonical model, tests and App integration. Statement:

> Professional context is session-only, deterministic and minimised; contradictions fail closed; existing neutral-entry and student-data privacy invariants remain authoritative.

## Acceptance

1. Pure contract tests cover class-only, teaching context, planning context, source/assessment/goal, defaults and trimming.
2. Conflict tests cover class mismatch and ambiguous planning context.
3. Adapter tests prove Copilot projection and Biblioteca teaching context use the same canonical identifiers.
4. Privacy tests prove no student/grade/behaviour fields exist in the model or App wiring.
5. Static integration test proves `App.tsx` derives ambient Copilot context through the canonical resolver/adapter rather than a bespoke literal.
6. Existing navigation tests prove reload still clears active class context.
7. Qualification Invariants, PREDEPLOY and browser qualification remain green on the exact candidate.

## Evolution boundary

Only after CTX-01 is qualified may `TODAY-01` build Home/Oggi as a work router. TODAY-01 consumes this contract; it must not invent a second context model.