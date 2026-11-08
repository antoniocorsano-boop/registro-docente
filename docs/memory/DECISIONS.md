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

## D-005 — INT-02/S2b: provenienza professionale minima, opzionale e governata
- Stato: ACTIVE (contratto e implementazione integrati in `main`; nessuna distribuzione autorizzata)
- Data: 2026-11-08
- Decisione: scegliere la soluzione B per le nuove verifiche avviate da una fonte Biblioteca: `OnlineTest.provenance?` può conservare soltanto `{ version: 1, kind: 'library-source', sourceId, confirmedByTeacher: true }` dopo conferma esplicita del docente, riesame della fonte `ready` e `teacher-professional` e identità della classe al commit serializzato. Il riferimento non è autorità su UDA, classi, condivisione, valutazioni o permanenza della fonte. Le verifiche storiche e i riferimenti resi non disponibili restano editabili senza riassegnazione o ricertificazione; i metadati non compaiono nelle proiezioni per studenti.
- Compatibilità: nessuna nuova chiave del Vault o incremento della versione di backup; test precedenti privi del campo restano validi, metadati malformati sono rifiutati nel ripristino delle versioni supportate. La conferma non trasferisce contenuti della fonte.
- Promozione: PR #160 integrata in `main` su decisione esplicita del docente, merge commit `e6b518656efbfaeeaa85e04512fa149ef48bf91a` dal candidato qualificato `a6d5d24e3e373c75da59f25172046bae7eeb7bb7`. Test RED→GREEN, 5 gate exact-SHA, revisione indipendente Codex e HPR visiva mobile sintetica approvata (ricevuta PR #160). Verificata identità dell'albero del merge commit con quello del candidato. L'integrazione NON autorizza deploy, pubblicazione o scritture automatiche: Vercel resta disabilitato.
- Motivazione: tracciabilità utile al docente senza duplicare Biblioteca, violare minimizzazione/privacy o introdurre una seconda autorità.
- Origine: issue #140 audit S2b (2026-11-08), roadmap #104, PR #160.
- Sostituisce: stato S2b differito della specifica storica 2026-11-08; non modifica D-001–D-004.
