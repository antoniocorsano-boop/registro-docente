# FLOW-02 Conduct Copilot Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Copilot opened from `Conduci` use in-lesson language and fail-closed conduct guidance without exposing preparation-oriented entry choices or adding new generative authority.

**Architecture:** Add a presentation-only `isConductLaunch` branch inside the existing `LibraryCopilotComposer`, while preserving the current agent-intent router and direct-action allowlist. Conduct submissions bypass the generic teacher-first framing gate but still use the existing explicit agent-routing path; unsupported capabilities remain unsupported with conduct-specific copy.

**Tech Stack:** React, TypeScript, Bun source contracts, existing agent-intent routing, Playwright Chromium.

**Spec:** `docs/superpowers/specs/2026-11-02-flow-02-conduci-copilot-rework-design.md`

## Global Constraints

- Rework baseline: `ad34a030e800fa7cd604ead5c04a5c9b18906a34`.
- PR #109 remains Draft until Human Product/UX PASS.
- No new `ANSWER`, `SIMPLIFY`, `ADAPT` execution capability.
- No new provider call, persistence key or professional mutation.
- `conduct` remains metadata-only; direct actions remain allowlisted to `prepare`, `review`, `link`.
- No rapid-note content reaches Copilot.
- Generic Biblioteca/Prepara/Review/Link behavior remains unchanged.
- Mobile 390×844 remains the primary FLOW-02 product evidence.

## Review Focus

- Class-only `conduct` launch must not fall back to `contesto UDA non univoco`; covered by Task 1.
- Conduct entry must not expose the four preparation/source-work goals; covered by Tasks 1 and 3.
- Conduct submission without source/UDA must not invoke generic teacher-first framing; covered by Task 2.
- Unsupported in-lesson request must remain fail-closed without pretending a generated answer exists; covered by Task 2.
- Non-conduct Library Copilot entry must retain its existing goal grid and copy; covered by Task 2 regression assertions.

---

### Task 1: Conduct-specific UX contract

**Files:**
- Create: `src/security/flow02ConductCopilotUxContract.test.ts`

**Interfaces:**
- Consumes: `LibraryCopilotComposer.tsx` source and `LibraryLaunchIntent` contract.
- Produces: executable copy/presentation contract for the `conduct` entry.

- [ ] **Step 1: Write failing source contract**

Assert that the composer contains:
- `const isConductLaunch = directLaunchIntent === 'conduct';`
- heading `Supporto durante la lezione`;
- copy `La classe è già impostata. Descrivi ciò che ti serve adesso; il Copilota userà solo il contesto professionale già disponibile.`;
- textarea label `Che cosa ti serve adesso?` and the approved placeholder;
- a conduct branch that does not render the generic four-goal grid;
- conduct context label without `contesto UDA non univoco`.

- [ ] **Step 2: Run focused contract and verify RED**

Run: `bun test src/security/flow02ConductCopilotUxContract.test.ts`

Expected: FAIL because the conduct-specific presentation branch is absent.

- [ ] **Step 3: Commit the RED contract**

Commit message: `test: define FLOW-02 conduct Copilot UX rework`

---

### Task 2: Minimal conduct presentation and fail-closed routing

**Files:**
- Modify: `src/components/LibraryCopilotComposer.tsx`
- Modify: `src/security/flow02ConductCopilotUxContract.test.ts`
- Verify: `src/security/flow02AppIntegrationContract.test.ts`
- Verify: `src/security/a4R1TeacherFirstComposerContract.test.ts`
- Verify: `src/security/librarySingleCopilotSurfaceContract.test.ts`

**Interfaces:**
- Consumes: `launchRequest.context.intent`, existing `handleResolve`, `resolveObjective`, `routeAgentIntent` result kinds.
- Produces: conduct-specific copy and submission path; no new external API.

- [ ] **Step 1: Implement `isConductLaunch` presentation branch**

Keep generic entry unchanged for non-conduct launches. For conduct launches use the exact copy from the spec and hide the four-goal grid.

- [ ] **Step 2: Route conduct submissions through `resolveObjective()`**

In `handleResolve`, bypass `frameTeacherFirstObjective()` when `isConductLaunch` is true. Do not alter non-conduct routing.

- [ ] **Step 3: Add conduct-specific `SOURCE_REQUIRED` and `UNSUPPORTED` guidance**

Use the exact strings from the spec only when `isConductLaunch`; preserve generic messages otherwise.

- [ ] **Step 4: Run focused and regression contracts**

Run:
`bun test src/security/flow02ConductCopilotUxContract.test.ts src/security/flow02AppIntegrationContract.test.ts src/security/a4R1TeacherFirstComposerContract.test.ts src/security/librarySingleCopilotSurfaceContract.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `fix: contextualize Copilot for FLOW-02 conduct`

---

### Task 3: Browser evidence, invariant coverage and final gates

**Files:**
- Modify: `tests/browser/flow-02-conduci.spec.cjs`
- Modify: `qualification/invariants.v1.json`
- Modify: `src/security/flow02QualificationContract.test.ts`

**Interfaces:**
- Consumes: Task 2 conduct-specific UI.
- Produces: exact-SHA browser evidence and invariant coverage for the new UX contract.

- [ ] **Step 1: Extend FLOW-02 Chromium assertions**

When the Copilot opens from `Conduci`, assert:
- `Supporto durante la lezione` visible;
- class remains visible;
- `Preparare un’attività`, `Lavorare su un materiale`, `Collegare a una UDA`, `Rivedere qualcosa` are absent;
- `contesto UDA non univoco` is absent;
- rapid-note text remains absent.

- [ ] **Step 2: Register the new source contract under `FLOW-02-I01`**

Add `src/security/flow02ConductCopilotUxContract.test.ts` to both `impactPaths` and `tests`, and extend `flow02QualificationContract.test.ts` accordingly.

- [ ] **Step 3: Run focused qualification contract**

Run: `bun test src/security/flow02QualificationContract.test.ts src/security/flow02ConductCopilotUxContract.test.ts`

Expected: PASS.

- [ ] **Step 4: Run fresh exact-SHA canonical qualification**

Require all on the same final SHA:
- Qualification Invariants — PASS;
- PREDEPLOY Security Qualification — PASS;
- Browser Qualification — PASS, including FLOW-02 mobile 390×844 and historical regression.

- [ ] **Step 5: Inspect final FLOW-02 mobile Copilot evidence**

Verify the conduct-specific heading/copy, no preparation grid, class continuity and no rapid-note leakage.

- [ ] **Step 6: Final Independent Re-review**

Require `0 Critical / 0 Important` before returning to Human Product/UX Review.

- [ ] **Step 7: Update PR #109 body**

State the final exact SHA, fresh run IDs, evidence digest and status:
`ENGINEERING QUALIFIED / FINAL INDEPENDENT REVIEW PASS / HUMAN PRODUCT-UX REVIEW PENDING / DRAFT / NO MERGE / NO DEPLOY`.
