# LIB-04D Copilot PREPARE Governed Handoff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendere il proposal flow PREPARE già governato raggiungibile dal Copilota globale senza duplicare provider, policy, proposal state o persistenza.

**Architecture:** `LibraryCopilotComposer` monta progressivamente l'esistente `LibraryProposalPanel` quando source, Teaching Context e UDA sono validi. Il panel mantiene invariati consenso one-shot, Core remoto, provider route e `Adotta/Adatta/Lascia`; App passa al Composer le callback durevoli già esistenti.

**Tech Stack:** React 19, TypeScript, Bun test, `@trama/contextual-copilot-core@0.2.0`, Playwright/Chromium, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-25-lib-04d-copilot-prepare-handoff-design.md`

## Global Constraints

- Nessun nuovo provider, route, prompt o adapter generativo.
- Nessun `IntentPort` o parser locale di keyword.
- `LibraryProposalPanel` resta l'unica superficie generativa.
- Nessun invio remoto prima del consenso one-shot già implementato nel panel.
- Nessuna nuova persistenza: riusare `handleUpdateLibrarySource` e `handleAddLibrarySource`.
- PREPARE resta `PROPOSE`; nessuna scrittura canonica prima di `Adotta`/salvataggio dopo `Adatta`.
- Mobile 390×844: controlli primari >=44px e nessun overflow orizzontale permanente.
- Nessun merge, deploy o publish automatico.

## Review Focus

- Source eliminata o cambiata mentre PREPARE è aperto: panel chiuso, zero richiesta remota.
- Teaching Context/UDA diventati stale: fail closed, panel non montato.
- `unknown`: nessuna richiesta proposal prima della classificazione professionale e del consenso.
- Chiusura/riapertura Composer: nessun consenso remoto persistente.
- Adozione fallita: nessun falso successo e proposta riutilizzabile secondo LIB-01D/01E.

---

### Task 1: Contratto RED del PREPARE handoff

**Files:**
- Create: `src/security/lib04dCopilotPrepareHandoffContract.test.ts`
- Read: `src/components/LibraryCopilotComposer.tsx`
- Read: `src/components/LibraryProposalPanel.tsx`
- Read: `src/App.tsx`

**Interfaces:**
- Consumes: existing `LibraryProposalPanel`, `LibrarySourcePatch`, `handleUpdateLibrarySource`, `handleAddLibrarySource`.
- Produces: source-level contract that forbids duplicate generative paths and requires the new handoff wiring.

- [ ] **Step 1: Write failing contract tests**

Assert at least:
- Composer imports `LibraryProposalPanel` and `LibrarySourcePatch`;
- props include `onUpdateSource: (sourceId: string, patch: LibrarySourcePatch) => Promise<void>`;
- Composer does not import `libraryProposalService`, `teachingProposal`, `requestLibraryTeachingProposal` or provider runtime;
- PREPARE disclosure state exists and resets on source/context change;
- `LibraryProposalPanel` is rendered only when selected source, resolved Teaching Context and matching UDA exist;
- disclosure copy says opening it does not yet send the source remotely;
- no Composer dispatch of `prepare-from-source`;
- App passes `onUpdateSource={handleUpdateLibrarySource}` and the existing `onAddSource`.

- [ ] **Step 2: Run the new contract and verify RED**

Run: `bun test src/security/lib04dCopilotPrepareHandoffContract.test.ts`

Expected: FAIL only on the not-yet-materialized LIB-04D handoff requirements.

- [ ] **Step 3: Commit RED**

Commit message: `test: define LIB-04D prepare handoff contract`.

---

### Task 2: Minimal Composer handoff to existing proposal panel

**Files:**
- Modify: `src/components/LibraryCopilotComposer.tsx`
- Modify: `src/App.tsx`
- Test: `src/security/lib04dCopilotPrepareHandoffContract.test.ts`

**Interfaces:**
- Consumes: `LibraryProposalPanel`, `LibrarySourcePatch`, `selectedSource`, `resolvedTeachingContext`, `udas`, `onAddSource`.
- Produces: `onUpdateSource` prop and explicit PREPARE disclosure that mounts the existing panel.

- [ ] **Step 1: Add `onUpdateSource` prop and derive matching UDA**

Signature:
`onUpdateSource: (sourceId: string, patch: LibrarySourcePatch) => Promise<void>`.

Derive `proposalUda` from `resolvedTeachingContext.udaId`; null when context or UDA is stale.

- [ ] **Step 2: Add disclosure state with fail-closed resets**

Add `isPrepareOpen`. Reset it when selected source changes and whenever the resolved Teaching Context identity (`udaId`, `lessonId`) changes.

- [ ] **Step 3: Render progressive PREPARE disclosure**

Only when `selectedSource && resolvedTeachingContext && proposalUda`.

Opening copy must state that no remote sending/generation occurs merely by opening the section. The actual panel receives:
- `source={selectedSource}`
- `uda={proposalUda}`
- `teachingContext={resolvedTeachingContext}`
- `isPending={isPending}`
- `onUpdate={onUpdateSource}`
- `onAddSource={onAddSource}`

Do not call `dispatchLibraryContextAction` for `prepare-from-source` in the Composer.

- [ ] **Step 4: Wire App**

Pass `onUpdateSource={handleUpdateLibrarySource}` to `LibraryCopilotComposer`.

- [ ] **Step 5: Run targeted and regression contracts**

Run:
`bun test src/security/lib04dCopilotPrepareHandoffContract.test.ts src/security/lib04cCopilotLinkContract.test.ts src/security/lib04bCopilotRequestContract.test.ts src/security/lib01dProposalUiContract.test.ts src/security/lib01eClientProposalContract.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit GREEN**

Commit message: `feat: hand off copilot prepare to governed proposal flow`.

---

### Task 3: Real-browser qualification for Composer PREPARE

**Files:**
- Create: `tests/browser/lib04d-copilot-prepare.spec.cjs`
- Modify: `.github/workflows/browser-qualification.yml`

**Interfaces:**
- Consumes: production preview, Secure Local Vault fixture helpers/patterns, intercepted provider metadata/proposal routes, existing proposal response schema.
- Produces: permanent browser gate for desktop + mobile handoff behavior.

- [ ] **Step 1: Add desktop browser scenario**

Use synthetic data and intercept:
- `GET **/api/copilot/library-proposal/provider` with available provider metadata;
- `POST **/api/copilot/library-proposal` with a valid structured `TeachingProposalV1`.

Prove:
- opening PREPARE disclosure alone makes zero proposal POST requests;
- `unknown` source requires classification first;
- consent exposes PREPARE through the existing panel/Core path;
- structured proposal renders inside Composer;
- `Lascia` persists nothing;
- a second proposal can be adopted and appears as an `internal` Library source after reload.

- [ ] **Step 2: Add stale/reset case**

Open PREPARE, change source before consent, assert disclosure closes and proposal POST count remains zero.

- [ ] **Step 3: Add mobile 390×844 scenario**

Verify primary disclosure/consent/action controls >=44px and no permanent horizontal overflow while the proposal panel is mounted.

- [ ] **Step 4: Register spec in Browser Qualification workflow**

Copy and execute `lib04d-copilot-prepare.spec.cjs` alongside LIB-04B/C and existing qualification specs.

- [ ] **Step 5: Commit browser gate**

Commit message: `test: qualify LIB-04D prepare handoff in browser`.

---

### Task 4: Exact-SHA qualification and review boundary

**Files:**
- No product changes unless a causal defect is proven.

**Interfaces:**
- Consumes: final branch exact SHA and permanent CI/browser gates.
- Produces: engineering-qualified candidate for human integration decision.

- [ ] **Step 1: Run/observe PREDEPLOY on final exact SHA**

Require typecheck, full security suite, Library suite, production build and startup smoke PASS.

- [ ] **Step 2: Run/observe Browser Qualification on the same exact SHA**

Require LIB-04D desktop/mobile PASS plus LIB-04B/C and UX-QA regressions PASS.

- [ ] **Step 3: Review final diff**

Reject duplicate provider logic, new local intent parser, direct PREPARE dispatch from Composer, remote request before consent, or new persistence paths.

- [ ] **Step 4: Update Draft PR body**

Record RED→GREEN chain, exact SHA, run IDs, browser evidence, findings and explicit boundary: no merge/deploy/publish without human decision.