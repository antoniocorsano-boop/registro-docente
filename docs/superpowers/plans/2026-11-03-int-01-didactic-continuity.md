# INT-01 Didactic Continuity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendere continuo il percorso classe → Programmazione → UDA → lezione/attività usando una cornice annuale class-first e un unico teaching focus session-only, senza migrare il dominio UDA né creare nuova autorità persistente.

**Architecture:** Estrarre un resolver generico `planningFrameResolver` dal matching già qualificato in LIB-03A; riusare `LibraryTeachingContext { udaId, lessonId? }` come focus didattico session-only; alimentare CTX-01 con planning frame + focus validato; aggiungere una barra di continuità compatta alle superfici Programmazione/UDA. Il catalogo didattico unificato resta l'autorità per distinguere UDA Registro scrivibili e proiezioni Docente OS read-only.

**Tech Stack:** React 19, TypeScript 7, Bun test, Vite, Tailwind CSS, GitHub Actions qualification harness.

**Spec:** `docs/superpowers/specs/2026-11-03-int-01-didactic-continuity-design.md`

## Global Constraints

- Baseline esatta: `main@0488cd50287ef26883f395e2b79ab1fcba11ccdc`.
- Scope issue: #115; roadmap: #104.
- Nessuna aggiunta di `MasterProgramVersion[]` a `PlanningStateV2`.
- Nessun `planningProfileId` persistito dentro `UdaRecord`.
- Nessuna nuova entità persistente per il teaching focus o la continuità di navigazione.
- `ProfessionalContextV1` resta il contesto professionale canonico.
- `LibraryTeachingContext { udaId, lessonId? }` resta l'unico identificatore del focus didattico session-only.
- Nessuna scelta arbitraria quando profilo, Arena, UDA o lezione sono ambigui/non validi.
- UDA Docente OS resta `writableByRegistro=false`; INT-01 non abilita clonazione o editing implicito.
- Arena resta read-only e viene esposto solo se `APPROVED`, `VIGENTE`, `PROFESSIONAL_NON_PERSONAL` e coerente con il profilo corrente.
- Nessuna nuova dashboard; Programmazione e UDA restano le superfici autorevoli.
- Touch target minimo 44 px; qualifica mobile primaria 390×844.
- Nessun anticipo di INT-02, LSM-02 o MOBILE-01.
- Nessun merge o deploy senza autorizzazione esplicita separata.

## Review Focus

1. **Cambio classe durante un focus UDA/lezione:** il focus precedente deve essere invalidato prima di mostrare la nuova cornice — Task 2/3.
2. **Più profili compatibili o più Arena validi:** nessuna selezione del primo elemento; risultato `ambiguous` — Task 1/4.
3. **UDA cancellata o `lessonId` non più valido:** il focus deve fallire chiuso e non riapparire latente — Task 2/3.
4. **UDA Docente OS con tentativo di lesson focus/editing:** UDA leggibile come contesto, lesson locale non inventata e autorità read-only preservata — Task 2/4.
5. **Uscita dal perimetro INT-01:** nessun focus nascosto deve riattivarsi dopo lavoro su una superficie/classe incompatibile — Task 3/5.

---

### Task 1: Resolver class-first della cornice Programmazione e compatibilità LIB-03

**Files:**
- Create: `src/planning/planningFrameResolver.ts`
- Create: `src/security/int01PlanningFrameContract.test.ts`
- Modify: `src/library/planningContextBridge.ts`
- Modify: `src/library/planningContextBridge.test.ts`

**Interfaces:**
- Consumes: `PlanningState`, `TeachingProfile`, `ArenaPlanningContext` da `src/planning/types.ts`.
- Produces: `PlanningFrameReason`, `ResolvePlanningFrameInput`, `PlanningFrameResolution`, `resolvePlanningFrame()`, più helper di normalizzazione esportati solo se già necessari ai consumer correnti.
- `resolveLibraryPlanningContext()` mantiene la firma e le reason pubbliche esistenti e delega al nuovo resolver.

- [ ] **Step 1: Scrivere i test RED del resolver class-first**

In `src/security/int01PlanningFrameContract.test.ts` coprire almeno:

```ts
expect(resolvePlanningFrame({ className: null, planning, schoolYear, subjectCode }))
  .toEqual({ status: 'unavailable', reason: 'CLASS_CONTEXT_MISSING' });

expect(resolvePlanningFrame({ className: 'classe senza livello', planning, schoolYear, subjectCode }))
  .toEqual({ status: 'unavailable', reason: 'GRADE_LEVEL_UNRESOLVED' });
```

Aggiungere fixture per:
- un solo `TeachingProfile` compatibile → `resolved`;
- zero profili → `PLANNING_PROFILE_NOT_FOUND`;
- due profili compatibili → `PLANNING_PROFILE_AMBIGUOUS`;
- zero Arena validi → `resolved` con `arenaContext: null`;
- un Arena coerente/APPROVED/VIGENTE → esposto;
- due Arena pienamente validi → `ARENA_CONTEXT_AMBIGUOUS`;
- Arena provisional, non vigente, stale o privacy diversa da `PROFESSIONAL_NON_PERSONAL` → ignorato.

- [ ] **Step 2: Verificare RED**

Run:

```bash
bun test src/security/int01PlanningFrameContract.test.ts
```

Expected: FAIL perché `src/planning/planningFrameResolver.ts` non esiste.

- [ ] **Step 3: Implementare `resolvePlanningFrame()`**

Firma:

```ts
export function resolvePlanningFrame(
  input: ResolvePlanningFrameInput
): PlanningFrameResolution;
```

Riutilizzare le regole già qualificate da LIB-03A senza introdurre fallback temporali o ordinamenti per scegliere un candidato.

- [ ] **Step 4: Verificare GREEN del resolver**

Run: `bun test src/security/int01PlanningFrameContract.test.ts`

Expected: PASS.

- [ ] **Step 5: Refactor RED→GREEN del bridge Biblioteca**

Modificare `resolveLibraryPlanningContext()` affinché:
- mantenga `TEACHING_CONTEXT_MISSING` come guardia iniziale;
- chiami `resolvePlanningFrame()` con `teachingContext.className`;
- mappi `GRADE_LEVEL_UNRESOLVED`, `PLANNING_PROFILE_NOT_FOUND`, `PLANNING_PROFILE_AMBIGUOUS`, `ARENA_CONTEXT_AMBIGUOUS` nelle reason LIB-03 omonime;
- su `resolved` restituisca anche il `teachingContext` originario.

Run:

```bash
bun test src/library/planningContextBridge.test.ts src/security/int01PlanningFrameContract.test.ts
```

Expected: PASS senza modifica del contratto pubblico LIB-03.

- [ ] **Step 6: Commit**

```bash
git add src/planning/planningFrameResolver.ts \
  src/security/int01PlanningFrameContract.test.ts \
  src/library/planningContextBridge.ts \
  src/library/planningContextBridge.test.ts
git commit -m "feat: add class-first planning frame resolver"
```

---

### Task 2: Teaching focus session-only e validazione contro il catalogo didattico

**Files:**
- Create: `src/context/teachingFocus.ts`
- Create: `src/security/int01TeachingFocusContract.test.ts`
- Read/consume only: `src/teaching/teachingUdaCatalog.ts`
- Read/consume only: `src/library/teachingContext.ts`

**Interfaces:**
- Consumes: `LibraryTeachingContext`, `ResolvedLibraryTeachingContext`, `TeachingUdaCandidate`, `ActiveTab`.
- Produces: `TeachingFocusReason`, `TeachingFocusResolution`, `resolveTeachingFocusForClass()`, `keepTeachingFocusForClass()`, `transitionTeachingFocusForTab()`.

Suggested contract:

```ts
export type TeachingFocusReason =
  | 'FOCUS_MISSING'
  | 'CLASS_CONTEXT_MISSING'
  | 'UDA_NOT_FOUND'
  | 'CLASS_MISMATCH'
  | 'LESSON_NOT_FOUND'
  | 'PROJECTED_UDA_LESSON_UNSUPPORTED'
  | 'RESOLVED';

export function resolveTeachingFocusForClass(input: {
  focus: LibraryTeachingContext | null;
  currentClassId: string | null;
  catalog: readonly TeachingUdaCandidate[];
}): TeachingFocusResolution;
```

- [ ] **Step 1: Scrivere i test RED del focus**

Coprire:
- focus `null` → unavailable/`FOCUS_MISSING`;
- UDA Registro della classe corrente → resolved con className/period e `writableByRegistro=true`;
- UDA di altra classe → `CLASS_MISMATCH`;
- UDA inesistente → `UDA_NOT_FOUND`;
- lesson Registro valida → resolved con lessonId;
- lesson inesistente → `LESSON_NOT_FOUND`;
- UDA Docente OS senza lesson → resolved e `writableByRegistro=false`;
- UDA Docente OS + lessonId → `PROJECTED_UDA_LESSON_UNSUPPORTED`;
- `keepTeachingFocusForClass()` restituisce `null` dopo cambio classe;
- `transitionTeachingFocusForTab()` preserva solo `programmazione` / `uda-gantt` e invalida su tab incompatibile.

- [ ] **Step 2: Verificare RED**

Run: `bun test src/security/int01TeachingFocusContract.test.ts`

Expected: FAIL per modulo assente.

- [ ] **Step 3: Implementare il resolver puro**

Non modificare il catalogo né materializzare UDA proiettate. Usare l'identità `classId` del `TeachingUdaCandidate` come confine canonico.

- [ ] **Step 4: Verificare GREEN**

Run: `bun test src/security/int01TeachingFocusContract.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/context/teachingFocus.ts src/security/int01TeachingFocusContract.test.ts
git commit -m "feat: add session-only teaching focus resolver"
```

---

### Task 3: CTX-01 e lifecycle App — un solo contesto professionale

**Files:**
- Modify: `src/context/professionalContext.ts`
- Modify: `src/App.tsx`
- Modify: `src/security/ctx01ProfessionalContext.test.ts`
- Create: `src/security/int01AppContextContract.test.ts`
- Modify only if expectations need extension, never weakening privacy: `src/security/aic01ContextPrivacyContract.test.ts`
- Modify only if expectations need extension: `src/security/ctx01AppIntegrationContract.test.ts`

**Interfaces:**
- Consumes: `PlanningFrameResolution` from Task 1; teaching focus functions from Task 2; `buildTeachingUdaCatalog()` and `buildTeachingUdaClassReconciliationIndex()`; CTX-01 existing resolver.
- Produces: session state `teachingFocus: LibraryTeachingContext | null`; resolved ambient planning frame and teaching context; CTX-01 remains the only professional-context projection.

- [ ] **Step 1: Estendere i test CTX-01 in RED**

Aggiungere casi:
- planning frame `resolved` senza UDA → `planningProfileId`/optional `arenaContextId` presenti nel `ProfessionalContextV1`;
- planning frame `ambiguous` → conflitto `PLANNING_CONTEXT_AMBIGUOUS`;
- teaching context classe 2C + planning frame classe 3C → `CLASS_MISMATCH`;
- `planningContext` LIB-03 e nuovo `planningFrame`, se entrambi presenti, devono essere coerenti o fallire chiuso;
- nessun nuovo campo studente nel contesto.

- [ ] **Step 2: Verificare RED focalizzato**

Run:

```bash
bun test src/security/ctx01ProfessionalContext.test.ts src/security/int01AppContextContract.test.ts
```

Expected: FAIL sulle nuove aspettative INT-01.

- [ ] **Step 3: Estendere `resolveProfessionalContext()`**

Aggiungere a `ResolveProfessionalContextInput`:

```ts
planningFrame?: PlanningFrameResolution | null;
```

Preservare `planningContext?: LibraryPlanningContextResolution | null` per compatibilità. Non aggiungere un nuovo tipo di output professionale.

- [ ] **Step 4: Costruire in `App` il catalogo didattico unificato**

Usare `useMemo` con:
- `udas` locali;
- `planning.docenteOsProjections`;
- indice di riconciliazione esistente;
- `appData.classes`.

Non duplicare l'algoritmo dentro `App`.

- [ ] **Step 5: Aggiungere `teachingFocus` session-only**

In `App`:

```ts
const [teachingFocus, setTeachingFocus] = useState<LibraryTeachingContext | null>(null);
```

Nessun ref/snapshot durevole. Aggiungere una funzione di pubblicazione solo se necessaria a evitare closure stale.

- [ ] **Step 6: Derivare frame e focus validato**

Calcolare:
- `planningFrame = resolvePlanningFrame(...)` da classe corrente, `planning`, `settings.year`, `settings.subject`;
- `resolvedTeachingFocus = resolveTeachingFocusForClass(...)` dal catalogo.

Passare i risultati a `resolveProfessionalContext()` quando il contesto ambientale è Programmazione/UDA/lezione.

La surface deve essere:
- `planning` su `programmazione`;
- `lesson` su `uda-gantt` solo con lesson focus valido;
- `uda` su `uda-gantt` con solo UDA focus;
- comportamento storico invariato sulle altre superfici.

- [ ] **Step 7: Rendere il lifecycle fail-closed**

Sul cambio classe: `setTeachingFocus(null)` prima/insieme alla pubblicazione del nuovo contesto.

Nel setter condiviso di navigazione applicare `transitionTeachingFocusForTab()` senza interferire con lifecycle FLOW-03/FLOW-04. Restore/reset/factory reset/non-session entry devono partire con focus nullo.

- [ ] **Step 8: Prova esplicita di non persistenza**

In `int01AppContextContract.test.ts` verificare che `teachingFocus` non compaia come campo in:
- `AppData`;
- `SecureAppSnapshot`;
- backup payload;
- `PlanningState`;
- `LibraryStateV1`;
- `ProfessionalMemoryStateV1`;
- `CopilotStateV1`.

- [ ] **Step 9: Verificare GREEN e privacy**

Run:

```bash
bun test \
  src/security/ctx01ProfessionalContext.test.ts \
  src/security/ctx01AppIntegrationContract.test.ts \
  src/security/aic01ContextPrivacyContract.test.ts \
  src/security/int01TeachingFocusContract.test.ts \
  src/security/int01AppContextContract.test.ts
```

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add src/context/professionalContext.ts src/App.tsx \
  src/security/ctx01ProfessionalContext.test.ts \
  src/security/ctx01AppIntegrationContract.test.ts \
  src/security/aic01ContextPrivacyContract.test.ts \
  src/security/int01AppContextContract.test.ts
git commit -m "feat: project planning and teaching continuity into CTX-01"
```

---

### Task 4: Continuità visibile Programmazione ↔ UDA senza nuova dashboard

**Files:**
- Create: `src/components/DidacticContinuityBar.tsx`
- Modify: `src/components/planning/PlanningProfileView.tsx`
- Modify: `src/components/UdaGanttView.tsx`
- Modify: `src/App.tsx`
- Create: `src/security/int01DidacticContinuityUiContract.test.ts`

**Interfaces:**
- Consumes: `PlanningFrameResolution`, `ResolvedLibraryTeachingContext`, `LibraryTeachingContext`.
- Produces: `DidacticContinuityBar`; `PlanningProfileView` context-aware; `UdaGanttView` context-aware; two-way App handoff callbacks.

- [ ] **Step 1: Scrivere i test UI RED**

Assert che la barra:
- mostri classe;
- mostri cornice Programmazione solo se `resolved`;
- mostri UDA/lezione solo se focus valido;
- abbia controlli `min-h-[44px]`;
- contenga `Apri UDA` / `Apri Programmazione` a seconda della superficie;
- non contenga KPI, percentuali, insight automatici o azioni di salvataggio.

Assert inoltre che `PlanningProfileView` riceva un `focusedProfileId` e che `UdaGanttView` riceva focus/callback senza aggiungere nuova persistenza.

- [ ] **Step 2: Verificare RED**

Run: `bun test src/security/int01DidacticContinuityUiContract.test.ts`

Expected: FAIL per component/API assenti.

- [ ] **Step 3: Implementare `DidacticContinuityBar`**

Props minime:

```ts
interface DidacticContinuityBarProps {
  className: string;
  planningFrame: PlanningFrameResolution | null;
  teachingContext: ResolvedLibraryTeachingContext | null;
  destination: 'programmazione' | 'uda-gantt';
  onNavigate: () => void;
}
```

Copy professionale, compatta e non prescrittiva. Nessun calcolo analitico.

- [ ] **Step 4: Rendere `PlanningProfileView` context-aware**

Aggiungere `focusedProfileId?: string | null` e continuità bar.

Regole:
- con frame `resolved`, il profilo coerente è focalizzato;
- con frame `ambiguous/unavailable` e classe presente, non impostare automaticamente `profiles[0]` come se fosse il profilo della classe;
- senza classe/focus INT-01, conservare la modalità esperta standalone preesistente;
- una scelta manuale non cambia la classe né il teaching focus.

- [ ] **Step 5: Rendere `UdaGanttView` context-aware senza riscriverla**

Aggiungere props per:
- classe/focus corrente;
- `teachingFocus` opzionale;
- `onTeachingFocusChange(focus: LibraryTeachingContext | null)`;
- continuità bar.

Quando arriva un UDA focus Registro valido, focalizzare la UDA esistente. Se esiste solo la classe, focalizzare/filtrare la classe senza scegliere una UDA tra più candidati.

Una selezione UDA esplicita dell'utente pubblica `{ udaId }`. Un `lessonId` viene pubblicato solo da un'azione di lezione già esplicita e valida; INT-01 non introduce un nuovo selettore lezione.

- [ ] **Step 6: Handoff bidirezionale in `App`**

Programmazione → UDA e UDA → Programmazione devono passare dal setter condiviso di navigazione e mantenere il teaching focus solo quando valido per la classe corrente.

- [ ] **Step 7: Preservare autorità Docente OS**

Il rendering del contesto può mostrare una UDA proiettata, ma nessuna callback di `UdaGanttView` deve instradarla verso `onSaveUdas`. Aggiungere un'asserzione source/behavior che `writableByRegistro=false` non abiliti editing.

- [ ] **Step 8: Verificare GREEN UI + regressioni focalizzate**

Run:

```bash
bun test \
  src/security/int01DidacticContinuityUiContract.test.ts \
  src/security/int01TeachingFocusContract.test.ts \
  src/security/flow03UdaDiaryHandoffContract.test.ts \
  src/security/flow03FocusedUdaDiaryContract.test.ts \
  src/security/a4R2UnifiedUdaCatalogBehavior.test.ts \
  src/security/a4R2UnifiedUdaCatalogCompatibility.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/components/DidacticContinuityBar.tsx \
  src/components/planning/PlanningProfileView.tsx \
  src/components/UdaGanttView.tsx src/App.tsx \
  src/security/int01DidacticContinuityUiContract.test.ts
git commit -m "feat: connect planning and UDA teaching context"
```

---

### Task 5: Invariante INT-01, browser journey e regressione completa

**Files:**
- Modify: `qualification/invariants.v1.json`
- Create: `src/security/int01QualificationContract.test.ts`
- Create: `tests/browser/int-01-didactic-continuity.spec.cjs`
- Modify: `.github/workflows/browser-qualification.yml`

**Interfaces:**
- Consumes: tutti i contratti Tasks 1–4 e harness browser esistente.
- Produces: invariant `INT-01-I01`; journey Chromium exact-SHA desktop + 390×844.

- [ ] **Step 1: Scrivere il test RED dell'invariante**

`INT-01-I01` deve coprire almeno:
- `src/planning/planningFrameResolver.ts`;
- `src/context/teachingFocus.ts`;
- `src/context/professionalContext.ts`;
- `src/components/DidacticContinuityBar.tsx`;
- `src/components/planning/PlanningProfileView.tsx`;
- `src/components/UdaGanttView.tsx`;
- `src/App.tsx`;
- test INT-01 e browser journey.

Il statement deve fissare: class-first, fail-closed, session-only, no auto-selection, Docente OS read-only.

- [ ] **Step 2: Verificare RED e poi aggiornare il registry**

Run:

```bash
bun test src/security/int01QualificationContract.test.ts
bun scripts/qualification/check-invariants.mjs
```

Expected prima del registry: FAIL sul test INT-01; dopo l'aggiornamento: PASS e `QUAL_INVARIANT_REGISTRY_PASS`.

- [ ] **Step 3: Scrivere il browser journey**

Desktop:
1. unlock vault seed;
2. `Oggi → Prepara`;
3. scelta esplicita classe;
4. `Definisci la cornice` → Programmazione con profilo coerente, nessun altro profilo scelto arbitrariamente;
5. `Apri UDA` → stessa classe, nessuna UDA creata/auto-selezionata;
6. selezione UDA esplicita;
7. `Apri Programmazione` → stessa classe + UDA visibile nella barra;
8. `Apri UDA` → stesso focus ripristinato;
9. cambio classe → focus precedente assente;
10. uscita dal perimetro e rientro → nessuna resurrezione latente.

Mobile 390×844:
- ripetere il percorso principale;
- nessun horizontal overflow introdotto da INT-01;
- controlli INT-01 >=44 px;
- barra non copre controlli specialistici/fissi.

L'ambiguità di profilo/Arena resta obbligatoriamente coperta dai test di dominio; aggiungerla al browser solo se il seed può rappresentarla senza introdurre fixture invasive.

- [ ] **Step 4: Collegare il journey al Browser Qualification workflow**

Seguire il pattern FLOW-04: copiare lo spec nel workspace Playwright e aggiungere uno step `Run INT-01 Chromium qualification` con `CANDIDATE_SHA` e `EVIDENCE_DIR`.

- [ ] **Step 5: Eseguire regressioni complete locali**

Run:

```bash
bun run test:security
bun run test:library
bun run lint
bun run build
bun scripts/qualification/check-invariants.mjs
```

Expected: tutti PASS; build exit 0.

- [ ] **Step 6: Verificare esplicitamente le linee UX precedenti**

Eseguire i test focalizzati TODAY/FLOW-01/FLOW-02/FLOW-03/FLOW-04 già presenti nel repository, oltre ai contratti PERSIST-01H e A4-R2 toccati dal diff. Nessun test storico deve essere rimosso o indebolito per far passare INT-01.

- [ ] **Step 7: Commit**

```bash
git add qualification/invariants.v1.json \
  src/security/int01QualificationContract.test.ts \
  tests/browser/int-01-didactic-continuity.spec.cjs \
  .github/workflows/browser-qualification.yml
git commit -m "test: qualify INT-01 didactic continuity"
```

---

### Task 6: Exact-SHA qualification, review e promozione controllata

**Files:**
- No product changes expected.
- Update PR/issue documentation only after evidence exists.

**Interfaces:**
- Consumes: exact candidate SHA from Tasks 1–5.
- Produces: qualification evidence sufficient for Human Product/UX Review and eventual Draft → Ready.

- [ ] **Step 1: Freeze candidate and inspect the complete diff**

Verify:
- base remains `0488cd50287ef26883f395e2b79ab1fcba11ccdc` unless explicitly rebased under governance;
- no `MasterProgramVersion` persistence activation;
- no new UDA schema field;
- no student-personal projection introduced;
- no INT-02/LSM-02/MOBILE-01 scope creep.

- [ ] **Step 2: Run exact-SHA qualification workflows**

Require fresh success on candidate SHA for:
- Qualification Invariants;
- PREDEPLOY Security Qualification;
- Browser Qualification including INT-01 journey;
- any inherited FLOW contract workflow triggered by impact.

- [ ] **Step 3: Final Independent Review**

Review focus:
- class mismatch / ambiguity;
- stale focus resurrection;
- projected UDA write boundary;
- duplication/divergence between planning frame and LIB-03 bridge;
- regressions in FLOW-03 UDA diary behavior.

Any Critical/Important finding blocks promotion until repaired and requalified on a new exact SHA.

- [ ] **Step 4: Human Product/UX Review comparativa**

Compare baseline `main@0488cd50287ef26883f395e2b79ab1fcba11ccdc` with exact candidate.

PASS criteria from spec:
- one perceptible chain `classe → cornice Programmazione → UDA → eventuale lezione`;
- no new dashboard;
- no arbitrary selection;
- Programmazione no longer feels detached from the selected class;
- UDA remains the operational workspace, not a parallel app;
- two-way handoff preserves context;
- Docente OS read-only state is understandable and not presented as a writable local UDA.

- [ ] **Step 5: Promotion gate**

Only after Human PASS and exact-SHA gates remain fresh:
- record receipt on PR;
- move Draft → Ready;
- update #115 and #104 to `QUALIFIED / READY` but not integrated.

**Do not merge or deploy without a new explicit authorization.**
