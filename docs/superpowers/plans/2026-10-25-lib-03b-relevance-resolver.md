# LIB-03B Relevance Resolver Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Costruire un resolver locale e deterministico che ordini UDA e lezioni pertinenti a una fonte privata senza scritture, rete o interpretazione curricolare.

**Architecture:** Una funzione pura in `src/library/relevanceResolver.ts` combina segnali contestuali, profilo annuale già risolto da LIB-03A e corrispondenze lessicali esatte. Produce candidati spiegabili; non applica link né chiama servizi esterni.

**Tech Stack:** TypeScript, Bun test, dominio `LibrarySource`/`UdaRecord`, `planningContextBridge`.

**Spec:** `docs/superpowers/specs/2026-10-25-lib-03b-relevance-resolver-design.md`

## Global Constraints

- Baseline: `main@b82175db604b56197171d6b1f25be249f74874db`.
- RED → GREEN causale obbligatorio.
- Solo dati sintetici nei test e nei gate.
- Nessun provider IA, embedding, fetch o rete nel resolver.
- Nessuna UI, migrazione o nuova persistenza.
- Target prodotti: soltanto `uda` e `lesson`.
- `arenaContext.curricoloItems` non deve entrare nel ranking.
- Nessun merge o deploy dalla qualificazione.

## Review Focus

- Fonte senza testo ma con contesto attivo: deve ordinare il contesto, non fallire.
- Fonte senza testo e senza contesto: deve restituire `SOURCE_AND_CONTEXT_UNAVAILABLE`.
- Planning context ambiguo/non disponibile: non deve inventare un profilo o impedire il ranking lessicale.
- Link già esistente: la stessa destinazione non deve essere riproposta.
- Parità di punteggio: ordinamento stabile indipendente dall'ordine dell'array in ingresso.

---

### Task 1: Resolver lessicale deterministico

**Files:**
- Create: `src/library/relevanceResolver.test.ts`
- Create: `src/library/relevanceResolver.ts`

**Interfaces:**
- Consumes: `LibrarySource`, `UdaRecord`, `ResolvedLibraryTeachingContext`, `LibraryPlanningContextResolution`.
- Produces: `resolveLibraryRelevance(input): LibraryRelevanceResolution` e i tipi pubblici del resolver.

- [ ] **Step 1: Write the failing tests**

Aggiungere test che dimostrino:

- titolo fonte `Energia eolica` ordina prima una UDA `Energia e trasformazioni` rispetto a candidati non correlati;
- una lezione con topic coincidente riceve il segnale `SOURCE_TITLE_MATCH`;
- token ripetuti nella fonte non moltiplicano il contributo oltre l'insieme dei termini;
- una fonte senza testo né contesto restituisce `SOURCE_AND_CONTEXT_UNAVAILABLE`;
- a punteggio pari l'ordine è `uda` prima di `lesson`, poi `targetId` crescente.

- [ ] **Step 2: Run test to verify RED**

Run: `bun test src/library/relevanceResolver.test.ts`
Expected: FAIL perché `relevanceResolver.ts` non esiste.

- [ ] **Step 3: Implement the minimal pure resolver**

In `src/library/relevanceResolver.ts` definire:

```ts
export type LibraryRelevanceSignal =
  | 'CURRENT_LESSON'
  | 'CURRENT_UDA'
  | 'CURRENT_CLASS'
  | 'PLANNING_GRADE_MATCH'
  | 'SOURCE_TITLE_MATCH'
  | 'SOURCE_CONTENT_MATCH';

export interface LibraryRelevanceCandidate {
  targetType: 'uda' | 'lesson';
  targetId: string;
  udaId: string;
  score: number;
  signals: LibraryRelevanceSignal[];
  matchedTerms: string[];
}

export function resolveLibraryRelevance(input: ResolveLibraryRelevanceInput): LibraryRelevanceResolution;
```

Applicare esattamente normalizzazione, pesi e tie-break della specifica. Usare insiemi di token, non conteggi.

- [ ] **Step 4: Run test to verify GREEN**

Run: `bun test src/library/relevanceResolver.test.ts`
Expected: PASS.

- [ ] **Step 5: Run library suite**

Run: `bun run test:library`
Expected: PASS.

- [ ] **Step 6: Commit**

Commit: `feat: add deterministic library relevance resolver`.

### Task 2: Contesto, Planning Bridge e confini fail-closed

**Files:**
- Modify: `src/library/relevanceResolver.test.ts`
- Modify: `src/library/relevanceResolver.ts`
- Create: `src/security/lib03bRelevanceResolverContract.test.ts`

**Interfaces:**
- Consumes: `resolveLibraryRelevance` di Task 1 e `LibraryPlanningContextResolution` di LIB-03A.
- Produces: comportamento contestuale completo di LIB-03B senza nuove autorità.

- [ ] **Step 1: Write failing behavioral tests**

Aggiungere casi che dimostrino:

- `CURRENT_LESSON` +100 e `CURRENT_UDA` +80 prevalgono sui soli match lessicali;
- `CURRENT_CLASS` +30 si applica ai candidati della classe attiva;
- `PLANNING_GRADE_MATCH` +15 si applica solo con `planningContext.status === 'resolved'` e livello classe compatibile;
- planning context `ambiguous` non aggiunge boost e non blocca i match lessicali;
- fonte senza testo con contesto attivo produce candidati contestuali;
- link `uda`/`lesson` già presenti vengono esclusi;
- link `activity` non produce né sopprime candidati UDA/lezione;
- fonte `restricted`/`student-personal` viene ordinata localmente quando dispone di testo.

- [ ] **Step 2: Run tests to verify causal RED**

Run: `bun test src/library/relevanceResolver.test.ts`
Expected: almeno un FAIL specifico sulle regole contestuali ancora mancanti.

- [ ] **Step 3: Implement minimal context and planning signals**

Usare `resolveClassGradeLevel` da `planningContextBridge.ts`; leggere solo `planningContext.profile.gradeLevel` quando lo stato è `resolved`. Non accedere a `arenaContext.curricoloItems`.

- [ ] **Step 4: Write the static boundary contract test**

`src/security/lib03bRelevanceResolverContract.test.ts` deve verificare che `src/library/relevanceResolver.ts` non importi servizi embedding/provider/server, non contenga `fetch(`, non legga `curricoloItems`, non produca `targetType: 'activity'` e non importi componenti UI.

- [ ] **Step 5: Run Task 2 tests**

Run: `bun test src/library/relevanceResolver.test.ts src/security/lib03bRelevanceResolverContract.test.ts`
Expected: PASS.

- [ ] **Step 6: Run full local suites**

Run: `bun run test:library && bun run test:security && bun run lint && bun run build`
Expected: PASS.

- [ ] **Step 7: Commit**

Commit: `test: harden LIB-03B relevance boundaries`.

### Task 3: Exact-SHA qualification and review

**Files:**
- Modify only documentation if reusable evidence requires it; no product change unless a demonstrated finding requires a new RED → GREEN cycle.

**Interfaces:**
- Consumes: exact branch head after Task 2.
- Produces: Draft PR with engineering evidence tied to one exact candidate SHA.

- [ ] **Step 1: Open Draft PR against `main`**

Title: `LIB-03B — Relevance Resolver`.

- [ ] **Step 2: Verify PREDEPLOY / required CI on exact head**

Expected: security, library, typecheck, build and production startup smoke PASS on the declared exact candidate.

- [ ] **Step 3: Review the complete diff against spec and Review Focus**

Any Important/Critical finding requires one causal RED → GREEN fix pass and requalification. Minor findings are recorded without silently expanding scope.

- [ ] **Step 4: Final state**

Leave PR Draft/open, no merge and no deploy. Report exact candidate SHA and evidence.