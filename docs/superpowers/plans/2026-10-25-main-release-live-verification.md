# Main Release Live Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Verify the controlled publication of the already-qualified `main@4be167245267da6d664e634e5070a2cc9beb265f` on the existing public target without changing product code, cloud configuration, persistence, or production data.

**Architecture:** Keep the release source frozen at the exact qualified `main` commit. Add a pull-request-triggered runner on an operational branch; the branch remains without a PR until provider publication is confirmed. Once the operational PR is opened, the runner checks out the frozen release SHA, probes the existing public target, and executes the current real-browser qualification corpus against that public target using synthetic browser-local state. Publication remains on the established AI Studio / Cloud Run path and is not performed by this workflow.

**Tech Stack:** GitHub Actions, Node 22, Playwright 1.64.1, Chromium, Node-executed UX-QA analyzers.

**Spec:** Prior approved release boundary in `docs/superpowers/receipts/2026-10-24-uxt-deploy-01-live-release.md`.

## Global Constraints

- Release source is exactly `4be167245267da6d664e634e5070a2cc9beb265f`.
- Public target remains exactly `https://registro-docente.ai.studio`.
- No new service, domain, hosting provider, schema, migration, or production-data mutation.
- No application source file may be modified by this operational branch.
- The live workflow is triggered only by the temporary operational PR and must never be merged into `main`.
- The operational PR must not be opened before provider publication is confirmed, so the live runner remains dormant against the prior release.
- Live verification is fail-closed: any failed HTTP probe, Playwright test, UX-QA analyzer, page error, console error, or missing required evidence fails the run.
- Browser state and fixtures remain synthetic and local to the isolated runner.

## Review Focus

- The workflow must checkout the frozen release SHA rather than its own operational commit.
- The public URL must be the existing production target, not localhost or a preview URL.
- The current Library/Core/context and UX-QA journeys must be exercised so an older deployment cannot falsely pass.
- UX-QA-01 and UX-QA-02 must both return zero findings on live evidence.
- Evidence must be uploaded even on failure for diagnosis.

---

### Task 1: Materialize the operational live-verification runner

**Files:**
- Create: `.github/workflows/release-2026-10-25-live-verification.yml`

**Interfaces:**
- Consumes: frozen repository source `4be167245267da6d664e634e5070a2cc9beb265f`; public target `https://registro-docente.ai.studio`; existing browser tests and UX-QA analyzers from the frozen source.
- Produces: one PR-triggered GitHub Actions live-verification run and a retained evidence artifact.

- [x] **Step 1:** Create a `pull_request`-triggered workflow with immutable `RELEASE_SHA`, `PUBLIC_URL`, and Playwright version on the operational branch.
- [x] **Step 2:** Checkout `RELEASE_SHA` and fail unless `git rev-parse HEAD` matches exactly.
- [x] **Step 3:** Install an isolated Playwright toolchain and copy the same browser specifications used by Browser Qualification #269.
- [x] **Step 4:** Probe the public target, preserve headers/index/asset fingerprints, and require a non-empty public response.
- [x] **Step 5:** Run the complete current 25-test Chromium qualification corpus against `PUBLIC_URL` with synthetic browser-local fixtures.
- [x] **Step 6:** Run UX-QA-01 and UX-QA-02 analyzers on the live evidence and require PASS with no findings.
- [x] **Step 7:** Require the full-inventory mobile/desktop evidence to report PASS with empty page and console error arrays.
- [x] **Step 8:** Upload the complete live evidence artifact with seven-day retention even if an earlier step fails.

### Task 2: Publication handoff and live qualification

**Files:** None.

**Interfaces:**
- Consumes: qualified release source and the dormant operational runner from Task 1.
- Produces: provider publication confirmation plus independent live browser evidence.

- [x] **Step 1:** Keep the operational runner dormant until publication through the existing AI Studio / Cloud Run target is confirmed.
- [ ] **Step 2:** After provider publication, open the temporary operational PR so the live runner executes; do not infer publication from repository state alone.
- [ ] **Step 3:** Accept the release as LIVE VERIFIED only if the live run completes successfully and its artifact is present.
- [ ] **Step 4:** Close the operational PR without merge after recording the final evidence.
