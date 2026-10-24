# EDU-PLAN-01B Arena Read-Only Handoff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the teacher configure a real first-cycle planning profile and bind it to a governed, visible, fail-closed Arena curriculum context without repurposing the Docente OS-targeted `CurriculumSnapshot v1`.

**Architecture:** The Registro screen first creates the local planning profile from Tranche A: school year, order, grade, discipline, ordinance hours, local allocation, assessment periods and school/class calendar. Arena then defines a dedicated `ARENA_REGISTRO_PLANNING_CONTEXT_V1` consumer profile, which Registro validates and binds only when school year/discipline/grade/cohort/regime match. Transport starts as explicit JSON import/export; runtime sync can later replace the carrier without changing the authority contract.

**Tech Stack:** Arena JSON Schema/Node validation patterns, TypeScript/Bun, React, Secure Local Vault planning record from Tranche A.

**Spec:** `docs/superpowers/specs/2026-10-24-edu-plan-01-consolidation-amendment-v1.1.md`

## Global Constraints

- Arena remains the only curriculum authority.
- Do not mutate `CURRICULUM_SNAPSHOT_V1.schema.json` or change its `targetProduct = DOCENTE_OS` policy.
- New contract identifiers use `CURRICOLO` vocabulary except immutable legacy identifiers.
- Profile configuration distinguishes national reference, local allocation and effective calendar capacity.
- Primary discipline hours are shown as locally defined where no national discipline-hour value exists.
- Assessment periods are configurable and use stable arbitrary IDs, not `Q1 | Q2`.
- Arena contract exposes curriculum version, authority state, vigency, fingerprint, institution, school year, discipline, grade/cohort, applicability/regime and planning requirement refs.
- `PROVISIONAL_COMPLETE` is always visibly non-vigente; Registro never relabels it as approved.
- Grade II/III cannot receive invented fingerprints merely because static Arena readability cases exist.
- Import is preview/read-only, requires teacher acceptance and permits no automatic curriculum write.
- Replacing the Arena reference never silently rewrites an approved master program.

## Review Focus

- Lower-secondary Technology profile → shows 2 h/week and 66 h/year national reference while preserving editable local allocation.
- Primary discipline profile → says local/institutional allocation required rather than inventing a national value.
- Valid Arena schema but `PROVISIONAL_COMPLETE` presented as approved → impossible.
- Grade/cohort/regime mismatch → rejected before persistence.
- Newer Arena context imported after a master program exists → update available only, no automatic master rewrite.

---

## File structure

### Arena repository `antoniocorsano-boop/CurManLight_arena`

**Create**
- `docs/contracts/ARENA_REGISTRO_PLANNING_CONTEXT_V1.schema.json`
- `docs/contracts/fixtures/arena-registro-planning-context-tech-grade1.json`
- `docs/architecture/ARENA_REGISTRO_PLANNING_HANDOFF_V1.md`
- `scripts/validate-registro-planning-context.mjs`
- contract test in the repository's current test location.

### Registro Docente repository

**Create**
- `src/planning/arena/arenaPlanningContract.ts`
- `src/planning/arena/arenaPlanningAdapter.ts`
- `src/components/planning/PlanningProfileView.tsx`
- `src/components/planning/PlanningProfileEditor.tsx`
- `src/components/planning/ArenaAuthorityPanel.tsx`
- `src/security/planningProfileUiContract.test.ts`
- `src/security/arenaPlanningImport.test.ts`
- `src/security/arenaAuthorityUiContract.test.ts`

**Modify**
- `src/planning/types.ts`
- `src/types.ts` — add `ActiveTab` value `programmazione`.
- `src/components/Navbar.tsx` — add “Programmazione didattica” under “Didattica e strumenti”.
- `src/App.tsx` — render/persist profiles and accepted Arena context through `commitPlanningMutation`.

### Task 1: Build teacher-facing planning-profile configuration

**Interfaces:**
- `PlanningProfileEditor` consumes a draft `TeachingProfile`, ordinance lookup and `calculateEffectiveCapacity()`.
- App action:
```ts
saveTeachingProfile(profile: TeachingProfile): Promise<void>;
```

- [ ] **Step 1: Write failing profile UI/domain tests**

Pin fields: school year, school order, grade, subject, cohort ref, national hours/provenance, optional local hours, reserve %, assessment periods, regional-calendar reference, institution adjustments, weekly class slots and local closure/exception dates.

Assert Technology lower-secondary shows `2 h/settimana · 66 h/anno`; primary shows “Monte ore disciplinare definito dall'istituzione scolastica”.

- [ ] **Step 2: Run** `bun test src/security/planningProfileUiContract.test.ts` → expected FAIL.
- [ ] **Step 3: Add `programmazione` navigation and `PlanningProfileEditor`** under existing “Didattica e strumenti”.
- [ ] **Step 4: Validate before `commitPlanningMutation`**; invalid period overlap/calendar/reserve never reaches storage.
- [ ] **Step 5: Run focused tests/type/build** → PASS.
- [ ] **Step 6: Commit** `feat: add teaching planning profile`.

### Task 2: Define the Arena→Registro contract in Arena

**Interfaces:**
- Produces `ARENA_REGISTRO_PLANNING_CONTEXT_V1`, `contractVersion: 1`.
- Required policy: `targetProduct: "REGISTRO_DOCENTE"`, `importMode: "PREVIEW_ONLY"`, `acceptanceRequired: true`, `automaticWriteAllowed: false`.

- [ ] **Step 1: Write failing Arena schema/validator tests**

Require `curriculumVersionRef`, current structural fingerprint, authority state, vigency status, institution, school year, discipline, grade/cohort, `applicabilityStatus`, `regimeRef`, stable `requirements[]` and provenance. Reject `PROVISIONAL_COMPLETE + VIGENTE`.

- [ ] **Step 2: Run focused Arena test** → expected FAIL.
- [ ] **Step 3: Implement schema/validator without changing `CurriculumSnapshot v1`**.
- [ ] **Step 4: Materialize only a real governed Grade I Technology fixture**; do not invent Grade II/III fingerprints.
- [ ] **Step 5: Run Arena contract/governance suite** → PASS.
- [ ] **Step 6: Commit in Arena** `feat: add Registro Docente planning handoff contract`.

**Human checkpoint:** the Registro consumer does not proceed until this handoff boundary passes Arena review and is explicitly accepted.

### Task 3: Validate and bind Arena context in Registro Docente

**Interfaces:**
```ts
export function parseArenaPlanningContext(input: unknown): ArenaPlanningContext;
export function bindArenaContextToProfile(
  context: ArenaPlanningContext,
  profile: TeachingProfile
): ArenaProfileBindingResult;
```

- [ ] **Step 1: Write failing parser/binding tests**

Accept only the dedicated contract/version. Reject Atlas exports, Docente OS snapshot payloads, missing fingerprint/provenance, invalid authority/vigency combination and schoolYear/subject/grade/cohort mismatch. A 2026/27 Grade I 2025-regime context cannot bind to Grade II; Grade II cannot be silently retrofitted to 2025.

- [ ] **Step 2: Run** `bun test src/security/arenaPlanningImport.test.ts` → FAIL.
- [ ] **Step 3: Implement fail-closed parser and binding adapter**.
- [ ] **Step 4: Re-run** → PASS.
- [ ] **Step 5: Commit** `feat: validate and bind Arena planning context`.

### Task 4: Make Arena provenance/authority permanently visible

**Interfaces:**
- `ArenaAuthorityPanel` renders the accepted context verbatim enough to expose source, version, regime, authority/vigency and provenance.
- `PlanningProfileView` exposes `Importa riferimento Arena` → preview → `Accetta riferimento Arena`.

- [ ] **Step 1: Write failing UI contract tests**

Require visible `Arena`, curriculum version, regime, authority/vigency and provenance action. `PROVISIONAL_COMPLETE` must render copy containing `provvisorio` and `non vigente`, never `approvato`.

- [ ] **Step 2: Run** `bun test src/security/arenaAuthorityUiContract.test.ts` → FAIL.
- [ ] **Step 3: Implement import preview + explicit teacher acceptance**.
- [ ] **Step 4: Re-import of a distinct curriculum version records an update-available reference; approved master versions are untouched**.
- [ ] **Step 5: Run tests/type/build**

```bash
bun test src/security/planningProfileUiContract.test.ts src/security/arenaPlanningImport.test.ts src/security/arenaAuthorityUiContract.test.ts
bun run lint
bun run build
```
Expected: PASS.

- [ ] **Step 6: Commit** `feat: show governed Arena curriculum context`.

## Tranche exit gate

Browser qualification with synthetic/non-personal data proves: planning profile setup; correct national/local-hour distinction; configurable periods/calendar; Programmazione reachable from tools; Arena source/version/status always visible; provisional state non-vigente; mismatched cohort JSON rejected; refresh/lock/unlock persistence; no Arena write-back; existing UDA/student workflows unaffected.
