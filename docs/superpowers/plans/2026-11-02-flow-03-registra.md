# FLOW-03 Registra Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the generic TODAY `Registra` continuation with a session-only, context-preserving recording orchestrator that routes to existing authoritative forms, preserves staged evidence across failures, and offers `Rivedi` only after a successful durable mutation.

**Architecture:** Add a pure `recordSession` model and a focused `RecordLessonPanel`. App owns the session-only draft across navigation, transfers the FLOW-02 rapid note only on explicit handoff, routes each evidence kind to the existing specialist surface, and marks the flow complete only from matching successful Promise-backed mutations. Evaluation, behaviour, online submissions and the UDA lesson diary remain authoritative.

**Tech Stack:** React, TypeScript, existing TODAY/CTX/FLOW-02 orchestration, PERSIST-01H durable mutations, existing UDA workspace, Bun tests, Playwright Chromium qualification.

**Spec:** `docs/superpowers/specs/2026-11-02-flow-03-registra-design.md`

## Global Constraints

- Baseline is `main@18cbbbdb040f2f6ad08a242c469f1f55c3b3e290`.
- No new persistent recording-session, draft or evidence entity.
- No duplicate evaluation, behaviour or online-result form.
- No automatic write from FLOW-02 rapid note or FLOW-03 evidence selection.
- No arbitrary UDA/lesson selection under ambiguity.
- Existing specialist Promise-backed mutations remain authoritative.
- Failed saves must preserve specialist draft plus FLOW-03 session draft.
- Outside FLOW-03, existing specialist post-save navigation remains unchanged.
- Student-personal data must not enter professional memory, semantic memory or Copilota through FLOW-03.
- Mobile 390×844 is a primary qualification surface.
- Every product change uses RED → GREEN and exact-SHA qualification.

## Review Focus

- Class changes during a recording flow must clear or reject stale context instead of writing to the prior class; covered in Tasks 1 and 4.
- A FLOW-02 rapid note must never be persisted merely by entering FLOW-03 or selecting an evidence kind; covered in Tasks 2–4.
- A rejected evaluation/behaviour/UDA/import Promise must leave the recording session and local form draft available; covered in Tasks 4–6.
- A successful unrelated specialist mutation must not falsely complete the active recording session; covered in Task 4.
- Successful completion must not steal navigation if the teacher intentionally navigated elsewhere while the Promise was pending; covered in Task 4 and browser qualification.

---

### Task 1: Pure recording-session model and evidence routes

**Files:**
- Create: `src/recording/recordSession.ts`
- Create: `src/security/flow03RecordSessionContract.test.ts`

**Interfaces:**
- Consumes: `ConductContextResolution` and `ActiveTab`.
- Produces: `RecordEvidenceKind`, `RecordContextSnapshot`, `RecordSessionDraft`, `RecordRoute`, `buildRecordSession(...)`, `setRecordEvidenceKind(...)`, `updateRecordStagedNote(...)`, `markRecordSessionSaved(...)`, `routeForRecordEvidence(...)`.

- [ ] **Step 1: Write failing session-model tests**
  - resolved FLOW-02 context copies class/UDA/lesson/activity;
  - ambiguous/class-only context copies class only;
  - whitespace rapid note becomes absent;
  - class mismatch input is rejected/fails closed;
  - evidence routes are exactly: evaluation→`voti`, behaviour→`comportamenti`, online-outcomes→`verifiche-online`, lesson-log→`uda-gantt`;
  - status progression is `choose → editing → saved` only through explicit helpers.

- [ ] **Step 2: Run focused contract and verify RED**

Run: `bun test src/security/flow03RecordSessionContract.test.ts`

Expected: FAIL because `src/recording/recordSession.ts` does not exist.

- [ ] **Step 3: Implement minimal pure model**

No React, I/O, current-time read, storage, AI or mutation side effects.

- [ ] **Step 4: Re-run focused contract and verify GREEN**

Run: same command; expected PASS.

- [ ] **Step 5: Commit**

Commit: `feat: add FLOW-03 recording session model`

---

### Task 2: Transfer rapid note explicitly from FLOW-02

**Files:**
- Modify: `src/components/ConductLessonPanel.tsx`
- Modify: `src/components/DashboardView.tsx`
- Create: `src/security/flow03ConductHandoffContract.test.ts`

**Interfaces:**
- Changes `ConductLessonPanelProps.onGoToRecord` to `(stagedNote?: string) => void`.
- Dashboard forwards the optional note unchanged to App.

- [ ] **Step 1: Write failing handoff contract**
  - `Vai a Registra` passes `rapidNote.trim() || undefined`;
  - no storage/persistence callback is introduced in `ConductLessonPanel`;
  - Dashboard accepts/forwards the optional note;
  - class-key remount from FLOW-02 remains intact.

- [ ] **Step 2: Run contract and verify RED**

Run: `bun test src/security/flow03ConductHandoffContract.test.ts`

- [ ] **Step 3: Implement the narrow callback change**

Do not change FLOW-02 note storage beyond the explicit callback.

- [ ] **Step 4: Run FLOW-02 + FLOW-03 handoff contracts**

Run relevant FLOW-02 UI/App contracts plus the new contract; expected PASS.

- [ ] **Step 5: Commit**

Commit: `feat: hand staged conduct note to FLOW-03`

---

### Task 3: Dedicated RecordLessonPanel and TODAY delegation

**Files:**
- Create: `src/components/RecordLessonPanel.tsx`
- Modify: `src/components/DashboardView.tsx`
- Modify: `src/today/todayRouter.ts`
- Create: `src/security/flow03RecordUiContract.test.ts`
- Modify: `src/security/today01ContinuationContract.test.ts`

**Interfaces:**
- Consumes `RecordSessionDraft`.
- Props include `onChangeStagedNote`, `onChooseEvidence`, `onReview`, `onRecordAnother`, `onDismiss`.
- Generic TODAY continuation remains only `review` after this task.

- [ ] **Step 1: Write failing UI/TODAY contracts**
  - visible `Oggi · Registra` + current class;
  - optional safe UDA/activity cue;
  - staged-note label exact `Bozza temporanea — non ancora registrata`;
  - exactly four primary evidence choices;
  - saved state shows `Registrazione completata`, `Rivedi`, `Registra altro`;
  - critical buttons min-height 44px;
  - `TodayContinuationAction` excludes `prepare`, `conduct`, `record`; generic continuation map contains only `review`.

- [ ] **Step 2: Run contracts and verify RED**

Run: `bun test src/security/flow03RecordUiContract.test.ts src/security/today01ContinuationContract.test.ts`

- [ ] **Step 3: Implement panel and Dashboard/TODAY delegation**

No specialist form or durable mutation in the panel.

- [ ] **Step 4: Re-run and verify GREEN**

Same command; expected PASS.

- [ ] **Step 5: Commit**

Commit: `feat: add FLOW-03 registra panel`

---

### Task 4: App session orchestration and authoritative completion

**Files:**
- Modify: `src/App.tsx`
- Create: `src/security/flow03AppIntegrationContract.test.ts`

**Interfaces:**
- App owns `recordSession` + synchronized ref.
- Produces handlers:
  - `handleContinueFromConductToRecord(stagedNote?)`;
  - `handleChooseRecordEvidence(kind)`;
  - `handleUpdateRecordStagedNote(note)`;
  - `handleRecordAnother()`;
  - `handleContinueRecordToReview()`;
  - `completeRecordFlow(kind)` guarded by current session/class.

- [ ] **Step 1: Write failing App integration contract**
  - recording session is React/ref session state, absent from secure snapshots and backup payload;
  - conduct handoff builds draft from explicit current class + safe conduct context;
  - evidence selection routes without mutation and keeps TODAY action `record`;
  - successful evaluation/behaviour/import operations call matching completion only after authoritative Promise resolves;
  - mismatched/unrelated mutations do not complete the flow;
  - failure leaves session `editing`;
  - navigation-version guard prevents a pending save from stealing deliberate navigation;
  - Home/class change/backup restore/factory reset clears stale recording session;
  - `Rivedi` changes TODAY action to `review` for the same class without forcing an analysis tab.

- [ ] **Step 2: Run contract and verify RED**

Run: `bun test src/security/flow03AppIntegrationContract.test.ts`

- [ ] **Step 3: Implement minimal App orchestration**

Preserve existing post-save routes when no matching FLOW-03 session is active.

- [ ] **Step 4: Re-run App contract plus PERSIST/CTX regression contracts**

Expected: PASS.

- [ ] **Step 5: Commit**

Commit: `feat: orchestrate FLOW-03 recording lifecycle`

---

### Task 5: Safe evaluation context preselection

**Files:**
- Modify: `src/components/EvaluationsView.tsx`
- Modify: App render wiring as required
- Create: `src/security/flow03EvaluationPrefillContract.test.ts`

**Interfaces:**
- Add optional `initialUdaId?: string`, `initialDate?: string` for new evaluations only.

- [ ] **Step 1: Write failing prefill contract**
  - safe UDA/date initialize only a new evaluation;
  - editing an existing batch ignores FLOW-03 initial values;
  - invalid/non-class UDA is not silently selected;
  - teacher can edit/clear the preselection before save;
  - no auto-submit or changed Promise semantics.

- [ ] **Step 2: Run and verify RED**

Run: `bun test src/security/flow03EvaluationPrefillContract.test.ts`

- [ ] **Step 3: Implement minimal initial-context props and App wiring**

- [ ] **Step 4: Run focused plus PERSIST evaluation contracts; verify GREEN**

- [ ] **Step 5: Commit**

Commit: `feat: prefill FLOW-03 evaluation context safely`

---

### Task 6: UDA diary handoff for note/activity/progress

**Files:**
- Modify: `src/components/UdaWorkspaceView.tsx`
- Modify: `src/components/UdaGanttView.tsx`
- Modify: App render wiring as required
- Create: `src/security/flow03UdaDiaryHandoffContract.test.ts`

**Interfaces:**
- Add `RecordLessonPrefill` and optional `recordLessonPrefill`, `onRecordLessonCommitted` props.
- Existing `handleAddLesson` remains the durable authority.

- [ ] **Step 1: Write failing UDA handoff contract**
  - safe `udaId`/same class opens the existing UDA planning/detail path and initializes new-lesson date/topic/note only;
  - missing/invalid/mismatched UDA does not auto-select a target;
  - staged note is editable before save and not written on mount;
  - `onRecordLessonCommitted` fires only inside successful `handleAddLesson` commit callback;
  - rejected save preserves new-lesson form values and FLOW-03 session.

- [ ] **Step 2: Run and verify RED**

Run: `bun test src/security/flow03UdaDiaryHandoffContract.test.ts`

- [ ] **Step 3: Implement narrow prefill + completion callback**

Do not add a second UDA mutation path.

- [ ] **Step 4: Run focused UDA/PERSIST regression contracts; verify GREEN**

- [ ] **Step 5: Commit**

Commit: `feat: hand FLOW-03 notes to authoritative UDA diary`

---

### Task 7: Browser qualification, invariant and exact-SHA gates

**Files:**
- Create: `tests/browser/flow-03-registra.spec.cjs`
- Modify: `.github/workflows/browser-qualification.yml`
- Modify: `qualification/invariants.v1.json`
- Create: `src/security/flow03BrowserQualificationContract.test.ts`
- Create: `src/security/flow03QualificationContract.test.ts`

**Interfaces:**
- Produces `FLOW-03-I01` and deterministic desktop/mobile evidence.

- [ ] **Step 1: Write RED qualification/browser contracts**
  - workflow invokes dedicated FLOW-03 spec;
  - invariant guards recording model, panel, App/Dashboard/TODAY, specialist prefill paths and browser spec;
  - mobile viewport evidence 390×844 required.

- [ ] **Step 2: Add Playwright journeys**
  1. `Conduci → rapid note → Registra → Attività/nota UDA → durable save → confirmation → Rivedi`;
  2. `Oggi → Registra → Valutazione` with same class and reviewable UDA preselection;
  3. `Oggi → Registra → Comportamento` with no inferred status;
  4. `Oggi → Registra → Esiti verifica online` with no auto-import;
  5. mobile no horizontal overflow, controls ≥44px and staged-note textarea unobscured.

- [ ] **Step 3: Register `FLOW-03-I01`**

Statement: `Registra is a session-only recording orchestrator: it preserves explicit professional context, carries staged lesson evidence without auto-writing it, delegates all durable writes to authoritative specialist surfaces, preserves drafts on failure, and offers Rivedi only after a matching successful durable mutation.`

- [ ] **Step 4: Run focused tests, typecheck/build and regression suite**

Expected: PASS.

- [ ] **Step 5: Push exact candidate and run fresh exact-SHA gates**

Required:
- Qualification Invariants — PASS;
- PREDEPLOY Security Qualification — PASS;
- Browser Qualification — PASS including FLOW-03 desktop/mobile plus historical regressions.

- [ ] **Step 6: Final Independent Review**

Require 0 Critical / 0 Important or rework.

- [ ] **Step 7: Human Product/UX Review**

Decision PASS or causal REWORK before integration.

- [ ] **Step 8: Do not merge without separate explicit authorization**

Keep the PR open/Ready only after all gates and Human Product/UX PASS.
