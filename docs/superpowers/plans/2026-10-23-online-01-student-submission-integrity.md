# ONLINE-01 Student Submission Integrity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make StudentPortal success truthful to durable persistence and derive class choices from current register data.

**Architecture:** Keep `App.handleSaveStudentSubmission(...)` as the only durable persistence authority. Change `StudentPortal` only at the transient UI boundary: pass class names from `App`, await the existing Promise before result/confetti, preserve a stable pending submission for retry, and guard duplicate final submits.

**Tech Stack:** React 19, TypeScript, Bun tests, existing PERSIST-01 durable mutation coordinator, GitHub Actions PREDEPLOY, Playwright canonical browser qualification.

**Spec:** `docs/superpowers/specs/2026-10-23-online-01-student-submission-integrity-design.md`

## Global Constraints

- Exact baseline: `main@6ad2fa9974df364a4fcd309c0ff9b25bbcbaa4c3`.
- No Vault/schema/crypto/mutation-coordinator changes.
- No grading/UDA/Analytics/import behavior changes.
- No hard-coded StudentPortal class fallback.
- Success and confetti only after durable Promise resolution.
- Failure preserves retryable quiz state.
- Duplicate final submissions are blocked while pending.
- Qualification data is synthetic only.
- No automatic merge or deploy.

## Review Focus

1. Double-click/repeated final submit while save is pending → one durable save attempt only.
2. Save rejection after completed quiz → no success/result state and retry remains possible.
3. Retry after rejection → same submission id is reused until success.
4. URL class absent from current register → first actual class is selected, never a fabricated class.
5. Empty class list → quiz cannot start with an invalid class.

---

### Task 1: Pin the StudentPortal integrity contract RED

**Files:**
- Create: `src/security/online01StudentPortalIntegrity.test.ts`
- Test: `src/security/online01StudentPortalIntegrity.test.ts`

**Interfaces:**
- Consumes: current `src/components/StudentPortal.tsx` and `src/App.tsx` source.
- Produces: executable contract for commit-first result timing, reentrancy, retry identity, and dynamic classes.

- [ ] **Step 1: Write the failing tests**

Pin these source-level invariants:
- `StudentPortalProps` contains `classNames: string[]`.
- no hard-coded `<option value="3ª ...">` class list remains.
- portal has an immediate reentrancy guard/ref for final submission.
- portal awaits `onSaveSubmission(submission)` before `setStep('result')` and before confetti.
- failure path preserves quiz state and exposes retry copy.
- pending submission identity is retained across retry and cleared after success/new quiz.
- `App` passes `classNames={appData.classes.map(c => c.name)}`.

- [ ] **Step 2: Run the dedicated test and verify causal RED**

Run: `bun test src/security/online01StudentPortalIntegrity.test.ts`

Expected: FAIL only on the new ONLINE-01 assertions because current portal is optimistic and hard-coded.

- [ ] **Step 3: Commit test-only RED**

Commit message: `test: pin ONLINE-01 student submission integrity`

---

### Task 2: Implement commit-first StudentPortal behavior

**Files:**
- Modify: `src/components/StudentPortal.tsx`
- Modify: `src/App.tsx`
- Test: `src/security/online01StudentPortalIntegrity.test.ts`

**Interfaces:**
- Consumes: `onSaveSubmission(submission: OnlineSubmission): Promise<void>`.
- Produces: `StudentPortalProps.classNames: string[]` and commit-first final submission UX.

- [ ] **Step 1: Add classNames and derived initial class**

`StudentPortalProps` gains `classNames: string[]`. Resolve initial class as `defaultClassName` only when contained in `classNames`, else first class, else empty string. Render only supplied class names.

- [ ] **Step 2: Add pending/retry state**

Add transient state/ref sufficient to enforce one in-flight save, retain one pending `OnlineSubmission` across retry, and show a retry error without moving to result.

- [ ] **Step 3: Make final submit await persistence**

On the final question, build/reuse the pending submission, await `onSaveSubmission`, and move to result + confetti only after success. On rejection, remain in quiz and preserve score/answers.

- [ ] **Step 4: Handle empty classes and new-quiz reset**

Disable start with no valid class; show teacher-actionable copy. Starting a new quiz clears prior retry/error state.

- [ ] **Step 5: Wire App classes**

Pass `classNames={appData.classes.map(c => c.name)}` to `StudentPortal`; do not modify persistence behavior.

- [ ] **Step 6: Run dedicated test to GREEN**

Run: `bun test src/security/online01StudentPortalIntegrity.test.ts`

Expected: PASS.

- [ ] **Step 7: Run full suite**

Run: `bun test src/security/*.test.ts`

Expected: all tests PASS.

- [ ] **Step 8: Commit product GREEN**

Commit message: `fix: make student submissions commit-first`

---

### Task 3: Exact-head engineering qualification

**Files:**
- No product changes expected.

**Interfaces:**
- Consumes: Task 2 exact candidate.
- Produces: PREDEPLOY exact-head evidence.

- [ ] **Step 1: Open Draft PR against main**

Record baseline, RED SHA, GREEN SHA, invariants and no-merge/no-deploy boundary.

- [ ] **Step 2: Verify PREDEPLOY on exact head**

Require frozen dependencies, full security tests, typecheck, production build and startup smoke all PASS.

- [ ] **Step 3: If any gate fails, diagnose causally**

Do not change assertions or candidate merely to obtain green.

---

### Task 4: Canonical browser failure-injection qualification

**Files:**
- Create/modify browser harness only on the feature branch if required; keep it in the PR only if it is a reusable regression asset.

**Interfaces:**
- Consumes: exact GREEN candidate from Task 3.
- Produces: browser evidence for mobile and desktop using synthetic data only.

- [ ] **Step 1: Exercise successful submission**

Verify result/success copy and confetti-triggering transition occur only after the durable save resolves; submission appears once.

- [ ] **Step 2: Exercise pending/reentrancy**

Delay save, trigger repeated final-submit attempts, verify one save attempt and no result state while pending.

- [ ] **Step 3: Exercise failure + retry**

Reject first save, verify quiz state and answer/score remain, no success copy appears, retry action remains available, then resolve retry and verify one committed submission using the same submission id.

- [ ] **Step 4: Exercise class derivation**

Use synthetic register classes not matching the old hard-coded list; verify selector contains only actual register classes and invalid URL class falls back to the first actual class.

- [ ] **Step 5: Validate mobile/desktop and evidence**

Run at least mobile `390x844` and desktop `1280x800`, zero horizontal overflow, zero console errors/page errors, screenshots + JSON artifact, exact candidate SHA verified.

---

### Task 5: Final review and human integration gate

**Files:**
- Update PR receipt only if needed.
- Update `docs/memory/LESSONS_LEARNED.md` only if a reusable new lesson emerges.

**Interfaces:**
- Consumes: engineering + browser qualified exact head.
- Produces: human merge decision package.

- [ ] **Step 1: Request fresh independent review on exact head**

Focus: false-success windows, duplicate submission risk, retry identity, dynamic class selection, unintended persistence/model changes.

- [ ] **Step 2: Resolve significant findings with RED → GREEN**

No unresolved significant findings may remain.

- [ ] **Step 3: Present final state for human decision**

Expected state: `ENGINEERING QUALIFIED / BROWSER QUALIFIED / INDEPENDENT REVIEW PASS / HUMAN INTEGRATION DECISION PENDING`.

- [ ] **Step 4: Do not merge or deploy without the separate human decision**
