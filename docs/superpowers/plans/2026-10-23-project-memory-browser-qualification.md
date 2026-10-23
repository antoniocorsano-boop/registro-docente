# MEM-QUAL-01 Project Memory + Browser Qualification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Materializzare una memoria operativa canonica nel repository e aggiungere un browser gate riproducibile su GitHub Actions legato all'exact candidate SHA.

**Architecture:** `AGENTS.md` instrada ogni agente verso `docs/memory/`; la memoria distingue regole, decisioni, ricette e lesson learned. Un workflow separato costruisce l'app con il lockfile esistente, avvia il server di produzione su runner effimero e usa una toolchain Playwright esatta e isolata per verificare il candidate SHA reale.

**Tech Stack:** Markdown, GitHub Actions, Bun, Express/Vite production build, Playwright Test 1.64.1, Chromium.

**Spec:** `docs/superpowers/specs/2026-10-23-project-memory-browser-qualification-design.md`

## Global Constraints
- Nessun merge, deploy o pubblicazione automatica.
- Nessuna modifica al comportamento applicativo o ai dati canonici.
- Dipendenze applicative installate con `bun install --frozen-lockfile`.
- Playwright `1.64.1` installato separatamente e con versione esatta.
- Browser qualification sempre sull'exact candidate SHA.
- Nessun dato studente reale, credenziale o secret nel gate.
- Lesson learned obbligatorie solo per cicli con apprendimento riutilizzabile, non per micro-fix ordinari.

## Review Focus
- PR checkout che finisce sul merge ref invece che sull'head SHA: il gate deve fallire per mismatch.
- Browser toolchain che modifica il lockfile o il grafo applicativo: deve restare isolata.
- Server non pronto o terminato prematuramente: il workflow deve fallire prima del falso PASS browser.
- Errori JavaScript non gestiti nella pagina: il browser smoke deve fallire e conservare evidenza.
- Memoria che diventa accumulo passivo: `AGENTS.md` deve imporre lettura e il protocollo deve distinguere promozione/stato/sostituzione.

---

### Task 1: Canonical Project Memory Protocol

**Files:**
- Create: `AGENTS.md`
- Create: `docs/memory/README.md`
- Create: `docs/memory/OPERATING_RULES.md`
- Create: `docs/memory/TOOL_RECIPES.md`
- Create: `docs/memory/LESSONS_LEARNED.md`
- Create: `docs/memory/DECISIONS.md`

**Interfaces:**
- Consumes: design contract in the spec.
- Produces: canonical memory entrypoint and Memory Capsule schema consumed by future agents.

- [ ] **Step 1: Confirm RED structural baseline**

Verify on base `023a6a036c4a43b71fcd408f6ecda1d92bf7a787` that `AGENTS.md` and `docs/memory/` do not exist.

Expected: both are absent.

- [ ] **Step 2: Create `AGENTS.md`**

Require significant cycles to read `docs/memory/README.md` before work, preserve exact-SHA/evidence discipline, and append/promote memory only when the cycle produces reusable knowledge.

- [ ] **Step 3: Create memory index and stable ledgers**

`README.md` defines read/write protocol and promotion semantics; the four ledgers separate stable rules, tool recipes, episodic lessons and durable decisions.

- [ ] **Step 4: Seed the first lesson learned and operating rules**

Record the browser-sandbox lesson from the spec and stable rules for exact candidate SHA, RED→GREEN evidence, no false PASS, no auto-merge/deploy and synthetic-only qualification data.

- [ ] **Step 5: Verify structure**

Fetch/read all six files and confirm cross-links, statuses and capsule fields match the spec.

Expected: no missing file or conflicting rule.

- [ ] **Step 6: Commit**

```bash
git add AGENTS.md docs/memory
git commit -m "docs: add canonical project memory protocol"
```

### Task 2: Stable Browser Qualification Contract

**Files:**
- Create: `tests/browser/browser-qualification.spec.cjs`
- Create: `.github/workflows/browser-qualification.yml`

**Interfaces:**
- Consumes: production runtime from `server.ts`, current `bun.lock`, exact candidate SHA from GitHub event context.
- Produces: a required browser qualification signal plus diagnostic artifacts.

- [ ] **Step 1: Write the browser smoke test first**

Create `tests/browser/browser-qualification.spec.cjs` using `@playwright/test` with assertions for HTTP 200, title `/Registro Docente/i`, visible/non-empty `#root`, zero uncaught `pageerror`, screenshot evidence and JSON evidence containing `CANDIDATE_SHA`.

- [ ] **Step 2: Establish RED for the missing runner contract**

Before creating the workflow, confirm there is no repository path capable of executing the new smoke test in CI.

Expected: `.github/workflows/browser-qualification.yml` absent; smoke test cannot yet become a canonical gate.

- [ ] **Step 3: Create the workflow**

Create `.github/workflows/browser-qualification.yml` with:
- `pull_request` to `main` and `workflow_dispatch`;
- `contents: read` only;
- `ubuntu-22.04` and bounded timeout;
- `CANDIDATE_SHA = pull_request.head.sha || github.sha`;
- checkout with explicit `ref: ${{ env.CANDIDATE_SHA }}`;
- exact SHA verification;
- Bun setup + `bun install --frozen-lockfile` + `bun run build`;
- isolated `.browser-tools` package with exact `@playwright/test@1.64.1`;
- Chromium install;
- production server on port 4173 and HTTP readiness loop;
- copied smoke test executed from `.browser-tools`;
- artifact upload with `if: always()` for screenshot/JSON/server log/Playwright results.

- [ ] **Step 4: Verify workflow semantics**

Inspect the committed YAML and test file for candidate SHA binding, frozen app dependencies, isolated browser toolchain and fail-closed steps.

Expected: no `continue-on-error` on qualification steps and no secret/data dependency.

- [ ] **Step 5: Commit**

```bash
git add tests/browser/browser-qualification.spec.cjs .github/workflows/browser-qualification.yml
git commit -m "ci: add exact-sha browser qualification"
```

### Task 3: PR Qualification and Memory Closure

**Files:**
- Modify: `docs/memory/LESSONS_LEARNED.md` only if the first real run reveals new reusable knowledge.
- Modify: `docs/memory/TOOL_RECIPES.md` only if the executed recipe differs materially from the designed one.

**Interfaces:**
- Consumes: Task 1 memory protocol and Task 2 Browser Qualification.
- Produces: exact-head qualification evidence and a review-ready PR; no merge.

- [ ] **Step 1: Open a Draft PR to `main`**

Body must state baseline SHA, scope, no behavior/data changes, browser gate contract and no auto-merge/deploy.

- [ ] **Step 2: Observe Browser Qualification on the exact PR head**

Expected: checkout verification PASS, build PASS, production readiness PASS, Playwright Chromium smoke PASS, artifact upload attempted.

- [ ] **Step 3: Observe existing PREDEPLOY on the same exact PR head**

Expected: existing qualification remains GREEN.

- [ ] **Step 4: Inspect any failure causally**

If either gate fails, fix only the demonstrated cause; do not weaken assertions or convert failures to warnings.

- [ ] **Step 5: Close the learning loop**

If the real run changes the reusable recipe or uncovers a new causal lesson, append a Memory Capsule and promote only the stable rule warranted by evidence.

- [ ] **Step 6: Whole-branch review**

Review the final diff for scope, workflow security, exact-SHA correctness, artifact hygiene and consistency between `AGENTS.md`, memory docs, spec and workflow.

Expected: zero unresolved Critical/Important findings before human decision.

- [ ] **Step 7: Stop at human decision**

Report exact head, PR state, workflow run IDs/results, any Memory Capsule added, and leave PR unmerged.

## Self-review
- Spec coverage: all goals map to Tasks 1–3; non-goals remain excluded.
- Shared interfaces: Task 3 consumes both prior tasks; names and paths are consistent.
- Review Focus: every listed risk is exercised by either workflow semantics, browser assertions or final review.
- Proportion: plan specifies decisions and gates without embedding application implementation code.
