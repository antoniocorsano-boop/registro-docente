# FLOW-02 — Conduct Copilot Rework Design

## Intent

Refine the Copilot opened from `Conduci` so it speaks the language of the in-lesson moment instead of falling back to the generic Biblioteca/teacher-first entry used for preparation and source work.

This is a Human Product/UX rework on PR #109. It does **not** add a new generative runtime capability.

Baseline for the rework: `ad34a030e800fa7cd604ead5c04a5c9b18906a34` on `feat/flow-02-conduci-lesson-surface`.

## Goals

- Detect an explicit launch with `launchRequest.context.intent === 'conduct'`.
- Present a conduct-specific entry: `Supporto durante la lezione` and the already selected class.
- Remove technical copy such as `contesto UDA non univoco` from the conduct entry.
- Do not show the generic four-goal grid (`Preparare un’attività`, `Lavorare su un materiale`, `Collegare a una UDA`, `Rivedere qualcosa`) when the Copilot was opened from `Conduci`.
- Use a conduct-specific prompt label and example, oriented to what the teacher needs now.
- If the submitted request maps to a capability that the current runtime does not execute (`ANSWER`, `SIMPLIFY`, `ADAPT`, etc.), explain that limitation in teacher-facing language rather than falling back to preparation-oriented wording.
- Preserve class context and all existing privacy/authority boundaries.

## Non-goals

- No new `ANSWER`, `SIMPLIFY`, `ADAPT` execution pipeline.
- No new remote provider call or model capability.
- No source/UDA mutation from `conduct`.
- No use of rapid-note contents in Copilot.
- No change to generic Biblioteca, Prepara, Review or Link entry behavior.
- No change to FLOW-03 semantics.

## Selected approach

### A. Cosmetic text replacement only — rejected
Would remove the most visible jargon but still expose preparation-oriented actions and keep the wrong interaction model.

### B. New general in-lesson generative assistant — rejected for FLOW-02
The intent classifier already recognizes `ANSWER`, `SIMPLIFY`, `ADAPT` and related intents, but `routeAgentIntent()` currently returns `UNSUPPORTED` for them. Implementing execution would enlarge runtime authority and belongs to a separate capability line.

### C. Conduct-specific presentation branch over the existing fail-closed runtime — selected
Introduce an explicit `isConductLaunch` presentation branch in `LibraryCopilotComposer`. It keeps the existing routing/authorization model, hides irrelevant teacher-first actions, provides in-lesson copy, and converts unsupported conduct requests into honest, contextual guidance.

## Conduct entry behavior

When `launchRequest.context.intent === 'conduct'`:

- Header context label:
  - resolved lesson/UDA: `<classe> · supporto durante la lezione · lezione di oggi` when a lesson is bound, otherwise `<classe> · supporto durante la lezione`;
  - class-only/ambiguous: `<classe> · supporto durante la lezione`;
  - never show `contesto UDA non univoco`.
- Entry heading: `Supporto durante la lezione`.
- Supporting copy: `La classe è già impostata. Descrivi ciò che ti serve adesso; il Copilota userà solo il contesto professionale già disponibile.`
- The generic four-goal grid is absent.
- Textarea label: `Che cosa ti serve adesso?`.
- Placeholder: `Per esempio: aiutami a spiegare questo passaggio in modo più semplice`.
- Submit action remains explicit and teacher-triggered.

## Runtime behavior

A conduct launch with no bound source/UDA must bypass the generic `frameTeacherFirstObjective()` gate and submit through the existing agent-intent route so the teacher is not forced back into preparation choices.

The current router remains authoritative:

- existing supported source/context actions keep their existing authorization;
- `conduct` itself gains no direct-action authority;
- unsupported intents remain unsupported.

For `routed.kind === 'UNSUPPORTED'` during a conduct launch, show:

`Ho capito che ti serve supporto durante la lezione, ma questa risposta non è ancora disponibile nel Copilota corrente. Posso continuare a usare il contesto della classe senza modificare registrazioni o valutazioni.`

For `SOURCE_REQUIRED` during a conduct launch, show:

`Per questa richiesta serve un materiale. Apri Materiali da Conduci, scegli la fonte e poi torna al Copilota.`

Generic non-conduct copy remains unchanged.

## Privacy and authority

- Class/optional UDA/lesson identifiers remain the only FLOW-02 launch context.
- Rapid note is never passed to Copilot.
- `conduct` stays metadata-only in `LibraryCopilotComposer`; only `prepare`, `review`, `link` may satisfy the direct-action gate.
- No professional mutation is introduced.

## Qualification

- New focused source contract for the conduct-specific entry and fail-closed messages.
- Existing FLOW-02 app/invariant contracts remain green.
- Browser FLOW-02 mobile journey must assert:
  - `Supporto durante la lezione` visible;
  - selected class visible;
  - generic four-goal grid absent;
  - technical phrase `contesto UDA non univoco` absent;
  - rapid note absent from Copilot as before.
- Fresh exact-SHA Invariants, PREDEPLOY and Browser qualification.
- Final Independent Re-review.
- Human Product/UX Review remains the integration gate.
