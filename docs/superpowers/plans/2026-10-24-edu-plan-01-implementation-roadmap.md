# EDU-PLAN-01 Implementation Roadmap

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement each tranche plan task-by-task. Each tranche is independently reviewable and must not be collapsed into one long-lived implementation branch.

**Goal:** Deliver the approved EDU-PLAN-01 guided annual-planning capability incrementally, preserving Arena curriculum authority, Secure Local Vault guarantees, teacher control and Italian first-cycle normative provenance.

**Architecture:** EDU-PLAN-01 is decomposed into six implementation tranches with explicit interfaces. Local domain/persistence and normative/calendar foundations land first; Arena receives a dedicated read-only handoff before Registro Docente consumes curriculum context; private resources and planning workflows then build on those contracts; class propagation and the contextual copilot are deliberately later consumers.

**Tech Stack:** React 19, TypeScript 7, Bun tests, Vite 8, Express, IndexedDB/Web Crypto Secure Local Vault, local/Gemini embedding infrastructure already present, Arena JSON-schema governed contracts.

**Specs:**
- `docs/superpowers/specs/2026-10-24-edu-plan-01-programmazione-didattica-design.md`
- `docs/superpowers/specs/2026-10-24-edu-plan-01-contextual-uda-copilot-design.md`
- `docs/superpowers/specs/2026-10-24-edu-plan-01-consolidation-amendment-v1.1.md`

## Global Constraints

- Arena remains the curriculum authority; Registro Docente never promotes, rewrites or silently reinterprets Arena curriculum authority.
- Cohort/regime is explicit. In 2026/27 the applicable 2012/2025 regime is not inferred merely from the numeric grade.
- Arena authority state and teacher approval state are separate and simultaneously visible.
- Existing `CurriculumSnapshot v1` must not be relabelled as a Registro Docente contract; its current downstream target remains Docente OS.
- No invented Arena fingerprint, receipt, authority state or applicability status.
- Book/guide files and extracted representations remain private to the teacher; no student-facing publication path is introduced.
- `PlanningSupportMap` means teaching-resource support for Arena requirements; it must never be presented as Arena's authoritative `COVERAGE/GAP` conclusion.
- Assessment periods are configurable; the new planning domain must not encode `Q1 | Q2` as the authoritative period model.
- Default annual reserve is 15% of effectively available hours and is teacher-adjustable; optional extensions never consume reserve automatically.
- Educazione civica is represented as a transversal contribution, not duplicated as an ordinary discipline budget.
- AI is teacher-assist only; no student-personal data, student ranking or automated student decision is in scope.
- Remote AI use remains subject to current data-flow policy and explicit teacher opt-in; local retrieval/generation is preferred.
- Every mutation that becomes visible as saved follows the existing commit-first durable-write contract.
- No auto-merge, no deploy and no publication are implied by tranche qualification.

## Sequence and dependency graph

```text
A. Domain + persistence + normative/calendar foundation
        |
        +--------------------+
        |                    |
        v                    v
B. Arena read-only handoff   C. Private teaching library
        |                    |
        +----------+---------+
                   v
D. Master-program planning workspace
                   |
                   v
E. Class adoption + three-way merge + progress
                   |
                   v
F. Contextual UDA copilot
                   |
                   v
Integrated browser qualification / human review
```

## Tranche A — Domain, persistence, ordinance and calendar foundation

**Plan:** `docs/superpowers/plans/2026-10-24-edu-plan-01a-domain-persistence-foundation.md`

Produces the stable `PlanningStateV1` boundary, Secure Local Vault `planning` record, backup v3 compatibility, configurable assessment periods, national/local hour provenance, cohort-aware planning profiles, calendar capacity and the 15% reserve calculation. It does not yet import Arena or files.

**Exit:** a planning profile can be created, encrypted, backed up/restored, and capacity can be calculated deterministically without touching legacy `UdaRecord` persistence.

## Tranche B — Arena → Registro Docente governed read-only handoff

**Plan:** `docs/superpowers/plans/2026-10-24-edu-plan-01b-arena-readonly-handoff.md`

Starts in `CurManLight_arena` with a dedicated Registro Docente consumer contract/profile rather than repurposing `CurriculumSnapshot v1`. Registro Docente validates and stores only accepted read-only curriculum context and renders an always-visible Arena authority/provenance panel.

**Exit:** one governed Technology first-cycle fixture is imported fail-closed with explicit cohort/regime and provisional/non-vigente state preserved end-to-end. No curriculum write-back exists.

## Tranche C — Private textbook/teacher-guide library

**Plan:** `docs/superpowers/plans/2026-10-24-edu-plan-01c-private-teaching-library.md`

Adds ISBN metadata lookup with manual fallback, private PDF/DOCX ingestion, locally encrypted source storage, extracted page/section structure, source fingerprints and local indexing hooks. No source file is sent remotely.

**Exit:** a teacher can identify a textbook, privately ingest a teacher guide, reopen both after reload/unlock, inspect extracted structure and remove them completely.

## Tranche D — Master-program planning workspace

**Plan:** `docs/superpowers/plans/2026-10-24-edu-plan-01d-master-program-workspace.md`

Combines the accepted Arena context and private teaching resources into `PlanningSupportMap`, candidate/master UDA structures, budget/reserve checks and a teacher-first annual planning workspace under “Didattica e strumenti”. It keeps mapping conclusions explicitly non-authoritative and requires teacher approval for `MasterProgramVersion`.

**Exit:** the teacher can build and approve one master program for a level with few substantial UDA, source provenance, learning experiences, evidence/assessment strategies, transversal contributions and real-date windows.

## Tranche E — Class adoption, selective propagation and progress

**Plan:** `docs/superpowers/plans/2026-10-24-edu-plan-01e-class-adoption-merge.md`

Creates class instances from an approved master version, records local overrides and actual progress, and implements selective mother→class updates through three-way merge. Already-performed lessons/evidence are protected from destructive upstream changes.

**Exit:** master v2 can be applied to 2A/2B but not 2C, non-conflicting changes merge automatically, real conflicts require teacher choice, and execution history is preserved.

## Tranche F — Contextual UDA copilot

**Plan:** `docs/superpowers/plans/2026-10-24-edu-plan-01f-contextual-uda-copilot.md`

Builds the contextual planning conversation on top of stable domain/source contracts. EmbeddingGemma/local embeddings retrieve relevant Arena/resource fragments; a swappable local-first generation provider returns structured `CopilotProposal`s. Remote generation remains opt-in and no proposal mutates planning state until the teacher chooses Adopt/Adapt.

**Exit:** the teacher can ask a contextual UDA question, see grounded source references and impact, and adopt/adapt/ignore a proposal without any direct AI write.

## Integration gate after Tranche F

Do not declare EDU-PLAN-01 complete until one browser-qualified synthetic journey proves, on one exact candidate SHA:

1. create a lower-secondary Technology planning profile;
2. show the applicable cohort/regime and ordinance provenance;
3. import an Arena context preserving authority state;
4. add a textbook and private guide;
5. build a support map and approve a master program while preserving reserve;
6. adopt it on at least two synthetic classes;
7. apply a selective master update with one non-conflict and one real conflict;
8. ask the contextual copilot a planning question and adopt one grounded proposal;
9. reload/lock/unlock and prove persistence;
10. export and restore an encrypted backup and prove the full planning state/resources survive;
11. prove the student portal cannot access planning resources, Arena context or copilot state;
12. prove zero unexpected page errors/console errors at mobile and desktop widths.

## Branching and review strategy

- Keep the current design/plan branch documentation-only.
- Each tranche starts from the latest approved/integrated baseline in a fresh branch/worktree.
- Each task follows RED → causal confirmation → minimal GREEN → focused verification → commit.
- Each tranche receives its own independent review and browser gate where it exposes UI.
- Do not stack a later tranche on an unqualified earlier tranche unless the branch relationship is explicitly documented and exact-SHA pinned.
- Qualification never authorizes merge/deploy; human decision remains a separate gate.
