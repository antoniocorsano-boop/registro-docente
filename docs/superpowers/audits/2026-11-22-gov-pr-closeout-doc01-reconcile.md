# GOV-PR-CLOSEOUT-01 — Riconciliazione DOC-01 #371 / #376 sulla #378

Data: 22 novembre 2026. Origine: issue #404, PR #371, #376 e candidata #378.

## Commit e separazione delle responsabilità
- Base intoccata PR #378: `7fc45ccb0f01276612fb9b34608ad28a35020388`, 143 invarianti, 11 controlli GitHub completati con successo.
- PR #371: `02445105a81b9ee17d05b68932fa1e0d95bdb056`, laboratorio AES-GCM con interfaccia CAS atomica di generazione, ma nella propria qualificazione originaria aveva due flussi non superati (qualificazioni riferimento e Android). Non sostituire la persistenza DOC-01 della #378.
- PR #376: `ad113f793eebf26da8b31e9cb90a1e74be03d043`, percorso nativo Android SAF V8 di laboratorio; un flusso Android non risultava superato sul proprio SHA.
- Questa PR di riconciliazione è una **candidatura di archivio sperimentale**, non un rilascio e non un nuovo percorso ufficiale di scrittura.

## #371 — Che cosa non era presente
La #378 utilizza `src/persistence/documentHistoryCommit.ts` con il coordinatore canonico, `saveAppDataAndMeta` e rilettura; il differente modello CAS di #371 non era presente nel proprio albero. Non dichiararlo equivalente né assorbito.

Si conservano i tre file originali con i rispettivi blob Git immutati:
- `src/persistence/documentHistoryEncryptedCommit.ts`: porta `DocumentHistoryAtomicStorage` in memoria, generazione attesa, AES-GCM con AAD, rilettura della generazione e dell'archivio;
- `src/security/doc01D4c3Fixture.ts`: documenti puramente sintetici;
- `src/security/doc01EncryptedDocumentHistoryCommit.test.ts`: dieci prove di commit, retry, revoca, CAS fallito, manomissione, esito incerto, sessione e non attivazione.

**Conflitto di numerazione risolto senza sovrascrittura:** #378 già contiene `DOC-01-D4C3A-I01` con una dichiarazione diversa. La prova alternativa si registra con il nuovo e distinto `DOC-01-D4C3A-CAS-LAB-I01`, per un totale atteso di 144 invarianti. Nessun percorso produttivo importa `commitEncryptedDocumentHistory`. Il deposito effettivamente atomico non esiste ancora: la dichiarazione di interfaccia non ne prova l'implementazione fisica e non impedisce rollback dell'intero archivio.

## #376 — Riconciliazione delle prove native
Il percorso iniziale della #376 è stato sostituito nella #378 dalla convenzione di nome file effettivamente accettata dal componente Android `Backup_Cifrato_GDPR_...`, non dal precedente `Backup_DOC01_V8_...`. I nomi delle funzioni di preparazione e delle fasi sono cambiati; ripristinare i controlli testuali originali creerebbe falsi errori.

La #378 contiene un controllo specifico `src/security/doc01NativeV8RecoveryBoundary.test.ts` (4 casi anziché 5), ma controlla:
- selezione nativa SAF, due copie cifrate con nome compatibile e digest dei byte effettivamente letti;
- autorizzazione monouso, rifiuto del riutilizzo e cancellazione;
- catena completa di eventi, conservazione delle valutazioni e riapertura a freddo;
- esecuzione workflow su emulatori API 32 e API 36, 18 fasi di laboratorio e 5 arresti forzati.
Il controllo full sulla #378 risultava 11/11 PASS. Non sono stati ripristinati asserzioni testuali obsolete o codice Android sorgente #376: per chiudere la PR storica occorre riferirsi al suo successore qualificato, mantenendo accessibile la prova causale.

## Divieti e condizioni
Nessuna modifica a `main`, `SecureAppStorage`, `VaultRecordKey`, `AppData`, schema DB2, backup V6–V9, motore Android o applicazione pubblica. I test hanno dati demo; non inserire dati scolastici reali. Nessun merge, rilascio, scrittura in archivi professionali o attivazione. Verificare il nuovo exact SHA (compilazione, test, suite sicurezza e regressione, browser e Android); revisione indipendente prima di promuovere la candidatura. L'eventuale collegamento CAS reale è una fase separata con migrazione autorizzata.

Tracciabilità: https://github.com/antoniocorsano-boop/registro-docente/issues/404

## Qualificazione isolata della PR di riconciliazione

La PR #405 è stata indirizzata temporaneamente a `main` **esclusivamente** per attivare i controlli GitHub che ascoltano `pull_request` su `main`. Questo non equivale a un'integrazione, promozione o scelta del ramo di destinazione definitiva. Nessun altro ramo verrà unito e `main` non sarà modificata. Dopo il deposito dei risultati sul candidato esatto, la base della PR tornerà a `lab/doc01-d4c3e1-controlled-recovery-review`. La qualifica ottenuta contro `main` non sostituisce un'ulteriore verifica della futura convergenza.
