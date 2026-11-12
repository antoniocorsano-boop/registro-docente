# AIC-06 Dynamic AI Budget Governor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a shared dynamic AI budget governor so routine remote Copilot work uses bounded low-cost capacity while materially more expensive work requires a clear, temporary teacher authorization.

**Architecture:** Keep the existing local-first Copilot, privacy classification, Core authorization and provider stack. Add one pure browser/server-safe budget policy, persist only the base profile through existing encrypted settings, keep escalation grants ephemeral, and enforce the same decision on the server immediately before the governed teaching-proposal runtime is invoked.

**Tech Stack:** React + TypeScript, Bun, existing Secure Local Vault settings persistence, existing `LibraryProposalRequestV1` and teaching-proposal runtime, existing Agent-First intent runtime, GitHub Actions PREDEPLOY, Playwright 1.64.1.

**Spec:** `docs/superpowers/specs/2026-10-27-aic-06-dynamic-ai-budget-governor-design.md`

## Global Constraints

- Baseline is `main@70cd8d560aeefec58293b12117a39ed1623ae122`.
- Privacy-first outranks budget optimization and generation quality.
- Student-personal and ambiguous unsafe content remain remote-denied before budget evaluation.
- Existing Core authorization and explicit remote consent remain mandatory.
- `balanced` is the fallback profile when old settings lack a valid profile.
- Base profile is persisted only through the existing encrypted `settings` record.
- Escalation grants are never persisted in Vault, localStorage, sessionStorage or backup.
- Activity escalation expires after 30 minutes and is bound to the exact UDA/optional lesson activity key.
- Teaching-proposal low tier is `1024` output tokens; expanded tier is bounded by the existing `2048` hard ceiling.
- Remote intent routing remains a low-cost control-plane path with its existing hard ceiling `<= 512`; AIC-06 does not turn intent routing into expanded generation.
- Existing absolute source-size limits remain authoritative after escalation.
- No new provider, remote memory service, AI-response database or autonomous persistent write.
- Every behavior/contract change follows causal RED -> GREEN.
- Final qualification freezes one exact candidate SHA and runs PREDEPLOY + Browser Qualification + fresh whole-slice review.
- No automatic merge, deploy or publication.

## Review Focus

1. **Forged/expired/mismatched activity authorization** — must never upgrade an expensive request; Task 1 and Task 2 pin this.
2. **Binary or large source reaches provider before teacher choice** — must return escalation-required with zero provider calls; Task 2 and Task 6 pin this.
3. **Source/UDA/lesson changes while an activity grant exists** — grant becomes unusable and UI clears stale escalation state; Task 3 and Task 6 pin this.
4. **Old settings/backup omit or contain an unknown profile** — application normalizes to `balanced` without destructive migration; Task 4 pins this.
5. **Budget logic weakens privacy or Core authority** — student-personal flow, remote consent and Core PREPARE gate remain earlier/stronger boundaries; Task 5 and Task 6 pin this.

---

## File structure

### New files

- `src/copilot/aiBudgetGovernor.ts` — pure budget profiles, thresholds, authorization validation, activity key and PREPARE decision.
- `src/copilot/aiBudgetGovernor.test.ts` — policy/expiry/profile/threshold tests.
- `src/security/aic06BudgetGovernorContract.test.ts` — static cross-boundary/privacy/runtime/settings contract.
- `tests/browser/aic-06-budget-governor.spec.cjs` — synthetic browser journeys for routine/escalated/profile/privacy behavior.

### Modified files

- `src/types.ts` — optional `aiBudgetProfile` setting.
- `src/library/teachingProposal.ts` — budget wire object and builder integration.
- `src/server/libraryProposalRoute.ts` — fail-closed budget validation and server-side decision before provider call.
- `src/server/teachingProposalRuntime.ts` — bounded per-call `maxOutputTokens` and optional budget receipt metadata.
- `src/services/libraryProposalErrors.ts` — stable escalation-required error code/reason support.
- `src/services/libraryProposalService.ts` — parse budget receipt/error metadata.
- `src/components/LibraryProposalPanel.tsx` — budget preflight, explanation and temporary choices.
- `src/components/LibraryCopilotComposer.tsx` — pass normalized budget profile into proposal panel.
- `src/components/SettingsView.tsx` — base profile selector with teacher-language copy.
- `src/App.tsx` — normalize/pass the profile through existing settings and Copilot props if required by current wiring.
- focused historical security/proposal tests — preserve LIB/AIC-01…AIC-05 boundaries.
- `.github/workflows/browser-qualification.yml` — include AIC-06 browser spec.

---

### Task 1: Define the shared pure budget policy

**Files:**
- Create: `src/copilot/aiBudgetGovernor.ts`
- Create: `src/copilot/aiBudgetGovernor.test.ts`
- Modify: `src/types.ts`

**Interfaces:**
- Produces `AiBudgetProfile = 'economy' | 'balanced' | 'quality'`.
- Produces `AiBudgetAuthorizationV1`, `PrepareBudgetInput`, `PrepareBudgetDecision` and `AiBudgetEscalationReason`.
- Produces `normalizeAiBudgetProfile(value): AiBudgetProfile`.
- Produces `buildAiBudgetActivityKey(udaId, lessonId?): string`.
- Produces `createAiBudgetAuthorization(input): AiBudgetAuthorizationV1`.
- Produces `isAiBudgetAuthorizationValid(input): boolean`.
- Produces `resolvePrepareBudget(input): PrepareBudgetDecision`.
- Produces `aiBudgetEscalationMessage(reason): string`.

- [ ] **Step 1: Write causal RED for profile normalization and routine thresholds**

Assert missing/unknown profile -> `balanced`, routine balanced text `<= 64 KiB` with `<= 3` memory summaries -> `allow/remote-low/1024`, and routine economy/quality thresholds use exactly `16 KiB/1` and `128 KiB/5`.

- [ ] **Step 2: Write RED for expensive conditions**

Assert any inline binary bytes -> `BINARY_SOURCE`; text above current-profile threshold -> `LARGE_SOURCE`; memory count above threshold with otherwise routine input -> `RICH_CONTEXT`.

- [ ] **Step 3: Write RED for authorization lifetime and binding**

Assert operation authorization is valid only for its exact activity key and immediate bounded lifetime; activity authorization expires no later than 30 minutes; malformed/future/overlong/other-activity authorization is invalid.

- [ ] **Step 4: Run RED**

Run: `bun test src/copilot/aiBudgetGovernor.test.ts`  
Expected: FAIL because the budget module does not exist.

- [ ] **Step 5: Implement minimum pure GREEN**

Do not read browser storage, Vault, provider APIs or source contents beyond supplied byte/count metadata. All date parsing must fail closed.

- [ ] **Step 6: Verify GREEN and commit**

```bash
bun test src/copilot/aiBudgetGovernor.test.ts
git add src/copilot/aiBudgetGovernor.ts src/copilot/aiBudgetGovernor.test.ts src/types.ts
git commit -m "feat: define dynamic AI budget policy"
```

### Task 2: Enforce budget at the remote proposal boundary

**Files:**
- Modify: `src/library/teachingProposal.ts`
- Modify: `src/server/libraryProposalRoute.ts`
- Modify: `src/server/teachingProposalRuntime.ts`
- Modify: focused route/runtime tests
- Create: `src/security/aic06BudgetGovernorContract.test.ts`

**Interfaces:**
- Consumes Task 1 budget types/resolver.
- Extends `LibraryProposalRequestV1` with required `budget.schemaVersion/profile/activityKey` plus optional authorization.
- Extends `TeachingProposalRuntime.generate()` options with optional bounded `maxOutputTokens`.
- Produces stable route error `AI_BUDGET_ESCALATION_REQUIRED` with `reason`.
- Produces optional receipt `budget: { tier, profile, escalated }`.

- [ ] **Step 1: Write route/runtime RED**

Add tests proving a balanced routine text request invokes the provider once with `maxOutputTokens: 1024`, while the same normalized request with binary data or over-threshold text returns HTTP 409 and invokes provider zero times.

- [ ] **Step 2: Write authorization RED**

Retry an expensive request with a valid operation/activity authorization and assert server recomputation selects `remote-expanded` with `maxOutputTokens: 2048`. Expired, overlong or wrong-activity authorization must still return escalation-required.

- [ ] **Step 3: Write hard-ceiling RED**

Directly call the runtime with a per-call value above config maximum and assert the provider sees at most the configured `2048`. Invalid/non-positive override falls back safely without increasing capacity.

- [ ] **Step 4: Run RED**

Run the focused route/runtime/AIC-06 contract tests.  
Expected: FAIL only on missing budget behavior.

- [ ] **Step 5: Implement request validation and server decision**

Validate budget keys/types before provider input construction. Derive byte counts from the already validated request and call `resolvePrepareBudget()` immediately before the runtime. Do not include student fields or source contents in a budget receipt.

- [ ] **Step 6: Implement bounded runtime override and receipt audit**

Per-call capacity can only reduce/use the existing hard maximum; it cannot raise it. Preserve existing timeout/abort/provider error behavior.

- [ ] **Step 7: Verify GREEN and commit**

```bash
bun test <focused AIC-06 route/runtime tests>
git add src/library src/server src/security
git commit -m "feat: enforce AI budget before proposal provider"
```

### Task 3: Add temporary escalation UX without persistent grants

**Files:**
- Modify: `src/services/libraryProposalErrors.ts`
- Modify: `src/services/libraryProposalService.ts`
- Modify: `src/components/LibraryProposalPanel.tsx`
- Modify: `src/components/LibraryCopilotComposer.tsx`
- Modify: focused proposal UI/service tests

**Interfaces:**
- Consumes Task 1 resolver/authorization helpers.
- Service error exposes optional `budgetReason` for `AI_BUDGET_ESCALATION_REQUIRED`.
- Proposal panel consumes `aiBudgetProfile: AiBudgetProfile`.
- Panel stores operation/activity authorization only in React state/ref.

- [ ] **Step 1: Write service RED**

Assert 409 escalation envelopes map to a stable service error while preserving the semantic reason; unknown reasons fail closed to the generic budget explanation.

- [ ] **Step 2: Write UI RED for routine path**

Static/component contract must show routine PREPARE retains existing remote consent and proceeds without an escalation panel.

- [ ] **Step 3: Write UI RED for expensive path**

Assert the teacher sees a non-technical reason plus exactly `Autorizza solo questa operazione` and `Autorizza per questa attività`; no token counts/provider tuning in that panel.

- [ ] **Step 4: Write stale-grant RED**

Pin source/privacy/UDA/lesson changes so pending escalation state and mismatched activity grants are cleared/ignored. Assert no `localStorage`/`sessionStorage` persistence for grant state.

- [ ] **Step 5: Run RED**

Run focused service/UI contracts.  
Expected: FAIL on missing AIC-06 UX.

- [ ] **Step 6: Implement minimal GREEN**

Perform client preflight after remote consent/Core PREPARE resolution. For an expensive request, do not call the proposal service until a choice is made. Operation authorization is cleared after the attempt; activity authorization remains only while valid for the same activity key and time.

- [ ] **Step 7: Verify GREEN and commit**

```bash
bun test <focused service/UI tests>
git add src/services src/components
git commit -m "feat: add teacher controlled AI escalation"
```

### Task 4: Persist only the base profile through existing settings

**Files:**
- Modify: `src/types.ts` if not completed in Task 1
- Modify: `src/components/SettingsView.tsx`
- Modify: `src/App.tsx` only as required by current settings normalization/wiring
- Modify: settings/security/backup compatibility tests
- Modify: `src/security/aic06BudgetGovernorContract.test.ts`

**Interfaces:**
- Consumes `AiBudgetProfile` and `normalizeAiBudgetProfile()`.
- Uses existing `onUpdateSettings(patch: Partial<AppSettings>): Promise<void>`; no new persistence API.
- Produces `settings.aiBudgetProfile?: AiBudgetProfile`, normalized to `balanced` at read/render/use boundaries.

- [ ] **Step 1: Write compatibility RED**

Assert old settings with no profile behave as `balanced`; an invalid runtime value also normalizes to `balanced`; current backup round-trip requires no backup version bump.

- [ ] **Step 2: Write Settings UX RED**

Assert three teacher labels — `Risparmio`, `Bilanciato`, `Qualità` — and explanatory copy. Saving uses `onUpdateSettings({ aiBudgetProfile: ... })` and no new storage path.

- [ ] **Step 3: Write non-persistence RED for grants**

Search/contract assert `AiBudgetAuthorizationV1`, `issuedAt`, `expiresAt` or grant objects are not written through `SecureAppStorage`, backup payload, localStorage or sessionStorage.

- [ ] **Step 4: Run RED and implement GREEN**

Use the existing encrypted settings mutation only. Do not add a Vault key or backup data version.

- [ ] **Step 5: Verify and commit**

```bash
bun test <focused settings/security/backup tests>
git add src/types.ts src/components/SettingsView.tsx src/App.tsx src/security
git commit -m "feat: make AI budget profile configurable"
```

### Task 5: Preserve privacy, Core authority and historical low-cost intent routing

**Files:**
- Modify: `src/security/aic06BudgetGovernorContract.test.ts`
- Modify: focused historical AIC/LIB tests only if contract fixtures require the new budget field
- Avoid production changes unless a causal regression is demonstrated

**Interfaces:**
- Consumes completed AIC-06 flow.
- Produces regression evidence, not a new capability.

- [ ] **Step 1: Add privacy-ordering tests**

Assert student-personal and unknown/ambiguous source flows cannot reach the budget escalation UI or proposal provider. Budget profile/authorization must not appear in remote intent projection or professional-memory summaries.

- [ ] **Step 2: Add authority-ordering tests**

Assert remote consent and Core PREPARE action are required before budget preflight can cause a provider request. Budget authorization alone cannot create proposal/adoption/persistent writes.

- [ ] **Step 3: Pin intent budget**

Run existing agent-intent runtime/latency contracts and assert `maxOutputTokens <= 512` remains unchanged; no expanded tier is introduced in the intent provider path.

- [ ] **Step 4: Run focused historical regression suites**

Include AIC-01 context/privacy, AIC-02 PREPARE/adoption, AIC-03 REVIEW, AIC-04 cross-surface, AIC-05 memory projection and Library provider/runtime contracts.

- [ ] **Step 5: Commit only if tests/fixtures changed**

```bash
git add src/security
 git commit -m "test: pin AIC-06 authority and privacy boundaries"
```

### Task 6: Browser qualification and final exact-SHA evidence

**Files:**
- Create: `tests/browser/aic-06-budget-governor.spec.cjs`
- Modify: `.github/workflows/browser-qualification.yml`
- Modify: docs/memory only if a reusable lesson is actually discovered

**Interfaces:**
- Browser test intercepts the proposal endpoint deterministically and records whether the provider path was attempted; no provider secret is required for canonical engineering qualification.

- [ ] **Step 1: Write browser RED**

Add synthetic journeys for:

1. desktop routine text -> remote consent -> PREPARE -> no budget prompt -> low-tier request;
2. desktop binary/large source -> budget prompt before provider -> one-operation authorization -> one expanded request -> authorization not reused;
3. desktop activity authorization -> multiple expensive requests allowed only for same UDA/lesson within lifetime -> context switch invalidates it;
4. settings profile change -> survives application settings persistence/reload while temporary authorization does not;
5. student-personal source -> no remote consent/budget/provider path;
6. mobile `390x844` -> escalation disclosure/buttons remain visible, usable and stale state clears after context/source change.

- [ ] **Step 2: Add spec to canonical browser workflow**

Keep exact-SHA checkout, production build/server, final pageerror assertion, screenshots/evidence JSON and artifact upload semantics unchanged.

- [ ] **Step 3: Obtain browser GREEN on current branch head**

Expected: AIC-06 journeys PASS plus existing browser suite PASS.

- [ ] **Step 4: Freeze exact candidate SHA**

After all fixes/reviews, declare one immutable candidate. Do not amend behavior after this point without creating a new candidate and re-running required gates.

- [ ] **Step 5: Run PREDEPLOY on exact candidate**

Required: frozen install, typecheck, security/memory suites, Library suites, build and production startup smoke PASS.

- [ ] **Step 6: Run canonical Browser Qualification on exact candidate**

Required: exact checkout verified, desktop/mobile AIC-06 PASS, historical journeys PASS, UX-QA-01 PASS, UX-QA-02 PASS and evidence artifact uploaded.

- [ ] **Step 7: Request fresh whole-slice independent review**

Review the complete AIC-06 diff against this spec and the exact candidate. Resolve every Important/Critical finding with causal RED -> GREEN and then re-freeze/re-run gates.

- [ ] **Step 8: Update PR receipt and stop at human integration decision**

Record baseline, exact candidate, PREDEPLOY, browser artifact/digest, review outcome and unresolved-thread count. Do not merge or deploy.

---

## Self-review

- Spec coverage: profile, low/expanded tier, thresholds, binary escalation, one-operation/activity grants, 30-minute expiry, explainability, server enforcement, runtime ceiling, settings persistence, privacy/Core ordering, intent low-cost preservation and exact-SHA qualification are all assigned.
- Step scan: each task has a causal test, verification command/expected result, minimum implementation target and commit boundary.
- Type consistency: profile/authorization/decision names are defined in Task 1 and consumed unchanged in Tasks 2–6.
- Review focus: all five high-risk conditions have explicit owner tests.
- Proportion: the plan specifies interfaces and evidence without transcribing production function bodies.

**Execution mode:** Native execution is already selected for this program continuation. Implementation starts from `main@70cd8d560aeefec58293b12117a39ed1623ae122`, not from the docs branch; the docs branch is evidence/specification only.
