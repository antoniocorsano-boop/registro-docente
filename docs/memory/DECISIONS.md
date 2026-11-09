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

## D-006 — CDC-02/S2b: fotografie confermate per seduta, confini P1/P2
- Stato: ACTIVE
- Data: 2026-11-09
- Decisione: contratto v1 ratificato per fotografie di soli sei aggregati S2a, identificate da classe, anno scolastico e ID stabile della seduta. Distinguere sessionDate, cutoff e capturedAt UTC, conservando captureLocalDate e captureUtcOffsetMinutes dal medesimo istante, protetti dal digest. Le fotografie sono versionate append-only dopo conferma esplicita; impronte e digest non costituiscono firma o anonimizzazione. Non inferire che informazioni registrate in seguito fossero gia disponibili alla data della seduta.
- Promozione: specifica e piano PR #180 integrati in main con merge `d0eae45216161d81c5e9dae4916407dfc9f502df`; P1 (solo modello puro e test sintetici) PR #181 integrato con merge `700428f6edf2e7b94ff3fa9b2ddf8c5d5b09cc41`, candidato qualificato `a8ccaa4538293d884f3e65181a8994d355ddcb03`. 5/5 gate exact-SHA, seconda review Codex senza finding e thread P2 chiuso. Il confronto con main dopo l'integrazione restituisce zero differenze di file rispetto al candidato qualificato.
- Promozione P2: compatibilita Vault, validazione strutturale e crittografica prima del ripristino, conservazione dei record nel backup v6, import V2–V6/legacy e rilevazione di perdita/alterazione con consenso esplicito. PR #183 integrata in `main` con merge `b919bbec4da7f3893069ee18dc3042f1cf4f0d41`; candidato exact-SHA `acd22f5c7b20196af58ebc6fc23d962923d82f15`. 5/5 gate PASS (Invarianti #42688544625; PREDEPLOY #42688544619; FLOW-03 #42688544713; HEADER-01 #42688544654; Chromium #42688544626), Codex re-review sullo stesso SHA con zero finding e thread chiuso. Confronto contenuti del candidato con `main` dopo merge: zero differenze nei file. Nessuna nuova chiave Vault e nessun aumento di versione backup.
- Confine: P1 resta un modello puro, mentre P2 ne integra i controlli in archivio e ripristino senza introdurre cattura o scrittura automatica di nuove fotografie. S2b-P3 (conferma esplicita e interfaccia) e P4/P5 richiedono sviluppo e qualificazione separati. Nessuna funzione di acquisizione fotografie disponibile nella versione distribuita, nessuna distribuzione autorizzata. `vercel.json` mantiene `git.deploymentEnabled=false`.
- Motivazione: storia delle sedute consultabile in futuro senza retrodatazioni, perdita silenziosa, duplicazione di dati individuali o scambio tra modello isolato e persistenza.
- Origine: issue #170, PR #180/#181/#183, ratifica umana PR #180 commento 6748338669, ricevuta PR #181 commento 6748973795, ricevuta PR #183 commento 6750192954, decisioni umane di promozione del 2026-11-09.
- Sostituisce: —
