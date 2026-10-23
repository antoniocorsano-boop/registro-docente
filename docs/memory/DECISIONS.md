# Durable Decisions

Decisioni che definiscono confini o metodi durevoli. Le voci obsolete restano visibili con stato `SUPERSEDED`.

## D-001 — Repository as canonical operational memory
- Stato: ACTIVE
- Data: 2026-10-23
- Decisione: il repository è la fonte canonica per memoria operativa, regole, ricette, lesson learned e decisioni del progetto. La memoria conversazionale è supporto di lavoro, non autorità sostitutiva.
- Motivazione: versionabilità, ispezionabilità, revisione e persistenza deterministica.
- Origine: MEM-QUAL-01.
- Sostituisce: —

## D-002 — Hybrid agentic memory protocol
- Stato: ACTIVE
- Data: 2026-10-23
- Decisione: usare memoria ibrida composta da `AGENTS.md` + `docs/memory/` + Memory Capsule, invece di sola memoria ChatGPT o soli documenti passivi.
- Motivazione: combina autorità versionata e consultazione obbligatoria senza imporre aggiornamenti per ogni micro-fix.
- Origine: MEM-QUAL-01.
- Sostituisce: —

## D-003 — Canonical browser certification on GitHub-hosted ephemeral runner
- Stato: ACTIVE
- Data: 2026-10-23
- Decisione: la qualificazione browser canonica usa GitHub Actions + Playwright sull'exact candidate SHA; prove manuali o sandbox conversazionali restano diagnostiche.
- Motivazione: riproducibilità, isolamento, evidenza legata al candidato e assenza di dipendenza da risorse conversazionali non garantite.
- Origine: LL-001 / OR-004.
- Sostituisce: —

## D-004 — Qualification never authorizes merge/deploy
- Stato: ACTIVE
- Data: 2026-10-23
- Decisione: il completamento dei gate tecnici non abilita auto-merge, deploy o pubblicazione. La decisione umana resta separata.
- Motivazione: preservare il confine tra evidenza tecnica e decisione irreversibile.
- Origine: MEM-QUAL-01 / OR-006.
- Sostituisce: —
