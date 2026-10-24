# RELEASE-01 Integrated Acceptance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Qualify the integrated Registro Docente product through one exact-SHA, stateful Chromium journey ending in reload/unlock persistence verification, then stop at the human deploy decision.

**Architecture:** Extend the existing permanent Browser Qualification harness with one RELEASE-01 Playwright spec. The spec creates synthetic state through the real UI, traverses the post-P2 teacher journey, reuses the ONLINE-01 student submission contract, reloads and unlocks the same Vault, and verifies the same state is durable. Product code remains unchanged unless this acceptance gate exposes a real defect.

**Tech Stack:** React/TypeScript application; Bun; GitHub Actions; `@playwright/test@1.64.1`; Chromium; Secure Local Vault / IndexedDB.

**Spec:** `docs/superpowers/specs/2026-10-23-release-01-integrated-acceptance-design.md`

## Global Constraints

- Baseline: `main@0df596a67416101460cfe9d95bf1e132b1a6ad7d`, tree `aeee0d324fec50989f477348cbf654ef17e9f08f`.
- No deploy, publication or release creation in this plan.
- No product behavior change unless a RELEASE-01 browser failure demonstrates a real product defect.
- Exact candidate SHA discipline is mandatory.
- Application dependencies use `bun install --frozen-lockfile`.
- Browser toolchain remains isolated at Playwright `1.64.1`.
- Qualification data is synthetic only.
- A harness fix may not weaken journey, persistence, error or evidence assertions.
- Any real product fix requires a causal RED before GREEN.

## Review Focus

- Durable sequencing: evaluation/behavior/UDA/submission success cannot be asserted before persistence completes.
- Cross-view continuity: the same synthetic class/student state must drive Tabellone, Analisi and Scheda alunno.
- Reload/unlock: the terminal state must survive reload and Vault unlock, not merely React state.
- Privacy/mobile chrome: no full-screen flow may be occluded by teacher chrome; no unexpected horizontal overflow in the acceptance viewport.
- Evidence ordering: final PASS must occur after terminal screenshot and final console/page-error assertions.

---

### Task 1: Permanent integrated browser acceptance harness

**Files:**
- Create: `tests/browser/release-01-qualification.spec.cjs`
- Modify: `.github/workflows/browser-qualification.yml`

**Interfaces:**
- Consumes: existing Vault setup/unlock interaction, teacher navigation labels, ONLINE-01 student portal behavior.
- Produces: one stateful RELEASE-01 Playwright test plus permanent workflow execution and evidence artifacts.

- [ ] **Step 1: Implement the RELEASE-01 Playwright acceptance spec**

The test must use a fresh browser context and synthetic-only data, then execute in order:

1. configure a fresh Secure Local Vault;
2. create `Classe Sintetica RELEASE-01`;
3. add `Studente Sintetico RELEASE-01` through Gestione alunni;
4. create `Valutazione RELEASE-01` with grade `8`;
5. save `Costruttivo 👍` behavior;
6. visit Tabellone, Analisi and Scheda alunno and assert the committed synthetic state is represented;
7. create `UDA Sintetica RELEASE-01` through UDA UI;
8. complete one online student submission for the same class and verify teacher receipt;
9. reload/lock-unlock the Vault;
10. verify class, student, evaluation, behavior, UDA and submission still exist;
11. capture final screenshot;
12. assert no unexpected console/page errors and no horizontal overflow;
13. write `release-01.json` with `result: PASS` only after all terminal assertions succeed.

Expected: the test is deterministic and uses no external service or real student data.

- [ ] **Step 2: Extend Browser Qualification workflow**

Copy `tests/browser/release-01-qualification.spec.cjs` into `.browser-tools` and include it in the Playwright command after the generic and ONLINE-01 specs.

Expected: Browser Qualification executes generic smoke + ONLINE-01 + RELEASE-01 under the same exact candidate checkout.

- [ ] **Step 3: Commit the acceptance harness**

Commit only docs/harness/workflow changes. No product file should change in this task.

### Task 2: Canonical exact-SHA qualification

**Files:**
- No product changes expected.

**Interfaces:**
- Consumes: Task 1 browser harness.
- Produces: exact-SHA PREDEPLOY and Browser Qualification evidence.

- [ ] **Step 1: Open Draft PR against `main`**

Record exact head SHA and keep PR Draft. No merge/deploy.

- [ ] **Step 2: Run/verify PREDEPLOY on exact candidate**

Expected: frozen install PASS; typecheck PASS; security suite PASS; build PASS; production startup smoke PASS.

- [ ] **Step 3: Run/verify Browser Qualification on exact candidate**

Expected: generic smoke PASS; ONLINE-01 scenarios PASS; RELEASE-01 integrated journey PASS; artifact upload PASS.

- [ ] **Step 4: Inspect browser artifact, not only workflow conclusion**

Verify `release-01.json`, candidate SHA, terminal persistence assertions, screenshots, overflow metrics, console errors and page errors.

### Task 3: Failure handling if qualification is red

**Files:**
- As demonstrated by the failure only.

**Interfaces:**
- Consumes: exact failure evidence from Task 2.
- Produces: either a harness-only correction or a causal product RED→GREEN correction.

- [ ] **Step 1: Classify every failure before modifying files**

Harness/infrastructure failures may be corrected without product changes. Product failures require a dedicated failing regression contract.

- [ ] **Step 2: If product defect, obtain causal RED**

Expected: only the demonstrated product contract fails while unrelated gates remain green.

- [ ] **Step 3: Apply minimum GREEN and requalify from scratch**

Any changed SHA invalidates earlier terminal qualification. Re-run full PREDEPLOY and integrated Browser Qualification.

### Task 4: Independent review and deploy-decision handoff

**Files:**
- Update PR receipt only if needed; no product changes expected.

**Interfaces:**
- Consumes: final exact candidate + canonical PREDEPLOY/browser evidence.
- Produces: terminal independent review and human deploy decision boundary.

- [ ] **Step 1: Request Codex terminal review on exact final candidate**

Review focus: false PASS risks, durable sequencing, reload/unlock proof, synthetic-only hygiene, workflow exact-SHA binding, and any product correction if one was required.

- [ ] **Step 2: Resolve Critical/Important findings causally and requalify if SHA changes**

Expected: 0 unresolved Critical/Important findings.

- [ ] **Step 3: Stop at human decision**

Final state target:

`RELEASE-01 = ENGINEERING QUALIFIED / INTEGRATED BROWSER QUALIFIED / INDEPENDENT REVIEW PASS / HUMAN DEPLOY DECISION PENDING`

Do not deploy, publish, tag or create a release in this plan.
