# EDU-PLAN-01A Domain & Persistence Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the cohort-aware annual-planning domain, ordinance/calendar calculations and encrypted durable persistence without replacing the existing UDA/Gantt model.

**Architecture:** Introduce a focused `src/planning/` domain whose root aggregate is `PlanningStateV1`. Persist it as a new `planning` record in the existing Secure Local Vault and include it in backup v3. Legacy `UdaRecord`, grades and `Q1/Q2` remain untouched in this tranche; the new domain uses configurable assessment periods and real dates.

**Tech Stack:** TypeScript 7, Bun tests, IndexedDB/Web Crypto Secure Local Vault, existing durable mutation coordinator.

**Spec:** `docs/superpowers/specs/2026-10-24-edu-plan-01-consolidation-amendment-v1.1.md`

## Global Constraints

- New planning types do not extend `UdaRecord` in place.
- New period semantics use arbitrary stable IDs; no `Q1 | Q2` union in the planning domain.
- Cohort/regime is explicit and versioned.
- Primary school disciplinary hours are not invented when national law does not fix them.
- National reference, local allocation and effective class capacity remain separate values.
- Reserve defaults to 15% and is teacher-adjustable.
- New `planning` persistence obeys commit-first semantics and increments backup-change metadata atomically.
- Backup v2 and legacy backups remain importable; they receive an empty planning state during normalization.
- No Arena import, ISBN lookup, file ingestion or AI is implemented in this tranche.

## Review Focus

- Existing v2 encrypted backup imported after the new `planning` record exists → restores legacy data and initializes empty planning without false completeness.
- Primary profile with no national discipline hours → UI/domain reports local-definition required rather than synthesizing hours.
- Assessment periods overlap or leave invalid dates → validation rejects the profile before persistence.
- Calendar has a weekly slot on a closure/holiday → that slot does not count toward effective capacity.
- Reserve override outside the supported range → validation rejects it rather than silently clamping.

---

## File structure

**Create**
- `src/planning/types.ts` — stable EDU-PLAN domain interfaces.
- `src/planning/emptyPlanningState.ts` — canonical empty aggregate.
- `src/planning/normative/italianFirstCycle.ts` — versioned national ordinance reference data only.
- `src/planning/validation.ts` — profile/calendar validation.
- `src/planning/capacity.ts` — teaching-slot and reserve calculations.
- `src/persistence/planningMutation.ts` — pure planning-state mutation helper.
- `src/security/planningDomain.test.ts`
- `src/security/planningPersistence.test.ts`
- `src/security/planningBackupCompatibility.test.ts`

**Modify**
- `src/types.ts` — add only `ActiveTab` value later needed by the planning UI if required by compilation; do not place planning domain types here.
- `src/security/vaultTypes.ts` — add `planning` to fixed record keys.
- `src/security/secureAppStorage.ts` — load/save `PlanningStateV1` atomically with metadata and include in complete snapshots.
- `src/security/backupPayload.ts` — introduce backup v3 and v2/legacy normalization.
- `src/App.tsx` — initialize planning state/ref and a durable `commitPlanningMutation` callback; no planning UI yet.
- Existing backup/security tests where snapshot fixtures must gain `planning`.

### Task 1: Freeze the planning domain contracts

**Files:**
- Create: `src/planning/types.ts`
- Create: `src/planning/emptyPlanningState.ts`
- Test: `src/security/planningDomain.test.ts`

**Interfaces:**
- Produces: `PlanningStateV1`, `TeachingProfile`, `AssessmentPeriodDefinition`, `TeachingCalendar`, `WeeklyTeachingSlot`, `NormativeReference`, `LocalTeachingAllocation`, `EffectiveCapacity`, `ArenaPlanningContext`, `PrivateTeachingResource`, `MasterProgram`, `MasterProgramVersion`, `ClassProgramInstance`.
- Produces: `createEmptyPlanningState(): PlanningStateV1`.

- [ ] **Step 1: Write the failing type/runtime-shape test**

Create tests that instantiate `PlanningStateV1` with `schemaVersion: 1`, no profiles/contexts/resources/master programs/class instances, and prove assessment-period IDs accept values such as `trimestre-1` rather than a `Q1/Q2` enum.

- [ ] **Step 2: Run the focused test**

Run: `bun test src/security/planningDomain.test.ts`
Expected: FAIL because the planning module does not exist.

- [ ] **Step 3: Add the exact domain interfaces**

Required minimum signatures:

```ts
export type SchoolOrder = 'primary' | 'lower_secondary';

export interface AssessmentPeriodDefinition {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  ordinal: number;
}

export interface TeachingProfile {
  id: string;
  schoolYear: string;
  schoolOrder: SchoolOrder;
  gradeLevel: number;
  cohortRef: string;
  subjectCode: string;
  normativeReference: NormativeReference;
  localAllocation?: LocalTeachingAllocation;
  reservePercent: number;
  assessmentPeriods: AssessmentPeriodDefinition[];
  calendar: TeachingCalendar;
}

export interface PlanningStateV1 {
  schemaVersion: 1;
  profiles: TeachingProfile[];
  arenaContexts: ArenaPlanningContext[];
  resources: PrivateTeachingResource[];
  masterPrograms: MasterProgram[];
  classInstances: ClassProgramInstance[];
}

export function createEmptyPlanningState(): PlanningStateV1;
```

Use string/reference fields for future Arena entities rather than embedding Arena implementation types.

- [ ] **Step 4: Re-run the focused test**

Run: `bun test src/security/planningDomain.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/planning/types.ts src/planning/emptyPlanningState.ts src/security/planningDomain.test.ts
git commit -m "feat: add planning domain foundation"
```

### Task 2: Add versioned Italian first-cycle ordinance defaults

**Files:**
- Create: `src/planning/normative/italianFirstCycle.ts`
- Modify: `src/security/planningDomain.test.ts`

**Interfaces:**
- Consumes: `SchoolOrder`, `NormativeReference`.
- Produces: `getFirstCycleNormativeReference(input): NormativeReference`.

- [ ] **Step 1: Add failing ordinance tests**

Pin these product rules:
- lower-secondary `tecnologia` → `nationalWeeklyHours: 2`, `nationalAnnualHours: 66`, `nationalHoursDefined: true`;
- lower-secondary `inglese` → `3`, `99`, `true`;
- primary ordinary disciplines → `nationalHoursDefined: false` with no invented discipline-hour value;
- every returned record carries a stable `sourceRef` and `version`.

- [ ] **Step 2: Run the test and confirm causal RED**

Run: `bun test src/security/planningDomain.test.ts`
Expected: FAIL only on missing normative lookup behavior.

- [ ] **Step 3: Implement the lookup**

```ts
export function getFirstCycleNormativeReference(input: {
  schoolOrder: SchoolOrder;
  subjectCode: string;
  schoolYear: string;
}): NormativeReference;
```

Keep the data table separate from curriculum-regime applicability; this function supplies ordinance hours/provenance, not Arena authority.

- [ ] **Step 4: Run tests**

Run: `bun test src/security/planningDomain.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/planning/normative/italianFirstCycle.ts src/security/planningDomain.test.ts
git commit -m "feat: add first-cycle ordinance references"
```

### Task 3: Validate periods/calendar and calculate effective capacity

**Files:**
- Create: `src/planning/validation.ts`
- Create: `src/planning/capacity.ts`
- Modify: `src/security/planningDomain.test.ts`

**Interfaces:**
- Produces: `validateTeachingProfile(profile: TeachingProfile): string[]`.
- Produces: `calculateEffectiveCapacity(profile: TeachingProfile): EffectiveCapacity`.

- [ ] **Step 1: Write failing validation/capacity tests**

Cover: overlapping assessment periods; end date before start; reserve `<0` or `>50`; weekly slots on closure dates excluded; class calendar start/end respected; `reservePercent: 15` returns `programmableHours = effectiveHours * 0.85` with deterministic rounding policy documented in the test.

- [ ] **Step 2: Run focused tests**

Run: `bun test src/security/planningDomain.test.ts`
Expected: FAIL on missing validators/calculator.

- [ ] **Step 3: Implement pure functions**

No React, storage, network or current date access inside these functions. Treat calendar dates as local `YYYY-MM-DD` values and make rounding explicit at the final total only.

- [ ] **Step 4: Re-run tests**

Run: `bun test src/security/planningDomain.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/planning/validation.ts src/planning/capacity.ts src/security/planningDomain.test.ts
git commit -m "feat: calculate planning capacity"
```

### Task 4: Persist planning state in the Secure Local Vault

**Files:**
- Create: `src/persistence/planningMutation.ts`
- Create: `src/security/planningPersistence.test.ts`
- Modify: `src/security/vaultTypes.ts`
- Modify: `src/security/secureAppStorage.ts`
- Modify: `src/App.tsx`

**Interfaces:**
- Produces: `applyPlanningMutation(current: PlanningStateV1, derive): PlanningStateV1`.
- Produces on storage: `savePlanningAndMeta(planning: PlanningStateV1, meta: SecureMeta): Promise<void>`.
- App owns `commitPlanningMutation(derive: (current: PlanningStateV1) => PlanningStateV1): Promise<PlanningStateV1>`.

- [ ] **Step 1: Write failing vault/persistence tests**

Assert `planning` round-trips encrypted; failed write does not publish new planning state; planning+meta use one `putMany`; initial missing record maps to `createEmptyPlanningState()` at App boundary.

- [ ] **Step 2: Run focused tests**

Run: `bun test src/security/planningPersistence.test.ts`
Expected: FAIL because `planning` is not a valid vault record.

- [ ] **Step 3: Extend fixed vault/snapshot contract**

Add `planning` to `VaultRecordKey`, `SecureAppSnapshot`, `CompleteSecureAppSnapshot`, `SNAPSHOT_KEYS`, `loadSnapshot()` and atomic complete-snapshot write/rollback paths.

- [ ] **Step 4: Add App durable mutation state**

Initialize from `initialSnapshot.planning || createEmptyPlanningState()`, keep a committed ref, and use the existing mutation coordinator with `savePlanningAndMeta`.

- [ ] **Step 5: Run focused and existing persistence tests**

Run: `bun test src/security/planningPersistence.test.ts src/security/*Persistence*.test.ts src/security/*mutation*.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/persistence/planningMutation.ts src/security/vaultTypes.ts src/security/secureAppStorage.ts src/App.tsx src/security/planningPersistence.test.ts
git commit -m "feat: persist planning state in secure vault"
```

### Task 5: Introduce backup v3 with backward compatibility

**Files:**
- Create: `src/security/planningBackupCompatibility.test.ts`
- Modify: `src/security/backupPayload.ts`
- Modify: backup fixture/tests that construct `CompleteSecureAppSnapshot`

**Interfaces:**
- Produces: `BACKUP_DATA_VERSION_V3 = 3`.
- `normalizeBackupPayload()` accepts v3, v2 and legacy; only v3 can contain persisted planning.

- [ ] **Step 1: Write failing backup compatibility tests**

Assert:
- v3 round-trips planning exactly;
- v2 imports existing records and injects `createEmptyPlanningState()`;
- legacy imports inject empty planning;
- unknown version remains rejected.

- [ ] **Step 2: Run tests and confirm RED**

Run: `bun test src/security/planningBackupCompatibility.test.ts`
Expected: FAIL on v3/missing planning normalization.

- [ ] **Step 3: Implement backup v3 normalization**

Do not mutate v2 payload semantics; add an explicit v2 type guard and convert it into the new complete snapshot shape.

- [ ] **Step 4: Run full test/type/build gate**

Run:
```bash
bun test src/security/*.test.ts
bun run lint
bun run build
```
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/security/backupPayload.ts src/security/planningBackupCompatibility.test.ts src/security
git commit -m "feat: include planning in backup v3"
```

## Tranche exit gate

- Exact candidate SHA pinned.
- Full Bun security suite PASS.
- Typecheck/build PASS.
- No visible UDA/Gantt behavior changed.
- Encrypted backup v2/legacy restore compatibility demonstrated.
- Human review confirms ordinance provenance/capacity semantics before Tranche B/C start.
