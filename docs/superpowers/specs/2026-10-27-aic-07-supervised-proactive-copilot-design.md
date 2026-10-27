# AIC-07 — Supervised Proactive Copilot Design

**Status:** DRAFT — product behavior captured from human design review; implementation is not yet authorized by this document  
**Repository baseline:** `main@54f7941492baf8aca952d9f7cf3263fc036d6591` (AIC-06 integrated; post-merge PREDEPLOY #990 SUCCESS)  
**Scope:** `registro-docente`  
**Date:** 2026-10-27

## 1. Intent

AIC-07 turns the existing Contextual Copilot from a primarily reactive assistant into a **supervised proactive companion for the teacher**.

The Copilot should not wait for the teacher to know the right prompt, but it must also not become an autonomous pedagogical authority. It should detect useful opportunities from already-authorized professional context, explain why they matter now, and let the teacher start a bounded piece of work with one explicit **▶ Play** action.

Canonical interaction:

`observe context -> propose opportunity -> explain why now -> preview mission -> ▶ teacher authorizes -> bounded mission executes -> result ready -> professional act requires confirmation`

AIC-07 v1 is deliberately **proactive in detection and presentation, not in AI execution**.

No generative AI work starts without an explicit teacher Play.

## 2. Product problem

The Registro already has important AI foundations:

- contextual intent routing;
- privacy and fail-closed remote boundaries;
- Biblioteca privata and heterogeneous source ingestion;
- Planning/Teaching Context;
- relevance resolution;
- governed PREPARE/REVIEW capabilities;
- professional memory;
- dynamic AI budget governance;
- human confirmation before persistent professional acts.

The remaining usability problem is that these capabilities are still mostly **capabilities the teacher must know to invoke**.

A teacher does not naturally think in operations such as retrieval, summarization, source selection, transformation and generation. The professional goal is more often:

- “prepare my next lesson”;
- “help me continue where this class stopped”;
- “use this material in the UDA”;
- “prepare the registration draft for what I just did”;
- “show me what is worth doing now”.

AIC-07 therefore adds a product layer that translates existing system capabilities into **timely professional opportunities**.

## 3. Prior-art lessons

AIC-07 takes inspiration from mature human-agent collaboration patterns, without copying their UI or widening Registro authority.

### 3.1 Brisk Teaching / Brisk Next

Brisk Next presents personalized resource recommendations based on recent activity and timing, organizes suggestions into Prepare / Engage / Assess, and lets the teacher create a suggested resource or edit its prompt first.

Lesson for Registro:

- recommend outcomes, not low-level AI tools;
- recommendations should be contextual and modifiable before execution;
- the teacher chooses when to create.

Reference:
- https://help.briskteaching.com/hc/en-us/articles/39617557345428-Getting-Started-with-Brisk-Next

### 3.2 Gemini Notebook / NotebookLM Studio

NotebookLM exposes a Studio surface where source-grounded artifacts can be created and viewed, including reports, study guides, mind maps, quizzes and other outputs.

Lesson for Registro:

- expose “what can sensibly be produced from this context”;
- keep creation attached to visible source/context;
- separate available outputs from the conversational surface.

References:
- https://support.google.com/gemininotebook/answer/16206563
- https://support.google.com/gemininotebook/answer/16164461

### 3.3 Microsoft agent feed

Microsoft's agent feed groups agent work into items needing attention and completed work, explicitly treating human-agent work as supervision and prioritization.

Lesson for Registro:

- make agent work inspectable;
- distinguish “needs teacher attention” from “already prepared”;
- maintain a visible work trail rather than hidden autonomous behavior.

Reference:
- https://learn.microsoft.com/power-apps/user/supervise-agents-with-agent-feed

### 3.4 GitHub Copilot agents

GitHub's agentic model lets an agent perform multiple steps against a goal while the human remains responsible for reviewing and approving the result.

Lesson for Registro:

- one human authorization may cover a bounded multistep mission;
- the agent may work autonomously *inside that approved scope*;
- completion does not equal professional acceptance.

References:
- https://docs.github.com/en/copilot/get-started/about-github-copilot
- https://docs.github.com/en/copilot/how-tos/copilot-on-github/use-copilot-agents/review-copilot-output

## 4. Approaches considered

### A. Contextual Palette

The FAB exposes a small list of context-relevant actions. Nothing is prepared or persisted unless the teacher selects one.

**Strengths:** minimal complexity, low risk, easy to explain.  
**Weaknesses:** remains mainly reactive; does not create a durable supervision model.

### B. Supervised Copilot Deck — selected

The Copilot detects opportunities, ranks them, explains them, lets the teacher preview a bounded mission, and starts AI execution only after explicit Play.

A mission can contain several internal AI/retrieval/transformation steps, but cannot expand its own goal. Results are reviewable and persistent professional actions remain human-confirmed.

**Strengths:** useful proactivity without hidden autonomy; aligns with teacher workflow; supports future evolution.  
**Weaknesses:** requires explicit opportunity, mission and preference state models.

### C. Autonomous Teacher Agent

The Copilot continuously performs low-risk work and asks only when teacher authority is required.

**Strengths:** highest automation potential.  
**Weaknesses:** premature for current trust boundary; higher noise, cost and scope-creep risk.

### Decision

AIC-07 v1 adopts **B — Supervised Copilot Deck**.

Autonomous background generation is explicitly deferred. Future versions may widen autonomy only after evidence that the supervised model is trusted and useful.

## 5. Core design principles

### 5.1 Proactive detection, teacher-started AI

Before Play, the system may use deterministic/local already-authorized signals to:

- inspect current surface/context;
- inspect timetable and near-term professional context;
- inspect current UDA/activity state;
- use local relevance results;
- use already-available metadata and durable state;
- rank and present opportunities.

Before Play, AIC-07 v1 must **not**:

- start a remote generative model call;
- generate a new teaching artifact;
- perform an AI transformation;
- persist a new professional decision;
- broaden the current task on its own.

### 5.2 Opportunities, not capability menus

The Deck must not be a catalog such as:

`Quiz / Summarize / Adapt / Generate / Search / Image / Transform`

It should present professional opportunities such as:

- “Prepare the next 2C lesson”;
- “Continue from the activity left open last time”;
- “Use this Biblioteca material in the current UDA”;
- “Prepare a registration draft for the lesson just completed”.

The product question is:

> What is worth doing now?

not:

> What can the AI do?

### 5.3 Every opportunity has a visible, verifiable reason

No opportunity may appear without a concise `whyNow`.

The reason must be derived from the same evidence used for ranking.

Good reasons:

- “The last registered lesson stopped before the concluding activity.”
- “This is the next class in the timetable.”
- “Two Biblioteca materials are highly relevant to the current UDA.”
- “You put this aside earlier and the related class is today.”

Bad reasons:

- “This may be useful.”
- “AI recommends this.”
- persuasive or pedagogically judgmental language unsupported by evidence.

### 5.4 The Copilot offers service, not pedagogical judgment

Preferred voice:

- “I can prepare…”
- “I noticed…”
- “This is ready to review…”

Avoid:

- “You should…”
- “The correct next step is…”
- “Your lesson needs…”

AIC-07 helps with professional preparation and continuity; it does not score the teacher's pedagogy.

## 6. Copilot Deck

The existing contextual FAB becomes the persistent entry point to the Deck.

The Deck is not a second home page or a Control Center. It is a small supervision surface.

### 6.1 Primary groups

#### Qui

Opportunities strongly attached to the current surface, source, UDA, class or lesson.

Examples:

- continue the current UDA;
- connect the currently viewed source;
- prepare something from the current Biblioteca asset.

#### Oggi

Cross-surface opportunities tied to the teacher's current professional day.

Examples:

- next lesson;
- recent unfinished work;
- a recently saved source now relevant to an upcoming class;
- a bounded follow-up after a completed lesson.

#### Più tardi

Opportunities deliberately put aside by the teacher.

This is not a second task manager. A deferred opportunity keeps its context and may be re-ranked when its context becomes timely again.

### 6.2 Visual differentiation

Contextual and transversal opportunities must be distinguishable at a glance using more than color:

- section placement;
- small semantic icon;
- short label (`Qui`, `Oggi`, `Più tardi`);
- typography/hierarchy.

Color alone must not carry meaning.

### 6.3 Density

Default Deck target:

- at most 2–3 strong visible opportunities;
- optional “Altre possibilità” disclosure;
- no long scrolling catalog by default.

The quality of selection matters more than quantity.

## 7. Opportunity model

A canonical v1 opportunity should contain enough information to make ranking and explanation inspectable.

Illustrative contract:

```ts
type CopilotOpportunityScope = 'contextual' | 'today' | 'later';

interface CopilotOpportunityV1 {
  schemaVersion: 1;
  id: string;
  kind: string;
  scope: CopilotOpportunityScope;

  title: string;
  whyNow: string;

  evidence: OpportunityEvidenceV1[];
  contextRef: ProfessionalContextRefV1;

  proposedMission: CopilotMissionPreviewV1;

  rank: {
    contextualRelevance: number;
    temporalUrgency: number;
    continuity: number;
    expectedUtility: number;
    teacherPreference: number;
    noisePenalty: number;
    finalScore: number;
  };

  createdAt: string;
  validUntil?: string;
}
```

The exact score formula is an implementation detail, but `whyNow` must be traceable to `evidence`.

The system must not show an opportunity that lacks qualifying evidence.

## 8. Ranking

AIC-07 v1 ranking combines:

`context relevance + temporal urgency + continuity + expected utility + global teacher preference - noise/fatigue`

### 8.1 Context relevance

How strongly the opportunity matches the currently active class, UDA, lesson, source or professional surface.

### 8.2 Temporal urgency

How close the relevant professional event is, without turning the Copilot into a reminder system.

### 8.3 Continuity

Whether the opportunity helps continue a real thread:

- unfinished lesson/activity;
- current UDA progression;
- recently acquired relevant source;
- recently completed activity needing a draft/follow-up.

### 8.4 Expected utility

A bounded, product-defined estimate of whether the action produces a useful professional artifact or reduces teacher work.

It is not a pedagogical quality score.

### 8.5 Global teacher preference

Behavioral preference learned globally for the teacher, not per class or per UDA.

The preference term may re-rank evidence-backed opportunities. It must not invent opportunities without evidence.

### 8.6 Noise/fatigue

Repeatedly ignored opportunities should lose priority unless the context changes materially.

A high-value contextual trigger may still overcome previous low interest.

## 9. Adjustable proactivity

Add one durable teacher preference:

- `essential` — **Essenziale**;
- `balanced` — **Equilibrato**;
- `present` — **Presente**.

Default: `balanced`.

This setting changes:

- display threshold;
- number/frequency of eligible opportunities;
- willingness to surface lower-urgency but still relevant cross-surface items.

It does **not** change:

- AI execution authority;
- Play requirement;
- privacy policy;
- persistence permissions;
- AIC-06 budget profile.

The axes remain separate:

- **Proattività** = how much the Copilot proposes.
- **Budget IA** = how much remote capacity an authorized mission may use.

## 10. Teacher interaction signals

AIC-07 learns from normal use without requiring explicit star ratings.

Deck-level signals:

- Play;
- put aside;
- ignore;
- remove.

Mission/result-level signals:

- used as-is;
- used with small edits;
- heavily reworked;
- saved to Biblioteca;
- linked to UDA/activity;
- reused later;
- discarded;
- abandoned before completion.

Signals modify global opportunity ranking and future presentation.

They must not be interpreted as pedagogical correctness judgments.

## 11. Preference learning

Preference learning is global for the teacher in v1.

It is not segmented by:

- class;
- section;
- UDA;
- age group;
- individual lesson.

Context-specific relevance still dominates when materially stronger.

### 11.1 Decay

Old behavioral evidence loses weight over time.

### 11.2 Reversibility

Provide a teacher-facing command equivalent to:

**Reimposta preferenze del Copilota**

This clears learned ranking preference only.

It must not delete:

- Biblioteca;
- Professional Memory;
- lesson history;
- UDA;
- registered teaching records.

### 11.3 No silent authority escalation

Preference learning may change what appears first.

It may never change what the Copilot is allowed to execute without Play or what requires professional confirmation.

## 12. Mission preview

Every AI-executing opportunity requires a preview before the first Play.

The preview is the human-readable projection of the exact mission contract to be authorized.

Minimum visible content:

- **Obiettivo** — what the Copilot will accomplish;
- **Contesto** — class/UDA/lesson/activity;
- **Userà** — relevant sources/context/memory;
- **Produrrà** — expected outputs;
- **Non farà** — important authority boundaries.

Example:

> **Prepara la prossima lezione — 2C**  
> Riprende dall'attività sul ciclo integrato.  
> Userà: UDA attiva, ultima lezione registrata, 2 materiali pertinenti della Biblioteca.  
> Produrrà: scaletta della lezione + scheda operativa breve.  
> Non registrerà né modificherà dati professionali senza conferma.  
> **▶ Avvia incarico**

The preview may expose a small `Modifica` affordance for bounded inputs such as duration, output shape or selected materials.

It must not become a complex form.

## 13. Mission contract

Play authorizes a **bounded mission**, not merely one model call.

Illustrative model:

```ts
interface CopilotMissionV1 {
  schemaVersion: 1;
  id: string;

  goal: string;
  contextRef: ProfessionalContextRefV1;
  sourceRefs: string[];
  allowedCapabilities: string[];

  expectedOutputs: MissionOutputSpecV1[];

  authority: {
    aiExecutionAuthorized: true;
    persistentProfessionalWrite: false;
    externalAction: false;
    scopeExpansion: false;
  };

  budgetProfile: AiBudgetProfile;
  createdAt: string;
  contextFingerprint: string;
  semanticExpiry: MissionExpiryV1;

  status:
    | 'authorized'
    | 'running'
    | 'suspended'
    | 'ready'
    | 'archived';
}
```

The exact type names may change during implementation; the semantic invariants may not.

## 14. Mission execution

After Play, the Copilot may autonomously perform multiple internal steps necessary to satisfy the approved goal.

Example mission: **Prepare the next 2C lesson**

Permitted internal work may include:

- reconstruct current teaching context;
- retrieve relevant Biblioteca sources;
- select relevant professional-memory summaries;
- compare last lesson state with current UDA;
- generate a lesson sequence;
- generate a requested worksheet;
- produce a final bundle for review.

The teacher should not be asked to authorize every internal step.

### 14.1 No scope expansion

A mission cannot expand its own goal.

If work on 2C reveals something useful for 2A, the Copilot may create a *new opportunity*:

> This material may also be useful for 2A.  
> ▶ Preview

It may not start work for 2A under the 2C mission.

### 14.2 AIC-06 remains authoritative

Each remote step remains subject to the integrated AIC-06 governor.

Mission Play is not a permanent budget escalation.

Any AIC-06 escalation remains separately governed by its existing temporary authorization semantics.

## 15. Professional authority boundary

AIC-07 distinguishes:

### 15.1 AI execution authorization

Play means:

> Do this bounded preparation work for me.

This can authorize multi-step analysis/generation inside the mission.

### 15.2 Professional confirmation

A separate human confirmation is required before actions such as:

- registering a lesson as completed;
- persistently changing a professional record;
- changing assessment/grade state;
- publishing or sending externally;
- deleting durable professional data;
- other materially consequential writes.

Generated artifacts that are merely previewed do not require another confirmation to exist as transient mission output.

Adopting them into durable professional state uses the existing governed persistence boundaries.

## 16. Put aside / ignore semantics

Each opportunity supports:

- **▶ Preview / Start**
- **Metti da parte**
- **Ignora** or equivalent dismiss action

### 16.1 Put aside

Meaning:

> This makes sense, but not now.

The opportunity keeps its context and moves to `Più tardi`.

Putting aside does not authorize AI work.

### 16.2 Ignore

Meaning:

> Do not prioritize this now.

Repeated ignores reduce future priority for that family of opportunity unless context changes materially.

Ignore is not a permanent ban.

## 17. Mission persistence and resumption

AIC-07 does not use browser “session length” as the professional lifetime of a mission.

A mission has three distinct persistence layers:

### 17.1 Durable mission identity

Persist:

- goal;
- professional context reference;
- selected source references;
- expected outputs;
- completed durable-safe intermediate artifacts/receipts;
- current state.

### 17.2 Work state

Persist enough verified state to resume useful work rather than restart from zero.

Do not persist hidden model chain-of-thought or provider-internal reasoning.

### 17.3 AI execution authorization

Do **not** treat a previous Play as indefinite authority.

Execution authorization expires or becomes suspended.

Canonical principle:

> Missions survive the interface; AI execution authorization does not.

## 18. Mission lifecycle

### Proposed

An opportunity exists. No AI generation has started.

### Authorized / Running

Teacher has reviewed the mission preview and pressed Play.

### Suspended

The mission identity and completed work remain available, but new AI processing requires Play again.

If professional context is materially unchanged, the Deck shows a lightweight resume card:

> **Preparazione lezione 2C — sospesa**  
> Contesto invariato · 2 passaggi completati · 1 restante  
> **▶ Riprendi**

No full preview is repeated.

### Ready

The bounded mission is complete and waiting for teacher review.

### Archived

The mission is no longer active but may remain available for traceability according to normal retention rules.

## 19. Context fingerprint and semantic expiry

Mission validity is based primarily on **context validity**, not an arbitrary browser-session timeout.

Capture a context fingerprint over the professional inputs that materially define the mission.

Examples:

- class/UDA/lesson identity;
- accepted Planning/Teaching Context;
- relevant last-lesson state;
- selected source revisions;
- mission-defining durable settings.

When resuming:

### Context unchanged

Show only concise status and **▶ Riprendi**.

### Context materially changed

Do not silently continue.

Show:

> **Il contesto è cambiato da quando hai iniziato.**  
> Rivedi l'anteprima prima di continuare.

The teacher reviews the updated mission contract and authorizes again.

## 20. Explainability and provenance

The following chain must be auditable:

`opportunity -> evidence -> rank factors -> displayed whyNow -> preview -> Play -> mission -> outputs -> outcome signal`

Do not use a generative model to fabricate a reason after ranking.

The displayed reason is a product projection of real evidence.

Normal UI should stay concise; deeper provenance may be available through progressive disclosure.

## 21. Local-first opportunity detection

AIC-07 should reuse existing local/deterministic infrastructure wherever possible.

Candidate inputs include:

- current route/surface;
- current selected class/UDA/lesson;
- timetable projection;
- last registered lesson/activity;
- Planning/Teaching Context;
- Biblioteca metadata;
- relevance resolver output;
- Professional Memory eligibility metadata;
- recent mission outcomes/preferences.

The opportunity resolver must not create a second semantic-retrieval stack.

The previously qualified relevance-resolver contract should be reused where applicable, including its binding between Planning Context and concrete teaching context.

## 22. Privacy

Opportunity detection should use the minimum professional data required.

AIC-07 v1 must not:

- introduce student-personal data into opportunity ranking;
- remotely send data merely to decide whether an opportunity should be shown;
- bypass existing privacy classification;
- widen Professional Memory eligibility;
- log source contents solely for ranking;
- use preference learning to infer sensitive personal traits.

Remote processing remains downstream of Play and all existing privacy gates.

## 23. Failure semantics

### Opportunity resolver unavailable

Fail quiet. Do not block normal Registro work.

The FAB/Deck remains usable for existing explicit Copilot entry points.

### Stale opportunity

Do not execute from stale context. Refresh or suppress it.

### Mission cannot continue

Preserve safe completed state and mark the mission suspended or failed with a teacher-language reason.

### Provider unavailable / budget denied

Reuse existing Copilot/AIC-06 failure semantics. Do not reinterpret failure as teacher rejection.

### Preference store unavailable

Fall back to base ranking for the selected proactivity profile.

## 24. Non-goals for AIC-07 v1

AIC-07 v1 does not:

- run generative AI autonomously in the background before Play;
- act as a general reminder/task-management system;
- make pedagogical judgments about teacher quality;
- autonomously publish/send/register professional acts;
- create student-level proactive recommendations;
- create a second Copilot;
- create a second Biblioteca/retrieval/relevance stack;
- change AIC-06 budget semantics;
- implement the full AIC-08 transformation catalog;
- implement AIC-09 assessment generation/decision flows;
- infer per-class behavioral personalities.

## 25. UX examples

### 25.1 Before a lesson

**Oggi**

> **Prepara la prossima lezione — 2C**  
> Perché: è la prossima classe in orario e l'ultima attività si è fermata prima della conclusione.  
> ▶ Anteprima

Preview:

> Userà UDA attiva + ultima lezione + 2 fonti Biblioteca pertinenti.  
> Produrrà scaletta + scheda breve.  
> Non registrerà dati senza conferma.  
> ▶ Avvia incarico

### 25.2 Current Biblioteca source

**Qui**

> **Usa questo materiale nell'UDA Agricoltura**  
> Perché: il relevance resolver lo collega con alta pertinenza all'attività corrente.  
> ▶ Anteprima

### 25.3 After a lesson

**Qui**

> **Prepara la bozza per il registro**  
> Perché: la lezione della 2C si è appena conclusa.  
> ▶ Anteprima

The mission may prepare the text, but the durable registration requires explicit professional confirmation.

### 25.4 Put aside

> **Prepara una scheda sul ciclo integrato**  
> Metti da parte

Later:

**Più tardi**

> **Scheda sul ciclo integrato — 2C**  
> Perché: l'avevi messa da parte e la classe è prevista oggi.  
> ▶ Anteprima

### 25.5 Resume

> **Preparazione 2C — sospesa**  
> Contesto invariato · parte del lavoro già pronta.  
> ▶ Riprendi

## 26. Acceptance invariants

AIC-07 v1 is not qualified unless evidence proves at least:

1. no AI generation starts before explicit Play;
2. every visible opportunity has real qualifying evidence and visible `whyNow`;
3. ranking reason and displayed reason are derived from the same evidence;
4. contextual and cross-surface opportunities are visually distinguishable without color alone;
5. Deck density remains bounded;
6. preview appears before first Play for every AI-executing opportunity;
7. executed mission scope is a subset of the previewed/authorized mission contract;
8. one Play may authorize multiple internal steps inside the approved mission;
9. mission cannot autonomously expand to another class/UDA/goal;
10. persistent professional writes still require explicit teacher confirmation;
11. put-aside does not start AI work;
12. ignore/put-aside/play/outcome signals affect ranking but not authority;
13. proactivity profile and AIC-06 budget profile are independent;
14. learned preference is global for the teacher in v1;
15. preference learning is resettable independently of Biblioteca/Memory/Registro data;
16. mission can survive UI/device interruption without preserving indefinite AI authority;
17. unchanged context resumes with one Play and no redundant full preview;
18. materially changed context forces updated preview/re-authorization;
19. no student-personal data is introduced into opportunity ranking;
20. resolver/provider failures do not block ordinary Registro work.

## 27. Qualification strategy

Implementation planning should divide AIC-07 into independently provable slices rather than one large UI change.

Expected qualification areas:

- pure opportunity/evidence/ranking contracts;
- global preference learning and reset;
- mission preview/contract generation;
- mission authorization and no-scope-expansion enforcement;
- mission persistence/resume/context-fingerprint behavior;
- Deck UX desktop/mobile/accessibility;
- authority/privacy regressions;
- integration with AIC-06;
- exact-SHA browser qualification;
- fresh whole-slice independent review.

A design-only PR must not merge product code, trigger deployment or claim product qualification.

## 28. Human decisions captured on 2026-10-27

The following are explicit product decisions from the design conversation:

1. AIC-07 v1 does not start AI work autonomously; every AI elaboration begins from teacher Play.
2. Play may authorize a small complete mission, not only an atomic action/model call.
3. Every first mission execution requires a visible preview.
4. The Deck includes both contextual and cross-surface/day opportunities.
5. Contextual and transversal opportunities must be distinguishable quickly by eye.
6. Opportunities may be put aside for later.
7. Every opportunity always shows a concise, verifiable reason.
8. Teacher can regulate proactivity.
9. Future ranking is progressively personalized.
10. Learning uses both Deck interactions and mission-result usefulness.
11. Preference learning is global for the teacher in v1.
12. Missions use balanced persistence: mission/work can survive interruption; execution authority does not remain indefinitely active.
13. A suspended mission with unchanged material context resumes through a single **▶ Riprendi** without repeating the full preview.

## 29. Open implementation calls

These are intentionally left to implementation planning unless evidence shows they change product behavior:

- exact numeric ranking weights and thresholds;
- exact decay curve for preference signals;
- exact mission authorization TTL, provided semantic expiry/context validation remains authoritative;
- exact component names and storage record names;
- exact copy for secondary labels and empty states;
- whether `Più tardi` is a section or a compact disclosure on very small mobile screens.

None of these calls may weaken the human decisions or invariants above.

## 30. Canonical product statement

> The Copilot does not wait for the teacher to know the right prompt. It detects evidence-backed opportunities, explains why they matter now, and waits for the teacher to authorize a bounded mission. Once authorized, it can complete the mission autonomously within scope; professional decisions and durable consequential actions remain with the teacher.
