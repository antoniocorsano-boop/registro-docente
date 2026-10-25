# LIB-04C — Copilot LINK Vertical Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendere `LINK` la prima azione realmente eseguibile dal Copilota, con target deterministico dal Teaching Context, conferma esplicita e persistenza durevole via handler Biblioteca esistente.

**Architecture:** Il Composer continua a ricevere le azioni da `ContextualCopilotCore`; non inventa intenti né authority. Solo `link-source-to-uda` entra nel vertical slice operativo: il target viene derivato dal Teaching Context, il Core deve prima restituire `HUMAN_CONFIRMATION_REQUIRED`, quindi il secondo dispatch con `humanConfirmed: true` esegue `onLink`, che resta l’unico ingresso alla persistenza del Secure Local Vault.

**Tech Stack:** React 19, TypeScript, Bun test, `@trama/contextual-copilot-core@0.2.0`, Playwright/Chromium, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-25-lib-04c-copilot-link-vertical-slice-design.md`

## Global Constraints

- Nessun `IntentPort`, provider remoto, semantic search, multi-source o chat multi-turno.
- Nessuna modifica del Core condiviso.
- Solo `link-source-to-uda` diventa operativo nel Composer; `REVIEW`, `PREPARE`, `SUMMARIZE` restano presentazione-only.
- Nessuna chiamata diretta a `onLink` prima del dispatch governato e della conferma umana.
- Target: lezione quando esiste `lessonId`, altrimenti UDA; nessun target valido => fail closed.
- Successo UI solo dopo `status === 'EXECUTED'` e persistenza completata.
- Errore di persistenza => nessun falso successo, proposta conservata per retry.
- Mobile 390×844: controlli primari >=44px, nessun overflow orizzontale permanente.
- Nessun merge, deploy o publish automatico.

## Review Focus

- Teaching Context nullo o diventato invalido tra risoluzione e click: nessuna mutazione e messaggio fail-closed.
- `LINK` assente da `resolution.actions`: nessun comando operativo deve apparire.
- Doppio click durante persistenza pending: una sola mutazione e controlli disabilitati.
- Errore di `onLink`: proposta e target restano disponibili per retry, nessun messaggio di successo.
- Fonte già collegata allo stesso target: il dominio Biblioteca deve restare idempotente e il Composer non deve produrre duplicati visibili.

---

### Task 1: Contratto RED del vertical slice LINK

**Files:**
- Create: `src/security/lib04cCopilotLinkContract.test.ts`
- Read/verify: `src/components/LibraryCopilotComposer.tsx`
- Read/verify: `src/App.tsx`
- Read/verify: `src/library/contextualCoreAdapter.ts`

**Interfaces:**
- Consumes: `dispatchLibraryContextAction`, `ResolvedLibraryTeachingContext`, `LibrarySourceLink`.
- Produces: contratto TDD che richiede helper target, prop `onLink`, doppio dispatch governato, wiring App e non-operatività delle altre azioni.

- [ ] **Step 1: Scrivere il test fallente**

Il test deve verificare almeno:
- esistenza/import di `resolveCopilotLinkTarget`;
- lesson target preferito a UDA; UDA fallback; null senza contesto;
- `LibraryCopilotComposerProps` include `onLink: (sourceId: string, link: LibrarySourceLink) => Promise<void>`;
- il Composer importa `dispatchLibraryContextAction` e non chiama `onLink` fuori dall’`executor` del dispatch confermato;
- esiste un primo dispatch `humanConfirmed: false`/default con no-op executor e apertura conferma solo su `HUMAN_CONFIRMATION_REQUIRED`;
- esiste il dispatch finale con `humanConfirmed: true` ed `executor: () => onLink(...)`;
- App passa `onLink={handleLinkLibrarySource}`;
- `REVIEW`, `PREPARE`, `SUMMARIZE` non diventano comandi operativi.

- [ ] **Step 2: Eseguire il gate per ottenere RED causale**

Run via PR/CI: `PREDEPLOY Security Qualification`.
Expected: FAIL esclusivamente sul nuovo contratto LIB-04C; typecheck/build e suite storiche restano verdi se il test è statico/import-safe.

- [ ] **Step 3: Commit del RED**

Commit: `test: define LIB-04C governed LINK contract`.

### Task 2: Target deterministico e Composer governato

**Files:**
- Create: `src/library/copilotLinkTarget.ts`
- Modify: `src/components/LibraryCopilotComposer.tsx`
- Modify: `src/App.tsx`
- Test: `src/security/lib04cCopilotLinkContract.test.ts`

**Interfaces:**
- Produces: `resolveCopilotLinkTarget(teachingContext: ResolvedLibraryTeachingContext | null): LibrarySourceLink | null`.
- Composer prop: `onLink: (sourceId: string, link: LibrarySourceLink) => Promise<void>`.
- Consumes existing `dispatchLibraryContextAction<TOutput>(...)`.

- [ ] **Step 1: Implementare `resolveCopilotLinkTarget`**

Regole esatte:
- `null` context -> `null`;
- `lessonId` presente -> `{ targetType: 'lesson', targetId: lessonId }`;
- altrimenti -> `{ targetType: 'uda', targetId: udaId }`.

- [ ] **Step 2: Aggiungere stato e handler LINK al Composer**

Stati minimi: proposta/confirm aperta, pending mutazione, errore LINK, successo breve.

Primo handler:
- richiede che `link-source-to-uda` sia presente in `resolution.actions`;
- richiede source e target validi;
- chiama `dispatchLibraryContextAction` senza conferma e con no-op executor;
- apre la conferma solo su `HUMAN_CONFIRMATION_REQUIRED`.

Secondo handler:
- ricostruisce/verifica target corrente;
- chiama `dispatchLibraryContextAction` con `humanConfirmed: true`;
- `executor: () => onLink(selectedSource.id, target)`;
- chiude la proposta e mostra successo soltanto su `EXECUTED`;
- su errore conserva la proposta per retry.

- [ ] **Step 3: Rendere operativo solo LINK nella lista azioni**

`link-source-to-uda` deve essere un button >=44px; le altre azioni restano copy/presentazione non eseguibile.

La scheda conferma mostra tipo destinazione e identificazione leggibile dal Teaching Context; copy: collegamento salvato nella Biblioteca e removibile successivamente.

- [ ] **Step 4: Collegare App alla persistenza esistente**

Passare `onLink={handleLinkLibrarySource}` a `LibraryCopilotComposer`. Non creare nuovo persistence layer.

- [ ] **Step 5: Eseguire PREDEPLOY per GREEN**

Expected: nuovo contratto LIB-04C PASS; tutte le suite sicurezza/Biblioteca, typecheck, build e production startup smoke PASS.

- [ ] **Step 6: Commit GREEN**

Commit: `feat: add governed Copilot LINK vertical slice`.

### Task 3: Browser qualification reale e regressioni

**Files:**
- Create: `tests/browser/lib04c-copilot-link.spec.cjs`
- Modify: `.github/workflows/browser-qualification.yml`
- Preserve: `tests/browser/lib04b-copilot-composer.spec.cjs`

**Interfaces:**
- Browser test usa soltanto UI pubblica e Secure Local Vault reale.
- Workflow include permanentemente il nuovo spec nella stessa matrice Chromium.

- [ ] **Step 1: Scrivere scenario desktop 1280×900**

Setup sintetico locale:
- vault nuovo;
- classe sintetica;
- UDA sintetica associata alla classe;
- lezione di oggi sintetica;
- classe selezionata;
- fonte testuale acquisita dal Composer.

Asserzioni:
- fallback Core mostra `Collega a una UDA` come unico comando operativo tra le possibilità;
- primo click mostra destinazione lezione e non crea ancora link;
- conferma finale persiste il link;
- reload + unlock conserva il collegamento;
- nessuna richiesta esterna durante il flusso;
- nessun `pageerror`.

- [ ] **Step 2: Scrivere scenario mobile 390×844**

Asserzioni:
- comando LINK e pulsanti conferma/annulla >=44px;
- scheda target leggibile e chiudibile;
- nessun overflow orizzontale;
- nessuna mutazione prima della conferma.

- [ ] **Step 3: Copiare/eseguire il nuovo spec nel workflow**

Aggiungere `lib04c-copilot-link.spec.cjs` sia allo step di copia sia al comando Playwright.

- [ ] **Step 4: Eseguire Browser Qualification**

Expected: tutta la suite Chromium PASS, incluso LIB-04B invariato, LIB-04C desktop/mobile e UX-QA-01/02 senza finding.

- [ ] **Step 5: Commit browser gate**

Commit: `test: qualify LIB-04C LINK in real browser`.

### Task 4: Exact-SHA qualification e review finale

**Files:**
- Update only if findings require it; otherwise no product changes.
- Update PR body with exact candidate and evidence.

**Interfaces:**
- Candidate = exact branch head dopo tutti i fix.

- [ ] **Step 1: Congelare exact candidate**

Leggere l’head PR e usarlo come SHA obbligatorio per tutti i gate finali.

- [ ] **Step 2: Verificare PREDEPLOY sullo stesso SHA**

Expected: SUCCESS; typecheck, sicurezza, LIB-04C contract, Biblioteca, build, startup smoke tutti PASS.

- [ ] **Step 3: Verificare Browser Qualification sullo stesso SHA**

Expected: SUCCESS; LIB-04C desktop/mobile PASS, suite storica e UX QA PASS; registrare artifact ID e digest.

- [ ] **Step 4: Whole-branch review**

Controllare diff rispetto a `main@3bc9347152079c7370f4e6de830910b478919258`, review thread, config/harness audit e assenza di scope creep.

- [ ] **Step 5: Fermarsi al confine umano**

PR resta Draft/open/non-merged. Stato finale atteso: `LIB-04C ENGINEERING QUALIFIED / HUMAN INTEGRATION DECISION PENDING`.
