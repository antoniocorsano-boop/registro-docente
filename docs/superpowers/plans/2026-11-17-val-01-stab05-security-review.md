# STAB-05/S — Riesame tecnico sicurezza e integrità
17 novembre 2026. Candidato e444abf5d69af1c217d0d06f35a8521bebf04c7f (#306). Analisi statica del codice e riscontro con STAB-05/E. Non costituisce revisione indipendente né nuovo collaudo eseguito. Nessuna modifica al codice, ai workflow o ai dati.

## Riscontri positivi
| ID | Ambito | Riscontro da sorgente |
| --- | --- | --- |
| S01 | Avvio protetto | protectedBootstrap.ts: sola lettura, apertura versione esatta, abort su upgrade, chiusura richieste tardive, limite di tentativi e rifiuto stati non verificabili. |
| S02 | Autorizzazione | SecureRegistroRoot.tsx: controllo generazione e foreground prima di pubblicare snapshot, revoca su lifecycle, protezione visiva durante sospensione e chiusura. |
| S03 | Copia locale | migrationRecoveryHandoff.ts e authorizedVaultMigration.ts: selezione locale, autorizzazione monouso, autenticazione copia e confronto completo, nessun grant persistente. |
| S04 | Migrazione | migrationSessionBoundary.ts: chiusura ammissione, attesa scritture, consenso e nuova autenticazione; esito incerto dopo invocazione non trattato come rollback. |
| S05 | Integrità DB2 | db2PhysicalLifecycle.ts, db2Lifecycle.ts, existingSessionVaultStore.ts: confronto fisico atomico, revoca, controllo generazione su operazioni DB2, verifica readback; copia precedente non riscritta dopo commit. |
| S06 | Cifratura | cryptoPrimitives.ts: AES-GCM 256, PBKDF2 SHA-256 con 600000 iterazioni, associazione autenticata chiave record/schema. |
| S07 | Isolamento rilascio | src/main.tsx non abilita archiveMigrationCandidate; candidato ancora di laboratorio. |

Riscontri statici, non PASS di sicurezza complessivo. Le prove storiche e attuali sono distinte nel dossier STAB-05/E.

## Rilievi e verifiche aperte
- S-R01 (alta priorità, pre-attivazione): atomicità della configurazione DB1 tra istanze. secureVault.ts createStaging e vaultStore.ts mostrano lettura di ammissione e successiva scrittura separate. Limite già dichiarato in #303; non c'è evidenza di incidente su dati reali. Richiesto requisito di esclusività durevole della configurazione, verifica concorrente con archivi esclusivamente sintetici e prova di non sovrascrittura. Non confondere con la protezione atomica DB2.
- S-R02 (alta priorità): revoca durante operazioni legacy già ammesse e conclusione in stato protetto. La verifica foreground precedente all'ammissione e successiva alla lettura non attesta annullamento atomico di una migrazione legacy in corso. Verificare esito durevole, protezione UI, conservazione dei dati sorgente fino alla verifica e riapertura; non promettere rollback dopo commit.
- S-R03 (alta priorità): interoperabilità del recupero. authorizedVaultMigration.ts e db2Lifecycle.ts accettano volutamente envelope v2/payload completo v6; assessmentBackupPayload.ts contempla anche v7. Qualificare una copia realmente esportata dall'app e definire una politica esplicita per formati non supportati, senza conversioni o ripristini impliciti. Non è accertato che la normale esportazione sia incompatibile.
- S-R04 (media, limite dichiarato): il marker positivo locale non prova inesistenza storica in caso di rimozione completa dello storage. Documentare prerequisiti di backup verificato e recupero; non dichiarare garanzia contro tutti i guasti hardware.
- S-R05 (alta, gate): regressioni generali e tre casi nativi mancanti sul candidato; revisione indipendente e specifica sicurezza non acquisite. Conservare blocco di attivazione. Issue #307 aperta.

## Decisione
Priorità di consolidamento: S-R01, specifica di esclusività della prima configurazione e prova di conservazione concorrente; in parallelo definire il contratto S-R03 di esportazione/ripristino reale. Prima di qualsiasi modifica, fissare criteri di accettazione e perimetro; nessuna attestazione di chiusura senza esecuzione. Nessuna integrazione o pubblicazione autorizzata. La causa originaria dell'errore di avvio non è provata.