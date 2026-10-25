# LIB Single Contextual Copilot Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate Library transformations into one contextual Copilot surface with explicit visible launch context, truthful REVIEW/PREPARE/LINK progressive disclosure, and corpus-backed local intent abstention.

**Architecture:** Keep Library intake/storage/retrieval and TRAMA Core authority unchanged. Add a session-only App-owned launch-context handoff; Library cards become source/context handoff surfaces rather than proposal engines; `LibraryCopilotComposer` becomes the single transformation owner. Then qualify the existing local IntentPort against a versioned Italian teacher-utterance corpus before any new intent is added.

**Tech Stack:** React 19, TypeScript, Bun test, Playwright/Chromium, vendored `@trama/contextual-copilot-core@0.3.0`, vendored `@trama/contextual-copilot-intent-embedding@0.1.0`.

**Spec:** `docs/superpowers/specs/2026-10-25-lib-single-contextual-copilot-workflow-design.md`

## Global Constraints

- Baseline: `main@4e370d214cc2ec6ff00a2032667d7697a7f6e868`.
- Supported text intents remain exactly `REVIEW`, `LINK`, `PREPARE`; no `SUMMARIZE`, `ASK`, `CREATE`, `EXPLAIN` in this block.
- No change to TRAMA Core or the vendored intent adapter unless a separate blocking finding is demonstrated first.
- No new provider, endpoint, SDK, API key, RAG, persisted vector index or remote fallback.
- Intent classification remains local and no-network.
- Relevance, semantic retrieval and intent classification remain separate systems.
- LINK retains Core authorization plus explicit human confirmation immediately before durable write.
- PREPARE reuses the existing `LibraryProposalPanel` and provider disclosure/one-shot consent path.
- `LibrarySourceCard` must not render `LibraryProposalPanel` after consolidation.
- Launch context is session-only, metadata-only, visible, changeable and removable.
- No student names/grades/behaviors or source payload content enter launch context or Core context.
- No merge, deploy or publish without a separate human decision.

## Review Focus

1. **Stale handoff:** source/UDA/lesson deleted or changed after Copilot launch -> state must invalidate and fail closed.
2. **Cross-class surprise:** explicit launch context from one class while current class changes -> no silent reuse; teacher sees and must resolve the mismatch.
3. **Unsupported/mixed utterance:** text resembles supported actions but asks for SUMMARIZE/delete/two actions -> zero executable action.
4. **Remote boundary:** opening PREPARE after local discovery -> zero provider request before existing disclosure/consent action.
5. **Mobile state density:** source + context + message + result at 390x844 -> usable controls >=44px and no permanent horizontal overflow.

---

### Task 1: Freeze the launch-context contract with a causal RED

**Files:**
- Create: `src/library/copilotLaunchContext.ts`
- Create: `src/library/copilotLaunchContext.test.ts`
- Create: `src/security/librarySingleCopilotSurfaceContract.test.ts`

**Interfaces:**
- Produces:
  - `CopilotLaunchSurface`
  - `CopilotLaunchContext`
  - `LibraryCopilotLaunchRequest`
  - `resolveLaunchTeachingContext(request, udas): ResolvedLibraryTeachingContext | null`
- Consumes: existing `resolveLibraryTeachingContext()` and `UdaRecord`.

- [ ] **Step 1: Write the failing domain tests**

Cover:
- `sourceId + udaId + lessonId` resolves only when all references are valid;
- UDA-only launch resolves UDA context;
- stale UDA/lesson returns null;
- no IDs returns null;
- launch context contains no source payload/student data fields.

- [ ] **Step 2: Write the failing structural contract**

Assert the future ownership boundary:
- App imports the launch contract;
- Composer accepts a launch request;
- LibraryView can hand off to the Copilot;
- `LibrarySourceCard.tsx` does **not** import `LibraryProposalPanel`;
- `LibrarySourceCard.tsx` does **not** call `resolveLibraryContextActions` or `dispatchLibraryContextAction` after consolidation.

- [ ] **Step 3: Run RED**

Run:

```bash
bun test src/library/copilotLaunchContext.test.ts src/security/librarySingleCopilotSurfaceContract.test.ts
```

Expected: FAIL because the launch contract and consolidated ownership do not exist yet.

- [ ] **Step 4: Implement only `src/library/copilotLaunchContext.ts`**

Required signatures:

```ts
export type CopilotLaunchSurface =
  | 'library'
  | 'home'
  | 'class-dashboard'
  | 'uda'
  | 'lesson'
  | 'planning'
  | 'other-teacher-surface';

export interface CopilotLaunchContext {
  surface: CopilotLaunchSurface;
  className?: string;
  udaId?: string;
  lessonId?: string;
  sourceId?: string;
}

export interface LibraryCopilotLaunchRequest {
  nonce: number;
  context: CopilotLaunchContext;
}

export function resolveLaunchTeachingContext(
  request: LibraryCopilotLaunchRequest | null,
  udas: UdaRecord[]
): ResolvedLibraryTeachingContext | null;
```

Rules:
- lesson requires matching UDA;
- stale references return null;
- no fallback inference inside this function;
- no mutation/persistence.

- [ ] **Step 5: Run domain tests**

Expected: domain tests PASS; structural contract remains RED until Tasks 2–3.

- [ ] **Step 6: Commit**

```bash
git add src/library/copilotLaunchContext.ts src/library/copilotLaunchContext.test.ts src/security/librarySingleCopilotSurfaceContract.test.ts
git commit -m "test: freeze contextual copilot launch contract"
```

---

### Task 2: Add App-owned session handoff without changing authority

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/LibraryView.tsx`
- Modify: `src/components/LibrarySourceCard.tsx`
- Test: `src/security/librarySingleCopilotSurfaceContract.test.ts`

**Interfaces:**
- Consumes: `LibraryCopilotLaunchRequest`, `CopilotLaunchContext` from Task 1.
- Produces:
  - App callback `openLibraryCopilot(input)`;
  - `LibraryView.onOpenCopilot`;
  - `LibrarySourceCard.onOpenCopilot`.

- [ ] **Step 1: Extend the RED contract for App ownership**

Require:
- launch request state exists only in React session state/ref, not Secure Local Vault;
- App passes `launchRequest` to `LibraryCopilotComposer`;
- App passes `onOpenCopilot` into `LibraryView`;
- global Copilot receives an ambient surface context from `activeTab` + current class only, never student data.

- [ ] **Step 2: Run the structural test and observe RED**

```bash
bun test src/security/librarySingleCopilotSurfaceContract.test.ts
```

- [ ] **Step 3: Implement the App handoff**

Add App-owned state with monotonically increasing `nonce` so repeated launches of the same source/context are observable.

Required behavior:
- Library handoff can include `sourceId`, `udaId`, `lessonId`, `className`;
- direct global trigger can use ambient `surface` + `className` only;
- no persistence of the launch request;
- student portal never mounts the Copilot, unchanged.

- [ ] **Step 4: Wire LibraryView -> LibrarySourceCard -> App**

Do not remove old transformation UI yet in this step; only establish the handoff callback and a temporary `Usa con Copilota` action path so the next task can remove duplication safely.

- [ ] **Step 5: Run tests/typecheck**

```bash
bun test src/library/copilotLaunchContext.test.ts src/security/librarySingleCopilotSurfaceContract.test.ts
bun run typecheck
```

Expected: launch/App assertions PASS; source-card no-duplication assertions may still be RED until Task 3.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/components/LibraryView.tsx src/components/LibrarySourceCard.tsx src/security/librarySingleCopilotSurfaceContract.test.ts
git commit -m "feat: add contextual copilot launch handoff"
```

---

### Task 3: Make the Copilot the single transformation surface

**Files:**
- Modify: `src/components/LibrarySourceCard.tsx`
- Modify: `src/components/LibraryCopilotComposer.tsx`
- Modify: `src/security/librarySingleCopilotSurfaceContract.test.ts`
- Modify or extend: `src/library/libraryIntentDiscovery.test.ts`

**Interfaces:**
- Consumes: App launch request from Task 2.
- Produces: one owner for REVIEW/LINK/PREPARE transformation state: `LibraryCopilotComposer`.

- [ ] **Step 1: Add RED assertions for source-card consolidation**

Require:
- no `LibraryProposalPanel` import/render in source card;
- no Core action resolution/dispatch in source card;
- relevance/teaching-context selection may remain;
- card handoff passes selected source + explicit UDA/lesson context to `onOpenCopilot`;
- secondary manual source-management link/unlink remains allowed.

- [ ] **Step 2: Run RED**

```bash
bun test src/security/librarySingleCopilotSurfaceContract.test.ts
```

- [ ] **Step 3: Remove duplicated transformation ownership from `LibrarySourceCard.tsx`**

Remove:
- `LibraryProposalPanel` usage;
- `resolveLibraryContextActions` / `dispatchLibraryContextAction` transformation flow;
- card-local REVIEW transformation disclosure;
- card-local governed contextual LINK transformation buttons.

Keep:
- source card metadata/preview;
- Teaching Context selection/relevance suggestions;
- manual management controls (`Rinomina`, existing-link management, delete);
- `LibraryRelevancePanel`;
- handoff CTA.

- [ ] **Step 4: Add Composer launch binding**

On `launchRequest.nonce` change:
- open the Composer;
- bind requested source if it still exists;
- resolve explicit UDA/lesson with Task-1 helper;
- if stale, show a neutral context error and do not silently substitute another explicit target;
- allow fallback deterministic suggestion only when no valid explicit UDA/lesson was requested.

- [ ] **Step 5: Run tests/typecheck**

```bash
bun test src/library/copilotLaunchContext.test.ts src/library/libraryIntentDiscovery.test.ts src/security/librarySingleCopilotSurfaceContract.test.ts
bun run typecheck
```

Expected: structural contract fully GREEN.

- [ ] **Step 6: Commit**

```bash
git add src/components/LibrarySourceCard.tsx src/components/LibraryCopilotComposer.tsx src/library/libraryIntentDiscovery.test.ts src/security/librarySingleCopilotSurfaceContract.test.ts
git commit -m "refactor: consolidate library transformations in copilot"
```

---

### Task 4: Enforce intent-owned progressive disclosure and truthful REVIEW

**Files:**
- Modify: `src/components/LibraryCopilotComposer.tsx`
- Modify: `src/library/contextualCoreAdapter.ts` only if label/copy ownership requires it; do not change capabilities/policy.
- Create: `tests/browser/library-contextual-copilot-handoff.spec.cjs`
- Modify: `.github/workflows/browser-qualification.yml`

**Interfaces:**
- Consumes: existing `discoverLibraryCopilotIntent()`, `resolveLibraryCopilotRequest()`, `dispatchLibraryContextAction()`.
- Produces: browser-observable REVIEW/LINK/PREPARE/no-match state machine.

- [ ] **Step 1: Write browser RED for progressive disclosure**

Desktop 1280x900 and mobile 390x844 must prove:

1. source-card `Usa con Copilota` opens Composer bound to source and chosen context;
2. before submit, no proposal panel/provider disclosure is visible merely because context exists;
3. REVIEW utterance shows local review only, no LINK/PREPARE;
4. LINK utterance shows governed LINK only;
5. PREPARE utterance reveals existing `LibraryProposalPanel` only after discovery;
6. SUMMARIZE/OOS utterance shows no actions;
7. changing message/source/context clears previous disclosure;
8. no pageerror/overflow; primary controls >=44px mobile.

- [ ] **Step 2: Add test to permanent Browser Qualification and observe causal RED**

Expected: existing product fails specifically on duplicated/unconditional PREPARE/review behavior before the implementation.

- [ ] **Step 3: Implement intent-owned disclosure in Composer**

Required behavior:
- render PREPARE container only when `isPrepareOpen === true` from PREPARE discovery or a future explicit PREPARE action;
- REVIEW becomes an actionable local panel named/copy-aligned to `Controlla nel contesto` (capability ID may remain `REVIEW`);
- REVIEW panel shows only verifiable local facts: source kind/status/privacy, active/proposed context, links, provenance/content availability;
- LINK remains the existing governed flow;
- no-match renders zero action cards;
- remove stale `SUMMARIZE` help copy from the first-slice Composer.

- [ ] **Step 4: Verify no provider call before consent**

In the PREPARE browser journey track proposal/provider requests from before intent submit through panel opening. Assert zero proposal-generation POST until the existing explicit provider/consent action.

- [ ] **Step 5: Run focused Browser + unit tests**

```bash
bun test src/library/libraryIntentDiscovery.test.ts src/security/librarySingleCopilotSurfaceContract.test.ts
# run the new Playwright spec in the repository's isolated browser harness
```

Expected: focused GREEN.

- [ ] **Step 6: Commit**

```bash
git add src/components/LibraryCopilotComposer.tsx src/library/contextualCoreAdapter.ts tests/browser/library-contextual-copilot-handoff.spec.cjs .github/workflows/browser-qualification.yml
git commit -m "feat: make copilot disclosure intent-owned"
```

---

### Task 5: Build the Italian teacher-intent reference corpus and calibration gate

**Files:**
- Create: `src/library/fixtures/libraryIntentReferenceCorpus.ts`
- Create: `src/library/intentEvaluation.ts`
- Create: `src/library/intentEvaluation.test.ts`
- Modify: `src/library/libraryIntentCatalog.ts` only when corpus evidence demonstrates a coverage gap.
- Modify: `src/library/contextualCoreAdapter.ts` threshold values only when corpus evidence justifies a change.

**Interfaces:**
- Produces:
  - `LibraryIntentFixture`;
  - `evaluateLibraryIntentCorpus(fixtures, discover): Promise<LibraryIntentEvaluation>`.

Required fixture type:

```ts
export interface LibraryIntentFixture {
  id: string;
  utterance: string;
  expected: 'review-source' | 'link-source-to-uda' | 'prepare-from-source' | 'NO_INTENT_MATCH';
  class: 'canonical' | 'paraphrase' | 'noisy' | 'mixed' | 'hard-negative' | 'oos';
}
```

- [ ] **Step 1: Materialize the corpus before tuning**

Minimum fixed coverage:
- 12 REVIEW utterances;
- 12 LINK utterances;
- 12 PREPARE utterances;
- 12 mixed-intent utterances expected `NO_INTENT_MATCH`;
- 20 OOS/hard-negative utterances expected `NO_INTENT_MATCH`, including SUMMARIZE, delete/remove, generic ASK, CREATE-like requests and semantically adjacent but unsupported teacher requests.

Include canonical, paraphrase and noisy Italian (articles omitted, punctuation, common typos, short commands). Do not generate examples by mechanical one-word substitution only.

- [ ] **Step 2: Write evaluator tests before changing thresholds/catalog**

Metrics:
- canonical supported cases: 100% correct;
- OOS + hard-negative + mixed false-positive rate: **0%**;
- supported-intent precision among emitted matches: **100%**;
- supported paraphrase/noisy recall: **>=90%**;
- any lower-quality result keeps the task RED; do not hide failure by changing expected labels.

- [ ] **Step 3: Run evaluator on the current `minSimilarity=0.55`, adapter `minMargin=0.08`**

```bash
bun test src/library/intentEvaluation.test.ts
```

Record the actual confusion/abstention result before modification.

- [ ] **Step 4: If RED, apply the smallest evidence-backed correction**

Correction order:
1. add genuinely representative consumer-owned examples for demonstrated false negatives;
2. only then consider threshold/margin adjustment;
3. do **not** add a remote model, keyword parser, or unsupported intent;
4. every threshold change must improve the blocking corpus without introducing any OOS/hard-negative false positive.

- [ ] **Step 5: Freeze final metrics in test output/PR evidence**

Do not claim calibration from browser fixtures alone.

- [ ] **Step 6: Commit**

```bash
git add src/library/fixtures/libraryIntentReferenceCorpus.ts src/library/intentEvaluation.ts src/library/intentEvaluation.test.ts src/library/libraryIntentCatalog.ts src/library/contextualCoreAdapter.ts
git commit -m "test: qualify library intent abstention corpus"
```

---

### Task 6: Exact-SHA qualification and whole-branch review

**Files:**
- No new product file unless a demonstrated gate failure requires a causal fix.
- Update PR body/evidence only after exact-SHA qualification.

**Interfaces:**
- Consumes: Tasks 1–5 complete.
- Produces: frozen candidate evidence for human integration decision.

- [ ] **Step 1: Run full PREDEPLOY on the exact candidate SHA**

Require:
- frozen install PASS;
- typecheck PASS;
- security PASS;
- Library PASS;
- intent-evaluation gate PASS;
- build PASS;
- production startup smoke PASS.

- [ ] **Step 2: Run full Browser Qualification on the same exact SHA**

Require:
- all historical browser journeys PASS;
- new contextual-copilot handoff desktop/mobile PASS;
- LIB-04C LINK regression PASS;
- LIB-04D PREPARE regression PASS;
- LIB-05A semantic retrieval regression PASS;
- UX-QA-01 PASS, 0 blocking finding;
- UX-QA-02 PASS, 0 blocking finding.

- [ ] **Step 3: Review the final diff against the design**

Explicitly inspect:
- no duplicate proposal surface in `LibrarySourceCard`;
- no new authority outside Core;
- no new network path from intent evaluation;
- explicit-context precedence and stale invalidation;
- no provider call before PREPARE consent;
- no capability expansion;
- no temporary workflow/scaffolding in final diff.

- [ ] **Step 4: Fresh independent whole-branch review**

Focus on privacy boundary, stale-context races, human-confirmation bypass, progressive-disclosure regression and intent false positives.

- [ ] **Step 5: Freeze candidate and update PR**

State only one of:
- `ENGINEERING QUALIFIED / EXACT-SHA VERIFIED / HUMAN INTEGRATION DECISION PENDING`, or
- actual blocking state with exact failed evidence.

No auto-merge and no deploy.

---

## Follow-on plans — deliberately not part of this implementation plan

After Task 6 is integrated and re-audited, create separate plans for:

1. **Copilot Library retrieval handoff** — text search + explicit local semantic search inside secondary disclosure; no retrieval/intent fusion.
2. **Teacher-visible provenance** — `Derivato da ...` + secondary generation metadata.
3. **Next capability decision** — evaluate `SUMMARIZE` first; do not bundle ASK/CREATE/EXPLAIN.
4. **Canonical activity identity** — prerequisite before activity linking/relevance.
5. **Multi-source transformation/provenance** — only after single-source workflow remains stable.
6. **Release/live verification** — separate human-approved operational cycle on frozen integrated main.

## Self-review

- Spec coverage: launch context, single transformation surface, progressive disclosure, REVIEW truthfulness, PREPARE/LINK governance, state invalidation and intent corpus are each owned by explicit tasks.
- Type consistency: Task 1 produces the launch types consumed by Tasks 2–4.
- Review Focus: all five high-risk input/failure classes have explicit tests in Tasks 1, 4 or 5.
- Proportion: retrieval/provenance/new capabilities are intentionally split into later plans rather than overloading this block.
- Authority: no task transfers policy/dispatch authority away from TRAMA Core.
