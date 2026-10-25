# LIB-01E Governed Provider Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendere il vertical slice `PREPARE` di LIB-01D un runtime provider-neutral, bounded, observable e fail-closed senza aggiungere nuove capability utente.

**Architecture:** Il Core e SEC restano i gate di authority/privacy. Un nuovo `TeachingProposalRuntime` server-side costruito una volta per processo governa provider, modello, deadline, budget, error taxonomy e receipt; l'adapter Gemini usa structured output e non esegue retry/fallback. Il client mantiene consenso one-shot e `Adotta/Adatta/Lascia`, aggiungendo solo disclosure del destinatario remoto e failure copy stabile.

**Tech Stack:** TypeScript 7, Bun test, Express 4, React 19, `@google/genai`, TRAMA Contextual Copilot Core, Playwright/Chromium qualification.

**Spec:** `docs/superpowers/specs/2026-10-25-lib-01e-governed-provider-runtime-design.md`

## Global Constraints

- Baseline obbligatoria: `main@30f3b64ff683322795b6ea4b3ab684280115a6ee`.
- `LibraryProposalRequestV1` e `TeachingProposalV1` persistente restano compatibili.
- Solo capability `PREPARE`; `SUMMARIZE` resta fuori scope.
- Provider/model sono server-only; nessuna scelta utente e nessuna API key nel browser.
- Provider iniziale e unico: `gemini-3.8-flash`.
- Deadline default `45_000 ms`, override env valido soltanto `5_000..120_000`.
- Testo remoto massimo `262_144` byte UTF-8; inline binary massimo 8 MiB invariato.
- Output massimo `2_048` token, `candidateCount=1`, thinking `LOW`, `automaticContinuation=false`.
- Nessun tool, grounding, URL context, retry o fallback automatico.
- Receipt metadata-only; nessun contenuto o identificatore didattico nel receipt/log.
- Ogni task parte da RED causale e termina con PREDEPLOY exact-SHA GREEN prima del task successivo.
- Nessun merge/deploy senza decisione umana finale.

## Review Focus

1. **Timeout ambiguo lato provider:** un abort locale non deve innescare retry automatici; test Task 1/2 verificano invocation count = 1.
2. **Prompt injection nella fonte:** source text deve essere trattato come untrusted data e nessun tool/segreto deve essere disponibile; test Task 2 ispeziona config/parts.
3. **Leak di diagnostica vendor:** messaggi/error object Gemini non devono arrivare al browser; test Task 3/5 verificano error envelope/copy.
4. **Budget bypass:** testo enorme/base64 non valido deve fallire prima del provider; test Task 3 verifica provider call count = 0.
5. **Consent replay:** dopo rate-limit/timeout una nuova generazione deve richiedere nuovo consenso e non auto-retry; test browser Task 6.

---

## File structure

### Nuovi file

- `src/server/teachingProposalRuntime.ts` — runtime config, deadline, receipt, provider-neutral errors e no-retry boundary.
- `src/server/geminiTeachingProposalProvider.ts` — adapter Gemini, structured output e vendor error normalization.
- `src/services/libraryProposalErrors.ts` — parser/copy degli errori stabili lato browser.
- `src/security/lib01eProviderRuntimeContract.test.ts` — runtime/config/deadline/receipt.
- `src/security/lib01eGeminiAdapterContract.test.ts` — adapter config/schema/prompt/error mapping.
- `src/security/lib01eProposalErrorContract.test.ts` — route/client error envelope e input budgets.
- `tests/browser/lib01e-governed-provider-runtime.spec.cjs` — disclosure/failure/manual retry/success.

### Modifiche

- `src/server/teachingProposalProvider.ts` — solo contratti provider-neutral, nessun import Google.
- `src/server/libraryProposalRoute.ts` — runtime, requestId, budget, receipt e error envelope.
- `src/library/teachingProposal.ts` — tipi receipt/success/error envelope senza cambiare `TeachingProposalV1`.
- `src/services/libraryProposalService.ts` — parsing success/error tipizzato.
- `src/components/LibraryProposalPanel.tsx` — provider disclosure e copy errori, comportamento invariato.
- `server.ts` — runtime singleton, provider metadata endpoint e request abort signal.
- `.env.example` — timeout opzionale.
- `.github/workflows/browser-qualification.yml` — include spec LIB-01E.

---

### Task 1: Provider-neutral runtime contract, config e receipt

**Files:**
- Create: `src/server/teachingProposalRuntime.ts`
- Create: `src/security/lib01eProviderRuntimeContract.test.ts`
- Modify: `src/server/teachingProposalProvider.ts`

**Interfaces:**
- Consumes: `TeachingProposalProviderInput` esistente.
- Produces:
  - `TeachingProposalProviderDescriptor`
  - `TeachingProposalProviderCallContext`
  - `TeachingProposalProviderCallResult`
  - `TeachingProposalProviderError`
  - `TeachingProposalRuntimeConfig`
  - `TeachingProposalRuntimeReceipt`
  - `createTeachingProposalRuntime(config, provider, clock?)`
  - runtime method `generate(input, externalSignal?)`.

- [ ] **Step 1: Write the failing runtime contract tests**

Test names/assertions:

```ts
it('uses the canonical defaults and clamps invalid timeout env values')
it('calls the provider exactly once and returns a metadata-only receipt')
it('times out one provider call without retrying')
it('propagates an external abort without starting another provider call')
it('receipt never contains source/context identifiers or content')
```

Expected constants: deadline `45_000`, maxTextBytes `262_144`, maxInlineBytes `8 * 1024 * 1024`, maxOutputTokens `2_048`, attemptCount `1`.

- [ ] **Step 2: Run the focused test and verify causal RED**

Run: `bun test src/security/lib01eProviderRuntimeContract.test.ts`
Expected: FAIL because runtime/contracts do not exist.

- [ ] **Step 3: Implement provider-neutral contracts**

Move Google-specific code out of `src/server/teachingProposalProvider.ts`; keep only types/errors used by runtime/adapters.

`TeachingProposalProvider.generate` signature:

```ts
generate(
  input: TeachingProposalProviderInput,
  context: TeachingProposalProviderCallContext
): Promise<TeachingProposalProviderCallResult>
```

- [ ] **Step 4: Implement `createTeachingProposalRuntime`**

One call only; compose deadline/external abort; collect duration and allowlisted provider metadata; no retry/fallback.

- [ ] **Step 5: Run focused test GREEN**

Run: `bun test src/security/lib01eProviderRuntimeContract.test.ts`
Expected: PASS.

- [ ] **Step 6: Run PREDEPLOY exact-SHA and commit**

Expected: all existing tests/typecheck/build/startup GREEN.
Commit: `feat(lib-01e): add governed provider runtime`

---

### Task 2: Gemini structured-output adapter and prompt hardening

**Files:**
- Create: `src/server/geminiTeachingProposalProvider.ts`
- Create: `src/security/lib01eGeminiAdapterContract.test.ts`
- Modify: `server.ts` only after adapter contract is GREEN if import path needs compiling.

**Interfaces:**
- Consumes provider contracts from Task 1.
- Produces `createGeminiTeachingProposalProvider(options)` implementing `TeachingProposalProvider`.

Adapter options must allow a fake client factory in tests while production default creates one `GoogleGenAI` instance.

- [ ] **Step 1: Write the failing adapter tests**

```ts
it('uses gemini-3.8-flash structured JSON output with the canonical schema')
it('sets candidateCount 1, maxOutputTokens 2048, LOW thinking and automaticContinuation false')
it('provides no tools, grounding or URL context')
it('keeps source content out of systemInstruction and labels it as untrusted material')
it('passes the runtime AbortSignal into generation config')
it('captures responseId modelVersion and token usage when present')
it('normalizes 429, timeout, blocked and 5xx without exposing raw vendor messages')
it('never performs a second generateContent call after a failure')
```

- [ ] **Step 2: Run focused test RED**

Run: `bun test src/security/lib01eGeminiAdapterContract.test.ts`
Expected: FAIL because adapter does not exist.

- [ ] **Step 3: Implement the JSON schema and prompt split**

Use `responseMimeType: 'application/json'` + `responseJsonSchema`; all seven `TeachingProposalContent` fields required; `additionalProperties: false`.

Use a separate `systemInstruction`; source text appears only in user/source parts.

- [ ] **Step 4: Implement Gemini error normalization and metadata capture**

Map vendor status/name/reason to provider-neutral error codes. Do not throw raw vendor strings as public messages.

- [ ] **Step 5: Run focused test GREEN**

Run: `bun test src/security/lib01eGeminiAdapterContract.test.ts`
Expected: PASS.

- [ ] **Step 6: PREDEPLOY exact-SHA and commit**

Commit: `feat(lib-01e): harden gemini proposal adapter`

---

### Task 3: Route budgets, stable error envelope and canonical parsing

**Files:**
- Create: `src/security/lib01eProposalErrorContract.test.ts`
- Modify: `src/server/libraryProposalRoute.ts`
- Modify: `src/library/teachingProposal.ts`

**Interfaces:**
- Consumes `TeachingProposalRuntime.generate`.
- Produces typed `LibraryProposalSuccessEnvelope` and `LibraryProposalErrorEnvelope`.

- [ ] **Step 1: Write failing route/error contract tests**

```ts
it('rejects UTF-8 text over 262144 bytes before runtime invocation')
it('preserves the existing 8 MiB inline binary ceiling')
it('maps remote policy denial to REMOTE_POLICY_DENIED 403')
it('maps provider not configured rate limit timeout blocked unavailable and generic errors to stable envelopes')
it('never exposes raw provider error messages or stacks')
it('validates runtime output locally before success')
it('adds the runtime receipt without persisting it into TeachingProposalV1')
```

- [ ] **Step 2: Run focused RED**

Run: `bun test src/security/lib01eProposalErrorContract.test.ts`
Expected: FAIL on missing envelopes/runtime route integration.

- [ ] **Step 3: Add response/error types to `teachingProposal.ts`**

Do not change persisted `TeachingProposalV1` fields.

- [ ] **Step 4: Refactor `handleLibraryProposalRequest` to consume runtime**

Generate requestId server-side; enforce text budget before runtime; map runtime errors; parse output with existing canonical parser; success `{ proposal, receipt }`.

- [ ] **Step 5: Run focused GREEN and legacy LIB-01D contracts**

Run:
`bun test src/security/lib01eProposalErrorContract.test.ts src/security/lib01dProposalRouteContract.test.ts src/security/lib01dTeachingProposalContract.test.ts`
Expected: PASS.

- [ ] **Step 6: PREDEPLOY exact-SHA and commit**

Commit: `feat(lib-01e): govern proposal route failures and budgets`

---

### Task 4: Server singleton, provider status endpoint and abort propagation

**Files:**
- Modify: `server.ts`
- Modify: `.env.example`
- Test: extend `src/security/lib01eProviderRuntimeContract.test.ts` or `lib01eProposalErrorContract.test.ts` with source-contract assertions.

**Interfaces:**
- Consumes runtime/provider factory.
- Produces `GET /api/copilot/library-proposal/provider` metadata endpoint and POST wired to one runtime instance.

- [ ] **Step 1: Write failing server source-contract tests**

Assertions:

```ts
expect(server).toConstructRuntimeOnce()
expect(providerEndpoint).toExposeOnlyAvailableDisplayNameModel()
expect(missingKey).not.toCrashStartup()
expect(postRoute).toBindRequestCloseToAbortSignal()
```

- [ ] **Step 2: Run RED**

Expected: current `server.ts` constructs Gemini per request and has no metadata endpoint.

- [ ] **Step 3: Build runtime once at module startup**

Missing `GEMINI_API_KEY` yields runtime status unavailable; server still starts.

- [ ] **Step 4: Add provider metadata GET**

Response fields only: `available`, `provider`, `model`.

- [ ] **Step 5: Bind HTTP close/aborted lifecycle to runtime signal**

No retry is introduced.

- [ ] **Step 6: Update `.env.example`**

Add `LIBRARY_PROPOSAL_TIMEOUT_MS=45000`.

- [ ] **Step 7: PREDEPLOY exact-SHA and commit**

Commit: `feat(lib-01e): wire provider runtime at server boundary`

---

### Task 5: Typed client errors and transparent provider disclosure

**Files:**
- Create: `src/services/libraryProposalErrors.ts`
- Modify: `src/services/libraryProposalService.ts`
- Modify: `src/components/LibraryProposalPanel.tsx`
- Test: extend/create `src/security/lib01eProposalErrorContract.test.ts` assertions for client source contract.

**Interfaces:**
- Produces `LibraryProposalServiceError` with `code`, `retriable`, optional `requestId`.
- `requestLibraryTeachingProposal` returns parsed `{ proposal, receipt }`.

- [ ] **Step 1: Write failing client contract tests**

```ts
it('parses stable server error envelopes and ignores raw unknown fields')
it('does not auto retry retriable errors')
it('loads provider metadata without exposing secrets')
it('shows provider recipient before one-shot consent')
it('does not promise provider training/data-use terms')
it('keeps consent false after every attempted generation')
```

- [ ] **Step 2: Run RED**

Expected: client still expects flat `{error:string}` and has no provider disclosure.

- [ ] **Step 3: Implement error parser/copy**

Stable Italian copy by code; no vendor raw message.

- [ ] **Step 4: Update proposal service**

Parse success receipt and typed errors; one fetch only.

- [ ] **Step 5: Update `LibraryProposalPanel` progressive disclosure**

Before consent, name the server-declared provider in one concise line; preserve existing `Adotta/Adatta/Lascia` hierarchy.

- [ ] **Step 6: Run focused GREEN + UX source contracts**

Run LIB-01D/LIB-01E security tests.

- [ ] **Step 7: PREDEPLOY exact-SHA and commit**

Commit: `feat(lib-01e): surface governed provider failures`

---

### Task 6: Real-browser runtime failure and recovery qualification

**Files:**
- Create: `tests/browser/lib01e-governed-provider-runtime.spec.cjs`
- Modify: `.github/workflows/browser-qualification.yml`

**Interfaces:**
- Uses no live provider in CI; intercepts metadata/POST routes with deterministic synthetic responses.

- [ ] **Step 1: Write browser RED only**

Desktop + mobile scenarios:

```text
provider metadata -> recipient visible before consent
429 -> one request, no proposal, no automatic retry
retry path -> consent required again
504 -> one request, consent required again
503 unavailable -> readable state, no false success
success -> proposal -> Adatta -> Adotta -> reload persists as before
context change during pending -> stale result not rendered
```

Assert request body has no provider/model/student fields.

- [ ] **Step 2: Add spec to Browser Qualification and run RED**

Expected: fail only on still-missing end-to-end LIB-01E behavior, not bootstrap.

- [ ] **Step 3: Correct only browser-demonstrated defects**

No speculative UI changes.

- [ ] **Step 4: Run Browser Qualification exact-SHA GREEN**

Required: all existing browser tests + new LIB-01E desktop/mobile PASS; UX-QA-01/02 PASS; zero unexpected page/console errors.

- [ ] **Step 5: Commit**

Commit: `test(browser): qualify governed provider runtime`

---

### Task 7: Final exact-SHA qualification and independent review

**Files:** no product changes unless a proven finding requires a new RED→GREEN cycle.

- [ ] **Step 1: Freeze exact candidate SHA**

Verify branch is based on `main@30f3b64ff683322795b6ea4b3ab684280115a6ee` and record head.

- [ ] **Step 2: Run fresh PREDEPLOY on exact candidate**

Require all tests, typecheck, build, production startup smoke PASS.

- [ ] **Step 3: Run fresh Browser Qualification on same exact candidate**

Require full Playwright PASS + UX-QA-01/02 zero blocking findings.

- [ ] **Step 4: Open Draft PR, DO NOT MERGE**

Body must record exact candidate, baseline, gate IDs, browser artifact/digest, privacy/runtime invariants.

- [ ] **Step 5: Request independent Codex review on exact SHA**

Review focus: timeout/no-retry, provider leak, prompt injection, error raw-message leak, receipt privacy, compatibility with LIB-01D.

- [ ] **Step 6: Resolve findings only through causal RED→GREEN**

Any candidate change invalidates prior exact-SHA qualification and requires rerun.

- [ ] **Step 7: Stop at human integration decision**

No merge/deploy without explicit authorization.

---

## Plan self-review

### Spec coverage

- Provider-neutral runtime: Tasks 1/4.
- Structured output and prompt hardening: Task 2.
- Budget/deadline/no retry: Tasks 1/3.
- Stable failure taxonomy: Tasks 2/3/5.
- Receipt privacy/usage metadata: Tasks 1/2/3.
- Provider disclosure without user configuration: Tasks 4/5.
- Browser/manual retry and consent replay: Task 6.
- Exact-SHA + independent review + human merge boundary: Task 7.

No spec requirement is left without an owning task.

### Type consistency

`TeachingProposalProvider` -> `TeachingProposalRuntime` -> `handleLibraryProposalRequest` -> success/error envelope -> client parser is the only generation chain. `TeachingProposalV1` persisted contract remains unchanged.

### Proportion

Seven tasks are justified because runtime, vendor adapter, server route, server lifecycle, client UX and browser qualification each have independently rejectable failure modes. No task introduces a separate product capability.