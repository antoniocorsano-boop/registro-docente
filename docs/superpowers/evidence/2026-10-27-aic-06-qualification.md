# AIC-06 — Dynamic AI Budget Governor qualification receipt

Baseline: `main@70cd8d560aeefec58293b12117a39ed1623ae122`.
Implementation PR: #83.
Design/plan PR: #82.

## TDD chain

- RED `108ac310da72fd3236d009d43796c5ceba019d60`: PREDEPLOY #962 failed only the four new AIC-06 contract assertions; historical typecheck, Library, build and startup remained green.
- Pure governor behavior added and qualified: profiles `economy/balanced/quality`; thresholds 16/64/128 KiB and 1/3/5 professional-memory items; routine `remote-low` 1024; temporary expanded ceiling 2048; binary sources always require escalation.
- Server behavior contract proves routine low-tier invocation, zero provider calls before binary escalation, expanded invocation only with same-activity valid authorization, and fail-closed expired/mismatched authorization.
- PREDEPLOY #972 diagnosed the initial ESM startup regression to one missing `.ts` import extension; after the fix, PREDEPLOY #975 reached successful typecheck, build, production startup, Library 111/111 and all AIC-06 tests. Its only two remaining failures were historical exact-shape fixtures for the new request budget envelope and receipt metadata.
- Those two historical fixtures are updated in `a8778d54d2aac8de1dbf88f6af59276330cdd3ec` without weakening their privacy, provider-error or persistence assertions.

## Product boundaries now implemented

- Durable base profile persists only through the existing encrypted settings mutation.
- Escalation grants remain React-session state only and are cleared on source/UDA/lesson change.
- Client budget preflight runs before the proposal service call.
- Server recomputes the same budget decision before the governed runtime.
- Budget escalation uses stable HTTP 409 `AI_BUDGET_ESCALATION_REQUIRED` semantics with provider invocation blocked until temporary authorization.
- Runtime per-call output capacity is clamped to the existing hard maximum.
- Existing remote consent, privacy classification and Core PREPARE authority remain in force.
- No merge or deploy has been performed.

## Pending qualification

This receipt is intentionally provisional until one exact candidate has:

1. PREDEPLOY PASS;
2. dedicated AIC-06 browser journeys plus historical Browser Qualification PASS;
3. UX-QA-01 and UX-QA-02 PASS;
4. fresh whole-slice review with no unresolved Important/Critical findings.

Target state: `AIC-06 ENGINEERING QUALIFIED / DYNAMIC BUDGET GOVERNED / HUMAN INTEGRATION DECISION PENDING / NO DEPLOY`.
