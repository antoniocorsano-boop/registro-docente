# UX-GOV-01 Transition Roadmap

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement each implementation line task-by-task. This roadmap is a governance-level decomposition: each implementation line MUST receive its own detailed design and implementation plan before product code changes.

**Goal:** Evolve Registro Docente from a surface-oriented application into a task-first, context-preserving teacher workspace built around `Prepara → Conduci → Registra → Rivedi` without rewriting mature specialist workspaces.

**Architecture:** Add a thin orchestration layer above existing specialist surfaces. Establish one canonical Professional Context, use `Oggi` as the task router, then progressively connect preparation, lesson execution, recording, review, professional-memory reuse and mobile installability. Existing Class Dashboard, UDA, Biblioteca, Verifiche, Privacy and Copilota remain authoritative specialist implementations.

**Tech Stack:** React, TypeScript, existing local persistence/Secure Local Vault, Contextual Copilot, Local Semantic Memory, Bun test/qualification framework, Playwright browser qualification, Android/Termux local runtime.

**Spec:** `docs/ux/UX-GOV-01-registro-docente-user-flow-baseline-v1.md`

## Global Constraints

- No monolithic rewrite.
- No duplicate forms/business logic in `Oggi` or orchestration surfaces.
- Neutral secure re-entry after unlock/reload remains authoritative.
- Professional Context must fail closed on ambiguity; no arbitrary class/UDA/lesson selection.
- Student-personal data must not enter professional-memory or Copilota contexts.
- AI/Copilota authority remains explicit; no execution merely from inferred intent.
- Local Semantic Memory remains local and professionally scoped.
- Every implementation line uses RED → GREEN, exact-SHA qualification, independent review and Human Product Review where UI changes.
- Mobile is a first-class qualification surface, not a later adaptation.

## Review Focus

- Context continuity must not accidentally become context persistence across secure boundaries.
- Oggi must route to existing capabilities rather than duplicate them.
- Ambiguous multi-class/multi-UDA situations must ask or remain neutral.
- Specialist users must retain direct access to expert surfaces.
- AI/memory convenience must not weaken privacy or teacher authority.

---

## Delivery strategy

This roadmap is intentionally split into independently reviewable implementation lines. Do **not** execute all phases on one branch.

Recommended order:

`CTX-01 → TODAY-01 → FLOW-01 → FLOW-02 → FLOW-03 → FLOW-04 → INT-01 → INT-02 → LSM-02 → MOBILE-01 → UX-QA-03`

The first six lines establish the new user model. Integration, memory and mobile work follow only after the core model is stable.

---

## Phase 0 — UX-GOV-01 Baseline

**Status:** documentation/governance only.

**Deliverables:**
- canonical UX baseline;
- current/target visual reference;
- future-flow visual reference;
- roadmap;
- baseline product SHA;
- update triggers and canonical journeys.

**Exit:** Human approval of baseline and roadmap; no product behaviour change.

---

## Phase 1 — CTX-01 Unified Professional Context

### Objective
Create one canonical, inspectable context model shared by Home/Oggi, Class, UDA, Biblioteca and Copilota.

### Intended responsibilities
- represent class, UDA, lesson/activity, source, goal, time and privacy scope;
- reconcile current local and accepted planning context;
- distinguish `known`, `ambiguous`, `not-applicable` and `missing` states;
- provide safe handoff descriptors between surfaces;
- never persist student-personal context into professional-memory context.

### Non-goals
- no new Home UI;
- no new forms;
- no AI behaviour change;
- no replacement of existing domain models.

### Acceptance
- deterministic pure resolver tests;
- ambiguous multi-target cases fail closed;
- existing Copilota context projection consumes the canonical context without behaviour regression;
- no secure-start regression;
- browser regression proves navigation can carry safe context without automatic sensitive restoration.

### Required follow-up artifact
Create a dedicated CTX-01 design and implementation plan before coding.

---

## Phase 2 — TODAY-01 Home `Oggi`

### Objective
Turn the default post-unlock Home into a professional task router.

### Primary UI
Four actions:
- `Prepara`
- `Conduci`
- `Registra`
- `Rivedi`

### Behaviour
- show only high-value continuity cues;
- route into existing specialist surfaces with known context;
- ask only when context is genuinely ambiguous;
- retain existing direct access to `Classi`, `Sintesi`, `Confronto` or equivalent expert entry points.

### Anti-goal
Do not create a mega-dashboard or copy Class Dashboard metrics into Home.

### Acceptance
- top four common journeys start in 1–2 meaningful decisions;
- no specialist business logic duplicated;
- neutral secure start remains intact;
- mobile 390×844 is a primary qualification viewport;
- Human Product Review required.

---

## Phase 3A — FLOW-01 `Prepara`

### Objective
Provide one coherent preparation entry point across Programmazione, UDA, Biblioteca, Verifiche and Copilota.

### Target journey
`Oggi → Prepara → context → choose preparation type → specialist workspace → prepared outcome → context retained`.

### Acceptance
- Programmazione is presented as stable frame;
- UDA as implementation frame;
- activity/lesson as operational frame;
- Biblioteca source can enter the flow without repeating class/UDA when already known;
- Copilota receives explicit known context;
- no automatic UDA/activity creation.

### Human review
Teacher must be able to start preparing the next lesson from Oggi without understanding which internal workspace owns each step.

---

## Phase 3B — FLOW-02 `Conduci`

### Objective
Create a compact in-lesson surface optimized for mobile use.

### Target surface
- current class/activity;
- objective;
- linked materials;
- planned task/verification;
- rapid notes/observations;
- Privacy Shield;
- optional contextual Copilota.

### Constraints
- no dense administration during class;
- no automatic professional writes;
- no student-personal data to professional-memory contexts;
- evidence can remain staged until Registra.

### Acceptance
- mobile one-hand critical actions;
- clear boundary between temporary lesson notes and durable record;
- teacher can end/continue lesson into Registra without reselecting context.

---

## Phase 3C — FLOW-03 `Registra`

### Objective
Route lesson outcomes into authoritative existing recording surfaces.

### Target journey
`Conduci/Oggi → Registra → same context → evidence type → authoritative specialist form → durable save → confirmation`.

### Routed destinations
- Valutazioni;
- Comportamento;
- online-test outcomes;
- professional notes/observations;
- lesson/activity completion;
- UDA progress.

### Acceptance
- no duplicate evaluation/behaviour forms;
- context preselection does not remove teacher review;
- writes remain durable Promise-backed mutations;
- failure does not lose staged data;
- after save, Rivedi is offered as continuation rather than forced navigation.

---

## Phase 3D — FLOW-04 `Rivedi`

### Objective
Turn analysis into a decision-and-continuation loop.

### Target journey
`Oggi/Registra → Rivedi → scope → analysis → professional decision → Prepara next step`.

### Routed destinations
- Tabellone;
- Analytics;
- Storico;
- Scheda alunno;
- UDA progress/analysis;
- reports/synthesis.

### Acceptance
- teacher can move from evidence to next action without manually reconstructing context;
- student-specific review remains inside the class privacy boundary;
- no automatic recommendation becomes a professional decision without teacher action.

---

## Phase 4A — INT-01 Programmazione ↔ UDA ↔ Lesson Continuity

### Objective
Make the hierarchy visible and traversable:

`Programmazione (stable frame) → UDA (implementation) → lesson/activity (operation)`.

### Acceptance
- no forced data-model merge merely for UX;
- each level remains independently editable where currently supported;
- accepted planning/curricular context is visible from UDA when relevant;
- navigation preserves class/UDA context;
- gaps or missing mappings are shown explicitly instead of guessed.

---

## Phase 4B — INT-02 Biblioteca / Verifiche / Copilota Integration

### Objective
Make sources and assessments participate naturally in the teaching cycle.

### Biblioteca
- capture once;
- classify once when safe;
- link/reuse across appropriate contexts;
- retrieve textually or semantically;
- hand off to Copilota without re-entering known context.

### Verifiche
- Prepara: create/import/adapt;
- Conduci: administer;
- Registra: import outcomes;
- Rivedi: analyse and act.

### Copilota
- context-aware opportunities;
- explicit preview;
- explicit Play;
- review before adoption.

### Acceptance
- no parallel source/assessment context models;
- no hidden mutation from retrieval/linking;
- context fingerprint remains stable and inspectable.

---

## Phase 5 — LSM-02 Transparent Local Memory

### Objective
Preserve explicit activation while eliminating infrastructure mechanics from ordinary UX.

### Target behaviour
`Attiva memoria locale` should be enough for the application to request/ensure the local memory runtime and acquire an ephemeral capability.

### Keep explicit
- teacher authority to activate;
- professional-only scope;
- sync status;
- rebuild/reconciliation conditions;
- session expiry/revocation.

### Hide from ordinary UX
- ports;
- runit;
- Termux commands;
- embedding process details;
- session tokens.

### Acceptance
- activation from app succeeds when device prerequisites are installed;
- failure copy describes the user-actionable state, not infrastructure jargon;
- reload/expiry revokes capability;
- semantic retrieval safely falls back to ordinary local search;
- student data remains excluded by contract and test.

---

## Phase 6 — MOBILE-01 Installable Local App Shell

### Objective
Complete the everyday Android experience.

### Target
`power on → tap Registro Docente icon → secure unlock → Oggi`.

### Scope
- manifest/name/icons;
- installable PWA/standalone shell;
- service worker/offline policy appropriate to local runtime;
- deep links/query-state compatible with secure neutral-start rules;
- cold-start readiness;
- mobile touch/accessibility qualification.

### Acceptance
- no need to open Chrome manually or interact with Termux in daily use;
- application opens standalone with its own identity;
- local server cold-start remains supervised;
- failure states are recoverable and understandable;
- no stale sensitive page is exposed before vault unlock.

---

## Phase 7 — UX-QA-03 Whole-product qualification

### Objective
Qualify the target user model against the canonical journeys in UX-GOV-01.

### Required journeys
- J1 Start the day.
- J2 Prepare a lesson.
- J3 Conduct and record.
- J4 Review and continue.
- J5 Reuse professional material.
- J6 Assessment lifecycle.
- J7 Local memory activation/use/expiry.
- J8 Privacy-sensitive class use.

### Evidence
- desktop and mobile browser evidence;
- Android local-runtime evidence where applicable;
- Human Product Review;
- accessibility/touch review;
- exact-SHA manifest;
- comparison against UX-GOV-01 v1.

### Exit
If the product materially changes the canonical user model, publish UX-GOV-01 v2 rather than silently drifting from v1.

---

## Governance checkpoints

At the end of every phase:

1. Verify the implementation still matches UX-GOV-01.
2. Record which canonical journeys changed.
3. Run exact-SHA qualification.
4. Complete Human Product Review for visible UX changes.
5. Update visual references only if the canonical flow changed.
6. Do not merge a phase that requires a future phase merely to restore a previously working journey.

---

## Definition of the achieved target

The roadmap is complete when a teacher can:

1. start the local application from its icon;
2. unlock safely;
3. understand what is relevant today;
4. prepare, conduct, record and review without repeatedly reselecting context;
5. enter expert workspaces when needed without losing context;
6. reuse professional material and semantic memory without technical setup knowledge;
7. use Copilota with explicit authority and inspectable context;
8. keep student data protected across all transitions;
9. continue the cycle from review back to preparation.

The desired product is not a collection of better screens. It is a **continuous professional workflow with specialist depth available on demand**.
