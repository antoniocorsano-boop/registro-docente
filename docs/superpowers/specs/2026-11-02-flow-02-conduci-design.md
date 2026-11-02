# FLOW-02 — Conduci compact lesson surface

## Intent

Implement the UX-GOV-01 `Conduci` line as a compact, mobile-first in-lesson surface that preserves the explicitly selected class and reuses existing UDA, Biblioteca, Verifiche, Privacy Shield and Copilota capabilities without duplicating their business logic.

The teacher intent is: **“Sono nella lezione/attività adesso: mostrami ciò che serve per condurla, lascia che annoti rapidamente ciò che accade e rimanda le scritture professionali durevoli a Registra.”**

Baseline: `main@981ed5a24036b1c9c39141ad14a23e26f57cc331`.
Tracker: #104.

## Goals

- Replace the generic TODAY continuation for `conduct` with a dedicated `Conduci` surface.
- Keep the explicit current class visible and authoritative.
- Show the best available lesson/activity cue from already-owned UDA data without inventing ambiguous context.
- Expose the operational items needed during class: activity/objective cue, linked-resource entry, planned verification entry, rapid staged notes, Privacy Shield state/action, optional contextual Copilota.
- Keep rapid notes session-only and clearly marked as **not yet registered**.
- Offer an explicit handoff to `Registra` while preserving the same class context.
- Qualify mobile 390×844 as a primary viewport with one-hand critical actions.

## Non-goals

- No new durable lesson-session record.
- No automatic professional write when the teacher types a rapid note.
- No evaluation, behaviour, UDA-progress or lesson-completion mutation from `Conduci`.
- No automatic class/UDA/lesson selection when multiple targets are equally plausible.
- No student-personal payload to Copilota or professional-memory contexts.
- No replacement of UDA, Biblioteca, Verifiche, Privacy or Class Dashboard specialist surfaces.
- No FLOW-03 recording forms inside this surface.

## Existing authorities preserved

- **TODAY-01** remains authority for explicit class selection before entering `Conduci`.
- **CTX-01** remains authority for professional-context reconciliation and fail-closed conflicts.
- **UDA workspace** remains authority for UDA/lesson planning data.
- **Biblioteca** remains authority for professional sources and links.
- **Verifiche online** remains authority for test administration and Student Portal.
- **Privacy Shield** remains the existing application-level privacy control; FLOW-02 only exposes its current state and delegates toggle action.
- **Copilota** remains transversal and explicitly teacher-triggered.
- **FLOW-03** will own durable recording.

## Approaches considered

### A. Router-only continuation
Keep `Conduci` as two buttons to UDA and Verifiche.

**Trade-off:** minimal code, but it does not satisfy the roadmap requirement for a compact in-lesson surface, rapid staged notes, Privacy Shield visibility or continuity toward Registra.

### B. Session-only compact orchestrator — selected
Create a dedicated `ConductLessonPanel` backed by a small pure `conductSession` resolver. It derives safe display cues from the current class plus already available UDA/lesson data, exposes links to existing specialist workspaces, stores rapid notes only in React session state, delegates Privacy Shield and Copilota actions, and hands off to the existing TODAY `record` intent.

**Why selected:** it satisfies FLOW-02 without creating a second persistence model, keeps the in-lesson UI small, and establishes the boundary required by FLOW-03.

### C. Persisted lesson-session draft
Create a durable lesson-session entity now and use it to carry notes/evidence into FLOW-03.

**Trade-off:** stronger continuity after reload, but it widens the data model, creates new professional-write semantics, complicates backup/privacy contracts and pre-empts FLOW-03. Rejected for FLOW-02.

## Context resolution

FLOW-02 must never silently choose among multiple plausible UDA/lessons.

A small pure resolver will consume:

```ts
interface ConductContextInput {
  className: string;
  udas: readonly UdaRecord[];
  todayIsoDate: string;
}
```

and return one of:

```ts
type ConductContextResolution =
  | { status: 'class-only'; className: string }
  | {
      status: 'resolved';
      className: string;
      udaId: string;
      udaTitle: string;
      lessonId?: string;
      activityLabel: string;
      objective?: string;
    }
  | { status: 'ambiguous'; className: string };
```

Rules:

1. Candidate UDAs are only those whose `className` exactly matches the explicitly selected class.
2. A lesson dated `todayIsoDate` may establish a unique current activity only when exactly one matching lesson exists across class UDAs.
3. If there is no unique dated lesson but exactly one class UDA exists, the resolver may expose that UDA as context without inventing a lesson.
4. If multiple class UDAs remain equally plausible, return `ambiguous`; show class-only mode and let the teacher open UDA explicitly.
5. `UdaLesson.topic` is the operational activity label. Existing `notes` may be shown only as a planning cue, never treated as a newly recorded observation.
6. No text similarity, AI inference or temporal guessing beyond the explicit lesson date.

## Dedicated surface

`ConductLessonPanel` replaces the generic TODAY continuation only when `todayAction === 'conduct'`.

### Header

- cue: `Oggi · Conduci`;
- current class, prominently visible;
- resolved UDA/activity when unambiguous;
- `Chiudi Conduci` action.

### In-lesson content

The panel should remain intentionally sparse and prioritize touch targets.

1. **Adesso**
   - resolved activity/topic when known;
   - UDA title when known;
   - if class-only/ambiguous: neutral copy and `Apri UDA`.

2. **Usa durante la lezione**
   - `Materiali` → Biblioteca;
   - `Verifica / attività` → Verifiche online;
   - `Apri UDA` → UDA workspace;
   - buttons are routing actions only; no mutations.

3. **Nota rapida**
   - textarea owned only by the mounted FLOW-02 surface;
   - label and helper text explicitly state `Temporanea — non ancora registrata`;
   - note is never written to Secure Local Vault, AppData, UDA, grades, behaviours, Biblioteca or memory;
   - closing/dismissing `Conduci` clears the note by unmounting the surface;
   - navigating to a specialist workspace may keep the TODAY conduct intent session state, but the note itself is not promised across unmount/reload.

4. **Privacy Shield**
   - show `Attivo` / `Disattivo` using the existing App state;
   - delegate the toggle to the existing handler;
   - no new privacy state.

5. **Copilota**
   - explicit `Chiedi supporto` action;
   - launch context includes only already-resolved professional identifiers: class, optionally UDA/lesson, plus an explicit conduct-support goal/intent supported by the Copilota contract;
   - if the existing launch intent union does not yet support `conduct`, extend it narrowly; do not add student data.

6. **Verso Registra**
   - explicit `Vai a Registra` action;
   - does not write anything;
   - switches the session-only TODAY action to `record` while retaining the same explicit class;
   - the rapid note is not silently promoted into a durable record. FLOW-03 will define staged-evidence transfer semantics separately.

## Mobile behavior

Primary qualification viewport: **390×844**.

- critical actions at least 44px high;
- no horizontal overflow;
- header and first critical action must not be covered by the sticky app header;
- Privacy Shield and `Vai a Registra` must be reachable without precision tapping;
- the textarea must remain usable with the mobile viewport and software keyboard assumptions; no fixed bottom control may cover it;
- desktop remains supported but is secondary to the mobile lesson moment.

## Privacy and authority boundaries

- Rapid notes are teacher-professional transient state but must be treated as potentially sensitive and **must not** be projected to Copilota automatically.
- Copilota receives only context identifiers and an explicit conduct-support goal, never rapid-note contents unless a later explicitly governed feature is designed.
- Existing Privacy Shield behavior is not weakened.
- `Conduci` performs no durable Promise-backed professional mutation.

## Qualification

FLOW-02 requires:

- pure resolver contract tests for unique lesson, single-UDA fallback, class-only and ambiguous cases;
- UI contract proving dedicated `Conduci` panel, staged-note copy, Privacy Shield delegation and `Vai a Registra`;
- App integration contract proving no durable note persistence and explicit Copilota handoff;
- TODAY contract proving `conduct` is removed from the generic continuation map while `record` and `review` remain unchanged;
- dedicated Chromium qualification on desktop and mobile 390×844;
- mobile geometry evidence for sticky header and critical controls;
- qualification invariant registration for guarded FLOW-02 paths;
- fresh exact-SHA Invariants, PREDEPLOY and Browser qualification;
- Final Independent Review;
- Human Product/UX Review before integration.

## Human Product/UX review questions

The human review should answer:

1. Can the teacher understand in one glance which class/activity is being conducted?
2. Is the surface small enough to use while teaching rather than administrating?
3. Is it unmistakable that the rapid note is temporary and not yet registered?
4. Is Privacy Shield immediately visible/reachable?
5. Can the teacher open material/test/UDA or ask Copilota without reconstructing context?
6. Is the transition to `Registra` explicit, safe and free of hidden writes?
