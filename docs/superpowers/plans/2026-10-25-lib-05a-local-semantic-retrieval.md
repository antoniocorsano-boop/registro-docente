# LIB-05A Local Semantic Retrieval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendere disponibile nella Biblioteca privata una ricerca semantica esplicita e local-only che ordina le fonti per significato senza sostituire la ricerca testuale o il resolver LIB-03B.

**Architecture:** Un nuovo modulo `src/library/semanticRetrieval.ts` riusa `getEmbedding` e `cosineSimilarity`, ma accetta esclusivamente `embeddingConfig.provider === 'local'` e fonti `teacher-professional`. `LibraryView` espone la funzione in progressive disclosure e App passa la configurazione embedding esistente; nessuna persistenza, nessun fallback remoto, nessuna modifica del Contextual Copilot Core.

**Tech Stack:** React 19, TypeScript, Bun test, existing `embeddingService`, Playwright/Chromium, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-25-lib-05a-local-semantic-retrieval-design.md`

## Global Constraints

- Baseline: `main@a79925a33ee32be02f2a2c32a866357341db2381`.
- Nessun nuovo provider, endpoint o dependency.
- Nessuna modifica a `src/library/relevanceResolver.ts`.
- Semantic retrieval solo con `config.enabled === true` e `config.provider === 'local'`.
- Nessun fallback a Gemini/remoto.
- Fonti `unknown` e `student-personal` escluse dal percorso embedding.
- Nessun vector index persistito.
- Ricerca testuale resta il default.
- Touch target primari >=44px; nessun overflow mobile permanente.
- Nessun merge, deploy o publish automatico.

## Review Focus

- Query cambia mentre un retrieval è pending: il risultato della query precedente non deve essere pubblicato come corrente.
- Endpoint locale irraggiungibile: errore retryable, ricerca testuale invariata, nessuna mutazione.
- Provider configurato `gemini`: semantica indisponibile senza POST remoto.
- Fonte priva di testo utile o privacy non professionale: esclusa senza bloccare le altre fonti.
- Vettori incompatibili/zero: candidato escluso, ordinamento degli altri deterministico.

---

### Task 1: Contratto RED LIB-05A

**Files:**
- Create: `src/security/lib05aLocalSemanticRetrievalContract.test.ts`
- Read: `src/library/relevanceResolver.ts`
- Read: `src/services/embeddingService.ts`
- Read: `src/components/LibraryView.tsx`
- Read: `src/App.tsx`

**Interfaces:**
- Consumes: existing `LocalEmbeddingConfig`, `getEmbedding`, `cosineSimilarity`, `LibrarySource`.
- Produces: source contract for new module and UI wiring.

- [ ] **Step 1: Write failing contract tests**

Assert:
- `src/library/semanticRetrieval.ts` exists and imports the existing embedding service;
- local provider + enabled are mandatory;
- no Gemini-specific route/provider is introduced;
- unknown/student-personal sources are excluded;
- `relevanceResolver.ts` stays untouched by semantic integration;
- `LibraryView` receives `embeddingConfig`, preserves `searchLibrarySources`, exposes closed-by-default semantic disclosure and explicit run control;
- App passes the existing settings embedding config into `LibraryView`.

- [ ] **Step 2: Run RED**

Run: `bun test src/security/lib05aLocalSemanticRetrievalContract.test.ts`

Expected: FAIL only because LIB-05A files/wiring do not yet exist.

- [ ] **Step 3: Commit RED**

Commit: `test: define LIB-05A semantic retrieval contract`.

---

### Task 2: Local semantic retrieval core

**Files:**
- Create: `src/library/semanticRetrieval.ts`
- Create: `src/library/semanticRetrieval.test.ts`
- Modify only if needed for type import: none outside the new files.

**Interfaces:**
- Consumes: `LibrarySource[]`, `LocalEmbeddingConfig`, `getEmbedding`, `cosineSimilarity`.
- Produces:
  - `SemanticLibraryCandidate { sourceId: string; similarity: number }`
  - `SemanticLibraryResolution`
  - `retrieveLibrarySourcesByMeaning(input): Promise<SemanticLibraryResolution>`

- [ ] **Step 1: Write unit RED**

Tests:
- ranks conceptually closer source first using controlled embedding responses;
- deterministic tie-break on equal similarity;
- excludes unknown/student-personal and no-text sources before embedding;
- refuses disabled or non-local config before any embedding invocation;
- returns `NO_SEMANTIC_MATCH` when all similarities are below threshold/incompatible;
- caps returned candidates at 8.

- [ ] **Step 2: Verify unit RED**

Run: `bun test src/library/semanticRetrieval.test.ts`

Expected: FAIL because implementation is absent.

- [ ] **Step 3: Implement minimal retrieval**

Signature:

```ts
export async function retrieveLibrarySourcesByMeaning(input: {
  query: string;
  sources: LibrarySource[];
  config: LocalEmbeddingConfig;
  maxResults?: number;
  embed?: typeof getEmbedding;
}): Promise<SemanticLibraryResolution>
```

Rules:
- query trimmed, empty => unavailable;
- enabled/local guard before embedding;
- source text = title + extractedText + payload.text + notes;
- only `teacher-professional` sources with non-empty semantic text;
- query/source embedding context `TEACHER_PROFESSIONAL`, opt-in false;
- cosine similarity threshold `0.35`;
- max default 8, hard cap 8;
- sort similarity desc, then source title, then id.

- [ ] **Step 4: Run unit tests + contract**

Run: `bun test src/library/semanticRetrieval.test.ts src/security/lib05aLocalSemanticRetrievalContract.test.ts`

Expected: core tests PASS; UI/wiring contract may still be RED only on Task 3 requirements.

- [ ] **Step 5: Commit core GREEN**

Commit: `feat: add local semantic library retrieval`.

---

### Task 3: Biblioteca progressive semantic search

**Files:**
- Modify: `src/components/LibraryView.tsx`
- Modify: `src/App.tsx`
- Modify: `src/security/lib05aLocalSemanticRetrievalContract.test.ts` only for stable source assertions if implementation names require it.

**Interfaces:**
- Consumes: `retrieveLibrarySourcesByMeaning`, `settings.embeddingConfig`.
- Produces: teacher-visible semantic search mode with no persistence.

- [ ] **Step 1: Keep normal search unchanged**

`searchLibrarySources(library, query)` remains the default source list.

- [ ] **Step 2: Add semantic disclosure state and explicit run**

Add state for semantic open/pending/error/resolution/query-version. Use a request sequence/ref so stale async results are discarded after query change/new request/unmount.

- [ ] **Step 3: Add progressive UI**

Under the search box add closed-by-default `details`/disclosure `Ricerca per significato`.

Inside:
- privacy/local-only copy;
- explicit `Cerca per significato` button, disabled when query blank or pending;
- pending copy;
- normalized unavailable/error copy;
- when ranked, show the same source cards in semantic order and a non-numeric `Pertinenza semantica` marker.

No automatic semantic call on keystroke.

- [ ] **Step 4: Wire App config**

Pass `embeddingConfig={settings.embeddingConfig}` to `LibraryView`; prop type is `LocalEmbeddingConfig | undefined`.

- [ ] **Step 5: Run contract and existing library/security tests**

Run: `bun test src/security/lib05aLocalSemanticRetrievalContract.test.ts src/library/*.test.ts`

Expected: PASS.

Run: `bun run lint && bun run test:security && bun run test:library && bun run build`

Expected: PASS.

- [ ] **Step 6: Commit UI GREEN**

Commit: `feat: expose semantic search in private library`.

---

### Task 4: Browser qualification gate

**Files:**
- Create: `tests/browser/lib05a-local-semantic-retrieval.spec.cjs`
- Modify: `.github/workflows/browser-qualification.yml`

**Interfaces:**
- Consumes: built application and controlled local embedding fixture/mocked loopback route supported by browser harness.
- Produces: durable regression coverage for desktop/mobile semantic search.

- [ ] **Step 1: Add desktop scenario**

Prove:
- disclosure closed by default;
- textual search still works without embedding calls;
- semantic run is explicit;
- professional source with semantic relationship ranks before unrelated source under controlled vectors;
- no remote/Gemini request;
- changing query invalidates prior semantic result;
- no library mutation occurs.

- [ ] **Step 2: Add failure scenario**

Configure remote/Gemini or unavailable local engine and prove semantic mode reports unavailable/retryable state while textual search remains usable and zero remote semantic POST occurs.

- [ ] **Step 3: Add mobile 390×844 scenario**

Verify disclosure/button/source-card interactions >=44px and no permanent horizontal overflow.

- [ ] **Step 4: Register spec in Browser Qualification workflow**

Add copy and Playwright invocation in the same pattern as LIB-04D.

- [ ] **Step 5: Run/dispatch PREDEPLOY + Browser on exact SHA**

Require:
- PREDEPLOY SUCCESS;
- Browser Qualification SUCCESS;
- UX-QA-01 PASS 0 finding;
- UX-QA-02 PASS 0 finding.

- [ ] **Step 6: Final review and stop before integration**

Review diff for:
- no modification to LIB-03B;
- no remote fallback;
- no vector persistence;
- no automatic call on typing;
- privacy exclusions preserved.

Open/keep Draft PR and stop at HUMAN INTEGRATION DECISION.
