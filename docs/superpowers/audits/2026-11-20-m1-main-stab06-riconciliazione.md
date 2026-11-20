# M1 — Riconciliazione di sicurezza `main` ↔ STAB-06 #325

**Data:** 20 novembre 2026  
**Stato:** ricognizione tecnica documentale; **NO-GO per integrazione e rilascio**.  
**Repository:** `antoniocorsano-boop/registro-docente`  
**Riferimenti immutabili:**
- `main@8d3baab8e513100887c8b81d1dbf7408bebeec6f` (DOC-01 V8/V9 integrato in laboratorio).
- PR #325 `6063fc0ff2809584c266b3161dafea9ffba92a8d`, aperta/Draft, non integrata.
- Antenato comune `5ed2eb11d1b740dc79acbee1ffe18da3f3d2a7e8`.
- Piano operativo PR #384; governance #104, #326, #323, #307.
- Per #325, i controlli storici sono riferiti **solo** al suo SHA; le evidenze di #383 e le 149 invarianti sono riferite al diverso nuovo `main`.

## Esito sintetico della comparazione

I due rami sono **divergenti**; non eseguire merge/cherry-pick cumulativi. Il commit principale è uno squash successivo, non una successione lineare di tutte le modifiche della PR #325.

La comparazione diretta di `qualification/invariants.v1.json` ha rilevato:

| Misura | Riscontro |
|---|---|
| Invarianti su `main` | **149** |
| Invarianti su #325 | **107** |
| Invarianti #325 presenti **identiche** in `main` | **95/107** |
| Invarianti #325 assenti in `main` | **12** |
| Invarianti #325 presenti ma con definizione modificata | **0** |

**Non dedurre da questa tabella né una perdita già avvenuta né l'equivalenza delle 12 garanzie.** L'assenza è comprovata nel registro delle invarianti; l'eventuale equivalenza implementativa deve essere dimostrata con codice e prove specifiche.

**Dodici ID non conservati:** `VAL-01-D1B-I03`, `VAL-01-D1B-I05`, `VAL-01-D1B3B-I01`, `VAL-01-D1B3C-I01`, `VAL-01-D1B3C-I02` e **tutte le sette** `VAL-01-STAB06-I01` … `I07`.

## Matrice dei confini di sicurezza

| Confine | Evidenza su #325 | Evidenza su main corrente | Classificazione | Azione minima obbligatoria |
|---|---|---|---|---|
| Avvio protetto e archivio già esistente | `protectedBootstrap.ts`, `protectedBootstrap.test.ts`; `SecureRegistroRoot` con osservazione limitata, annullamento, stato stabilito e protezione per archivio scomparso/parziale (STAB06-I01) | `protectedBootstrap.ts` e test **non presenti**; `SecureRegistroRoot` usa il precedente `getMetadata`/ `decideVaultBootstrap` | **Garanzia candidata non trasferita** | Portare il criterio *fail closed* nel nucleo comune con prova causale: assenza genuina ≠ archivio stabilito perduto, nessuna nuova configurazione implicita |
| Pre-verifica fisica DB1, versioni e ammissione | `archivePreflight.ts`, `inspectArchiveVersion.ts` presenti; `ArchiveMigrationPanel.tsx` (STAB06-I04) | Tutti e tre **non presenti**; `existingSessionVaultStore.ts` invariato | **Percorso candidato incompleto in main** | Conservare l'ispezione in sola lettura, rifiuto di versioni incompatibili e separazione fra classificazione, autenticazione e consenso |
| Migrazione legacy e configurazione iniziale | `legacyMigration.ts`, `initialArchiveSetup.ts` con callback di autorizzazione, origine riconvalidata e gestione della revoca (STAB06-I02) | Entrambi **divergenti** e privi dei punti di autorizzazione aggiuntivi del candidato | **Differenza sostanziale** | RED causale su revoca/interruzione prima e dopo ACTIVE, origine mutata, nessuna cancellazione/rollback presunto; poi correzione minima |
| Passaggio della copia di recupero e proprietà della sessione | `migrationRecoveryHandoff.ts`, `migrationSessionBoundary.ts`, test dedicati (STAB06-I05) | Moduli **non presenti**; presenti recuperi DB2 più nuovi e specializzati per V8/V9 | **Equivalenza non dimostrata** | Esaminare i confini V6/V7/V8/V9 separatamente; consenso monouso, sigillo/svuotamento coda, invalidazione per cambio sessione e riapertura verificata |
| DB2: migrazione, integrità, riapertura | `db2Lifecycle.ts`, `db2PhysicalLifecycle.ts`, `versionFencedVaultStore.ts` (STAB06-I06) | I primi due **divergenti**; `versionFencedVaultStore.ts` identico; su main V8/V9 aggiungono ulteriori casi | **Convergenza selettiva necessaria** | Non sostituire il nuovo DB2; aggiungere solo garanzie mancanti sul proprietario effettivo dopo confronto dei casi di prova |
| Compatibilità con archivi storici | Browser `val01-historical-v7-compatibility.spec.cjs` e `val01-database-fence.spec.cjs` (D1B-I03/I05, D1B3B-I01) | Entrambi i file di prova **non presenti** su main; parte del codice di fence rimane | **Qualificazione cumulativa incompleta** | Rieseguire l'interoperabilità sui sorgenti storici esatti e sul nuovo candidato, senza dedurre esito da run #325 |
| Qualificazione Android nativa | `val01-product-native.yml`, `val01-integral-android.yml`, `val01Stab06InvariantEvidence.test.ts`; driver e APK di laboratorio (D1B3C-I01/I02, STAB06-I03/I07) | Workflow e test elencati **non presenti** nel main corrente; altre prove native recenti V8/V9 esistono | **Perimetri non intercambiabili** | Matrice nativa finale sul nuovo exact SHA e APK pertinente; sorgenti/artefatti originali, API 32/36, installazione pulita, downgrade, riavvio; S-R04b solo dopo sblocco autorizzato |
| Cifratura, autorizzazione migrazione e protezione di versione | `secureVault.ts`, `authorizedVaultMigration.ts`, `versionFencedVaultStore.ts`, `existingSessionVaultStore.ts` | **Contenuti identici** per i quattro file esaminati | **Conservazione letterale verificata** | Preservare; qualificare nell'integrazione complessiva senza riscrivere |
| Recupero documentale istituzionale | #325 precede la serie DOC-01 V8/V9 | `db2Lifecycle.ts` e codec V8/V9 più evoluti, 149 invarianti totali | **Funzioni nuove da conservare isolate** | Non retrocedere, non attivare V9 nel prodotto ordinario e non trasferire prove di laboratorio a rilascio |

**Punto d'ingresso:** `src/main.tsx` è identico sui due rami e monta `SecureRegistroRoot` senza attivare il parametro `archiveMigrationCandidate` della PR #325. Questo dimostra che la qualificazione del percorso candidato non equivale alla sua attivazione nel Registro distribuito.

## Rischi di regressione da verificare con prove causali

1. **Perdita/scomparsa parziale:** un archivio professionale già stabilito non deve essere scambiato per un nuovo dispositivo vuoto e reinizializzato, anche dopo ritardi, blocchi IndexedDB, perdita parziale e modifica versione.
2. **Revoca nel tempo:** cambio vista, blocco/sospensione, annullamento, interruzione e origine modificata devono invalidare l'autorizzazione, anche nelle operazioni asincrone.
3. **Commit già avviato:** nessuna dichiarazione di ripristino annullato o esito positivo prima della rilettura fisica e della nuova autenticazione.
4. **Compatibilità storica:** v6/v7/v8/v9 rispettano il rifiuto di downgrade, la completezza dei dieci record e il divieto di migrazione implicita dello storico istituzionale V1→V2.
5. **Esclusività e provenienza Android:** verificare il vero APK finale, non un bundle dimostrativo, con identità stabile e `versionCode` crescente rispetto a 10004, esclusivamente dopo R1/R2.

## Gate da preservare

- **R1 — #323:** revisore specialistico indipendente non ancora individuato; la revisione Codex e i PASS CI non lo sostituiscono. Mandato da aggiornare all'exact SHA del futuro candidato.
- **R2 — #307:** test nativo S-R04b sospeso da controllo del servizio; nessun aggiramento o modifica indiretta del workflow. Riprendere solo per via autorizzata, con file cifrati sintetici e recupero su installazione pulita.
- **R3 — #326:** pacchetto finale, stessa identità e firma, incremento versione, aggiornamento in-place, prova del ripristino e decisione umana separata.
- **Web W1:** l'indirizzo storico `https://registro-docente.ai.studio/` non è stato verificabile con lo strumento di consultazione esterno. Non è stata identificata con evidenza indipendente una versione distribuita corrispondente a `main`; nessuna pubblicazione presunta. Occorrono origine effettiva, identificativo del rilascio e prova browser sulla versione realmente ospitata.
- **Dati:** esclusivamente sintetici. Nessun merge, deploy, firma, copia o modifica di archivi professionali.

## Ordine vincolante di esecuzione

**M1-A (questa ricognizione):** fissare il confronto esatto e il rischio; archiviare la matrice e mantenere #325 congelata.  
**M1-B:** definire casi RED per i 12 ID non conservati, distinguere equivalente/protezione da reintegrare/non applicabile motivato. In particolare precedenza ai sette STAB-06.  
**M1-C:** introdurre su **un solo ramo nuovo da main** correzioni minime senza sostituire DB2 V8/V9 né attivare servizi sperimentali; qualifica per ogni exact SHA.  
**M1-D:** validare prima nel browser e poi nella matrice Android nativa del candidato, conservando i gate R1/R2/R3.  
**W1 parallelo:** accertare URL di produzione, versione distribuita, HTTPS e percorso J3 sintetico in lettura/scrittura locale; non confondere accessibilità del sito con sicurezza dell'archivio.

### Decisione

**Ricognizione M1-A completata; M1 e rilascio ancora NO-GO.**  
Non riunire indiscriminatamente i due rami; non ripristinare soltanto gli ID nel registro per simulare una qualifica; non promuovere un pacchetto o un archivio ai dati reali finché prove causali, revisione indipendente e collaudi nativi restano incompleti.
