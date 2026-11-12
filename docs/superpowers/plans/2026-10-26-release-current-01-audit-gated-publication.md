# RELEASE-CURRENT-01 Audit-Gated Publication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Freeze, independently re-qualify, publish and live-verify the current integrated Registro Docente baseline without changing product behavior.

**Architecture:** Treat `main@0ebda92248b9bb984f2e3e201661292daa47e96d` as the proposed frozen release source, but require an explicit A0/A1 audit before any deploy decision. Reuse the existing application, qualification harness and public target; keep qualification runners isolated from the frozen source and keep deploy/live verification as separate evidence domains.

**Tech Stack:** GitHub Actions, Bun, Vite production build, Playwright 1.64.1 / Chromium, existing AI Studio / Cloud Run publication target.

**Spec:** `docs/superpowers/specs/2026-10-26-audit-gated-product-roadmap-design.md`

## Global Constraints

- Proposed frozen release source: `0ebda92248b9bb984f2e3e201661292daa47e96d`.
- Existing public target only: `https://registro-docente.ai.studio`.
- No product-code, dependency, persistence, authority, provider or schema change in RELEASE-CURRENT-01.
- No automatic merge, deploy or publish.
- No deploy before explicit human deploy authorization.
- Qualification and live verification use synthetic/browser-local data only.
- Browser #428 remains evidence for exact candidate `6c1c3d3473267845b9faeade54c5c3dea03d33ca`, not automatically for the merge SHA.
- Candidate and merge tree identity may support lineage, but fresh release-source evidence is still required.
- Missing or incomplete evidence is FAIL, not warning.
- Any drift of `main` after release-source freeze requires a new audit decision; do not silently advance the source.

## Review Focus

- Release-source drift: a newer `main` must not silently replace `0ebda922...` after freeze.
- Evidence transfer: tree identity must not be used to relabel Browser #428 as a run on the merge SHA.
- Qualification-runner contamination: temporary workflow files must never be mistaken for product changes or merged unintentionally.
- Live synthetic isolation: public verification must not read or mutate real teacher/student records.
- Partial publication evidence: HTTP 200 without workflow inventory, screenshots/JSON and error checks is not LIVE VERIFIED.

---

### Task 1: A0 preliminary release audit

**Files:**
- Read: `AGENTS.md`
- Read: `docs/memory/README.md`
- Read: `docs/memory/OPERATING_RULES.md`
- Read: `docs/memory/DECISIONS.md`
- Read: `docs/memory/TOOL_RECIPES.md`
- Read: `docs/memory/LESSONS_LEARNED.md`
- Read: `.github/workflows/predeploy-security-qualification.yml`
- Read: `.github/workflows/browser-qualification.yml`
- Read: `docs/superpowers/receipts/2026-10-24-uxt-deploy-01-live-release.md`
- Create: `docs/superpowers/audits/2026-10-26-release-current-01-a0.md`

**Interfaces:**
- Consumes: current `main`, canonical memory, prior live-release receipt, qualification workflows.
- Produces: `A0 decision = PROCEED | REWORK PLAN | STOP`, exact release-source candidate and list of evidence gaps.

- [ ] **Step 1: Verify current repository state**

Require:

- `main == 0ebda92248b9bb984f2e3e201661292daa47e96d`;
- no open PR changes competing for the same release freeze;
- post-merge PREDEPLOY #722 completed successfully.

Expected: exact match and no ambiguous competing release candidate.

- [ ] **Step 2: Verify LIB-CONSOLIDATE-01 lineage**

Require:

- candidate `6c1c3d3473267845b9faeade54c5c3dea03d33ca`;
- candidate tree `87483ccc4b693b0250ec3d338015fd2a9f6b350b`;
- merge tree `87483ccc4b693b0250ec3d338015fd2a9f6b350b`;
- PREDEPLOY #721 PASS;
- Browser #428 PASS 43/43, UX-QA-01/02 0 findings;
- PREDEPLOY #722 PASS on merge SHA.

Expected: lineage internally consistent; Browser evidence boundary remains explicit.

- [ ] **Step 3: Identify the currently live verified baseline**

Read the last canonical live-release receipt and record its release source and public target.

Expected: evidence shows the public live baseline predates `0ebda922...`, so publication alignment is a real gap rather than duplicate work.

- [ ] **Step 4: Audit current browser coverage**

Confirm the permanent Browser Qualification includes current tests for:

- Home/navigation and UX-QA;
- UDA and RELEASE-01 integrated acceptance;
- Library foundation/acquisition;
- contextual Core/Teaching Context;
- LINK/PREPARE;
- local semantic retrieval;
- single contextual Copilot handoff;
- Online/Student Portal.

Expected: no product change is needed merely to create a pre-release regression gate.

- [ ] **Step 5: Write A0 audit**

The audit must state:

- baseline SHA and tree;
- prior live release source;
- evidence already valid;
- evidence that must be freshly generated;
- deploy boundary;
- decision `PROCEED | REWORK PLAN | STOP`.

Expected for PROCEED: only qualification/documentation work remains before the human deploy decision.

- [ ] **Step 6: Commit Task 1**

Commit only audit/design/plan documentation. No product/workflow mutation in this task.

---

### Task 2: A1 fresh frozen-source qualification runner

**Files:**
- Create on an isolated operational branch only: `.github/workflows/release-current-01-predeploy-verify.yml`
- Reuse read-only: current production/source tests and browser specs from `0ebda922...`
- Create evidence through GitHub Actions artifacts only.

**Interfaces:**
- Consumes: Task 1 `PROCEED` and exact frozen source `0ebda922...`.
- Produces: fresh PREDEPLOY-equivalent + Browser evidence whose application checkout is exactly the frozen source.

- [ ] **Step 1: Audit the runner design before writing it**

Check that the runner can checkout `0ebda922...` independently of the operational branch and that no test depends on PR-head product content.

Expected: qualification can run without modifying the frozen source.

- [ ] **Step 2: Create the operational branch from the frozen source**

Apply OR-009: create branch first, verify exact base, then mutate workflow contents.

- [ ] **Step 3: Add a workflow_dispatch/PR qualification runner**

The runner must:

- checkout `0ebda92248b9bb984f2e3e201661292daa47e96d` into the application workspace;
- assert `git rev-parse HEAD` equals the frozen SHA;
- run `bun install --frozen-lockfile`;
- run typecheck/security/library/build/startup gates;
- install isolated Playwright 1.64.1;
- run the current browser suite against a production build of that same frozen source;
- run UX-QA-01/02 analyzers;
- upload evidence with `if: always()`;
- fail closed on missing required evidence.

- [ ] **Step 4: Verify workflow RED/evidence gap honestly**

Because this is qualification-only, do not invent a product RED. The precondition gap is simply “no fresh run exists yet for frozen merge SHA”.

Expected: runner exists and has not yet yielded a PASS until the workflow completes.

- [ ] **Step 5: Run and inspect the qualification**

Expected successful state:

`RELEASE SOURCE QUALIFIED / exact 0ebda922... / PREDEPLOY-equivalent PASS / Browser PASS / UX-QA PASS`.

Any failure is classified before changing anything.

- [ ] **Step 6: A2 boundary audit**

Confirm:

- frozen application source unchanged;
- operational runner diff contains no product files;
- no provider/schema/persistence/config drift;
- artifacts map to exact frozen source.

---

### Task 3: A3 review and deploy-readiness receipt

**Files:**
- Create: `docs/superpowers/audits/2026-10-26-release-current-01-deploy-readiness.md`
- Update roadmap/plan status only if evidence warrants it.

**Interfaces:**
- Consumes: Task 2 fresh exact-source qualification.
- Produces: `READY FOR HUMAN DEPLOY DECISION` or narrower truthful state.

- [ ] **Step 1: Perform fresh review of release evidence and operational diff**

Focus on source drift, evidence boundary, temporary workflow scope, data isolation and false-PASS risk.

- [ ] **Step 2: Record exact evidence**

Include run IDs, exact SHA, test counts, UX-QA result, artifact ID/digest and any non-blocking residual risk.

- [ ] **Step 3: Stop at the human deploy boundary**

Expected: no publication occurs in this task.

---

### Task 4: Human deploy decision

**Files:**
- No repository mutation required for the decision itself.

**Interfaces:**
- Consumes: Task 3 deploy-readiness receipt.
- Produces: explicit authorization or stop.

- [ ] **Step 1: Present the exact irreversible action**

State source, target, publication path, absence of migrations and mandatory live verification.

- [ ] **Step 2: Require explicit deploy/publication approval**

Expected: direct authorization. Merge approval or technical PASS is insufficient.

---

### Task 5: Publish existing target without migration

**Files:**
- No product repository files should change.

**Interfaces:**
- Consumes: explicit Task 4 authorization.
- Produces: one public deployment on the existing target.

- [ ] **Step 1: Re-audit release-source identity immediately before publish**

Expected: publication source remains `0ebda922...`; otherwise STOP.

- [ ] **Step 2: Use only the existing publication path**

Do not create a new service/domain/provider/database/auth system.

- [ ] **Step 3: Publish and capture deployment identity**

Expected target: `https://registro-docente.ai.studio`.

---

### Task 6: A4 public live verification

**Files:**
- Temporary operational workflow only, isolated from `main`.
- Reuse current browser inventory against `BASE_URL=https://registro-docente.ai.studio`.

**Interfaces:**
- Consumes: Task 5 deployment.
- Produces: fail-closed live artifact.

- [ ] **Step 1: Audit live runner before execution**

Verify source label, public URL, browser-local synthetic state, expected evidence and fail-closed ordering.

- [ ] **Step 2: Probe public readiness**

Expected: finite-timeout HTTP success.

- [ ] **Step 3: Run mobile + desktop live inventory**

Minimum inventory is defined by the spec; zero unexpected page/console errors and no blocking overflow.

- [ ] **Step 4: Preserve evidence**

Require screenshots, JSON, logs, expected source, public target, asset fingerprints when available, artifact ID/digest.

- [ ] **Step 5: Interpret fail-closed**

Any missing evidence or failing journey is FAIL and must be classified before code changes.

---

### Task 7: Final release receipt and roadmap handoff

**Files:**
- Create: `docs/superpowers/receipts/2026-10-26-release-current-01-live-release.md`
- Update: `docs/memory/LESSONS_LEARNED.md` only if reusable new knowledge emerges.
- Future plan (separate after audit): `docs/superpowers/plans/2026-10-26-edu-flow-01a-longitudinal-read-model.md`

**Interfaces:**
- Consumes: Tasks 1–6.
- Produces: truthful current release state and handoff into EDU-FLOW-01A A0 audit.

- [ ] **Step 1: Record release and live evidence boundaries**

Keep source qualification, deploy evidence and public live evidence distinct.

- [ ] **Step 2: Set final release state only if all gates passed**

Expected successful state:

`RELEASE-CURRENT-01 = QUALIFIED / PUBLISHED / LIVE VERIFIED`.

- [ ] **Step 3: Start EDU-FLOW-01A with audit, not implementation**

Audit current Planning/UDA/lesson/evidence/library-link models before proposing any new persistence. The separate EDU-FLOW-01A plan is written only after that audit.