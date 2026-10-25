# LIB-06A — Local Intent Discovery Consumer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collegare il Copilota Biblioteca del Registro Docente all'adapter TRAMA di intent embedding con classificazione locale di REVIEW, LINK e PREPARE, mantenendo separati discovery, autorizzazione e generazione.

**Architecture:** Vendorizzare l'adapter TRAMA qualificato, aggiungere un embedding locale deterministico e un catalogo consumer-owned, iniettare l'IntentPort nel Core 0.3 già presente, quindi fare usare al Composer `discoverRequestIntent()` prima dei flussi esistenti. PREPARE apre soltanto `LibraryProposalPanel`; LINK conserva il dispatch governato e la conferma umana.

**Tech Stack:** React 19, TypeScript 7, Bun tests, Vite, package vendorizzati `@trama/contextual-copilot-core@0.3.0` e `@trama/contextual-copilot-intent-embedding@0.1.0`.

**Spec:** `docs/superpowers/specs/2026-10-25-lib-06a-local-intent-discovery-design.md`

## Global Constraints

- Baseline obbligatoria: `main@38b7f0dd874806aaf56dd0ecef7e93d01ce34039`.
- Adapter TRAMA: source freeze `4cd5d41176a63f15939162b7c33275fbb4130ac5`, receipt candidate `13aeba119ce041850ac78ce97c0d19d58a179b4f`.
- Nessuna rete/provider/API key per la classificazione intenti.
- Catalogo limitato a REVIEW/LINK/PREPARE; SUMMARIZE escluso.
- Discovery non autorizza né esegue azioni.
- Nessuna generazione diretta da PREPARE.
- LINK mantiene conferma umana e dispatch esistente.
- Nessun deploy, publish o modifica Docente OS.

## Review Focus

- Frasi italiane brevi/parafrasi: classificazione deve restare stabile senza richiedere parole identiche agli esempi.
- Frasi ambigue fra LINK e PREPARE: no-match invece di scegliere arbitrariamente.
- PREPARE con Core `generativeMode: none`: deve essere discoverable ma non eseguibile dal Core locale.
- Fonte/Teaching Context che cambia dopo la discovery: nessun uso di stato stale.
- `summarize-source`: non deve diventare raggiungibile attraverso il nuovo catalogo.

---

### Task 1: Causal RED for local intent consumer

**Files:**
- Create: `src/security/lib06aLocalIntentDiscoveryContract.test.ts`

**Interfaces:**
- Consumes: Core 0.3 `discoverRequestIntent()` contract and current Composer/adapter surfaces.
- Produces: failing contract that names the vendor package, local embedding, catalog, discovery wrapper and Composer handoff.

- [ ] **Step 1: Write the failing test**

Assert that:
- root dependency and lock contain `@trama/contextual-copilot-intent-embedding` as a local file package;
- provenance/package files exist and match the TRAMA 0.1.0 receipt;
- `embedLocalIntentText` and `LIBRARY_INTENT_CATALOG` exist;
- the catalog contains REVIEW/LINK/PREPARE and excludes SUMMARIZE;
- `contextualCoreAdapter.ts` injects `intentPort` and exports `discoverLibraryCopilotIntent`;
- Composer calls discovery before resolve and routes PREPARE to `setIsPrepareOpen(true)` without proposal-service imports.

- [ ] **Step 2: Run security tests and record the RED**

Run: `bun run test:security`

Expected: FAIL only because LIB-06A package/files/wiring are absent; install/typecheck infrastructure must remain healthy.

- [ ] **Step 3: Commit the RED**

Commit message: `test: define LIB-06A local intent discovery contract`

---

### Task 2: Vendor the qualified TRAMA embedding IntentPort package

**Files:**
- Create: `vendor/contextual-copilot-intent-embedding/README.md`
- Create: `vendor/contextual-copilot-intent-embedding/index.d.ts`
- Create: `vendor/contextual-copilot-intent-embedding/package.json`
- Create: `vendor/contextual-copilot-intent-embedding/src/index.js`
- Create: `vendor/contextual-copilot-intent-embedding.provenance.json`
- Modify: `package.json`
- Modify: `bun.lock`

**Interfaces:**
- Consumes: TRAMA source freeze `4cd5d411...` and distribution receipt from `13aeba119...`.
- Produces: importable `@trama/contextual-copilot-intent-embedding@0.1.0` with no network/registry requirement.

- [ ] **Step 1: Copy the four canonical package files byte-for-byte from TRAMA source freeze**

- [ ] **Step 2: Add provenance with package/version, source repository, source commit, receipt commit and exact SHA-256 digests**

- [ ] **Step 3: Add root `file:vendor/contextual-copilot-intent-embedding` dependency and matching Bun lock entries**

- [ ] **Step 4: Run install/typecheck and the LIB-06A security contract**

Run: `bun install --frozen-lockfile && bun run lint && bun test src/security/lib06aLocalIntentDiscoveryContract.test.ts`

Expected: vendor/dependency assertions PASS; functional assertions still RED until Tasks 3–4.

- [ ] **Step 5: Commit**

Commit message: `build: vendor TRAMA intent embedding adapter`

---

### Task 3: Local embedding and consumer-owned intent catalog

**Files:**
- Create: `src/library/localIntentEmbedding.ts`
- Create: `src/library/libraryIntentCatalog.ts`
- Create: `src/library/localIntentEmbedding.test.ts`

**Interfaces:**
- Produces: `embedLocalIntentText(text: string): Promise<readonly number[]>`.
- Produces: `LIBRARY_INTENT_CATALOG` compatible with `IntentExampleSet[]`.

- [ ] **Step 1: Write failing runtime tests**

Tests:
- deterministic equal vectors for normalized equivalent text;
- finite fixed-size non-zero vector for ordinary Italian text;
- no network/global fetch usage;
- catalog action ids exactly `review-source`, `link-source-to-uda`, `prepare-from-source`;
- no `summarize-source`.

- [ ] **Step 2: Run the test and verify RED**

Run: `bun test src/library/localIntentEmbedding.test.ts`

- [ ] **Step 3: Implement local feature-hash embedding**

Signature:

```ts
export async function embedLocalIntentText(text: string): Promise<readonly number[]>
```

Use Unicode lowercase normalization, whitespace collapse, word features and character n-grams projected through deterministic hashing into a fixed-size vector, followed by L2 normalization. No action ids or catalog inspection in the embedding function.

- [ ] **Step 4: Implement the consumer catalog**

Export readonly examples for REVIEW, LINK and PREPARE in Italian, including paraphrases rather than single keywords.

- [ ] **Step 5: Run tests GREEN**

Run: `bun test src/library/localIntentEmbedding.test.ts`

- [ ] **Step 6: Commit**

Commit message: `feat: add local intent embedding and library catalog`

---

### Task 4: Inject IntentPort and expose discovery boundary

**Files:**
- Modify: `src/library/contextualCoreAdapter.ts`
- Create: `src/library/libraryIntentDiscovery.test.ts`
- Modify: `src/security/lib04bCopilotRequestContract.test.ts`

**Interfaces:**
- Consumes: `embedLocalIntentText`, `LIBRARY_INTENT_CATALOG`, `createEmbeddingIntentPort()`.
- Produces: `discoverLibraryCopilotIntent(input: LibraryCopilotRequestInput): Promise<CopilotIntentDiscovery>`.

- [ ] **Step 1: Write failing behavior tests**

Use representative source/context fixtures and assert:
- “rivedi questa fonte nel contesto della programmazione” → REVIEW;
- “collega questa fonte alla UDA” → LINK;
- “prepara un'attività per questa lezione” → PREPARE even with local Core `generativeMode: none`;
- summary-only prompt → `NO_INTENT_MATCH`;
- ambiguous prompt under margin → no-match.

- [ ] **Step 2: Run tests and verify RED**

Run: `bun test src/library/libraryIntentDiscovery.test.ts src/security/lib04bCopilotRequestContract.test.ts`

- [ ] **Step 3: Create and inject the local IntentPort**

Instantiate `createEmbeddingIntentPort({ embed: embedLocalIntentText, intents: LIBRARY_INTENT_CATALOG, ... })` and pass `intentPort` to the local `createContextualCopilotCore()` only. Keep remote proposal Core unchanged.

- [ ] **Step 4: Export the discovery wrapper**

Implement `discoverLibraryCopilotIntent()` with the same request builder used by `resolveLibraryCopilotRequest()`.

- [ ] **Step 5: Keep SUMMARIZE out of allowed request capabilities**

`LIBRARY_COPILOT_ALLOWED_CAPABILITIES` must contain only REVIEW, LINK and PREPARE for text-intent routing.

- [ ] **Step 6: Update the historical request contract from `INTENT_PORT_UNAVAILABLE` to the new resolved/discovered behavior**

- [ ] **Step 7: Run runtime + security tests GREEN**

Run: `bun run test:library && bun run test:security`

- [ ] **Step 8: Commit**

Commit message: `feat: wire local intent discovery into contextual core`

---

### Task 5: Composer progressive handoff

**Files:**
- Modify: `src/components/LibraryCopilotComposer.tsx`
- Modify: `src/security/lib06aLocalIntentDiscoveryContract.test.ts`
- Modify if needed: `src/security/lib04cCopilotLinkContract.test.ts`
- Modify if needed: `src/security/lib04dCopilotPrepareHandoffContract.test.ts`

**Interfaces:**
- Consumes: `discoverLibraryCopilotIntent`, existing `resolveLibraryCopilotRequest`, `LibraryProposalPanel`, LINK dispatch handlers.
- Produces: free-text intent routing without direct generation/mutation.

- [ ] **Step 1: Add/strengthen failing Composer contract assertions**

Assert discovery is called first; PREPARE only opens `isPrepareOpen`; REVIEW/LINK pass through resolve; LINK still requires confirmation and uses existing dispatch; source/context changes reset stale state.

- [ ] **Step 2: Implement the smallest Composer change**

On submit:
- discovery first;
- PREPARE + valid source/context/UDA → `setIsPrepareOpen(true)` and no direct generation;
- PREPARE without valid context → fail-closed guidance;
- REVIEW/LINK → call `resolveLibraryCopilotRequest()` and present only Core-resolved actions;
- no-match → neutral explanatory copy.

- [ ] **Step 3: Run security tests GREEN**

Run: `bun run test:security`

- [ ] **Step 4: Commit**

Commit message: `feat: route library copilot through local intent discovery`

---

### Task 6: Exact-SHA qualification

**Files:**
- No product code unless a demonstrated defect requires a separate RED→GREEN cycle.

**Interfaces:**
- Consumes: completed LIB-06A branch.
- Produces: exact candidate suitable for human integration decision.

- [ ] **Step 1: Run complete local/CI gates**

Required gates:
- `bun install --frozen-lockfile`
- `bun run lint`
- `bun run test:library`
- `bun run test:security`
- `bun run build`
- production startup smoke

- [ ] **Step 2: Run browser qualification for the Copilota flow**

At minimum verify REVIEW, LINK confirmation boundary, PREPARE handoff, no-match and mobile layout on the exact SHA.

- [ ] **Step 3: Review the complete diff**

Check no remote embedding/provider, no Core modifications, no direct generation from discovery, no SUMMARIZE routing, no regressions to durable LINK.

- [ ] **Step 4: Update PR evidence and stop before merge**

Canonical terminal state for this plan:

`ENGINEERING QUALIFIED / EXACT-SHA VERIFIED / DRAFT PR / HUMAN INTEGRATION DECISION PENDING`
