# MOBILE-TAB-01 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fornire un Tabellone realmente mobile-first sotto `md` senza cambiare dati o comportamento desktop.

**Architecture:** `MatrixView` renderizza una presentazione a card sotto `md` e conserva la matrice corrente dentro un wrapper desktop `hidden md:block`. Le card riusano `calcAvg`, `computeProposed`, `Sparkline`, filtri e dati già in memoria.

**Tech Stack:** React 19, TypeScript, Tailwind utility classes, Bun tests.

**Spec:** `docs/superpowers/specs/2026-10-23-mobile-tab-01-teacher-first-tabellone-design.md`

## Global Constraints
- Baseline: `main@804f98f916f9aaaa34915fd3a63951439c4f6ea6`.
- Nessuna modifica a formule, persistenza, Vault, Analytics o UDA.
- Desktop `>= md` invariato funzionalmente.
- Nessun merge/deploy automatico.

## Review Focus
- 360 px: nessun overflow pagina e nessuna tabella desktop visibile.
- 390 px: card leggibili e report studente raggiungibile con target >=44 px.
- Modalità `cron`, `type`, `avg`: contenuto mobile coerente con i filtri esistenti.
- `showProposedGrade=false`: nessun indicatore secondario mobile.
- Desktop 1280 px: tabella esistente presente e utilizzabile.

---

### Task 1: Responsive Tabellone contract

**Files:**
- Modify: `src/security/mobileUxIntegrity.test.ts`
- Modify: `src/components/MatrixView.tsx`

**Interfaces:**
- Consumes: `currentClass`, `onOpenStudentReport`, `isPrivacyShieldActive`, `settings` già esistenti.
- Produces: presentazione mobile-only e wrapper desktop-only; nessuna nuova API.

- [ ] **Step 1: Write the failing test**
  Aggiungere un test che richieda in `MatrixView.tsx`: marker `Mobile student cards`, `className="md:hidden space-y-3"`, `className="hidden md:block overflow-x-auto`, `min-h-[44px]`, accesso `onOpenStudentReport(s.id)`, e contenuti per le tre modalità.
- [ ] **Step 2: Run the focused test and verify causal RED**
  Run: `bun test src/security/mobileUxIntegrity.test.ts`
  Expected: unica nuova failure sul contratto MatrixView mobile.
- [ ] **Step 3: Implement minimal mobile cards + desktop wrapper in MatrixView**
  Riutilizzare gli stessi calcoli e filtri; nessun helper persistente o nuova dipendenza.
- [ ] **Step 4: Run focused test, typecheck, build and full security suite**
  Expected: GREEN; eventuali timeout ambientali SEC-3 vanno distinti da failure prodotto.
- [ ] **Step 5: Commit exact GREEN candidate**
  Commit prodotto separato dal RED test-only.

### Task 2: Candidate qualification

**Files:** nessuna modifica prevista.

- [ ] **Step 1: PREDEPLOY sul candidate exact SHA**
- [ ] **Step 2: Browser production preview a 360x800 e 390x844**
  Verificare overflow X=0, tabella desktop nascosta, card presenti, click report e tutte le modalità.
- [ ] **Step 3: Browser desktop 1280x800**
  Verificare matrice desktop e assenza card mobile.
- [ ] **Step 4: Independent Codex review sullo stesso SHA**
- [ ] **Step 5: Fermarsi a HUMAN INTEGRATION DECISION**
