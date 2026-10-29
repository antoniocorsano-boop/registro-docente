# A4-R1 Teacher-first Copilot Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current source-first Copilot entry experience with a teacher-first flow that starts from the teacher's goal, resolves teaching context deterministically, reveals source/material controls only when needed, and preserves all AIC-07 authority/privacy/persistence boundaries.

**Architecture:** Add a small pure local request-framing module that interprets only bounded, deterministic teacher-language cues and never performs remote inference. `LibraryCopilotComposer` becomes a goal-first state machine for ordinary conversation launches while preserving existing mission-launch/review paths. `CopilotDeck` and `VaultControls` receive targeted mobile presentation repairs; AIC-07 mission execution, grant, fingerprint, remote consent, Core authority and durable-write semantics remain unchanged.

**Tech Stack:** React 19, TypeScript, Bun tests, Playwright/Chromium browser qualification, Tailwind utility classes.

**Spec:** `docs/superpowers/specs/2026-10-28-a4-r1-teacher-first-copilot-repair-design.md`

## Global Constraints

- Baseline authority remains `main@dea3b3e7a2cbd5ec920b7ec30f34ed23f45142f8` plus only the approved A4-R1 docs commits.
- No generative AI starts before explicit teacher Play in the AIC-07 mission path.
- No remote intent/provider work is introduced before Play by this repair.
- No arbitrary class or UDA choice when multiple valid targets exist.
- No multi-class mission authority is introduced.
- AIC-07 15-minute execution grant, mission fingerprint, scope checks, stale-context handling, resume/archive semantics and persistent-write authority remain unchanged.
- Existing REVIEW/LINK/PREPARE Core authority and remote-consent semantics remain authoritative.
- AIC-08/AIC-09 capabilities remain out of scope.
- No merge or publication is part of this implementation plan.

## Review Focus

1. Natural phrase `Attività per le classi prime` with both `1A` and `1C` must yield explicit class disambiguation, never arbitrary selection.
2. Unknown/unsupported teacher wording must produce a short teacher-facing clarification, never `NO_INTENT_MATCH` taxonomy copy.
3. Existing AIC-07 mission launch with bound source/class/UDA must bypass the new front-door framing and preserve grant/fingerprint authorization unchanged.
4. Closing/reopening the ordinary Copilot must not retain stale teacher-first selections or remote consent.
5. Mobile overlays must not show a duplicate Copilot FAB or a wide `Mai / Blocca` toolbar over the active Copilot surface.

---

### Task 1: Deterministic teacher-first request framing

**Files:**
- Create: `src/copilot/teacherFirstRequest.ts`
- Create: `src/security/a4R1TeacherFirstRequest.test.ts`

**Interfaces:**
- Produces `TeacherFirstGoalKind = 'prepare' | 'review' | 'link' | 'material' | 'unknown'`.
- Produces `resolveTeacherFirstRequest(message: string, classNames: string[]): TeacherFirstRequestResolution` with normalized goal, matching class candidates, and clarification reason.
- No network, provider, persistence or Core dispatch imports are permitted.

- [ ] **Step 1: Write failing tests** for: exact real phrase -> `prepare` + `['1A','1C']`; explicit `3E` -> one candidate; unknown wording -> `unknown`; duplicate class labels collapse; no candidate -> no arbitrary fallback.
- [ ] **Step 2: Run `bun test src/security/a4R1TeacherFirstRequest.test.ts`** and verify RED because module/interface does not yet exist.
- [ ] **Step 3: Implement minimal pure resolver** using normalized text, explicit class-token matching and bounded grade-word cues (`prime`, `seconde`, `terze`). Goal cues remain intentionally small and deterministic.
- [ ] **Step 4: Re-run focused test and `bun run test:security`; both must PASS.**
- [ ] **Step 5: Commit** `feat(a4-r1): add teacher-first local request framing`.

### Task 2: Goal-first Composer orchestration and progressive disclosure

**Files:**
- Modify: `src/components/LibraryCopilotComposer.tsx`
- Modify: `src/security/a4R1TeacherFirstRequest.test.ts`
- Create: `src/security/a4R1TeacherFirstComposerContract.test.ts`

**Interfaces:**
- Consumes `resolveTeacherFirstRequest()` from Task 1.
- Ordinary conversation launch starts from teacher goal/message and quick actions.
- Mission launches / ready mission review continue to use current source/context-bound path without weakening `CopilotMissionBridge` or `assertMissionRuntimeExecutionAuthorized`.

- [ ] **Step 1: Write causal contract RED** asserting ordinary Composer initially exposes `Cosa vuoi fare?`, quick goals, and teacher message before source/context controls; source/new-source/memory controls are hidden behind explicit material/context progression; legacy `NO_INTENT_MATCH` teacher copy is absent from ordinary front-door UI.
- [ ] **Step 2: Add a browser RED** `tests/browser/a4-r1-teacher-first.spec.cjs` for the authentic mobile phrase: open Copilot -> enter `Attività per le classi prime` -> see `1A` and `1C` choices -> no remote-generated result and no class auto-selection.
- [ ] **Step 3: Run focused security test via PREDEPLOY/branch CI and confirm causal RED before product changes.**
- [ ] **Step 4: Implement minimal Composer state machine**: goal framing -> class disambiguation -> UDA/context choice -> source/material disclosure only when required -> local bounded preview -> explicit `▶ Continua`/Play gate into existing governed PREPARE/REVIEW/LINK surface. For explicit quick-goal paths do not call `interpretCopilotIntent`; use existing local/Core authority paths. Preserve current agent-first route only for legacy/mission-compatible flows that already require it.
- [ ] **Step 5: Reset teacher-first transient state on close/reopen/context invalidation; do not persist consent.**
- [ ] **Step 6: Run focused security test, `bun run test:security`, `bun run test:library`, typecheck/build; all PASS.**
- [ ] **Step 7: Commit** `feat(a4-r1): make Copilot entry teacher-first`.

### Task 3: Compact proactive empty state and mobile control hygiene

**Files:**
- Modify: `src/components/CopilotDeck.tsx`
- Modify: `src/components/VaultControls.tsx`
- Create: `src/security/a4R1TeacherFirstMobileContract.test.ts`

**Interfaces:**
- Copilot Deck keeps all AIC-07 opportunity/mission actions unchanged.
- Empty opportunities collapse to one useful state instead of three repeated empty groups.
- Deck trigger is not rendered while Deck itself is open.
- Mobile Vault controls become compact; direct `Blocca Registro` remains one interaction away and auto-lock configuration remains available without a persistent wide toolbar.

- [ ] **Step 1: Write RED contract** for one compact no-opportunity message, no repeated `Nessuna opportunità forte` groups, hidden Deck trigger while open, and compact mobile security affordance.
- [ ] **Step 2: Run focused test and confirm causal RED.**
- [ ] **Step 3: Implement minimal Deck empty-state collapse** while leaving non-empty `Qui/Oggi/Più tardi` grouping and mission cards unchanged.
- [ ] **Step 4: Implement compact mobile Vault control** (small lock/security trigger + disclosure for auto-lock) while desktop contract remains unchanged and direct lock remains available.
- [ ] **Step 5: Re-run focused test plus security suite; PASS.**
- [ ] **Step 6: Commit** `fix(a4-r1): clean Copilot mobile overlays`.

### Task 4: Authentic browser journeys and exact-SHA qualification

**Files:**
- Modify/Create: `tests/browser/a4-r1-teacher-first.spec.cjs`
- Modify only if required by stable selectors: relevant browser fixture/helpers.

**Interfaces:**
- Exercises Task 1-3 behavior without adding new product capability.
- Existing AIC-07 browser journeys remain mandatory regression coverage.

- [ ] **Step 1: Complete browser journey assertions** for: real first-class phrase/disambiguation; goal -> context -> material progressive disclosure; compact no-opportunity state; no duplicate FAB during active surface; mission-launch path still reaches current AIC-07 preview/Play/result behavior.
- [ ] **Step 2: Run Browser Qualification on exact branch SHA.** Expected: new A4-R1 journey PASS, AIC-07 dedicated journey PASS, historical Chromium PASS, UX-QA-01/02 PASS with 0 blocking findings.
- [ ] **Step 3: Run fresh PREDEPLOY on same exact SHA.** Expected: security/library/typecheck/build/startup smoke PASS.
- [ ] **Step 4: Perform whole-branch review focused on AIC-07 boundary preservation and mobile teacher utility; any Critical/Important finding gets one RED→GREEN repair pass.
- [ ] **Step 5: Record exact SHA + workflow/artifact/digest receipts in PR; do not merge or publish.**

## Exit Criteria

A4-R1 reaches candidate status only when:
- the authentic phrase `Attività per le classi prime` yields useful class disambiguation;
- source/material controls are progressive, not front-door requirements;
- ordinary unknown wording no longer exposes implementation taxonomy;
- no AI/provider work is newly introduced before Play;
- AIC-07 mission/grant/scope/persistence tests remain green;
- mobile no longer shows repeated empty opportunity groups or a wide Vault toolbar over Copilot;
- exact-SHA PREDEPLOY and Browser Qualification are both green.
