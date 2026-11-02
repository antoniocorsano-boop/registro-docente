# UX-GOV-01 — Registro Docente User Flow Baseline v1

**Status:** PROPOSED CANONICAL UX GOVERNANCE BASELINE  
**Date:** 2026-11-02  
**Product:** Registro Docente / TRAMA  
**Baseline product SHA:** `f332d63a9e26df41072f9b726142e612d408e7d0`  
**Scope:** information architecture, user flows, contextual continuity, mobile/local experience, Copilota, Biblioteca, UDA, Valutazioni, Verifiche, Privacy, Local Semantic Memory  

---

## 1. Purpose

This document defines the canonical product/UX reference for the evolution of Registro Docente from the current surface-oriented application into a coherent teacher-work environment.

The product must not force the teacher to understand its internal architecture. The teacher chooses the work to perform; the application maintains the professional context and presents the appropriate tools at the right moment.

### Guiding principle

> **Il docente sceglie il lavoro da svolgere; l'app mantiene il contesto. Gli strumenti specialistici compaiono soltanto quando servono.**

The visual reference diagrams are companions to this document. If a visual and this document diverge, **this document is normative**.

---

## 2. Product intent

Registro Docente must become a **local-first, secure, contextual teaching workspace** that follows the real professional cycle of a teacher:

**Prepara → Conduci → Registra → Rivedi → Riusa**

The application already contains mature specialist capabilities. The target is not a rewrite and not a reduction of functionality. The target is orchestration.

The future product must:

- preserve the secure local vault and neutral re-entry after unlock/reload;
- keep Class Dashboard, UDA workspace, Biblioteca, Verifiche, Privacy and analytical tools as specialist workspaces;
- make the teacher's daily work the primary navigation model;
- maintain context across surfaces instead of repeatedly asking the teacher to reselect class/UDA/source/activity;
- keep Copilota transversal and explicitly governed;
- keep Local Semantic Memory explicit in authority but invisible in technical mechanics;
- remain mobile-first and usable from the local Android runtime without requiring daily interaction with Termux;
- preserve privacy boundaries and never infer or propagate student-personal data into professional-memory flows.

---

## 3. Current product model — what must be preserved

The current application is composed of four overlapping systems.

### 3.1 Secure access and local data

- Secure Local Vault.
- First-use setup, migration, unlock and auto-lock.
- No plaintext fallback.
- Neutral context after reopening: no class or student context is silently restored.

### 3.2 Class work

- Home / Le mie classi.
- Class Dashboard.
- Valutazioni.
- Comportamento.
- Tabellone.
- Analisi.
- Storico prove.
- Scheda alunno.
- Gestione alunni.

This is already the strongest operational core and must remain recognisable.

### 3.3 Planning and resources

- Programmazione didattica.
- UDA workspace.
- Biblioteca privata.
- Verifiche online.

These surfaces are valuable but currently appear too much like parallel applications.

### 3.4 Transversal services

- Copilota contestuale.
- Memoria semantica locale.
- Privacy Shield.
- Backup cifrato.
- Impostazioni.

These must remain transversal, not become additional navigation silos.

---

## 4. Target architecture — three stable levels

### Level 1 — Teacher work

The teacher sees four primary actions:

1. **Prepara** — organize and design what comes next.
2. **Conduci** — run the current lesson/activity.
3. **Registra** — record professional evidence and outcomes.
4. **Rivedi** — analyse, compare, improve and continue.

`Riusa` is not a fifth top-level tab: it is a recurring outcome enabled especially by Biblioteca, Copilota and Memoria locale.

### Level 2 — Professional context

The application maintains a coherent, inspectable context:

- `classId / className`
- `udaId`
- `lessonId / activityId` when available
- `sourceId` when the teacher is working from a material
- `goal / professional intent`
- `time context` (today, upcoming, past)
- `privacy context`
- accepted planning/curriculum profile when relevant

The context is explicit and reversible. It must never make arbitrary choices when multiple equally plausible targets exist.

### Level 3 — Specialist tools

Specialist workspaces remain available:

- Registro / Class Dashboard
- Programmazione
- UDA
- Biblioteca
- Verifiche
- Analisi
- Copilota
- Memoria locale
- Privacy / Backup
- Impostazioni

The primary flow selects the work; context selects the relevant subset; tools perform the operation.

---

## 5. Canonical future user flows

## 5.1 App start and secure access

```text
Tap Registro Docente
→ local server already available
→ Secure Local Vault check
   ├─ first use → configure protected archive
   ├─ migration → protect existing data
   ├─ locked → enter local password
   └─ ready → continue
→ Home — Oggi
```

**Invariant:** after unlock/reload the application may recover non-sensitive temporal state but must not silently restore a student-sensitive context. The Home starts professionally neutral and shows only safe, high-level continuity cues.

---

## 5.2 Home — Oggi

`Oggi` becomes the **work router**, not another container of duplicated functionality.

It answers:

- What am I likely to need now?
- Which class/context is current or next?
- What remains incomplete?
- What can I continue from earlier?

Primary actions:

```text
Oggi
├─ Prepara
├─ Conduci
├─ Registra
└─ Rivedi
```

Secondary continuity elements may include:

- next known class/lesson;
- professional work left incomplete;
- UDA/activity currently in progress;
- material recently linked to the active context;
- pending review or evaluation work;
- Copilota opportunity, only when relevant.

**Anti-goal:** `Oggi` must not become a dashboard containing every metric and every feature.

---

## 5.3 Prepara

Teacher intent: *I need to prepare what I am going to do.*

```text
Oggi
→ Prepara
→ choose/confirm context only if not already known
   ├─ class
   ├─ UDA/activity
   └─ goal
→ choose the kind of preparation
   ├─ Programmazione / curricular frame
   ├─ UDA / activity planning
   ├─ Material / Biblioteca
   ├─ Verification / assessment preparation
   └─ Copilota support
→ produce/review material
→ keep result linked to the same context
→ ready for Conduci
```

### Expected behaviour

- Programmazione provides the stable professional/curricular frame.
- UDA is the implementation layer of that frame.
- Lesson/activity is the operational unit.
- Biblioteca supplies reusable professional sources.
- Copilota receives the already-known context; it must not ask the teacher to repeat class, UDA and source unless the context is ambiguous.

---

## 5.4 Conduci

Teacher intent: *I am in the lesson/activity now.*

```text
Oggi
→ Conduci
→ active class/activity context
→ compact lesson surface
   ├─ objective / what we are doing
   ├─ material to show/use
   ├─ verification or task if planned
   ├─ rapid notes/observations
   └─ contextual Copilota when requested
→ end/continue lesson
→ handoff to Registra
```

### Design constraints

- Mobile-first, one-hand operation where possible.
- No dense administrative panels during the lesson.
- Privacy Shield must be immediately accessible.
- Student-personal data must remain outside professional memory and AI contexts.
- The surface should allow a teacher to defer detailed recording until after the lesson without losing professional continuity.

---

## 5.5 Registra

Teacher intent: *I need to make the professional record durable.*

```text
Conduci or Oggi
→ Registra
→ same class/activity context retained
→ choose evidence
   ├─ Valutazioni
   ├─ Comportamento
   ├─ Esiti verifica online
   ├─ Note / osservazioni
   ├─ lesson/activity completion
   └─ UDA progress
→ review staged changes
→ durable save
→ confirmation
→ optional handoff to Rivedi
```

### Important rule

The existing Class Dashboard and its Valutazioni/Comportamento workflows remain authoritative specialist surfaces. `Registra` routes into them with context preselected; it does not clone their forms.

---

## 5.6 Rivedi

Teacher intent: *I need to understand what happened and decide what comes next.*

```text
Oggi / Registra
→ Rivedi
→ scope
   ├─ class
   ├─ student
   ├─ UDA
   ├─ assessment
   └─ time period
→ analysis
   ├─ Tabellone
   ├─ trends
   ├─ Storico
   ├─ Scheda alunno
   ├─ UDA progress/gaps
   └─ synthesis/report
→ decision
   ├─ continue
   ├─ adapt next activity
   ├─ prepare recovery/enrichment
   └─ reuse material
→ Prepara
```

This closes the professional loop rather than treating analysis as an endpoint.

---

## 5.7 Biblioteca and reuse flow

Biblioteca becomes the **professional memory and reuse workspace** rather than merely a file repository.

```text
Capture
   ├─ photo/file
   ├─ URL
   └─ text/concept
→ classify privacy/professional status
→ save source
→ link to class/UDA/activity when appropriate
→ use now OR keep for later
→ textual / semantic retrieval
→ open in current context
→ use directly OR ask Copilota
→ result remains linked to context
```

### Reuse rule

A source may be reused across contexts, but linking or retrieving a source must never automatically mutate an UDA, lesson or class record.

---

## 5.8 Verifiche flow

The existing specialist surface remains, but user entry points are distributed through the teaching cycle.

```text
Prepara
→ create/import/adapt verification
→ associate class/UDA

Conduci
→ administer / student portal

Registra
→ import outcomes into Registro

Rivedi
→ analyse results
→ decide recovery/enrichment
→ Prepara next step
```

The `Verifiche` workspace remains available for expert use with Bacheca / Editor / Stampa / Analisi.

---

## 5.9 Copilota flow

Copilota remains transversal.

```text
Any relevant teacher surface
→ context projection built from current professional context
→ opportunity
   ├─ Qui
   ├─ Oggi
   └─ Più tardi
→ Anteprima
   ├─ Obiettivo
   ├─ Contesto
   ├─ Userà
   ├─ Produrrà
   └─ Non farà
→ explicit teacher Play
→ governed mission
→ review result
→ adopt / adapt / leave
```

**Invariant:** AI execution starts only after explicit teacher action. Copilota does not acquire authority merely because it can infer a likely intent.

---

## 5.10 Local Semantic Memory flow

Target experience:

```text
Teacher requests semantic-memory capability
→ Attiva memoria locale
→ application ensures local runtime availability
→ ephemeral local capability created
→ professional sources synced only on explicit action/policy
→ semantic retrieval available in Biblioteca/Copilota flows
→ reload/session expiry revokes capability
```

The teacher must not need to understand:

- Termux processes;
- ports;
- runit;
- embedding server mechanics;
- session tokens.

The teacher **does** retain authority over whether professional memory is active.

---

## 5.11 Privacy and backup flow

Privacy is a persistent condition of every flow, not a destination visited only in Settings.

```text
Any surface
→ privacy context visible when relevant
→ Privacy Shield available immediately

Settings / Privacy
→ backup encrypted
→ export
or
→ restore encrypted backup
→ validation
→ publish restored state only after success
```

Privacy controls must remain stronger than convenience. Context continuity must never weaken student-data boundaries.

---

## 6. Future information architecture

### Primary shell

- **Oggi** — task router.
- **Classi** — direct class access and administration.
- **UDA / Progettazione** — expert structured planning access.
- **Biblioteca** — professional memory and sources.
- **Altro / Menu** — Verifiche, Privacy, Backup, Settings and advanced tools.

### Persistent contextual access

The four work actions are always reachable from `Oggi` and may appear contextually elsewhere:

- Prepara
- Conduci
- Registra
- Rivedi

Copilota remains a contextual trigger, not a primary tab.

---

## 7. Transition architecture — how to reach the target without a rewrite

The migration must be incremental. Existing specialist surfaces remain canonical while the orchestration layer grows around them.

### Phase 0 — Baseline and governance

**State:** this document.

Deliverables:

- canonical current/target UX reference;
- future-flow reference;
- baseline SHA recorded;
- update rules defined;
- roadmap accepted.

No product behaviour changes.

### Phase 1 — Unified Professional Context

Build one canonical context model and resolver shared by Home, Class, UDA, Biblioteca and Copilota.

Minimum context:

- class;
- UDA;
- lesson/activity;
- source;
- professional goal/intent;
- time context;
- privacy scope;
- planning profile when available.

Acceptance:

- context can be inspected;
- context cannot select an ambiguous target silently;
- context survives safe navigation but not forbidden privacy boundaries;
- existing specialist surfaces continue to work unchanged.

### Phase 2 — Home `Oggi` as work router

Introduce the four work actions without duplicating specialist functionality.

Acceptance:

- teacher can start a common task from Oggi in 1–2 meaningful decisions;
- routes retain known context;
- no dashboard overload;
- neutral startup remains safe.

### Phase 3 — End-to-end work cycle

Connect each work action to existing surfaces.

- Prepara → Programmazione/UDA/Biblioteca/Verifiche/Copilota.
- Conduci → lesson/activity compact surface.
- Registra → Valutazioni/Comportamento/Esiti/notes/UDA progress.
- Rivedi → Tabellone/Analisi/Storico/Scheda/UDA analysis.

Acceptance:

- context is retained end-to-end;
- no duplicate forms are introduced;
- return paths form a continuous cycle.

### Phase 4 — Deep integration and reuse

Strengthen links among Programmazione, UDA, Biblioteca, Verifiche and Copilota.

Acceptance:

- Programmazione → UDA relationship is visible;
- UDA → activity/lesson continuity is explicit;
- sources can be reused without reclassification/reselection when safe;
- Verifiche participate naturally in Prepara/Conduci/Registra/Rivedi;
- Copilota does not ask for context already known.

### Phase 5 — Transparent local memory

Keep explicit professional authority while hiding technical mechanics.

Acceptance:

- `Attiva memoria locale` is enough to make the capability usable when the device runtime is available;
- no tokens/ports/processes are exposed in ordinary UX;
- student-personal data remains excluded;
- semantic retrieval degrades safely to ordinary local search.

### Phase 6 — Mobile shell, installability and refinement

Complete the everyday Android experience.

Acceptance:

- installable application/PWA with own name/icon;
- local cold start remains automatic;
- offline-first behaviour is explicit and tested;
- primary actions fit phone use;
- accessibility, responsiveness and touch ergonomics qualified;
- new UX baseline v2 produced after human review.

---

## 8. Recommended delivery sequence

The phases above are dependencies, not a single long-lived feature branch.

Recommended implementation lines:

1. `CTX-01` — Unified Professional Context.
2. `TODAY-01` — Home/Oggi router.
3. `FLOW-01` — Prepara.
4. `FLOW-02` — Conduci.
5. `FLOW-03` — Registra.
6. `FLOW-04` — Rivedi.
7. `INT-01` — Programmazione ↔ UDA ↔ lesson continuity.
8. `INT-02` — Biblioteca/Verifiche/Copilota contextual integration.
9. `LSM-02` — transparent local-memory activation.
10. `MOBILE-01` — installable local app shell / PWA.
11. `UX-QA-03` — end-to-end human product qualification against this baseline.

Each line must have its own design, RED→GREEN tests, exact-SHA qualification and independent review. Do not execute this roadmap as one monolithic PR.

---

## 9. Success criteria

The primary success metric is not number of screens removed.

### Core UX measure

> **How often must the teacher explain again which class, UDA, activity, source or goal they are working on?**

Target: **near zero redundant reselection**, while preserving explicit choice when ambiguity or privacy requires it.

### Additional criteria

- Common daily tasks start in 1–2 meaningful decisions.
- No duplicate business logic is created in Oggi.
- Specialist workspaces remain accessible to expert users.
- Context handoffs are inspectable and deterministic.
- Copilota uses context but never silently acquires professional authority.
- Local Semantic Memory remains local, explicit and student-data-safe.
- Mobile experience is coherent across cold start, unlock, work and return.
- Safety/privacy behaviour remains fail-closed.

---

## 10. Governance rules for this baseline

This baseline must be reviewed when a change does any of the following:

- adds/removes a primary user surface;
- changes the meaning of Prepara / Conduci / Registra / Rivedi;
- changes context propagation or ambiguity policy;
- introduces a new AI authority or automatic action;
- changes Local Semantic Memory activation/sync authority;
- changes privacy boundaries or neutral-start behaviour;
- changes the mobile shell or installation model;
- creates a new parallel workflow for an operation already covered here.

A PR materially changing one of these areas must state:

1. which canonical flow it affects;
2. whether the change preserves or revises this baseline;
3. whether the visual reference must be regenerated;
4. Human Product Review evidence for the affected journey.

---

## 11. Canonical journeys for future qualification

Future Human Product Review should include at least:

### J1 — Start the day
`cold start → unlock → Oggi → next relevant work → specialist surface`

### J2 — Prepare a lesson
`Oggi → Prepara → class/UDA retained → material/source → Copilota optional → prepared outcome`

### J3 — Conduct and record
`Oggi → Conduci → lesson context → rapid evidence → Registra → durable save`

### J4 — Review and continue
`Oggi/Registra → Rivedi → analysis → decision → Prepara next step`

### J5 — Reuse professional material
`capture/retrieve source → context link → use/Copilota → resulting activity → later semantic retrieval`

### J6 — Assessment lifecycle
`Prepara verification → Conduci/administer → Registra results → Rivedi analysis`

### J7 — Local memory
`memory inactive → explicit activation → sync professional data → semantic retrieval → reload/expiry → authority revoked`

### J8 — Privacy-sensitive class use
`class → Privacy Shield → conduct/record → no student-personal memory propagation`

---

## 12. Non-goals

UX-GOV-01 does **not** mandate:

- deleting existing expert surfaces;
- replacing the current persistence model;
- creating automatic AI actions;
- restoring class/student context automatically after secure unlock;
- synchronising professional memory automatically without policy/authority;
- converting every workflow into a chatbot interaction;
- merging Programmazione and UDA into one data object merely to make navigation look simpler.

The goal is **coherent orchestration, not superficial consolidation**.
