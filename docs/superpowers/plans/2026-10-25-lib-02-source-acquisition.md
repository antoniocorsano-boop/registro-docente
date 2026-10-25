# LIB-02 Source Acquisition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendere l'acquisizione della Biblioteca privata coerente con il contenuto realmente disponibile, con normalizzazione locale dei file testuali e completamento esplicito delle fonti web incomplete.

**Architecture:** Estendere `src/library/intake.ts` come unico confine di normalizzazione local-first; preservare originali e privacy `unknown`; usare gli stati `ready / needs-review / captured` come verità di prodotto. Riutilizzare integralmente il runtime multimodale LIB-01E per immagini/PDF, senza nuovi provider o fetch URL server-side.

**Tech Stack:** TypeScript, React 19, Bun test, Vite, Playwright Chromium, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-25-lib-02-source-acquisition-design.md`

## Global Constraints

- Baseline obbligatoria: `main@3ea4f3396bcd785de89961fee96981b5ff60b968`.
- Nessun fetch server-side di URL in LIB-02.
- Nessun nuovo provider IA; foto/PDF riusano LIB-01E.
- `privacy: unknown` per nuove fonti utente finché il docente non le classifica esplicitamente.
- Limite testo locale/remoto: `262144` byte UTF-8; nessun troncamento silenzioso.
- Limite file generale invariato: `8 MiB`.
- Nessuna mutazione automatica di UDA/lezioni.
- Nessun merge/deploy automatico.

## Review Focus

- URL salvata senza testo: deve essere `needs-review` e non deve mostrare la preparazione remota.
- Testo incollato oltre 262144 byte UTF-8: deve essere rifiutato, non troncato.
- File `text/*` / JSON / XML <= budget: deve preservare `dataUrl` e produrre testo locale `ready`.
- File testuale vuoto o oltre budget: originale preservato, stato `needs-review`.
- Immagine/PDF: nessuna regressione del percorso multimodale LIB-01E e privacy ancora `unknown`.

---

### Task 1: Rendere eseguibili i test della Biblioteca in PREDEPLOY

**Files:**
- Modify: `package.json`
- Modify: `.github/workflows/predeploy-security-qualification.yml`
- Modify: `src/library/intake.test.ts`

**Interfaces:**
- Produces: script `test:library` e gate PREDEPLOY `Library tests`.
- Consumes: contratto privacy canonico già verificato da `src/security/lib01IntegratedContract.test.ts` (`privacy: unknown`).

- [ ] **Step 1: aggiungere il gate senza correggere il test storico**

Aggiungere `"test:library": "bun test src/library/*.test.ts"` e uno step PREDEPLOY `Library tests` con `continue-on-error: true`; includere `steps.library.outcome` nel gate finale.

- [ ] **Step 2: verificare RED**

Atteso: PREDEPLOY fallisce nel test intake che attende `teacher-professional` mentre l'implementazione canonica restituisce `unknown`.

- [ ] **Step 3: correggere esclusivamente l'aspettativa storica**

Rinominare il test per descrivere `privacy unknown` e cambiare l'aspettativa a `unknown`. Nessuna modifica di produzione in questo task.

- [ ] **Step 4: verificare GREEN**

Atteso: `bun run test:library` PASS e PREDEPLOY torna verde.

- [ ] **Step 5: commit**

`test(lib-02): gate private library unit tests`

---

### Task 2: Normalizzare intake web e file testuali

**Files:**
- Modify: `src/library/intake.test.ts`
- Modify: `src/library/intake.ts`

**Interfaces:**
- Produces: `MAX_LIBRARY_TEXT_BYTES`, `buildCapturedWebTextPatch(source, text)`, nuovi stati intake.
- Consumes: `LibrarySource`, `LibrarySourcePatch`, `MAX_LIBRARY_SOURCE_BYTES`.

- [ ] **Step 1: scrivere test RED**

Aggiungere test che fissano:
- URL senza `capturedText` → `needs-review`;
- URL con testo → `ready`, `payload.text` + `extractedText`;
- testo web oltre 262144 byte → errore;
- file `text/plain` e `application/json` piccoli → originale `dataUrl` preservato, `payload.text` + `extractedText`, `ready`, privacy `unknown`;
- file testuale vuoto o oltre budget → `needs-review`, nessun troncamento;
- immagine/PDF → `captured` invariato;
- `buildCapturedWebTextPatch()` rifiuta non-web/vuoto/oltre budget e restituisce `{ extractedText, status: 'ready' }` per input valido.

- [ ] **Step 2: verificare RED**

Atteso: fallimenti causali su stato web, estrazione testuale e helper mancante.

- [ ] **Step 3: implementare il minimo GREEN**

In `intake.ts`:
- `export const MAX_LIBRARY_TEXT_BYTES = 262_144`;
- helper byte UTF-8;
- MIME locali leggibili: `text/*`, `application/json`, `application/xml`;
- `createWebSource()` con `needs-review` se manca testo e controllo budget se presente;
- `createFileSource()` legge `file.text()` solo per MIME leggibili e file entro budget; preserva sempre il `dataUrl`;
- file testuale vuoto/oltre budget → `needs-review`;
- `buildCapturedWebTextPatch(source, text)` come update local-first per fonti web.

- [ ] **Step 4: verificare GREEN**

Run: `bun run test:library`
Expected: PASS.

- [ ] **Step 5: eseguire regressione PREDEPLOY**

Expected: security tests, library tests, typecheck, build e startup smoke PASS.

- [ ] **Step 6: commit**

`feat(lib-02): normalize source intake readiness`

---

### Task 3: Completamento progressivo delle fonti web

**Files:**
- Create: `tests/browser/lib02-source-acquisition.spec.cjs`
- Modify: `.github/workflows/browser-qualification.yml`
- Modify: `src/components/LibraryView.tsx`
- Modify: `src/components/LibrarySourceCard.tsx`

**Interfaces:**
- Consumes: `buildCapturedWebTextPatch(source, text)` dal Task 2 e `onUpdate(sourceId, patch)` già durevole.
- Produces: flusso UI URL incompleta → completamento esplicito → `ready`.

- [ ] **Step 1: scrivere browser test RED e agganciarlo al workflow**

Scenario Chromium desktop:
1. apri Biblioteca;
2. `Aggiungi fonte` → `URL`;
3. salva titolo + URL senza testo;
4. verifica badge `Da rivedere`;
5. `Usa`;
6. verifica `Contenuto web non ancora acquisito` e assenza di `Prepara una proposta didattica`;
7. apri `Aggiungi testo della pagina`, incolla un estratto, salva;
8. verifica stato `Pronta` e che il blocco di completamento scompaia dopo commit.

- [ ] **Step 2: verificare RED**

Atteso: test fallisce perché stato/copy/completamento non esistono.

- [ ] **Step 3: aggiungere testo facoltativo al form URL**

In `LibraryView.tsx` aggiungere stato `webCapturedText`, textarea `Testo o estratto della pagina` e copy `Se non lo aggiungi ora, conserveremo l'URL come fonte da completare.`; passare il valore a `createWebSource()`.

- [ ] **Step 4: aggiungere il pannello di completamento selettivo**

In `LibrarySourceCard.tsx`:
- calcolare `webNeedsContent = source.kind === 'web' && !excerpt`;
- mostrare `Contenuto web non ancora acquisito` solo quando la fonte è selezionata e incompleta;
- pulsante `Aggiungi testo della pagina` → textarea → `Salva contenuto`;
- validare con `buildCapturedWebTextPatch()` e salvare via `onUpdate()`;
- non montare `LibraryProposalPanel` finché `webNeedsContent` è vero;
- mantenere review/link locali disponibili.

- [ ] **Step 5: verificare GREEN browser**

Expected: nuovo scenario PASS e regressioni LIB-01A…E PASS.

- [ ] **Step 6: verificare UX-QA**

Expected: UX-QA-01 PASS, UX-QA-02 PASS, nessun finding bloccante.

- [ ] **Step 7: commit**

`feat(lib-02): complete web sources progressively`

---

### Task 4: Qualificazione exact-SHA e review terminale

**Files:**
- Modify only if a causal finding requires a RED→GREEN fix.

**Interfaces:**
- Consumes: exact head dei Task 1–3.
- Produces: candidate LIB-02 qualificato per decisione umana separata.

- [ ] **Step 1: congelare exact candidate**

Registrare SHA corrente della PR Draft; nessuna modifica dopo il freeze senza nuovo ciclo di qualifica.

- [ ] **Step 2: PREDEPLOY exact candidate**

Expected: typecheck PASS; security tests PASS; library tests PASS; build PASS; production startup smoke PASS.

- [ ] **Step 3: Browser Qualification exact-SHA**

Expected: checkout exact candidate; tutti gli scenari PASS incluso LIB-02; UX-QA-01/02 PASS.

- [ ] **Step 4: review indipendente terminale**

Expected: 0 finding critici/importanti irrisolti. Ogni finding richiede test causale RED prima della correzione.

- [ ] **Step 5: fermarsi al confine umano**

PR resta open, Draft, non mergiata, senza deploy. Stato atteso: `ENGINEERING QUALIFIED / BROWSER QUALIFIED / READY FOR HUMAN INTEGRATION DECISION`.