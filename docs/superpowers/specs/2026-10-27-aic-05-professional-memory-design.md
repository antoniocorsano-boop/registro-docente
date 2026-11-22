# AIC-05 — Professional Memory Foundation Design

**Status:** MATERIALIZED from approved AI Teacher Copilot v1 design  
**Repository baseline:** `main@150824965336f63f6dd7e0969b116887b77bc32d`  
**Predecessor:** AIC-04 integrated from exact candidate `df78f8ce20488084d6fe8cd29eba4697106d5ad0`  
**Scope:** `registro-docente`  
**Date:** 2026-10-27

## 1. Intent

AIC-05 introduces a private, local-first **professional memory** so the Copilot can reuse useful continuity from the teacher's prior work without replaying entire conversations, duplicating canonical UDA/Library/planning data, or storing student-personal information.

The slice implements the already approved three-layer model:

1. **local event memory**;
2. **consolidated professional memory**;
3. **small retrieved working set** for the current request.

The memory is a derived professional aid. UDA, Library, Planning, tests and other product domains remain canonical.

## 2. Current-state findings

The integrated baseline already provides:

- one cross-surface Copilot and privacy-safe context projection;
- governed REVIEW/LINK/PREPARE flows;
- a Secure Local Vault backed by IndexedDB and Web Crypto;
- typed encrypted Vault records (`appData`, `settings`, `udas`, `customTests`, `submissions`, `planning`, `library`, `meta`);
- atomic `SecureVault.putMany()` writes;
- backup/restore v4 containing Planning and Library;
- durable mutation rules in which persistent product state is only published after verified persistence.

There is no existing professional-memory domain. AIC-05 must extend the existing Vault rather than create a second database, remote memory store or opaque chat history.

## 3. Goals

### G1 — Professional continuity
Remember safe professional decisions and reusable patterns so repeated work can start from relevant prior evidence.

### G2 — Inspectable memory
The teacher can see exactly what is remembered, why it exists and where it came from.

### G3 — Reversible control
The teacher can correct or remove one memory item, disable automatic memory by category, and explicitly choose `Ricorda questo`.

### G4 — Small retrieval surface
Each Copilot request receives only a small relevant working set, never the full event log or full conversation history.

### G5 — Privacy by construction
Student-personal or ambiguous unsafe data cannot enter professional memory or a remote-bound memory projection.

## 4. Non-goals

- No global chat transcript memory.
- No remote memory database or cross-device synchronization.
- No model-generated personal profile of the teacher.
- No autonomous mutation of UDA, Library, Planning, tests or assessments from memory.
- No AIC-06 budget governor, AIC-07 proactive background suggestions or new generative capability pulled forward.
- No semantic vector database in this slice; retrieval remains deterministic/local.
- No memory of individual student grades, behavior, health, PEI/PDP, identifiers or other individualizing student data.

## 5. Anti-goals

AIC-05 fails if memory:

- becomes a second source of truth;
- stores canonical documents or whole conversations instead of compact derived professional facts;
- silently activates automatic remembering;
- records student-personal or ambiguous data;
- sends the event log or raw provenance payload to a remote provider;
- changes a canonical domain when the teacher edits or deletes a memory item;
- hides the difference between an explicit teacher memory and an inferred/derived summary.

## 6. Approaches considered

### A. New encrypted `professionalMemory` record in the existing Secure Local Vault — **SELECTED**

One new Vault record owns events, consolidated entries and category settings. The existing Vault remains the only persistence substrate.

**Why selected:** preserves encryption, lock/unlock semantics, backup/restore governance and mutation serialization; keeps memory clearly separated from canonical domains while remaining inside the same security boundary.

### B. Store memory inside Library or `meta`

**Rejected:** mixes derived AI memory with canonical source content or operational counters, making deletion/provenance and backup evolution harder to reason about.

### C. Separate IndexedDB or remote memory service

**Rejected:** creates a second persistence/security boundary, complicates backup/restore and risks remote exposure before privacy/budget governance is ready.

## 7. Data model

AIC-05 introduces `ProfessionalMemoryStateV1` with `schemaVersion: 1` and three owned collections.

### 7.1 Categories

Initial categories are deliberately professional and narrow:

- `format-preference`;
- `didactic-pattern`;
- `material-reuse`;
- `planning-continuity`;
- `workflow-preference`.

Each category has an `autoRemember` boolean. **All automatic categories default to `false`.** Manual `Ricorda questo` remains available for eligible professional content regardless of category automation.

Changing `autoRemember` is itself a durable teacher decision. Enabling a category constitutes a standing, revocable authorization for future eligible local event captures in that category. Disabling it stops future automatic captures but does not silently delete existing memories.

### 7.2 Event memory

`ProfessionalMemoryEventV1` records a compact professional event after a qualifying product outcome is already durably committed.

Initial event kinds:

- `proposal-adopted`;
- `proposal-rejected`;
- `proposal-modified`;
- `source-reused`;
- `source-linked`;
- `artifact-created`;
- `remember-explicit`.

An event contains only compact safe metadata:

- stable event id;
- kind and category;
- timestamp;
- safe professional context references (class/UDA/lesson/source ids where allowed);
- a short professional descriptor;
- provenance pointing to the canonical product outcome or explicit teacher action;
- privacy classification used at capture time.

It does **not** copy whole documents, full chat messages, student lists or canonical UDA/Library payloads.

Automatic event capture happens only when:

1. the canonical action has completed durable persistence;
2. the mapped memory category is enabled;
3. the candidate is classified as an allowed professional class;
4. no never-memory condition is present.

Memory persistence failure after a successful canonical action does not roll back the canonical action. The UI must not claim that memory was saved when it was not.

### 7.3 Consolidated professional memory

`ProfessionalMemoryEntryV1` is the inspectable compact memory used for retrieval. Each entry contains:

- id;
- category;
- compact summary;
- provenance kind: `teacher-explicit | product-event | consolidated-inference`;
- source event ids and/or canonical refs;
- created/updated timestamps;
- optional `correctedByTeacherAt`;
- lifecycle status: `active | stale`.

Version 1 consolidation is **deterministic and local**. No provider call is introduced for consolidation. The system may combine repeated safe events into a compact summary, but it must preserve provenance and may not infer personality, sensitive traits or unobserved preferences.

If a canonical reference can no longer be resolved, a derived entry becomes `stale` and is excluded from automatic retrieval. It is not silently deleted.

### 7.4 Retrieved working set

`ProfessionalMemoryWorkingSetV1` is computed locally per request from active entries. It contains at most **5** entries.

Selection prioritizes:

1. explicit teacher memories;
2. exact current UDA/lesson/source/context overlap;
3. matching professional category/discipline/context;
4. recent relevant use.

The full event log is never placed in the working set.

## 8. Privacy contract

### 8.1 Allowed classes

Memory candidates may be created only from content already classified as:

- `TEACHER_PROFESSIONAL`;
- `CURRICULUM/PLANNING`;
- `PUBLIC/EXTERNAL_CONTENT` when captured for professional use;
- `AGGREGATED_NON_IDENTIFIABLE` when it cannot be resolved back to individuals.

### 8.2 Denied classes

`STUDENT_PERSONAL` is always denied. `AMBIGUOUS` is fail-closed until explicitly reclassified through an existing safe product path.

Never-memory includes at least:

- individual grades or scores;
- behavior/discipline information;
- health information;
- PEI/PDP or equivalent individual plans;
- names, identifiers or per-student notes;
- per-student assessment/submission content;
- any derived memory that could re-identify an individual student.

### 8.3 Remote projection

The local working set may inform an already-authorized remote capability only after existing privacy minimization. The remote-bound projection may contain only compact memory summaries and category labels required by the current task.

It must not contain:

- raw event history;
- full provenance objects;
- canonical documents duplicated from UDA/Library/Planning;
- student-personal content;
- stale entries.

## 9. Persistence and backup

### 9.1 Vault integration

Implementation adds `professionalMemory` as a new `VaultRecordKey` and a corresponding encrypted record. It uses the existing `SecureVault`/`VaultStore`; no IndexedDB version bump or new object store is required.

Existing active Vaults remain unlockable when the record is absent. Absence normalizes to `createEmptyProfessionalMemoryState()` and is persisted only when an explicit memory mutation first occurs.

### 9.2 Snapshot integration

`SecureAppSnapshot` gains nullable `professionalMemory`; normalized complete application state uses a non-null `ProfessionalMemoryStateV1`.

Memory-only writes use an atomic `professionalMemory + meta` write. Canonical product actions are not widened merely to include optional derived memory.

### 9.3 Backup compatibility

Backup format advances to **v5**:

- v5 includes professional memory;
- v4/v3/v2/legacy restore normalize professional memory to the empty v1 state;
- v5 validation rejects malformed memory or forbidden persisted privacy classes;
- backup/restore round-trips memory independently of canonical-domain deletion semantics.

## 10. Mutation semantics

### 10.1 Manual `Ricorda questo`

This is a direct memory write. The teacher sees the category and compact text before confirming. Persistence success must precede the UI success state.

### 10.2 Automatic categories

Enabling an auto-memory category is an explicit durable teacher decision. Later eligible events in that category may be captured locally without a repeated modal confirmation. Disabling the category immediately stops future auto-capture.

### 10.3 Correct

Editing a memory entry modifies only professional memory, preserves provenance and records `correctedByTeacherAt`. It never edits the canonical source/UDA/planning record.

### 10.4 Remove

Deleting a memory entry/event removes it only from professional memory. It never deletes or edits the canonical artifact from which it originated.

### 10.5 Category cleanup

Disabling a category and deleting its existing memories are separate actions. Bulk category deletion requires explicit teacher confirmation.

## 11. Copilot integration

The same cross-surface Composer remains the entry point.

AIC-05 adds progressive disclosure rather than another primary navigation surface:

- a secondary `Memoria professionale` control inside the Copilot;
- `Ricorda questo` when current content/context is memory-eligible;
- an inspect/manage panel showing category, summary and provenance;
- edit/remove controls per item;
- auto-memory toggles per category;
- a compact `Ricordi pertinenti` disclosure when the current working set is non-empty.

Memory does not create or authorize a Core action. It only contributes retrieval/context evidence to already governed capabilities.

## 12. Failure and stale-state behavior

- If memory cannot be read, Copilot continues without memory and surfaces a local memory-unavailable state; it must not invent remembered facts.
- If a memory write fails, no success state is shown.
- If an automatic derived-memory write fails after a canonical action already succeeded, the canonical action remains successful and memory failure is reported non-destructively.
- Navigation/context change invalidates any pending memory retrieval result before rendering it.
- Stale canonical refs are excluded from retrieval.
- Locking the Vault makes memory unavailable exactly like other encrypted records.

## 13. Qualification contract

AIC-05 must prove at minimum:

1. manual `Ricorda questo` persists only allowed professional content and survives reload;
2. student-personal and ambiguous candidates fail closed with no memory write;
3. enabling an automatic category is explicit and durable; disabling it stops future auto-capture without deleting old items;
4. a successful canonical LINK/PREPARE outcome can create a derived event only after canonical persistence completes;
5. memory failure cannot roll back or falsify an already successful canonical action;
6. inspect/edit/remove operate only on memory and survive reload;
7. v5 backup round-trips memory; v4/v3/v2/legacy restore to empty memory;
8. the working set contains at most 5 active relevant entries and never the full event log;
9. remote-bound payload tests prove no student-personal data, raw event history or full provenance leakage;
10. desktop and 390x844 browser journeys remain touch-safe and progressive;
11. historical AIC-01…AIC-04 and Library/Core journeys remain green.

## 14. Maturity exit

Technical exit target for this slice:

- **M3 — Browser qualified** on one frozen exact candidate;
- **U2 — Guided** usability before authentic teacher validation.

M4 follows human integration into `main`. U3/M5 remains reserved for authentic post-integration teacher use.

## 15. Explicitly deferred

AIC-05 does not implement:

- AI budget escalation;
- proactive background suggestions;
- remote consolidation;
- embeddings/vector memory;
- cross-device sync;
- new material transformation capabilities;
- assessment generation;
- autonomous canonical writes.
