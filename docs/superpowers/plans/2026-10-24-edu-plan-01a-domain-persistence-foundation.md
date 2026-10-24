# EDU-PLAN-01A Domain & Persistence Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the cohort-aware annual-planning domain, Italian first-cycle ordinance/calendar calculations and encrypted durable persistence without replacing the existing UDA/Gantt model.

**Architecture:** Introduce a focused `src/planning/` domain whose root aggregate is `PlanningStateV1`. Persist it as a new `planning` record in the existing Secure Local Vault and include it in backup v3. Legacy `UdaRecord`, grades and `Q1/Q2` remain untouched in this tranche; the new domain uses configurable assessment periods, explicit time-school models, ordinance allocation scopes and real dates.

**Tech Stack:** TypeScript 7, Bun tests, IndexedDB/Web Crypto Secure Local Vault, existing durable mutation coordinator.

**Spec:** `docs/superpowers/specs/2026-10-24-edu-plan-01-consolidation-amendment-v1.1.md`

## Global Constraints

- New planning types do not extend `UdaRecord` in place.
- New period semantics use arbitrary stable IDs; no `Q1 | Q2` union in the planning domain.
- Cohort/regime is explicit and versioned.
- Ordinance data distinguishes hours assigned to one discipline from hours assigned to a discipline group.
- Do not invent an Italian/History/Geography or Mathematics/Science split where the national framework assigns a grouped amount.
- Primary school disciplinary hours are not invented when national law leaves distribution to the institution.
- Time-prolonged total weekly time does not imply invented per-discipline hours; local allocation remains explicit unless a verified national table supplies it.
- National reference, local allocation and effective class capacity remain separate values.
- Calendar provenance is layered: regional reference → institution adjustments → class timetable/exceptions.
- Reserve defaults to 15% and is teacher-adjustable.
- New `planning` persistence obeys commit-first semantics and increments backup-change metadata atomically.
- Backup v2 and legacy backups remain importable; they receive an empty planning state during normalization.
- No Arena import, ISBN lookup, file ingestion or AI is implemented in this tranche.

## Review Focus

- Ordinary lower-secondary Technology → exactly 2 h/week and 66 h/year national discipline allocation.
- Ordinary lower-secondary Italian selected individually → the national source exposes the 9/297 literary-historical-geographical group and requires a local split instead of inventing Italian hours.
- Primary discipline → national discipline hours remain undefined and local allocation is required.
- Weekly slot that falls on a regional/institution/class closure → excluded exactly once from effective capacity.
- Existing v2 encrypted backup → restores legacy state and initializes empty planning without false completeness.

---

## File structure

**Create**
- `src/planning/types.ts`
- `src/planning/emptyPlanningState.ts`
- `src/planning/normative/italianFirstCycle.ts`
- `src/planning/validation.ts`
- `src/planning/capacity.ts`
- `src/persistence/planningMutation.ts`
- `src/security/planningDomain.test.ts`
- `src/security/planningPersistence.test.ts`
- `src/security/planningBackupCompatibility.test.ts`

**Modify**
- `src/security/vaultTypes.ts`
- `src/security/secureAppStorage.ts`
- `src/security/backupPayload.ts`
- `src/App.tsx`
- Existing snapshot/backup tests that construct `CompleteSecureAppSnapshot`.

### Task 1: Freeze the planning domain contracts

**Interfaces:**

```ts
export type SchoolOrder = 'primary' | 'lower_secondary';

export type SchoolTimeModel =
  | 'primary_24'
  | 'primary_27'
  | 'primary_up_to_30'
  | 'primary_40'
  | 'lower_secondary_ordinary_30'
  | 'lower_secondary_extended_36'
  | 'lower_secondary_extended_40';

export type NormativeAllocationScope =
  | 'discipline'
  | 'discipline_group'
  | 'institution_defined';

export interface NormativeReference {
  sourceRef: string;
  version: string;
  allocationScope: NormativeAllocationScope;
  subjectCodes: string[];
  nationalWeeklyHours?: number;
  nationalAnnualHours?: number;
  requiresLocalSplit: boolean;
}

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
  timeModel: SchoolTimeModel;
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

`TeachingCalendar` must contain school start/end, provenance refs for regional/institution layers, closure/exception dates and class weekly slots.

- [ ] **Step 1: Write failing domain-shape tests** proving arbitrary assessment-period IDs, explicit time model, allocation scope and empty aggregate shape.
- [ ] **Step 2: Run** `bun test src/security/planningDomain.test.ts` → expected FAIL.
- [ ] **Step 3: Implement `src/planning/types.ts` and `createEmptyPlanningState()`** with no Arena implementation imports.
- [ ] **Step 4: Re-run** → PASS.
- [ ] **Step 5: Commit** `feat: add planning domain foundation`.

### Task 2: Add versioned first-cycle ordinance catalog without false precision

**Interfaces:**

```ts
export function listFirstCycleSubjects(input: {
  schoolOrder: SchoolOrder;
  timeModel: SchoolTimeModel;
}): NormativeSubjectOption[];

export function getFirstCycleNormativeReference(input: {
  schoolOrder: SchoolOrder;
  timeModel: SchoolTimeModel;
  subjectCode: string;
  schoolYear: string;
}): NormativeReference;
```

- [ ] **Step 1: Write failing ordinance tests**

For `lower_secondary_ordinary_30`, pin the national table:
- literary/history/geography group → 9 weekly / 297 annual, `discipline_group`, local split required for a single member discipline;
- literary-depth activity → 1 / 33;
- mathematics/science group → 6 / 198, `discipline_group`;
- Technology → 2 / 66, `discipline`;
- English → 3 / 99;
- second EU language → 2 / 66;
- Art → 2 / 66;
- Motor sciences → 2 / 66;
- Music → 2 / 66;
- Catholic religion → 1 / 33.

For primary disciplines, return the discipline catalog but `allocationScope: 'institution_defined'` with no invented discipline hours. For extended lower-secondary time models, preserve the 36/40 total-time model while requiring local discipline allocation unless explicitly backed by verified ordinance data.

Every result carries stable official `sourceRef` and data `version`.

- [ ] **Step 2: Run** `bun test src/security/planningDomain.test.ts` → expected causal RED.
- [ ] **Step 3: Implement the versioned catalog**; keep ordinance hours independent from Arena curriculum regime/applicability.
- [ ] **Step 4: Re-run** → PASS.
- [ ] **Step 5: Commit** `feat: add first-cycle ordinance references`.

### Task 3: Validate layered calendar/periods and calculate effective capacity

**Interfaces:**

```ts
export function validateTeachingProfile(profile: TeachingProfile): string[];
export function calculateEffectiveCapacity(profile: TeachingProfile): EffectiveCapacity;
```

- [ ] **Step 1: Write failing tests** for overlapping periods, dates outside school year, reserve `<0` or `>50`, missing local allocation when required, duplicate closure dates across layers, weekly slots, and `reservePercent: 15` producing 85% programmable capacity under a documented rounding rule.
- [ ] **Step 2: Run** `bun test src/security/planningDomain.test.ts` → FAIL.
- [ ] **Step 3: Implement pure validation/capacity functions** with no React/storage/network/current-date access; normalize closure dates before subtracting capacity.
- [ ] **Step 4: Re-run** → PASS.
- [ ] **Step 5: Commit** `feat: calculate planning capacity`.

### Task 4: Persist `PlanningStateV1` in the Secure Local Vault

**Interfaces:**

```ts
export function applyPlanningMutation(
  current: PlanningStateV1,
  derive: (current: PlanningStateV1) => PlanningStateV1
): PlanningStateV1;
```

`SecureAppStorage` adds:
```ts
savePlanningAndMeta(planning: PlanningStateV1, meta: SecureMeta): Promise<void>;
```

App owns:
```ts
commitPlanningMutation(
  derive: (current: PlanningStateV1) => PlanningStateV1
): Promise<PlanningStateV1>;
```

- [ ] **Step 1: Write failing persistence tests**: encrypted round-trip, one atomic planning+meta write, failed write not published, missing planning initializes empty at App boundary.
- [ ] **Step 2: Run** `bun test src/security/planningPersistence.test.ts` → FAIL.
- [ ] **Step 3: Add fixed `planning` vault key and extend complete snapshot/readback/rollback paths**.
- [ ] **Step 4: Add App state/ref and durable mutation callback using the existing coordinator**.
- [ ] **Step 5: Run focused + existing persistence/mutation tests** → PASS.
- [ ] **Step 6: Commit** `feat: persist planning state in secure vault`.

### Task 5: Introduce backup v3 with backward compatibility

**Interfaces:** `BACKUP_DATA_VERSION_V3 = 3`; v3 contains planning; v2/legacy normalize to empty planning.

- [ ] **Step 1: Write failing compatibility tests** for v3 exact round-trip, v2/legacy empty-planning injection and unknown-version rejection.
- [ ] **Step 2: Run** `bun test src/security/planningBackupCompatibility.test.ts` → FAIL.
- [ ] **Step 3: Implement explicit v3/v2/legacy guards/conversion** without changing v2 semantics.
- [ ] **Step 4: Run**

```bash
bun test src/security/*.test.ts
bun run lint
bun run build
```

Expected: all PASS.

- [ ] **Step 5: Commit** `feat: include planning in backup v3`.

## Tranche exit gate

- Exact candidate SHA pinned.
- Full Bun security suite, typecheck and build PASS.
- Ordinary lower-secondary grouped-vs-discipline ordinance semantics verified.
- Primary/local-allocation behavior verified.
- Layered calendar capacity and 15% reserve verified.
- v2/legacy backup compatibility demonstrated.
- No visible legacy UDA/Gantt behavior changed.
