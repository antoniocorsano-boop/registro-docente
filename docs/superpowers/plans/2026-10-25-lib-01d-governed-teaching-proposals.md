# LIB-01D — Governed Teaching Proposals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** consentire al docente di trasformare una fonte professionale della Biblioteca in una proposta didattica contestuale, quindi `Adotta / Adatta / Lascia`, mantenendo Core, privacy e persistenza sotto controllo umano.

**Architecture:** Il TRAMA Contextual Copilot Core continua a decidere se `PREPARE` è ammessa. Il contenuto della fonte non entra nel `ContextSnapshot`: viene inviato separatamente a una route server-side soltanto dopo classificazione professionale e opt-in one-shot. Il risultato strutturato resta effimero finché il docente non lo adotta come nuova fonte `internal` teacher-owned collegata a UDA/lezione.

**Tech Stack:** React 19, TypeScript 7, Bun test, Express, `@google/genai`, vendored `@trama/contextual-copilot-core`, Playwright Chromium, Secure Local Vault.

**Spec:** `docs/superpowers/specs/2026-10-25-lib-01d-governed-teaching-proposals-design.md`

## Global Constraints

- Baseline iniziale: `main@4be167245267da6d664e634e5070a2cc9beb265f`.
- TDD RED -> GREEN per ogni comportamento prodotto.
- `ContextSnapshot` non contiene testo, immagine, URL, estratto o note della fonte.
- Remoto vietato per `unknown`, `student-personal`, `STUDENT_PERSONAL`, `STUDENT_SENSITIVE`.
- Opt-in remoto request-scoped e non persistente.
- Solo `PREPARE` viene attivata in LIB-01D; `SUMMARIZE` resta fuori scope.
- Nessun fetch server-side arbitrario di URL.
- Nessuna scrittura diretta dentro UDA/lezione.
- Il materiale adottato usa il dominio Biblioteca esistente come `internal` source.
- Nessun dato studente reale nei test/browser fixture.
- Nessun auto-merge o deploy.

## Review Focus

1. **Consent leakage:** cambiare fonte o teaching context deve revocare l'opt-in remoto e scartare una proposta stale.
2. **Protected data:** una fonte `unknown` o `student-personal` non deve poter produrre nessuna request generativa, anche forzando il client.
3. **Payload creep:** il request builder deve avere allowlist stretta e non includere roster, studentId, voti o stato applicativo non necessario.
4. **False success:** output provider invalido o persistenza fallita non deve apparire come proposta adottata.
5. **Provenance/restore:** il materiale derivato deve sopravvivere backup/restore mantenendo origine e generation metadata validi.

---

### Task 1: Proposal domain and source eligibility

**Files:**
- Create: `src/library/teachingProposal.ts`
- Create: `src/security/lib01dTeachingProposalContract.test.ts`

**Interfaces:**
- Produces: `LibraryProposalRequestV1`, `TeachingProposalContent`, `TeachingProposalV1`, `buildLibraryProposalRequest(...)`, `parseTeachingProposalContent(...)`.
- Consumes: `LibrarySource`, `ResolvedLibraryTeachingContext`, `UdaRecord`.

- [ ] **Step 1: Write the failing contract tests**

Add tests that assert:

- text/note/concept sources use `extractedText ?? payload.text`;
- URL-only web source returns a local ineligible result and never invents fetched text;
- image source converts `data:image/...;base64,...` to `mimeType + dataBase64`;
- PDF/text file MIME is accepted; unsupported MIME is rejected;
- request classification is exactly `TEACHER_PROFESSIONAL` and `explicitTeacherOptIn: true`;
- serialized request does not contain known synthetic student name/id/grade fields;
- parser rejects missing/empty required proposal fields.

- [ ] **Step 2: Run the focused test and verify causal RED**

Run: `bun test src/security/lib01dTeachingProposalContract.test.ts`

Expected: FAIL because `src/library/teachingProposal.ts` and its exports do not exist.

- [ ] **Step 3: Implement the minimal proposal domain**

Implement in `src/library/teachingProposal.ts`:

```ts
export function buildLibraryProposalRequest(input: {
  source: LibrarySource;
  teachingContext: ResolvedLibraryTeachingContext;
  uda: UdaRecord;
  explicitTeacherOptIn: boolean;
}): LibraryProposalRequestV1;

export function parseTeachingProposalContent(value: unknown): TeachingProposalContent;
```

Use a strict MIME allowlist and a strict output parser. No network access in this file.

- [ ] **Step 4: Run focused + full security suite**

Run:
- `bun test src/security/lib01dTeachingProposalContract.test.ts`
- `bun run test:security`

Expected: PASS.

- [ ] **Step 5: Commit**

`git commit -m "feat(lib-01d): add teaching proposal contract"`

---

### Task 2: Core remote one-shot authorization

**Files:**
- Modify: `src/library/contextualCoreAdapter.ts`
- Extend: `src/security/lib01dTeachingProposalContract.test.ts`
- Preserve: `src/security/lib01bContextualCoreContract.test.ts`
- Preserve: `src/security/lib01cTeachingContextContract.test.ts`

**Interfaces:**
- Produces: request-scoped remote resolution/dispatch API without changing default local behavior.

- [ ] **Step 1: Add failing Core authorization tests**

Assert:

- default `resolveLibraryContextActions(source, context)` still hides `prepare-from-source`;
- remote opt-in on `teacher-professional` exposes `prepare-from-source`;
- remote opt-in on `unknown` and `student-personal` remains denied;
- remote snapshot still contains no source payload;
- changing back to no opt-in hides the generative action again.

- [ ] **Step 2: Verify RED**

Run: `bun test src/security/lib01dTeachingProposalContract.test.ts`

Expected: new tests FAIL because the adapter has only the `generativeMode = none` core.

- [ ] **Step 3: Implement minimal dual-core/request-scoped options**

Add a remote Core instance using `createFailClosedPolicyEngine({ generativeMode: 'remote' })` and `createContextualCopilotCore({ generativeMode: 'remote' })`.

Extend snapshot building with an options object whose default keeps `remoteProviderAllowed: false`. Only `source.privacy === 'teacher-professional' && explicitRemoteOptIn === true` may set it true.

Do not change LINK behavior or human-confirmation semantics.

- [ ] **Step 4: Verify focused and regression suites**

Run:
- `bun test src/security/lib01dTeachingProposalContract.test.ts`
- `bun test src/security/lib01bContextualCoreContract.test.ts src/security/lib01cTeachingContextContract.test.ts`
- `bun run test:security`

Expected: PASS.

- [ ] **Step 5: Commit**

`git commit -m "feat(lib-01d): authorize remote prepare per request"`

---

### Task 3: Provider-neutral server route and SEC enforcement

**Files:**
- Create: `src/server/teachingProposalProvider.ts`
- Create: `src/server/libraryProposalRoute.ts`
- Modify: `server.ts`
- Create: `src/security/lib01dProposalRouteContract.test.ts`

**Interfaces:**
- Produces: `TeachingProposalProvider`, `handleLibraryProposalRequest(...)`, route `POST /api/copilot/library-proposal`.
- Consumes: proposal request/parser from Task 1 and `evaluateDataFlow` SEC policy.

- [ ] **Step 1: Write failing route tests using an injected fake provider**

Test without any real network call:

- missing/false opt-in -> 403-equivalent result and provider call count 0;
- classification other than `TEACHER_PROFESSIONAL` -> denied;
- malformed/unsupported source content -> 400-equivalent result;
- valid request -> provider called exactly once;
- provider malformed output -> fail closed, no partial proposal;
- success adds server-side provenance (`provider`, `model`, `generatedAt`) and preserves `sourceId/context` from validated input.

- [ ] **Step 2: Verify causal RED**

Run: `bun test src/security/lib01dProposalRouteContract.test.ts`

Expected: FAIL because route/provider modules are absent.

- [ ] **Step 3: Implement pure handler + provider port**

`TeachingProposalProvider.generate(...)` receives validated, minimized provider input and returns only `TeachingProposalContent`.

The pure handler owns validation and SEC check; Express only maps HTTP request/response.

- [ ] **Step 4: Add Gemini adapter behind the port**

Use existing `GEMINI_API_KEY` and `@google/genai`. One provider invocation only; no automatic retry. Require structured JSON and parse it through Task 1's parser.

For inline image/PDF/text media, pass MIME + base64. Do not fetch URLs.

Add a route-specific JSON body limit sufficient for the existing 8 MiB Library cap; do not globally enlarge unrelated endpoints.

- [ ] **Step 5: Verify**

Run:
- `bun test src/security/lib01dProposalRouteContract.test.ts`
- `bun run test:security`
- `bun run lint`
- `bun run build`

Expected: PASS.

- [ ] **Step 6: Commit**

`git commit -m "feat(lib-01d): add governed proposal endpoint"`

---

### Task 4: Proposal client and progressive-disclosure UI

**Files:**
- Create: `src/services/libraryProposalService.ts`
- Modify: `src/components/LibrarySourceCard.tsx`
- Create: `src/security/lib01dProposalUiContract.test.ts`

**Interfaces:**
- Produces: client request function and ephemeral proposal state in the source card.
- Consumes: Task 1 request model, Task 2 Core authorization, Task 3 endpoint.

- [ ] **Step 1: Write failing source/UI contract tests**

Assert source contains the following interaction boundaries:

- no generative control before `Usa` + valid context;
- `unknown` shows classification requirement rather than remote consent;
- `student-personal` shows remote generation unavailable;
- professional source exposes one-shot consent disclosure;
- opt-in is local state, not persistence/localStorage;
- `Prepara attività` is rendered from resolved Core action, not hard-coded as an always-available action;
- pending generation disables duplicate submit;
- context/source change clears consent and proposal.

- [ ] **Step 2: Verify RED**

Run: `bun test src/security/lib01dProposalUiContract.test.ts`

Expected: FAIL on missing proposal UI/service.

- [ ] **Step 3: Implement client service**

Create:

```ts
export async function requestLibraryTeachingProposal(
  request: LibraryProposalRequestV1,
  signal?: AbortSignal
): Promise<TeachingProposalV1>;
```

Fail closed on non-2xx or invalid JSON.

- [ ] **Step 4: Implement minimal progressive disclosure in `LibrarySourceCard`**

Add only the states required by the spec: classification disclosure, one-shot consent, pending/error, proposal preview. Do not add `SUMMARIZE`.

A successful proposal is still ephemeral at this task.

- [ ] **Step 5: Verify focused + full suites**

Run:
- `bun test src/security/lib01dProposalUiContract.test.ts`
- `bun run test:security`
- `bun run lint`
- `bun run build`

Expected: PASS.

- [ ] **Step 6: Commit**

`git commit -m "feat(lib-01d): add contextual proposal preview"`

---

### Task 5: Adotta / Adatta / Lascia and durable provenance

**Files:**
- Modify: `src/library/types.ts`
- Modify: `src/library/libraryState.ts` only if a helper is required; prefer existing `addLibrarySource`.
- Modify: `src/security/backupPayload.ts`
- Modify: `src/components/LibrarySourceCard.tsx`
- Modify: `src/components/LibraryView.tsx`
- Modify: `src/App.tsx` only for the existing durable `onAddSource` path if needed.
- Extend: `src/security/lib01dTeachingProposalContract.test.ts`
- Extend: `src/security/lib01dProposalUiContract.test.ts`
- Extend backup/persistence contract tests where the repository already covers Library restore.

**Interfaces:**
- Produces: optional `LibrarySourceProvenance`, conversion `TeachingProposalV1 -> internal LibrarySource`, adoption through existing durable Library mutation.

- [ ] **Step 1: Write failing provenance/adoption tests**

Assert:

- adoption creates a *new* source, never mutates the original;
- kind/status/privacy are `internal/ready/teacher-professional`;
- link targets the currently selected lesson when present, otherwise UDA;
- provenance includes `derivedFromSourceId`, provider, model, generatedAt, kind;
- adapted content, not original generated content, is persisted after edit;
- `Lascia` produces zero additions;
- backup validation accepts valid provenance and rejects malformed provenance;
- restore keeps provenance.

- [ ] **Step 2: Verify RED**

Run the focused LIB-01D and backup tests. Expected: FAIL because provenance/adoption do not exist.

- [ ] **Step 3: Implement provenance and internal-source conversion**

Add:

```ts
export function createInternalSourceFromTeachingProposal(input: {
  id: string;
  proposal: TeachingProposalV1;
  content: TeachingProposalContent;
  capturedAt: string;
}): LibrarySource;
```

Use readable text serialization; keep structured generation provenance in the source metadata.

- [ ] **Step 4: Implement the three human decisions**

- `Adotta`: durable add via existing `onAddSource` path;
- `Adatta`: local editor, then durable add only on explicit save;
- `Lascia`: clear ephemeral proposal/consent only.

On persistence failure keep the proposal/editor state available for retry.

- [ ] **Step 5: Verify full suite**

Run:
- focused LIB-01D tests;
- backup/persistence tests;
- `bun run test:security`;
- `bun run lint`;
- `bun run build`.

Expected: PASS.

- [ ] **Step 6: Commit**

`git commit -m "feat(lib-01d): adopt governed proposals into library"`

---

### Task 6: Real-browser causal RED and end-to-end GREEN

**Files:**
- Create: `tests/browser/lib01d-governed-proposal-qualification.spec.cjs`
- Modify: `.github/workflows/browser-qualification.yml`

**Interfaces:**
- Browser tests intercept only `/api/copilot/library-proposal`; no external provider call is used in CI.

- [ ] **Step 1: Add browser tests before any browser-specific product fix**

Desktop 1280x900 journey:

1. open synthetic Library source with explicit synthetic teaching context;
2. verify no proposal request before classification/consent;
3. classify teacher-professional;
4. consent one-shot;
5. verify `Prepara attività` appears through Core resolution;
6. intercept one request and assert body excludes synthetic student fields/names;
7. return valid `TeachingProposalV1` fixture;
8. verify structured proposal;
9. `Lascia` -> no new library source;
10. generate again, `Adatta`, change title/task;
11. save -> new internal source with selected teaching link;
12. reload/unlock -> adopted source and provenance still present.

Mobile 390x844 journey:

- professional source + consent + proposal preview;
- controls >=44x44;
- context change clears proposal/consent;
- no horizontal overflow;
- zero page errors.

- [ ] **Step 2: Run Browser Qualification and require causal RED if product/browser contract is not yet satisfied**

Do not weaken assertions to obtain GREEN. Classify failures as product vs harness with evidence.

- [ ] **Step 3: Apply only minimal product/harness corrections justified by the RED**

No opportunistic redesign.

- [ ] **Step 4: Re-run exact-head Browser Qualification**

Expected: all pre-existing browser tests + LIB-01D tests PASS, UX-QA-01 and UX-QA-02 remain 0 blocking findings.

- [ ] **Step 5: Commit test-only corrections separately if required**

Use explicit `test(browser): ...` commit messages.

---

### Task 7: Final exact-SHA qualification and review

**Files:** no product scope expansion.

- [ ] **Step 1: Run PREDEPLOY on exact final candidate**

Require frozen install, typecheck, full security suite, build and production startup smoke PASS.

- [ ] **Step 2: Run Browser Qualification on the same exact candidate**

Require exact checkout, complete Playwright suite, UX-QA-01 PASS/0 findings and UX-QA-02 PASS/0 findings.

- [ ] **Step 3: Verify diff scope**

No provider secrets, real student fixtures, unrelated refactors, vault redesign, Arena authority changes or `SUMMARIZE` activation.

- [ ] **Step 4: Request independent exact-head review**

Review focus: privacy boundary, Core bypass risk, provider payload, false-success persistence, provenance/backup.

- [ ] **Step 5: Remediate findings via fresh RED -> GREEN if any**

Re-run both canonical gates on the new exact SHA.

- [ ] **Step 6: Stop at human integration decision**

Do not merge or deploy without explicit human approval.

## Self-review result

- Spec coverage: complete for the single `PREPARE` vertical slice; `SUMMARIZE`, retrieval and direct UDA mutation intentionally excluded.
- Type consistency: proposal/request/provenance interfaces have a single owner in Task 1/5.
- Failure coverage: consent reset, protected data, payload allowlist, malformed provider output and restore provenance are pinned to concrete tests.
- Proportion: implementation is split by reviewable behavior boundaries rather than technical scaffolding.
