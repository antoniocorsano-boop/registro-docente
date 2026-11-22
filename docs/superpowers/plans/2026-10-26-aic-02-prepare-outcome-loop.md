# AIC-02 PREPARE Outcome Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the PREPARE loop so a teacher can explicitly choose either `Adotta in Biblioteca` or `Adotta e aggiungi all'UDA`, with the compound choice persisted truthfully as one durable Library+UDA commit.

**Architecture:** Keep the current generated proposal ephemeral until the teacher chooses an outcome. Reuse `SecureVault.putMany()` through a new `SecureAppStorage.saveLibraryUdasAndMeta()` method so the compound action persists `library`, `udas` and `meta` in one vault batch and publishes React state only after that batch succeeds. Do not introduce a new UDA schema: when an explicit lesson exists, append the adopted activity to that lesson's notes; otherwise create one `UdaLesson` inside the selected UDA.

**Tech Stack:** React + TypeScript, Bun, existing `MutationCoordinator`, Secure Local Vault / IndexedDB, existing Library proposal model, GitHub Actions PREDEPLOY, Playwright 1.64.1.

**Spec:** `docs/superpowers/specs/2026-10-26-ai-teacher-copilot-v1-design.md`

**Program:** `docs/superpowers/plans/2026-10-26-ai-teacher-copilot-v1-program.md`

**Frozen predecessor:** `main@21251b4cb10a4bba4852a1e967e6fb52a0ff9abb` (`AIC-01 INTEGRATED IN MAIN / POST-MERGE PREDEPLOY PASS`)

## Global Constraints

- Privacy-first outranks autonomy, convenience, latency and generative quality.
- No remote model receives data referable to a single student, including pseudonymized individual data.
- AIC-02 does not widen the remote proposal request, provider/model policy, Core authority, intent catalog or retry behavior.
- Generated proposals remain ephemeral until an explicit teacher choice.
- The three teacher outcomes are explicit: `Adotta in Biblioteca`, `Adotta e aggiungi all'UDA`, `Lascia`.
- No default-checked checkbox, implicit UDA write or automatic compound adoption.
- `Adotta e aggiungi all'UDA` must not be implemented as two sequential durable writes presented as one atomic action.
- The compound commit increments `meta.changes` exactly once.
- React refs/state for Library and UDA publish only after the compound durable batch succeeds.
- A persist failure leaves the generated proposal available for retry and must not show success.
- Stable adoption IDs are reused on retry so an uncertain/rejected write does not create duplicate source/lesson IDs.
- Context drift is fail-closed: if the target UDA or explicit lesson no longer matches the generated proposal, require review instead of silently retargeting.
- Existing Library-only adoption remains supported and must not mutate the UDA.
- No new UDA persistence schema or migration in AIC-02.
- No automatic merge, deploy or publication after qualification.
- Every behavior/contract change follows causal RED → GREEN.
- Automatic/browser qualification uses synthetic data only.

## Review Focus

1. **Persist fails after teacher chooses the compound action** — neither Library nor UDA may publish a success state; the proposal remains retryable with stable IDs. Covered by Task 3 persistence/coordinator tests.
2. **UDA/lesson changes after proposal generation** — adoption must fail closed with `AIC02_CONTEXT_CHANGED_REVIEW_REQUIRED`; it must not attach to another UDA/lesson. Covered by Task 1 and Task 3 tests.
3. **Teacher chooses Library-only adoption** — source persists exactly as today and UDA lessons remain byte-for-byte unchanged. Covered by Task 4 source contract and Task 5 browser journey.
4. **Explicit lesson vs UDA-only context** — explicit lesson is enriched in place without adding a duplicate lesson; UDA-only context creates exactly one lesson. Covered by Task 1 and Task 5.
5. **Retry after a failed compound write** — source/lesson IDs are reused and one eventual successful commit creates one source and one outcome only. Covered by Task 3 and Task 4 tests.

---

## File Structure

- `src/library/teachingProposalOutcome.ts` — pure domain mapping from an adopted teaching proposal to Library source + UDA lesson outcome; no persistence or React.
- `src/library/teachingProposalOutcome.test.ts` — domain RED/GREEN for UDA-only, explicit-lesson, links and context-drift cases.
- `src/persistence/teachingProposalOutcomeMutation.ts` — derives the compound Library/UDA/meta candidate and receipt; increments backup changes once.
- `src/persistence/teachingProposalOutcomeMutation.test.ts` — immutability, single increment, retry-ID and candidate semantics.
- `src/security/secureAppStorage.ts` — adds one atomic storage method for Library+UDA+meta.
- `src/security/secureAppStorage.test.ts` — proves one batch contains exactly `library`, `udas`, `meta` and failure is propagated.
- `src/security/aic02PrepareOutcomeContract.test.ts` — source-level integration contract for App→Composer→Panel and explicit UI choices.
- `src/App.tsx` — one compound mutation callback using the existing coordinator and exact committed refs.
- `src/components/LibraryCopilotComposer.tsx` — passes the compound adoption callback to the proposal panel.
- `src/components/LibraryProposalPanel.tsx` — exposes explicit outcome buttons, stable retry IDs and truthful pending/error behavior.
- `tests/browser/aic-02-prepare-outcome.spec.cjs` — real Chromium persistence journeys, including reload and mobile.
- `.github/workflows/browser-qualification.yml` — runs the AIC-02 browser spec in the canonical browser gate.

### Task 1: Pure proposal → UDA outcome mapping

**Files:**
- Create: `src/library/teachingProposalOutcome.ts`
- Create: `src/library/teachingProposalOutcome.test.ts`

**Interfaces:**
- Consumes: `TeachingProposalV1`, `TeachingProposalContent`, `ResolvedLibraryTeachingContext`, `LibrarySource`, `UdaRecord`, `UdaLesson`, and existing `createInternalSourceFromTeachingProposal()`.
- Produces:
  - `export interface TeachingProposalUdaAdoptionInput { proposal; content; teachingContext; udas; sourceId; lessonId; capturedAt; lessonDate }`
  - `export interface TeachingProposalUdaAdoptionReceipt { sourceId: string; udaId: string; lessonId: string; mode: 'existing-lesson' | 'new-lesson' }`
  - `export function buildTeachingProposalUdaAdoption(input: TeachingProposalUdaAdoptionInput): { source: LibrarySource; udas: UdaRecord[]; receipt: TeachingProposalUdaAdoptionReceipt }`

- [ ] **Step 1: Write failing domain tests**

Add tests asserting:
- UDA-only context creates exactly one new lesson with `id=input.lessonId`, `date=input.lessonDate`, `topic=content.title`, `hours=1`, `notes` equal to the adopted proposal text, and no invented `activityType`;
- explicit lesson context preserves lesson `id/date/topic/hours/activityType`, appends one clearly delimited adopted-activity block to existing notes, and does not increase lesson count;
- the returned adopted Library source is `teacher-professional` and has both `{ targetType: 'uda', targetId: udaId }` and `{ targetType: 'lesson', targetId: receipt.lessonId }` links without duplicates;
- original `udas` input is not mutated;
- missing/mismatched UDA or explicit lesson throws `AIC02_CONTEXT_CHANGED_REVIEW_REQUIRED`.

- [ ] **Step 2: Run the focused test and verify causal RED**

Run: `bun test src/library/teachingProposalOutcome.test.ts`
Expected: FAIL because `teachingProposalOutcome.ts` / `buildTeachingProposalUdaAdoption` does not exist.

- [ ] **Step 3: Implement the minimal pure mapping**

Use `createInternalSourceFromTeachingProposal()` for validation, serialization and provenance. For compound adoption only, normalize the returned source links so the source links to the target UDA and the resulting lesson. If `proposal.context.lessonId` / `teachingContext.lessonId` is present, require the exact current lesson and append the serialized activity to its notes. Otherwise create one new `UdaLesson` using the stable `lessonId` provided by the caller.

- [ ] **Step 4: Run focused tests to GREEN**

Run: `bun test src/library/teachingProposalOutcome.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit Task 1**

Commit message: `feat: map adopted proposals into UDA outcomes`

### Task 2: Atomic Library + UDA + meta storage primitive

**Files:**
- Modify: `src/security/secureAppStorage.ts`
- Modify: `src/security/secureAppStorage.test.ts`
- Create: `src/security/aic02CompoundStorageContract.test.ts`

**Interfaces:**
- Consumes: existing `SecureVault.putMany(entries)` atomic batch semantics.
- Produces: `SecureAppStorage.saveLibraryUdasAndMeta(library: LibraryStateV1, udas: UdaRecord[], meta: SecureMeta): Promise<void>`.

- [ ] **Step 1: Write failing storage tests**

Assert that the new method exists, delegates through one vault batch, and the batch keys are exactly `library`, `udas`, `meta`. Add a failure-propagation case: rejected `putRecords()` causes `saveLibraryUdasAndMeta()` to reject without reporting success.

- [ ] **Step 2: Run storage tests and verify RED**

Run: `bun test src/security/secureAppStorage.test.ts src/security/aic02CompoundStorageContract.test.ts`
Expected: FAIL because `saveLibraryUdasAndMeta` is missing.

- [ ] **Step 3: Implement the minimal storage method**

Add a single `vault.putMany([...])` call with `library`, `udas`, `meta`. Do not loop over `saveLibraryAndMeta()` / `saveUdasAndMeta()` and do not create compensating pseudo-transactions.

- [ ] **Step 4: Run storage tests to GREEN**

Run: `bun test src/security/secureAppStorage.test.ts src/security/aic02CompoundStorageContract.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit Task 2**

Commit message: `feat: persist library and UDA outcome atomically`

### Task 3: Compound mutation candidate + App coordinator boundary

**Files:**
- Create: `src/persistence/teachingProposalOutcomeMutation.ts`
- Create: `src/persistence/teachingProposalOutcomeMutation.test.ts`
- Modify: `src/App.tsx`
- Create/extend: `src/security/aic02PrepareOutcomeContract.test.ts`

**Interfaces:**
- Consumes: `buildTeachingProposalUdaAdoption()`, `incrementBackupChanges()`, `mutationCoordinator.enqueue(...)`, `secureStorage.saveLibraryUdasAndMeta(...)`.
- Produces:
  - `export interface TeachingProposalOutcomeState { library: LibraryStateV1; udas: UdaRecord[]; meta: SecureMeta }`
  - `export interface TeachingProposalOutcomeCandidate extends TeachingProposalOutcomeState { receipt: TeachingProposalUdaAdoptionReceipt }`
  - `export function deriveTeachingProposalOutcomeCandidate(current: TeachingProposalOutcomeState, input: TeachingProposalUdaAdoptionInput): TeachingProposalOutcomeCandidate`
  - App callback `handleAdoptTeachingProposalToUda(input): Promise<TeachingProposalUdaAdoptionReceipt>`.

- [ ] **Step 1: Write failing mutation tests**

Assert that candidate derivation increments `meta.changes` exactly once, preserves the previous state objects, returns the stable source/lesson receipt, and rejects context drift before persistence. Add an App contract test requiring one coordinator entry whose `persist` is `saveLibraryUdasAndMeta`, whose `publish` updates Library/UDA/meta together, and whose success toast occurs only in `afterCommit`.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `bun test src/persistence/teachingProposalOutcomeMutation.test.ts src/security/aic02PrepareOutcomeContract.test.ts`
Expected: FAIL because the candidate derivation and App compound callback do not exist.

- [ ] **Step 3: Implement candidate derivation**

Call `buildTeachingProposalUdaAdoption()` against `current.udas`, add the returned source through the existing pure Library helper, increment meta once, and return the receipt with the candidate.

- [ ] **Step 4: Implement the App coordinator callback**

Use `mutationCoordinator.enqueue<TeachingProposalOutcomeCandidate>({ getCommitted, derive, persist, publish, afterCommit })`. `getCommitted` must read `libraryRef.current`, `udasRef.current`, `metaRef.current`; `publish` must update all three refs and states only after `persist` resolves. On error, show the existing durable-save failure behavior and rethrow; do not publish a partial source or lesson.

- [ ] **Step 5: Run focused tests to GREEN**

Run: `bun test src/persistence/teachingProposalOutcomeMutation.test.ts src/security/aic02PrepareOutcomeContract.test.ts`
Expected: PASS.

- [ ] **Step 6: Run current security + Library suites**

Run: `bun run test:security && bun run test:library`
Expected: PASS with no regression of REVIEW/LINK/PREPARE, AIC-01 context or existing Library adoption.

- [ ] **Step 7: Commit Task 3**

Commit message: `feat: add governed compound PREPARE mutation`

### Task 4: Explicit teacher outcome UI and stable retry semantics

**Files:**
- Modify: `src/components/LibraryCopilotComposer.tsx`
- Modify: `src/components/LibraryProposalPanel.tsx`
- Modify: `src/security/aic02PrepareOutcomeContract.test.ts`
- Modify as needed: existing LIB-01D/LIB-04D adoption UI contracts, only to reflect the stronger explicit choice labels without weakening prior guarantees.

**Interfaces:**
- Consumes: App callback `onAdoptProposalToUda(input): Promise<TeachingProposalUdaAdoptionReceipt>`.
- Produces: proposal UI choices `Adotta in Biblioteca`, `Adotta e aggiungi all'UDA`, `Lascia`; edited proposals expose the same two adoption destinations.

- [ ] **Step 1: Write failing UI/source contract tests**

Require:
- no generic single `Adotta` action;
- both explicit adoption destinations are visible after generation and after `Adatta`;
- no checkbox/default boolean controls the UDA write;
- Composer passes `onAdoptProposalToUda` to `LibraryProposalPanel`;
- panel owns stable `adoptionSourceIdRef` and `adoptionLessonIdRef` reused after rejection;
- Library-only path continues to call only `onAddSource`;
- compound path calls only `onAdoptProposalToUda` and does not chain `onAddSource` + another UDA callback.

- [ ] **Step 2: Run the contract and verify RED**

Run: `bun test src/security/aic02PrepareOutcomeContract.test.ts`
Expected: FAIL on missing explicit choices/callback/lesson retry ID.

- [ ] **Step 3: Wire Composer → Panel callback**

Add the typed prop without changing intent routing or Core authorization.

- [ ] **Step 4: Implement explicit outcome actions in the panel**

Rename current Library-only adoption to `Adotta in Biblioteca`. Add the compound action using the stable source ID, stable lesson ID, `capturedAt`, and a local-calendar `lessonDate`. Both raw and edited proposal paths must expose the same destination choices. Clear the proposal only after the selected callback resolves; on rejection keep proposal/content/IDs available and render the error.

- [ ] **Step 5: Run UI/source contracts to GREEN**

Run: `bun test src/security/aic02PrepareOutcomeContract.test.ts src/security/lib01dProposalAdoptionContract.test.ts src/security/lib01dProposalUiContract.test.ts src/security/lib04dCopilotPrepareHandoffContract.test.ts`
Expected: PASS.

- [ ] **Step 6: Run PREDEPLOY**

Run through the canonical PREDEPLOY workflow on the exact branch head.
Expected: typecheck, security, Library, build and production startup smoke PASS.

- [ ] **Step 7: Commit Task 4**

Commit message: `feat: expose explicit PREPARE adoption outcomes`

### Task 5: Real-browser outcome and persistence qualification

**Files:**
- Create: `tests/browser/aic-02-prepare-outcome.spec.cjs`
- Modify: `.github/workflows/browser-qualification.yml`

**Interfaces:**
- Consumes: existing browser proposal-provider stubbing patterns and exact candidate app.
- Produces: browser evidence for both adoption choices, explicit-lesson behavior, reload durability, retry-safe failure UX and mobile progressive disclosure.

- [ ] **Step 1: Materialize a causal browser RED against the pre-AIC-02 behavior**

Using a temporary test-only branch from `main@21251b4c…`, add the AIC-02 browser spec and prove at least the compound-choice journey fails because `Adotta e aggiungi all'UDA` / compound UDA persistence do not exist. Close the temporary PR without merge after preserving the RED evidence.

- [ ] **Step 2: Add desktop Library-only journey on the implementation branch**

With synthetic UDA/source and stubbed proposal response: generate proposal → choose `Adotta in Biblioteca` → reload vault → assert adopted source exists and target UDA lesson count/content is unchanged.

- [ ] **Step 3: Add desktop UDA-only compound journey**

Generate in UDA-only context → choose `Adotta e aggiungi all'UDA` → reload → assert exactly one adopted Library source and exactly one new lesson with the proposal title/content; source links include UDA + resulting lesson.

- [ ] **Step 4: Add explicit-lesson compound journey**

Generate against an explicit existing lesson → compound adopt → reload → assert lesson count unchanged, existing lesson identity/date/topic/hours remain unchanged, notes contain the adopted activity once, and Library source links the same lesson.

- [ ] **Step 5: Add mobile 390×844 choice/pending journey**

Assert both explicit destinations and `Lascia` are reachable without hidden/default UDA choice; while compound save is pending, adoption controls are disabled and no success appears before durable resolution.

- [ ] **Step 6: Wire the spec into Browser Qualification and run exact-SHA gate**

Expected: full historical Chromium corpus + AIC-02 journeys PASS, UX-QA-01 PASS, UX-QA-02 PASS, no pageerror/console-error regression.

- [ ] **Step 7: Freeze exact candidate and run final qualification**

Required on the same SHA:
- PREDEPLOY PASS;
- Browser Qualification PASS;
- independent whole-slice Codex review with 0 unresolved Critical/Important findings;
- privacy/security scope audit confirming no remote-wiring expansion;
- PR remains Draft/open/not merged until separate human decision.

- [ ] **Step 8: Commit Task 5**

Commit message: `test: qualify AIC-02 PREPARE outcome loop`

---

## Self-Review Result

- **Spec coverage:** AIC-02's explicit choices, compound durable mutation, truthful persistence, teacher authority and no pseudo-transaction are each assigned to a task.
- **Type consistency:** domain input/receipt are produced in Task 1, consumed by Tasks 3–5; the App callback returns the same receipt type.
- **Privacy scope:** no task changes remote request payloads or student-data handling. Browser fixtures remain synthetic.
- **Persistence truthfulness:** one vault batch persists `library + udas + meta`; `meta.changes` increments once; React state publishes only after durable success.
- **Schema restraint:** existing `UdaLesson` is sufficient; no UDA migration or parallel activity store is introduced.
- **Retry semantics:** stable source/lesson IDs survive failed attempts; context is revalidated at commit time.
- **Review Focus coverage:** all five listed failure modes have explicit focused or browser tests.

## Exit State

`AIC-02 PREPARE OUTCOME LOOP — ENGINEERING QUALIFIED / COMPOUND DURABLE WRITE VERIFIED / HUMAN INTEGRATION DECISION READY`
