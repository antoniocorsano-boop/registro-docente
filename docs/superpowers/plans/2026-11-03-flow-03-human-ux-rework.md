# FLOW-03 Human Product/UX Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chiudere i due finding Important della Human Product/UX Review di FLOW-03 mantenendo `Registra` percepibile come un unico gesto professionale e riducendo l'UDA a una registrazione focalizzata quando l'ingresso nasce dall'orchestratore.

**Architecture:** `App` possiede il contesto visivo della missione e rende un banner riusabile sopra le superfici specialistiche; nessuna superficie specialistica diventa consapevole della persistenza FLOW-03. `UdaWorkspaceView` gestisce la scelta UDA esplicita e passa al legacy UDA un `focusedRecordMode`, che riusa lo stesso fascicolo/diario e la stessa mutazione autorevole nascondendo inizialmente le sezioni non necessarie.

**Tech Stack:** React, TypeScript, Tailwind utility classes, Bun tests, Playwright Chromium qualification.

**Spec:** `docs/superpowers/specs/2026-11-03-flow-03-human-ux-rework-design.md`

## Global Constraints

- PR #110 resta Draft durante il rework.
- Nessun nuovo modulo specialistico o percorso di persistenza.
- Nessuna nuova entità persistente.
- Nessuna scrittura automatica o selezione automatica di UDA sotto ambiguità.
- `handleAddLesson` + `commitUdaViewMutation` restano l'unica autorità del diario UDA.
- Navigazione ordinaria continua a invalidare FLOW-03; il solo ritorno esplicito dalla missione mantiene la sessione.
- I finding Moderate restano fuori scope in FLOW-03B / issue #111.
- Mobile 390×844 è superficie primaria.
- Nessun merge o deploy senza autorizzazione separata.

## Review Focus

- Il banner non deve apparire in una superficie specialistica standalone aperta fuori da FLOW-03.
- `Torna a Registra` deve preservare la stessa sessione ma non deve far sopravvivere la sessione a una navigazione ordinaria diversa.
- Una sessione di classe A non deve mostrare banner o UDA focalizzata dopo passaggio a classe B.
- La scelta manuale UDA deve essere limitata alla classe della sessione e non deve scrivere nulla.
- L'espansione `Mostra dettagli UDA` deve rivelare lo stesso fascicolo autorevole senza cambiare i valori già presenti nel diario.

---

### Task 1: Mission context persistente nelle superfici specialistiche

**Files:**
- Create: `src/components/RecordMissionBanner.tsx`
- Modify: `src/App.tsx`
- Create: `src/security/flow03MissionContinuityContract.test.ts`

**Interfaces:**
- `RecordMissionBannerProps`: `className: string`, `evidenceKind: RecordEvidenceKind`, `udaTitle?: string`, `activityLabel?: string`, `onReturn: () => void`.
- `App.handleReturnToRecord(): void` conserva `recordSession`, imposta `todayAction='record'`, torna a `dashboard` tramite `setActiveTab`.
- Il banner è renderizzato soltanto quando la sessione editing è coerente con classe e route specialistica corrente.

- [ ] **Step 1: Scrivere il contratto RED**
  - richiede il nuovo componente;
  - richiede copia `Stai registrando ·` e `Torna a Registra`;
  - richiede target touch `min-h-[44px]`;
  - richiede in `App` un matcher route/evidence che impedisca banner standalone o su classe diversa;
  - richiede `handleReturnToRecord` senza `publishRecordSession(null)`.

- [ ] **Step 2: Eseguire il contratto e verificare RED**

Run: `bun test src/security/flow03MissionContinuityContract.test.ts`

Expected: FAIL perché `RecordMissionBanner.tsx` non esiste.

- [ ] **Step 3: Implementare `RecordMissionBanner` e wiring App minimo**
  - nessun callback di salvataggio;
  - nessuna modifica a `EvaluationsView`, `BehaviorsView` o `VerificheOnlineView`;
  - render del banner immediatamente prima della superficie specialistica attiva.

- [ ] **Step 4: Verificare GREEN + regressione App FLOW-03**

Run: `bun test src/security/flow03MissionContinuityContract.test.ts src/security/flow03AppIntegrationContract.test.ts src/security/flow03IndependentReviewRepairs.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Commit: `feat(flow-03): keep recording mission visible across specialists`

---

### Task 2: Selezione UDA esplicita e workspace focalizzato

**Files:**
- Modify: `src/components/UdaWorkspaceView.tsx`
- Create: `src/security/flow03FocusedUdaWorkspaceContract.test.ts`

**Interfaces:**
- `focusedRecordUdaId: string | null` è stato locale session-only del workspace.
- `effectiveRecordLessonPrefill` deriva dal prefill originale; aggiunge `udaId` solo dopo click esplicito su una UDA della stessa classe.
- In focus, `activeView='uda'` quando manca `udaId`, altrimenti `activeView='planning'`.
- `LegacyUdaGanttView` riceve `focusedRecordMode={true}` soltanto quando il focus FLOW-03 è attivo.

- [ ] **Step 1: Scrivere contratto RED**
  - senza `udaId`, focus iniziale sulla scelta UDA e filtro bloccato alla classe sessione;
  - azione exact `Scegli questa UDA`;
  - nessuna `+ Nuova UDA`, nessun selettore `Viste UDA`, nessun cambio classe in focus;
  - la scelta produce un prefill derivato con `udaId` e non chiama `onSaveUdas`;
  - con `udaId` già sicuro si entra direttamente in pianificazione focalizzata.

- [ ] **Step 2: Eseguire e verificare RED**

Run: `bun test src/security/flow03FocusedUdaWorkspaceContract.test.ts`

- [ ] **Step 3: Implementare focus nel workspace**
  - riusare le UDA già filtrate per classe;
  - non creare nuovi record o side effect;
  - mantenere il comportamento ordinario identico quando `recordLessonPrefill` è assente.

- [ ] **Step 4: Verificare GREEN + regressioni UDA handoff**

Run: `bun test src/security/flow03FocusedUdaWorkspaceContract.test.ts src/security/flow03UdaDiaryHandoffContract.test.ts src/security/flow03ManualUdaSelectionNoteContract.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Commit: `feat(flow-03): focus UDA choice for recording handoff`

---

### Task 3: Fascicolo UDA in modalità registrazione rapida

**Files:**
- Modify: `src/components/UdaGanttView.tsx`
- Modify: `src/components/UdaWorkspaceView.tsx`
- Create: `src/security/flow03FocusedUdaDiaryContract.test.ts`

**Interfaces:**
- `UdaGanttViewProps.focusedRecordMode?: boolean`.
- Stato locale `showFocusedRecordDetails: boolean`, default `false`, resettato per ogni nuova firma di `recordLessonPrefill`.
- Quando `focusedRecordMode` è attivo e il fascicolo è aperto, il diario conserva gli stessi state fields e `handleAddLesson` esistenti.

- [ ] **Step 1: Scrivere contratto RED**
  - prop `focusedRecordMode` presente e passata dal workspace;
  - focus nasconde workflow bar/KPI/sub-navigation e viste diagnostiche sottostanti;
  - intestazione exact `Registrazione rapida`;
  - sezione Diario sempre presente;
  - propedeuticità, descrizione, competenze e storico lezioni protetti da disclosure;
  - pulsante exact `Mostra dettagli UDA`, target touch ≥44px;
  - `handleAddLesson` e `commitUdaViewMutation` restano invariati come autorità.

- [ ] **Step 2: Eseguire e verificare RED**

Run: `bun test src/security/flow03FocusedUdaDiaryContract.test.ts`

- [ ] **Step 3: Implementare la disclosure nel fascicolo esistente**
  - nessun secondo form;
  - riusare gli stessi controlli data/topic/type/hours/notes;
  - in focus, nascondere inizialmente tutto ciò che non serve alla registrazione;
  - `Mostra dettagli UDA` espande il fascicolo esistente senza perdere i valori del form.

- [ ] **Step 4: Verificare GREEN + PERSIST/UDA regressions**

Run: `bun test src/security/flow03FocusedUdaDiaryContract.test.ts src/security/flow03UdaDiaryHandoffContract.test.ts src/security/flow03ManualUdaSelectionNoteContract.test.ts src/security/persist01hUdaMutationContract.test.ts`

Expected: PASS; se il nome del contratto PERSIST differisce, usare il contratto UDA/PERSIST già registrato nell'invariant suite senza modificarne il significato.

- [ ] **Step 5: Commit**

Commit: `feat(flow-03): add focused authoritative UDA diary mode`

---

### Task 4: Browser qualification comparativa e chiusura Human UX

**Files:**
- Modify: `tests/browser/flow-03-registra.spec.cjs`
- Modify: `src/security/flow03BrowserQualificationContract.test.ts`
- Modify: `qualification/invariants.v1.json` solo se il nuovo contratto richiede registrazione esplicita.

**Interfaces:**
- Evidenze aggiuntive desktop/mobile per mission banner, scelta UDA focalizzata, diario focalizzato e disclosure completa.

- [ ] **Step 1: Estendere il contratto browser RED**
  - desktop `Registra → Valutazione`: banner visibile con classe + `Torna a Registra`;
  - ritorno mantiene pannello Registra e bozza;
  - standalone `Storico → Nuova Valutazione`: banner assente;
  - mobile `Registra → Attività / nota UDA` senza udaId: nessun workspace generale, sola scelta UDA della classe;
  - dopo scelta: `Registrazione rapida`, campi diario e nota trasferita visibili senza sezioni progettuali;
  - `Mostra dettagli UDA` rende disponibile il fascicolo completo senza perdere la bozza;
  - page errors restano `[]`.

- [ ] **Step 2: Implementare/aggiornare Playwright e produrre screenshot comparabili**

Viewport obbligatorio mobile: `390×844`.

- [ ] **Step 3: Eseguire suite focalizzata, typecheck e build**

Run:
- `bun test src/security/flow03*Contract.test.ts`
- `bun run typecheck`
- `bun run build`

Expected: PASS.

- [ ] **Step 4: Fresh exact-SHA qualification**

Richiesti sul medesimo SHA:
- FLOW-03 Contract Qualification — PASS;
- Qualification Invariants — PASS;
- PREDEPLOY Security Qualification — PASS;
- Browser Qualification — PASS incluse historical regressions.

- [ ] **Step 5: Final Independent Review**

Richiesto: `0 Critical / 0 Important`.

- [ ] **Step 6: Human Product/UX Review comparativa**

Richiesto: **PASS** sui due finding Important originari.

- [ ] **Step 7: Stato PR**

Solo dopo PASS umano: marcare #110 Ready. Non effettuare merge senza autorizzazione separata.

## Qualification checkpoint — 2026-11-03

Il rework dei due finding **Important** è implementato e i contratti/browser journey sono aggiornati. Il precedente commit tecnico `0fe10493c3dcd32512369be1c9e7af853b0b9732` è stato prodotto da GitHub Actions e i workflow PR sono rimasti in `action_required`; questo checkpoint è intenzionalmente **solo documentale** e serve a produrre un candidato human-authored con identico albero prodotto/test per la fresh exact-SHA qualification. Nessun merge o deploy è autorizzato.