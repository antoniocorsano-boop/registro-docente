# AIC-06 — Dynamic AI Budget Governor Design

**Status:** DRAFT — execution authorized by continuation of the approved AIC program; integration remains a separate human decision  
**Repository baseline:** `main@70cd8d560aeefec58293b12117a39ed1623ae122`  
**Scope:** `registro-docente`  
**Date:** 2026-10-27

## 1. Intent

Materialize the AI Teacher Copilot v1 budget contract so remote AI work uses the **minimum sufficient capacity**, while any materially more expensive processing is visible, explainable and controlled by the teacher.

AIC-06 does not create a second Copilot, a second provider stack or an autonomous cost optimizer. It adds one shared budget policy around the existing local-first Copilot and governed remote proposal runtime.

Target behavior:

`local/deterministic -> retrieval/memory -> existing cached/current result -> low-cost remote -> explicit temporary escalation`

The first three stages remain the responsibility of the existing local product layers. AIC-06 becomes authoritative immediately before an existing remote boundary is crossed.

## 2. Baseline facts

At the integrated AIC-05 baseline:

- intent interpretation already prefers local routing and constrains remote intent output to a small hard cap;
- PREPARE is a governed remote flow with explicit teacher opt-in and a hard provider maximum of `2048` output tokens;
- source text is bounded by the existing proposal runtime and binary content is bounded separately;
- relevant professional memory is selected locally and remote projection is already capped/minimized;
- no dynamic per-request budget tier or teacher-controlled escalation exists;
- no permanent remote-consent or budget escalation is stored.

AIC-06 must preserve all of those privacy and authority boundaries.

## 3. Product decisions

### 3.1 Base budget profile

Add one optional durable setting:

- `economy` — UI label **Risparmio**;
- `balanced` — UI label **Bilanciato**;
- `quality` — UI label **Qualità**.

`balanced` is the backward-compatible default when the setting is absent.

The profile is a professional application preference and is persisted through the existing encrypted `settings` record. It does not create a new Vault key or backup version.

The profile changes the threshold at which an operation asks for escalation. It does **not** authorize student-personal data, bypass remote consent, authorize persistence, or change Core capability authority.

### 3.2 Remote capacity tiers

AIC-06 v1 exposes two remote execution tiers:

- `remote-low` — routine remote work, `maxOutputTokens = 1024` for teaching proposals;
- `remote-expanded` — existing full proposal ceiling, `maxOutputTokens = 2048`.

Intent routing remains a low-cost control-plane operation under its existing hard cap (`<= 512` output tokens). AIC-06 must not escalate intent routing into expanded generation.

No second provider or model is introduced in this slice. The governor varies whether remote work is allowed and the bounded output capacity supplied to the existing runtime. Future model selection may consume the same contract without changing teacher-facing semantics.

### 3.3 Dynamic complexity estimate

For PREPARE, the pure governor estimates request cost from already-authorized metadata only:

- UTF-8 text bytes;
- decoded inline/binary bytes and whether the source is binary;
- number of remote professional-memory summaries;
- whether a lesson-specific context is present;
- selected base profile.

It does not inspect student data, infer teacher traits or call a model to decide whether another model call is affordable.

Routine text thresholds:

| Profile | Text threshold | Memory summaries | Binary source |
| --- | ---: | ---: | --- |
| `economy` | 16 KiB | 1 | escalation required |
| `balanced` | 64 KiB | 3 | escalation required |
| `quality` | 128 KiB | 5 | escalation required |

A request exceeding the profile threshold, any image/PDF/inline binary request, or another explicitly classified expensive condition returns `escalation-required` before provider invocation.

The existing absolute source-size limits remain authoritative and may still reject an oversized request even after escalation.

### 3.4 Escalation choices

When escalation is required, show one teacher-language explanation and exactly these choices:

- **Autorizza solo questa operazione**;
- **Autorizza per questa attività**.

The operation authorization is request-scoped and consumed by the immediate retry.

The activity authorization:

- is held only in component/session memory;
- is bound to the current `UDA + optional lesson` activity key;
- expires after **30 minutes**;
- is invalid when the activity key changes;
- is never written to Vault, localStorage, sessionStorage or backup.

No authorization can be converted into a permanent escalation by inference.

### 3.5 Explainability

Teacher-facing reasons use stable semantic codes but non-technical copy:

- `BINARY_SOURCE` — “Per analizzare questo file o immagine serve una richiesta più impegnativa.”
- `LARGE_SOURCE` — “Il materiale è ampio e richiede più capacità per essere analizzato senza tagliarlo.”
- `RICH_CONTEXT` — “Questa attività combina più contesto professionale utile e richiede un’elaborazione più ampia.”

The normal UI does not expose token counts, temperatures, provider tuning or internal score formulas.

## 4. Shared budget contract

Create `src/copilot/aiBudgetGovernor.ts` as a pure, browser/server-safe module.

Core types:

```ts
export type AiBudgetProfile = 'economy' | 'balanced' | 'quality';
export type AiRemoteTier = 'remote-low' | 'remote-expanded';
export type AiBudgetEscalationReason = 'BINARY_SOURCE' | 'LARGE_SOURCE' | 'RICH_CONTEXT';

export interface AiBudgetAuthorizationV1 {
  schemaVersion: 1;
  scope: 'operation' | 'activity';
  issuedAt: string;
  expiresAt: string;
  activityKey: string;
}

export interface PrepareBudgetInput {
  profile: AiBudgetProfile;
  textBytes: number;
  inlineBytes: number;
  memoryItems: number;
  activityKey: string;
  authorization?: AiBudgetAuthorizationV1;
  now: string;
}

export type PrepareBudgetDecision =
  | { kind: 'allow'; tier: AiRemoteTier; maxOutputTokens: 1024 | 2048; escalated: boolean }
  | { kind: 'escalation-required'; reason: AiBudgetEscalationReason; explanation: string };
```

Required helpers:

- `normalizeAiBudgetProfile(value): AiBudgetProfile` — missing/invalid -> `balanced`;
- `createAiBudgetAuthorization(...)` — creates only a short-lived v1 authorization; activity scope uses a 30-minute TTL;
- `isAiBudgetAuthorizationValid(...)` — checks schema, clock, maximum TTL, scope and exact activity key;
- `resolvePrepareBudget(input): PrepareBudgetDecision` — deterministic policy;
- `aiBudgetEscalationMessage(reason): string` — teacher-language copy.

The server must run the same resolver as the browser before the remote provider is invoked. Client-side preflight improves UX; server-side evaluation is the enforcement point for the supported application path.

## 5. Wire contract

Extend `LibraryProposalRequestV1` with:

```ts
budget: {
  schemaVersion: 1;
  profile: AiBudgetProfile;
  activityKey: string;
  authorization?: AiBudgetAuthorizationV1;
}
```

`buildLibraryProposalRequest()` derives `activityKey` from the current UDA and optional lesson and includes the normalized profile.

The server validates the budget object fail-closed. Unknown keys, malformed timestamps, an activity-key mismatch or an authorization beyond the permitted lifetime make the request invalid or leave it non-authorized; they never silently upgrade the request.

If the shared resolver returns `escalation-required`, the route returns:

- HTTP `409`;
- error code `AI_BUDGET_ESCALATION_REQUIRED`;
- `retriable: false`;
- stable `reason` and teacher-language `message`;
- no provider invocation and no provider receipt.

After a valid authorization the same request is recomputed server-side and the runtime is invoked at `remote-expanded`.

## 6. Runtime contract

Extend `TeachingProposalRuntime.generate()` with an optional per-call output cap:

```ts
options?: {
  signal?: AbortSignal;
  requestId?: string;
  maxOutputTokens?: number;
}
```

The runtime must clamp the per-call value to a positive integer not greater than its existing configured hard maximum. A caller cannot raise the provider ceiling above `2048` through request data.

The receipt gains optional budget audit metadata:

```ts
budget?: {
  tier: 'remote-low' | 'remote-expanded';
  profile: AiBudgetProfile;
  escalated: boolean;
}
```

This metadata is technical/audit evidence and is not rendered as token detail in ordinary teacher UI.

## 7. Settings UX

Add a progressive setting in `SettingsView` under AI/local-assistance configuration:

**Uso delle risorse IA**

- Risparmio — asks sooner before more demanding remote work;
- Bilanciato — default; ordinary requests stay compact and larger work asks permission;
- Qualità — allows broader routine context before asking permission.

Changing the profile uses the existing `onUpdateSettings()` durable settings mutation and truthful pending/error behavior. It does not change remote consent or create an escalation grant.

## 8. Proposal UX

The existing remote-consent disclosure remains first. Budget escalation is a second, distinct decision only when required.

Flow:

`professional source -> remote consent -> Core PREPARE authorization -> budget preflight ->`

- routine: generate with `remote-low`;
- expensive: show reason + two temporary choices -> retry with `remote-expanded`;
- invalid/expired grant: ask again rather than silently escalating.

Source, privacy, UDA or lesson changes invalidate any pending escalation UI and any activity authorization that no longer matches.

Provider unavailable/error/timeout behavior remains governed by the existing error contract.

## 9. Privacy and authority invariants

AIC-06 must not:

- make `STUDENT_PERSONAL` or ambiguous content remote-eligible;
- move budget estimation before privacy classification;
- add student identifiers to the budget contract;
- persist temporary escalation grants;
- bypass explicit remote consent;
- change Core capability authority;
- turn generated proposals into persistent state;
- widen PREPARE adoption transactions;
- log prompt/source contents merely to estimate cost;
- increase hard source/output limits beyond existing provider-runtime ceilings.

## 10. Cache and earlier ladder stages

AIC-06 does not create a new persistent AI-response cache. Current in-memory/current-result reuse remains ahead of remote generation where it already exists. A future qualified cache can report a hit into the same resolution ladder.

Professional-memory retrieval remains local and precedes budget evaluation. The governor receives only the resulting minimized count/size characteristics; it does not query the memory store itself.

## 11. Failure semantics

- malformed budget profile on persisted old settings -> normalize to `balanced`;
- malformed budget wire object -> `REQUEST_INVALID`;
- expired/mismatched authorization -> no escalation privilege; return `AI_BUDGET_ESCALATION_REQUIRED` when the request is otherwise expensive;
- budget decision required -> no provider call;
- provider failures after a valid budget decision keep existing stable provider error mapping;
- changing profile does not retroactively upgrade a request already in flight;
- abort/context change cancels the active request and clears operation-scoped authorization.

## 12. Qualification

The slice requires:

1. causal RED -> GREEN for pure policy, wire validation, runtime cap and UI contracts;
2. PREDEPLOY on one frozen exact candidate;
3. browser qualification using synthetic data on desktop and 390x844;
4. browser journeys proving:
   - routine text uses low tier without an escalation prompt;
   - expensive/binary request does not hit provider before teacher escalation choice;
   - one-operation authorization is not reused after the operation/context changes;
   - activity authorization works only for the same activity and expires/invalidates safely;
   - profile controls are durable but grants are not persisted;
   - student-personal source still cannot enter the remote/budget flow;
5. UX-QA-01 and UX-QA-02 with no blocking findings;
6. fresh whole-slice independent review on the exact candidate;
7. separate human integration decision;
8. no deploy or publication as a consequence of qualification.

## 13. Exit state

AIC-06 is complete when ordinary remote PREPARE work runs at the smaller bounded tier, materially more expensive work cannot reach the provider without a clear temporary teacher authorization, the profile is configurable without weakening privacy, and no escalation survives beyond its defined operation/activity lifetime.

Target status:

**AIC-06 ENGINEERING QUALIFIED / DYNAMIC BUDGET GOVERNED / HUMAN INTEGRATION DECISION PENDING**
