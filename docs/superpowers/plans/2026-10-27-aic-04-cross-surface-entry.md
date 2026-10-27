# AIC-04 Cross-surface Copilot Entry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the teacher submit a Copilot objective from the current professional surface without first selecting or navigating through a Library source, while preserving source-gated actions and existing privacy/Core authority.

**Architecture:** Keep one global `LibraryCopilotComposer`. Make agent routing source-optional and return a non-executable `SOURCE_REQUIRED` handoff for current source-dependent intents; the Composer accepts source-less messages, uses the existing minimized context projection, and asks for source selection/acquisition only after interpretation shows it is required.

**Tech Stack:** React 19 + TypeScript, Bun tests, existing `@trama/contextual-copilot-core`, existing agent-first routing service, Secure Local Vault boundaries, GitHub Actions PREDEPLOY and Playwright 1.64.1 Browser Qualification.

**Spec:** `docs/superpowers/specs/2026-10-27-aic-04-cross-surface-entry-design.md`

## Global Constraints

- Baseline is exactly `main@5eabbee84c4c7c7fe350d2fee5ef737084d3cf70`.
- One global Composer; no per-surface Copilot duplication.
- Agent interpretation never authorizes or persists.
- `REVIEW`, `LINK`, `PREPARE` require a professional source before Core-backed action/handoff.
- Missing source yields `SOURCE_REQUIRED`, not implicit action and not generic Core denial.
- Remote routing schema remains `registro.agent-routing-request/v1` and its context remains minimized.
- No student-personal data, source payload, source identifier, UDA identifier or class name is added to remote routing metadata.
- No provider/model/retry/persistence-schema change.
- Source selection after `SOURCE_REQUIRED` does not auto-replay a remote request.
- Every behavior change follows causal RED → GREEN.
- No automatic merge, deploy or publication.

## Review Focus

1. **Source-less request from student-bearing surface** — must transmit only the existing minimized projection and teacher-authored message; no grade/student/behavior payload.
2. **Source added after `SOURCE_REQUIRED`** — must invalidate the prior resolution and require explicit re-submit, never auto-run the prior intent.
3. **Provider unavailable on source-less entry** — must fail closed with guidance, not pretend local source-based intent discovery succeeded.
4. **Context changes while source-less agent request is pending** — stale response must be discarded under the existing resolution epoch/snapshot contract.
5. **Historical source-selected flows** — REVIEW/LINK/PREPARE and AIC-03 contextual review must remain behaviorally unchanged.

---

### Task 1: Add source-required routing outcome

**Files:**
- Modify: `src/library/agentIntentRouting.ts`
- Modify: `src/library/agentIntentRouting.test.ts`

**Interfaces:**
- Consumes: existing `IntentEnvelopeV1`, `LibrarySource`, `ResolvedLibraryTeachingContext`.
- Produces: `AgentIntentRoutingResult` variant `{ kind: 'SOURCE_REQUIRED'; envelope: IntentEnvelopeV1 }`; `RouteAgentIntentInput.source: LibrarySource | null`.

- [ ] **Step 1: Write failing routing tests**

Add tests proving:
- `REVIEW`, `LINK`, `PREPARE` with `source: null` each return `SOURCE_REQUIRED`;
- `resolveActions` is called zero times when source is missing;
- clarification/context-binding precedence still wins before source requirement when the envelope itself requires clarification.

- [ ] **Step 2: Run focused test and verify causal RED**

Run: `bun test src/library/agentIntentRouting.test.ts`

Expected: FAIL because `source: null` is not accepted and/or `SOURCE_REQUIRED` does not exist.

- [ ] **Step 3: Implement minimal source-optional routing**

Change `RouteAgentIntentInput.source` to `LibrarySource | null`; after clarification/context-binding checks and before PREPARE/Core action resolution, return `SOURCE_REQUIRED` for source-dependent intents when `source` is null.

- [ ] **Step 4: Verify focused GREEN**

Run: `bun test src/library/agentIntentRouting.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `feat: add source-required Copilot routing outcome`

### Task 2: Make the global Composer goal-first

**Files:**
- Modify: `src/components/LibraryCopilotComposer.tsx`
- Create: `src/security/aic04CrossSurfaceEntryContract.test.ts`

**Interfaces:**
- Consumes: `routeAgentIntent(... source: LibrarySource | null ...)` from Task 1; existing `CopilotContextProjectionV1` and agent routing wire builder.
- Produces: source-less submit path with explicit `SOURCE_REQUIRED` guidance and unchanged source-selected behavior.

- [ ] **Step 1: Write failing product/security contract**

Assert that the Composer:
- no longer exits `handleResolve` merely because `selectedSource` is absent;
- no longer disables submit merely because `selectedSource` is absent;
- calls `routeAgentIntent` with `source: selectedSource ?? null`;
- contains explicit handling for `routed.kind === 'SOURCE_REQUIRED'`;
- does not invoke `discoverLibraryCopilotIntent` when `selectedSource` is absent;
- keeps `buildAgentRoutingRequestFromProjection(message.trim(), copilotContextProjection)` as the remote request source.

Also assert App still maps priority surfaces into ambient professional context and does not add student/grade/behavior data.

- [ ] **Step 2: Run security test and verify causal RED**

Run: `bun test src/security/aic04CrossSurfaceEntryContract.test.ts`

Expected: FAIL on the historical source-required submit guard and missing `SOURCE_REQUIRED` branch.

- [ ] **Step 3: Implement minimal Composer behavior**

Update `handleResolve` so only empty message/resolving blocks submission. The agent-first path runs with or without a source. On `SOURCE_REQUIRED`, clear executable resolution and show concise guidance to choose or add a source in the current Composer. If agent routing fails while no source is selected, fail closed with source-selection/retry guidance and do not run source-based local discovery. When source is selected, preserve the historical local fallback unchanged.

Change the submit disabled condition to `!message.trim() || isResolving`.

- [ ] **Step 4: Verify focused GREEN**

Run: `bun test src/security/aic04CrossSurfaceEntryContract.test.ts src/library/agentIntentRouting.test.ts`

Expected: PASS.

- [ ] **Step 5: Run full local suites**

Run:
- `bun run test:security`
- `bun run test:library`
- `bun run lint`
- `bun run build`

Expected: all PASS.

- [ ] **Step 6: Commit**

Commit message: `feat: enable goal-first Copilot entry across surfaces`

### Task 3: Add exact-SHA browser qualification for source-less entry

**Files:**
- Create: `tests/browser/aic-04-cross-surface-entry.spec.cjs`
- Modify: `.github/workflows/browser-qualification.yml` only as required to include the new spec/evidence without weakening existing gates.

**Interfaces:**
- Consumes: goal-first Composer behavior from Task 2 and the existing synthetic browser fixture/harness.
- Produces: desktop/mobile evidence for source-less cross-surface entry and privacy/staleness assertions.

- [ ] **Step 1: Add browser test first**

Cover synthetic journeys:
- class dashboard → open Copilot → no source → submit a source-dependent objective → intercepted routing request has `hasSelectedSource=false` and no student/grade/behavior payload → UI asks for source in-place;
- planning/online-tests/evaluation-related surface preserves its ambient surface semantics while source-less;
- selecting a source after `SOURCE_REQUIRED` does not automatically resend the previous request;
- mobile 390×844 remains usable;
- navigation/context change while response is delayed does not surface stale guidance/action.

- [ ] **Step 2: Establish causal browser RED against the predecessor if the repository's current workflow supports the existing test-only RED pattern**

Expected: old product cannot submit without a source, so the new journey fails at the submit/remote-request step. Preserve this evidence without merging a test-only branch.

- [ ] **Step 3: Run Browser Qualification on the implementation exact SHA**

Expected: all browser tests PASS; UX-QA-01 and UX-QA-02 remain PASS with 0 findings; evidence artifact is produced.

- [ ] **Step 4: Freeze exact candidate and run PREDEPLOY on the same SHA**

Expected: typecheck, security, Library, build and production startup smoke PASS.

- [ ] **Step 5: Commit browser gate changes**

Commit message: `test: qualify AIC-04 cross-surface entry`

### Task 4: Whole-slice review and qualification receipt

**Files:**
- Update only PR body / review evidence unless a real finding requires code changes.
- Update `docs/memory/LESSONS_LEARNED.md` only if the cycle produces reusable knowledge under OR-008.

**Interfaces:**
- Consumes: exact candidate from Tasks 1–3.
- Produces: review-complete AIC-04 candidate ready for human integration decision.

- [ ] **Step 1: Request fresh whole-slice review on exact candidate**

Review against the spec, plan and Review Focus. No reuse of a review from an earlier SHA.

- [ ] **Step 2: Resolve Critical/Important findings causally**

Each fix requires a new failing regression test before product change, then full requalification on the new exact SHA.

- [ ] **Step 3: Freeze final exact candidate**

Record PREDEPLOY, Browser Qualification, artifact/digest, review status and unresolved finding count.

- [ ] **Step 4: Stop at human integration decision**

Do not merge, deploy or publish.

## Self-review

- Spec coverage: source-less entry, structured source handoff, privacy boundary, no replay, existing source-selected flow, priority surfaces and no merge/deploy are all assigned to tasks.
- Type consistency: Task 2 consumes exactly the `SOURCE_REQUIRED` result and nullable source interface created in Task 1.
- Review Focus: all five failure classes are assigned to Task 2/3 browser or security coverage.
- Proportion: no new capability/persistence/provider work is included; the slice remains an entry/orchestration change only.
