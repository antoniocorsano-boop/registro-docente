# AI Teacher Copilot v1 Delivery Program

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this program slice-by-slice. Every implementation slice gets its own detailed plan before product code is touched.

**Goal:** Transform the existing governed contextual Copilot into the privacy-first intelligent layer of `registro-docente`, able to understand teacher goals, orchestrate existing product capabilities, generate governed proposals, remember professional work, and proactively assist without autonomous persistent writes or student-personal remote data.

**Architecture:** Preserve the current Agent-First interpreter + Contextual Copilot Core authority + durable persistence boundaries. Build incrementally through independently reviewable vertical slices, starting with live reliability and a unified privacy-safe context projection, then closing operational loops before adding memory, proactivity, budget escalation and new generative capabilities.

**Tech Stack:** React + TypeScript, Bun, existing `@trama/contextual-copilot-core`, existing local IntentPort/embedding adapter, Google Gemini provider runtime already integrated, Secure Vault / IndexedDB persistence, GitHub Actions exact-SHA qualification, Playwright 1.64.1 browser gate.

**Spec:** `docs/superpowers/specs/2026-10-26-ai-teacher-copilot-v1-design.md`  
**Approval:** `docs/superpowers/specs/2026-10-26-ai-teacher-copilot-v1-approval.md`

## Global Constraints

- Privacy-first outranks autonomy, convenience, latency and generative quality.
- No remote model receives data referable to a single student, including pseudonymized individual data.
- Remote-bound context is minimized before crossing the server/provider boundary.
- `STUDENT_PERSONAL` and ambiguous unsafe data fail closed.
- Agent interpretation does not authorize or persist.
- Persistent writes require explicit teacher decision.
- Existing Core authority and Durable Mutation contracts are not bypassed.
- Generated outputs begin as ephemeral/reviewable proposals.
- Proactivity is local-first/event-driven; no continuous generative polling.
- Token/cost strategy is minimum-sufficient capability first; escalation is explicit when thresholds are exceeded.
- No automatic merge, deploy or publication after technical qualification.
- Every behavior/contract change follows causal RED → GREEN.
- Every qualification declares and verifies the exact candidate SHA.
- Automatic/browser qualification uses synthetic data only.
- Canonical browser certification remains GitHub-hosted Playwright on the exact candidate.

## Review Focus

1. **Student-personal leakage from student-facing/assessment surfaces** — opening Copilot from evaluations, reports or other student-bearing views must never serialize names, grades, behavior, identifiers or per-student aggregates into remote-bound context.
2. **Stale context after navigation** — an async intent/proposal started on one class/UDA/source must not authorize or render an action against a later context.
3. **Implicit persistence from generated work** — adopting/generated content must never mutate Library/UDA/tests/memory without a visible teacher decision and truthful durable completion.
4. **Proactivity becoming background token consumption** — merely viewing a page must not create repeated remote calls; local triggers must precede any governed escalation.
5. **Memory becoming a second source of truth** — professional memory may summarize/retrieve canonical work but must not silently overwrite or diverge from UDA, Library, planning or assessment records.

---

## Program sequencing

### AIC-00 — Live reliability closure

**Purpose:** establish a trustworthy production baseline before expanding the AI surface.

**No-code first gate:** publish the already integrated AGENT-INTENT-02 diagnostics after GitHub → AI Studio sync, retest the canonical real teacher phrase, and read the safe fallback classification.

**Pass condition:** the live app either returns the expected governed semantic route, or produces a safe diagnostic code that leads to one narrow causal remediation. Do not begin capability expansion while the same canonical phrase can still fall into an unclassified remote/local fallback.

**If remediation is required:** create a separate narrow PR, obtain causal RED → GREEN, PREDEPLOY, Browser Qualification, independent review, human merge decision, GitHub → AI Studio sync, publish and live recheck.

**Exit state:** `LIVE INTENT ROUTING CLASSIFIED / NO UNEXPLAINED FALLBACK`.

### AIC-01 — Unified privacy-safe context projection

**Purpose:** create the cross-surface context spine for one Copilot without adding new capabilities.

**Deliverables:**
- one local `CopilotContextProjectionV1` representing surface + professional context;
- a separate minimized remote routing projection;
- explicit surface support for home, class dashboard, Library, UDA/lesson, planning, online tests and evaluation-related teacher surfaces;
- no individual student fields in the remote projection;
- current REVIEW/LINK/PREPARE behavior preserved;
- browser evidence that context changes invalidate stale async results.

**Detailed plan:** `docs/superpowers/plans/2026-10-26-aic-01-unified-context-projection.md`.

**Exit state:** `ONE COPILOT / MULTI-SURFACE CONTEXT / PRIVACY CONTRACT QUALIFIED`.

### AIC-02 — Close the PREPARE outcome loop

**Purpose:** remove manual copy/paste between generated teaching proposal, Library and UDA.

**Design work required before implementation:** specify a compound durable mutation for multi-domain adoption when the teacher chooses `Adotta e aggiungi all'UDA`.

**Teacher choices:**
- `Adotta in Biblioteca`;
- `Adotta e aggiungi all'UDA`;
- `Lascia`.

No default-checked hidden write. No sequential pseudo-transaction presented as atomic.

**Exit state:** an adopted proposal can reach an actual UDA lesson/activity with one explicit teacher decision and truthful durable persistence.

### AIC-03 — REVIEW v2: contextual didactic review

**Purpose:** turn REVIEW from metadata inspection into meaningful, non-mutating didactic analysis.

**Inputs:** authorized professional source + Teaching Context + Planning Context + relevant professional memory only.

**Outputs:** relevance, concrete rationale, alignment, gaps, possible reuse/links, confidence and limitations.

**Constraints:** REVIEW remains proposal/analysis only; no writes. Prefer deterministic/local evidence first and invoke remote generation only if policy and budget permit.

**Exit state:** teacher can ask “è utile qui?” and receive an actionable contextual answer without changing product state.

### AIC-04 — Primary-but-nonexclusive AI entry across teacher surfaces

**Purpose:** make the same Copilot usable from the teacher's current work surface instead of forcing navigation through Library.

**Priority surfaces:** class dashboard → planning → online tests → evaluation planning → other teacher-professional surfaces.

**Boundary:** student-bearing screens expose only sanitized professional context projection; no per-student remote context.

**Exit state:** teacher can start from an objective in the current surface, while traditional navigation remains fully usable.

### AIC-05 — Professional memory foundation

**Purpose:** retain useful teacher-work continuity without opaque conversation replay.

**Memory layers:** local event memory → consolidated professional memory → small retrieved working set.

**Required controls:** inspect, correct, remove, disable category, show provenance, `Ricorda questo`, configurable auto-memory categories.

**Never-memory:** individual grades, behaviors, health data, PEI/PDP, student identifiers and any other student-personal data.

**Exit state:** repeated work can reuse teacher-approved professional patterns/materials without loading entire chat history into prompts.

### AIC-06 — Dynamic AI budget governor

**Purpose:** minimize tokens/cost while preserving sufficient quality.

**Resolution ladder:** deterministic/local → retrieval/memory → cache → low-cost remote with minimized context → explicit escalation.

**Escalation choices:**
- authorize this operation only;
- authorize for this activity/session.

Temporary authorization expires automatically. No permanent escalation by inference.

**Exit state:** expensive remote work is exceptional, explainable and teacher-controlled.

### AIC-07 — Local-first proactive assistance

**Purpose:** surface high-value opportunities without noisy interruptions or background token burn.

**Initial triggers:** source↔UDA relevance, adopted proposal not yet operationalized, reusable professional material, obvious professional artifact link, assessment opportunity from an adopted activity.

**Rules:** local/event-driven trigger, high confidence, deduplication/suppression after ignore, progressive disclosure, no persistent effect without teacher decision.

**Exit state:** Copilot can help before being asked, but silence remains the default when confidence/value is insufficient.

### AIC-08 — Governed material transformations

**Purpose:** add useful generation after orchestration, privacy, memory and budget foundations are stable.

**First capabilities:** `ADAPT_MATERIAL`, `SIMPLIFY_MATERIAL`, `CREATE_MATERIAL`.

**Inclusion boundary:** transformations target the material, never a remotely processed individual student profile. Allowed examples include high-readability version, glossary, structured outline/map, linguistic-load reduction and scaffolding variants.

**Exit state:** future intents already recognized by the interpreter stop terminating in generic `UNSUPPORTED` when the corresponding governed capability is explicitly enabled.

### AIC-09 — Assessment draft bridge

**Purpose:** turn professional source/activity context into a governed draft for existing OnlineTest/flashcard infrastructure.

**Flow:** context → `CREATE_ASSESSMENT_DRAFT` proposal → teacher review/edit → explicit save → existing test domain.

**No direct publish/assign.** Any future student-facing publication/assignment requires a separate higher-impact contract.

**Exit state:** teacher can derive a formative assessment draft without manual re-entry while authority remains explicit.

### AIC-10 — Integrated AI Teacher Copilot acceptance

**Purpose:** certify the system as a coherent product rather than a collection of individually green features.

**Required integrated journeys:**
- natural teacher goal → correct context → governed outcome;
- cross-surface context handoff;
- PREPARE → adoption → UDA outcome;
- REVIEW v2;
- memory inspect/correct/remove;
- budget escalation one-shot and session-scoped;
- proactive suggestion ignore/accept behavior;
- material transformation proposal;
- assessment draft proposal;
- student-bearing surface privacy negative cases;
- mobile 390×844 and desktop qualification;
- provider unavailable/error/timeout fail-closed behavior.

**Exit state:** `AI TEACHER COPILOT v1 — ENGINEERING QUALIFIED / HUMAN PRODUCT DECISION READY`.

---

## Dependency graph

`AIC-00 → AIC-01 → AIC-02 → AIC-03 → AIC-04 → AIC-05 → AIC-06 → AIC-07 → AIC-08 → AIC-09 → AIC-10`

Parallelism is allowed only where a slice does not depend on unsettled contracts from a predecessor. In particular, do not parallelize persistence/memory/generative expansion across an unresolved privacy or durable-write boundary.

## Per-slice execution protocol

For every implementation slice:

1. read `AGENTS.md` and active project memory;
2. freeze the integration baseline SHA;
3. create an isolated implementation branch/worktree;
4. write the slice-specific detailed plan if it does not already exist;
5. establish causal RED on the intended contract;
6. implement the minimum GREEN;
7. run focused tests, then complete PREDEPLOY;
8. run Browser Qualification when behavior/UX/context/persistence is user-observable;
9. perform independent whole-slice review;
10. resolve findings with new causal evidence, not assertion weakening;
11. freeze exact candidate SHA and re-run required gates;
12. request a separate human integration decision;
13. never auto-merge or auto-deploy;
14. update repository memory only when the cycle creates reusable knowledge.

## Program success metrics

The program is successful when:

- teacher requests are measured by **intent-to-useful-outcome**, not intent recognition alone;
- supported requests do not require the teacher to know internal capability/action names;
- no remote student-personal leakage is observed in negative/security/browser contracts;
- persistence always remains human-confirmed and truthful;
- common simple requests remain local or low-cost where possible;
- proactive suggestions are sparse, relevant and dismissible;
- professional memory is inspectable and reversible;
- unsupported intent rate decreases only when a capability is actually governed and deliverable;
- each added capability completes its operational loop rather than stopping at generated text.

## Planning rule for later slices

Do **not** pre-write detailed plans for AIC-02…AIC-10 against today's code. Materialize each plan immediately before its slice, using the actual integrated predecessor SHA. This prevents stale interfaces and preserves exact-SHA planning discipline.
