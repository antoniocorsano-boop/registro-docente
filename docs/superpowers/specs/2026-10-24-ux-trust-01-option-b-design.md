# UX-TRUST-01 — Option B Design

**Date:** 2026-10-24  
**Repository:** `antoniocorsano-boop/registro-docente`  
**Audit baseline:** `docs/superpowers/specs/2026-10-24-ux-trust-01-full-app-audit-baseline.md`  
**Audit product baseline:** `main@ad4dfcc2fabacbb05ce7d9a080ad06be73de0fed`  
**Approved strategy:** Option B — shared trust/mobile primitives + bounded semantic corrections  
**Status:** APPROVED FOR IMPLEMENTATION PLANNING

## Goal

Improve teacher-facing mobile usability and analytical trust across the full application without redesigning the navigation shell, reopening persistence/security architecture, changing grading mathematics, or introducing new infrastructure.

## Product principles

1. Preserve the current information architecture, visual identity, local-first security model, persistence contract, and Student Portal isolation.
2. Fix systemic causes once through small shared primitives/helpers, then apply them to affected surfaces.
3. Prefer semantic clarity over cosmetic simplification: labels, severity states and recommendations must describe what the product actually knows.
4. Preserve fail-closed analytics: missing evidence stays unavailable rather than being imputed.
5. Preserve existing mobile bottom clearance (`pb-36 md:pb-20`). UXT-A addresses persistent viewport occupation and touch ergonomics, not missing padding.
6. No new remote service, telemetry, account requirement or student tracking.
7. Every implementation slice must use a causal RED → GREEN proof and be independently qualifiable on an exact SHA.

## Shared layer

### 1. Mobile security affordance

Extract the persistent READY-state Vault controls from the page content into a reusable `VaultControls` presentation contract.

Desktop may retain a compact fixed control cluster because viewport occupation is small relative to available space. Mobile must not keep the current wide floating toolbar permanently over task content. The preferred behavior is a compact security affordance that exposes current auto-lock state and an explicit lock action through a touch-safe control without adding more generic bottom padding.

Acceptance intent:
- the existing content clearance remains unchanged;
- primary page content can occupy the viewport above bottom navigation without a 300+ px-wide floating toolbar;
- `Blocca Registro` remains reachable in one direct interaction;
- auto-lock state remains discoverable;
- security behavior itself is unchanged.

### 2. Touch-safe operational controls

Introduce a small shared utility/component contract for compact operational controls on mobile. The visible glyph/chip may remain visually compact, but the interactive hit area must reach the project target of at least 44×44 CSS px when space permits. Desktop density may stay unchanged.

This applies first to high-impact controls identified by the audit: destructive icons, quick-grade controls, behavior chips, edit/delete actions, UDA temporal shift controls, settings numeric controls and Privacy inputs/actions.

### 3. Canonical backup vocabulary

Teacher-facing backup language must match the actual encrypted backup contract. Canonical vocabulary:
- `Backup cifrato`;
- `Esporta backup cifrato`;
- `Ripristina backup cifrato`;
- `.enc.json` where a file format is mentioned.

Home, drawer and Settings should navigate to the Privacy backup surface instead of implying an independent plaintext JSON path. No backup handler or encryption format changes are authorized by this program.

### 4. Shared analytical semantics

Create pure helpers where the same semantic decision is currently embedded in rendering code:

- competency evidence coverage: represented dimensions / total dimensions, preserving unavailable dimensions;
- growth recommendation: only an absolute weakness threshold may produce `Area da consolidare`; otherwise use relative wording or no remediation;
- UDA gap severity: derive planning / upcoming / ending / overdue states from the real current school month and available formal evidence;
- UDA remediation language: recommend planning/linking evidence first, not creating a grade as the goal.

These helpers must be deterministic and directly unit-testable.

## UDA semantic contract

### Calendar

Remove the frozen `currentSchoolMonthIndex = 1` assumption from severity decisions. The current school-month index must derive from the actual current date using the existing school-year month ordering. Tests must pin at least upcoming, active, ending-now and ended cases.

### Severity

Absence of a formal test is not independently critical.

Required progression:
- future/upcoming UDA without formal evidence → planning state;
- active UDA without formal evidence → planning/watch state;
- UDA close to planned end without adequate evidence → in scadenza;
- ended UDA with unresolved evidence gap → critico/scaduto.

### Activity metric

Preserve the existing composite contribution unless separately approved:
- weighted lesson hours;
- plus `1` point per distinct linked evaluation batch;
- composite rounded to one decimal;
- teacher-facing activity index derived from the composite divided by `10` and rounded according to the existing implementation contract.

UXT-D may rename, explain or de-emphasize the two related scales, but must not silently drop the evaluation-batch contribution.

## Competency/radar contract

The six potential competency dimensions remain the conceptual model, but only evidenced dimensions are plotted. The UI must make coverage explicit, e.g. `3/6 con evidenze`, and unavailable dimensions must not be visually implied as assessed.

A weakest-relative dimension is not automatically an absolute weakness. `Area da consolidare` requires an explicit absolute criterion. If all evidenced dimensions are strong, the UI should either omit remediation or use a neutral relative label.

## KPI clarity

`Tasso sufficienze` must expose its denominator: students with a valid average. The display should make clear both numerator and available-denominator where feasible, e.g. `7 su 8 con media disponibile`.

## Mobile presentation contract

Do not replace every table with cards. Apply responsive cards/progressive disclosure only where the live audit found teacher reading/scanning friction. Preserve dense desktop views that are already efficient.

Priority surfaces:
- expanded student evaluation dossier;
- class comparison islands;
- long Analytics student sections;
- UDA dense action/control clusters.

## Slice boundaries

### UXT-A — Mobile security + touch contract

Owns:
- Vault viewport occupation;
- shared touch-safe primitive/utility;
- first high-impact application of that utility.

Must not change lock timing, encryption, persistence or navigation architecture.

### UXT-B — Trust vocabulary + KPI denominator

Owns:
- encrypted-backup copy/navigation consistency;
- sufficiency denominator clarity;
- mobile shell status naming where copy-only/accessibility improvements are sufficient.

Must not change backup mechanics or analytics mathematics.

### UXT-C — Competency semantics

Owns:
- evidence coverage labels;
- absolute-vs-relative growth rule;
- radar explanatory states.

Must preserve fail-closed evidence filtering.

### UXT-D — UDA semantics

Owns:
- real calendar basis;
- gap severity state machine;
- planning-first remediation copy/actions;
- conceptual separation of the two activity scales while preserving the evaluation-batch bonus.

Must not redefine grading or evidence persistence.

### UXT-E — Targeted mobile presentation

Owns only audit-proven density/readability hotspots. It may add progressive disclosure, card rows or responsive layout variants, but must not redesign global navigation or desktop hierarchy.

### UXT-F — Full regression qualification

Re-run the complete application inventory in mobile and desktop with synthetic-only data, verify no new document overflow, no broken Student Portal isolation, no page/console errors, and prove each remediated contract in the browser.

## Qualification model

Each slice follows:
1. exact branch head recorded;
2. test-only causal RED proving the pre-existing defect;
3. minimal GREEN implementation;
4. locked dependency install;
5. typecheck/tests/build/startup smoke;
6. browser qualification where the behavior is visual/interactational;
7. independent final review on the same exact SHA;
8. separate human integration decision.

No slice may auto-merge, deploy, publish or mutate canonical production data.

## Non-goals

- no global visual redesign;
- no new navigation model;
- no changes to encryption algorithms or Vault persistence;
- no remote synchronization or user accounts;
- no student telemetry/auth/tracking;
- no grading-scale change;
- no removal of fail-closed analytics;
- no new infrastructure or paid dependency.
