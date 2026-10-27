# AIC-03 — REVIEW v2 Contextual Didactic Review Design

**Status:** MATERIALIZED FOR PLANNING — no product implementation, merge, deploy or publication authorized by this document  
**Repository baseline:** `main@5cd4b1f7d774aea2699b42320c9a54832d752c0d`  
**Date:** 2026-10-27  
**Program provenance:** AI Teacher Copilot v1 program on PR #67 / `docs/ai-teacher-copilot-v1@3d5a1c4fe8a4dc66beff1b51cc00fe47d56e0519`  
**Predecessor:** AIC-02 integrated in `main` through PR #73; post-merge PREDEPLOY #867 PASS.

## 1. Intent

Turn the existing `REVIEW` capability from a metadata inspection panel into a meaningful **contextual didactic review** that answers the teacher's practical question:

> “È utile qui?”

The result must be actionable enough to support a teaching decision, but it must remain **analysis only**. REVIEW v2 does not persist, link, adopt, modify, publish, assign or generate canonical product state.

The first AIC-03 implementation is deliberately **local-first and deterministic**. It uses already-qualified professional context and evidence before any new generative path is considered.

## 2. Current state at the frozen baseline

At `main@5cd4b1f7d774aea2699b42320c9a54832d752c0d`:

- `review-source` already exists in `src/library/contextualCoreAdapter.ts` as capability `REVIEW`, risk `PROPOSE`, `requiresGenerativeAI: false`;
- the Composer already resolves Teaching Context and Planning Context and builds a privacy-safe Copilot context projection;
- `LibraryCopilotComposer` currently renders REVIEW as metadata only: source title, readability, privacy classification, current context and existing link count;
- `resolveLibraryRelevance()` already provides deterministic signals for current lesson, current UDA, current class, planning-grade match, source-title match and source-content match;
- `describeLibraryRelevanceCandidate()` already turns ranked evidence into teacher-readable reasons;
- `resolveLibraryPlanningContext()` only returns an authoritative Arena context when the profile/context is unambiguous, professional, approved and vigente;
- AIC-02 has closed the PREPARE adoption loop, but REVIEW must not call or reuse that persistence path.

## 3. Goals

### G1 — Meaningful contextual answer

For a professional source and an explicit Teaching Context, REVIEW v2 returns:

- qualitative relevance;
- concrete rationale grounded in local evidence;
- planning/curriculum alignment evidence when it can be demonstrated;
- gaps and missing evidence;
- possible reuse/link destinations as **suggestions only**;
- confidence;
- explicit limitations.

### G2 — Evidence before synthesis

The review must explain which local evidence supports the conclusion. It must never present a claim of curricular alignment merely because a planning profile exists.

### G3 — Non-mutating by construction

Computing and displaying REVIEW v2 must perform zero durable writes and must not call the AIC-02 compound adoption boundary.

### G4 — Privacy fail-closed

Detailed didactic analysis is available only for an authorized professional source. `unknown`, `student-personal`, `restricted`, `failed` or unresolved material does not enter the review engine as if it were safe professional content.

### G5 — Useful degradation

Missing or ambiguous Planning Context does not destroy an otherwise valid source↔Teaching Context review. Instead the result states that planning alignment could not be verified and lowers confidence.

## 4. Non-goals

AIC-03 does **not**:

- add professional-memory persistence or retrieval;
- add a new remote REVIEW endpoint;
- add a new provider/model/secret/retry path;
- add dynamic AI budget escalation;
- change Contextual Copilot Core authority;
- change LINK confirmation semantics;
- change PREPARE provider disclosure, consent or adoption semantics;
- change the UDA, Library or Planning persistence schema;
- expose raw numeric relevance scores to the teacher;
- create a hidden write from a review suggestion.

Professional memory is intentionally **not introduced early**. The program names “relevant professional memory” as a future REVIEW input, but AIC-05 is the slice that establishes that memory foundation. Until AIC-05 is integrated, the effective memory evidence set for REVIEW v2 is empty. AIC-03 must not invent a placeholder memory store or a second source of truth.

## 5. Anti-goals

AIC-03 is considered wrong even if tests are green if it:

- claims didactic or curricular alignment without inspectable local evidence;
- treats the current UDA alone as proof that a source is useful;
- sends source content remotely merely because the teacher asked for REVIEW;
- writes a Library link, UDA lesson or memory item from REVIEW;
- converts an unavailable Planning Context into fabricated certainty;
- exposes internal relevance scores as pseudo-objective pedagogical truth;
- duplicates a new REVIEW authority path outside the existing Core authorization.

## 6. Approaches considered

### A. Local deterministic structured review — **CHOSEN**

Use existing relevance evidence plus authoritative Planning/Arena context to build a structured, teacher-readable review locally.

**Advantages**
- satisfies the program's “deterministic/local evidence first” rule;
- adds no remote data-flow surface;
- avoids building a temporary REVIEW-specific budget/consent system before AIC-06;
- makes provenance and limitations inspectable;
- works when the provider is unavailable;
- remains cheap, fast and testable.

**Trade-off**
- explanations are bounded by the evidence available in Library/UDA/Planning data and are less linguistically rich than generative synthesis.

### B. Hybrid local evidence + optional remote synthesis now — **DEFERRED**

Compute local evidence first, then offer a governed remote synthesis.

**Why deferred**
- it would introduce a new source-content remote path before the dynamic budget governor exists;
- it would require a new consent/disclosure contract distinct from PREPARE;
- it risks building an interim data-flow and budget policy that AIC-06 would immediately replace.

A future enhancement may add this only after a dedicated privacy/budget review and causal qualification.

### C. Remote-first didactic review — **REJECTED**

Send the source/context to the provider and ask for a free-form answer.

Rejected because it weakens local evidence provenance, increases cost/latency, expands the remote privacy surface and makes useful degradation harder.

## 7. Product behavior

### 7.1 Entry

The teacher expresses a REVIEW intent such as “È utile qui?”, “Rivedi questa fonte nel contesto corrente” or an equivalent already recognized by the Agent-First/local intent stack.

The existing Core continues to authorize `review-source`. AIC-03 changes what happens **after** REVIEW is authorized: instead of rendering metadata only, the Composer derives a structured local review.

### 7.2 Preconditions

Full REVIEW v2 requires:

1. selected source exists;
2. source privacy is `teacher-professional`;
3. source status is usable (`captured` or `ready`);
4. Teaching Context resolves to an existing UDA, optionally a lesson.

Planning Context is optional for review execution. If unavailable or ambiguous, the result remains valid but planning alignment is `unverified` and confidence is reduced.

### 7.3 Unavailable states

The review engine returns a typed unavailable result for at least:

- `SOURCE_NOT_PROFESSIONAL`;
- `SOURCE_NOT_USABLE`;
- `TEACHING_CONTEXT_MISSING`.

The UI explains the next safe step in teacher language. It does not silently downgrade an unsafe source to title-only analysis.

## 8. Review evidence model

### 8.1 Current-target relevance

AIC-03 needs evidence for the **current UDA/lesson even if the source is already linked to it**.

The current `resolveLibraryRelevance()` intentionally excludes already-linked targets because it is a suggestion resolver. Therefore AIC-03 adds a reusable target-scoring primitive to `relevanceResolver.ts` while preserving all existing ranking behavior:

```ts
export interface ResolveLibraryRelevanceTargetInput extends ResolveLibraryRelevanceInput {
  targetType: 'uda' | 'lesson';
  targetId: string;
}

export function resolveLibraryRelevanceTarget(
  input: ResolveLibraryRelevanceTargetInput
): LibraryRelevanceCandidate | null;
```

`resolveLibraryRelevance()` may reuse the same primitive internally but must continue excluding already-linked candidates exactly as before.

### 8.2 Planning/curriculum evidence

When `planningContext.status === 'resolved'` and `arenaContext` exists, REVIEW v2 may compare normalized professional source terms with authoritative `arenaContext.curricoloItems[].text`.

A curriculum match is evidence only when at least one normalized term overlaps. The review stores compact evidence:

```ts
export interface ContextualReviewPlanningMatch {
  itemId: string;
  kind: string;
  sourceSection: string;
  matchedTerms: string[];
}
```

The engine must cap displayed curriculum matches to the strongest three deterministic matches and must not rewrite or summarize the curricular source as if generated text were authoritative.

If Planning Context is resolved but there is no specific textual curriculum match, the UI may say the planning profile is available but **specific curricular alignment was not demonstrated**.

### 8.3 Reuse suggestions

Possible reuse/link destinations come from the existing `resolveLibraryRelevance()` ranking, remain non-mutating, exclude the current target and are capped at three.

Existing LINK remains a separate intent/action with its own Core authorization and human confirmation. REVIEW suggestions never call `onLink`.

## 9. REVIEW v2 contract

Create `src/library/contextualDidacticReview.ts` with the following public model:

```ts
export type ContextualReviewRelevanceLevel = 'strong' | 'plausible' | 'weak';
export type ContextualReviewConfidenceLevel = 'high' | 'medium' | 'low';

export interface ContextualReviewReuseSuggestion {
  targetType: 'uda' | 'lesson';
  targetId: string;
  udaId: string;
  title: string;
  subtitle: string;
  reasons: string[];
}

export interface ContextualDidacticReviewV2 {
  schema: 'registro.contextual-didactic-review/v2';
  sourceId: string;
  context: {
    className: string;
    udaId: string;
    lessonId?: string;
    planningProfileId?: string;
    arenaContextId?: string;
  };
  relevance: {
    level: ContextualReviewRelevanceLevel;
    statement: string;
  };
  rationale: string[];
  alignment: {
    status: 'supported' | 'partial' | 'unverified';
    planningMatches: ContextualReviewPlanningMatch[];
  };
  gaps: string[];
  reuseSuggestions: ContextualReviewReuseSuggestion[];
  confidence: {
    level: ContextualReviewConfidenceLevel;
    reasons: string[];
  };
  limitations: string[];
}

export type ContextualDidacticReviewResolution =
  | { status: 'reviewed'; review: ContextualDidacticReviewV2 }
  | {
      status: 'unavailable';
      reason: 'SOURCE_NOT_PROFESSIONAL' | 'SOURCE_NOT_USABLE' | 'TEACHING_CONTEXT_MISSING';
      limitations: string[];
    };

export interface ResolveContextualDidacticReviewInput {
  source: LibrarySource;
  udas: UdaRecord[];
  teachingContext: ResolvedLibraryTeachingContext | null;
  planningContext: LibraryPlanningContextResolution | null;
}

export function resolveContextualDidacticReview(
  input: ResolveContextualDidacticReviewInput
): ContextualDidacticReviewResolution;
```

No persistence callback, fetch client, provider client, memory store or mutation coordinator is accepted by this interface.

## 10. Relevance semantics

The qualitative relevance label is evidence-based and intentionally not a direct display of the internal numeric score.

### `strong`

Requires the current-target evidence to include a source lexical signal (`SOURCE_TITLE_MATCH` or `SOURCE_CONTENT_MATCH`) **and** at least one of:

- `CURRENT_LESSON`;
- a specific authoritative curriculum match.

### `plausible`

Requires at least one source lexical signal or one specific authoritative curriculum match, but not enough evidence for `strong`.

### `weak`

The current target is known but neither lexical nor specific curriculum evidence demonstrates a substantive match.

Being the current UDA/class by itself never produces `strong` or `plausible`.

## 11. Confidence semantics

Confidence describes **evidence completeness**, not pedagogical certainty.

### `high`

- readable source content is available;
- current-target relevance has lexical evidence;
- authoritative planning context exists;
- at least one specific curriculum match exists.

### `medium`

At least two evidence families are available among readable source content, current-target lexical evidence and planning/curriculum evidence, but the `high` contract is not met.

### `low`

Evidence is title-only, Planning Context is unavailable/ambiguous, or the current-target conclusion depends mainly on contextual presence rather than source/content evidence.

The UI labels this as “Affidabilità dell’analisi”, never as a probability or percentage.

## 12. Gaps and limitations

Examples that must be surfaced when applicable:

- source has no readable extracted/payload text;
- Planning Context is unavailable or ambiguous;
- authoritative Arena context is absent;
- no specific curriculum item shares evidence terms;
- no lexical evidence supports the current UDA/lesson;
- source is already linked to the current target;
- the analysis is local/deterministic and does not claim to replace teacher judgment.

Gaps describe missing evidence. Limitations describe boundaries of the method. Neither is hidden when relevance is strong.

## 13. UI presentation

Replace the existing metadata-only REVIEW panel with a structured report using progressive disclosure and existing Composer visual language.

Required teacher-facing sections:

1. **Quanto è pertinente** — strong/plausible/weak in natural Italian, no score;
2. **Perché** — concrete local reasons;
3. **Allineamento alla programmazione** — supported/partial/unverified with curriculum evidence where available;
4. **Cosa manca o va verificato** — gaps;
5. **Possibili riusi** — up to three non-mutating suggestions;
6. **Affidabilità e limiti** — confidence and methodological limits.

The report must remain readable at 390×844 without horizontal overflow. Existing context-selection controls remain the way to change Teaching Context.

## 14. Async and stale-state rule

The review computation is a pure local derivation. It should be computed from the current authorized REVIEW resolution + current source + current Teaching/Planning Context, preferably via `useMemo`, not through a new async state machine.

Existing epoch/snapshot invalidation for intent resolution remains unchanged. When source, source privacy/status, Teaching Context or request changes, the existing resolution invalidation removes the old REVIEW report.

## 15. Network and persistence boundary

AIC-03 adds **zero** network calls for review analysis.

The existing Agent-First intent interpretation may continue to use its already-qualified routing path. After that path resolves `REVIEW`, the didactic review itself is local and must not invoke:

- proposal generation endpoint;
- embedding provider remotely;
- new REVIEW endpoint;
- storage mutation coordinator;
- `onLink`;
- `onAddSource`;
- `onAdoptProposalToUda`;
- professional-memory persistence.

Provider unavailable/error/timeout may still cause the already-qualified local intent fallback. REVIEW v2 must remain usable through that fallback when the local intent catalog recognizes the request.

## 16. Security/privacy boundaries

- `teacher-professional` source: eligible when usable.
- `unknown`: detailed review unavailable until safely classified.
- `student-personal`: detailed review unavailable; no source content enters curriculum matching.
- Planning/Arena data consumed by REVIEW must remain `PROFESSIONAL_NON_PERSONAL` through the existing planning bridge.
- Browser/CI evidence uses synthetic-only data.
- No prompt or source content is added to agent-routing request.

## 17. Compatibility boundaries

Must remain unchanged:

- `review-source` action id and capability id;
- LINK authority and human-confirmation flow;
- PREPARE disclosure, remote one-shot consent and AIC-02 adoption outcomes;
- `resolveLibraryRelevance()` public ranking semantics for existing consumers;
- `registro.agent-routing-request/v1` wire contract;
- provider/model/timeout/retry configuration;
- Library/UDA/Planning storage schemas;
- Contextual Copilot Core vendor package.

## 18. Acceptance criteria

AIC-03 engineering qualification requires one exact candidate SHA where:

1. professional source + explicit current lesson yields structured REVIEW v2 with evidence-based relevance, rationale, alignment, gaps, reuse suggestions, confidence and limitations;
2. already-linked current target remains reviewable;
3. current context alone cannot inflate relevance above `weak` without lexical/curriculum evidence;
4. ambiguous/unavailable Planning Context is reported and does not fabricate alignment;
5. unknown/student-personal/restricted/failed source does not enter detailed review;
6. REVIEW produces no durable write and no additional remote analysis request;
7. provider-unavailable intent fallback can still reach the same local REVIEW result;
8. source/context/request change removes stale REVIEW state;
9. LINK and PREPARE regression journeys remain green;
10. desktop and 390×844 browser journeys remain usable;
11. PREDEPLOY and Browser Qualification pass on the same exact candidate;
12. independent review has no unresolved significant finding;
13. merge/deploy/publication remain separate human decisions.

## 19. Deferred follow-up

After AIC-05/AIC-06, a separate reviewed change may enrich REVIEW with:

- retrieved professional-memory evidence;
- optional governed remote synthesis;
- explicit budget escalation where needed.

That future work must preserve the local evidence report as the fallback and provenance layer rather than replacing it.
