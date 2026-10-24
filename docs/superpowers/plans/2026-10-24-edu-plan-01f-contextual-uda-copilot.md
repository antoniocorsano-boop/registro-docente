# EDU-PLAN-01F Contextual UDA Copilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a grounded, teacher-controlled conversational copilot inside annual planning/UDA editing, using local EmbeddingGemma retrieval and a swappable local-first generative provider without direct AI writes.

**Architecture:** A deterministic `PlanningContextBuilder` selects the current profile/master/UDA state and excludes student-personal data by construction. Retrieval ranks Arena requirements and private resource chunks locally with the existing embedding service. A `PlanningGenerationProvider` produces structured `CopilotProposal`s; local OpenAI-compatible/llama.cpp/Ollama-style generation is preferred, while Gemini remote uses the server proxy only after explicit teacher opt-in. Proposal adoption goes through normal planning validation/mutation functions, never through the model.

**Tech Stack:** Existing `embeddingService`, TypeScript/Bun, React, Express, `@google/genai`, loopback local generation endpoint, Secure Local Vault settings/planning state.

**Spec:** `docs/superpowers/specs/2026-10-24-edu-plan-01-contextual-uda-copilot-design.md`

## Global Constraints

- Copilot context contains teacher-professional/institutional curriculum data only; no student names, grades, behavior or submissions.
- EmbeddingGemma/local embeddings are retrieval, not the generative chatbot.
- Local generation endpoints are loopback-only.
- Remote generation requires explicit teacher opt-in and existing data-flow policy ALLOW.
- The provider is replaceable; UI/domain do not depend on Gemini-specific response types.
- Every substantive proposal exposes source refs, rationale, uncertainty/grounding status and projected budget/calendar impact where relevant.
- AI never changes `PlanningStateV1` directly.
- Adopt/Adapt runs through existing domain validators and commit-first persistence.
- If generation is unavailable, source retrieval/manual planning remain usable.
- No student assessment/ranking/classification capability is introduced.

## Review Focus

- Current app state contains students but context builder is called → serialized request contains zero student-personal fields.
- Remote provider selected without explicit opt-in → request denied before network call.
- Model returns invalid/unknown operation → proposal rejected, no planning mutation.
- Model cites resource chunk that was not in retrieved context → proposal marked invalid/ungrounded.
- Teacher adopts a proposal that would exceed reserve or violate dependencies → normal planning validation blocks commit.

---

## File structure

**Create**
- `src/planning/copilot/types.ts`
- `src/planning/copilot/contextBuilder.ts`
- `src/planning/copilot/retrieval.ts`
- `src/planning/copilot/provider.ts`
- `src/planning/copilot/localGenerationProvider.ts`
- `src/planning/copilot/remoteGenerationProvider.ts`
- `src/planning/copilot/proposalValidation.ts`
- `src/planning/copilot/proposalApplication.ts`
- `src/components/planning/PlanningCopilotPanel.tsx`
- `src/components/planning/CopilotProposalCard.tsx`
- `src/security/planningCopilotContext.test.ts`
- `src/security/planningCopilotPolicy.test.ts`
- `src/security/planningCopilotProposal.test.ts`
- `src/security/planningCopilotUiContract.test.ts`

**Modify**
- `src/types.ts` — add sanitized `PlanningCopilotConfig` to `AppSettings` or import its type without storing secrets.
- `src/utils.ts` — default local-first copilot config only if defaults are kept here.
- `src/security/dataClassification.ts` only if a new destination is truly required; otherwise reuse `LOCAL_PROVIDER` / `REMOTE_PROVIDER`.
- `src/security/secureAppStorage.ts` / settings sanitization tests if new config contains secret-like fields.
- `src/components/SettingsView.tsx` — local/remote copilot configuration and opt-in copy.
- `src/components/planning/MasterProgramWorkspace.tsx`
- `src/components/planning/MasterUdaEditor.tsx`
- `server.ts` — remote planning generation endpoint.

### Task 1: Freeze copilot request/proposal contracts and privacy-safe context builder

**Interfaces:**
```ts
export interface PlanningCopilotRequest {
  question: string;
  scope: 'master_program' | 'uda';
  profileId: string;
  masterProgramId: string;
  udaId?: string;
}

export function buildPlanningCopilotContext(input: {
  planning: PlanningStateV1;
  request: PlanningCopilotRequest;
}): PlanningCopilotContext;
```

- [ ] **Step 1: Write failing context tests**

Construct an application fixture that also has synthetic students/grades, but pass only planning state to the builder; assert output includes Arena authority/version, selected UDA, capacity/reserve, resource refs/chunks metadata and contains none of `students`, `grades`, `behaviors`, `submissions`.

- [ ] **Step 2: Run** `bun test src/security/planningCopilotContext.test.ts` → FAIL.
- [ ] **Step 3: Implement types/context builder** with no dependency on `AppData`.
- [ ] **Step 4: Re-run** → PASS.
- [ ] **Step 5: Commit**.

### Task 2: Retrieve grounded Arena/resource fragments with local embeddings

**Interfaces:**
```ts
export async function retrievePlanningContext(input: {
  question: string;
  context: PlanningCopilotContext;
  embeddingConfig: LocalEmbeddingConfig;
  limit?: number;
}): Promise<RetrievedPlanningEvidence[]>;
```

- [ ] **Step 1: Write failing retrieval tests** using an injected fake embedding function; assert source ordering, stable refs, dedupe and limit.
- [ ] **Step 2: Run focused tests** → FAIL.
- [ ] **Step 3: Implement retrieval over Arena requirement text + private resource chunks**.
- [ ] **Step 4: Enforce local-only automatic retrieval**; if embedding provider is remote, require an explicit foreground teacher action rather than silently sending private chunks.
- [ ] **Step 5: Re-run** → PASS.
- [ ] **Step 6: Commit**.

### Task 3: Add swappable local-first generation providers

**Interfaces:**
```ts
export interface PlanningGenerationProvider {
  generate(input: GroundedPlanningPrompt): Promise<PlanningGenerationResult>;
}

export function createPlanningGenerationProvider(
  config: PlanningCopilotConfig,
  policy: CopilotPolicyContext
): PlanningGenerationProvider;
```

- [ ] **Step 1: Write failing policy/provider tests**

Assert local non-loopback endpoint denied; remote without opt-in denied; supported local endpoint can call `/v1/chat/completions` with structured JSON instructions; remote route uses only `TEACHER_PROFESSIONAL`/`INSTITUTIONAL_CURRICULUM` payload.

- [ ] **Step 2: Run** `bun test src/security/planningCopilotPolicy.test.ts` → FAIL.
- [ ] **Step 3: Implement local provider** for loopback OpenAI-compatible chat; add narrowly-scoped fallback adapter only if current supported local runtime requires it.
- [ ] **Step 4: Implement remote provider + `/api/planning/copilot`** with server-side Gemini access and explicit policy fields. Do not hardcode the UI to a Gemini model name; model comes from sanitized config/server defaults.
- [ ] **Step 5: Re-run policy tests** → PASS.
- [ ] **Step 6: Commit**.

### Task 4: Validate structured proposals and separate them from state mutation

**Interfaces:**
```ts
export type CopilotProposalType =
  | 'uda_patch'
  | 'uda_split'
  | 'uda_merge'
  | 'learning_experience'
  | 'evidence_strategy'
  | 'schedule_adjustment'
  | 'explanation';

export function validateCopilotProposal(
  proposal: unknown,
  evidence: RetrievedPlanningEvidence[]
): CopilotProposalValidationResult;

export function applyAcceptedCopilotProposal(input: {
  state: PlanningStateV1;
  proposal: CopilotProposal;
  mode: 'adopt' | 'adapt';
  adaptedOperations?: CopilotOperation[];
}): PlanningStateV1;
```

- [ ] **Step 1: Write failing proposal tests**

Reject unknown operations, references outside retrieved evidence, direct `approved` state manipulation, Arena authority mutation, student fields and destructive class-history operations. Assert valid proposal remains a standalone object until `applyAcceptedCopilotProposal` is explicitly called.

- [ ] **Step 2: Run proposal tests** → FAIL.
- [ ] **Step 3: Implement schema/validation** with an allowlist of operations against draft master/UDA fields only.
- [ ] **Step 4: Implement application by calling existing master-program functions**; run normal budget/dependency validation before returning candidate state.
- [ ] **Step 5: Re-run** → PASS.
- [ ] **Step 6: Commit**.

### Task 5: Build contextual chat + Adopt / Adapt / Ignore UX

**Files:** UI components plus settings/workspace files, `planningCopilotUiContract.test.ts`.

- [ ] **Step 1: Write failing UI contract tests**

Assert chat is contextual to current master/UDA, source chips identify Arena vs book/guide, provider state is visible, remote action shows opt-in boundary, proposal card exposes `Adotta`, `Adatta`, `Ignora`, and no generated response auto-populates form fields.

- [ ] **Step 2: Run focused UI test** → FAIL.
- [ ] **Step 3: Implement panel and proposal cards**

Conversation history may be session-only initially; accepted proposal provenance is persisted with the resulting planning decision. Do not persist raw remote prompts by default.

- [ ] **Step 4: Wire adoption through `commitPlanningMutation`** and disable duplicate adoption while pending.
- [ ] **Step 5: Add no-generator degradation**: retrieval evidence and deterministic budget/source tools stay available with clear message that conversational generation is unavailable.
- [ ] **Step 6: Run tests/type/build**

```bash
bun test src/security/planningCopilot*.test.ts
bun run lint
bun run build
```
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/planning/copilot src/components/planning src/components/SettingsView.tsx src/types.ts src/utils.ts server.ts src/security
git commit -m "feat: add contextual UDA copilot"
```

### Task 6: Retire duplicate one-shot UDA AI behavior without breaking legacy UDA

**Files:** `src/components/UdaGanttView.tsx`, `server.ts`, regression tests.

- [ ] **Step 1: Add regression test** proving legacy UDA records still edit/save but the legacy one-shot generator is either routed through the governed copilot provider boundary or clearly deprecated/removed from the legacy screen.
- [ ] **Step 2: Run and confirm RED** on the duplicate ungoverned path.
- [ ] **Step 3: Remove the duplicate provider-specific implementation**; keep a single policy/provider boundary for planning generation.
- [ ] **Step 4: Run full security suite/type/build**.
- [ ] **Step 5: Commit**.

## Tranche exit gate

Browser qualification must prove: local retrieval grounded on Arena + synthetic private guide; local generative chat when configured; remote path denied without opt-in; no student-personal payload; grounded proposal with source chips; Adopt/Adapt/Ignore behavior; invalid proposal fail-closed; reserve/dependency validator blocking a bad adoption; no direct AI state write; legacy UDA save remains functional.
