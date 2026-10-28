# AIC-07 Supervised Proactive Copilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an evidence-backed Copilot Deck that proactively proposes a small number of useful teacher actions, requires explicit teacher Play before any AI execution, runs only bounded missions through existing qualified Copilot capabilities, and preserves teacher authority over durable professional acts.

**Architecture:** Add a pure local opportunity/ranking layer in `src/copilot/`, a durable encrypted `copilotState` record for deferred opportunities, mission identity/work state and global preference signals, and a separate responsive `CopilotDeck` supervision surface in front of the existing `LibraryCopilotComposer`. Mission Play persists the bounded mission first, then hands off through the existing Contextual Copilot/Core, privacy, remote-consent, PREPARE/REVIEW/LINK and AIC-06 paths; no second resolver, retrieval stack, provider path or transformation engine is introduced.

**Tech Stack:** React 19, TypeScript 7, Bun test, existing Secure Vault/IndexedDB persistence, existing `@trama/contextual-copilot-core`, existing Biblioteca relevance resolver and Professional Memory, Playwright/Chromium browser qualification, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-27-aic-07-supervised-proactive-copilot-design.md`

## Global Constraints

- Baseline for native implementation is `main@54f7941492baf8aca952d9f7cf3263fc036d6591` or the exact descendant produced by integrating only this approved docs work; do not implement from a stale pre-AIC-06 baseline.
- AIC-07 v1 is proactive in **detection/presentation only**: no generative AI, remote intent/provider work, or AI transformation starts before explicit teacher **▶ Play**.
- Play authorizes a bounded mission, not blanket Copilot authority; mission scope may not expand to another class, UDA, source set or goal without a new opportunity/preview/Play.
- Existing privacy classification, Contextual Copilot Core authority, explicit remote-consent semantics, PREPARE/REVIEW/LINK behavior, AIC-06 budget governance and durable-write confirmation remain stronger downstream gates and must not be bypassed.
- Opportunity detection/ranking is local/deterministic and must not remotely send data merely to decide whether a suggestion should be shown.
- Student-personal data must not enter opportunity ranking or preference learning.
- Reuse `src/library/relevanceResolver.ts`; do not create a second semantic retrieval or destination-relevance implementation.
- AIC-07 may orchestrate only capabilities already qualified in the Registro. Do not implement the AIC-08 transformation catalog or AIC-09 assessment flows in this slice.
- Every visible opportunity must carry qualifying evidence and a concise `whyNow` derived from the same evidence used for ranking.
- Default Deck density is 2–3 primary opportunities; `Altre possibilità` may reveal overflow, but the Deck must never become a capability catalog.
- Proactivity and AIC-06 budget are independent axes: `essential | balanced | present` changes suggestion thresholds only; `economy | balanced | quality` keeps its existing budget semantics.
- Preference learning is global for the teacher in v1, decays over time, is resettable independently, and may re-rank evidence-backed opportunities only; it must never change authority.
- Missions survive UI interruption; AI execution authorization does not. Never persist active AI authority, hidden chain-of-thought, provider-internal reasoning, API secrets or prompt logs.
- First execution always requires the full mission preview. Resume with unchanged material context uses one **▶ Riprendi**; material context change forces refreshed preview and re-authorization.
- Existing durable-mutation semantics apply: persist first, then publish React success state; a failed save must not launch AI or present a false success.
- No new runtime dependency is expected.
- No merge, deployment or publication is implied by engineering qualification.

## Review Focus

1. **Stale evidence / source mutation:** an opportunity created from a source or UDA that changes before Play must be suppressed or re-previewed, never executed against stale context. Task 1 and Task 3 tests pin this.
2. **Immediate reappearance after Ignore:** ignoring an opportunity must suppress the same opportunity in the same context fingerprint while still allowing it to return after a material context change. Task 2 tests pin this.
3. **Reload during active mission:** `authorized`/`running` work restored from Vault must become `suspended`; no persisted Play token may silently restart remote work. Task 3 and Task 4 tests pin this.
4. **Preference-state corruption/unavailability:** ranking must fall back to the selected base proactivity profile instead of blocking normal Registro/Copilot work. Task 7 failure tests pin this.
5. **Mission handoff encounters privacy/Core/budget denial:** the mission must suspend or report a teacher-language blocked state while preserving completed safe work; it must not reinterpret the denial as teacher rejection or bypass the gate. Task 6 and Task 7 tests pin this.

---

## File Structure

### New focused modules

- `src/copilot/opportunityResolver.ts` — opportunity evidence model, deterministic candidate construction, ranking, `whyNow`, profile thresholds and stable ordering.
- `src/copilot/proactivity.ts` — `CopilotProactivityProfile` normalization and threshold/density policy.
- `src/copilot/preferenceLearning.ts` — global teacher interaction/outcome signals, deterministic decay and preference score/reset.
- `src/copilot/mission.ts` — mission preview/contract, context fingerprint, ephemeral execution grant, scope checks and resume decision.
- `src/copilot/state.ts` — durable `CopilotStateV1` schema for missions, deferred opportunities, dismissals and preference signals.
- `src/copilot/emptyCopilotState.ts` — canonical empty state.
- `src/persistence/copilotStateMutation.ts` — pure state transitions used by the app mutation coordinator.
- `src/components/CopilotDeck.tsx` — responsive FAB entry, `Qui / Oggi / Più tardi`, opportunity cards, mission preview, resume/ready cards and progressive disclosure.

### Existing files intentionally modified

- `src/types.ts` — add optional durable `copilotProactivity` setting.
- `src/utils.ts` — default `copilotProactivity: 'balanced'`.
- `src/security/vaultTypes.ts` / `src/security/vaultStore.ts` — add encrypted `copilotState` record key.
- `src/security/secureAppStorage.ts` — load/save `copilotState`, include it in complete snapshots and atomic restore.
- `src/security/backupPayload.ts` — add backup data version 6 and normalize V2–V5 backups to empty AIC-07 state.
- `src/App.tsx` — own committed `copilotState`, derive current projection, run durable mutations, render Deck and launch existing composer.
- `src/components/SettingsView.tsx` — proactivity control and independent “Reimposta preferenze del Copilota”.
- `src/library/copilotLaunchContext.ts` — optional bounded mission launch metadata; preserve existing launch semantics.
- `src/components/LibraryCopilotComposer.tsx` — controlled mission launch/prefill path; preserve the normal chat path; hide legacy standalone trigger when Deck owns the FAB.
- `src/components/LibraryProposalPanel.tsx` — optional mission progress/result callbacks only; do not create a new provider path.
- `.github/workflows/browser-qualification.yml` — add AIC-07 browser spec to exact-SHA qualification.

---

### Task 1: Pure opportunity, evidence and ranking contract

**Files:**
- Create: `src/copilot/proactivity.ts`
- Create: `src/copilot/opportunityResolver.ts`
- Test: `src/security/aic07OpportunityContract.test.ts`
- Test: `src/security/aic07OpportunityBehavior.test.ts`
- Reuse unchanged: `src/library/relevanceResolver.ts`
- Reuse unchanged: `src/copilot/contextProjection.ts`

**Interfaces:**
- Produces:
  - `type CopilotProactivityProfile = 'essential' | 'balanced' | 'present'`
  - `normalizeCopilotProactivity(value: unknown): CopilotProactivityProfile`
  - `type CopilotOpportunityKind = 'prepare-current-lesson' | 'prepare-current-uda' | 'prepare-today-lesson' | 'resume-mission'`
  - `type CopilotOpportunityScope = 'contextual' | 'today' | 'later'`
  - `interface CopilotOpportunityEvidenceV1`
  - `interface CopilotOpportunityV1`
  - `resolveCopilotOpportunities(input: ResolveCopilotOpportunitiesInput): CopilotOpportunityResolution`
- Consumes existing `CopilotContextProjectionV1`, `UdaRecord[]`, `LibraryStateV1`, `PlanningStateV1`, `resolveLibraryRelevanceTarget()`, deferred/dismissal/mission summaries supplied by later state tasks.

**Implementation calls fixed by this plan:**
- Every rank factor is normalized to `0..100`.
- `finalScore = clamp(0, 100, 0.30*contextualRelevance + 0.20*temporalUrgency + 0.20*continuity + 0.15*expectedUtility + 0.15*teacherPreference - 0.20*noisePenalty)`.
- Base preference factor is `50` when no learned signal is available.
- Primary thresholds/counts:
  - `essential`: score `>= 70`, at most `2` primary cards;
  - `balanced`: score `>= 50`, at most `3` primary cards;
  - `present`: score `>= 35`, at most `3` primary cards plus overflow eligible for `Altre possibilità`.
- Stable tie-break: `finalScore desc`, then scope precedence `contextual > today > later`, then `id` lexical.
- A generative opportunity is emitted only when an already-qualified existing capability can execute it. For PREPARE in v1, require a `ready`, `teacher-professional` Library source with a positive `resolveLibraryRelevanceTarget()` result bound to the exact target UDA/lesson.
- Do not add a timetable domain in AIC-07. `today` v1 opportunities come from dated UDA lesson/activity evidence already present, deferred context becoming current today, or existing current-day app context. A future qualified timetable projection may be added as another input without changing the opportunity contract.
- `whyNow` comes from deterministic evidence precedence, never from a model.

- [ ] **Step 1: Write RED contract tests for the model and local-only boundary**

Create assertions equivalent to:

```ts
expect(normalizeCopilotProactivity(undefined)).toBe('balanced');
expect(sourceText).not.toContain('fetch(');
expect(sourceText).not.toContain('requestLibraryTeachingProposal');
expect(sourceText).toContain("resolveLibraryRelevanceTarget");
```

Also require `whyNow`, `evidence`, all six rank factors and `finalScore` on every emitted opportunity.

- [ ] **Step 2: Run the focused RED**

Run:

```bash
bun test src/security/aic07OpportunityContract.test.ts
```

Expected: FAIL because AIC-07 opportunity modules do not exist.

- [ ] **Step 3: Write behavior REDs for evidence, privacy and profile thresholds**

Tests must prove:
- current lesson + professional ready relevant source -> `prepare-current-lesson`, `scope='contextual'`;
- same source with `student-personal` or `unknown` privacy -> no generative opportunity;
- no positive relevance/evidence -> no opportunity;
- planning context cannot produce a destination target inconsistent with concrete teaching context;
- a dated non-current lesson for today may produce `prepare-today-lesson` only with valid relevance evidence;
- identical input produces stable ordering;
- `essential` hides a score that `balanced` shows; `present` may include lower-score overflow;
- displayed `whyNow` corresponds to one of the opportunity evidence records.

- [ ] **Step 4: Implement the minimal pure resolver**

Implement the interfaces above. Keep candidate factories small and explicit; do not copy the lexical/Planning Context logic from `relevanceResolver.ts`.

- [ ] **Step 5: Run focused GREEN plus existing relevance regressions**

```bash
bun test src/security/aic07OpportunityContract.test.ts src/security/aic07OpportunityBehavior.test.ts src/library/relevanceResolver.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/copilot/proactivity.ts src/copilot/opportunityResolver.ts src/security/aic07OpportunityContract.test.ts src/security/aic07OpportunityBehavior.test.ts
git commit -m "feat: add AIC-07 opportunity resolver"
```

---

### Task 2: Global preference learning, Ignore and Put Aside semantics

**Files:**
- Create: `src/copilot/preferenceLearning.ts`
- Extend: `src/copilot/opportunityResolver.ts`
- Test: `src/security/aic07PreferenceBehavior.test.ts`

**Interfaces:**
- Produces:
  - `type CopilotPreferenceSignalKind = 'play' | 'put-aside' | 'ignore' | 'remove' | 'used-as-is' | 'small-edits' | 'heavy-rework' | 'saved-to-library' | 'linked-to-uda' | 'reused-later' | 'discarded' | 'abandoned'`
  - `interface CopilotPreferenceSignalV1 { id: string; opportunityKind: CopilotOpportunityKind; signal: CopilotPreferenceSignalKind; occurredAt: string }`
  - `interface CopilotPreferenceStateV1 { schemaVersion: 1; signals: CopilotPreferenceSignalV1[] }`
  - `recordCopilotPreferenceSignal(state, input): CopilotPreferenceStateV1`
  - `copilotPreferenceFactor(state, opportunityKind, now): number`
  - `resetCopilotPreferences(): CopilotPreferenceStateV1`
- Consumes opportunity kind only; no class/UDA/student segmentation is permitted.

**Implementation calls fixed by this plan:**
- Raw signal weights: `play +2`, `put-aside +0.5`, `ignore -1`, `remove -2`, `used-as-is +3`, `small-edits +2`, `heavy-rework +0.5`, `saved-to-library +3`, `linked-to-uda +3`, `reused-later +3`, `discarded -3`, `abandoned -1.5`.
- Exponential decay half-life: `30 days`.
- Convert decayed raw total to rank factor with `50 + raw*5`, clamped to `0..100`.
- Retain at most the newest `200` preference signals after each append; this is a bounded behavioral history, not a permanent activity log.
- Ignore suppression is context-fingerprint scoped: same opportunity key + same fingerprint is suppressed; a materially changed fingerprint may surface it again.
- Put Aside is positive/neutral intent (“makes sense, not now”): it moves a snapshot to `later` and must not start AI.

- [ ] **Step 1: Write RED preference tests**

Cover:
- baseline factor `50`;
- repeated `play + used-as-is` increases factor;
- repeated `discarded` decreases factor;
- a 60-day-old signal contributes less than the same signal today;
- signals for the same opportunity kind apply globally across classes/UDA;
- no preference state contains class/student identifiers;
- reset returns empty v1 state.

- [ ] **Step 2: Run RED**

```bash
bun test src/security/aic07PreferenceBehavior.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement preference learning and resolver injection**

Add only pure functions. `resolveCopilotOpportunities()` receives the computed preference factor and current dismissal/deferred snapshots; it does not persist anything itself.

- [ ] **Step 4: Add RED/GREEN for Ignore and Put Aside ranking behavior**

Prove same-fingerprint ignore suppresses immediate reappearance, changed fingerprint permits reconsideration, and put-aside appears only in `later` with a real reason such as “L’avevi messa da parte…”.

- [ ] **Step 5: Run GREEN**

```bash
bun test src/security/aic07PreferenceBehavior.test.ts src/security/aic07OpportunityBehavior.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/copilot/preferenceLearning.ts src/copilot/opportunityResolver.ts src/security/aic07PreferenceBehavior.test.ts
git commit -m "feat: add AIC-07 preference learning"
```

---

### Task 3: Mission preview, scope, fingerprint and ephemeral execution grant

**Files:**
- Create: `src/copilot/mission.ts`
- Test: `src/security/aic07MissionContract.test.ts`
- Test: `src/security/aic07MissionBehavior.test.ts`

**Interfaces:**
- Produces:
  - `interface CopilotMissionPreviewV1`
  - `interface CopilotMissionV1`
  - `interface CopilotMissionExecutionGrantV1`
  - `buildCopilotMissionPreview(opportunity, inputs): CopilotMissionPreviewV1`
  - `authorizeCopilotMission(preview, input): { mission: CopilotMissionV1; grant: CopilotMissionExecutionGrantV1 }`
  - `buildMissionContextFingerprint(input): string`
  - `resolveMissionResume(mission, currentFingerprint, now): 'resume' | 'repreview' | 'archive'`
  - `isMissionExecutionGrantValid(grant, mission, currentFingerprint, now): boolean`
  - `assertMissionStepWithinScope(mission, step): void`
- Consumes `AiBudgetProfile` but does not create AIC-06 budget escalation grants.

**Implementation calls fixed by this plan:**
- First preview always exposes exactly five semantic fields: `goal`, `context`, `uses`, `produces`, `willNotDo`.
- Authority contract is fixed to `{ persistentProfessionalWrite: false, externalAction: false, scopeExpansion: false }` for all v1 mission types.
- Mission execution grant TTL is `15 minutes`; the grant is returned separately and is never part of `CopilotStateV1`/backup.
- Persisted/restored `authorized` or `running` missions normalize to `suspended` on application bootstrap.
- Fingerprint covers mission-defining professional inputs only: projection identifiers, target UDA/lesson identity and content fields used by the mission, selected source id/status/privacy/capturedAt/content/title digest, accepted planning profile id, and mission-defining settings. Do not include student lists/grades/behaviors.
- Use a deterministic local hash over canonical JSON; no network call and no cryptographic secret are required.

- [ ] **Step 1: Write RED preview/authority tests**

Assert first preview cannot omit `willNotDo`, and authorized mission always has `persistentProfessionalWrite=false`, `externalAction=false`, `scopeExpansion=false`.

- [ ] **Step 2: Run RED**

```bash
bun test src/security/aic07MissionContract.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Add RED lifecycle/fingerprint tests**

Cover:
- grant valid inside 15 minutes for exact mission + fingerprint;
- grant invalid after TTL;
- grant invalid for another mission;
- source/UDA material change alters fingerprint;
- unchanged fingerprint -> `resume`;
- changed fingerprint -> `repreview`;
- expired semantic target -> `archive`;
- a step targeting another class/UDA throws scope violation.

- [ ] **Step 4: Implement mission contract and lifecycle helpers**

Keep all functions pure. Do not import React, storage, provider services or server code.

- [ ] **Step 5: Run GREEN**

```bash
bun test src/security/aic07MissionContract.test.ts src/security/aic07MissionBehavior.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/copilot/mission.ts src/security/aic07MissionContract.test.ts src/security/aic07MissionBehavior.test.ts
git commit -m "feat: add AIC-07 mission contract"
```

---

### Task 4: Durable Copilot state, Vault key and backup v6

**Files:**
- Create: `src/copilot/state.ts`
- Create: `src/copilot/emptyCopilotState.ts`
- Create: `src/persistence/copilotStateMutation.ts`
- Modify: `src/security/vaultTypes.ts`
- Modify: `src/security/vaultStore.ts`
- Modify: `src/security/secureAppStorage.ts`
- Modify: `src/security/backupPayload.ts`
- Modify: `src/security/backupRestore.test.ts`
- Modify: `src/security/persist01hStorageContract.test.ts`
- Test: `src/security/aic07PersistenceContract.test.ts`

**Interfaces:**
- `interface CopilotStateV1 { schemaVersion: 1; missions: CopilotMissionV1[]; deferred: CopilotDeferredOpportunityV1[]; dismissals: CopilotOpportunityDismissalV1[]; preferences: CopilotPreferenceStateV1 }`
- `createEmptyCopilotState(): CopilotStateV1`
- Pure mutation helpers for append/update mission, defer opportunity, dismiss opportunity, record outcome signal, reset preferences and archive mission.
- `SecureAppStorage.saveCopilotState()` and `saveCopilotStateAndMeta()`.

**Persistence decision:** add `copilotState` as a separate encrypted Vault record. Do not hide mission state inside `settings`, `library` or Professional Memory. Add `BACKUP_DATA_VERSION_V6 = 6`; V2–V5 backup normalization supplies `createEmptyCopilotState()`.

- [ ] **Step 1: Write the storage RED**

Tests must expect `copilotState` in `VaultRecordKey`, `SNAPSHOT_KEYS`, complete snapshot, restore operations and backup V6 while old backups still normalize successfully.

- [ ] **Step 2: Run RED**

```bash
bun test src/security/aic07PersistenceContract.test.ts src/security/backupRestore.test.ts src/security/persist01hStorageContract.test.ts
```

Expected: FAIL because the tenth durable record does not exist.

- [ ] **Step 3: Implement state schema and pure mutations**

Persist only mission contract/status, safe completed outputs/receipts, deferred/dismissal snapshots and bounded preference signals. Explicitly exclude execution grants, remote-consent state, AIC-06 temporary grants, prompts, hidden reasoning and secrets.

- [ ] **Step 4: Extend Secure Vault snapshot and backup v6**

Add `copilotState` to load/save/restore/complete-snapshot paths. `normalizeBackupPayload()` must accept V2–V6 and return a complete current snapshot. Keep all settings sanitization unchanged.

- [ ] **Step 5: Prove restored active work suspends rather than auto-runs**

Add normalization test: a persisted `running` mission read during bootstrap becomes `suspended` before App consumption; no execution grant can be reconstructed from disk.

- [ ] **Step 6: Run GREEN plus full security suite**

```bash
bun run test:security
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/copilot/state.ts src/copilot/emptyCopilotState.ts src/persistence/copilotStateMutation.ts src/security
git commit -m "feat: persist AIC-07 supervised mission state"
```

---

### Task 5: Proactivity settings and Copilot Deck supervision UI

**Files:**
- Modify: `src/types.ts`
- Modify: `src/utils.ts`
- Modify: `src/components/SettingsView.tsx`
- Create: `src/components/CopilotDeck.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/LibraryCopilotComposer.tsx`
- Test: `src/security/aic07UiBehavior.test.ts`

**Interfaces:**
- Add `AppSettings.copilotProactivity?: CopilotProactivityProfile`.
- `DEFAULT_SETTINGS.copilotProactivity = 'balanced'`.
- `CopilotDeck` consumes current projection, resolved opportunities, durable mission/deferred state, `isPending`, and callbacks for preview/play/resume/put-aside/ignore/archive/open-chat.
- `SettingsView` adds `onResetCopilotPreferences: () => Promise<void>`.

**UI decisions fixed by this plan:**
- Existing contextual FAB becomes Deck entry. The legacy standalone composer trigger is hidden when App renders the Deck; “Parla con il Copilota” remains available inside the Deck and launches the same composer.
- Mobile: bottom sheet respecting existing bottom safe area. Desktop: compact right rail/panel. Do not create a new home/dashboard route.
- Sections use text labels + semantic icons + hierarchy, never color alone: `Qui`, `Oggi`, `Più tardi`.
- Each opportunity card always shows `title`, one-line `whyNow`, scope label and `Anteprima`; Put Aside/Ignore use secondary affordances.
- Full first preview shows `Obiettivo / Contesto / Userà / Produrrà / Non farà` and **▶ Avvia incarico**.
- Suspended unchanged mission shows concise status + **▶ Riprendi**, no redundant full preview.
- Materially changed mission shows “Il contesto è cambiato…” and requires refreshed preview.
- Ready mission is visually distinct as “Pronta da controllare”.
- Settings labels: **Proattività del Copilota** with **Essenziale / Equilibrato / Presente**, separate from **Uso delle risorse IA**.

- [ ] **Step 1: Write RED source/UI contract tests**

Require the three proactivity values, separate budget/proactivity copy, visible `whyNow`, all three Deck section labels, five preview headings, Play labels, reset control and absence of auto-generation effects on Deck mount.

- [ ] **Step 2: Run RED**

```bash
bun test src/security/aic07UiBehavior.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Add committed `copilotState` to App using the existing durable mutation coordinator**

Initialize from `initialSnapshot.copilotState ?? createEmptyCopilotState()`, maintain a ref, and expose mutation callbacks that persist `copilotState + meta` before publishing React state. Persistence failure leaves prior committed Deck/mission state visible and does not launch work.

- [ ] **Step 4: Implement proactivity settings with truthful pending/error behavior**

Mirror the AIC-06 settings mutation style. Reset preferences must mutate only `copilotState.preferences`; it must not touch Biblioteca, Professional Memory, UDA, lesson or AppData records.

- [ ] **Step 5: Implement `CopilotDeck` and make it the sole FAB entry**

Use `resolveCopilotOpportunities()` from Task 1; cap primary density per profile; render overflow progressively. Preserve keyboard focus, 44px minimum touch targets, accessible labels and existing viewport clearance.

- [ ] **Step 6: Run GREEN and typecheck**

```bash
bun test src/security/aic07UiBehavior.test.ts
bun run lint
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/types.ts src/utils.ts src/App.tsx src/components/SettingsView.tsx src/components/CopilotDeck.tsx src/components/LibraryCopilotComposer.tsx src/security/aic07UiBehavior.test.ts
git commit -m "feat: add supervised Copilot Deck"
```

---

### Task 6: Mission Play handoff through the existing Copilot/PREPARE path

**Files:**
- Modify: `src/library/copilotLaunchContext.ts`
- Modify: `src/components/LibraryCopilotComposer.tsx`
- Modify: `src/components/LibraryProposalPanel.tsx`
- Modify: `src/App.tsx`
- Test: `src/security/aic07MissionHandoffBehavior.test.ts`
- Test: `src/security/aic07AuthorityRegression.test.ts`

**Interfaces:**
- Extend `LibraryCopilotLaunchRequest` with optional mission metadata `{ missionId: string; objective: string }`; existing callers remain source-compatible.
- Factor composer resolution so manual submit and mission launch call the **same** intent/Core routing function.
- Add optional proposal-panel callbacks:
  - `onMissionProposalReady?(input: { missionId: string; proposal: TeachingProposalV1; receipt: TeachingProposalRuntimeReceiptWire }): Promise<void> | void`
  - `onMissionOutcome?(input: { missionId: string; signal: CopilotPreferenceSignalKind }): Promise<void> | void`
- Do not add another API endpoint or provider service.

**Execution behavior fixed by this plan:**
- Play first durably creates/updates the mission, then emits an in-memory 15-minute mission execution grant, then launches the existing composer with exact context/source/objective.
- Composer reuses `interpretCopilotIntent -> routeAgentIntent -> existing REVIEW/LINK/PREPARE` flow. No direct dispatch around Core.
- If PREPARE is selected, existing professional-source classification, explicit remote consent, Core remote authorization and AIC-06 preflight/server enforcement stay intact. Mission Play does not count as budget escalation and does not manufacture remote consent.
- AIC-07 v1 opportunities that require PREPARE must already bind a qualified professional source and target; if either disappears before execution, mission becomes suspended/stale instead of fabricating a source.
- Safe mission output may persist `TeachingProposalV1` plus bounded runtime receipt metadata so a ready mission survives reload. Never persist prompt text/provider reasoning.
- Existing adoption actions remain separate professional/durable decisions.

- [ ] **Step 1: Write RED proving no provider/intent execution happens before Play**

Use stubs/counters around mission launch: opportunity resolution, preview, put-aside and ignore must leave remote/intent/provider call counts at `0`.

- [ ] **Step 2: Write RED proving Play uses the existing route**

The test must fail if mission code imports/calls the server/provider directly. Assert mission launch reaches the same composer routing path and that privacy/Core denials are surfaced without provider invocation.

- [ ] **Step 3: Implement mission launch metadata and factor composer objective resolution**

Do not duplicate `handleResolve`; extract an internal `resolveObjective(objective: string, missionId?: string)` and have both manual form submit and mission auto-start call it.

- [ ] **Step 4: Add mission result/outcome callbacks to `LibraryProposalPanel`**

On successful generation, persist safe ready output and set mission `ready`. Emit outcome signals from existing teacher actions:
- adopt without edits -> `used-as-is` plus `saved-to-library` or `linked-to-uda` as applicable;
- adopted edited result with `<=2` changed top-level content fields -> `small-edits`;
- adopted edited result with `>2` changed top-level content fields -> `heavy-rework`;
- leave/discard generated proposal -> `discarded`.

The preference module already understands `reused-later`/`abandoned`; later qualified product events may emit them without schema change.

- [ ] **Step 5: Add authority regression tests**

Prove mission completion cannot call `onAdoptProposalToUda`, `onLink`, external send/publish or any grade/student mutation without the existing separate confirmation action.

- [ ] **Step 6: Run focused GREEN plus AIC-02/AIC-06 regressions**

```bash
bun test src/security/aic07MissionHandoffBehavior.test.ts src/security/aic07AuthorityRegression.test.ts src/security/aic02PrepareOutcomeContract.test.ts src/security/aic06BudgetGovernorBehavior.test.ts src/security/aic06BudgetRouteBehavior.test.ts
bun run test:library
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/library/copilotLaunchContext.ts src/components/LibraryCopilotComposer.tsx src/components/LibraryProposalPanel.tsx src/App.tsx src/security/aic07MissionHandoffBehavior.test.ts src/security/aic07AuthorityRegression.test.ts
git commit -m "feat: execute bounded AIC-07 missions"
```

---

### Task 7: Resume, stale-context, failure and readiness behavior

**Files:**
- Modify: `src/copilot/state.ts`
- Modify: `src/copilot/mission.ts`
- Modify: `src/components/CopilotDeck.tsx`
- Modify: `src/App.tsx`
- Test: `src/security/aic07ResumeBehavior.test.ts`
- Test: `src/security/aic07FailureBehavior.test.ts`

**Interfaces:**
- Add one App-level `resumeMission(missionId)` path that recomputes the exact current fingerprint before issuing a new execution grant.
- `resume` -> no full preview; `repreview` -> refreshed mission preview; `archive` -> no execution.
- Mission failures store a bounded teacher-language failure state/reason, never raw provider payloads.

- [ ] **Step 1: Write RED resume tests**

Prove:
- restored running mission becomes suspended;
- unchanged context -> one `▶ Riprendi`, no full preview;
- source privacy/status/UDA/lesson material change -> re-preview required;
- stale/missing source -> no execution;
- a mission whose semantic target no longer exists is archived.

- [ ] **Step 2: Write RED failure tests**

Prove:
- opportunity resolver failure -> Deck falls back to explicit “Parla con il Copilota” and normal Registro remains usable;
- preference-state failure/corruption -> base profile ranking;
- Core/privacy/provider/budget denial -> mission suspended/blocked with safe reason, not teacher-rejection signal;
- retry does not reuse expired mission execution grant.

- [ ] **Step 3: Implement minimal resume/failure transitions**

Keep provider-specific error semantics delegated to existing services. AIC-07 only maps them to mission state without changing their authority meaning.

- [ ] **Step 4: Run GREEN plus full unit suites**

```bash
bun run test:security
bun run test:library
bun run lint
bun run build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/copilot/state.ts src/copilot/mission.ts src/components/CopilotDeck.tsx src/App.tsx src/security/aic07ResumeBehavior.test.ts src/security/aic07FailureBehavior.test.ts
git commit -m "fix: harden AIC-07 mission continuity"
```

---

### Task 8: Exact-SHA browser qualification and whole-slice review

**Files:**
- Create: `tests/browser/aic-07-supervised-copilot.spec.cjs`
- Modify: `.github/workflows/browser-qualification.yml`
- Modify only if evidence demands it: `ux/qa/navigation-contract.v1.json`, `ux/qa/progressive-disclosure-contract.v1.json`

**Browser scenarios required:**
1. Desktop: Deck opens from the existing Copilot FAB; `Qui/Oggi/Più tardi` are distinguishable by text/icon/hierarchy, not color only.
2. Mobile 390×844: Deck does not obscure primary navigation/safe area and primary cards remain usable with 44px targets.
3. Every visible opportunity shows `whyNow`; no generic “AI recommends this” copy.
4. No remote intent/provider request occurs merely by opening Deck or preview.
5. Put Aside moves the card to `Più tardi` and makes zero provider calls.
6. Ignore removes the same-fingerprint card; materially changed context may surface a new candidate.
7. First Play cannot occur before preview. After Play, mission hands off to the existing Copilot and existing remote-consent/AIC-06 gates still appear when applicable.
8. Successful prepared output becomes `Pronta da controllare` and survives reload from encrypted state.
9. Suspended unchanged mission resumes via one `▶ Riprendi`; changed material context forces refreshed preview.
10. `Essenziale / Equilibrato / Presente` persists through reload and remains independent of AIC-06 `Risparmio / Bilanciato / Qualità`.
11. “Reimposta preferenze del Copilota” does not remove Biblioteca, Professional Memory or UDA data.
12. A generated result does not become a durable professional write until the existing explicit adoption/confirmation path is used.

- [ ] **Step 1: Add the browser RED and workflow inclusion**

Copy/run `aic-07-supervised-copilot.spec.cjs` in `.github/workflows/browser-qualification.yml` next to the existing AIC-01…AIC-06 specs.

- [ ] **Step 2: Run local browser gate where available**

Use the same production build/server and isolated Chromium procedure as the workflow. Capture desktop/mobile screenshots and JSON evidence under `browser-evidence/`.

- [ ] **Step 3: Run complete pre-qualification locally**

```bash
bun install --frozen-lockfile
bun run test:security
bun run test:library
bun run lint
bun run build
```

Expected: all green.

- [ ] **Step 4: Push exact candidate and require PREDEPLOY + Browser Qualification on the same SHA**

Record:
- exact candidate SHA;
- PREDEPLOY run number/id and security/library counts;
- Browser Qualification run number/id and Chromium count;
- UX-QA-01/02 outcomes;
- browser artifact id/file count/digest.

Do not qualify if either gate is on a different SHA.

- [ ] **Step 5: Request a fresh whole-slice independent review on the exact candidate**

Review focus must explicitly include:
- no AI before Play;
- evidence/whyNow integrity;
- no second resolver/provider stack;
- preference learning cannot widen authority;
- no persisted execution grants;
- changed-context resume behavior;
- AIC-06/privacy/Core boundaries;
- professional writes still separately confirmed.

Any Important/Critical finding returns to causal RED -> minimal GREEN -> exact-SHA gates -> fresh review.

- [ ] **Step 6: Human integration decision only after final evidence is green**

Canonical pre-integration state:

`AIC-07 ENGINEERING QUALIFIED / EXACT-SHA VERIFIED / FRESH FINAL REVIEW PASS / HUMAN INTEGRATION DECISION PENDING / NO DEPLOY`

No merge or deploy without explicit human authorization.
