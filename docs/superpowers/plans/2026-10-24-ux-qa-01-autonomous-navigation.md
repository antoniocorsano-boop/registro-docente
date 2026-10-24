# UX-QA-01 Autonomous Navigation & Usability Qualification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a deterministic UX navigation qualifier that produces agent-readable findings, then use it to correct neutral class entry, relative Back behavior, and teacher-first home hierarchy.

**Architecture:** Reuse the existing Playwright Browser Qualification runner. A canonical JSON navigation contract defines UX invariants; a pure analyzer converts observed browser evidence into P0/P1/P2 findings and a Markdown report. The first browser journey records the current product behavior, intentionally goes RED on existing UX defects, then product changes make the same gate GREEN.

**Tech Stack:** React 19, TypeScript, Bun test, Node/Bun ESM, Playwright 1.64.1, existing secure local vault/browser qualification infrastructure.

**Spec:** `docs/superpowers/specs/2026-10-24-ux-qa-01-autonomous-navigation-design.md`

## Global Constraints

- Baseline is `main@e1aa8f405d8929d3759c9a87abdf2ff79db31128`.
- Browser certification uses a GitHub ephemeral runner on the exact candidate SHA.
- Qualification data is synthetic only.
- Every behavior change requires a causal RED before GREEN.
- No external AI/provider token or recurring-cost dependency.
- No router framework migration.
- No merge or deploy from qualification.
- Existing browser/security gates must not be weakened or removed.

## Review Focus

- A vault snapshot that persists a non-null `currentClassId` must still reopen at neutral Home with no active class.
- Browser Back after a class tab change must preserve the class while restoring the prior class view; the next Back must clear class context at Home.
- Global views opened from Home (`Biblioteca`, `Programmazione`) must Back to Home without inventing class context.
- Empty-class and one-class registers must keep the new Home usable and must not rely on comparison data being present.
- Mobile 390×844 must keep primary controls ≥44px and avoid horizontal overflow in every audited node.

---

### Task 1: Navigation contract and deterministic analyzer

**Files:**
- Create: `ux/qa/navigation-contract.v1.json`
- Create: `scripts/ux-qa/analyzer.mjs`
- Create: `scripts/ux-qa/analyze.mjs`
- Create: `src/security/uxQa01AnalyzerContract.test.ts`

**Interfaces:**
- Produces: `analyzeUxEvidence(contract, evidence) -> { findings, blockingFindings, result }` exported by `scripts/ux-qa/analyzer.mjs`.
- Produces: CLI `scripts/ux-qa/analyze.mjs <evidence-json> <contract-json> <output-dir>`; exit 1 on any P0/P1 finding, exit 0 otherwise.
- Contract IDs: `UXNAV-001` through `UXNAV-009` with severities fixed by the spec.

- [ ] **Step 1: Write a failing file-surface test**

Create `src/security/uxQa01AnalyzerContract.test.ts` asserting with `existsSync` that all three UX-QA files exist and that the contract contains IDs `UXNAV-001`…`UXNAV-009`.

- [ ] **Step 2: Run the new test and verify RED**

Run: `bun test src/security/uxQa01AnalyzerContract.test.ts`

Expected: FAIL because the contract/analyzer files do not exist.

- [ ] **Step 3: Add the minimal contract and analyzer module surfaces**

`navigation-contract.v1.json` must contain schema `registro.ux-qa-navigation/v1`, viewports `390x844` and `1280x900`, and all nine invariant IDs/severities/messages from the spec.

`analyzer.mjs` initially exports `analyzeUxEvidence`.

`analyze.mjs` initially imports that function and parses its three positional paths.

- [ ] **Step 4: Re-run the surface test**

Run: `bun test src/security/uxQa01AnalyzerContract.test.ts`

Expected: PASS for file/contract surface assertions.

- [ ] **Step 5: Extend the test with failing analyzer behavior**

Use synthetic evidence with one PASS, one P0 FAIL and one P2 FAIL. Assert:
- result is `FAIL`;
- the P0 is in `blockingFindings`;
- the P2 is present in `findings` but absent from `blockingFindings`;
- a fully passing evidence set returns `PASS`.

- [ ] **Step 6: Run and verify analyzer RED**

Run: `bun test src/security/uxQa01AnalyzerContract.test.ts`

Expected: FAIL because the analyzer does not yet implement severity/blocking evaluation.

- [ ] **Step 7: Implement minimal deterministic analysis**

`analyzeUxEvidence(contract, evidence)` maps evidence observations by invariant ID, emits a finding for every non-PASS observation, treats P0/P1 as blocking, and returns `PASS` only when blocking findings are empty.

CLI writes `ux-qa-01-report.json` plus a P0→P1→P2 ordered `ux-qa-01-report.md` and exits according to the analyzer result.

- [ ] **Step 8: Verify GREEN and full security suite**

Run: `bun test src/security/uxQa01AnalyzerContract.test.ts && bun run test:security`

Expected: both commands PASS with zero failures.

- [ ] **Step 9: Commit Task 1**

Commit message: `feat: add deterministic UX-QA analyzer`

---

### Task 2: Real-browser explorer and causal UX RED

**Files:**
- Create: `tests/browser/ux-qa-01-navigation.spec.cjs`
- Modify: `.github/workflows/browser-qualification.yml`

**Interfaces:**
- Consumes Task 1 contract/analyzer.
- Produces: `browser-evidence/ux-qa-01-evidence.json` and screenshots for Home, class dashboard, class evaluations, Library, and Planning.
- Evidence observations use `{ id, status, node, expected, observed, evidence }`.

- [ ] **Step 1: Add the browser explorer without changing product code**

The spec must:
- create a fresh synthetic vault;
- create a synthetic class through the UI so `currentClassId` is durably stored;
- reload/unlock and observe whether a class is implicitly active;
- observe whether class-only mobile navigation is present on neutral Home;
- record default Home view and whether KPI/comparison precede class cards;
- choose the synthetic class, navigate `Riepilogo → Valutazioni`, then use browser Back twice and record destinations/context;
- navigate `Home → Biblioteca → Back → Home → Programmazione → Back → Home`;
- repeat the core Home/class checks at 390×844, including overflow and 44px controls;
- capture `pageerror` through the last screenshot/evidence operation.

The spec records evidence but does not weaken existing product assertions.

- [ ] **Step 2: Register explorer and analyzer in Browser Qualification**

Copy/run `ux-qa-01-navigation.spec.cjs` with the existing specs, then execute:

`bun scripts/ux-qa/analyze.mjs browser-evidence/ux-qa-01-evidence.json ux/qa/navigation-contract.v1.json browser-evidence`

Analyzer runs before artifact upload.

- [ ] **Step 3: Push test-only head and verify causal RED**

Expected Browser Qualification: FAIL only at UX-QA analysis because at least `UXNAV-001`, `UXNAV-004`, `UXNAV-005`, `UXNAV-006` are violated by current product behavior; Playwright journey itself must reach evidence capture and existing browser suites remain intact.

Expected PREDEPLOY: PASS because product code is unchanged.

- [ ] **Step 4: Record RED evidence in the PR body/ledger**

Record exact SHA, workflow/run IDs, pass/fail counts, and exact failing invariant IDs. If failure occurs earlier (bootstrap/build/fixture), diagnose and fix the test harness before touching product code.

- [ ] **Step 5: Commit Task 2**

Commit message: `test: add autonomous UX navigation qualification`

---

### Task 3: Navigation-state separation and teacher-first Home

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/Navbar.tsx`
- Modify: `src/components/HomeView.tsx`
- Modify only if legacy source-contract expectations require semantic update: `src/security/p2NavigationVocabularyIntegrity.test.ts`

**Interfaces:**
- Consumes Task 2 invariants unchanged.
- Produces: neutral bootstrap; history-aware user tab navigation; Home modes `classes | summary | comparison` with `classes` default.

- [ ] **Step 1: Make bootstrap navigation neutral**

When loading persisted `AppData`, preserve classes/students/grades/behaviors but initialize visible `currentClassId` to `null`. Do not migrate or delete persisted schema fields.

- [ ] **Step 2: Make user tab navigation history-aware**

Add an App-level user navigation callback that sets `activeTab` and pushes `{ classId, tab }` into `history` with a stable query string. Pass this callback to `Navbar`; keep `popstate` and internal post-save transitions state-only so browser Back is not polluted by automatic operations.

- [ ] **Step 3: Keep class selection/Home transitions explicit**

`handleSelectClass` remains the explicit class-context entry and pushes `class.dashboard`. `handleNavigateHome` clears class context and pushes neutral Home. Back handling must restore the state in history without creating new history entries.

- [ ] **Step 4: Rebuild Home hierarchy with local view state**

`HomeView` owns `activeView: 'classes' | 'summary' | 'comparison'`, default `classes`.

Header always contains `Le mie classi`, `Nuova Classe`, and three ≥44px view controls:
- `Classi`;
- `Sintesi`;
- `Confronto`.

`Classi` renders compact cards first. Each card is fully openable, uses a stable categorical accent from a fixed non-red/non-green palette, and shows only class name, student count, and class average in the primary surface. Destructive delete remains secondary.

`Sintesi` renders the four institute KPI plus encrypted-backup status/action.

`Confronto` renders the existing comparison table.

- [ ] **Step 5: Run security/typecheck tests**

Run: `bun run lint && bun run test:security`

Expected: PASS. If a legacy source-contract test fails only because it requires old simultaneous Home content, update that assertion to the approved progressive-disclosure vocabulary without weakening unrelated checks.

- [ ] **Step 6: Run Browser Qualification on the same exact candidate**

Expected: existing browser suites PASS and UX-QA analyzer reports PASS for `UXNAV-001`…`UXNAV-009`.

- [ ] **Step 7: Verify PREDEPLOY on the same exact candidate**

Expected: frozen install, typecheck, security suite, production build, and startup smoke PASS.

- [ ] **Step 8: Final diff/review**

Confirm no provider, persistence migration, auth/privacy boundary, deployment workflow, or unrelated domain file changed. Review the UX-QA report as the agent-review package and record any P2 as deferred rather than silently fixing it.

- [ ] **Step 9: Commit Task 3**

Commit message: `feat: make navigation explicit and home teacher-first`

---

## Completion

Final candidate is ready for human integration decision only when Browser Qualification and PREDEPLOY are both green on the exact same SHA and UX-QA artifacts include evidence + Markdown/JSON report. No merge or deploy is authorized by this plan.
