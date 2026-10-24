# LIB-01C Deterministic Teaching Context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evolvere la PR #41 dal contratto manual-only a una proposta deterministica e spiegabile di UDA/lezione che il docente può sempre cambiare prima del collegamento.

**Architecture:** Il resolver verticale `teachingContext.ts` usa soltanto contesto esplicito, classe corrente, data/periodo e ultima scelta esplicita della sessione. La UI distingue suggerimento e selezione finale; il Contextual Copilot Core continua a ricevere solo il contesto minimizzato e a governare il `LINK` con conferma umana.

**Tech Stack:** React 19, TypeScript 7, Bun 1.4.4, `@trama/contextual-copilot-core@0.1.0`, Playwright 1.64.1.

**Spec:** `docs/superpowers/specs/2026-10-24-lib-01c-teaching-context-design.md`

## Global Constraints

- Baseline di integrazione: `main@ab1e23c1014dc96231aa92cfe8cf6e39a47c50a0`; branch esistente PR #41.
- Nessuna AI, embedding, semantic search o similarità testuale per proporre il contesto.
- Nessuna scelta arbitraria in caso di candidati equivalenti.
- Il docente può sempre cambiare la proposta prima della mutazione.
- Nessun contenuto fonte/UDA/lezione nel `ContextSnapshot` oltre ai metadati strutturali già ammessi.
- `unknown -> STUDENT_PERSONAL`; teaching context valido aggiunge `CURRICOLO`.
- `remoteProviderAllowed = false`; `generativeMode = none`.
- Nessun nuovo dominio persistente materiali/attività e nessuno store globale del contesto.
- RED causale prima di ogni GREEN comportamentale; exact-SHA per la qualifica.
- Dati browser esclusivamente sintetici; nessuna rete esterna nel journey governato.
- Nessun merge/deploy automatico.

## Review Focus

- Più lezioni odierne o più UDA attive non devono produrre un tie-break nascosto; test in Task 1.
- `lastExplicitChoice` stale, cross-class o lesson↔UDA incoerente deve essere ignorato; test in Task 1.
- Cambio della proposta verso una selezione manuale deve annullare qualunque conferma `LINK` precedente; test in Task 2.
- Un target eliminato tra proposta e dispatch deve fallire chiuso e non mutare; test in Task 2.
- Failure di persistenza dopo conferma deve preservare la selezione finale per retry senza falso successo; browser test in Task 3.

---

### Task 1: Deterministic teaching-context suggestion resolver

**Files:**
- Modify: `src/library/teachingContext.ts`
- Modify: `src/security/lib01cTeachingContextContract.test.ts`

**Interfaces:**
- Consumes: `UdaRecord[]`, current class name, optional explicit origin, optional last explicit choice, injected local date.
- Produces:
  - `TeachingContextSuggestionReason`
  - `TeachingContextSuggestion`
  - `suggestLibraryTeachingContext(input): TeachingContextSuggestion | null`
  - existing `resolveLibraryTeachingContext(udas, context)` remains the structural validator.

- [ ] **Step 1: Write failing behavior tests for the new suggestion contract**

Add real behavior tests that prove these hand-derived outcomes:
- valid explicit origin wins over all other signals;
- exactly one lesson today in current class -> `current-class-today-lesson`;
- no unique lesson today + exactly one active UDA -> `current-class-active-uda`;
- multiple equivalent candidates -> `null`;
- July/August do not derive active UDA;
- valid same-class session last choice -> `session-last-choice` only after stronger signals fail;
- stale/cross-class/foreign lesson last choice -> `null`;
- invalid explicit origin falls through rather than being “repaired”.

Production mutation each test must catch: wrong priority, arbitrary first-item selection, wrong school-month mapping, missing ownership/class validation, or hidden fallback.

- [ ] **Step 2: Run PREDEPLOY on the test-only SHA and verify causal RED**

Expected: existing suite remains green except the new suggestion tests, which fail because `suggestLibraryTeachingContext`/types do not exist or do not satisfy the new contract. Typecheck/build/startup must not be the root cause.

- [ ] **Step 3: Implement the minimal deterministic resolver**

Exact API:

```ts
export type TeachingContextSuggestionReason =
  | 'explicit-origin'
  | 'current-class-today-lesson'
  | 'current-class-active-uda'
  | 'session-last-choice';

export interface TeachingContextSuggestion {
  context: LibraryTeachingContext;
  reason: TeachingContextSuggestionReason;
}

export interface SuggestLibraryTeachingContextInput {
  udas: UdaRecord[];
  currentClassName?: string | null;
  explicitContext?: LibraryTeachingContext | null;
  lastExplicitChoice?: LibraryTeachingContext | null;
  today: string;
}

export function suggestLibraryTeachingContext(
  input: SuggestLibraryTeachingContextInput
): TeachingContextSuggestion | null;
```

Use `resolveLibraryTeachingContext` for structural validation. Do not inspect titles, descriptions, topics, notes or source content.

- [ ] **Step 4: Run full security suite and PREDEPLOY**

Expected: all tests PASS.

- [ ] **Step 5: Commit**

Commit message: `feat: suggest deterministic LIB-01C teaching context`.

### Task 2: Proposal UX and teacher override

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/LibraryView.tsx`
- Modify: `src/components/LibrarySourceCard.tsx`
- Modify: `src/security/lib01cTeachingContextContract.test.ts`

**Interfaces:**
- Consumes Task 1 `suggestLibraryTeachingContext` and existing `resolveLibraryTeachingContext`.
- `App` supplies the current class name already derived from `appData.currentClassId`.
- `LibraryView` carries only current class metadata and session-local last explicit choice; it does not persist a new domain object.
- `LibrarySourceCard` receives optional current class name, optional explicit context, and callbacks/state needed for session last choice.

- [ ] **Step 1: Write failing UI/behavior contract tests**

Prove observable behavior, not source-string presence:
- opening `Usa` with a unique current-class candidate initializes the selected context from the suggestion;
- suggestion displays a deterministic explanation and a `Cambia` control;
- `Cambia` allows selecting another UDA/lesson and the final selection replaces the suggestion;
- manual selection is remembered only as session state for subsequent sources;
- no suggestion -> manual chooser starts unselected;
- changing UDA resets lesson and any pending link confirmation;
- target removed/stale before dispatch -> no write;
- `ContextSnapshot` and Core dispatch use the final teacher selection, not the original suggestion.

- [ ] **Step 2: Verify RED on exact test-only SHA**

Expected: new LIB-01C proposal/override tests fail while Task 1 resolver tests and prior LIB-01A/B/C manual-context tests remain green.

- [ ] **Step 3: Implement minimal signal plumbing and proposal UX**

Required behavior:
- pass `currentClass?.name ?? null` from `App` to `LibraryView`;
- keep `lastExplicitChoice` in `LibraryView` component state only;
- compute suggestion when a source becomes selected using injected/current local `YYYY-MM-DD` at the UI boundary;
- initialize card selection from suggestion only when the teacher has not already overridden that selected source;
- render `Contesto proposto` + reason copy when suggestion exists;
- render `Cambia` always before mutation; if no suggestion render `Scegli dove usarla`;
- any explicit teacher selection becomes the final context and updates session last choice;
- preserve existing Core human-confirmation gate and `onLink` persistence path.

Do not add persistence for the suggestion or last choice.

- [ ] **Step 4: Run full security suite, typecheck and PREDEPLOY**

Expected: all PASS.

- [ ] **Step 5: Commit**

Commit message: `feat: let teachers override suggested library context`.

### Task 3: Permanent browser qualification for suggestion + override

**Files:**
- Modify: `tests/browser/lib01c-teaching-context-qualification.spec.cjs`
- Modify only if needed for registration: `.github/workflows/browser-qualification.yml`

**Interfaces:**
- Consumes Task 2 UI and existing synthetic vault/browser helpers.
- Produces permanent desktop/mobile evidence for suggestion, override and fail-closed ambiguity.

- [ ] **Step 1: Update browser test first so it fails against the manual-only UI**

Desktop synthetic journey:
- create current class + one active UDA/lesson candidate and a source;
- `Usa` must show a proposed context and reason without manual preselection;
- click `Cambia`, choose a different valid UDA/lesson;
- `Continua` must show confirmation without persistence;
- `Conferma collegamento` must persist the teacher override, not the initial suggestion;
- reload and verify the final link;
- force an ambiguous fixture and verify no context is preselected;
- persistence failure path preserves the final selection for retry;
- network guard begins with the contextual journey and records zero external requests.

Mobile 390x844:
- proposal, `Cambia` and chooser are usable;
- relevant controls >=44x44;
- no horizontal overflow and zero page errors.

- [ ] **Step 2: Run Browser Qualification and observe causal RED before product/browser helper fixes**

Expected: new suggestion assertions fail against the current manual-only behavior; unrelated browser gates stay green.

- [ ] **Step 3: Make only test-fixture corrections that are necessary to express the approved behavior**

Do not weaken selectors into broad false positives and do not add network allowlists.

- [ ] **Step 4: Qualify one exact candidate**

On the same SHA require:
- PREDEPLOY full PASS;
- Browser Qualification full PASS;
- exact checkout equality;
- desktop + mobile LIB-01C PASS;
- zero external requests during governed journey.

- [ ] **Step 5: Review final diff and update PR #41 receipt**

PR body must supersede the manual-only qualification, identify new RED/GREEN exact SHAs and final receipts, and state `READY FOR HUMAN INTEGRATION DECISION · NO MERGE · NO DEPLOY` only if all gates are green.

- [ ] **Step 6: Stop at human integration decision**

No merge or deploy.