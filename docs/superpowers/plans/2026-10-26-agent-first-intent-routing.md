# AGENT-INTENT-01 — Agent-first Intent Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the conversational agent the primary interpreter of teacher free text, while keeping Contextual Copilot Core, SEC boundaries, human confirmation, one-shot consent and persistence as the exclusive authority/execution layers.

**Architecture:** Add a small server-side structured intent interpreter using the existing Gemini server configuration principles, with a minimized metadata-only routing context and no source/document payload. The interpreter returns `IntentEnvelopeV1`; a local parser allowlists it; an orchestration adapter maps only supported intents to existing Registro capabilities; Core re-validates the exact candidate action before REVIEW/LINK proceeds, while PREPARE continues through the existing `LibraryProposalPanel` and its remote disclosure/consent boundary. The current local IntentPort remains as fail-closed fallback and regression control.

**Tech Stack:** React 19, TypeScript, Bun test, Express, `@google/genai`, vendored `@trama/contextual-copilot-core@0.3.0`, Playwright 1.64.1 / Chromium, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-26-agent-first-intent-routing-design.md`

## Global Constraints

- Frozen baseline: `main@0ebda92248b9bb984f2e3e201661292daa47e96d`.
- The real production finding — `Preparazione Attività per fare comprendere il funzionamento della centrale elettrica` — is a mandatory regression case.
- Agent interpretation is **not authority**: it cannot authorize, dispatch, persist, select an ambiguous UDA/source, or bypass Core/SEC/human gates.
- Routing payload contains only the teacher-authored message plus minimized context metadata; never source text, extracted text, attachments, UDA body, student names, grades or observations.
- Submitting the Copilot message is the explicit request-scoped act authorizing remote interpretation of that message only. It does not authorize transfer of source/attachment/UDA content.
- No second user-visible chatbot, no second provider, no new secret, no automatic retry/fallback provider.
- Use the existing server-side Gemini model/configuration family; intent interpretation gets a separate small structured endpoint and strict output budget.
- Local IntentPort remains present and qualified as fallback. Do not lower `minSimilarity=0.55` merely to fix the real finding.
- LINK remains Core-authorized and explicitly human-confirmed before durable write.
- PREPARE opening never sends the source remotely; the existing provider disclosure + one-shot consent remains required before proposal generation.
- No Vault migration or new durable storage.
- No merge, deploy or publication without a separate human decision.
- Apply OR-001..OR-009 and TR-001..TR-003.

## Review Focus

1. **Authority bypass:** an agent envelope must never become executable without Core verification.
2. **Privacy leakage:** intent route must never receive source payload, student data or full UDA content.
3. **Semantic regression:** the exact user phrase must reach PREPARE even though the legacy local classifier currently abstains.
4. **Ambiguity:** mixed/low-confidence requests must CLARIFY rather than choose arbitrarily.
5. **Failure fallback:** unavailable/malformed remote interpreter may fall back locally, but fallback must remain fail-closed.
6. **Stale response:** source/context/message mutation while the agent call is pending must invalidate the response.
7. **Existing gates:** LINK confirmation and PREPARE disclosure/consent must remain unchanged.

---

### Task 1: Freeze the agent-routing contracts and real RED

**Files:**
- Create: `src/library/agentIntent.ts`
- Create: `src/library/agentIntent.test.ts`
- Create: `src/library/fixtures/agentIntentReferenceCorpus.ts`
- Create: `src/security/agentIntent01Contract.test.ts`

**Interfaces:**
- Produces `AgentIntentId`, `IntentEnvelopeV1`, `AgentRoutingRequestV1`, strict parsers/builders.
- Produces a realistic, separate agent-intent reference corpus.

- [ ] **Step 1: Write the contract tests first**

Require:
- schema exactly `registro.agent-intent/v1`;
- allowlisted intent IDs only;
- `goal`, context target, confidence and clarification invariants;
- low confidence or `needsClarification=true` cannot be promoted to an executable candidate;
- malformed/extra authority-bearing fields fail closed;
- request payload contains only `message`, `surface`, `hasCurrentClass`, `hasCurrentUda`, `hasSelectedSource`, plus explicit request-scoped routing consent; no source/title/text/attachment/student fields.

- [ ] **Step 2: Freeze the real finding in the corpus**

Include at minimum:
- exact real phrase -> `PREPARE`;
- nominal, verbal, indirect, elliptical and plausible dictation/noisy PREPARE variants;
- REVIEW/LINK natural variants;
- ambiguous mixed cases -> `CLARIFY`;
- unsupported adjacent teacher requests -> `UNSUPPORTED`.

Do not alter the existing 68-case local fallback corpus.

- [ ] **Step 3: Run causal RED**

```bash
bun test src/library/agentIntent.test.ts src/security/agentIntent01Contract.test.ts
```

Expected: FAIL because the agent-routing contract does not yet exist.

- [ ] **Step 4: Implement only the pure contract/parser layer**

No network/provider/UI work yet.

- [ ] **Step 5: Re-run focused tests**

Expected: contract/parser tests GREEN; integration contract assertions for route/UI remain RED until later tasks.

---

### Task 2: Add the governed structured intent interpreter server boundary

**Files:**
- Create: `src/server/agentIntentProvider.ts`
- Create: `src/server/geminiAgentIntentProvider.ts`
- Create: `src/server/agentIntentRuntime.ts`
- Create: `src/server/agentIntentRoute.ts`
- Create: server/unit tests under `src/security/` or `src/server/` following repository conventions
- Modify: `server.ts`

**Interfaces:**
- POST `/api/copilot/intent`
- Input: `AgentRoutingRequestV1` only.
- Output: validated `IntentEnvelopeV1` or stable error envelope.

- [ ] **Step 1: Write server RED tests**

Cover:
- exact request allowlist and small body budget;
- missing explicit routing submission/consent -> denied;
- source payload / unknown extra fields -> denied;
- provider receives only minimized routing request;
- structured schema enforced;
- malformed provider output -> stable fail-closed error;
- timeout/rate-limit/unavailable normalized;
- one provider attempt only, no retry;
- no raw vendor error returned.

- [ ] **Step 2: Run RED**

Expected: only new AGENT-INTENT server tests fail.

- [ ] **Step 3: Implement provider-neutral runtime and Gemini adapter**

Use the existing `GEMINI_API_KEY` server secret and same model family (`gemini-3.8-flash`). Require:
- candidate count 1;
- native JSON schema structured output;
- no tools/search/URL context;
- LOW thinking, no thoughts;
- small output budget (target <=512 tokens);
- finite server deadline (target 10s, configurable only within a safe bounded interval if needed);
- no automatic retry/fallback;
- no content logging.

System instruction: interpret the teacher request into the allowlisted envelope only; never claim authority or execution.

- [ ] **Step 4: Wire singleton route in `server.ts`**

Do not modify the existing teaching-proposal runtime or its consent semantics.

- [ ] **Step 5: Run focused + full server/security tests and typecheck**

```bash
bun test src/security/*.test.ts
bun run lint
```

Expected: new server boundary GREEN; historical security suite GREEN.

---

### Task 3: Add client service, fallback orchestration and Core verification

**Files:**
- Create: `src/services/agentIntentService.ts`
- Create: `src/library/agentIntentRouting.ts`
- Create: `src/library/agentIntentRouting.test.ts`
- Modify: `src/library/contextualCoreAdapter.ts`
- Extend: `src/security/agentIntent01Contract.test.ts`

**Interfaces:**
- `interpretCopilotIntent(request, signal?)`
- `routeAgentIntent(...)`
- narrow Core-verification helper for a specific agent-proposed action.

- [ ] **Step 1: Write routing RED tests**

Require:
- `REVIEW -> review-source`, `LINK -> link-source-to-uda`, `PREPARE -> prepare-from-source`;
- `CLARIFY` / low confidence -> no candidate action;
- understood-but-unimplemented intents -> no action;
- remote interpreter failure -> existing local `discoverLibraryCopilotIntent()` fallback;
- malformed remote output -> fail closed/fallback, never direct dispatch;
- Core denial wins over high-confidence agent output.

- [ ] **Step 2: Add a Core verification path that does not re-run legacy intent discovery**

Important: after the agent has proposed REVIEW/LINK, do **not** call `resolveLibraryCopilotRequest()` as the authority gate because it re-enters the local IntentPort and can recreate the bug. Instead:
- resolve the actions from the current ContextSnapshot through the Core;
- select only the exact mapped candidate action if it is present;
- preserve its policy/human-confirmation metadata;
- no new capability may be synthesized.

PREPARE remains special: agent recognition may open the existing proposal disclosure only when Teaching Context/UDA are valid; actual remote PREPARE authority remains in the existing governed proposal flow after one-shot consent.

- [ ] **Step 3: Implement client service and orchestration**

Remote first. Local fallback only on interpreter transport/unavailable/invalid-output failure, not as a competing primary vote.

- [ ] **Step 4: Run unit + security tests**

```bash
bun test src/library/agentIntent*.test.ts src/security/agentIntent01Contract.test.ts
bun run test:library
bun run test:security
```

Expected: GREEN with existing local corpus unchanged.

---

### Task 4: Switch the Copilot Composer to agent-first routing

**Files:**
- Modify: `src/components/LibraryCopilotComposer.tsx`
- Modify focused component/security tests as needed.

**Interfaces:**
- Consumes `interpretCopilotIntent()` + orchestration from Task 3.
- Preserves existing source/context epoch and exact-snapshot stale-response guards.

- [ ] **Step 1: Add RED assertions for agent-first ownership**

Require Composer to:
- call the agent interpreter before local fallback;
- never send source payload in the intent request;
- ignore stale agent responses after message/source/context change;
- show human-readable clarification for `CLARIFY`;
- show unsupported state without executable actions;
- open PREPARE for the exact real phrase when agent returns valid PREPARE envelope;
- preserve LINK explicit confirmation.

- [ ] **Step 2: Implement minimal Composer change**

Keep the existing visual surface and `Mostra le possibilità` button in this engineering slice unless a change is necessary for truthful status copy. Avoid opportunistic redesign.

- [ ] **Step 3: Preserve fallback semantics**

If agent route is unavailable/malformed:
- invoke legacy local intent discovery;
- if local discovery also abstains, show a neutral retry/clarification state;
- do not expose provider/vendor details.

- [ ] **Step 4: Run focused + complete local suites**

```bash
bun run lint
bun run test:security
bun run test:library
bun run build
```

Expected: all GREEN.

---

### Task 5: Add permanent browser qualification for the real phrase and governance boundaries

**Files:**
- Create: `tests/browser/agent-intent-01-routing.spec.cjs`
- Modify: `.github/workflows/browser-qualification.yml`

**Interfaces:**
- Browser test intercepts `/api/copilot/intent` deterministically; no secret required for canonical engineering qualification.

- [ ] **Step 1: Write browser RED before product wiring is complete**

Desktop 1280x900 and mobile 390x844 must cover:
1. exact real phrase -> mocked structured PREPARE envelope -> PREPARE disclosure visible;
2. routing POST body contains message + minimized booleans/context only; source payload/title/extracted text/student data absent;
3. zero teaching-proposal generation POST before existing disclosure/consent action;
4. LINK envelope -> Core-authorized action -> no durable write before explicit confirmation;
5. CLARIFY envelope -> clarification copy, zero action/dispatch;
6. unsupported envelope -> zero executable action;
7. malformed/503 interpreter -> local fallback remains fail-closed;
8. pending agent response invalidated by message/source/context change;
9. zero pageerror/unexpected console error;
10. no permanent horizontal overflow; touch targets remain usable on 390x844.

- [ ] **Step 2: Add spec to permanent Browser Qualification**

Use exact candidate checkout already enforced by the workflow.

- [ ] **Step 3: Run the browser gate on the PR exact head**

Expected: new scenarios plus all historical browser specs GREEN; UX-QA-01/02 remain 0 blocking findings.

---

### Task 6: Add deterministic evaluation gates without pretending CI tested live model quality

**Files:**
- Create: `src/library/agentIntentEvaluation.ts`
- Create: `src/library/agentIntentEvaluation.test.ts`
- Use: `src/library/fixtures/agentIntentReferenceCorpus.ts`

**Interfaces:**
- Evaluation operates over interpreter outputs supplied by fixtures/stubs; it verifies routing semantics and safety invariants deterministically.

- [ ] **Step 1: Implement metrics**

Measure at least:
- canonical accuracy;
- paraphrase/noisy/elliptical recall;
- correct clarification rate on ambiguous cases;
- false-action rate on unsupported cases;
- Core-denial preservation;
- privacy payload violations;
- durable-write-without-confirmation violations.

- [ ] **Step 2: Freeze acceptance thresholds only after the RED baseline is recorded**

Safety invariants are fixed immediately:
- Core-denial preservation = 100%;
- privacy payload violations = 0;
- durable write without required confirmation = 0;
- false executable action on `CLARIFY`/`UNSUPPORTED` = 0.

Semantic quality thresholds must be documented from the first evaluated corpus rather than invented to manufacture GREEN.

- [ ] **Step 3: Keep live-provider semantic validation separate**

CI may prove contracts/orchestration with deterministic provider stubs. It must **not** claim that Gemini understood the real phrase in production until a later authorized deployed/live check actually invokes the configured agent route.

---

### Task 7: Exact-SHA qualification, review and decision boundary

**Files:**
- Update/create qualification receipt only after all engineering gates pass.
- Update `docs/memory/DECISIONS.md` / `LESSONS_LEARNED.md` only if the architectural decision or reusable finding warrants it.

- [ ] **Step 1: Freeze exact candidate SHA**

No further product changes after qualification begins.

- [ ] **Step 2: Run PREDEPLOY on exact candidate**

Require frozen install, typecheck, security, library, build and production startup smoke.

- [ ] **Step 3: Run Browser Qualification on exact candidate**

Require all Chromium tests including AGENT-INTENT-01, desktop/mobile evidence and UX-QA analyzers.

- [ ] **Step 4: Whole-branch review**

Focus on authority bypass, privacy payload, stale-response races, fallback safety, Core confirmation preservation, no unintended provider expansion.

- [ ] **Step 5: Stop at engineering-qualified state**

Expected terminal state before human integration decision:

`AGENT-INTENT-01 ENGINEERING QUALIFIED / EXACT-SHA VERIFIED / HUMAN INTEGRATION DECISION PENDING`

No merge, deploy or publish in this plan without a separate explicit human decision.

## Parallel-work boundary

Open ROADMAP-01 / PR #62 is docs-only on the same `main@0ebda922...` baseline and currently touches different documentation paths. AGENT-INTENT-01 must not modify its files or assume its merge. Before any eventual integration, refresh `main`, compare changed-file sets and re-evaluate conflicts explicitly.