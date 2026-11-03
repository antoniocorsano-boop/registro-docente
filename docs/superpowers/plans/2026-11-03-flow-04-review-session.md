# FLOW-04 Review Session Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trasformare `Rivedi` in una sessione professionale continua che accompagna il docente tra le superfici autorevoli esistenti senza creare nuova persistenza, nuova dashboard o automatismi deliberativi.

**Architecture:** Aggiungere un dominio puro `review/reviewSession.ts` per classe, origine e superficie corrente; sostituire `reviewEvidenceKind` in `App` con un `ReviewSessionContext` session-only; estrarre il pannello `Rivedi` dalla Dashboard e aggiungere un piccolo banner di missione sulle superfici specialistiche. Il resolver FLOW-03B `getRecordReviewOptions()` resta la sorgente dell'ordinamento iniziale.

**Tech Stack:** React 19, TypeScript 7, Bun test, Vite, Tailwind CSS, GitHub Actions qualification harness.

**Spec:** `docs/superpowers/specs/2026-11-03-flow-04-review-session-design.md`

## Global Constraints

- Baseline esatta: `main@a8fa0acc64e035aa5c0c968f5c0a6af1dcb73026`.
- Scope issue: #113; roadmap: #104.
- Nessuna nuova entità persistente o modifica PERSIST-01H.
- Nessuna nuova dashboard o duplicazione di Tabellone, Analisi, Storico, Scheda alunno, UDA/diario, Comportamento.
- Nessuna autoscrittura, correzione automatica, voto suggerito o decisione deliberativa.
- `ReviewSessionContext` non entra in `AppData`, `SecureAppSnapshot`, backup, Planning, Library, Professional Memory, Copilot o semantic memory.
- `getRecordReviewOptions()` resta in `src/recording/reviewRouting.ts`; nessuna migrazione di modulo in FLOW-04.
- Cambio classe e navigazione esterna al perimetro review invalidano la sessione fail-closed.
- Touch target minimo 44 px; qualifica mobile primaria 390×844.
- Nessun anticipo di INT-01, INT-02, LSM-02 o MOBILE-01.
- Nessun merge o deploy senza autorizzazione separata.

## Review Focus

1. **Cambio classe durante una revisione:** la sessione precedente deve chiudersi e non deve trasferire `evidenceKind` o superficie alla nuova classe — test in Task 2.
2. **Navigazione verso una tab non-review:** la missione deve chiudersi; non deve restare un banner `Rivedi` fuori contesto — test in Task 2.
3. **Navigazione Tabellone → Analisi → Rivedi:** classe, origine ed eventuale `evidenceKind` devono restare invariati mentre cambia soltanto `currentSurface` — test in Task 2 e Task 5.
4. **Handoff post-Registra:** l'`evidenceKind` deve orientare l'ordine iniziale ma non essere persistito né auto-aprire la prima destinazione — test in Task 2 e Task 4.
5. **Restore/reset/nuova sessione applicativa:** nessuna ReviewSession deve riapparire da snapshot o backup — test in Task 4.

---

### Task 1: Domain contract `ReviewSessionContext`

**Files:**
- Create: `src/review/reviewSession.ts`
- Create: `src/security/flow04ReviewSessionContract.test.ts`

**Interfaces:**
- Consumes: `ActiveTab` da `src/types.ts`; `RecordEvidenceKind` da `src/recording/recordSession.ts`.
- Produces: `ReviewOrigin`, `ReviewSurface`, `ReviewSessionContext`, `BuildReviewSessionInput`, `buildReviewSession()`, `isReviewSurface()`, `enterReviewSurface()`, `returnToReviewRouter()`, `keepReviewSessionForClass()`.

- [ ] **Step 1: Write the failing domain tests**

```ts
import { describe, expect, test } from 'bun:test';
import {
  buildReviewSession,
  enterReviewSurface,
  isReviewSurface,
  keepReviewSessionForClass,
  returnToReviewRouter
} from '../review/reviewSession';

describe('FLOW-04 ReviewSession domain', () => {
  test('builds a session-only review context from Today', () => {
    expect(buildReviewSession({
      classId: ' 2C ',
      className: ' 2C ',
      origin: 'today-review'
    })).toEqual({
      classId: '2C',
      className: '2C',
      origin: 'today-review'
    });
  });

  test('preserves post-record evidence without selecting a surface', () => {
    expect(buildReviewSession({
      classId: '2C',
      className: '2C',
      origin: 'post-record',
      evidenceKind: 'behaviour'
    })).toEqual({
      classId: '2C',
      className: '2C',
      origin: 'post-record',
      evidenceKind: 'behaviour'
    });
  });

  test('rejects an empty class', () => {
    expect(() => buildReviewSession({ classId: ' ', className: '2C', origin: 'today-review' }))
      .toThrow('REVIEW_CLASS_REQUIRED');
  });

  test('tracks only review surfaces and can return to the router', () => {
    const base = buildReviewSession({ classId: '2C', className: '2C', origin: 'today-review' });
    const analytics = enterReviewSurface(base, 'analytics');
    expect(analytics.currentSurface).toBe('analytics');
    expect(returnToReviewRouter(analytics)).toEqual(base);
    expect(isReviewSurface('tabellone')).toBe(true);
    expect(isReviewSurface('settings')).toBe(false);
  });

  test('fails closed across classes', () => {
    const session = buildReviewSession({ classId: '2C', className: '2C', origin: 'today-review' });
    expect(keepReviewSessionForClass(session, '2C')).toEqual(session);
    expect(keepReviewSessionForClass(session, '3C')).toBeNull();
    expect(keepReviewSessionForClass(session, null)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `bun test src/security/flow04ReviewSessionContract.test.ts`

Expected: FAIL because `src/review/reviewSession.ts` does not exist.

- [ ] **Step 3: Implement the pure domain module**

Create the exact interfaces and signatures from the spec. `REVIEW_CLASS_REQUIRED` is the only construction error. `isReviewSurface()` uses one immutable set/list containing exactly: `tabellone`, `analytics`, `storico`, `report`, `uda-gantt`, `comportamenti`.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `bun test src/security/flow04ReviewSessionContract.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/review/reviewSession.ts src/security/flow04ReviewSessionContract.test.ts
git commit -m "feat: add FLOW-04 review session domain"
```

---

### Task 2: App lifecycle, continuity and fail-closed invalidation

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/security/flow04ReviewSessionContract.test.ts`
- Modify: `src/security/flow03bContextualReviewContract.test.ts`
- Modify: `src/security/today01ContinuationContract.test.ts`
- Modify: `src/security/today01SessionContextContract.test.ts`

**Interfaces:**
- Consumes: all exports from Task 1; `buildRecordSession`/`RecordSessionDraft`; `resolveTodayRoute()`; existing `handleNavigateTab()`.
- Produces: session state `reviewSession: ReviewSessionContext | null`; handlers `handleOpenReviewSurface(tab: ActiveTab)`, `handleReturnToReview()`, `handleCloseReview()`; `handleNavigateTab()` becomes review-aware while preserving FLOW-03 record-session behavior.

- [ ] **Step 1: Write RED integration assertions for the new state boundary**

Extend `flow04ReviewSessionContract.test.ts` with source-contract assertions:

```ts
const app = await Bun.file('src/App.tsx').text();
expect(app).toContain('const [reviewSession, setReviewSession] = useState<ReviewSessionContext | null>(null);');
expect(app).not.toContain('const [reviewEvidenceKind, setReviewEvidenceKind]');
expect(app).toContain("origin: 'today-review'");
expect(app).toContain("origin: 'post-record'");
expect(app).toContain('evidenceKind: session.evidenceKind ?? null');
expect(app).toContain('handleOpenReviewSurface');
expect(app).toContain('handleReturnToReview');
expect(app).toContain('handleCloseReview');
```

Also assert that class selection contains `setReviewSession(null)` and that restore/reset/transient invalidation paths do not hydrate ReviewSession from any snapshot.

- [ ] **Step 2: Run focused regression set and verify RED only on FLOW-04 expectations**

Run:

```bash
bun test \
  src/security/flow04ReviewSessionContract.test.ts \
  src/security/flow03bContextualReviewContract.test.ts \
  src/security/today01ContinuationContract.test.ts \
  src/security/today01SessionContextContract.test.ts
```

Expected: FLOW-04 assertions fail; historical tests may also fail where they pin the superseded `reviewEvidenceKind`/generic-review continuation behavior. Record those expected failures before implementation.

- [ ] **Step 3: Replace `reviewEvidenceKind` state with `ReviewSessionContext`**

In `src/App.tsx`:

```ts
const [reviewSession, setReviewSession] = useState<ReviewSessionContext | null>(null);
```

Import Task 1 functions/types. Do not add ReviewSession to any durable ref/state object.

- [ ] **Step 4: Build ReviewSession from both canonical entry paths**

For `handleStartTodayAction('review')`, after `resolveTodayRoute()` confirms a class-entry, build:

```ts
buildReviewSession({
  classId: currentClass.id,
  className: currentClass.name,
  origin: 'today-review'
})
```

For `handleContinueRecordToReview`, build:

```ts
buildReviewSession({
  classId: session.context.classId,
  className: session.context.className,
  origin: 'post-record',
  evidenceKind: session.evidenceKind ?? null
})
```

Then close `RecordSessionDraft`, keep `todayAction = 'review'`, and navigate to Dashboard without auto-opening a review surface.

- [ ] **Step 5: Add dedicated review navigation handlers**

Implement exact signatures:

```ts
const handleOpenReviewSurface = useCallback((tab: ActiveTab) => { /* ... */ }, [...]);
const handleReturnToReview = useCallback(() => { /* ... */ }, [...]);
const handleCloseReview = useCallback(() => { /* ... */ }, [...]);
```

Behavior:

- open: require current-class session + `isReviewSurface(tab)`, set `currentSurface`, preserve `todayAction === 'review'`, navigate;
- return: clear only `currentSurface`, preserve session/origin/evidence, go to `dashboard`;
- close: clear ReviewSession; if `todayAction === 'review'`, clear it; keep current class.

- [ ] **Step 6: Make ordinary navigation review-aware without weakening FLOW-03**

Extend `handleNavigateTab()` so:

- existing `preserveRecordSession` semantics remain unchanged;
- with an active ReviewSession for the current class, navigation to a `ReviewSurface` preserves the session and updates `currentSurface`;
- navigation to `dashboard` preserves the session but calls `returnToReviewRouter()`;
- navigation to any other tab clears ReviewSession and clears `todayAction` when it is `review`;
- no class mutation occurs.

Pin this behavior in `flow04ReviewSessionContract.test.ts` by extracting the `handleNavigateTab` section and asserting all three branches.

- [ ] **Step 7: Close ReviewSession on class switch and other existing transient reset paths**

Replace former `setReviewEvidenceKind(null)` invalidations with `setReviewSession(null)`. Ensure `handleSelectClass`, Home/popstate/reset/restore paths that already clear transient TODAY state also clear ReviewSession.

- [ ] **Step 8: Update superseded historical contracts without weakening their intent**

- `flow03bContextualReviewContract.test.ts`: replace assertions on isolated `reviewEvidenceKind` with assertions that post-record builds `ReviewSessionContext` using the same `evidenceKind`, remains session-only, and never auto-opens a destination.
- `today01ContinuationContract.test.ts`: preserve the rule that generic continuations close their intent, but explicitly exempt FLOW-04's dedicated review handler from `handleContinueToday()`.
- `today01SessionContextContract.test.ts`: assert `review` constructs a ReviewSession only after class resolution.

- [ ] **Step 9: Run focused tests and verify GREEN**

Run the command from Step 2.

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add src/App.tsx src/security/flow04ReviewSessionContract.test.ts \
  src/security/flow03bContextualReviewContract.test.ts \
  src/security/today01ContinuationContract.test.ts \
  src/security/today01SessionContextContract.test.ts
git commit -m "feat: preserve FLOW-04 review mission across navigation"
```

---

### Task 3: `ReviewRouterPanel`, mission banner and Dashboard hierarchy

**Files:**
- Create: `src/components/ReviewRouterPanel.tsx`
- Create: `src/components/ReviewMissionBanner.tsx`
- Modify: `src/components/DashboardView.tsx`
- Modify: `src/App.tsx`
- Create: `src/security/flow04ReviewUiContract.test.ts`

**Interfaces:**
- Consumes: `ReviewSessionContext`, `ReviewSurface`, `getRecordReviewOptions()`; App handlers from Task 2.
- Produces: `ReviewRouterPanel` with `session`, `onNavigateSurface`, `onDismiss`; `ReviewMissionBanner` with `session`, `onReturn`, `onDismiss`.

- [ ] **Step 1: Write RED UI contract tests**

```ts
const panel = await Bun.file('src/components/ReviewRouterPanel.tsx').text();
const banner = await Bun.file('src/components/ReviewMissionBanner.tsx').text();
const dashboard = await Bun.file('src/components/DashboardView.tsx').text();
const app = await Bun.file('src/App.tsx').text();

expect(panel).toContain('Che cosa vuoi controllare o approfondire?');
expect(panel).toContain('getRecordReviewOptions(session.evidenceKind)');
expect(panel).toContain('Sintesi matematica delle valutazioni registrate.');
expect(panel).toContain('Indicatori e trend per leggere l\'andamento.');
expect(panel).not.toMatch(/assegna|decidi|correggi automaticamente/i);

expect(banner).toContain('Torna a Rivedi');
expect(banner).toContain('Rivedi ·');
expect(dashboard).toContain('<ReviewRouterPanel');
expect(dashboard).not.toContain('Scegli una superficie già esistente');
expect(app).toContain('<ReviewMissionBanner');
```

Also assert `min-h-[44px]` on actionable controls and that the Dashboard overview focus includes active review.

- [ ] **Step 2: Run UI contract test and verify RED**

Run: `bun test src/security/flow04ReviewUiContract.test.ts`

Expected: FAIL because the two components do not exist.

- [ ] **Step 3: Implement `ReviewRouterPanel`**

Props:

```ts
interface ReviewRouterPanelProps {
  session: ReviewSessionContext;
  onNavigateSurface: (surface: ReviewSurface) => void;
  onDismiss: () => void;
}
```

Use `getRecordReviewOptions(session.evidenceKind)` and map each option to its canonical description from the spec. Do not calculate new statistics. Show contextual ordering copy only when `session.origin === 'post-record' && session.evidenceKind`.

- [ ] **Step 4: Implement `ReviewMissionBanner`**

Props:

```ts
interface ReviewMissionBannerProps {
  session: ReviewSessionContext;
  onReturn: () => void;
  onDismiss: () => void;
}
```

Render mission, class, current surface label, `Torna a Rivedi`, `Chiudi`. No KPI or recommendation.

- [ ] **Step 5: Replace the inline review block in `DashboardView`**

- replace `reviewEvidenceKind?: RecordEvidenceKind | null` with `reviewSession?: ReviewSessionContext | null`;
- render `<ReviewRouterPanel>` only when `todayAction === 'review'`, session exists, and `reviewSession.classId === currentClass.id`;
- wire `onNavigateSurface` to the dedicated Task 2 handler passed as prop;
- wire dismiss to `handleCloseReview`;
- remove the old generic review inline buttons/copy.

- [ ] **Step 6: Make Panoramica Sezione subordinate during active review**

Replace the record-only focus condition with a mission-focus condition equivalent to:

```ts
const isActiveMissionFocus =
  isActiveRecordFocus
  || (todayAction === 'review' && reviewSession?.classId === currentClass.id);
```

Use it for the existing `details` open/compact behavior. Do not change KPI calculations or shortcuts.

- [ ] **Step 7: Mount `ReviewMissionBanner` above specialist views**

In `App.tsx`, render the banner once, outside individual specialist view implementations, only when:

```ts
reviewSession
&& currentClass
&& reviewSession.classId === currentClass.id
&& isReviewSurface(activeTab)
&& reviewSession.currentSurface === activeTab
```

Pass `handleReturnToReview` and `handleCloseReview`.

- [ ] **Step 8: Run UI + lifecycle contracts and verify GREEN**

Run:

```bash
bun test \
  src/security/flow04ReviewSessionContract.test.ts \
  src/security/flow04ReviewUiContract.test.ts \
  src/security/flow03bContextualReviewContract.test.ts \
  src/security/today01ContinuationContract.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/components/ReviewRouterPanel.tsx src/components/ReviewMissionBanner.tsx \
  src/components/DashboardView.tsx src/App.tsx src/security/flow04ReviewUiContract.test.ts
git commit -m "feat: add FLOW-04 review mission UI"
```

---

### Task 4: Persistence/provenance guardrails and historical regressions

**Files:**
- Create: `src/security/flow04PersistenceBoundary.test.ts`
- Modify: `src/security/flow04ReviewSessionContract.test.ts`
- Modify: `src/security/flow03bContextualReviewContract.test.ts`
- Modify: `qualification/invariants.v1.json`

**Interfaces:**
- Consumes: Task 1 state/type names; existing secure snapshot and backup structures.
- Produces: qualification evidence that ReviewSession is transient and that FLOW-03B ordering remains non-deliberative.

- [ ] **Step 1: Write RED persistence-boundary tests**

The test must read source/types and assert:

```ts
expect(appSource).toContain('useState<ReviewSessionContext | null>(null)');
expect(typesSource).not.toContain('reviewSession');
expect(secureStorageSource).not.toContain('reviewSession');
expect(backupPayloadSource).not.toContain('reviewSession');
expect(planningTypesSource).not.toContain('reviewSession');
expect(libraryTypesSource).not.toContain('reviewSession');
expect(memoryTypesSource).not.toContain('reviewSession');
expect(copilotStateSource).not.toContain('reviewSession');
```

Also assert no `secureStorage.save*` call receives ReviewSession and no semantic-memory projection imports it.

- [ ] **Step 2: Add provenance/non-deliberative assertions**

Pin that `ReviewRouterPanel` descriptions use `Sintesi matematica`, `Indicatori e trend`, `Traccia`, `Dossier`, `Progressione didattica`, `Evidenze comportamentali`, and do not contain verdict language such as `insufficiente`, `promuovi`, `boccia`, `assegna voto`, `devi correggere`.

- [ ] **Step 3: Run persistence/provenance tests and verify GREEN after implementation**

Run:

```bash
bun test \
  src/security/flow04PersistenceBoundary.test.ts \
  src/security/flow04ReviewSessionContract.test.ts \
  src/security/flow03bContextualReviewContract.test.ts
```

Expected: PASS.

- [ ] **Step 4: Register FLOW-04 qualification inputs**

Update `qualification/invariants.v1.json` to include:

- `src/review/reviewSession.ts`;
- `src/components/ReviewRouterPanel.tsx`;
- `src/components/ReviewMissionBanner.tsx`;
- `src/security/flow04ReviewSessionContract.test.ts`;
- `src/security/flow04ReviewUiContract.test.ts`;
- `src/security/flow04PersistenceBoundary.test.ts`;
- browser qualification artifact/test added in Task 5.

Do not remove historical FLOW-03/FLOW-03B paths.

- [ ] **Step 5: Run full local security/type/build regressions**

Run:

```bash
bun run test:security
bun run lint
bun run build
```

Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add src/security/flow04PersistenceBoundary.test.ts \
  src/security/flow04ReviewSessionContract.test.ts \
  src/security/flow03bContextualReviewContract.test.ts \
  qualification/invariants.v1.json
git commit -m "test: qualify FLOW-04 review session boundaries"
```

---

### Task 5: Browser qualification desktop/mobile and exact-SHA gate

**Files:**
- Create: `tests/browser/flow-04-review-session.spec.cjs`
- Create: `src/security/flow04BrowserQualificationContract.test.ts`
- Modify: `.github/workflows/browser-qualification.yml`
- Modify: `.github/workflows/predeploy-security-qualification.yml` only if its current glob/selection does not already include `flow04*.test.ts`
- Modify: `qualification/invariants.v1.json`

**Interfaces:**
- Consumes: rendered FLOW-04 panel/banner and handlers from Tasks 2–3.
- Produces: browser evidence for desktop and 390×844 plus workflow registration.

- [ ] **Step 1: Write the browser qualification contract RED test**

Assert that the workflow runs `tests/browser/flow-04-review-session.spec.cjs`, and that the spec contains both desktop and 390×844 cases.

Run: `bun test src/security/flow04BrowserQualificationContract.test.ts`

Expected: FAIL until workflow/spec are registered.

- [ ] **Step 2: Implement deterministic browser journey — `Oggi → Rivedi`**

Seed or use deterministic fixture class data and verify:

1. select class;
2. start `Rivedi` from Oggi;
3. ReviewRouterPanel is first mission surface;
4. Panoramica Sezione is collapsed by default;
5. open Tabellone;
6. ReviewMissionBanner remains visible;
7. navigate to Analisi through the supported navigation path;
8. banner remains visible and class unchanged;
9. `Torna a Rivedi` returns to Dashboard with the review panel and same class;
10. `Chiudi` ends mission and restores ordinary Dashboard hierarchy.

- [ ] **Step 3: Implement deterministic browser journey — `Registra → Rivedi`**

Use the existing FLOW-03 seeded path to save one evidence kind without mutating real user data. Verify:

1. post-record `Rivedi` opens Dashboard;
2. first destination order matches `getRecordReviewOptions(evidenceKind)`;
3. no destination auto-opens;
4. opening the first destination keeps the banner;
5. returning keeps contextual ordering.

- [ ] **Step 4: Pin Review Focus failure modes in browser**

Add assertions for:

- class switch closes the prior review mission;
- navigation to a non-review tab closes mission/banner;
- mobile 390×844 has no horizontal overflow;
- `Torna a Rivedi` and `Chiudi` meet 44 px target and do not overlap fixed controls;
- no extra KPI/dashboard copy appears in the banner.

- [ ] **Step 5: Register workflows and invariants**

Add the browser spec to `.github/workflows/browser-qualification.yml` following the existing FLOW-03/FLOW-03B pattern. Add PREDEPLOY selection only if necessary. Add the browser spec and contract test to `qualification/invariants.v1.json`.

- [ ] **Step 6: Run local qualification preflight**

Run:

```bash
bun test src/security/flow04BrowserQualificationContract.test.ts
bun run test:security
bun run lint
bun run build
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add tests/browser/flow-04-review-session.spec.cjs \
  src/security/flow04BrowserQualificationContract.test.ts \
  .github/workflows/browser-qualification.yml \
  .github/workflows/predeploy-security-qualification.yml \
  qualification/invariants.v1.json
git commit -m "test: add FLOW-04 browser qualification"
```

- [ ] **Step 8: Push exact candidate and run remote gates**

Required remote evidence on one exact SHA:

- focused FLOW-04 contract — PASS;
- Qualification Invariants — PASS;
- PREDEPLOY Security Qualification — PASS;
- Browser Qualification — PASS completo, desktop + 390×844;
- historical FLOW-03/FLOW-03B regressions — PASS.

Do not promote or merge while any gate is stale, running on a different SHA or RED.

- [ ] **Step 9: Final Independent Review**

Review focus:

- session leakage cross-class;
- unexpected persistence;
- navigation paths that strand `todayAction === 'review'` without ReviewSession or vice versa;
- accidental duplication of analytic authority;
- mobile hierarchy/overflow.

Any Critical/Important finding returns the branch to RED→GREEN.

- [ ] **Step 10: Human Product/UX Review comparativa**

Compare baseline FLOW-03B vs FLOW-04 on desktop and 390×844. PASS requires:

- missione `Rivedi` riconoscibile e dominante;
- Panoramica non concorrente durante la missione;
- orientamento chiaro tra superfici;
- ritorno a `Rivedi` evidente;
- nessun tono deliberativo o prescrittivo;
- nessuna nuova dashboard percepita.

Only after PASS may the PR move from Draft to Ready. Merge still requires separate explicit authorization.

---

## Self-review

### Spec coverage

- ReviewSession class/origin/evidence/current-surface: Task 1–2.
- Today/post-record entry: Task 2.
- Continuity across review surfaces and return: Task 2–3.
- Dashboard hierarchy and mission banner: Task 3.
- Session-only/persistence boundary and provenance: Task 4.
- Desktop/mobile qualification and governance gates: Task 5.
- Non-goals INT-01/02, LSM-02, MOBILE-01: enforced by Global Constraints and absence of files from those domains.

No uncovered spec requirement found.

### Type consistency

All tasks use the same names: `ReviewSessionContext`, `ReviewOrigin`, `ReviewSurface`, `buildReviewSession`, `isReviewSurface`, `enterReviewSurface`, `returnToReviewRouter`, `keepReviewSessionForClass`.

### Proportion

The plan defines interfaces, tests, failure modes and qualification boundaries; implementation bodies remain with the executor except where the spec fixes exact copy or behavior.
