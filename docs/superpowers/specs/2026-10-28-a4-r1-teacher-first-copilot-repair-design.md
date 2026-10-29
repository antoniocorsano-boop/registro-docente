# RELEASE-CURRENT-02 / A4-R1 — Teacher-first Copilot repair design

**Date:** 2026-10-28  
**Status:** selected direction / awaiting human design approval for implementation  
**Repository:** `antoniocorsano-boop/registro-docente`  
**Product baseline:** `main@dea3b3e7a2cbd5ec920b7ec30f34ed23f45142f8`  
**Live target:** `https://registro-docente.ai.studio`  
**Trigger:** RELEASE-CURRENT-02 A4 authentic teacher validation — REWORK

## 1. Why this repair exists

The live A4 teacher-use evidence shows that the Copilot is technically present but is not yet useful enough in the teacher's natural workflow.

The most important observed failure is not visual polish. It is orchestration:

- the teacher starts from a goal such as `Attività per le classi prime`;
- the current Composer is organized around source -> teaching context -> REVIEW/LINK/PREPARE;
- without the right source/context binding the UI exposes internal capability taxonomy and can end in `NO_INTENT_MATCH`-style copy;
- the teacher is therefore required to understand the product's internal routing model before obtaining value.

The proactive deck also spends most of a mobile viewport rendering three empty groups (`Qui`, `Oggi`, `Più tardi`) when no opportunity is strong enough. The floating Copilot trigger remains visible while the Copilot surface is already open, and the mobile Vault controls (`Mai` / `Blocca`) can visually collide with the Copilot overlay.

A4 therefore exits as **REWORK** and this repair becomes the next bounded product slice. AIC-08 remains out of scope.

## 2. Selected approach

Three directions were evaluated during A4:

### A. Minimal cosmetic patch

Fix overlapping controls, copy and empty states while retaining the current source-first flow.

**Rejected:** it would make the existing model prettier without fixing the teacher's mental-model mismatch.

### B. Teacher-first orchestration — selected

Start from the teacher's intended outcome, then resolve the minimum professional context, then reveal source/material controls only when the selected capability needs them, then show the bounded mission preview and explicit Play.

**Selected because:** it changes the front-door experience while preserving the already-qualified authority, privacy, persistence and mission boundaries.

### C. Free-form general chatbot

Turn the surface into an unconstrained conversational assistant.

**Rejected:** it would blur the distinction between understanding, authorization and professional action and would weaken the governance model already established.

## 3. Canonical product principle

The teacher-facing flow becomes:

`goal -> context -> material only if needed -> bounded preview -> ▶ Play -> governed execution -> result -> separate professional confirmation`

The teacher must not have to know the names `REVIEW`, `LINK`, `PREPARE`, `IntentPort`, `NO_INTENT_MATCH`, capability registry or other internal routing concepts.

The UI may expose teacher-language actions such as:

- `Prepara un'attività`
- `Lavora su un materiale`
- `Collega a una UDA`
- `Rivedi qualcosa`

These are presentation-level starts. They do not authorize execution.

## 4. Non-negotiable AIC-07 invariants

This repair MUST preserve the AIC-07 contract exactly unless a later separately approved design changes it.

1. **No generative AI before explicit Play.**
2. **No remote intent/provider work before explicit Play** in the proactive AIC-07 path.
3. Opportunity detection/presentation remains local-first and deterministic.
4. Play authorizes one bounded mission, not blanket Copilot authority.
5. Mission scope cannot expand to another class, UDA, source set or goal without a new preview and a new Play.
6. Existing 15-minute execution-grant TTL remains unchanged.
7. Material context change invalidates the existing preview/grant and requires re-preview/re-authorization.
8. No durable professional write without the existing separate confirmation boundary.
9. No student-personal data may be introduced into opportunity ranking/routing.
10. Existing privacy classification, Contextual Copilot Core authority, remote-consent semantics, AIC-06 budget governance and PREPARE/REVIEW/LINK downstream policy remain stronger gates.
11. Existing mission suspend/resume/archive semantics remain intact.
12. A failed or ambiguous pre-Play interpretation must abstain or ask the teacher; it must never guess a professional target.

The earlier AGENT-INTENT-01 architecture remains valid for governed conversational interpretation where permitted, but AIC-07's later rule is stronger for this pre-Play proactive/mission surface: no remote interpretation is introduced before Play by this repair.

## 5. Teacher-first surface architecture

### 5.1 One Copilot surface, one open-state owner

Today `CopilotDeck` and `LibraryCopilotComposer` have separate presentation/open-state behavior. This contributes to duplicate/floating controls.

The repair introduces one controlled Copilot experience state owned above the two presentational views:

```ts
type CopilotSurfaceState =
  | { mode: 'closed' }
  | { mode: 'home' }
  | { mode: 'compose'; draft?: TeacherCopilotDraftV1 };
```

The exact type/file may differ during implementation, but the ownership rule is fixed:

- only one Copilot surface is open at a time;
- the floating Copilot trigger is hidden while any Copilot surface is open;
- switching from proactive home to conversation changes mode rather than opening a second independent overlay;
- closing returns to the underlying product without leaving duplicate controls behind.

### 5.2 Copilot home: useful when there is something, compact when there is not

Active/suspended/ready missions keep priority and remain visible.

For proactive opportunities:

- render only groups that contain an actual opportunity;
- do not render three dashed empty boxes;
- if no strong opportunity exists, show one compact neutral state:

> Non vedo qualcosa di urgente adesso. Dimmi cosa vuoi preparare o controllare.

Primary CTA:

`Chiedi al Copilota`

This state must fit comfortably above the mobile safe area without consuming most of the screen.

### 5.3 Conversation entry: goal first

The first interactive question becomes:

**`Che cosa vuoi ottenere?`**

Offer a small set of teacher-language quick starts, plus free text. Free text is always available.

The source picker, source capture controls and professional-memory panel are not shown in the first viewport by default.

A teacher entering:

`Attività per le classi prime`

must not receive an internal routing error.

Before Play, deterministic/local logic may extract only safe, inspectable signals from known product state — for example exact class names, grade-level references that match the teacher's own class list, and selected quick-start action. Low-confidence interpretation never authorizes anything.

### 5.4 Context is resolved as a teacher choice, not an error

The header must not stop at a passive `Nessuna classe selezionata` label.

If a required context is missing, the surface asks for it in-place.

Example for the current dataset:

> Hai più classi prime. Su quale vuoi lavorare?

Then show the actual known matching classes, for example `1A`, `1C`.

AIC-07 v1 missions are single-class/single-UDA bounded. Therefore a plural reference such as `classi prime` MUST NOT silently create a multi-class mission and MUST NOT arbitrarily choose one class.

For this repair:

- ambiguous multi-class reference -> explicit teacher disambiguation;
- exact current class -> may be presented as the suggested context, but remains visible before Play;
- more than one viable UDA -> teacher chooses;
- one unambiguous relevant UDA may be suggested, but the preview still exposes it;
- no valid target -> teacher-language explanation and no Play.

Multi-class mission authority is explicitly a future capability and is not introduced here.

### 5.5 Material/source becomes progressive disclosure

The Library remains important but stops being the front door.

After goal + context are sufficiently resolved, the surface determines whether the currently supported capability requires a source/material.

When required, ask in teacher language:

**`Da quale materiale vuoi partire?`**

Then reveal:

- relevant/recent Library sources;
- `Scegli dalla Biblioteca`;
- `Aggiungi materiale` -> `Testo/idea`, `Pagina web`, `File/foto`.

Do not show the complete acquisition form until the teacher chooses `Aggiungi materiale`.

No source is auto-selected solely because it has the highest relevance score.

If the requested outcome is understandable but the current product capability still requires a source, say so plainly rather than exposing `NO_INTENT_MATCH` or pretending source-free generation exists.

This repair does **not** introduce a new source-free generation authority or a new transient source schema. That would be a separate capability/design decision.

### 5.6 Internal intent failures become teacher guidance

The following classes of copy are prohibited in the teacher surface:

- `NO_INTENT_MATCH`;
- `INTENT_PORT_UNAVAILABLE`;
- lists of internal supported intent names;
- instructions to reformulate using the product's internal verbs.

Instead:

- missing goal -> ask what the teacher wants to obtain;
- ambiguous goal -> offer one short clarification;
- missing class/UDA -> ask for the professional target;
- source required -> ask for the material;
- understood but unsupported capability -> state the present product limitation in teacher language and offer only genuinely available next steps.

The Core remains fail-closed underneath this presentation.

### 5.7 Preview is the authority boundary

Before Play, show a compact mission card containing at least:

- **Obiettivo** — what the teacher asked for;
- **Per** — class + UDA/lesson binding;
- **Userà** — selected source/materials, if any;
- **Produrrà** — bounded expected output;
- **Non farà** — no durable write / no scope expansion.

Only when required bindings are complete may `▶ Avvia incarico` be enabled.

Play continues to create the existing bounded mission/execution grant. This repair must reuse AIC-07 authorization rather than bypassing it with a new action path.

## 6. Mobile interaction and collision rules

The A4 screenshots expose three mobile-layer defects that are part of the repair, not optional polish.

### 6.1 Hide duplicate Copilot trigger

While `home` or `compose` is open:

- the floating `Copilota` trigger is not rendered;
- there is one close control in the surface header.

### 6.2 Vault controls must not cover Copilot content

Current mobile `VaultControls` renders a fixed `Mai` selector + `Blocca` button near the bottom-right and can overlap the Copilot sheet.

During an open full Copilot surface:

- the auto-lock selector is temporarily removed from the foreground interaction layer;
- direct `Blocca Registro` access MUST remain available in one interaction, either as a compact lock action coordinated with the Copilot surface or an equivalent existing direct control proven by browser qualification;
- closing Copilot restores the normal mobile Vault controls unchanged.

This is presentation coordination only. Auto-lock state and Vault semantics do not change.

### 6.3 Safe-area behavior

At 390x844 and equivalent mobile viewports:

- primary CTA/Play remains reachable above system/browser safe areas;
- no fixed controls obscure actionable content;
- no horizontal overflow;
- the sheet may scroll internally, but the first screen must expose the goal-oriented next step.

## 7. Required teacher journeys

### J1 — No proactive opportunity

1. Teacher opens Copilot from `Classi`.
2. No opportunity is strong enough.
3. One compact empty state is shown — no three empty groups.
4. Teacher chooses `Chiedi al Copilota`.
5. Teacher sees `Che cosa vuoi ottenere?` before Library/source controls.

### J2 — Real A4 phrase

1. Teacher enters `Attività per le classi prime`.
2. No technical intent error is shown.
3. Product recognizes that more than one known first-year class is a possible target using local deterministic product state.
4. It asks the teacher to choose the class rather than guessing.
5. Once the class is chosen, it resolves/asks for the minimum UDA context required by the existing capability.
6. If PREPARE requires a source, material selection is revealed only now.
7. A bounded preview appears.
8. No remote/generative work has run before Play.

### J3 — Existing source-first use still works

1. Teacher opens Copilot from a Library source or UDA/source launch context.
2. Existing source/context is respected and surfaced as already available context.
3. Goal remains the first question, but already-known bindings are not requested again.
4. REVIEW/LINK/PREPARE authority and existing confirmations remain unchanged.

### J4 — Proactive opportunity with Play

1. A valid AIC-07 opportunity exists.
2. `Perché ora`/preview remains available.
3. Teacher presses Play.
4. Existing mission/grant path executes with unchanged scope/TTL/privacy/persistence boundaries.
5. Result remains reopenable/resumable according to AIC-07.

### J5 — Mobile layer integrity

1. Copilot surface opens on 390x844.
2. Floating trigger disappears.
3. Vault controls do not cover Copilot content.
4. Direct lock remains reachable in one interaction.
5. Close restores standard page controls.

## 8. Technical touch points expected

Likely implementation files:

- `src/components/CopilotExperience.tsx` — controlled surface owner/orchestration;
- `src/components/CopilotDeck.tsx` — controlled home view, compact empty state, nonempty groups only;
- `src/components/LibraryCopilotComposer.tsx` — teacher-first staged composition and progressive source disclosure;
- `src/components/VaultControls.tsx` and/or App-level coordination — mobile overlay collision without changing Vault semantics;
- `src/App.tsx` — shared open-state/launch wiring only as necessary;
- a small pure local helper for teacher-draft context/reference resolution if needed;
- browser/security contracts for the new journeys.

The repair should prefer a thin presentation/orchestration layer over changes to `mission.ts`, persistence schemas, privacy classification or Core authority.

## 9. Explicit non-goals

A4-R1 does not:

- implement AIC-08 material transformations;
- create multi-class mission authority;
- add source-free generative preparation if the current governed capability requires a source;
- change the AIC-07 mission schema unless implementation proves a minimal presentational solution impossible and a new design is separately approved;
- change execution-grant TTL;
- change privacy classification or remote-consent rules;
- change professional-memory semantics;
- add autonomous durable writes;
- add web search or external actions;
- redesign the whole Registro;
- change the visual theme beyond what is necessary for clarity, hierarchy and mobile collision repair.

## 10. TDD / qualification contract

Implementation must start from causal RED browser/security contracts, including at minimum:

1. `Attività per le classi prime` does not expose technical intent taxonomy/error.
2. Multiple matching classes produce explicit disambiguation, no arbitrary class choice.
3. No remote intent/provider/generative call occurs before Play in the AIC-07 path.
4. No three empty proactive group placeholders when all groups are empty.
5. Copilot FAB is absent while Copilot surface is open.
6. Mobile Vault controls do not obscure Copilot and direct lock remains reachable.
7. Existing REVIEW/LINK/PREPARE downstream authority tests remain green.
8. Existing AIC-07 7/7 browser contract remains green or is evolved only by an equivalent stronger contract that preserves every authority assertion.
9. Historical browser regressions remain green.
10. UX-QA-01 and UX-QA-02 remain PASS with zero blocking findings.
11. PREDEPLOY exact-head PASS.
12. Browser exact-head PASS on desktop and 390x844.
13. Final independent/self review on the exact candidate.
14. No merge/deploy without separate human decision.

## 11. Exit criteria

A4-R1 can be proposed for integration only when authentic-looking browser evidence demonstrates that a teacher can start from an outcome rather than the product taxonomy, while all AIC-07 authority boundaries remain mechanically enforced.

The decisive human-use question after publication is:

> `Se apro il Copilota e dico quello che voglio fare come lo direi a un collega, il sistema mi porta con pochi passaggi verso un incarico comprensibile e controllabile, senza costringermi a capire come è costruito?`

A4-R1 is a repair of the teacher experience. It is not authorization to expand the Copilot's professional authority.