# P2 Product Review — Canonical Resolution Tracker

**Date:** 2026-10-22  
**Repository:** `antoniocorsano-boop/registro-docente`  
**Baseline reviewed:** `main@99ebb78e4bc994eaaf0e234c2f7c6ad213387919`  
**Current integrated main:** `4c462b20ec4c00e695fd53bb20d5e3d66a0c6db1`  
**Review mode:** read-only product audit, real browser + source inspection  
**Viewports reviewed:** mobile `390×844`, desktop `1280×900`  
**Status:** `P2-PRODUCT-REVIEW = COMPLETE / RESOLUTION IN PROGRESS`

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

The product is technically stable enough to be judged primarily as a teacher-facing workflow rather than as an engineering prototype. The daily path `Classe → Valutazioni → Tabellone` is already relatively direct. The main remaining problems concern information architecture, leakage of technical concepts into teacher-facing UI, and excessive content density in advanced views. The first safety/trust defects identified by the review have now been closed through P2-CORE-01.

## Findings tracker

| ID | Severity | Finding | Evidence | Target state | Status |
|---|---|---|---|---|---|
| **P2-01** | **CRITICAL** | Mobile collision between `Blocca Registro` and bottom navigation | At 390 px, the fixed Vault control was `z-50` at the bottom-right while the mobile nav was `z-40`; a real click on `Tabellone` was intercepted by `Blocca Registro`. | Mobile navigation actions must never be occluded or intercepted by Vault controls. | **CLOSED — P2-CORE-01** |
| **P2-02** | **HIGH** | Navigation and nomenclature are fragmented | Same concepts use multiple labels: `Inserisci Voti` / `Inserisci Valutazioni`; `Note` / `Valutazione Comportamenti` / `Note Comportamento`; `Analytics` / `Analisi & indicatori` / `Analisi Soglie`; `Cruscotto` / `Dashboard`. Desktop also duplicates navigation through workflow hub, drawer, and dashboard shortcuts. | One teacher-facing vocabulary and a clearly primary navigation path; secondary navigation must not compete with it. | **OPEN — NEXT** |
| **P2-03** | **HIGH** | Dashboard was not fully fail-closed | `DashboardView.tsx` used `suffRate = 0` when no valid averages existed, allowing a class with no valid data to appear as `0%` sufficiency. | No valid averages → `— / Nessun dato`, never a synthetic `0%`. | **CLOSED — P2-CORE-01** |
| **P2-04** | **HIGH** | Technical/internal model leaks into teacher-facing UI | UDA Gantt exposed `Crediti`; Settings still exposes `Theme Engine`, `Motore Vettoriale`, `Embedding Locale`, Termux, llama.cpp, endpoint/model/API-key configuration in the same primary surface as teacher profile and evaluation preferences. | Teacher-facing surfaces use pedagogical language. Technical/provider configuration is moved behind an explicit advanced/developer section. | **PARTIAL — UDA terminology CLOSED; settings separation OPEN** |
| **P2-05** | **MEDIUM/HIGH** | Advanced views are excessively dense | At 390 px, Analytics is approximately 4365 px tall, Student Report approximately 4172 px, Settings approximately 2827 px. Responsive containment is correct, but most sections are expanded simultaneously and require long scrolling. | Progressive disclosure: primary decision/action first, deeper charts/dossiers/settings on demand. No loss of data or capability. | **OPEN** |

## Resolution order

The canonical sequence is:

1. **P2-CORE-01 — daily workflow safety & trust — COMPLETE**  
   P2-01, P2-03 and the UDA terminology residue from P2-04 are merged and post-merge qualified.

2. **P2-NAV-01 — navigation & vocabulary consolidation — NEXT**  
   Resolve P2-02 without redesigning the whole application. Establish a single vocabulary and define which navigation surface is primary on desktop and mobile.

3. **P2-ADVANCED-01 — teacher-first settings / technical separation**  
   Complete P2-04 by moving embedding/provider/runtime configuration behind an explicit advanced surface while preserving capabilities and privacy/security boundaries.

4. **P2-DENSITY-01 — progressive disclosure for Analytics and Student Report**  
   Resolve P2-05 by reducing first-screen cognitive load, not by deleting evidence or analytical capability.

## P2-CORE-01 closure evidence

Scope implemented:

- moved the mobile Vault controls above the bottom navigation without changing the desktop position;
- made Dashboard sufficiency fail-closed when there are no valid averages;
- replaced the teacher-visible UDA Gantt label `Crediti` with `Indice attività`.

Qualification evidence:

- implementation PR: **#10 — `P2-CORE-01 — daily workflow safety & trust`**;
- RED test-only head: `b82c387b89256ab0c559c61071a530695b43d20b`;
- qualified GREEN head: `71ce7ef187a0e5cb0fc7cc786b2934d7d21ab446`;
- PREDEPLOY #43 / run `39719061205`: **100 PASS / 0 FAIL**, 366 assertions, 20 files; typecheck, build and production startup smoke PASS;
- real-browser verification at 390×844 and 320×844: all five bottom-nav targets physically clickable; no Vault interception; no horizontal overflow;
- disposable zero-data class: Dashboard displayed `— / Nessun dato`, not `0%`;
- UDA Gantt displayed `INDICE ATTIVITÀ`, not `Crediti`;
- bounded review: PASS, 0 Critical / 0 Important;
- merge commit on `main`: `4c462b20ec4c00e695fd53bb20d5e3d66a0c6db1`;
- post-merge PREDEPLOY #44 / run `39719369024`: **100 PASS / 0 FAIL**, 366 assertions, 20 files; typecheck, build and production startup smoke PASS;
- no deploy.

**P2-CORE-01 = MERGED / POST-MERGE QUALIFIED / REAL-BROWSER VERIFIED.**

## Evidence notes from the review

### Mobile interaction defect — closed

Original evidence at `390×844`: bottom-nav `Tabellone` occupied approximately `y=795..840`, while the fixed Vault `Blocca Registro` control occupied approximately `y=788.5..822.5`, causing an overlap. After P2-CORE-01, the Vault control terminates at approximately `y=770.5`, while the bottom nav starts at approximately `y=795`; physical hit-testing and clicks succeed at both 390 px and 320 px.

### Product-language observations — still relevant to P2-NAV-01 / P2-ADVANCED-01

Examples observed in the reviewed UI include:

- Home: `Cruscotto Globale d'Istituto`, `Analisi Comparativa Sezioni (Cross-Class)`;
- desktop workflow hub: `Inserisci Voti`, `UDA & Gantt`, `Scheda Alunno`, `Analytics`;
- drawer/dashboard: `Inserisci Valutazioni`, `Valutazione Comportamenti`, `Analisi & indicatori`, `Analisi Soglie`;
- UDA: `Cronoprogramma Gantt con Propedeuticità & Slittamento a Cascata`, `Semantica AI`;
- Settings: `Theme Engine`, `Motore Vettoriale & Embedding Locale (Termux / llama.cpp / On-Device)`.

These are not all individually defects; together they indicate that the interface still exposes implementation/analytical vocabulary more strongly than teacher-task vocabulary.

## Governance for follow-up work

- This tracker is the source of truth for the P2 product-review findings until all items are closed or explicitly superseded.
- Do not mark a finding closed because code changed; close it only after exact-head qualification and the relevant real-browser/product check.
- New findings discovered during a bounded fix may be added here only if they belong to the same product-review program; unrelated technical work must remain outside this tracker.
- Do not merge or deploy automatically.

## Current canonical next action

**NEXT = `P2-NAV-01 — navigation & vocabulary consolidation`**

Current state:

`P2-PRODUCT-REVIEW = COMPLETE / P2-CORE-01 CLOSED / P2-NAV-01 READY FOR BOUNDED DESIGN`
