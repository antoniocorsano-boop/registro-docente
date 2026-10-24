# LIB-01B Contextual Copilot Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collegare `Biblioteca privata` al TRAMA Contextual Copilot Core condiviso, dimostrando risoluzione contestuale e dispatch governato di `OPEN`, `REVIEW` e `LINK` senza provider generativo, resolver duplicati o perdita di authority del Registro.

**Architecture:** Il Core viene consumato come package snapshot vendorizzato, pinned a un commit integrato di `trama-ecosistema/main` e verificato tramite provenance/hash. `LibrarySource` viene ridotto a un `ContextSnapshot` minimo; il Core risolve le azioni e un presentation adapter mostra al massimo tre azioni principali più `Altre possibilità`. Gli executor verticali leggono il payload solo dopo dispatch ammesso e usano esclusivamente i durable handler esistenti per mutazioni canoniche.

**Tech Stack:** TypeScript 7 · React 19 · Bun 1.4 · Vite 8 · Playwright 1.64 · TRAMA `@trama/contextual-copilot-core` v0.1.0 vendorizzato.

**Spec:** `docs/superpowers/specs/2026-10-24-lib-01b-contextual-copilot-integration.md`

## Global Constraints

- **Hard prerequisite:** non iniziare Task 1 finché TRAMA PR #279 non è mergiata in `trama-ecosistema/main` con decisione umana.
- Il vendor deve essere generato dal package `shared/contextual-copilot-core/` di un commit **integrato su TRAMA main**, mai da un branch feature.
- Nessun resolver, ranking engine, policy engine o orchestratore sostitutivo nel Registro.
- Nessun publish npm/registry, submodule, token esterno o dependency runtime da rete.
- `generativeMode = 'none'` per tutto LIB-01B.0.
- Nessun dato personale studente o payload integrale della fonte nel `ContextSnapshot`.
- `unknown` resta non classificato: `dataClasses=[]`, `remoteProviderAllowed=false`, capability contenuto/generative/semantic escluse.
- `student-personal` mappa a `STUDENT_PERSONAL`, sempre `remoteProviderAllowed=false`.
- Nessuna scrittura UDA/LibraryState prima di dispatch ammesso + conferma umana quando richiesta.
- Tutte le mutazioni passano dai durable handler già qualificati; nessuna nuova coda parallela.
- Nessun merge/deploy implicito; decisioni di integrazione restano umane.

## Review Focus

1. **Vendor drift/manomissione:** un file Core modificato localmente o provenance SHA non canonico deve far fallire il gate prima del build qualificato — test in Task 1.
2. **Privacy `unknown`:** una fonte non classificata non deve far comparire né eseguire capability che elaborano il contenuto — test in Task 3 e Task 6.
3. **Contesto UDA ambiguo:** zero o più link UDA non devono produrre una UDA “attiva” inferita; il target deve essere scelto esplicitamente — test in Task 2 e Task 5.
4. **Dispatch/confirm race:** doppi click o cambio target durante una conferma/persistenza non devono duplicare link o mostrare falso successo — test in Task 4 e Task 6.
5. **Core indisponibile/deny:** nessun fallback hardcoded deve sostituire il Core e nessun executor deve partire dopo deny/errore — test in Task 3 e Task 4.

---

### Task 1: Vendor pinned del Contextual Copilot Core

**Prerequisite:** sostituire `<TRAMA_CORE_SHA>` solo con il commit su `trama-ecosistema/main` risultante dal merge umano di PR #279 e ricontrollare che quel commit contenga il candidate qualificato.

**Files:**
- Create: `vendor/trama-contextual-copilot-core/README.md`
- Create: `vendor/trama-contextual-copilot-core/index.d.ts`
- Create: `vendor/trama-contextual-copilot-core/package.json`
- Create: `vendor/trama-contextual-copilot-core/src/index.js`
- Create: `vendor/trama-contextual-copilot-core/UPSTREAM.json`
- Modify: `package.json`
- Modify: `bun.lock`
- Create: `src/security/lib01bCoreVendorContract.test.ts`

**Interfaces:**
- Consumes: upstream package surface `shared/contextual-copilot-core/{README.md,index.d.ts,package.json,src/index.js}` at `<TRAMA_CORE_SHA>`.
- Produces: importable dependency `@trama/contextual-copilot-core` and machine-verifiable provenance manifest.

- [ ] **Step 1: Write the failing vendor-contract test**

Create `src/security/lib01bCoreVendorContract.test.ts` asserting:

```text
UPSTREAM.repository == antoniocorsano-boop/trama-ecosistema
UPSTREAM.packagePath == shared/contextual-copilot-core
UPSTREAM.upstreamSha == <TRAMA_CORE_SHA>
package.name == @trama/contextual-copilot-core
package.version == 0.1.0
vendored runtime file set == README.md,index.d.ts,package.json,src/index.js
every declared sha256 matches the vendored file bytes
root package.json dependency == file:vendor/trama-contextual-copilot-core
vendored package has no runtime dependencies requiring network installation
```

The test must fail if `upstreamSha` is a feature-branch candidate rather than the post-merge TRAMA main commit selected for this task.

- [ ] **Step 2: Run the isolated contract and confirm RED**

Run:

```bash
bun test src/security/lib01bCoreVendorContract.test.ts
```

Expected: FAIL because vendor directory/dependency does not yet exist.

- [ ] **Step 3: Materialize the exact upstream package snapshot and hashes**

Copy exactly the four upstream package files from `<TRAMA_CORE_SHA>`, create `UPSTREAM.json` with SHA256 digests, and add:

```json
"@trama/contextual-copilot-core": "file:vendor/trama-contextual-copilot-core"
```

Regenerate `bun.lock` only through the repository package manager; do not hand-edit lock resolution.

- [ ] **Step 4: Verify GREEN and frozen install**

Run:

```bash
bun install --frozen-lockfile
bun test src/security/lib01bCoreVendorContract.test.ts
bun run lint
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add vendor/trama-contextual-copilot-core package.json bun.lock src/security/lib01bCoreVendorContract.test.ts
git commit -m "build: pin shared contextual copilot core"
```

---

### Task 2: Adapter `LibrarySource → ContextSnapshot`

**Files:**
- Create: `src/copilot/libraryContextAdapter.ts`
- Create: `src/security/lib01bLibraryContextAdapter.test.ts`

**Interfaces:**
- Consumes: `LibrarySource`, `UdaRecord`, shared `ContextSnapshot`, `CapabilityId`, `DataClass`.
- Produces:

```ts
export interface LibraryUseContext {
  source: LibrarySource;
  activeUda?: UdaRecord | null;
}

export interface LibraryContextResult {
  snapshot: ContextSnapshot;
  activeUda: UdaRecord | null;
}

export function resolveLinkedActiveUda(source: LibrarySource, udas: readonly UdaRecord[]): UdaRecord | null;
export function createLibraryContextSnapshot(input: LibraryUseContext): ContextSnapshot;
```

- [ ] **Step 1: Write failing adapter tests**

Pin these cases:

```text
exactly one valid source.links[targetType=uda] -> that UDA is active
zero valid UDA links -> null
more than one valid UDA link -> null
orphan UDA link -> null
entities contain source id and optional UDA id, never payload/extractedText/sourceUrl
teacher-professional -> dataClasses=[TEACHER_PROFESSIONAL], remoteProviderAllowed=false
student-personal -> dataClasses=[STUDENT_PERSONAL], remoteProviderAllowed=false
unknown -> dataClasses=[], permission library:privacy-unclassified, remoteProviderAllowed=false
unknown/needs-review/restricted/failed exclude PREPARE,CREATE,SUMMARIZE,EXPLAIN
no active UDA excludes UDA-transform capability set
```

- [ ] **Step 2: Run isolated tests and confirm RED**

```bash
bun test src/security/lib01bLibraryContextAdapter.test.ts
```

Expected: module/function missing.

- [ ] **Step 3: Implement the minimal pure adapter**

Implement only the signatures above. Use:

```text
appId = registro-docente
surface = LIBRARY_SOURCE
```

Capability derivation must be a pure vertical eligibility function; it declares what the app can offer but performs no ranking and creates no `ContextualAction` objects.

- [ ] **Step 4: Verify GREEN**

```bash
bun test src/security/lib01bLibraryContextAdapter.test.ts
bun run lint
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/copilot/libraryContextAdapter.ts src/security/lib01bLibraryContextAdapter.test.ts
git commit -m "feat: adapt private library context for shared copilot"
```

---

### Task 3: Vertical action bindings through the shared registry/core

**Files:**
- Create: `src/copilot/libraryCopilot.ts`
- Create: `src/security/lib01bSharedCoreResolution.test.ts`

**Interfaces:**
- Consumes: `createActionRegistry`, `createFailClosedPolicyEngine`, `createContextualCopilotCore`, `ContextSnapshot`, shared `ContextualAction`.
- Produces:

```ts
export const LIBRARY_CONTEXT_ACTIONS: readonly ContextualAction[];
export function createLibraryCopilot(): ContextualCopilotCore;
export function resolveLibraryActions(snapshot: ContextSnapshot): Promise<readonly ResolvedAction[]>;
```

`LIBRARY_CONTEXT_ACTIONS` contains exactly:

```text
library.open-source          OPEN       READ_ONLY         generative=false semantic=false
library.review-source        REVIEW     READ_ONLY         generative=false semantic=false
library.link-active-uda      LINK       WRITE_REVERSIBLE  generative=false semantic=false
library.prepare-for-uda      PREPARE    PROPOSE           generative=true  semantic=false
library.create-activity-draft CREATE    PROPOSE           generative=true  semantic=false
library.summarize-for-uda    SUMMARIZE  PROPOSE           generative=true  semantic=false
library.explain-for-uda      EXPLAIN    PROPOSE           generative=true  semantic=false
```

The shared Core instance uses `generativeMode: 'none'` for LIB-01B.0.

- [ ] **Step 1: Write failing resolution tests**

Assert:

```text
resolved ids are a subset of snapshot.capabilities
unknown source context resolves only non-content local actions
with generativeMode=none all requiresGenerativeAI actions are absent/denied
LINK remains governed as WRITE_REVERSIBLE
attempting action outside declared capability returns DENIED and never executes
source privacy/payload is not reinterpreted in this module
module imports resolver primitives only from @trama/contextual-copilot-core
module contains no local sort/rank/policy fallback implementation
```

Also simulate Core/policy failure and assert no hardcoded action list is substituted.

- [ ] **Step 2: Confirm RED**

```bash
bun test src/security/lib01bSharedCoreResolution.test.ts
```

Expected: module missing.

- [ ] **Step 3: Implement bindings and shared Core construction**

Create action descriptors only; all filtering/order/dispatch semantics come from the shared Core package.

- [ ] **Step 4: Verify GREEN**

```bash
bun test src/security/lib01bSharedCoreResolution.test.ts
bun run lint
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/copilot/libraryCopilot.ts src/security/lib01bSharedCoreResolution.test.ts
git commit -m "feat: bind library actions to shared copilot core"
```

---

### Task 4: Governed execution adapter for OPEN, REVIEW and LINK

**Files:**
- Create: `src/copilot/libraryActionExecutor.ts`
- Create: `src/security/lib01bLibraryDispatch.test.ts`

**Interfaces:**
- Consumes: shared `ContextualCopilotCore.dispatch`, `LibrarySource`, `UdaRecord`, existing durable `onLink(sourceId, link): Promise<void>` callback.
- Produces:

```ts
export interface LibraryActionExecutionDeps {
  source: LibrarySource;
  activeUda: UdaRecord | null;
  onLink: (sourceId: string, link: LibrarySourceLink) => Promise<void>;
}

export type LibraryLocalActionResult =
  | { kind: 'OPEN_SOURCE'; sourceId: string }
  | { kind: 'REVIEW_SOURCE'; sourceId: string }
  | { kind: 'LINKED_UDA'; sourceId: string; udaId: string };

export function dispatchLibraryAction(input: {
  core: ContextualCopilotCore;
  context: ContextSnapshot;
  actionId: string;
  humanConfirmed?: boolean;
  deps: LibraryActionExecutionDeps;
}): Promise<DispatchResult<LibraryLocalActionResult>>;
```

- [ ] **Step 1: Write causal dispatch tests**

Pin:

```text
OPEN executes read-only result without durable mutation
REVIEW executes read-only result without durable mutation
LINK first call without humanConfirmed -> HUMAN_CONFIRMATION_REQUIRED and onLink calls=0
LINK confirmed with one explicit activeUda -> onLink calls=1 with exact source/uda ids
LINK without activeUda -> denied/local precondition result, onLink calls=0
dispatch denied by Core -> onLink calls=0
onLink rejection propagates; no false success is returned
double dispatch while UI pending is not solved here with a second queue; caller must guard through existing pending boundary
```

- [ ] **Step 2: Confirm RED**

```bash
bun test src/security/lib01bLibraryDispatch.test.ts
```

Expected: module missing.

- [ ] **Step 3: Implement minimal execution translation**

Executor may read `source.payload` only inside action execution. LIB-01B.0 does not call any provider or create proposal text.

- [ ] **Step 4: Verify GREEN**

```bash
bun test src/security/lib01bLibraryDispatch.test.ts
bun run lint
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/copilot/libraryActionExecutor.ts src/security/lib01bLibraryDispatch.test.ts
git commit -m "feat: govern private library action dispatch"
```

---

### Task 5: Progressive-disclosure presentation adapter

**Files:**
- Create: `src/components/LibraryContextActions.tsx`
- Modify: `src/components/LibrarySourceCard.tsx`
- Modify: `src/components/LibraryView.tsx`
- Create: `src/security/lib01bLibraryUiContract.test.ts`

**Interfaces:**
- Consumes: `ResolvedAction[]`, UDA choices, current selected target, dispatch callback, existing `isPending`.
- Produces:

```ts
interface LibraryContextActionsProps {
  actions: readonly ResolvedAction[];
  udas: readonly UdaRecord[];
  activeUda: UdaRecord | null;
  privacy: LibraryPrivacyStatus;
  isPending: boolean;
  onChooseTarget: (udaId: string | null) => void;
  onAction: (actionId: string) => Promise<void>;
}
```

`LibrarySourceCard.onUse` remains the entry point; selected card renders `LibraryContextActions` rather than the LIB-01A placeholder.

- [ ] **Step 1: Write failing UI contract tests**

Assert source structure enforces:

```text
LibraryContextActions receives resolved actions; it does not import/createActionRegistry/createContextualCopilotCore
at most first 3 actions are primary
'Altre possibilità' exists only when actions.length > 3
unknown privacy shows teacher-facing classification guidance and no technical provider/risk vocabulary
no activeUda + LINK presents explicit UDA target selector before dispatch
multiple links do not silently preselect an UDA
all mutable controls disabled while isPending
LibrarySourceCard still exposes one primary 'Usa' entry point
```

- [ ] **Step 2: Confirm RED**

```bash
bun test src/security/lib01bLibraryUiContract.test.ts
```

Expected: new component missing.

- [ ] **Step 3: Implement component and replace placeholder**

Keep source maintenance (`Gestisci`) separate. Do not move rename/delete/link maintenance into the copilot action resolver.

- [ ] **Step 4: Verify GREEN**

```bash
bun test src/security/lib01bLibraryUiContract.test.ts
bun run lint
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/LibraryContextActions.tsx src/components/LibrarySourceCard.tsx src/components/LibraryView.tsx src/security/lib01bLibraryUiContract.test.ts
git commit -m "feat: show shared contextual actions for library sources"
```

---

### Task 6: App wiring, pending semantics and durable LINK

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/LibraryView.tsx`
- Create: `src/security/lib01bAppIntegration.test.ts`

**Interfaces:**
- Consumes: `resolveLinkedActiveUda`, `createLibraryContextSnapshot`, `resolveLibraryActions`, `dispatchLibraryAction`, existing `handleLibraryLink` durable callback and existing application pending/error state.
- Produces: end-to-end `Usa → resolve shared Core → present → dispatch → confirm → durable link` flow.

- [ ] **Step 1: Write failing integration contract**

Assert:

```text
App/LibraryView resolution calls shared adapter/core path, not a hardcoded action array
selecting Usa performs no canonical mutation
LINK unconfirmed performs no canonical mutation
confirmed LINK routes through existing durable library handler
pending freezes target/action controls before a duplicate click can enqueue another intent
failure preserves selected source/target for retry and shows no success
success appears only after durable handler resolves
cancel leaves source links and UDA state unchanged
```

- [ ] **Step 2: Confirm RED**

```bash
bun test src/security/lib01bAppIntegration.test.ts
```

Expected: wiring absent.

- [ ] **Step 3: Implement minimal wiring**

Do not create a new durable coordinator. Reuse the existing application persistence boundary from LIB-01A/PERSIST-01H.

- [ ] **Step 4: Run focused + full security suite**

```bash
bun test src/security/lib01bAppIntegration.test.ts
bun test src/security/*.test.ts
bun run lint
bun run build
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/components/LibraryView.tsx src/security/lib01bAppIntegration.test.ts
git commit -m "feat: wire private library to shared contextual core"
```

---

### Task 7: Browser qualification LIB-01B.0

**Files:**
- Create: `tests/browser/lib01b-contextual-copilot-qualification.spec.cjs`
- Modify: `.github/workflows/browser-qualification.yml`

**Interfaces:**
- Consumes: production build, exact candidate SHA, existing Secure Local Vault browser harness.
- Produces: exact-SHA evidence for deterministic Core integration on mobile and desktop.

- [ ] **Step 1: Add browser scenarios as a test-only RED**

Desktop `1280×900` journey:

```text
create/unlock local vault
create synthetic UDA
add teacher-professional text source
link exactly one UDA or choose target explicitly
click Usa
assert compact action surface appears
assert <=3 primary actions + optional Altre possibilità
assert OPEN/REVIEW available through resolved UI
trigger LINK path on an unlinked source -> confirmation visible before write
cancel -> no link after reload
retry + confirm -> link persisted after reload
no false success while durable write pending
```

Privacy journey:

```text
add/source with privacy unknown
click Usa
assert classification guidance
assert no PREPARE/CREATE/SUMMARIZE/EXPLAIN teacher actions
assert no outbound request is generated by opening contextual actions
```

Mobile `390×844` journey:

```text
same secondary Biblioteca entry remains reachable
Usa + contextual actions have >=44px targets
no horizontal overflow
Altre possibilità disclosure remains usable
```

- [ ] **Step 2: Wire the new spec into Browser Qualification and verify RED before product GREEN if any requirement is still missing**

The workflow must continue exact-SHA checkout and run the new spec in the same Chromium qualification command.

- [ ] **Step 3: Fix only product defects proven by the browser RED**

If any failure is a test-selector error, correct only the test. If product behavior fails, invoke systematic debugging before patching.

- [ ] **Step 4: Require fresh exact-candidate gates**

Required final evidence:

```text
PREDEPLOY Security Qualification = SUCCESS
Browser Qualification = SUCCESS on pull_request.head.sha
new LIB-01B tests all PASS
existing LIB-01A browser journeys still PASS
```

Record artifact id + SHA256 digest.

- [ ] **Step 5: Commit final qualification harness changes**

```bash
git add tests/browser/lib01b-contextual-copilot-qualification.spec.cjs .github/workflows/browser-qualification.yml
git commit -m "test: qualify LIB-01B shared contextual copilot"
```

---

### Task 8: Independent review and human decision boundary

**Files:**
- No planned product changes; review fixes require their own RED→GREEN cycle.

**Interfaces:**
- Consumes: exact application candidate, full diff, PREDEPLOY/browser evidence, upstream provenance.
- Produces: review result with unresolved finding count and human merge boundary.

- [ ] **Step 1: Verify exact candidate freshness**

Confirm PR head matches all evidence and vendor `UPSTREAM.json` still points to the intended merged TRAMA SHA.

- [ ] **Step 2: Review these boundaries independently**

```text
no local resolver/ranking duplication
no payload leakage into ContextSnapshot
unknown/student privacy fail-closed
Core deny cannot reach executor
human confirmation required for LINK
no parallel persistence queue
vendor provenance/hash integrity
no remote provider/network path in LIB-01B.0
progressive disclosure and teacher-facing vocabulary
```

- [ ] **Step 3: Any finding requires causal RED → minimal GREEN → full requalification**

No direct review fix without regression evidence.

- [ ] **Step 4: Record review on exact SHA**

Target state before human decision:

```text
ENGINEERING QUALIFIED
EXACT-SHA BROWSER QUALIFIED
UPSTREAM-PIN VERIFIED
INDEPENDENT REVIEW PASS
0 BLOCKING FINDINGS
NO DEPLOY
AWAITING HUMAN MERGE DECISION
```

- [ ] **Step 5: Stop before merge**

Do not mark ready, merge, deploy or publish without a separate explicit human instruction.

---

## Self-review

### Spec coverage

- Cross-repository stable consumption: Task 1.
- Context/minimization/privacy mapping: Task 2.
- Shared action registry/core use, no local resolver: Task 3.
- Dispatch/confirmation/authority: Task 4.
- Progressive disclosure: Task 5.
- Durable integration/pending/failure semantics: Task 6.
- Mobile/desktop exact-SHA qualification: Task 7.
- Independent review/human merge boundary: Task 8.
- Provider/generative proposal path: intentionally excluded to LIB-01B.1 by spec.

No uncovered LIB-01B.0 requirement remains.

### Type consistency

- `LibrarySource`, `LibrarySourceLink`, `LibraryPrivacyStatus` stay owned by `src/library/types.ts`.
- `UdaRecord` stays owned by `src/types.ts`.
- Shared `ContextSnapshot`, `ContextualAction`, `ResolvedAction`, `ContextualCopilotCore` come only from `@trama/contextual-copilot-core`.
- UI receives resolved actions; it never creates the Core.
- Execution adapter receives durable callbacks rather than importing storage.

### Proportion / YAGNI

LIB-01B.0 deliberately stops at deterministic `OPEN`, `REVIEW`, `LINK`. No provider, proposal persistence, OCR, embedding, vector DB, server or new authority is introduced. The plan preserves the extension point for LIB-01B.1 without implementing it early.
