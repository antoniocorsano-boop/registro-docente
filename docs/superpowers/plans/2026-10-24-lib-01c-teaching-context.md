# LIB-01C Teaching Context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collegare una fonte della Biblioteca privata a un contesto didattico esplicito UDA/lezione e far transitare quel contesto minimizzato nel TRAMA Contextual Copilot Core prima di ogni write reversibile.

**Architecture:** Il contesto resta transitorio e locale alla card della Biblioteca. L'adapter valida UDA/lezione contro i dati già disponibili, costruisce il `ContextSnapshot` minimizzato e usa il Core condiviso già vendorizzato; la UI usa il contesto validato per scegliere il target verticale `uda` o `lesson` dopo il gate umano.

**Tech Stack:** React 19, TypeScript 7, Bun 1.4.4, `@trama/contextual-copilot-core@0.1.0`, Playwright 1.64.1.

**Spec:** `docs/superpowers/specs/2026-10-24-lib-01c-teaching-context-design.md`

## Global Constraints

- Baseline obbligatoria: `ab1e23c1014dc96231aa92cfe8cf6e39a47c50a0`.
- Nessuna inferenza automatica di UDA/lezione.
- Nessun testo, titolo, URL, immagine, estratto o nota della fonte nel `ContextSnapshot`.
- Nessun topic/notes della lezione nel `ContextSnapshot`.
- `unknown` resta fail-closed come `STUDENT_PERSONAL`; il contesto didattico aggiunge `CURRICOLO`.
- `remoteProviderAllowed = false`; `generativeMode = none`.
- Nessun nuovo dominio persistente materiali/attività.
- RED causale prima del GREEN; exact-SHA per ogni qualifica.
- Dati browser solo sintetici.
- Nessun merge/deploy automatico.

## Review Focus

- `lessonId` appartenente a una UDA diversa deve essere rifiutato e non comparire nel snapshot.
- Cambio UDA deve azzerare la lezione precedente per evitare target stale.
- UDA senza lezioni deve restare collegabile come UDA senza UI bloccata.
- Fonte `unknown` + contesto curricolare deve restare non autorizzata a provider remoto.
- Failure di persistenza dopo conferma deve conservare contesto e possibilità di retry senza falso successo.

---

### Task 1: Context contract and adapter

**Files:**
- Create: `src/library/teachingContext.ts`
- Modify: `src/library/contextualCoreAdapter.ts`
- Test: `src/security/lib01cTeachingContextContract.test.ts`

**Interfaces:**
- Produces: `LibraryTeachingContext`, `resolveLibraryTeachingContext(udas, context)`, `buildLibraryContextSnapshot(source, teachingContext?)`, context-aware resolve/dispatch.
- Consumes: `UdaRecord`, `UdaLesson`, existing shared Core package.

- [ ] **Step 1: Write the failing contract tests**

Assert that a valid UDA+lesson adds only structural `uda`/`lesson` entities; invalid lesson ownership fails closed; `CURRICOLO` is added without weakening source privacy; dispatch still requires human confirmation.

- [ ] **Step 2: Run PREDEPLOY test-only candidate and verify causal RED**

Expected: only new LIB-01C contract assertions fail for missing teaching-context behavior; bootstrap/typecheck/build must not be the cause.

- [ ] **Step 3: Implement minimal teaching-context helper and adapter extension**

Signatures:

```ts
export interface LibraryTeachingContext { udaId: string; lessonId?: string }
export function resolveLibraryTeachingContext(udas: UdaRecord[], context: LibraryTeachingContext | null): ResolvedLibraryTeachingContext | null
export function buildLibraryContextSnapshot(source: LibrarySource, teachingContext?: ResolvedLibraryTeachingContext | null): ContextSnapshot
```

Extend `resolveLibraryContextActions` and `dispatchLibraryContextAction` with the optional resolved context.

- [ ] **Step 4: Run full security suite**

Expected: all tests PASS.

- [ ] **Step 5: Commit**

Commit message: `feat: add LIB-01C teaching context contract`.

### Task 2: Progressive-disclosure teaching context UI

**Files:**
- Modify: `src/components/LibrarySourceCard.tsx`
- Test: `src/security/lib01cTeachingContextContract.test.ts`

**Interfaces:**
- Consumes: Task 1 `LibraryTeachingContext` / resolver.
- Produces: transient UDA/lesson selection, contextual review, target selection for `onLink`.

- [ ] **Step 1: Extend failing UI contract tests**

Assert `Contesto di lavoro`, UDA select, conditional lesson select, activity summary, use of context-aware adapter, lesson-target link, UDA fallback, and reset of lesson on UDA change.

- [ ] **Step 2: Verify RED**

Expected: new UI assertions fail while Task 1 tests stay green.

- [ ] **Step 3: Implement minimal UI**

Keep manual `Gestisci -> Collega a UDA` unchanged. In the contextual panel require an explicit UDA before contextual link; optional lesson refines target. Use the Core confirmation gate before `onLink`.

- [ ] **Step 4: Run full security suite**

Expected: all tests PASS.

- [ ] **Step 5: Commit**

Commit message: `feat: connect library actions to teaching context`.

### Task 3: Permanent browser qualification

**Files:**
- Create: `tests/browser/lib01c-teaching-context-qualification.spec.cjs`
- Modify: `.github/workflows/browser-qualification.yml`

**Interfaces:**
- Consumes: Task 2 UI.
- Produces: permanent desktop/mobile evidence for LIB-01C.

- [ ] **Step 1: Add browser test to permanent workflow before relying on it**

Desktop synthetic journey: create UDA with lesson/activity, create source, reload, `Usa`, select UDA+lesson, verify activity, review, request link, verify no mutation, confirm, verify lesson link survives reload; then create a second source and verify UDA-only fallback. Network guard begins at contextual journey and requires zero external requests.

Mobile: verify context controls/actions >=44x44, no overflow, no pageerror.

- [ ] **Step 2: Run PREDEPLOY and Browser Qualification on the same exact SHA**

Expected: PREDEPLOY full PASS and Browser full PASS; exact checkout must match candidate.

- [ ] **Step 3: Review final diff and update PR receipt**

Check that only intended files changed; no provider activation, no generated material domain, no weakened browser/security gate.

- [ ] **Step 4: Stop at human integration decision**

No merge or deploy.