# EDU-PLAN-01E Class Adoption & Three-Way Merge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Instantiate an approved level master program on selected classes, allow local adaptations and progress recording, then apply later master changes selectively through a safe three-way merge.

**Architecture:** A `ClassProgramInstance` points to the exact adopted `MasterProgramVersion` and stores local overrides/execution separately. Merge compares base version, incoming master version and class-local effective state; non-conflicting changes are auto-applicable, true conflicts become explicit decisions. Actual sessions/evidence are append-only operational history and are never deleted by a mother-program update.

**Tech Stack:** TypeScript/Bun pure merge engine, React planning UI, Secure Local Vault `PlanningStateV1` persistence.

**Spec:** `docs/superpowers/specs/2026-10-24-edu-plan-01-programmazione-didattica-design.md`

## Global Constraints

- Adoption always references one exact approved master-version ID.
- Teacher selects destination classes explicitly; there is no “update all” side effect.
- Local class changes never mutate the master program.
- Automatic merge is permitted only for non-conflicting changes.
- A conflict means base→incoming and base→class both changed the same semantic field incompatibly.
- Completed/partially completed execution is never deleted or rewritten by incoming master changes.
- Removing an UDA upstream that has execution history downstream must produce a conflict.
- No student-personal information is stored in class planning execution records.
- All visible adoption/merge success is post-commit only.

## Review Focus

- Master deletes an UDA already partially completed in 2C → conflict, never silent delete.
- Class changes hours while master changes only title → merge both automatically.
- Class and master both move same UDA to different date window → conflict.
- Same incoming version applied twice → idempotent, no duplicate overrides/history.
- Merge persistence fails after teacher resolves conflicts → old class instance remains the visible committed state.

---

## File structure

**Create**
- `src/planning/classInstances.ts`
- `src/planning/classMerge.ts`
- `src/planning/progress.ts`
- `src/components/planning/ClassAdoptionDialog.tsx`
- `src/components/planning/MasterUpdateDialog.tsx`
- `src/components/planning/ClassMergeConflictResolver.tsx`
- `src/components/planning/ClassProgramProgressView.tsx`
- `src/security/classProgramAdoption.test.ts`
- `src/security/classProgramMerge.test.ts`
- `src/security/classProgramUiContract.test.ts`

**Modify**
- `src/planning/types.ts`
- `src/components/planning/MasterProgramWorkspace.tsx`
- `src/App.tsx`

### Task 1: Create class instances from one exact approved master version

**Interfaces:**
```ts
export function adoptMasterProgram(input: {
  state: PlanningStateV1;
  masterProgramId: string;
  masterVersionId: string;
  classIds: string[];
  adoptedAt: string;
}): PlanningStateV1;
```

- [ ] **Step 1: Write failing adoption tests**

Assert only selected classes receive instances; duplicate class ID is normalized/rejected deterministically; draft/superseded-invalid reference cannot be adopted as if approved; each instance stores `baseMasterVersionId` and starts `aligned` with empty local overrides.

- [ ] **Step 2: Run** `bun test src/security/classProgramAdoption.test.ts` → expected FAIL.
- [ ] **Step 3: Implement `adoptMasterProgram` in `src/planning/classInstances.ts`**.
- [ ] **Step 4: Re-run** → PASS.
- [ ] **Step 5: Commit**

```bash
git add src/planning/classInstances.ts src/planning/types.ts src/security/classProgramAdoption.test.ts
git commit -m "feat: adopt master programs on classes"
```

### Task 2: Store local overrides and execution separately

**Interfaces:**
```ts
export function applyClassProgramOverride(
  instance: ClassProgramInstance,
  override: ClassProgramOverride
): ClassProgramInstance;

export function recordClassUdaSession(
  instance: ClassProgramInstance,
  session: ClassUdaSession
): ClassProgramInstance;
```

`ClassUdaSession` contains session ID, master UDA stable ID, date, hours, optional topic/notes/activity type; it contains no student ID/name/grade.

- [ ] **Step 1: Add failing tests** for title/date/hour override, execution append/idempotency and status `locally_modified`.
- [ ] **Step 2: Run focused tests** → FAIL.
- [ ] **Step 3: Implement in `classInstances.ts` and `progress.ts`**.
- [ ] **Step 4: Re-run** → PASS.
- [ ] **Step 5: Commit**.

### Task 3: Implement semantic three-way merge preview

**Interfaces:**
```ts
export function previewMasterUpdate(input: {
  base: MasterProgramVersion;
  incoming: MasterProgramVersion;
  instance: ClassProgramInstance;
}): ClassMasterUpdatePreview;
```

`ClassMasterUpdatePreview` contains `autoChanges[]`, `conflicts[]`, `preservedExecution[]`, `incomingVersionId`.

- [ ] **Step 1: Write failing merge matrix tests**

Pin at least: master-only title edit; class-only hours edit; disjoint edits; same-field same-value edit; divergent same-field edit; upstream delete with no local/execution; upstream delete with execution; dependency change; new master UDA; reordering.

- [ ] **Step 2: Run** `bun test src/security/classProgramMerge.test.ts` → expected FAIL.
- [ ] **Step 3: Implement field-aware merge in `src/planning/classMerge.ts`**

Do not use raw JSON equality for an entire UDA as conflict detection. Compare stable UDA IDs and semantic fields independently; set-like arrays (requirement/resource refs) compare normalized IDs.

- [ ] **Step 4: Re-run** → PASS.
- [ ] **Step 5: Commit**.

### Task 4: Apply resolved merge atomically

**Interfaces:**
```ts
export type ClassMergeResolution = {
  conflictId: string;
  choice: 'keep_class' | 'use_master' | 'combine';
};

export function applyMasterUpdate(input: {
  instance: ClassProgramInstance;
  preview: ClassMasterUpdatePreview;
  resolutions: ClassMergeResolution[];
}): ClassProgramInstance;
```

- [ ] **Step 1: Add failing apply/idempotency tests**

Unresolved conflict blocks apply; `combine` accepted only for conflict types explicitly marked combinable; successful apply updates base/adopted master version; execution remains byte-equivalent.

- [ ] **Step 2: Run merge tests** → FAIL.
- [ ] **Step 3: Implement resolver/apply function**.
- [ ] **Step 4: Re-run** → PASS.
- [ ] **Step 5: Commit**.

### Task 5: Build selective adoption/update UI and progress view

**Files:** UI files listed above, `MasterProgramWorkspace.tsx`, `App.tsx`, `classProgramUiContract.test.ts`.

- [ ] **Step 1: Write failing UI contract tests**

Assert explicit class checkboxes; impact-preview step precedes apply; conflicts expose class/master values and `Mantieni classe` / `Usa madre` plus `Combina` only when supported; completed hours/history remain visible.

- [ ] **Step 2: Run focused UI tests** → FAIL.
- [ ] **Step 3: Implement adoption dialog** with no default selection that silently targets all classes.
- [ ] **Step 4: Implement update preview/conflict resolver**.
- [ ] **Step 5: Implement class progress screen** showing planned vs completed, remaining hours and forecast inputs from calendar capacity.
- [ ] **Step 6: Persist via one `commitPlanningMutation` per confirmed operation**; never publish partial class-by-class success.
- [ ] **Step 7: Run tests/type/build**

```bash
bun test src/security/classProgram*.test.ts
bun run lint
bun run build
```
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components/planning src/App.tsx src/security/classProgramUiContract.test.ts
git commit -m "feat: add selective class program updates"
```

## Tranche exit gate

Browser qualification must prove mother v1 adoption on 2A/2B/2C, a local 2C modification, mother v2 selection for 2A/2B only, automatic non-conflicting merge, explicit conflict resolution, preserved execution, idempotent retry and persistence after reload/unlock.
