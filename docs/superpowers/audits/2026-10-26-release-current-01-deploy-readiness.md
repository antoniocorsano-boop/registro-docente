# RELEASE-CURRENT-01 — A1/A2/A3 Deploy Readiness Audit

**Date:** 2026-10-26  
**Repository:** `antoniocorsano-boop/registro-docente`  
**Frozen application source:** `0ebda92248b9bb984f2e3e201661292daa47e96d`  
**Operational runner PR:** #63  
**Operational runner head:** `54f5e724fa9eb0fd45e9dc07b8f1405b24a1481b`  
**Decision:** `READY FOR HUMAN DEPLOY DECISION`

## 1. A1 frozen-source qualification

Dedicated workflow:

`RELEASE-CURRENT-01 Frozen Source Qualification #1`

Run:

`40287512770`

The runner branch exists only to host the qualification workflow. Both jobs explicitly checkout and verify the frozen application source:

`0ebda92248b9bb984f2e3e201661292daa47e96d`

The operational workflow commit `54f5e724...` is not the application under test.

### PREDEPLOY-equivalent job

Job `121454566344`: **SUCCESS**.

Evidence on exact frozen application source:

- checkout SHA verification: PASS;
- `bun install --frozen-lockfile`: PASS;
- typecheck: PASS;
- security: **419 PASS / 0 FAIL / 2471 expect() calls / 84 files**;
- Library: **68 PASS / 0 FAIL / 284 expect() calls / 12 files**;
- intent evaluation corpus: **68 cases**, canonical accuracy 1.00, unsupported false-positive rate 0.00, supported precision 1.00, supported recall 1.00, paraphrase/noisy recall 1.00, failures 0;
- production build: PASS, Vite 8.3.5, 2559 modules transformed;
- production startup smoke: PASS.

Non-blocking build/runtime warnings observed:

- Vite future native-loader warning for `__dirname` in current config;
- chunk-size advisory for the main production bundle;
- GitHub Actions warning that Node.js 20-targeting actions are being forced to Node.js 24 by the hosted runner.

None changed exit status, source identity, test outcome or publication boundary. They are not release blockers for this frozen cycle and the operational runner will not be merged.

### Browser exact-release job

Job `121454566185`: **SUCCESS**.

- exact frozen-source checkout: PASS;
- frozen install: PASS;
- production build: PASS;
- isolated Playwright 1.64.1 + Chromium install: PASS;
- production server readiness: PASS on second probe;
- Chromium: **43/43 PASS**;
- UX-QA-01 analyzer: **PASS / 0 findings / 0 blocking findings**;
- UX-QA-02 analyzer: **PASS / 0 findings / 0 blocking findings**;
- required-evidence gate: PASS;
- artifact upload: PASS.

The 43 browser cases include current coverage for the private Library, shared contextual Core, Teaching Context, governed proposal/provider runtime, heterogeneous acquisition, relevance UX, Composer, LINK, PREPARE, local semantic retrieval, contextual Copilot handoff, Online/Student Portal, integrated RELEASE-01 journey, full UX-TRUST inventory and UX-QA-01/02.

### Artifact

Artifact ID:

`12634417870`

Name:

`release-current-01-preverify-0ebda92248b9bb984f2e3e201661292daa47e96d`

Evidence files: **92**.

Size: `4,880,624` bytes.

Digest:

`sha256:7b479da3aa567ce74f142d9ec9c90bdb189288a26c1cdc78b582a3d5aa25319c`

## 2. A2 boundary audit

### Main drift

Immediately after qualification, `main` remains exactly:

`0ebda92248b9bb984f2e3e201661292daa47e96d`

Tree remains:

`87483ccc4b693b0250ec3d338015fd2a9f6b350b`

No application-source drift occurred during A1.

### Operational diff

Compare:

`main@0ebda922... → ops/release-current-01-preverify@54f5e724...`

Result:

- ahead: 1;
- behind: 0;
- exactly **1 changed file**;
- file: `.github/workflows/release-current-01-preverify.yml`;
- additions: 248;
- deletions: 0.

No product, provider, schema, persistence, authority, dependency or deployment configuration file is present in the diff.

### Ordinary regression gates on the operational PR

The normal repository gates also passed on the workflow-only PR head:

- PREDEPLOY #724: **SUCCESS**;
- Browser Qualification #430: **SUCCESS**.

This is auxiliary evidence; the decisive release-source evidence remains dedicated run `40287512770`, whose application checkout was explicitly frozen to `0ebda922...`.

## 3. PR audit/review evidence

Fresh whole-diff review focused on:

- source-SHA drift or use of PR head as the application under test;
- accidental mergeability as product change;
- fail-open evidence handling;
- contamination of application dependencies by Playwright;
- provider/schema/persistence/config drift;
- missing UX-QA evidence;
- possibility of publication side effects.

Result:

`PASS — 0 blocking findings / 0 unresolved review threads`.

Specific checks:

- application checkout is pinned to exact frozen SHA in both jobs;
- browser toolchain is isolated under `.browser-tools`;
- product lockfile is installed frozen and not rewritten;
- evidence requirement is fail-closed;
- workflow permissions are read-only (`contents: read`);
- no deploy action or cloud credential is present;
- PR #63 is explicitly operational and marked `DO NOT MERGE`;
- review thread inventory: 0 open threads.

ECC automation on PR #63 reported:

- Security Evidence: PASS;
- PR Config Audit: PASS;
- Hosted Promotion Readiness: PASS;
- PR Risk Taxonomy: neutral `Security Evidence + CI/CD Recommendation`, expected for a changed workflow file;
- Reference Set Readiness: neutral generic changed-file report, not a product or release-source finding.

The required security/failure evidence is supplied directly by the successful dedicated exact-source qualification plus the ordinary PREDEPLOY/Browser gates.

## 4. Evidence boundaries preserved

This readiness decision does **not** claim that:

- Browser #428 ran on the merge SHA;
- the current public site already serves `0ebda922...`;
- successful local/exact-source qualification proves successful publication;
- technical qualification authorizes deployment.

Instead:

- Browser #428 remains historical candidate evidence;
- dedicated run `40287512770` is the fresh exact-merge-SHA release-source evidence;
- public/live evidence remains tied to the older release source until a new deployment and A4 live verification occur.

## 5. A3 ruling

`READY FOR HUMAN DEPLOY DECISION`

Frozen publish source:

`0ebda92248b9bb984f2e3e201661292daa47e96d`

Existing target:

`https://registro-docente.ai.studio`

Planned deployment constraints:

- existing publication path only;
- no migration;
- no schema change;
- no provider or authority change;
- no new service/domain/database/authentication system;
- immediate A4 public live verification required after publication;
- any drift from the frozen source invalidates this readiness decision.

## 6. Stop boundary

No deploy or publication is authorized by this audit.

The next action is an explicit human decision on publication of exact source `0ebda922...` to the existing public target. If approved, release execution must re-check the source identity immediately before publish, then run the A4 public live-verification gate.