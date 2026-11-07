# AIC-03 REVIEW v2 Requalification Amendment

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this amendment against the existing AIC-03 implementation branch. This document amends, but does not rewrite, `docs/superpowers/plans/2026-10-27-aic-03-review-v2.md`.

**Goal:** Requalify AIC-03 REVIEW v2 after Browser Qualification #582 exposed a mixed set of new-journey failures, historical-browser expectation drift, and one AIC-02 regression signal, while introducing explicit maturity and usability gates for AI Teacher Copilot v1.

**Architecture:** Preserve the AIC-03 local-first deterministic REVIEW v2 architecture and the already-green pure review engine. Treat Browser #582 as REWORK evidence: diagnose every failing journey causally, repair product code only when product behavior is actually wrong, and update historical test expectations only when the product behavior intentionally changed under the approved AIC-03 design. No AIC-04/AIC-05 product work begins until AIC-03 reaches exact-SHA Browser qualification and whole-slice review.

**Tech Stack:** React + TypeScript, Bun, Contextual Copilot Core, Secure Vault, GitHub Actions exact-SHA qualification, Playwright 1.64.1.

**Spec:** `docs/superpowers/specs/2026-10-27-aic-03-review-v2-design.md`

## Global Constraints

- No merge, deploy or publication as part of this amendment.
- Do not weaken REVIEW privacy, Core authority, durable mutation or stale-result contracts to make tests pass.
- Product changes require a causal RED tied to observed product behavior.
- Historical browser assertions may be updated only when they encode intentionally superseded copy/structure and the replacement remains covered by the new AIC-03 contract.
- AIC-02 PREPARE/adoption regressions are blocking until classified and resolved or disproved with evidence.
- Qualification must pin one exact candidate SHA across PREDEPLOY, Browser and independent review.
- Synthetic data only in automated/browser qualification.

## Program maturity model

Each capability and slice is tracked on two independent axes.

### Engineering / governance maturity

- **M0 — Planned:** intent and place in the program are known; no qualified design/implementation.
- **M1 — Designed:** behavior and boundaries are specified/approved.
- **M2 — Implemented:** product code exists and focused/static/security/unit gates are green.
- **M3 — Browser qualified:** exact-SHA browser journeys and required UX analyzers are green.
- **M4 — Integrated:** qualified candidate is integrated into the canonical branch with post-merge verification.
- **M5 — Human validated:** real teacher/product review confirms the capability is useful and understandable in authentic use.

### Teacher usability maturity

- **U0 — Unavailable:** teacher cannot use the capability.
- **U1 — Technical:** capability can be exercised but is not yet trustworthy or natural enough for ordinary teacher use.
- **U2 — Guided:** useful with visible friction, setup, disclosure or contextual guidance.
- **U3 — Normal-use:** a teacher can use it in the expected workflow without understanding internal architecture.
- **U4 — Primary-flow:** the capability is sufficiently fluid, contextual and reliable to become a preferred entry path while traditional navigation remains available.

A slice does not advance merely because code exists. The exit receipt records both axes.

## Program priority update

The delivery dependency remains sequential, but product priority after AIC-03 is explicitly:

`AIC-03 stabilize REVIEW v2 -> AIC-04 cross-surface entry -> AIC-05 professional memory`

Rationale:

1. AIC-03 must make the simple teacher question `È utile qui?` produce a trustworthy contextual answer.
2. AIC-04 must make that answer reachable from the teacher's current surface instead of requiring Library-first navigation.
3. AIC-05 must remove the repeated-start-from-zero experience by adding inspectable, reversible professional continuity.

AIC-06 through AIC-09 remain important, but must not be pulled forward to compensate for unresolved usability in AIC-03/04/05.

## Current checkpoint — Browser Qualification #582

Candidate: `e23dca460bfc0f96b50fc344673b7cee9dfb9d76`.

PREDEPLOY #881 is GREEN:
- typecheck PASS;
- security 459/459 PASS;
- Library 105/105 PASS;
- production build PASS;
- production startup smoke PASS.

Browser #582 is REWORK:
- exact candidate checkout PASS;
- Chromium 48/54 PASS;
- 6 failures.

The six failures must be classified into three buckets before any patch:

### Bucket A — New AIC-03 journey failures

1. `AIC-03 REVIEW v2 is structured and local/read-only — desktop` does not reach `library-copilot-review-panel`.
2. `AIC-03 REVIEW v2 fails closed for unknown source then shows weak/unverified local analysis on mobile 390x844` does not reach the review panel.

These are blocking product/fixture diagnostic work. Determine whether intent routing, source classification, Core authorization, stale identity, context projection or UI state prevents the panel from opening.

### Bucket B — historical expectation drift

3. `LIB-01B hands contextual source actions to Copilot...` expects the superseded text `Controlla nel contesto`.
4. `LIB-06A routes REVIEW locally...` expects the superseded text `Controlla nel contesto`.
5. `contextual Copilot handoff...` expects the superseded text `Controlla nel contesto` inside the review panel.

If traces confirm REVIEW is otherwise correctly authorized/rendered, update these historical assertions to the approved REVIEW v2 structure rather than restoring obsolete copy.

### Bucket C — AIC-02 regression signal

6. `AIC-02 UDA-only compound adoption persists one source and one new lesson after reload — desktop` fails because the expected durable-success UI `Proposta aggiunta all’UDA` is absent after adoption.

Treat this as a real regression signal until disproved. Inspect the trace and committed durable state. Do not relax or remove the assertion merely because AIC-03 did not intentionally target AIC-02.

## Task R1 — Diagnose the two AIC-03 panel failures

**Files:**
- Inspect: `tests/browser/aic-03-review-v2.spec.cjs`
- Inspect: `src/components/LibraryCopilotComposer.tsx`
- Inspect as needed: AIC-01 intent/context routing and Contextual Core adapter modules.

- [ ] Reproduce the exact route/source/context state from Browser #582 traces.
- [ ] Identify the first divergence between expected REVIEW authorization and rendered UI.
- [ ] If the failure is a fixture/harness mismatch, establish a fixture-only RED/GREEN without product code change.
- [ ] If the failure is product behavior, add the smallest causal product regression test before patching.
- [ ] Re-run the focused AIC-03 browser spec and preserve the same assertions for desktop and 390x844 mobile.

**Exit:** both new AIC-03 journeys reach the correct available/unavailable REVIEW v2 panel for the intended scenario.

## Task R2 — Rebase historical REVIEW browser contracts

**Files:**
- `tests/browser/lib01b-contextual-core-qualification.spec.cjs`
- `tests/browser/lib04b-copilot-composer.spec.cjs`
- `tests/browser/library-contextual-copilot-handoff.spec.cjs`

- [ ] Confirm from #582 evidence that each failing historical test already sees `library-copilot-review-panel` and fails only on obsolete copy.
- [ ] Replace old-copy assertions with stable REVIEW-v2 structure/test-id assertions.
- [ ] Preserve negative assertions proving LINK/PREPARE remain hidden where the historical contract requires REVIEW-only behavior.
- [ ] Run the three focused browser specs.

**Exit:** historical tests verify enduring behavior rather than superseded wording.

## Task R3 — Diagnose the AIC-02 adoption regression signal

**Files:**
- Inspect: `tests/browser/aic-02-prepare-outcome.spec.cjs`
- Inspect: `src/components/LibraryProposalPanel.tsx`
- Inspect: `src/components/LibraryCopilotComposer.tsx`
- Inspect: AIC-02 adoption/persistence boundary modules only if trace/state evidence points there.

- [ ] Read Browser #582 trace around `Adotta e aggiungi all'UDA`.
- [ ] Determine whether durable adoption occurred, whether the success UI was lost, or whether the mutation itself failed/stalled.
- [ ] If the mutation and durable state are correct but only an intentionally changed transient surface invalidates the test, prove that with reload/readback before changing the assertion.
- [ ] If product behavior regressed, add a causal RED and apply the minimum GREEN without weakening compound atomicity or publish-after-persist truthfulness.
- [ ] Re-run all AIC-02 browser journeys after any product change.

**Exit:** no unexplained regression remains in the AIC-02 operational loop.

## Task R4 — Exact-SHA requalification

- [ ] Freeze the new candidate SHA only after R1-R3 are green.
- [ ] Run PREDEPLOY on the frozen candidate; require all typecheck/security/Library/build/startup gates green.
- [ ] Run full Browser Qualification on the same exact SHA; require every journey green plus UX-QA analyzers.
- [ ] Perform independent whole-slice review focused on privacy leakage, false confidence, stale REVIEW, hidden writes/network, AIC-02 regression, and mobile/desktop usability.
- [ ] Any important finding creates a new RED -> minimal GREEN -> full exact-SHA requalification cycle.

**Target AIC-03 exit:** `M3 BROWSER QUALIFIED / U2 GUIDED / DRAFT / HUMAN INTEGRATION DECISION PENDING`.

AIC-03 may later reach U3/M5 only after integration and authentic teacher/product validation; automated qualification alone must not claim that level.

## Program-level usability gate for subsequent slices

Before AIC-04 starts, record the AIC-03 exit receipt with both maturity axes. Before AIC-05 starts, AIC-04 must demonstrate that at least the priority teacher surfaces can launch the same Copilot without Library-first navigation and without student-personal remote context. AIC-10 remains responsible for the final integrated U4/M5 product decision across the complete program.
