# UDA-SEM-01 — semantic clarity for UDA progress metrics

## Intent
Remove ambiguity between real diary hours, internal activity points, and the internal 60/40 teaching-progress index, without changing any calculation, persistence contract, or curriculum authority.

## Goals
- Make teacher-facing labels self-explanatory on desktop and mobile.
- State explicitly that the 60/40 value is an internal planning indicator, not a ministerial or deliberative rule.
- Keep raw diary hours distinct from internal activity points.
- Preserve every existing formula and data source.

## Non-goals
- No formula, threshold, target, data-model, persistence, UDA workflow, or analytics change.
- No new normative claim and no reinterpretation of D.M. 221/2025.
- No redesign of the UDA screens.

## Approaches considered
1. Tooltip-only explanations — rejected because discoverability and touch accessibility are weak on mobile.
2. Rename labels only — improves wording but leaves the 60/40 relationship insufficiently explicit.
3. **Selected: precise labels plus compact visible methodological copy** — smallest change that remains understandable on mobile and keeps the existing UI structure.

## Canonical vocabulary
### Student dossier
- `Monte ore previsto`
- `Ore registrate nel diario`
- The internal activity value is expressed in `pt`, not hours: weighted logged hours contribute points and each linked evaluation batch contributes 1 internal point.
- The diary-hours ratio is labelled `% del monte ore`, not `% svolto`.

### UDA planning view
- `Avanzamento ore nel diario` for raw done/planned hours.
- `Indice di avanzamento didattico (interno)` for the existing composite 60/40 value.
- `Indice Attività UDA` is expressed as internal points: weighted logged hours plus 1 point per linked evaluation batch; it is not a duration, credit, or certification.
- Explanatory copy must state that the index combines 60% diary-hour coverage and 40% linked evaluations and is an internal planning criterion, not a prescribed assessment rule.
- D.M. 221/2025, when shown nearby, is labelled as `Contesto curricolare`, not as the source of the 60/40 formula.

## Invariants
The existing formulas remain unchanged, including:
`completionPct = Math.round((hoursRatio * 0.6 + evalRatio * 0.4) * 100)`.
`targetEvals = 2` remains unchanged.
No state, storage, mutation, encryption, analytics, or export contract changes.

## Acceptance
A teacher can distinguish at a glance: planned hours, hours actually logged, internal activity points, and the internal composite progress indicator. Static semantic tests pin the vocabulary and unchanged formula; browser verification checks the dossier and UDA summary on mobile and desktop.
