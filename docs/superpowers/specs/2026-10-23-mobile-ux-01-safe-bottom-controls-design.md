# MOBILE-UX-01 — Safe Bottom Controls Design

## Intent
Preserve the Secure Local Vault auto-lock/manual-lock controls as always-available safety actions without allowing them, together with the fixed mobile navigation, to cover teacher-facing content or actions.

Production screenshots captured on 23 October 2026 show the fixed vault control overlapping bottom content; in `Comportamento` it covers the `Salva Registro Comportamenti` action. This is a layout-safety defect, not a persistence or security-behavior defect.

## Goals
- On viewports below the `md` breakpoint, the scrollable application content must reserve enough bottom space for both the fixed bottom navigation and the fixed vault controls.
- On `md` and wider viewports, content must still clear the fixed vault controls.
- Keep `Blocca Registro`, the auto-lock selector, the bottom navigation, and their current behavior unchanged.
- Preserve all PERSIST-01H and SEC-1 contracts.

## Non-goals
- Redesigning the lock controls into a FAB, drawer item, modal, or collapsible surface.
- Changing inactivity timeout values or security semantics.
- Fixing Tabellone horizontal density, Analytics chart density, UDA progress semantics, or copy defects; those remain separate follow-up work.
- Deploying from this branch before qualification and human integration approval.

## Constraints
- Baseline: `main@6f7a1f2e4a2f696d81aed3f436d756c4a9074846`.
- No dependency, configuration, schema, crypto, storage, or navigation changes.
- The mobile navigation stays `fixed bottom-0`; vault controls stay `fixed bottom-16 md:bottom-3`.
- Use existing Tailwind spacing utilities only.

## Approaches considered
### A. Reserve structural bottom clearance in the application shell — selected
Increase the application-shell bottom padding from navigation-only clearance to combined navigation + vault-control clearance: `pb-36 md:pb-20`.

This is the smallest change, keeps security actions visible, and fixes every teacher view at once instead of patching individual screens.

### B. Move vault controls into the navigation drawer — rejected
This removes overlap but hides a safety action behind an extra navigation step and changes the established security interaction model.

### C. Replace the control bar with a collapsible lock FAB — rejected
This may save space but introduces new interaction state, discoverability questions, and a wider responsive redesign that is not needed to fix the defect.

## Acceptance criteria
- Source contract requires `pb-36 md:pb-20` at the application shell and rejects the previous `pb-16 md:pb-8` clearance.
- Existing source contract still proves mobile navigation is fixed at the bottom and vault controls remain above it.
- Typecheck, security tests, build, and production startup smoke remain green in canonical PREDEPLOY.
- Browser gate at a narrow mobile viewport confirms the last teacher action can be scrolled fully above the vault bar and bottom navigation and remains clickable.
- Browser gate at desktop width confirms bottom content can clear the fixed vault controls.
