# EDU-PLAN-01 — Consolidation Amendment v1.1

Status: **DESIGN AMENDMENT / IMPLEMENTATION NOT STARTED**  
Date: 2026-10-24  
Applies to:
- `2026-10-24-edu-plan-01-programmazione-didattica-design.md`
- `2026-10-24-edu-plan-01-contextual-uda-copilot-design.md`

This amendment consolidates EDU-PLAN-01 after an additional review of the Italian regulatory framework, the current Arena curriculum contracts and the AI/privacy boundary. It does not authorize implementation, merge, deployment or curriculum adoption.

---

## 1. Purpose

The original EDU-PLAN-01 direction remains valid:

`normativa + Arena + libro/guida + calendario/orario + giudizio professionale del docente -> programmazione madre -> istanze di classe -> previsto/svolto/proiezione`

The research phase identified twelve corrections that must be treated as normative design constraints rather than left to implementation detail:

1. regulatory applicability must be cohort-aware;
2. Arena provenance and authority state must be visible in the teacher UI;
3. Arena approval and teacher approval are different state machines;
4. the existing `CurriculumSnapshot v1` cannot be reused blindly for Registro Docente;
5. Arena curriculum coverage and textbook/guide support are different semantics;
6. an UDA must explicitly model learning experiences and evidence/assessment strategy;
7. Educazione civica must remain a transversal contribution, not a duplicated ordinary discipline;
8. assessment periods cannot be hard-coded as `Q1/Q2`;
9. calendar capacity must retain regional/institutional/class provenance;
10. textbook editions must be checked against the applicable regulatory regime without being declared invalid automatically;
11. the contextual copilot must remain teacher-assist and outside automated student decision-making;
12. curriculum references must use stable identifiers, versions and explicit associations.

Where this amendment conflicts with the original design, **v1.1 prevails**.

---

## 2. Evidence baseline used for consolidation

### 2.1 Italian regulatory sources

The design is aligned to the following official or primary sources as observed on 2026-10-24:

- **DM 9 December 2025, n. 221**, Regolamento recante Indicazioni nazionali per il curricolo della scuola dell'infanzia e del primo ciclo, published in Gazzetta Ufficiale on 2026-01-27 and effective from 2026-02-11. Official source: `https://www.gazzettaufficiale.it/eli/id/2026/01/27/26G00021/SG`.
- The same decree establishes gradual adoption from a.s. 2026/27 beginning with first classes of primary and lower secondary. Official article rendering: `https://www.gazzettaufficiale.it/atto/serie_generale/caricaArticoloDefault/originario?atto.codiceRedazionale=26G00021&atto.dataPubblicazioneGazzetta=2026-01-27&atto.tipoProvvedimento=DECRETO`.
- **DPR 8 March 1999, n. 275**, autonomy of schools and definition of curricula. Official source: `https://www.normattiva.it/atto/caricaDettaglioAtto?atto.codiceRedazionale=099G0339&atto.dataPubblicazioneGazzetta=1999-08-10`.
- **D.Lgs. 16 April 1994, n. 297, art. 74**, school calendar: at least 200 days of lessons and possibility of two or three assessment periods by teachers' college resolution. Official source: `https://www.normattiva.it/uri-res/N2Ls?urn%3Anir%3Astato%3Adecreto.legislativo%3A1994-04-16%3B297~art74=`.
- MIM guidance on **Educazione civica**, including the 33 annual hours and the three conceptual nuclei used in the 2024 guidelines. Official source: `https://www.mim.gov.it/documents/20182/7975243/AOODGOSV.REGISTRO%2BUFFICIALE.2024.0039504.pdf/802a0908-f965-87c5-8b4a-149fc6f99080`.
- MIM **Linee guida per l'introduzione dell'Intelligenza Artificiale nelle Istituzioni scolastiche** (2025), including privacy-by-design/default and DPO involvement. Official source: `https://mim.gov.it/documents/20182/0/MIM_Linee%2Bguida%2BIA%2Bnella%2BScuola_09_08_2025-signed.pdf/b70fdc45-4b75-1f7e-73bf-eab12989b928`.
- Regulation (EU) 2024/1689 (AI Act), especially the education uses in Annex III concerning access, assignment, evaluation of learning outcomes, educational level and test monitoring. Official source: `https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R1689`.

### 2.2 Interoperability reference

CASE 1.1 from 1EdTech is used only as an architectural reference for stable identifiers, versioned competency frameworks and explicit associations. EDU-PLAN-01 does **not** require CASE conformance in v1.1.

Reference: `https://standards.1edtech.org/case/`.

### 2.3 Arena evidence snapshot

Arena was inspected at:

`antoniocorsano-boop/CurManLight_arena@7d34344ede0ae5dcd2c0224c83f5a46d40fad825`

Observed facts relevant to EDU-PLAN-01:

- Arena remains the curriculum authority.
- The integrated institute vertical curriculum is technically qualified but **professional validation is still open and the curriculum is NON VIGENTE**.
- Current exported authority state is `PROVISIONAL_COMPLETE`, not `APPROVED`.
- `CurriculumSnapshot v1` already carries curriculum/version references, authority state, structural fingerprint, provenance, school year, discipline, grade, section/cohort and applicability status.
- `CurriculumSnapshot v1` downstream policy is currently specific to `DOCENTE_OS`, with preview-only import, explicit acceptance and no automatic write.
- The Technology multi-case profile explicitly models a.s. 2026/27 as:
  - grade I: Indicazioni 2025;
  - grade II: Indicazioni 2012 transitional continuity;
  - grade III: Indicazioni 2012 final transitional year.
- Grade II/III static validation cases must not invent a governed snapshot fingerprint when one has not been materialized.
- Arena P3-v2 reserves semantic meanings such as `COVERAGE`, `GAP`, `DISCONTINUITY`, `OVERLAP`, `CONFLICT` for reviewed relations between verified national elements and institute-curriculum nodes. Similarity alone is not authority evidence.
- Arena models Educazione civica as a transversal axis.

These facts are constraints for Registro Docente, not implementation suggestions.

---

## 3. Consolidated authority model

EDU-PLAN-01 v1.1 adopts the following authority hierarchy:

```text
National law / ministerial framework
            |
            v
Arena — institute curriculum authority
            |
            v
Registro Docente — professional planning environment
            |
            +--> textbook / teacher guide / private sources
            |
            +--> contextual AI copilot
            |
            v
Teacher-approved master programme
            |
            v
Class instances and actual teaching history
```

Rules:

1. Registro Docente does not reinterpret national curriculum applicability when Arena provides a governed applicability binding.
2. Arena does not determine the teacher's operational lesson sequence, methodology or local UDA composition.
3. Textbook, guide and AI never become curriculum authority.
4. The teacher remains the authority for the operational programme produced in Registro Docente.
5. Teacher approval of a programme does not promote an Arena curriculum from provisional to approved.

---

# Amendment A — Cohort-aware regulatory binding

## 4. Problem

The tuple:

`schoolYear + schoolOrder + grade + subject`

is not sufficient during regulatory transition periods.

In a.s. 2026/27 the same school stage and subject can be governed by different national indication regimes depending on the cohort. EDU-PLAN-01 therefore must not infer the applicable curriculum from the visible class number alone.

## 5. Required concept: `RegulatoryRegimeBinding`

Conceptual fields:

- `schoolYearRef`
- `schoolOrder`
- `gradeRef`
- `cohortRef`
- `subjectRef`
- `nationalFrameworkRef`
- `frameworkVersion`
- `applicabilityStatus` (`APPLICABLE`, `TRANSITIONAL` or future governed values)
- `transitionRuleRef?`
- `sourceAuthority`
- `sourceVersion`

### Source rule

For curriculum applicability, when a governed Arena binding exists, **Arena is the operational source consumed by Registro Docente**.

Registro Docente may maintain a normative registry for explanatory metadata and statutory hours, but it must not silently override Arena's governed cohort/regime binding.

### Fail-closed rule

If Arena cannot provide a materialized binding for a cohort:

- planning may continue only as a teacher draft when product policy allows it;
- the UI must show that Arena binding is unavailable/not materialized;
- the system must not claim institute-curriculum alignment;
- AI must not synthesize a missing authority state or fingerprint.

---

# Amendment B — Arena must be visible in the teacher experience

## 6. Required UI concept: `ArenaCurriculumBanner`

Every master-programme workspace using Arena must expose a compact, inspectable authority surface containing at least:

- source: **Arena**;
- institute/curriculum name;
- curriculum version;
- school year;
- discipline;
- grade/cohort;
- applicable national regime;
- Arena authority state;
- binding/snapshot state;
- issued/reference date where available;
- action to inspect provenance/details.

Example teacher-facing shape:

```text
Curricolo di riferimento · Arena
Tecnologia · classe seconda · a.s. 2026/27
Curricolo d'istituto v1.3
Regime: Indicazioni 2012 · transitorio
Stato Arena: PROVVISORIO / NON VIGENTE
Binding: verificabile
```

The exact copy may differ, but the semantic distinction must remain.

## 7. No hidden degradation

The UI must never silently collapse these states into a generic “curricolo disponibile”.

Minimum binding states for Registro Docente:

- `BOUND_APPROVED`
- `BOUND_PROVISIONAL`
- `NOT_MATERIALIZED`
- `STALE_OR_SUPERSEDED`
- `MISMATCH`
- `UNAVAILABLE`

The concrete mapping from Arena contract values is an adapter responsibility. Registro Docente must not invent approval states not supplied by Arena.

---

# Amendment C — Separate Arena authority state from teacher programme state

## 8. Two independent state machines

### Arena curriculum authority

Governed by Arena, for example:

- provisional/non-vigente;
- approved/vigente;
- superseded or future governed state.

### Teacher master programme

Governed by Registro Docente:

- `draft`
- `teacher_approved`
- `superseded`

A master programme can be `teacher_approved` while its Arena source is still provisional. In that case the UI must preserve both facts explicitly.

Forbidden claim:

`teacher_approved -> curriculum approved`

Required representation:

```text
Programmazione docente: approvata dal docente
Curricolo Arena: provvisorio / non vigente
```

---

# Amendment D — Arena consumer contract for Registro Docente

## 9. Current constraint

`CurriculumSnapshot v1` is a governed legacy contract and its downstream policy currently targets `DOCENTE_OS`.

EDU-PLAN-01 must not:

- mutate `CurriculumSnapshot v1` in place;
- pretend Registro Docente is `DOCENTE_OS`;
- remove `PREVIEW_ONLY`, acceptance or no-auto-write guarantees from the existing v1 contract.

## 10. Required future boundary

Before a live Arena -> Registro Docente runtime integration is implemented, the ecosystem must define one of these compatible shapes:

### Preferred direction

A consumer-neutral canonical core (`CurricoloSnapshot v2` or equivalent) plus product-specific downstream policy/profile.

### Acceptable compatibility direction

A new explicit Arena -> Registro Docente consumer profile that references the governed curriculum core without duplicating curriculum authority.

Whichever direction is selected must preserve:

- stable curriculum and version IDs;
- authority state and receipt where applicable;
- structural/integrity fingerprint where governed;
- applicability context including cohort/transition;
- provenance;
- professional/non-personal privacy class where valid;
- explicit human acceptance;
- no automatic curriculum write-back from Registro Docente to Arena.

### Planning implication

The implementation plan may prepare an adapter interface, fixtures and UI states before the live Arena consumer contract exists, but it must not fake a production handoff.

---

# Amendment E — Rename textbook/guide “coverage” semantics

## 11. Problem

The original design used `CurriculumCoverageMap` for the relation between Arena requirements and textbook/guide materials.

Arena already reserves a stricter notion of curriculum `COVERAGE` for reviewed national-to-institute curriculum relations. Reusing the same word downstream would create epistemic ambiguity.

## 12. Replacement concept: `PlanningSupportMap`

The old `CurriculumCoverageMap` name is superseded by:

`PlanningSupportMap`

or an equivalent implementation name preserving the same semantics.

For each Arena planning requirement it may state:

- `well_supported`
- `partially_supported`
- `unsupported_by_selected_resources`
- `optional_extension_available`
- `mapping_uncertain`

This answers:

> Do the selected textbook, teacher guide and private sources give the teacher enough material to plan this Arena requirement?

It does **not** answer:

> Is the institute curriculum compliant with or covering the national curriculum?

That second question remains under Arena authority and its governed review receipts.

## 13. AI restriction

Embedding similarity or generative inference may suggest a mapping between a resource and an Arena node, but cannot convert that suggestion into an Arena `COVERAGE` conclusion.

Teacher acceptance can approve the planning-resource mapping inside Registro Docente only.

---

# Amendment F — UDA structure: learning experiences and evidence

## 14. Required UDA planning fields

In addition to the fields already present/proposed, each master-programme UDA should be able to express:

- `arenaRequirementRefs[]`
- `learningObjectives[]`
- `learningExperiences[]`
- `resourceRefs[]`
- `assessmentEvidenceStrategy[]`
- `estimatedHours`
- `timeWindow`
- `dependencies[]`
- `transversalContributions[]`
- `teacherRationale?`
- provenance for generated/suggested elements.

### `learningExperiences`

Examples of semantics, not fixed UI fields:

- guided explanation;
- observation/inquiry;
- drawing/design;
- laboratory;
- simulation;
- collaborative activity;
- authentic task;
- production/presentation.

### `assessmentEvidenceStrategy`

This is broader than a test. It can include:

- observation;
- artefact/product;
- oral explanation;
- written work;
- practical performance;
- formative checkpoint;
- rubric-based evidence;
- other teacher-defined evidence.

The purpose is to make explicit how the teacher intends to check attainment of the UDA objectives without forcing one assessment method.

---

# Amendment G — Educazione civica as transversal contribution

## 15. Domain rule

Educazione civica must not be modelled as an ordinary discipline duplicated inside each disciplinary timetable.

Introduce a concept such as:

`TransversalContribution`

with at least:

- `axisRef` (e.g. Educazione civica);
- `nucleusRef`;
- `plannedHours?`;
- `learningObjectiveRefs[]?`;
- `evidenceStrategy?`;
- provenance/source.

For current Educazione civica policy, the three nuclei are handled as governed references from Arena/institutional configuration rather than hard-coded product copy.

## 16. Hour accounting

The 33 annual hours belong to the transversal education-civics programme at class/institute level. A discipline may contribute hours, but those hours must not be double-counted as a second independent disciplinary budget.

Example:

```text
UDA Tecnologia: Energia e sostenibilità
Disciplina: 8 h
Contributo Educazione civica: 2 h
```

The 2 hours are a tagged contribution inside the same teaching time unless the institution has explicitly configured a separate organizational allocation.

---

# Amendment H — Assessment periods are configurable

## 17. Supersede `Q1 | Q2` as domain authority

The current `UdaRecord.period: 'Q1' | 'Q2'` is an implementation legacy, not a valid universal domain model for EDU-PLAN-01.

Introduce a configurable concept:

`AssessmentPeriod[]`

Conceptual fields:

- `id`
- `label`
- `startDate`
- `endDate`
- `sequence`
- `source` (`institution` or equivalent)
- `schoolYearRef`

Supported examples include:

- first/second quadrimester;
- first/second/third trimester;
- other lawful institutional organization.

UDA windows may reference periods but must ultimately use real dates.

---

# Amendment I — Calendar provenance and capacity

## 18. Layered teaching calendar

Teaching capacity must be derived from explicit layers:

```text
regional school calendar
      + institute adaptations/closures
      + class timetable
      + known exceptions
      = candidate teaching slots
      - explicit unavailable events
      = effective available hours
```

Conceptual provenance layers:

- `RegionalCalendarProfile`
- `InstitutionCalendarOverlay`
- `ClassTimetable`
- `ClassCalendarException`

## 19. 200-day rule

The product may display statutory calendar context but must not infer that “200 school days” equals a discipline's actual available lessons. Discipline capacity is calculated from the class timetable intersected with actual teaching dates.

## 20. Period-end forecasts

Forecasts such as “finish before the first assessment period” must resolve against the configured `AssessmentPeriod`, not a hard-coded December/January date.

---

# Amendment J — Textbook edition and regulatory regime compatibility

## 21. ISBN remains identity, not authority

The ISBN may identify edition metadata; it does not establish curricular compliance or content rights.

## 22. Compatibility signal

When metadata is sufficient, the system may warn that an edition predates the applicable national framework.

Example:

```text
Edizione 2024
Coorte: classe prima 2026/27
Regime Arena: Indicazioni 2025
Segnale: edizione precedente al regime applicabile — verifica consigliata
```

This is a review signal, not a declaration that the book is unusable.

## 23. Arena still prevails

Where book structure and Arena requirements diverge, the planning workflow follows the Arena requirement and marks the resource support gap.

---

# Amendment K — AI copilot governance boundary

## 24. Teacher-assist scope

The contextual UDA copilot is designed for professional planning tasks such as:

- explaining an Arena requirement;
- finding relevant passages in private teacher resources;
- suggesting a smaller/larger UDA scope;
- proposing learning experiences;
- proposing evidence strategies;
- estimating or redistributing hours;
- explaining timetable/budget impact;
- suggesting non-authoritative mappings to book/guide content.

## 25. Out of scope without a separate governed design

EDU-PLAN-01 v1.1 does not authorize the copilot to:

- assign grades to individual students;
- autonomously evaluate individual learning outcomes;
- profile students;
- recommend educational level/access for a student;
- monitor prohibited student behaviour during tests;
- make decisions that materially affect a student's educational path.

Any future capability in those areas requires a distinct legal/privacy/AI-risk design review.

## 26. Privacy/data minimization

Default context for the UDA copilot is:

- teacher professional planning data;
- Arena curriculum data;
- private textbook/teacher-guide representations;
- programme/UDA structure;
- calendar and aggregate class teaching capacity.

Individual student personal data are excluded from the default planning context.

## 27. Local-first AI composition

The companion copilot design remains valid:

```text
teacher question
 -> contextual retrieval
 -> local EmbeddingGemma where available
 -> selected source excerpts/structured facts
 -> interchangeable generative model
 -> cited/explained proposal
 -> Adopt / Adapt / Ignore
```

Remote generation requires the governed outbound-data policy and explicit teacher opt-in where required. Retrieval or generation failure must not alter the programme silently.

---

# Amendment L — Stable identifiers and association model

## 28. Principle

UDA references to curriculum must not depend on mutable display labels alone.

Every external curriculum reference should preserve, where available:

- provider/source namespace;
- entity type;
- stable entity ID;
- version ID;
- parent/framework reference;
- association type;
- source/version provenance.

## 29. CASE-inspired, not CASE-dependent

EDU-PLAN-01 v1.1 adopts the interoperability principles exemplified by CASE 1.1:

- framework identity;
- unique item identity;
- hierarchy;
- explicit associations;
- versioned exchange.

No CASE API, certification or format dependency is required for the first implementation.

Arena's existing canonical-reference shape should be preserved by adapters rather than flattened into strings.

---

## 30. Revised conceptual model

```text
National regulatory registry
         |
         | explanatory law / statutory hours
         v
RegulatoryRegimeBinding <----- Arena applicability context
         |
         v
ArenaCurriculumBinding
(authority/version/cohort/state/provenance)
         |
         +--------------------------+
         |                          |
         v                          v
Arena planning requirements     Private teaching library
         |                      ISBN + book + guide + materials
         |                          |
         +------------+-------------+
                      v
               PlanningSupportMap
                      |
                      v
              UDA candidate set
      objectives / experiences / evidence
          hours / sources / dependencies
          transversal contributions
                      |
                      v
            MasterProgramVersion
                      |
              teacher approval
                      |
          +-----------+-----------+
          |           |           |
         2A          2B          2C
          |           |           |
      local overrides + actual teaching history
                      |
                      v
             forecast / divergence
```

---

## 31. Required domain additions/renames

The implementation plan must account for the following conceptual changes.

### Add

- `RegulatoryRegimeBinding`
- `ArenaCurriculumBinding`
- `AssessmentPeriod`
- `RegionalCalendarProfile`
- `InstitutionCalendarOverlay`
- `TransversalContribution`
- explicit `learningExperiences`
- explicit `assessmentEvidenceStrategy`

### Rename/supersede

- `CurriculumCoverageMap` -> `PlanningSupportMap` (or semantically equivalent name)
- hard-coded `Q1/Q2` authority -> configurable `AssessmentPeriod[]`

### Preserve

- versioned `MasterProgram` / `MasterProgramVersion`;
- `ClassProgramInstance` with local overrides;
- selective mother->class propagation;
- three-way conflict handling;
- 15% default planning reserve;
- private teacher library;
- contextual UDA copilot with human adoption;
- no destructive overwrite of actual class history.

---

## 32. Revised generation logic

The automatic UDA proposal pipeline becomes:

```text
1. Resolve teacher profile and class/level context
2. Resolve statutory hour metadata
3. Resolve Arena curriculum binding for exact cohort/regime
4. Fail closed on missing/ambiguous authority binding
5. Load selected private teaching resources
6. Build PlanningSupportMap
7. Identify Arena requirements insufficiently supported by resources
8. Determine effective teaching capacity from real calendar/timetable
9. Reserve default 15% margin
10. Cluster requirements into a parsimonious UDA set
11. Attach learning experiences and evidence strategies
12. Add optional transversal contributions without double-counting hours
13. Explain provenance and uncertainty
14. Present candidate programme to teacher
15. Materialize MasterProgramVersion only after explicit teacher approval
```

No AI step may replace steps 3-4 or manufacture missing authority evidence.

---

## 33. Teacher-facing claims policy

### Allowed when Arena is approved and bound

Examples:

- `Curricolo Arena approvato — versione X`
- `Questa UDA è collegata ai requisiti Arena A, B, C`
- `Le fonti selezionate supportano parzialmente il requisito B`

### Allowed when Arena is provisional

Examples:

- `Curricolo Arena provvisorio / non vigente`
- `Bozza di programmazione basata sulla versione provvisoria X`

### Forbidden when authority is provisional/missing

- `Curricolo approvato`
- `Conformità al curricolo d'istituto garantita`
- invented snapshot/fingerprint/version claims;
- calling resource similarity `COVERAGE` in the Arena authority sense.

---

## 34. Acceptance criteria added by v1.1

EDU-PLAN-01 is not ready for implementation qualification unless the design/plan can prove all of the following:

1. A first, second and third lower-secondary class in a.s. 2026/27 can resolve different applicable national regimes without hard-coded per-grade hacks.
2. The teacher can always see whether Arena is approved, provisional, unavailable or not materialized.
3. Teacher approval of a programme cannot mutate or visually promote Arena authority state.
4. Registro Docente does not reuse the `DOCENTE_OS` downstream identity of `CurriculumSnapshot v1`.
5. Missing Arena snapshots/fingerprints are never fabricated.
6. Resource support is not labelled as Arena curriculum `COVERAGE`.
7. UDA design includes learning experiences and evidence/assessment strategy.
8. Educazione civica contributions can be tagged without duplicating teaching-hour totals.
9. Two-period and three-period school years are representable without domain migration.
10. Effective discipline capacity is calculated from real timetable/calendar layers, not annual statutory hours alone.
11. A pre-regime textbook edition can raise a review signal without being automatically rejected.
12. The copilot cannot silently write curriculum/UDA changes and cannot enter student-level automated decision-making under EDU-PLAN-01.
13. Curriculum associations survive label changes because stable IDs/version references are retained.
14. All claims shown to the teacher are consistent with the exact Arena authority/binding state.

---

## 35. New explicit non-goals

In addition to the original non-goals, v1.1 excludes:

- making Registro Docente a curriculum authority;
- rebuilding Arena's national-to-institute semantic review engine;
- deriving `COVERAGE/GAP` authority conclusions from embeddings;
- retrofitting Indicazioni 2025 onto transitional cohorts;
- using `CurriculumSnapshot v1` under a false consumer identity;
- treating all Italian schools as quadrimester-only;
- treating Educazione civica as an ordinary extra discipline in every timetable;
- declaring a textbook compliant/non-compliant solely from edition year;
- student-level automated assessment/placement/profiling by the UDA copilot;
- CASE certification or external CASE infrastructure in the first delivery.

---

## 36. Arena-specific follow-up required before live integration

Before an implementation tranche activates a real Arena -> Registro Docente handoff, the ecosystem needs a separately reviewed contract decision covering:

- consumer identity for Registro Docente;
- relationship with legacy `CurriculumSnapshot v1`;
- target shape for `CurricoloSnapshot v2` or equivalent consumer-neutral core;
- accepted authority states;
- exact cohort/applicability semantics;
- version/fingerprint freshness checks;
- preview/acceptance behavior;
- no automatic write-back;
- stale/superseded behavior;
- privacy classification.

This follow-up is a dependency of **live governed integration**, not of preliminary local domain modelling or UI prototyping with synthetic fixtures.

---

## 37. Relationship with the contextual copilot companion spec

The companion design remains valid with these additional constraints:

- Arena facts supplied to the model must preserve exact authority state and version;
- retrieval must distinguish Arena authority nodes from textbook/guide material;
- the response must not present a resource mapping as an Arena authority conclusion;
- the copilot should be able to answer “da dove viene?” by separating:
  - law/regulatory metadata;
  - Arena curriculum;
  - textbook;
  - teacher guide;
  - teacher decision;
  - AI suggestion;
- suggested UDA edits remain proposals until Adopt/Adapt;
- no individual student context enters the default UDA planning session.

---

## 38. Decision checkpoint

With v1.1, the intended EDU-PLAN-01 design is:

**teacher-first, Arena-authoritative, cohort-aware, regulation-visible, source-explainable, privacy-first, parsimonious in UDA count, realistic in time budgeting, versioned from mother programme to class, and conversational without delegating curriculum authority or professional judgment to AI.**

No implementation plan is included in this amendment.