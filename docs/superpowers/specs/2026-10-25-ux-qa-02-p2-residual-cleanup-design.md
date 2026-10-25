# UX-QA-02-P2 — Residual Progressive Disclosure Cleanup Design

## Intent

Close the three non-blocking P2 findings left by UX-QA-02 after PR #43 without reopening the already-qualified P1 scope.

Baseline: `main@2151cf2a8cedb760d3e0efa0242b22833e49b774`.
Tracking issue: #44.

## Goals

1. `UXPD-009`: remove destructive class deletion from the primary class-card surface and disclose it only after an intentional secondary management action.
2. `UXPD-005`: use a human-readable title as the primary label for file/image library sources while preserving the exact filename as secondary provenance.
3. `UXPD-006`: keep Settings profile/identity primary and disclose evaluation weighting on demand, consistently with the already-collapsed technical integrations section.

## Non-goals

- No data-model, persistence, vault, routing, AI-provider or migration changes.
- No redesign of Home, Library or Settings beyond the three findings.
- No change to deletion semantics: explicit destructive confirmation remains mandatory.
- No automatic content extraction or AI title generation for uploaded files.

## Approach

### UXPD-009 — class management disclosure

Keep the class card primary action as `Apri classe`. Replace the always-visible delete control with a touch-safe `Gestisci classe <name>` control. Opening it reveals an in-card secondary management region containing `Elimina classe <name>`. The existing confirmation prompt and durable mutation path remain unchanged. The management region stays inside the card so it cannot be clipped by the card's `overflow-hidden` boundary.

Alternative rejected: a floating popover outside the card. It is more fragile with the existing overflow boundary and adds unnecessary positioning/focus complexity.

### UXPD-005 — human-readable file title

Derive a deterministic display title locally from the uploaded filename: remove the final extension, replace `_` and `-` runs with spaces, collapse whitespace, and preserve the resulting words/digits. Keep the exact original filename in `source.origin`. The teacher can still rename the source through the existing management action.

Alternative rejected: parse uploaded content or call an AI service to infer a title. That would enlarge scope, add file-type-specific behavior and violate the local deterministic boundary of this cleanup.

### UXPD-006 — weighting disclosure

Wrap the existing evaluation-weighting controls in a native `details` disclosure with a touch-safe summary labelled `Ponderazione delle valutazioni`. Keep the current fields, presets and save semantics unchanged. The existing `Impostazioni avanzate e integrazioni` disclosure remains separate.

Alternative rejected: create a new Settings router/tab system. The finding only requires progressive disclosure; a new navigation layer would be disproportionate.

## Accessibility and interaction constraints

- Secondary disclosure controls must be keyboard-operable and expose accessible names.
- New/modified primary management targets remain at least 44×44 CSS px.
- No new horizontal overflow at 390×844.
- Destructive deletion remains impossible without the existing explicit confirmation.
- The technical filename remains available as provenance after the human-readable title change.

## Verification

Each finding follows an independent RED → GREEN cycle in `tests/browser/ux-qa-02-progressive-disclosure.spec.cjs` and, where appropriate, a focused unit/contract test.

Final gate:
- PREDEPLOY PASS on one exact candidate SHA.
- Browser Qualification PASS with the complete suite.
- UX-QA-01 analyzer PASS with 0 findings.
- UX-QA-02 analyzer PASS with `UXPD-005`, `UXPD-006`, and `UXPD-009` absent.
- No merge or manual deploy without a new human decision.