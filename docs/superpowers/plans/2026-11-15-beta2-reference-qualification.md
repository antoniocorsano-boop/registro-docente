# BETA2-QUAL-01 — Procedura di riferimento per Registro Docente

Stato: PROPOSTA IN QUALIFICAZIONE. Non è una autorizzazione alla distribuzione.
Baseline: PR #255, commit 4e3346f88e5612bcc5c3e2ded624818861604ee4. Tutti e tre i workflow di tale head PASS; 1274/1274 sicurezza, 31/31 NAV-CONTEXT, 40 prove Chromium nell'insieme MOBILE-DENSITY-02 e 17 osservazioni. Registro: 83 invarianti. Review Codex senza rilievi.

## Causa sistemica
Tre workflow parzialmente sovrapposti preparano Chromium e i prerequisiti in modi diversi. Rilevati riferimenti statici a commenti rinominati e assenza di Poppler. Le prove native hanno inoltre mescolato navigazione con ripristino, causando falsi arresti del percorso transazionale. Separare responsabilità; non scambiare un errore dell'ambiente per un difetto del prodotto.

## Sequenza vincolante (un candidato, una ricevuta finale)
| Gate | Evidenza richiesta | Stato |
|---|---|---|
| A — preflight e contratti | SHA esatto, lockfile, registro invarianti, typecheck, suite security/memory integrale, build | Workflow di riferimento introdotto, da qualificare |
| B — Chromium | Un solo bootstrap, Playwright bloccato, Poppler verificato, quattro suite NAV-CONTEXT/NAV-BACK/MOBILE-DENSITY/BEHAVIOR; evidenze sintetiche | Workflow di riferimento introdotto, da qualificare |
| C — pacchetto Android | Un solo build, SHA sorgente, hash APK, identità e manifest isolati, senza chiavi di distribuzione | Riutilizzare packaging verificato; nuovo candidato necessario |
| D — navigazione nativa | Android 12/16, ritorno contestuale e Privacy, protezione bozze, cronologia dopo ripristino | Da rieseguire sul nuovo APK esatto |
| E — archivio | Riavvio, voto/prova, copia cifrata, annullamenti, password errata, ripristino e nuovo riavvio; selettori nativi e navigazione esplicita | Evidenze precedenti sul 57694549, non trasferibili automaticamente |
| F — review e collaudo umano | Revisione indipendente exact head, ricevuta umana sul candidato identificato, esiti residui espliciti | Pendente; nessuna promozione automatica |

A/B possono essere eseguiti in parallelo; C–F devono riferirsi allo stesso candidato. Per ogni gate registrare SHA, run/job, artifact/hash ove pertinente, esito PASS/FAIL/INCOMPLETE, ambito e limiti. Una ricevuta finale aggrega tutti gli esiti; assenza di evidenza o mismatch SHA impediscono la promozione. Il registry comprende anche altre suite browser: questa prima unificazione copre solo le quattro suite dei tre workflow recenti, non tutte le 39 suite indicate nel registro. Inventario e mappatura delle restanti prove prima di dismettere controlli precedenti.

## Adozione progressiva
1. Qualificare il workflow unico A/B sulla PR dedicata; nessun cambiamento applicativo. Le procedure storiche restano attive.
2. Integrare solo dopo revisione ed autorizzazione; riconciliare le restanti suite, evitare esecuzioni duplicate solo dopo equivalenza documentata e verifica di eventuali protezioni branch.
3. Ricondurre packaging e diagnostiche native a un unico percorso con artefatto esatto e gate distinti. Non copiare esiti tra SHA differenti.
4. Produrre un unico APK candidato per il collaudo umano, senza installazioni intermedie o accesso a dati reali.

Nessuna modifica a main, firma stabile, distribuzione o archivio. Nessuna riduzione delle garanzie esistenti.
