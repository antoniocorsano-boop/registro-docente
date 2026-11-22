# Registro Docente — M1-B0: classificazione causale delle 12 invarianti STAB-06

**Data:** 20/11/2026. **Stato:** classificazione B0 completata a livello sorgente; verifiche dinamiche B1–B5 ancora da eseguire.  
**Main:** `8d3baab8e513100887c8b81d1dbf7408bebeec6f`.  
**STAB-06 #325 (congelato):** `6063fc0ff2809584c266b3161dafea9ffba92a8d`.  
**Contenitore:** PR #384, solo documentazione. **Governo:** #104/#326, R1 #323, R2 #307.  
**Piano di esecuzione:** [M1 — B0…B5](../plans/2026-11-20-m1-programma-esecutivo-riallineamento.md).

## 1. Risultato

Il registro `qualification/invariants.v1.json` è stato letto ai due commit esatti: `main` ha **149** invarianti, #325 ha **107**; **95** sono identiche, **12** non esistono nel registro di main e nessuna delle 95 comuni differisce nel contenuto.

**Categorie utilizzate:**
- **A — Protezione sorgente da ripristinare/verificare:** il codice e/o il collegamento candidato non risultano trasferiti; necessaria prima una prova RED del comportamento.
- **B — Meccanismo esistente, copertura incompleta:** implementazione pertinente presente (anche identica), ma manca il controllo storico completo o il collegamento al prodotto; equivalenza non certificata.
- **C — Prova specifica assente:** test/workflow originario assente e altre suite non costituiscono sostituzione dimostrata.
- **D — Da riconciliare senza retrocessione:** il componente nuovo presenta funzionalità V8/V9 che non devono essere rimpiazzate dal vecchio codice; serve prova comparativa.

Le classificazioni sono **basate sul confronto statico**, non sono PASS di sicurezza, né dimostrano da sole un difetto già sfruttato o una perdita.

| Invariante non presente nel registro di main | Classe | Riscontro concreto su sorgente/main | Decisione B0 e prossima prova |
|---|---|---|---|
| `VAL-01-STAB06-I01` | **A** | `protectedBootstrap.ts` e relativo test sono assenti; `SecureRegistroRoot.inspectBootstrap` chiama `getRuntime().store.getMetadata()` e `decideVaultBootstrap`. | **B1 prioritario:** RED su prima osservazione non scrivente, archivio stabilito sparito/parziale, tempo scaduto, richieste abbandonate. |
| `VAL-01-STAB06-I04` | **A+B** | `archivePreflight.ts` e `inspectArchiveVersion.ts` assenti; `existingSessionVaultStore.ts` presente **identico**. | **B1:** separare riconoscimento fisico, autenticazione e consenso; nessuna inizializzazione prima dell'ispezione. |
| `VAL-01-STAB06-I02` | **A+B** | `legacyMigration.ts` e `initialArchiveSetup.ts` divergono; sui percorsi ordinari di main mancano callback di autorizzazione passate dal Root presenti nel candidato. I primitivi `SecureVault` accettano callback, ma ciò non equivale al collegamento nel Root. | **B2:** revoca nelle attese, origine modificata, commit già avviato e ripartenza sicura. |
| `VAL-01-D1B3B-I01` | **B+C** | `authorizedVaultMigration.ts` e `versionFencedVaultStore.ts` presenti **identici**; `val01DatabaseFenceContract.test.ts` e browser storico non presenti su main. | **B2/B4:** verificare sul candidato copia v6, 10 record, consenso monouso e fence in IndexedDB reale. |
| `VAL-01-STAB06-I05` | **A+D** | `migrationRecoveryHandoff.ts` e `migrationSessionBoundary.ts` assenti; su main i proprietari V8/V9 eseguono sealAndDrain/retire, ma sono percorsi specializzati e non sostituiscono senza prova il contratto STAB-06. | **B3:** confronto su tutti i formati pertinenti, sessione, copia unica, blocco coda e revoca. |
| `VAL-01-STAB06-I06` | **D** | `db2Lifecycle.ts` e `db2PhysicalLifecycle.ts` divergono perché main include sviluppi successivi; `versionFencedVaultStore.ts` identico. | **B3:** mantenere V8/V9 di main; provare CAS/inventario/autorizzazione/nuovo accesso senza copiare il vecchio DB2. |
| `VAL-01-D1B-I05` | **B+C** | Fence di versione `versionFencedVaultStore.ts` identico, incluso abort su `onblocked` e upgrade tardivo; `tests/browser/val01-database-fence.spec.cjs` assente su main. | **B4:** provare davvero tre condizioni IDB e vecchio lettore/nuovo DB2 in Chromium; il test di sorgente non basta. |
| `VAL-01-D1B-I03` | **B+C** | Codec `assessmentBackupPayload.ts` e relativi test V7 esistono; manca il controllo storico `val01HistoricalBackupCompatibility.test.ts` e la suite browser `val01-historical-v7-compatibility.spec.cjs`. | **B4:** test con Beta1 RC2, RC3, Beta2 RC2 originali, rifiuto del nuovo formato e controllo positivo v6. |
| `VAL-01-D1B3C-I01` | **C** | Workflow `val01-native-migration.yml` assente su main; presenti nuove suite/documentazione di recupero native V8/V9, senza prova della medesima procedura di migrazione DB1 originaria. | **B5:** confronto su Android selettore file, copia recuperata, sessione e riavvio del processo. |
| `VAL-01-D1B3C-I02` | **C** | Workflow `val01-integral-android.yml` assente su main; il controllo storico di provenienza APK e caso RC2 sparse non risulta sostituito con prova equivalente. | **B5:** APK originali, origini, versionCode, caso RC2 sparse rifiutato, downgrade non distruttivo. |
| `VAL-01-STAB06-I03` | **C** | `val01-product-native.yml` e `val01Stab06InvariantEvidence.test.ts` assenti; altre prove native su main hanno perimetro specifico V8/V9. | **B5:** registrare fonte dei binari, SHA candidato, dispositivo/API; niente qualifica per trascinamento. |
| `VAL-01-STAB06-I07` | **B+C** | `scripts/diagnostics/native-process-probe.mjs` e `native-ui-driver.mjs` sono **identici**; i workflow STAB-06 storici non risultano presenti su main. | **B5:** preservare driver, ristabilire prove sulla fonte originale e distinguere laboratorio/produzione. |

## 2. Primo difetto di ammissione da verificare con RED

Su `main`, `src/components/SecureRegistroRoot.tsx` alla funzione `inspectBootstrap`:
1. costruisce il runtime con `new IndexedDbVaultStore(globalThis.indexedDB)`;
2. chiama `store.getMetadata()`;
3. calcola `decideVaultBootstrap(metadataState,hasLegacyData,...)`;
4. `decideVaultBootstrap` per metadati non `ACTIVE` e non `STAGING`, senza legacy, restituisce `SETUP_REQUIRED`.

Nel `src/security/vaultStore.ts` della stessa revisione, `openDatabase()` invoca `factory.open(DB_NAME, DB_VERSION)` e, in `onupgradeneeded`, può creare gli object store `metadata` e `records`. Questo significa che **l'ispezione iniziale non è invariabilmente in sola lettura** e che **la decisione non distingue, da sola, un'origine realmente nuova da un archivio già stabilito ma privo di metadata**.

Il candidato #325 usa, solo quando `archiveMigrationCandidate=true`, `createProtectedBootstrap` con `observeArchive`, un marcatore di archivio stabilito, letture limitate, revoche e riconoscimento di assenza/incompletezza. L'entrypoint ordinario `src/main.tsx` non attiva questo candidato.

**Decisione:** B1 deve produrre un RED genuinamente causale che eserciti l'avvio dell'applicazione, non semplicemente un test che fallisce per import mancante. Scenario minimo: origine sintetica fresca e archivio già stabilito ma parzialmente perduto; il codice non deve creare una nuova base né presentare nuova configurazione nei casi di perdita. L'osservazione va ripetuta contro ritardi/race e versioni incompatibili.

## 3. Piano di prove B1 pronto

| Caso | Allestimento isolato | Asserzione richiesta |
|---|---|---|
| B1-R1 | Origine Chrome con IndexedDB mai esistente | Osservazione in sola lettura senza scrivere o creare strutture; solo dopo consenso si crea un archivio |
| B1-R2 | Archivio DB1 sintetico precedentemente stabilito, poi store/metadati mancanti | Stato protetto, nessuna proposta di ricreazione e nessuna cancellazione dei residui |
| B1-R3 | Archivio DB1 con numero di record diverso da dieci | Errore di integrità, nessun ripristino implicitamente tentato |
| B1-R4 | `IDBFactory.open` bloccato o completato dopo timeout/revoca | Abbandono effettivo, nessun `onupgradeneeded` tardivo può creare dati |
| B1-R5 | Versione DB superiore a quella ammessa o transizione concorrente DB1→DB2 | Rifiuto sicuro, nessuna apertura di sessione incompatibile |
| B1-R6 | Annullamento/riprova del controllo | Solo risultato della generazione corrente, senza ammettere scritture della precedente |

**Criterio RED:** la prova su main deve fallire sulla condizione specifica attesa e non su errori di test, import, compilazione o ambiente. **Criterio GREEN:** stessa prova su ramo di lavoro da main, comportamento corretto e invarianti preesistenti intatte. Completare successivamente collaudo browser e revisione.

## 4. Passaggio di consegne unico

- M1-A — COMPLETATA e conservata.
- **M1-B0 — CLASSIFICAZIONE STATICA COMPLETATA**: 12/12 righe attribuite a classe e prova; nessuna equivalenza dinamica dichiarata.
- **M1-B1 — DA IMPLEMENTARE**: primi test causali B1-R1…R6; soltanto dopo RED avviare correzione minima.
- M1-B2…B5 — PROGRAMMATE, non eseguite.
- M1-C nuovo candidato unico — NON CREATO.
- R1/R2/R3 — NON SODDISFATTI; R2 resta soggetto al blocco autorizzativo.
- Web W1 — da verificare sulla versione realmente ospitata.
- NESSUN MERGE/DEPLOY/FIRMA/PUBBLICAZIONE/USO DI DATI REALI.

**Ripartenza:** aprire questo fascicolo e il piano M1; lavorare da **B1-R1**, senza riaprire la fase di analisi generale o creare nuovi filoni.
