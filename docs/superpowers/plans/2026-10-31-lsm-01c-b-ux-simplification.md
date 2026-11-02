# LSM-01C-B UX Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendere il percorso Biblioteca → uso didattico → preparazione più breve e leggibile su mobile, mantenendo invariati privacy, consenso remoto, authority canonica e comportamento LSM già qualificato.

**Architecture:** La semplificazione resta dentro le superfici esistenti. `LibrarySourceCard` diventa il punto di ingresso per stato privacy, scelta del contesto e scelta dell'azione; `CopilotLaunchContext` trasporta l'intento esplicito scelto dal docente; `LibraryCopilotComposer` entra direttamente nello stato governato corretto senza ripetere obiettivo, classe, UDA o un secondo `Continua`. Il layout mobile del Copilota passa a shell a tutto schermo con un solo scorrimento e copertura dei controlli flottanti sottostanti.

**Tech Stack:** React 19, TypeScript 7, Tailwind CSS 4, Bun test, Vite 8, Playwright/Chromium nel workflow Browser Qualification.

**Spec:** `docs/superpowers/specs/2026-10-31-lsm-01c-b-ux-simplification-design.md`

## Global Constraints

- Baseline di partenza immutabile: `b4ab11e53fe6405f4947db11c541a48df34125f3`.
- La PR #93 resta congelata e non viene modificata, mergiata o deployata durante LSM-01C-B.
- Biblioteca e Memoria professionale restano canoniche; LSM resta derivato/ricostruibile.
- Nessun dato studente può diventare eleggibile per LSM o per invio remoto.
- Il token LSM resta solo di sessione e nessun probe loopback viene introdotto all'avvio.
- La sincronizzazione LSM resta esplicita.
- Nessun invio remoto senza consenso esplicito.
- Nessun collegamento fonte-UDA o salvataggio di proposte avviene automaticamente.
- La classificazione `teacher-professional` è locale e non deve richiedere un servizio remoto.
- Su mobile non devono coesistere due azioni primarie `Continua` nello stesso stato.

## Review Focus

- Fonte `privacy: unknown`: classificazione diretta deve aggiornare solo `privacy` e non avviare fetch remoti, link UDA o sync LSM.
- Fonte `student-personal`: non deve offrire classificazione rapida verso professionale senza una nuova decisione esplicita; preparazione remota e LSM restano bloccati.
- Più UDA per la stessa classe o nessun contesto univoco: il selettore unico deve restare esplicito e non scegliere arbitrariamente.
- Contesto Docente OS sola lettura: può essere usato per review/preparazione ma non deve diventare target scrivibile del Registro.
- Mobile 390×844 con tastiera/viewport ridotto: il pannello deve mantenere chiusura, contenuto e azione corrente raggiungibili con un solo scorrimento e senza FAB sovrapposti.

---

### Task 1: Rendere visibile e locale la classificazione della fonte

**Files:**
- Modify: `src/components/LibrarySourceCard.tsx`
- Modify: `src/security/a4R1TeacherFirstComposerContract.test.ts`

**Interfaces:**
- Consumes: `LibrarySource.privacy`, `LibrarySource.status`, `onUpdate(sourceId, patch)`.
- Produces: stato UX `Da classificare | Professionale | Da rivedere` e classificazione locale tramite `onUpdate(source.id, { privacy: 'teacher-professional' })`.

- [ ] **Step 1: Write the failing contract test**

Aggiungere al contratto A4-R1 asserzioni che richiedano in `LibrarySourceCard.tsx`:

```ts
expect(source).toContain('Da classificare');
expect(source).toContain('Professionale');
expect(source).toContain('Da rivedere');
expect(source).toContain('Classifica come materiale professionale');
expect(source).toContain("privacy: 'teacher-professional'");
expect(source).toContain('non contiene dati personali degli studenti');
```

Il contratto deve anche verificare che la classificazione richiami `onUpdate` e non `onOpenCopilot`.

- [ ] **Step 2: Run RED**

Run: `bun test src/security/a4R1TeacherFirstComposerContract.test.ts`

Expected: FAIL perché `LibrarySourceCard` non espone ancora stato privacy e classificazione locale.

- [ ] **Step 3: Implement minimal local classification UI**

In `LibrarySourceCard.tsx`:

- derivare una label UX dalla coppia `source.status`/`source.privacy`;
- mostrare la label accanto a tipo/stato;
- per `privacy === 'unknown'` aggiungere in `Gestisci` un controllo di conferma locale con testo esatto `Confermo che è materiale professionale del docente e non contiene dati personali degli studenti.`;
- conferma positiva → `onUpdate(source.id, { privacy: 'teacher-professional' })`;
- nessun side effect remoto, nessun link, nessuna sync.

- [ ] **Step 4: Verify GREEN**

Run: `bun test src/security/a4R1TeacherFirstComposerContract.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/LibrarySourceCard.tsx src/security/a4R1TeacherFirstComposerContract.test.ts
git commit -m "feat(library): classify professional sources directly"
```

---

### Task 2: Unificare contesto e azione nella scheda `Usa`

**Files:**
- Modify: `src/components/LibrarySourceCard.tsx`
- Modify: `src/library/copilotLaunchContext.ts`
- Modify: `src/security/a4R1TeacherFirstComposerContract.test.ts`

**Interfaces:**
- Consumes: `TeachingUdaCandidate[]`, `suggestLibraryTeachingContext(...)`, `resolveLibraryTeachingContextFromCatalog(...)`.
- Produces: `LibraryLaunchIntent = 'prepare' | 'review' | 'link'`; `CopilotLaunchContext.intent?: LibraryLaunchIntent`.

- [ ] **Step 1: Write failing contracts for one-context/one-action flow**

Il contratto deve richiedere:

```ts
expect(sourceCard).toContain('Dove vuoi usarlo?');
expect(sourceCard).toContain("Prepara un'attività");
expect(sourceCard).toContain('Rivedi nel contesto');
expect(sourceCard).toContain('Collega alla UDA');
expect(launchContext).toContain("export type LibraryLaunchIntent = 'prepare' | 'review' | 'link'");
expect(launchContext).toContain('intent?: LibraryLaunchIntent');
```

Aggiungere una guardia testuale che non richieda più nella superficie `Usa` due selettori consecutivi separati `UDA corrente` + `Lezione corrente`; il nuovo selettore usa valori `udaId` / `udaId::lessonId`.

- [ ] **Step 2: Run RED**

Run: `bun test src/security/a4R1TeacherFirstComposerContract.test.ts`

Expected: FAIL sui nuovi contratti.

- [ ] **Step 3: Extend launch context**

In `src/library/copilotLaunchContext.ts`:

```ts
export type LibraryLaunchIntent = 'prepare' | 'review' | 'link';
```

Aggiungere `intent?: LibraryLaunchIntent` a `CopilotLaunchContext`. Non cambiare la risoluzione canonica di classe/UDA/lezione.

- [ ] **Step 4: Replace the selected-source controls with one context selector**

In `LibrarySourceCard.tsx`:

- rinominare il blocco in `Usa questo materiale`;
- mostrare `Dove vuoi usarlo?`;
- mantenere il contesto proposto quando univoco;
- quando serve scelta esplicita, usare un singolo `<select>` con opzioni UDA e relative lezioni (`udaId` / `udaId::lessonId`), etichettate con classe + UDA/lezione;
- rimuovere il doppio passaggio `UDA corrente` / `Lezione corrente` dalla superficie principale;
- dopo contesto valido mostrare tre azioni a tutta larghezza: prepare/review/link;
- ogni azione richiama `onOpenCopilot` con `sourceId`, contesto risolto e `intent` corrispondente.

- [ ] **Step 5: Preserve ambiguity safety**

Se non esiste un contesto univoco, nessuna azione prepare/review/link può partire finché il docente non sceglie esplicitamente una voce. Per candidati Docente OS preservare `teachingContextMode`/provenienza e sola lettura.

- [ ] **Step 6: Verify GREEN**

Run: `bun test src/security/a4R1TeacherFirstComposerContract.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/LibrarySourceCard.tsx src/library/copilotLaunchContext.ts src/security/a4R1TeacherFirstComposerContract.test.ts
git commit -m "feat(library): simplify source use context and actions"
```

---

### Task 3: Handoff diretto al Copilota senza ripetere obiettivo/contesto

**Files:**
- Modify: `src/components/LibraryCopilotComposer.tsx`
- Modify: `src/security/a4R1TeacherFirstComposerContract.test.ts`
- Modify: `tests/browser/lsm-01c-consumer.spec.cjs`

**Interfaces:**
- Consumes: `launchRequest.context.intent`, source già selezionata, `resolvedTeachingContext`.
- Produces: prepare → `isPrepareOpen=true`; review/link → risoluzione governata coerente con l'intento; nessun secondo teacher-first `Continua` per un launch già completo.

- [ ] **Step 1: Add a browser RED for the approved mobile journey**

Nel test browser LSM-01C aggiungere un caso 390×844 con fonte sintetica `privacy: unknown` e UDA sintetica che verifica:

1. `Usa` apre la superficie di uso;
2. un solo selettore di contesto è presente;
3. `Prepara un'attività` apre direttamente `Preparazione assistita`;
4. compare `Classifica come materiale professionale` senza un secondo `Continua`;
5. dopo classificazione, la stessa superficie mostra il consenso remoto senza ritornare alla scelta iniziale.

Assert chiave:

```js
await expect(page.getByText('Preparazione assistita')).toBeVisible();
await expect(page.getByRole('button', { name: 'Classifica come materiale professionale' })).toBeVisible();
await expect(page.getByRole('button', { name: /^Continua$/ })).toHaveCount(0);
```

- [ ] **Step 2: Run browser/contract RED locally or in the existing qualification harness**

Run targeted security contract first:

`bun test src/security/a4R1TeacherFirstComposerContract.test.ts`

Then run the existing browser command used by `tests/browser/lsm-01c-consumer.spec.cjs` in the repository harness.

Expected: RED perché il composer oggi riapre il teacher-first flow.

- [ ] **Step 3: Implement direct launch-intent handoff**

In `LibraryCopilotComposer.tsx`, nell'effetto che reagisce a `launchRequest?.nonce`:

- se source e teaching context sono validi e `intent === 'prepare'`, mantenere i binding e aprire `isPrepareOpen` direttamente;
- se `intent === 'review'` o `intent === 'link'`, costruire il messaggio canonico già usato da `handleTeacherFirstProceed` e risolvere solo l'azione corrispondente;
- non mostrare `teacher-first-copilot-entry` per launch con `sourceId + teaching target + intent` già completi;
- preservare tutti i gate esistenti di `LibraryProposalPanel` e `dispatchLibraryContextAction`.

- [ ] **Step 4: Ensure classification resumes in place**

La mutazione `privacy: unknown → teacher-professional` deve far rerenderizzare `LibraryProposalPanel` nello stesso prepare flow. Non resettare `launchRequest`, `resolvedTeachingContext` o `isPrepareOpen` a seguito della sola variazione privacy.

- [ ] **Step 5: Verify targeted GREEN**

Run:

- `bun test src/security/a4R1TeacherFirstComposerContract.test.ts`
- targeted Chromium spec for `lsm-01c-consumer.spec.cjs`

Expected: PASS; zero richieste remote prima del consenso esplicito.

- [ ] **Step 6: Commit**

```bash
git add src/components/LibraryCopilotComposer.tsx src/security/a4R1TeacherFirstComposerContract.test.ts tests/browser/lsm-01c-consumer.spec.cjs
git commit -m "feat(copilot): preserve direct library action handoff"
```

---

### Task 4: Correggere la shell responsive mobile

**Files:**
- Modify: `src/components/LibrarySourceCard.tsx`
- Modify: `src/components/LibraryCopilotComposer.tsx`
- Modify: `src/components/CopilotDeck.tsx`
- Modify: `tests/browser/lsm-01c-consumer.spec.cjs`

**Interfaces:**
- Consumes: breakpoint Tailwind `md`, `surfaceMode` esistente.
- Produces: overlay mobile full-screen con `100dvh`, un solo contenitore scrollabile, z-index superiore ai FAB, desktop invariato.

- [ ] **Step 1: Add responsive RED assertions**

Nel browser test 390×844 verificare:

```js
await expect(composer).toHaveCSS('position', 'fixed');
await expect(composer).toHaveCSS('height', '844px'); // accettare tolleranza del viewport nel test reale
await expect(page.getByTestId('library-copilot-trigger')).toBeHidden();
```

Aggiungere asserzioni DOM che la shell abbia un solo elemento principale con overflow verticale e che non esistano due elementi con ruolo di azione primaria nello stesso stato.

- [ ] **Step 2: Run RED**

Eseguire il caso mobile nel browser harness.

Expected: FAIL perché il composer attuale usa `inset-x-3 bottom-36 max-h[...]` e lascia visibile/concorrente la superficie sottostante.

- [ ] **Step 3: Make selected-source `Usa` a mobile full-screen surface**

In `LibrarySourceCard.tsx`, per `isSelected`:

- mobile: `fixed inset-0 z-[90] h-[100dvh] overflow-y-auto bg-slate-950` con header/chiusura e padding safe-area;
- desktop `md:`: mantenere presentazione integrata nella scheda;
- nessuno scroll annidato dentro il blocco di contesto/azioni.

- [ ] **Step 4: Make composer a mobile full-screen shell**

In `LibraryCopilotComposer.tsx`:

- mobile: `fixed inset-0 z-[100] flex h-[100dvh] flex-col overflow-hidden rounded-none`;
- header sticky/fisso nel contenitore;
- corpo `flex-1 overflow-y-auto` con padding inferiore safe-area;
- desktop: preservare pannello laterale compatto con classi `md:` equivalenti alla baseline.

- [ ] **Step 5: Prevent Copilot deck/FAB competition**

In `CopilotDeck.tsx` mantenere il FAB solo per `surfaceMode === 'closed'`; assicurare che la shell compose (`z-[100]`) copra completamente deck/nav sottostanti su mobile. Non introdurre un secondo FAB nel composer.

- [ ] **Step 6: Verify mobile and desktop GREEN**

Run Browser Qualification targeted at:

- mobile 390×844 source → prepare;
- desktop historical regression.

Expected: PASS; nessuna sovrapposizione del FAB, chiusura sempre raggiungibile, un solo asse di scroll.

- [ ] **Step 7: Commit**

```bash
git add src/components/LibrarySourceCard.tsx src/components/LibraryCopilotComposer.tsx src/components/CopilotDeck.tsx tests/browser/lsm-01c-consumer.spec.cjs
git commit -m "fix(ux): make library copilot flow mobile-first"
```

---

### Task 5: Regressione completa e candidatura LSM-01C-B

**Files:**
- Modify only if qualification registration requires it: `.github/workflows/browser-qualification.yml`, `qualification/invariants.v1.json`
- Update: `docs/superpowers/plans/2026-10-31-lsm-01c-b-ux-simplification.md` only for checked task state/evidence if the repository convention requires it.

**Interfaces:**
- Consumes: Tasks 1–4 complete.
- Produces: exact-SHA candidate with evidence sufficient for Draft PR and Human Visual / Design Review.

- [ ] **Step 1: Run focused suites**

```bash
bun test src/security/a4R1TeacherFirstComposerContract.test.ts
bun test src/security/lsm01cUiAdoptionContract.test.ts
bun test src/semanticMemory/*.test.ts
bun run lint
bun run build
```

Expected: all PASS / exit 0.

- [ ] **Step 2: Run full security/library suites**

```bash
bun run test:security
bun run test:library
```

Expected: 0 FAIL.

- [ ] **Step 3: Run exact-SHA qualification workflows**

Required gates:

- Qualification Invariants;
- PREDEPLOY Security Qualification;
- Browser Qualification;
- dedicated LSM-01C Chromium consumer qualification;
- AIC-07 Chromium;
- historical Chromium regression;
- mobile 390×844 UX evidence.

- [ ] **Step 4: Verify LSM authority did not drift**

Re-run the LSM consumer browser checks for:

- zero startup probe;
- session-only token;
- explicit connect/sync;
- professional-only projection;
- semantic retrieval against canonical current source.

- [ ] **Step 5: Open Draft PR only after exact-SHA gates are green**

Title: `LSM-01C-B — Simplify Library/Copilot mobile flow`

Base: the integration target chosen after review of #93; until then no merge and no deploy.

PR body must record:

- parent qualified SHA `b4ab11e53fe6405f4947db11c541a48df34125f3`;
- scope limited to UX flow;
- exact candidate SHA;
- RED→GREEN evidence;
- cloud gate results;
- pending Human Visual / Design Review.

- [ ] **Step 6: Human Visual / Design Review**

Repeat the real mobile journey with synthetic-only data and capture:

1. fonte `Da classificare`;
2. `Usa questo materiale` full-screen;
3. single `Dove vuoi usarlo?` selector;
4. three actions;
5. direct professional classification;
6. `Preparazione assistita` with remote consent separated;
7. close/reopen behavior and no overlapping FAB.

Expected: PASS or REWORK with concrete findings. Do not mark Ready or merge without explicit human approval.

- [ ] **Step 7: Final whole-branch review**

Run a fresh independent review on the exact candidate after Human Visual / Design Review. Only a PASS with 0 Critical / 0 Important permits promotion from Draft to Ready.
