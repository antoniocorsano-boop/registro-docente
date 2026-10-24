# UXT-DEPLOY-01 Release Publication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish the frozen integrated UX-TRUST-01 baseline to the existing Registro Docente public target and close only after fail-closed live Chromium verification.

**Architecture:** Keep application and infrastructure unchanged. Treat `main@76c837470485bfcf9eaddb7e14aeff68a15a26ef` as the frozen release source, use the existing AI Studio / Cloud Run publication path, and perform post-publication verification from an isolated GitHub runner against `https://registro-docente.ai.studio` using the existing `BASE_URL`-aware UXT-F Playwright harness.

**Tech Stack:** GitHub Actions, Bun, Vite production build, Playwright 1.64.1 / Chromium, existing AI Studio / Cloud Run publication target.

**Spec:** `docs/superpowers/specs/2026-10-24-uxt-deploy-01-release-publication-design.md`

## Global Constraints

- Frozen release source: `main@76c837470485bfcf9eaddb7e14aeff68a15a26ef`.
- Existing public target only: `https://registro-docente.ai.studio`.
- No application code, dependency, persistence, security, grading or Student Portal behavior change.
- No new Cloud Run service, domain, provider, secret, database or authentication system.
- No production-data mutation or migration.
- No publication before a distinct human deploy decision.
- Live verification data must be synthetic only.
- Browser #72 remains evidence only for exact candidate `1f98efb6638a5ef43d3da94f671fae2ca5a6b614`.
- A deploy is not a PASS until the live browser gate completes successfully.

## Review Focus

- Release-source drift: if `main` is no longer `76c837...`, stop rather than silently deploying a later SHA.
- Publication source ambiguity: if the publication UI cannot establish what source it is publishing, stop instead of inferring equivalence.
- Public cache/stale assets: record live asset fingerprints and exercise behavior rather than relying on HTTP 200 alone.
- Browser-local synthetic state: live tests must not depend on or modify real teacher/student production records.
- Partial live evidence: missing screenshots, JSON evidence, page-error checks or artifact upload must prevent a final LIVE VERIFIED state.

---

### Task 1: Revalidate the frozen deploy boundary

**Files:**
- Read: `docs/superpowers/receipts/2026-10-24-ux-trust-01-qualification.md`
- Read: `.github/workflows/predeploy-security-qualification.yml`
- Read: `.github/workflows/browser-qualification.yml`

**Interfaces:**
- Consumes: canonical repository memory and existing qualification receipts.
- Produces: one explicit release-source checkpoint used by every later task.

- [ ] **Step 1: Verify the repository release source**

Read `main` and require exact equality with:

`76c837470485bfcf9eaddb7e14aeff68a15a26ef`

Expected: exact match. Any mismatch stops UXT-DEPLOY-01 until a new release source is explicitly selected and requalified as needed.

- [ ] **Step 2: Verify prior integration evidence**

Confirm:

- application candidate `1f98efb...` Browser #72 PASS;
- application integration `7491ed...` tree equals candidate tree `cce9c8ae...`;
- PREDEPLOY #321 PASS on `7491ed...`;
- PREDEPLOY #324 PASS on `76c837...`.

Expected: all evidence present and internally consistent.

- [ ] **Step 3: Record deploy readiness without publishing**

Update only the UXT-DEPLOY-01 planning/receipt branch with a readiness checkpoint if any new evidence is produced.

Expected state: `READY FOR HUMAN DEPLOY DECISION`, not `DEPLOYED`.

---

### Task 2: Human deploy decision

**Files:**
- No repository mutation required for the decision itself.

**Interfaces:**
- Consumes: Task 1 release-source checkpoint.
- Produces: explicit authorization or stop decision.

- [ ] **Step 1: Present the exact action boundary**

State exactly:

- source: `76c837470485bfcf9eaddb7e14aeff68a15a26ef`;
- target: `https://registro-docente.ai.studio`;
- existing publication path only;
- no config/data migration;
- post-deploy live gate mandatory.

- [ ] **Step 2: Require explicit human deploy approval**

Expected: a direct deploy/publication authorization. Generic technical qualification or earlier merge approval is insufficient under D-004 / OR-006.

- [ ] **Step 3: Stop if approval is absent**

Expected: no publication side effect.

---

### Task 3: Publish the frozen source through the existing target

**Files:**
- No application repository files should change.

**Interfaces:**
- Consumes: explicit Task 2 deploy authorization and frozen source `76c837...`.
- Produces: one public deployment at the existing target plus observable deployment/source metadata where the platform exposes it.

- [ ] **Step 1: Open the existing AI Studio publication path**

Use the already configured Registro Docente app/service. Do not create a new service or domain.

- [ ] **Step 2: Verify the intended source before the irreversible publish action**

Expected source: `76c837470485bfcf9eaddb7e14aeff68a15a26ef` or a platform representation demonstrably built from that exact source.

If exact source cannot be established, abort before publish.

- [ ] **Step 3: Publish**

Perform the existing provider's normal publish/redeploy action only after Step 2 succeeds.

Expected target: `https://registro-docente.ai.studio`.

- [ ] **Step 4: Capture deployment evidence**

Record any deployment/revision identifier, source metadata, completion state and public URL exposed by the platform.

Expected: platform publication succeeds. This is still not final cycle PASS.

---

### Task 4: Run isolated live Chromium verification

**Files:**
- Reuse: `tests/browser/ux-trust-01-full-regression.spec.cjs`
- Reuse: other existing browser specs only if needed for the release acceptance boundary.
- Temporary operational workflow: isolated branch only; do not merge it into `main` unless separately approved as a permanent capability.

**Interfaces:**
- Consumes: public deployment from Task 3 and source checkpoint `76c837...`.
- Produces: fail-closed public-browser evidence artifact.

- [ ] **Step 1: Create an isolated operational verification branch rooted at `76c837...`**

Verify the branch exact base before any contents mutation, per OR-009.

- [ ] **Step 2: Add a temporary `workflow_dispatch` live-verification workflow**

The workflow must:

- checkout exact expected release source `76c837...`;
- verify `git rev-parse HEAD` equals that SHA;
- install Playwright 1.64.1 in an isolated tool directory;
- copy the existing UXT-F browser spec;
- set `BASE_URL=https://registro-docente.ai.studio`;
- set `CANDIDATE_SHA=76c837470485bfcf9eaddb7e14aeff68a15a26ef` as the expected released source label;
- write evidence to an artifact directory;
- fail on HTTP/public readiness failure, Playwright failure or missing required evidence;
- upload artifacts with `if: always()`.

- [ ] **Step 3: Add the release-source drift assertion**

Before browser execution, assert the workflow's expected release SHA equals the frozen UXT-DEPLOY-01 source. Do not infer current `main` at runtime.

- [ ] **Step 4: Run the public HTTP probe**

Run an explicit finite-timeout probe against:

`https://registro-docente.ai.studio`

Expected: HTTP success before Chromium starts.

- [ ] **Step 5: Run UXT-F live inventory at 390×844 and 1280×900**

Use the existing assertions for:

- route markers;
- no document-level horizontal overflow;
- Privacy Shield interaction;
- Student Portal viewport ownership;
- zero `pageerror`;
- zero unexpected console errors.

Expected: 2/2 UXT-F inventory cases PASS.

- [ ] **Step 6: Record live asset fingerprints**

Capture the main JS/CSS asset paths observed from the live page where practical.

Expected: evidence allows distinguishing a new/stale public deployment without claiming hash equivalence unless directly proven.

- [ ] **Step 7: Upload evidence**

Required artifact contents:

- mobile screenshot;
- desktop screenshot;
- mobile JSON;
- desktop JSON;
- workflow metadata / expected release SHA;
- public probe output;
- asset fingerprint record.

Expected: artifact upload succeeds and returns an artifact ID/digest.

---

### Task 5: Interpret the live result fail-closed

**Files:**
- No product mutation.

**Interfaces:**
- Consumes: Task 4 workflow result and artifact.
- Produces: LIVE VERIFIED or FAIL diagnosis.

- [ ] **Step 1: Require all live checks**

Expected PASS requires all of:

- public probe PASS;
- exact expected source checkout PASS;
- both UXT-F viewports PASS;
- screenshots present;
- JSON evidence present;
- zero page errors;
- zero unexpected console errors;
- no horizontal overflow;
- Student Portal isolation PASS;
- artifact upload successful.

- [ ] **Step 2: Treat any incomplete evidence as FAIL**

No warning-only downgrade for missing canonical evidence.

- [ ] **Step 3: If FAIL, classify before changing anything**

Separate:

- deployment/source mismatch;
- stale public asset/cache behavior;
- infrastructure/readiness failure;
- browser harness failure;
- real product regression.

Expected: no product patch until a demonstrated cause exists.

---

### Task 6: Write the final publication receipt

**Files:**
- Create: `docs/superpowers/receipts/2026-10-24-uxt-deploy-01-live-release.md`
- Update: `docs/memory/LESSONS_LEARNED.md` only if the deploy cycle itself yields reusable new knowledge.

**Interfaces:**
- Consumes: Tasks 1–5 evidence.
- Produces: canonical final release state.

- [ ] **Step 1: Record source and deployment identity**

Include:

- release source `76c837...`;
- application lineage `1f98efb...` → `7491ed...` → `76c837...`;
- public target;
- provider deployment/revision identifier when available.

- [ ] **Step 2: Record live workflow evidence**

Include run ID, result, artifact ID/digest, viewports, asset fingerprints, page/console error state and overflow/isolation results.

- [ ] **Step 3: Preserve evidence boundaries**

State explicitly that Browser #72 certifies only `1f98efb...`, while UXT-DEPLOY-01 live evidence certifies the public deployment observed after publication.

- [ ] **Step 4: Set the final state only if all gates passed**

Expected successful state:

`UX-TRUST-01 Option B / UXT-A→F = QUALIFIED / INTEGRATED / DEPLOYED / LIVE VERIFIED`

Otherwise record the narrower truthful state and unresolved cause.

- [ ] **Step 5: Review and integrate the documentation receipt separately**

No receipt merge is implied by technical live PASS; retain the project's separate human integration boundary for documentation if needed.
