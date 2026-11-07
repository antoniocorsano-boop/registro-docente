# A4-R2A Canonical Class Identity Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make teacher-first class/UDA selection use stable Registro class identity instead of exact label strings, so typographic variants such as `1A` and `1ª A` do not create duplicate Copilot classes or hide legacy UDA.

**Architecture:** Add a pure fail-closed class-label resolver that maps presentation variants to a semantic reconciliation key but keeps `ClassData.id` as canonical identity. Build a teacher-first catalog from real classes plus legacy UDA, returning explicit resolved/ambiguous/unresolved states, then wire `LibraryCopilotComposer` to that catalog without rewriting persisted UDA/classes.

**Tech Stack:** TypeScript 7, React 19, Bun test, Playwright Browser Qualification, existing Secure Local Vault/A4-R1 teacher-first Copilot.

**Spec:** `docs/superpowers/specs/2026-10-29-a4-r2-canonical-class-uda-projection-design.md`

## Global Constraints

- Baseline starts from `registro-docente main@a6ede2f1e0c4b72e8594f00025e09b06e9627e5e` unless a fresh A0 audit proves main moved before implementation.
- `ClassData.id` is Registro class identity; normalized labels are reconciliation signals only.
- Do not rewrite, delete or merge `ClassData` or `UdaRecord` persistence in A4-R2A.
- Do not choose among multiple real class IDs by array order, UDA presence, student count or preferred spelling.
- No new provider, remote call, persistence schema or Copilot capability.
- Preserve A4-R1/AIC-07 pre-Play authority and privacy boundaries.
- Synthetic-only browser fixtures.
- No merge, deploy or publication without a separate human decision.

## Review Focus

- `1A`, `1 A`, `1ª A` and case/spacing variants that are explicitly supported must reconcile to the same semantic key without becoming the identity itself; Task 1 tests this.
- Unsupported/free-form labels such as `prima A gruppo` must fail closed rather than fuzzily matching; Task 1 tests this.
- Two real `ClassData.id` values with the same semantic key must return `ambiguous` and never pick a winner; Tasks 1–2 test this.
- A legacy UDA bound to `1ª A` must become available after selecting real class `1A`, while no duplicate `1ª A` class choice is rendered; Tasks 2–4 test this.
- A4-R1 remote-call and single-class authority invariants must remain unchanged after catalog wiring; Task 4 keeps the historical browser regression in the gate.

---

### Task 1: Pure canonical class-label resolver

**Files:**
- Create: `src/teaching/classIdentity.ts`
- Create: `src/teaching/classIdentity.test.ts`

**Interfaces:**
- Consumes: `ClassData` identity/label values from `src/types.ts` only as plain inputs.
- Produces:
  - `parseLowerSecondaryClassSemanticKey(label: string): string | null`
  - `resolveCanonicalRegistroClass(sourceLabel: string, classes: Array<{ id: string; name: string }>): CanonicalClassResolution`
  - `CanonicalClassResolution` union matching the spec semantics.

- [ ] **Step 1: Write the failing semantic-key tests**

Test names/assertions:
- `parses supported compact and ordinal class labels to the same semantic key`: `1A`, `1 A`, `1ª A` -> `1:A`; `3A`, `3ª A` -> `3:A`.
- `rejects labels that do not encode one unambiguous lower-secondary grade and section`: examples return `null`.

- [ ] **Step 2: Run the focused test and verify causal RED**

Run: `bun test src/teaching/classIdentity.test.ts`

Expected: FAIL because `src/teaching/classIdentity.ts` does not exist.

- [ ] **Step 3: Implement the minimal strict parser**

Create `parseLowerSecondaryClassSemanticKey(label: string): string | null` with only the forms required by the spec/tests; no fuzzy similarity or locale heuristics.

- [ ] **Step 4: Add failing resolver tests**

Test names/assertions:
- `resolves a variant label to the single real Registro class id`.
- `returns ambiguous when two real class ids share the same semantic key`.
- `returns unresolved when the source label cannot be parsed or has no real class candidate`.

- [ ] **Step 5: Implement the minimal resolver**

Implement `resolveCanonicalRegistroClass(...)` so `resolved` contains the one `classId`, preferred real class `label`, and observed aliases; `ambiguous` contains all matching real class IDs; no arbitrary tie-break.

- [ ] **Step 6: Run focused tests**

Run: `bun test src/teaching/classIdentity.test.ts`

Expected: PASS.

- [ ] **Step 7: Run typecheck**

Run: `bun run lint`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/teaching/classIdentity.ts src/teaching/classIdentity.test.ts
git commit -m "feat(a4-r2): add canonical class identity resolver"
```

### Task 2: Teacher-first class/UDA catalog

**Files:**
- Create: `src/copilot/teacherFirstTeachingCatalog.ts`
- Create: `src/copilot/teacherFirstTeachingCatalog.test.ts`
- Read/consume: `src/types.ts`
- Read/consume: `src/teaching/classIdentity.ts`

**Interfaces:**
- Consumes:
  - `classes: ClassData[]`
  - `udas: UdaRecord[]`
- Produces:
  - `buildTeacherFirstTeachingCatalog(input): TeacherFirstTeachingCatalog`
  - catalog class entries keyed by real `classId`, with one display label, aliases, matching legacy UDA IDs, and explicit ambiguity records.
  - `udasForCanonicalClass(catalog, classId): UdaRecord[]`

- [ ] **Step 1: Write the causal legacy-label RED**

Fixture:
- real classes `[{ id: 'class-1a', name: '1A' }, { id: 'class-1c', name: '1C' }]`;
- UDA `[{ id: 'uda-legacy', className: '1ª A', ... }]`.

Assertions:
- catalog has exactly two selectable resolved classes (`1A`, `1C`), not `1ª A` as a third class;
- `udasForCanonicalClass(..., 'class-1a')` returns `uda-legacy`.

- [ ] **Step 2: Add ambiguity RED**

Fixture two real class IDs named `3A` and `3ª A` plus one UDA using the same semantic key.

Assertions:
- no single canonical class is inferred for that semantic key;
- ambiguity exposes both real IDs;
- UDA is not silently attached to either candidate.

- [ ] **Step 3: Run focused tests and verify RED**

Run: `bun test src/copilot/teacherFirstTeachingCatalog.test.ts`

Expected: FAIL because the catalog module does not exist.

- [ ] **Step 4: Implement the derived catalog**

Use only `ClassData.id`, class labels and `UdaRecord.className`; preserve original arrays; no persistence mutation. The catalog must derive UDA membership through `parseLowerSecondaryClassSemanticKey` and `resolveCanonicalRegistroClass`.

- [ ] **Step 5: Run catalog + identity tests**

Run: `bun test src/teaching/classIdentity.test.ts src/copilot/teacherFirstTeachingCatalog.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/copilot/teacherFirstTeachingCatalog.ts src/copilot/teacherFirstTeachingCatalog.test.ts
git commit -m "feat(a4-r2): derive teacher-first canonical class catalog"
```

### Task 3: Wire A4-R1 Composer to canonical class identity

**Files:**
- Modify: `src/components/LibraryCopilotComposer.tsx`
- Create: `src/security/a4R2CanonicalClassComposerContract.test.ts`
- Read/consume: `src/copilot/teacherFirstTeachingCatalog.ts`

**Interfaces:**
- Consumes: `classNames` is not sufficient for canonical identity; add a prop carrying real classes or `{ id, name }[]` from App while retaining the current teacher-facing labels.
- Produces: class-choice UI bound to real `classId`; selected class state is an ID, not a label string; legacy UDA retrieval goes through `udasForCanonicalClass`.

- [ ] **Step 1: Write source-contract RED**

Assertions against Composer/App source:
- Composer imports the canonical catalog helper.
- teacher-first selected class state stores/receives canonical class ID rather than comparing `uda.className === teacherFirstClassName`.
- raw union `...classNames, ...udas.map(uda => uda.className)` is absent from the class-choice construction.

- [ ] **Step 2: Run the contract test and verify RED**

Run: `bun test src/security/a4R2CanonicalClassComposerContract.test.ts`

Expected: FAIL on the current A4-R1 implementation.

- [ ] **Step 3: Implement minimal App/Composer wiring**

Pass real class identities from `appData.classes` into the Composer. Build the catalog with current UDA. Render resolved class labels once. If the requested semantic target is ambiguous, show teacher-facing reconciliation choices and do not advance UDA targeting until the teacher selects a real class ID.

- [ ] **Step 4: Preserve A4-R1 teacher-language behavior**

Ensure the existing message/quick-start flow and pre-Play remote-call prohibition are not changed by this task.

- [ ] **Step 5: Run security + focused unit suites**

Run:
- `bun test src/security/a4R2CanonicalClassComposerContract.test.ts`
- `bun test src/teaching/classIdentity.test.ts src/copilot/teacherFirstTeachingCatalog.test.ts`
- `bun run test:security`

Expected: PASS.

- [ ] **Step 6: Build production bundle**

Run: `bun run build`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/LibraryCopilotComposer.tsx src/App.tsx src/security/a4R2CanonicalClassComposerContract.test.ts
git commit -m "fix(a4-r2): bind teacher-first flow to canonical class ids"
```

### Task 4: Permanent real-browser regression and exact-SHA qualification

**Files:**
- Create: `tests/browser/a4-r2-canonical-class.spec.cjs`
- Modify: `.github/workflows/browser-qualification.yml`
- Preserve: `tests/browser/a4-r1-teacher-first.spec.cjs`

**Interfaces:**
- Consumes: production UI from Tasks 1–3.
- Produces: permanent Browser Qualification evidence for canonical class/UDA behavior.

- [ ] **Step 1: Add the browser test first and preserve causal evidence**

Scenario at 390×844:
- create real classes `1A` and `1C`;
- create one synthetic UDA whose persisted `className` is `1ª A`;
- open Copilot and submit `Attività per le classi prime`;
- assert class-choice buttons are exactly `1A` and `1C` for the grade-1 candidates, with no `1ª A` duplicate;
- choose `1A`;
- assert the synthetic UDA is available and the false “non c’è ancora una UDA disponibile” state is absent;
- intercept `**/api/copilot/**` and assert zero pre-Play calls.

Also add one browser case for two real semantically equivalent class records; assert explicit ambiguity UI and no automatic UDA target.

- [ ] **Step 2: Run Browser Qualification on the pre-fix/test-only checkpoint if preserving a separate RED branch is operationally practical**

Expected causal failure: duplicate class or missing UDA on current behavior. Do not weaken locators to manufacture RED.

- [ ] **Step 3: Register the new spec permanently in Browser Qualification**

Do not remove or skip A4-R1/historical journeys.

- [ ] **Step 4: Run exact-head PREDEPLOY**

Expected:
- frozen install PASS;
- typecheck PASS;
- security/library tests PASS;
- production build PASS;
- production startup smoke PASS.

- [ ] **Step 5: Run exact-head Browser Qualification**

Expected:
- new A4-R2A tests PASS;
- historical A4-R1 PASS;
- desktop/mobile historical regressions PASS;
- UX-QA-01 PASS, 0 blocking findings;
- UX-QA-02 PASS, 0 blocking findings;
- evidence artifact + digest recorded.

- [ ] **Step 6: Fresh whole-slice review**

Review focus: hidden tie-breaks, class-ID drift, destructive persistence, A4-R1 authority regression, duplicate UI identity. Require zero unresolved Important/Critical findings.

- [ ] **Step 7: Freeze exact candidate and update PR receipt**

State must be `A4-R2A ENGINEERING + BROWSER QUALIFIED / HUMAN INTEGRATION DECISION PENDING`.

- [ ] **Step 8: Commit final browser/harness changes**

```bash
git add tests/browser/a4-r2-canonical-class.spec.cjs .github/workflows/browser-qualification.yml
git commit -m "test(a4-r2): qualify canonical class identity in browser"
```
