# FLOW-03B — Post-Record UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rifinire il post-Registra del Registro Docente separando backup e conferma professionale, riducendo il rumore durante l’azione attiva e rendendo `Rivedi` contestuale all’evidenza appena salvata.

**Architecture:** Nessuna nuova shell e nessuna nuova autorità di persistenza. FLOW-03B aggiunge resolver puri e stato session-only, poi usa le superfici esistenti (`DashboardView`, `RecordLessonPanel`, `RecordMissionBanner`, Copilota) con progressive disclosure e accessi inline.

**Tech Stack:** React 19, TypeScript, Bun test, Playwright/Chromium, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-11-03-flow-03b-post-record-ux-design.md`

## Global Constraints

- Baseline: `main@c56ae67693b773b093e51f131053ce1c205a9508`.
- Nessuna nuova entità persistente per FLOW-03B.
- Nessuna scrittura automatica o duplicazione di moduli specialistici.
- PERSIST-01H e le superfici specialistiche restano autorità.
- Il tipo di evidenza usato da `Rivedi` è session-only.
- Mobile 390×844 è superficie primaria.
- Il trigger flottante Copilota non deve coprire controlli/campi durante `Registra`.
- Nessun merge o deploy senza autorizzazione esplicita separata.

## Review Focus

1. Una mutazione AppData che porta `changes` da 9→10 deve proporre backup una sola volta; 10→11 non deve riproporlo.
2. `showBackupModal: false` deve continuare a disabilitare il modal e `true` deve continuare a forzarlo.
3. Uscire da `Registra` o completarlo deve ripristinare Panoramica completa e trigger Copilota globale.
4. Un accesso Copilota inline durante missione Registra deve usare lo stesso composer esistente, senza secondo stato o secondo overlay.
5. `Rivedi` senza evidence kind deve mantenere esattamente l’ordine generico preesistente.

---

### Task 1: Backup attention policy

**Files:**
- Create: `src/persistence/backupReminderPolicy.ts`
- Create: `src/security/flow03bBackupReminderContract.test.ts`
- Modify: `src/App.tsx`
- Modify: `qualification/invariants.v1.json`

**Interfaces:**
- Produces: `shouldSuggestBackupReminder(previous: SecureMeta, next: SecureMeta): boolean`.
- Consumes: `SecureMeta.changes` e semantica esistente di `prepareBackupCheckpoint/applyBackupReceipt`.

- [ ] **Step 1: Write the failing contract**

Assert:
- 9→10 = `true`;
- 10→11 = `false`;
- 19→20 = `true`;
- reset 0→1 = `false`;
- App mantiene override `showBackupModal: true/false` e usa la policy solo quando `undefined`.

- [ ] **Step 2: Run focused test and verify RED**

Run: `bun test src/security/flow03bBackupReminderContract.test.ts`
Expected: FAIL perché resolver/policy non esistono e `commitAppDataMutation` apre ancora il modal per default.

- [ ] **Step 3: Implement minimal policy and integrate it**

Implementare checkpoint ogni 10 modifiche durevoli, senza mutare metadata. In `commitAppDataMutation.afterCommit(candidate, previous)`, calcolare il reminder da `candidate.meta`/`previous.meta` solo quando `showBackupModal` è `undefined`; mantenere gli override espliciti.

- [ ] **Step 4: Register invariant and verify GREEN**

Run: `bun test src/security/flow03bBackupReminderContract.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `feat(flow-03b): gate backup reminder by attention checkpoints`

### Task 2: Focus mode for active Registra + inline Copilota

**Files:**
- Create: `src/security/flow03bActiveRecordFocusContract.test.ts`
- Modify: `src/components/DashboardView.tsx`
- Modify: `src/components/RecordLessonPanel.tsx`
- Modify: `src/components/RecordMissionBanner.tsx`
- Modify: `src/App.tsx`
- Modify: `qualification/invariants.v1.json`

**Interfaces:**
- Dashboard consumes `todayAction` + `recordSession` già esistenti.
- `RecordLessonPanel` e `RecordMissionBanner` producono un accesso inline `onOpenCopilot?: () => void`.
- App usa `reopenLibraryCopilot` esistente e disabilita `CopilotExperience.showClosedTrigger` mentre `todayAction === 'record'`.

- [ ] **Step 1: Write the failing contract**

Assert:
- Panoramica Sezione è disclosure chiusa di default solo con `record/editing`;
- saved/non-record mantiene panoramica piena;
- Copilota globale non è reso come trigger flottante durante `record`;
- `RecordLessonPanel` e `RecordMissionBanner` espongono un comando Copilota inline collegato al composer esistente.

- [ ] **Step 2: Run focused test and verify RED**

Run: `bun test src/security/flow03bActiveRecordFocusContract.test.ts`
Expected: FAIL sul codice corrente.

- [ ] **Step 3: Implement the minimal UI delta**

Usare una disclosure semantica per la Panoramica; nessuna duplicazione KPI. Riutilizzare il pattern già adottato da FLOW-02 per nascondere il trigger flottante e offrire Copilota inline.

- [ ] **Step 4: Verify GREEN and FLOW-03 regressions**

Run:
- `bun test src/security/flow03bActiveRecordFocusContract.test.ts`
- `bun test src/security/flow03*.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `feat(flow-03b): focus active recording surfaces`

### Task 3: Contextual Rivedi hierarchy

**Files:**
- Create: `src/recording/reviewRouting.ts`
- Create: `src/security/flow03bContextualReviewContract.test.ts`
- Modify: `src/App.tsx`
- Modify: `src/components/DashboardView.tsx`
- Modify: `qualification/invariants.v1.json`

**Interfaces:**
- Produces: `getRecordReviewOptions(evidenceKind?: RecordEvidenceKind | null): readonly TodayContinuationOption[]`.
- App mantiene `reviewEvidenceKind: RecordEvidenceKind | null` come stato session-only.
- Dashboard riceve `reviewEvidenceKind` e rende l’ordine restituito dal resolver.

- [ ] **Step 1: Write the failing resolver/integration contract**

Assert ordini:
- evaluation → Tabellone, Analisi, Storico, Scheda alunno;
- online-outcomes → Tabellone, Storico, Analisi, Scheda alunno;
- behaviour → Scheda alunno, Comportamento, Analisi, Tabellone;
- lesson-log → UDA e diario, Tabellone, Analisi, Storico;
- null → ordine generico Today invariato.

Assert inoltre che `handleContinueRecordToReview` catturi l’evidence kind prima di azzerare `recordSession` e che nessuna destinazione venga aperta automaticamente.

- [ ] **Step 2: Run focused test and verify RED**

Run: `bun test src/security/flow03bContextualReviewContract.test.ts`
Expected: FAIL perché il resolver e lo stato session-only non esistono.

- [ ] **Step 3: Implement resolver + session-only handoff**

Nessuna persistenza. Il pannello Review mostra la prima opzione come raccomandata tramite ordine/copy, ma richiede sempre un click docente.

- [ ] **Step 4: Verify GREEN and Today regressions**

Run:
- `bun test src/security/flow03bContextualReviewContract.test.ts`
- `bun test src/security/today01*.test.ts src/security/flow03*.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `feat(flow-03b): contextualize review routing`

### Task 4: Browser qualification and candidate gate

**Files:**
- Create: `tests/browser/flow-03b-post-record-ux.spec.cjs`
- Modify: `.github/workflows/browser-qualification.yml`
- Modify: `.github/workflows/predeploy-security-qualification.yml` only if the focused contracts are not already covered by its `flow03*.test.ts` selection.
- Modify: `src/security/flow03BrowserQualificationContract.test.ts` or create `src/security/flow03bBrowserQualificationContract.test.ts` to pin the new journey.
- Modify: `qualification/invariants.v1.json`

**Interfaces:**
- Browser evidence is read-only except for seeded fixture data.
- Reuse existing FLOW-03 page-error collector and exact-SHA discipline.

- [ ] **Step 1: Add browser journeys**

Desktop:
- Registra → Valutazione → save → no backup modal before attention checkpoint → `Registrazione completata` → `Rivedi` shows Tabellone first.

Mobile 390×844:
- Registra active → Panoramica closed → Copilota floating trigger absent;
- inline Copilota reachable;
- specialist mission banner exposes inline Copilota + Torna a Registra;
- no overlap between interactive controls and focused UDA fields;
- completion restores normal overview/trigger behavior.

- [ ] **Step 2: Verify browser contract RED before workflow registration**

Run focused browser qualification contract and expect failure until the new spec is wired.

- [ ] **Step 3: Wire Browser Qualification**

Add the new Playwright spec after FLOW-03 qualification and before historical regressions; keep page-error assertion after final browser operation.

- [ ] **Step 4: Run candidate qualification**

Required fresh exact-SHA gates:
- FLOW-03 Contract Qualification;
- Qualification Invariants;
- PREDEPLOY Security Qualification;
- Browser Qualification including FLOW-03B + historical Chromium + UX navigation + progressive disclosure.

- [ ] **Step 5: Final reviews**

- Final Independent Review on exact SHA: 0 unresolved Critical/Important findings.
- Human Product/UX Review comparativa: M1/M2/M3 PASS or causal REWORK.

- [ ] **Step 6: PR governance**

Create PR as Draft against `main`. Promote to Ready only after all technical gates, Final Independent Review and Human Product/UX PASS. Do not merge/deploy without separate explicit authorization.
