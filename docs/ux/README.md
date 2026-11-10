# Registro Docente — UX governance references

## Qualità di prodotto trasversale

- **Guida di prodotto:** [PRODUCT-QUALITY-01 — linguaggio, percorsi e accettazione docente](./PRODUCT-QUALITY-01.md).
- **Regola permanente candidata:** ogni lavorazione parte dal compito reale del docente; test tecnici e revisione di prodotto restano separati. La guida integra, senza sostituire, la baseline normativa UX-GOV-01.

## Canonical baseline

### UX-GOV-01 v1

- **Normative specification:** [`UX-GOV-01-registro-docente-user-flow-baseline-v1.md`](./UX-GOV-01-registro-docente-user-flow-baseline-v1.md)
- **Future user-flow visual:** [`assets/UX-GOV-01-future-user-flows-v1.svg`](./assets/UX-GOV-01-future-user-flows-v1.svg)
- **Transition roadmap:** [`../superpowers/plans/2026-11-02-ux-gov-01-transition-roadmap.md`](../superpowers/plans/2026-11-02-ux-gov-01-transition-roadmap.md)
- **Baseline product SHA:** `f332d63a9e26df41072f9b726142e612d408e7d0`

## Authority order

When references disagree, use this order:

1. normative UX-GOV-01 specification;
2. approved roadmap/design decisions;
3. canonical SVG diagram;
4. rendered presentation images/screenshots.

The diagram is the shared visual point of reference; the Markdown specification is the source of truth for exact semantics and governance.

## Core target model

```text
Secure access
→ Oggi
→ Prepara / Conduci / Registra / Rivedi
→ Professional Context retained across the journey
→ Specialist workspaces used on demand
→ Review feeds the next preparation cycle
```

## Canonical context

- Class
- UDA
- Lesson/activity
- Source
- Professional goal/intent
- Time context
- Privacy scope
- Accepted planning profile when relevant

## Canonical implementation sequence

`CTX-01 → TODAY-01 → FLOW-01 → FLOW-02 → FLOW-03 → FLOW-04 → INT-01 → INT-02 → LSM-02 → MOBILE-01 → UX-QA-03`

No implementation line may silently redefine the target flows. Material changes require a revision of UX-GOV-01.
