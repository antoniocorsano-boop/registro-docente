# LIB-04B Registro Composer & Source Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** aggiornare `registro-docente` come consumer del Contextual Copilot Core 0.2.0 e aggiungere composer + source bridge senza resolver locale duplicato.

**Architecture:** il pacchetto Core resta vendorizzato/offline e governa authority e request resolution. Il Registro costruisce soltanto contesto minimizzato, source bridge e presentazione; senza `IntentPort`, il request contract degrada al fallback deterministico Core. Nessun dispatch operativo viene aggiunto in LIB-04B.

**Tech Stack:** React 19, TypeScript, Bun tests, Vite, Secure Local Vault, package vendorizzato `@trama/contextual-copilot-core`.

**Spec:** `docs/superpowers/specs/2026-10-25-lib-04b-registro-composer-source-bridge-design.md`

## Global Constraints

- Baseline: `main@e83882380e5aeae51d7d4024b2fd5dca25e36b69`.
- Upstream distribution: `trama-ecosistema@8c47c34048acc943a1f4a2067b29629eb880e7ef`.
- Source package commit: `404db9ebf12fe669181f4d503110b04221684212`.
- Package version: `0.2.0`.
- No local intent parser/resolver.
- Allowed conversational capability scope: `PREPARE`, `SUMMARIZE`, `LINK`, `REVIEW` only.
- No automatic dispatch, provider call, canonical write, deploy, publish or merge.
- New sources must persist through the existing Library mutation path.

## Review Focus

- Message/source payload leaking into `ContextSnapshot`.
- Composer accidentally executing an action instead of presenting Core resolution.
- New-source flow bypassing LIB-02 intake or durable Library persistence.
- Old Core 0.1.0 provenance or hashes surviving consumer upgrade.
- Mobile composer obscuring content or exposing controls smaller than 44px.

---

### Task 1: Upgrade vendored Core to 0.2.0

**Files:**
- Modify: `src/security/lib01bContextualCoreContract.test.ts`
- Modify: `vendor/contextual-copilot-core.provenance.json`
- Modify: `vendor/contextual-copilot-core/README.md`
- Modify: `vendor/contextual-copilot-core/index.d.ts`
- Modify: `vendor/contextual-copilot-core/package.json`
- Modify: `vendor/contextual-copilot-core/src/index.js`

**Interfaces:**
- Consumes: upstream immutable distribution receipt.
- Produces: exact vendored Core 0.2.0 with `resolveRequest()` types/runtime.

- [ ] Update consumer contract test first to version/source/distribution/hashes from upstream receipt.
- [ ] Run security suite and verify causal RED against still-v0.1 vendor.
- [ ] Replace exactly the four package files and provenance from upstream receipt.
- [ ] Run security suite and verify GREEN.
- [ ] Commit.

### Task 2: Add request bridge without local resolver

**Files:**
- Create: `src/security/lib04bCopilotRequestContract.test.ts`
- Modify: `src/library/contextualCoreAdapter.ts`

**Interfaces:**
- Consumes: Core 0.2.0 `CopilotRequest`, `CopilotRequestResolution`, `resolveRequest()`.
- Produces: `resolveLibraryCopilotRequest({ source, teachingContext, message })`.

- [ ] Write failing tests proving free text is passed only as `request.message`, allowed capabilities are bounded, and fallback remains Core-owned.
- [ ] Run focused test and verify RED because request bridge does not exist.
- [ ] Implement minimal request bridge by reusing `buildLibraryContextSnapshot()` and `libraryContextualCore.resolveRequest()`.
- [ ] Run focused and full security suites GREEN.
- [ ] Commit.

### Task 3: Add source bridge reusing LIB-02 intake

**Files:**
- Create: `src/library/copilotSourceBridge.ts`
- Extend: `src/security/lib04bCopilotRequestContract.test.ts`

**Interfaces:**
- Consumes: `createFileSource`, `createWebSource`, `createTextSource` from LIB-02 intake.
- Produces: discriminated `CopilotSourceInput` and `createCopilotLibrarySource()` returning a normal `LibrarySource`.

- [ ] Add RED tests for text, URL and file bridge delegation plus absence of chat-only storage semantics.
- [ ] Verify RED.
- [ ] Implement minimal delegating bridge.
- [ ] Verify focused/full tests GREEN.
- [ ] Commit.

### Task 4: Add global progressive composer shell

**Files:**
- Create: `src/components/LibraryCopilotComposer.tsx`
- Modify: `src/App.tsx`
- Extend: `src/security/lib04bCopilotRequestContract.test.ts`

**Interfaces:**
- Consumes: Library state, UDA/planning/current-class context, durable `onAddSource`, source bridge, request bridge.
- Produces: global teacher-only composer with existing/new source selection, message input and Core-authorized suggestions.

- [ ] Add RED contract tests for global App wiring, source selection/add flow, message submission, max four suggestions, no dispatch call and no student-portal exposure.
- [ ] Verify RED.
- [ ] Implement composer and App wiring. New source creation must call existing `onAddSource` before selection.
- [ ] Verify focused/full security, typecheck and build GREEN.
- [ ] Commit.

### Task 5: Exact-SHA qualification and review

**Files:** no product changes expected.

**Interfaces:**
- Consumes: final Task 4 branch head.
- Produces: Draft PR with exact-SHA PREDEPLOY/Browser evidence and review state.

- [ ] Open Draft PR against `main`.
- [ ] Observe PREDEPLOY and Browser Qualification on exact head.
- [ ] Inspect failures causally; fix only through new RED→GREEN cycles.
- [ ] Perform whole-branch review for authority/privacy/source-persistence boundaries.
- [ ] Stop before merge/deploy/publish.
