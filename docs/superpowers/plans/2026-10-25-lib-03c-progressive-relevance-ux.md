# LIB-03C Progressive Relevance UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendere il ranking LIB-03B utilizzabile dal docente con un pannello progressivo che propone UDA/lezioni senza auto-selezione e mantiene conferma umana, privacy e rivalidazione prima di ogni link.

**Architecture:** Un helper puro `relevancePresentation.ts` deriva opzionalmente il Planning Context solo da identità annuale univoca e costruisce copy leggibile dai segnali LIB-03B. Un nuovo `LibraryRelevancePanel` calcola e presenta i candidati; `LibrarySourceCard` gli delega il ranking, seleziona esplicitamente il Teaching Context per la preparazione e conserva il proposal flow esistente. `App` passa `PlanningStateV1` lungo il wiring senza nuova persistenza.

**Tech Stack:** React 19, TypeScript, Bun test, Contextual Copilot Core condiviso, GitHub Actions, Playwright 1.64.1/Chromium.

**Spec:** `docs/superpowers/specs/2026-10-25-lib-03c-progressive-relevance-ux-design.md`

## Global Constraints

- Baseline obbligatoria: `main@ab55ef83a38012fbaf4eb5e0c0e865cfa2aeef8a`.
- Nessun hard-code di anno scolastico o disciplina per ottenere un Planning Context.
- Nessuna modifica ai pesi/algoritmo di LIB-03B.
- Nessuna auto-selezione o auto-scrittura del primo candidato.
- Il link passa da `dispatchLibraryContextAction` e richiede conferma umana.
- Prima della scrittura il candidato viene rivalidato contro source/UDA/context correnti.
- Ranking locale consentito anche per privacy non professionale; nessuna nuova autorizzazione remota.
- Nessun `curricoloItems`, semantic search, embedding, `MasterProgram`, `planning.resources` o target `activity`.
- Nessuna nuova persistenza/migrazione.
- Nessun merge/deploy senza decisione umana separata.

## Review Focus

1. Più profili dello stesso livello ma con identità annuali diverse: il ranking deve continuare senza planning boost e senza scegliere un profilo.
2. Candidato visibile che viene collegato o rimosso prima della conferma: la conferma deve fallire chiusa e non scrivere.
3. Fonte `student-personal` con testo locale: i candidati devono essere visibili, ma la preparazione remota deve restare negata dal flow esistente.
4. Oltre tre candidati: la prima vista non deve creare feature wall e deve richiedere espansione esplicita.
5. Cambio di source/Teaching Context mentre il pannello è aperto: risultati ignorati/conferme pendenti non devono contaminare il nuovo contesto.

---

### Task 1: Planning identity fail-closed + presentation model

**Files:**
- Create: `src/library/relevancePresentation.ts`
- Create: `src/library/relevancePresentation.test.ts`

**Interfaces:**
- Consumes: `PlanningStateV1`, `ResolvedLibraryTeachingContext`, `LibraryRelevanceCandidate`, `resolveClassGradeLevel`, `normalizeSchoolYear`, `resolveLibraryPlanningContext`.
- Produces:
  - `resolvePlanningContextForLibraryRelevance(teachingContext: ResolvedLibraryTeachingContext | null, planning: PlanningStateV1): LibraryPlanningContextResolution | null`
  - `describeLibraryRelevanceCandidate(candidate: LibraryRelevanceCandidate, udas: UdaRecord[]): LibraryRelevancePresentation | null`
  - `LibraryRelevancePresentation` con `targetType`, `targetId`, `udaId`, `title`, `subtitle`, `reasons`, `matchedTerms`.

- [ ] **Step 1: Write failing unit tests**

Casi obbligatori:
- identità unica stesso grade → planning context risolto via LIB-03A;
- due coppie `schoolYear+subjectCode` sullo stesso grade → `null`;
- Teaching Context assente o classe non interpretabile → `null`;
- due profili sulla stessa identità → lascia a LIB-03A l’esito `ambiguous`, non collassa arbitrariamente;
- descrizione UDA/lezione usa soltanto segnali e matched terms reali;
- candidato con target scomparso → `null`.

- [ ] **Step 2: Run RED**

Run: `bun test src/library/relevancePresentation.test.ts`
Expected: FAIL perché `relevancePresentation.ts`/le nuove funzioni non esistono.

- [ ] **Step 3: Implement minimal pure helper**

Normalizzare l’identità soltanto per confronto; nessuna scrittura e nessuna scelta quando le identità sono più di una.

- [ ] **Step 4: Run GREEN**

Run: `bun test src/library/relevancePresentation.test.ts`
Expected: PASS.

- [ ] **Step 5: Run Library suite**

Run: `bun run test:library`
Expected: tutti PASS.

- [ ] **Step 6: Commit**

Commit message: `feat(lib-03c): add relevance presentation model`.

### Task 2: Browser RED for progressive candidate UX

**Files:**
- Create: `tests/browser/lib03c-progressive-relevance.spec.cjs`
- Modify: `.github/workflows/browser-qualification.yml`

**Interfaces:**
- Consumes: UI Biblioteca esistente, fixture sintetiche browser.
- Produces: test end-to-end canonicale incluso nel Browser Qualification.

- [ ] **Step 1: Add exact browser scenarios before production UI**

Scenari minimi:
1. prima di `Usa`, `Trova dove può servire` assente;
2. dopo `Usa`, bottone presente; click mostra i tre candidati ordinati attesi da fixture deterministica;
3. quarto candidato nascosto fino a `Mostra altri risultati`;
4. nessun link viene creato dall’apertura del pannello;
5. `Ignora` nasconde solo il candidato scelto;
6. `Usa per preparare` seleziona il relativo Teaching Context senza generare proposta/remoto automaticamente;
7. `Collega` mostra conferma e solo la conferma produce il link;
8. una fonte già collegata non viene riproposta dopo refresh del ranking;
9. viewport mobile 390×844: pannello leggibile, nessuna sovrapposizione orizzontale.

- [ ] **Step 2: Include the new spec in Browser Qualification copy + Playwright command**

- [ ] **Step 3: Create/update Draft PR so workflows execute the test-only candidate**

- [ ] **Step 4: Verify causal RED**

Expected: Browser Qualification FAIL soltanto nei nuovi scenari LIB-03C perché la UI non esiste; build storica e test esistenti restano integri.

- [ ] **Step 5: Commit**

Commit message: `test(lib-03c): define progressive relevance browser contract`.

### Task 3: Progressive relevance panel + wiring

**Files:**
- Create: `src/components/LibraryRelevancePanel.tsx`
- Modify: `src/components/LibrarySourceCard.tsx`
- Modify: `src/components/LibraryView.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes Task 1 helper, `resolveLibraryRelevance`, `PlanningStateV1`, existing `dispatchLibraryContextAction`, existing `LibraryProposalPanel` flow.
- Produces:
  - `LibraryRelevancePanel` props: `source`, `udas`, `planning`, `teachingContext`, `isPending`, `onLink`, `onSelectTeachingContext`.
  - `onSelectTeachingContext(context: LibraryTeachingContext)` updates the card’s explicit Teaching Context only.

- [ ] **Step 1: Implement minimal panel to satisfy browser contract**

Behavior:
- initial command `Trova dove può servire`;
- resolve optional planning context through Task 1;
- call LIB-03B resolver;
- show 3 candidates, expand only on request;
- reasons from Task 1 presentation; no numeric score;
- `Ignora` in local state.

- [ ] **Step 2: Implement `Usa per preparare` as context selection only**

For UDA: `{ udaId }`; for lesson: `{ udaId, lessonId }`. Reset transient relevance confirmation state when source/context changes. Existing `LibraryProposalPanel` remains the only generative path.

- [ ] **Step 3: Implement governed candidate linking**

First click dispatches LINK without confirmation. Final click:
- recompute planning context + LIB-03B result from current props;
- require exact `targetType+targetId` still present;
- resolve candidate Teaching Context again;
- dispatch LINK with `humanConfirmed: true` and executor `onLink`;
- fail closed with visible message on stale/unauthorized target.

- [ ] **Step 4: Wire planning**

`App.tsx`: `planning={planning}` → `LibraryView`.
`LibraryView`: accept `planning: PlanningStateV1` and pass to `LibrarySourceCard`.
`LibrarySourceCard`: accept planning and render panel only inside selected-source progressive area.

- [ ] **Step 5: Run local suites**

Run:
- `bun test src/library/relevancePresentation.test.ts`
- `bun run test:library`
- `bun run test:security`
- `bun run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

Commit message: `feat(lib-03c): add progressive relevance UX`.

### Task 4: Exact-SHA qualification and review

**Files:**
- Modify only if a Critical/Important finding receives a dedicated RED→GREEN fix.

**Interfaces:**
- Consumes exact branch head from Tasks 1–3.
- Produces qualified exact candidate evidence and final review status.

- [ ] **Step 1: PREDEPLOY qualification**

Verify exact head and require typecheck, security, Library tests, build and production startup smoke PASS.

- [ ] **Step 2: Browser Qualification**

Require exact head checkout and all historical + LIB-03C Chromium tests PASS; preserve UX-QA-01/02 evidence and artifact digest.

- [ ] **Step 3: Whole-branch review**

Review diff against this spec, with focus on privacy, stale-target race, accidental auto-write, planning identity ambiguity, and progressive disclosure.

- [ ] **Step 4: Fix only Critical/Important findings with new RED→GREEN cycles**

No speculative polish. Minor findings are recorded for human decision.

- [ ] **Step 5: Re-run exact-SHA gates after any fix**

- [ ] **Step 6: Update Draft PR body**

Record baseline, exact candidate, causal RED evidence, GREEN gates, browser artifact/digest, review findings/rulings, and state:

`LIB-03C ENGINEERING QUALIFIED / DRAFT PR / HUMAN INTEGRATION DECISION PENDING`

No merge/deploy.
