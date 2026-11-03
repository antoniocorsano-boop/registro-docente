# FLOW-03 — Registra outcome orchestrator

## Intent

Implement the UX-GOV-01 `Registra` line as a context-preserving recording orchestrator that routes the teacher to the existing authoritative recording surfaces, carries only explicitly staged session evidence from `Conduci`, waits for the authoritative durable mutation, then offers `Rivedi` as an optional continuation.

The teacher intent is: **“Ho concluso o sto chiudendo una lezione: fammi registrare ciò che è realmente accaduto senza ricostruire classe e contesto, senza scritture nascoste e senza duplicare i registri già esistenti.”**

Baseline: `main@18cbbbdb040f2f6ad08a242c469f1f55c3b3e290`.
Tracker: #104.

## Goals

- Replace the generic TODAY continuation for `record` with a dedicated `Registra` surface.
- Preserve the explicitly selected class from TODAY/FLOW-02.
- Preserve unambiguous UDA/lesson context already resolved by FLOW-02; never infer a missing target under ambiguity.
- Transfer the FLOW-02 rapid note into FLOW-03 only as session-only staged evidence, clearly marked as not yet saved.
- Route evidence to existing authoritative specialist surfaces:
  - evaluations → `Valutazioni`;
  - behaviour → `Comportamento`;
  - online-test outcomes → `Verifiche online` import;
  - professional note/observation, lesson/activity completion and UDA progress → existing UDA lesson diary.
- Let the authoritative surface own validation, review and durable Promise-backed mutation.
- Keep staged evidence available if a durable save fails.
- After a successful recording mutation, return to a compact confirmation state that offers `Rivedi` without forcing navigation.
- Keep mobile 390×844 as a primary qualification viewport.

## Non-goals

- No new evaluation, behaviour or online-result form.
- No new persistent `record-session`, `lesson-session`, draft or evidence entity.
- No automatic professional write when entering `Registra` or selecting an evidence type.
- No automatic promotion of the FLOW-02 rapid note into an UDA lesson.
- No arbitrary UDA/lesson choice when context is ambiguous or missing.
- No student-personal payload to Copilota or professional memory.
- No change to the canonical persistence semantics established by PERSIST-01/PERSIST-01H.
- No FLOW-04 analytical redesign; `Rivedi` remains the existing TODAY action until FLOW-04.

## Existing authorities preserved

- **TODAY-01** remains authority for explicit class selection.
- **CTX-01** remains authority for professional-context consistency and fail-closed class mismatch.
- **FLOW-02** remains the in-lesson session surface; its rapid note remains transient until the teacher explicitly continues to `Registra`.
- **EvaluationsView** remains the only evaluation form and its `onSaveEvaluations` Promise is authoritative.
- **BehaviorsView** remains the only behaviour form and its `onSaveBehaviors` Promise is authoritative.
- **VerificheOnlineView** remains authority for online submissions and the explicit import-to-register operation.
- **UDA workspace / lesson diary** remains authority for durable lesson/activity notes and logged hours.
- **FLOW-04** will own the redesigned review loop; FLOW-03 only offers the existing `Rivedi` continuation.

## Approaches considered

### A. Expand the generic TODAY continuation

Add more buttons to the current `Registra` continuation strip.

**Trade-off:** minimal code, but it cannot safely carry the FLOW-02 staged note, track completion across specialist surfaces, or distinguish an attempted durable save from a successful one. It would remain a navigation menu rather than the FLOW-03 workflow required by UX-GOV-01.

### B. Session-only recording orchestrator — selected

Create a focused `RecordLessonPanel` plus a small `recordSession` model owned only by App session state. The panel displays class/context, shows any transferred rapid note as an unsaved draft, lets the teacher choose the evidence type, then routes to existing specialist forms. App keeps the recording session alive across navigation. Only the authoritative specialist mutation can mark it `saved`; after that the panel offers `Rivedi`.

**Why selected:** it satisfies context continuity and failure recovery without introducing a second persistence model or duplicating specialist business logic.

### C. New persistent evidence inbox

Persist rapid notes and evidence items before the specialist form, then reconcile them later.

**Trade-off:** stronger recovery across reloads, but it creates a new durable data model, privacy/backup semantics and reconciliation authority that the roadmap does not require. Rejected for FLOW-03.

## Session model

Create a small pure model in `src/recording/recordSession.ts`.

```ts
export type RecordEvidenceKind =
  | 'evaluation'
  | 'behaviour'
  | 'online-outcomes'
  | 'lesson-log';

export interface RecordContextSnapshot {
  classId: string;
  className: string;
  udaId?: string;
  udaTitle?: string;
  lessonId?: string;
  activityLabel?: string;
}

export interface RecordSessionDraft {
  context: RecordContextSnapshot;
  stagedNote?: string;
  evidenceKind?: RecordEvidenceKind;
  status: 'choose' | 'editing' | 'saved';
}
```

Rules:

1. `classId` and `className` come only from the explicitly selected current class.
2. UDA/lesson identifiers may be copied only from a FLOW-02 `resolved` context. `ambiguous` and `class-only` contexts remain class-only.
3. `stagedNote` is copied only when the teacher presses `Vai a Registra`; blank/whitespace-only text becomes absent.
4. The draft lives in React/App session state only. It is not included in Secure Local Vault snapshots, backup payloads, professional memory, Copilota context or URL state.
5. Selecting an evidence kind moves the session to `editing` and routes to the corresponding existing surface; it performs no mutation.
6. Only an observed successful specialist mutation changes status to `saved`.
7. A rejected/failed Promise leaves the session in `editing` and preserves the draft.
8. Changing class, returning Home, restoring backup, factory reset or explicitly closing the flow clears the recording session.

## FLOW-02 handoff

`ConductLessonPanel` changes only its callback contract:

```ts
onGoToRecord: (stagedNote?: string) => void;
```

The button passes `rapidNote.trim() || undefined`. This is not a write. App builds the `RecordSessionDraft` from the current explicit class plus safe FLOW-02 context and switches TODAY intent to `record`.

The note must not be sent to Copilota or professional memory and must not be saved automatically.

## Dedicated Registra surface

`RecordLessonPanel` replaces the generic TODAY continuation only for `todayAction === 'record'`.

### Header

- cue: `Oggi · Registra`;
- current class prominently visible;
- resolved UDA/activity when known;
- `Chiudi Registra` clears only the session flow.

### Staged evidence

If a rapid note arrived from FLOW-02:

- show it in a compact editable textarea owned by FLOW-03 session state;
- label: `Bozza temporanea — non ancora registrata`;
- editing it changes only session state;
- clearing it is allowed;
- no automatic projection to any specialist form except the explicitly selected UDA diary handoff described below.

### Evidence choices

1. **Valutazione** → `voti`.
   - Existing `EvaluationsView` remains authoritative.
   - If a safe UDA id exists, it may be supplied as an initial selection; the teacher still sees and may change it before saving.

2. **Comportamento** → `comportamenti`.
   - Existing `BehaviorsView` remains authoritative.
   - No automatic behaviour values are inferred.

3. **Esiti verifica online** → `verifiche-online`.
   - Existing explicit import action remains authoritative.
   - No import is triggered merely by entering the surface.

4. **Attività / nota UDA** → `uda-gantt`.
   - Existing lesson diary is authoritative.
   - When a safe UDA id exists, FLOW-03 may open that UDA and prefill the new-lesson draft with date, activity label and staged note.
   - When no safe UDA id exists, the workspace opens filtered to the current class where possible but does not select a UDA automatically.
   - The teacher reviews topic, hours, note and activity type before pressing the existing save action.

## Specialist handoff contracts

### Evaluations

Add optional session-only initial context props to `EvaluationsView` only where required:

```ts
initialUdaId?: string;
initialDate?: string;
```

They initialize a new record only; they do not overwrite an existing edited batch and do not bypass teacher review.

The existing durable save Promise remains unchanged.

### Behaviour

No new form fields are prefilled beyond the already current class/date behavior. FLOW-03 only marks the route as recording-related and waits for `onSaveBehaviors` success.

### Online outcomes

No automatic import. FLOW-03 completion is observed only after `onImportSubmissionsToRegister(...)` resolves successfully from the explicit user action.

### UDA lesson diary

Extend `UdaWorkspaceView`/legacy `UdaGanttView` with an optional session-only recording handoff:

```ts
interface RecordLessonPrefill {
  className: string;
  udaId?: string;
  date: string;
  topic?: string;
  notes?: string;
}

recordLessonPrefill?: RecordLessonPrefill;
onRecordLessonCommitted?: () => void;
```

The prefill may initialize the existing new-lesson fields but must not call `onSaveUdas`. `onRecordLessonCommitted` fires only from the existing `handleAddLesson` success callback after `commitUdaViewMutation(...)` returns success.

If `udaId` is missing or no longer exists for the same class, no UDA is auto-selected and no staged note is silently written.

## Completion semantics

App owns a session-only `recordSession` plus a ref synchronized with it so Promise completion handlers can read the current flow without stale closures.

A specialist save may complete FLOW-03 only if all of the following match:

- current recording session status is `editing`;
- its `evidenceKind` matches the specialist operation;
- the current explicit class id still matches the session context;
- for UDA diary completion, the committed UDA is the expected safe target when one was provided.

On success:

- set session status to `saved`;
- keep class/context visible;
- return to Dashboard/`Registra` confirmation if the user has not deliberately navigated elsewhere during the pending mutation;
- show `Registrazione completata` and two actions:
  - `Rivedi` → set TODAY action to `review` for the same class;
  - `Registra altro` → reset to `choose` while keeping the same class/context.

Do not force `Rivedi`.

Outside FLOW-03, existing post-save navigation behavior remains unchanged.

## Failure and concurrent-navigation semantics

- Existing specialist forms already preserve their local drafts on rejected saves; FLOW-03 must not clear the session on failure.
- Use the repository’s existing navigation-version pattern: if the teacher intentionally navigates while a save is pending, successful completion may mark the session saved but must not steal navigation back.
- Double-submit guards remain owned by the specialist forms and must not be weakened.
- Closing FLOW-03 while a specialist save is pending must not cancel or reinterpret the durable mutation; it only removes the orchestration session.

## Mobile behavior

Primary qualification viewport: **390×844**.

- evidence choices are vertically scannable and at least 44px high;
- class/context and staged-note status are visible without horizontal scrolling;
- staged-note textarea is not covered by sticky/floating controls;
- success actions `Rivedi` and `Registra altro` remain reachable with one-hand use;
- no second evaluation/behaviour form is rendered inside the panel.

## Privacy and authority boundaries

- A FLOW-02/FLOW-03 staged note may contain sensitive teacher observations; it stays session-only until the teacher explicitly selects the UDA diary and confirms the existing lesson form.
- Staged note contents never enter Copilota, professional memory, semantic memory or analytics automatically.
- Student-personal data remains inside the existing evaluation, behaviour and online-submission surfaces.
- FLOW-03 never writes directly to `secureStorage`; it observes authoritative Promise-backed handlers already owned by the specialist domains.

## Qualification

FLOW-03 requires:

- pure recording-session contract tests for safe context snapshot, note normalization, evidence routes and fail-closed UDA handling;
- UI contract proving dedicated `Registra` panel, staged-note copy, four evidence choices and saved-state actions;
- FLOW-02 handoff contract proving the rapid note is passed only on explicit `Vai a Registra` and is not persisted;
- App integration contract proving session-only state, matching specialist completion, failure preservation and existing navigation outside FLOW-03;
- specialist prefill contracts proving evaluation/UDA context is reviewable and does not auto-save;
- TODAY contract proving `record` is removed from the generic continuation map while `review` remains unchanged;
- dedicated Chromium qualification on desktop and mobile 390×844;
- browser evidence for `Conduci → Registra → UDA diary`, `Oggi → Registra → Valutazione`, failed-save draft preservation where deterministic, and successful `Registra → Rivedi` offer;
- qualification invariant registration for guarded FLOW-03 paths;
- fresh exact-SHA Invariants, PREDEPLOY and Browser qualification;
- Final Independent Review;
- Human Product/UX Review before integration.

## Human Product/UX review questions

1. Does `Registra` feel like the natural continuation of the lesson rather than another dashboard?
2. Is it always clear what is still a temporary draft versus what has been durably saved?
3. Can the teacher choose the correct evidence type without understanding the internal module structure?
4. Is class/UDA context preserved when safe but never guessed when ambiguous?
5. After a successful save, is `Rivedi` clearly available without being forced?
6. On mobile, can the entire recording loop be completed without precision tapping or duplicated data entry?
