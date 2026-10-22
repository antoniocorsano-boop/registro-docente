# P2 Product Review — Canonical Resolution Tracker

**Date:** 2026-10-22  
**Repository:** `antoniocorsano-boop/registro-docente`  
**Baseline reviewed:** `main@99ebb78e4bc994eaaf0e234c2f7c6ad213387919`  
**Review mode:** read-only product audit, real browser + source inspection  
**Viewports reviewed:** mobile `390×844`, desktop `1280×900`  
**Status:** `P2-PRODUCT-REVIEW = COMPLETE`

## Purpose

This document is the canonical tracker for the product findings identified after the security, privacy, analytics-integrity, responsive-core, and valuation-semantics work was merged and post-merge qualified.

The goal is to resolve product problems in bounded, testable increments without reopening unrelated technical fronts. Each item below must retain its own evidence, TDD cycle where applicable, review gate, and merge decision.

## Baseline already closed

The review starts from a product baseline where the following fronts are already merged and qualified:

- SEC-0 / SEC-1 — Secure Local Vault, encrypted persistence, verified migration and backup;
- SEC-2 / SEC-3 — runtime outbound boundaries and fail-closed remote/provider policy;
- PREDEPLOY-01 — persistent typecheck/test/build/startup qualification;
- PRIVACY-01 — Privacy Shield fail-closed by default;
- ANALYTICS-01 — fail-closed analytics and no synthetic evidence/data;
- UX-MOBILE-01 — responsive core at 320–390 px, including mobile scrutiny cards;
- VAL-01 / VAL-02 — valuation semantic audit and bounded correction.

No open pull request was present when this product review began.

## Product assessment

The product is technically stable enough to be judged primarily as a teacher-facing workflow rather than as an engineering prototype. The daily path `Classe → Valutazioni → Tabellone` is already relatively direct. The main remaining problems concern safety of interaction on mobile, information architecture, fail-closed consistency outside Analytics, leakage of technical concepts into teacher-facing UI, and excessive content density in advanced views.

## Findings tracker

| ID | Severity | Finding | Evidence | Target state | Status |
|---|---|---|---|---|---|
| **P2-01** | **CRITICAL** | Mobile collision between `Blocca Registro` and bottom navigation | At 390 px, the fixed Vault control is `z-50` at the bottom-right while the mobile nav is `z-40`. Their hit areas overlap. A real click on `Tabellone` was intercepted by `Blocca Registro`, locking the Vault. Source surfaces: `src/components/SecureRegistroRoot.tsx`, `src/components/Navbar.tsx`. | Mobile navigation actions must never be occluded or intercepted by Vault controls. Lock/auto-lock controls remain accessible without overlapping the bottom nav. | **OPEN — NEXT** |
| **P2-02** | **HIGH** | Navigation and nomenclature are fragmented | Same concepts use multiple labels: `Inserisci Voti` / `Inserisci Valutazioni`; `Note` / `Valutazione Comportamenti` / `Note Comportamento`; `Analytics` / `Analisi & indicatori` / `Analisi Soglie`; `Cruscotto` / `Dashboard`. Desktop also duplicates navigation through workflow hub, drawer, and dashboard shortcuts. | One teacher-facing vocabulary and a clearly primary navigation path; secondary navigation must not compete with it. | **OPEN** |
| **P2-03** | **HIGH** | Dashboard is not fully fail-closed | `DashboardView.tsx` correctly sets `classAvg = null` when no valid averages exist, but sets `suffRate = 0`, allowing a class with no valid data to appear as `0%` sufficiency. This conflicts with ANALYTICS-01 semantics. | No valid averages → `— / Nessun dato`, never a synthetic `0%`. | **OPEN** |
| **P2-04** | **HIGH** | Technical/internal model leaks into teacher-facing UI | UDA Gantt still labels a table column `Crediti` although VAL-02 redefined the concept as internal `Indice Attività UDA`. Settings expose `Theme Engine`, `Motore Vettoriale`, `Embedding Locale`, Termux, llama.cpp, endpoint/model/API-key configuration in the same primary surface as teacher profile and evaluation preferences. | Teacher-facing surfaces use pedagogical language. Technical/provider configuration is moved behind an explicit advanced/developer section. UDA uses the VAL-02 terminology consistently. | **OPEN** |
| **P2-05** | **MEDIUM/HIGH** | Advanced views are excessively dense | At 390 px, Analytics is approximately 4365 px tall, Student Report approximately 4172 px, Settings approximately 2827 px. Responsive containment is correct, but most sections are expanded simultaneously and require long scrolling. | Progressive disclosure: primary decision/action first, deeper charts/dossiers/settings on demand. No loss of data or capability. | **OPEN** |

## Resolution order

The canonical sequence is:

1. **P2-CORE-01 — daily workflow safety & trust**  
   Resolve P2-01, P2-03, and the UDA terminology residue from P2-04. This is the next implementation front.

2. **P2-NAV-01 — navigation & vocabulary consolidation**  
   Resolve P2-02 without redesigning the whole application. Establish a single vocabulary and define which navigation surface is primary on desktop and mobile.

3. **P2-ADVANCED-01 — teacher-first settings / technical separation**  
   Complete P2-04 by moving embedding/provider/runtime configuration behind an explicit advanced surface while preserving capabilities and privacy/security boundaries.

4. **P2-DENSITY-01 — progressive disclosure for Analytics and Student Report**  
   Resolve P2-05 by reducing first-screen cognitive load, not by deleting evidence or analytical capability.

## P2-CORE-01 bounded scope

The first implementation front must contain only:

- remove the mobile hit-area/z-index collision between Vault controls and bottom navigation;
- make Dashboard sufficiency fail-closed when there are no valid averages;
- replace the remaining teacher-visible UDA `Crediti` label with terminology consistent with `Indice Attività UDA`.

### Explicitly out of scope for P2-CORE-01

- navigation redesign;
- palette/theme redesign;
- new bottom navigation;
- changes to grading formulas;
- changes to Vault cryptography/storage;
- changes to privacy policy;
- moving embedding configuration;
- Analytics/StudentReport progressive disclosure;
- deploy.

## Acceptance criteria for P2-CORE-01

- At 320 px and 390 px, all bottom navigation targets are physically clickable and cannot be intercepted by Vault controls.
- `Blocca Registro` remains available without covering the bottom navigation.
- A class with zero valid averages shows an unavailable/no-data state for sufficiency, not `0%`.
- Teacher-visible UDA tables and summaries do not call the internal activity index `Crediti` or `CFS`.
- Existing VAL-02 terminology remains intact.
- Existing privacy, storage, security and responsive contracts remain green.
- Typecheck, full test suite, production build, startup smoke and real-browser verification pass on the exact final head.
- Merge and deploy remain separate decisions.

## Evidence notes from the review

### Mobile interaction defect

At `390×844`, the bottom-nav `Tabellone` target occupied approximately `y=795..840`, while the fixed Vault `Blocca Registro` control occupied approximately `y=788.5..822.5`. The areas overlap. The Vault wrapper is `z-50`; the mobile nav is `z-40`. Browser hit-testing at the overlap returned the lock control above the navigation target.

### Product-language observations

Examples observed in the current UI include:

- Home: `Cruscotto Globale d'Istituto`, `Analisi Comparativa Sezioni (Cross-Class)`;
- desktop workflow hub: `Inserisci Voti`, `UDA & Gantt`, `Scheda Alunno`, `Analytics`;
- drawer/dashboard: `Inserisci Valutazioni`, `Valutazione Comportamenti`, `Analisi & indicatori`, `Analisi Soglie`;
- UDA: `Cronoprogramma Gantt con Propedeuticità & Slittamento a Cascata`, `Semantica AI`, table column `Crediti`;
- Settings: `Theme Engine`, `Motore Vettoriale & Embedding Locale (Termux / llama.cpp / On-Device)`.

These are not all individually defects; together they indicate that the interface still exposes implementation/analytical vocabulary more strongly than teacher-task vocabulary.

## Governance for follow-up work

- This tracker is the source of truth for the P2 product-review findings until all items are closed or explicitly superseded.
- Do not mark a finding closed because code changed; close it only after exact-head qualification and the relevant real-browser/product check.
- New findings discovered during a bounded fix may be added here only if they belong to the same product-review program; unrelated technical work must remain outside this tracker.
- Do not merge or deploy automatically.

## Current canonical next action

**NEXT = `P2-CORE-01`**

State at creation:

`P2-PRODUCT-REVIEW = COMPLETE / TRACKER MATERIALIZED / P2-CORE-01 READY FOR BOUNDED DESIGN`
