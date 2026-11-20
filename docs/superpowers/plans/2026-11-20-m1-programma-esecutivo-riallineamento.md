# Registro Docente — M1: programma esecutivo di riconciliazione e riallineamento

**Data:** 20 novembre 2026  
**Stato:** PROGRAMMA CONSOLIDATO / ESECUZIONE TECNICA NON AVVIATA / RILASCIO NO-GO.  
**Fonte di governo:** issue #104. **Documento contenitore:** PR #384 (bozza e solo documentazione).  
**Base codice principale:** main a 8d3baab8e513100887c8b81d1dbf7408bebeec6f.  
**Riferimento congelato:** PR #325 a 6063fc0ff2809584c266b3161dafea9ffba92a8d.  
**Evidenza primaria:** ../audits/2026-11-20-m1-main-stab06-riconciliazione.md  
**Vincoli:** #323 (R1 revisione indipendente), #307 (R2 percorso S-R04b sospeso), #326 (R3 pacchetto finale, decisione umana).  
**Obiettivo:** un'applicazione realmente affidabile e utilizzabile su Web e Android; funzioni professionali e TRAMA solo dopo la stabilizzazione.

## 1. Regole di governo

1. Non ricominciare: conservare le funzioni DOC-01 V8/V9 introdotte su main e le protezioni già equivalenti; non integrare in blocco la PR #325.
2. Una sola filiera di codice applicativo, con un nuovo candidato esatto nato da main dopo la ricognizione. La PR #384 rimane **esclusivamente documentale**. Niente serie di laboratori disconnessi.
3. Ogni differenza va classificata come EQUIVALENTE DIMOSTRATA, DA REINTEGRARE, NON APPLICABILE MOTIVATA oppure NON QUALIFICATA/BLOCCATA. Non trasformare la mancanza di un file nella certezza della mancanza di una protezione.
4. Per DA REINTEGRARE: contratto e test RED **causale**, correzione minima GREEN con identico scenario e regressione. Ogni risultato è vincolato a SHA esatto e natura della prova.
5. Usare esclusivamente archivi sintetici; nessun merge in main, firma, pubblicazione, installazione personale o attivazione V9 mentre R1/R2/R3 non sono risolti. Non modificare la procedura sospesa S-R04b per aggirare i controlli.
6. I test automatici, il browser, l'emulatore, la revisione Codex e l'accettazione del docente costituiscono evidenze differenti e non sostituibili.

## 2. Situazione di partenza e conservazione

- Registro invarianti: 149 in main, 107 in #325, **95 identiche**, **12 assenti** dal registro di main, nessuna delle 95 modificata.
- Quattro file letteralmente identici: src/security/secureVault.ts; src/security/authorizedVaultMigration.ts; src/security/versionFencedVaultStore.ts; src/security/existingSessionVaultStore.ts. **Non riscriverli senza motivo causale.**
- Punti da confrontare con attenzione: src/components/SecureRegistroRoot.tsx, src/security/protectedBootstrap.ts, archivePreflight.ts, inspectArchiveVersion.ts, legacyMigration.ts, initialArchiveSetup.ts, migrationRecoveryHandoff.ts, migrationSessionBoundary.ts, db2Lifecycle.ts, db2PhysicalLifecycle.ts, test browser storici e workflow Android.
- L'entrypoint src/main.tsx coincide sui rami; il parametro sperimentale archiveMigrationCandidate della PR #325 non è attivato nell'ingresso ordinario. La qualifica laboratorio non prova l'operatività della funzione.
- I recuperi documentali V8/V9 presenti su main rimangono isolati per i dati professionali; non sostituirli con implementazioni meno recenti.
- Android di riferimento, secondo issue #104: Beta2 RC2, appId it.trama.registrodocente, versionCode 10004. Non aggiornare il telefono durante questa preparazione.
- Il sito https://registro-docente.ai.studio ha evidenza di verifica storica del 24/10/2026. URL e codice live **attuali** devono essere attestati separatamente.

## 3. Registro delle 12 invarianti mancanti dal registro corrente

| ID | Priorità/pacchetto | Obbligo di sicurezza | Prima verifica |
|---|---|---|---|
| VAL-01-STAB06-I01 | P0 / B1 | Avvio classificato e limitato; archivio stabilito assente/parziale non viene reinizializzato | protectedBootstrap e SecureRegistroRoot, scenario S01-S03 |
| VAL-01-STAB06-I04 | P0 / B1 | Preflight fisico DB1 in sola lettura; versione e consenso distinti | archivePreflight e inspectArchiveVersion, S02-S03 |
| VAL-01-STAB06-I02 | P0 / B2 | Autorizzazione legacy revocabile, confronto origine e commit già avviato | legacyMigration, initialArchiveSetup, S04 |
| VAL-01-D1B3B-I01 | P0 / B2 | Migrazione DB1 con 10 record autenticati, backup v6 corrispondente e consenso una tantum | authorizedVaultMigration, S05-S06 |
| VAL-01-STAB06-I05 | P0 / B3 | Copia cifrata legata alla sessione, sigillo scritture, annullamento, nuovo accesso | migrationRecoveryHandoff e migrationSessionBoundary, S06-S08 |
| VAL-01-STAB06-I06 | P0 / B3 | Proprietario DB2, inventario fisico, sostituzione atomica e riapertura sicura | db2Lifecycle e db2PhysicalLifecycle, S07-S08 |
| VAL-01-D1B-I05 | P1 / B4 | Barriera DB1→DB2 e richieste abbandonate in browser reale | val01-database-fence.spec.cjs, S03/S09 |
| VAL-01-D1B-I03 | P1 / B4 | Compatibilità storica v6/v7: predecessori esatti, rifiuti e integrità | val01-historical-v7-compatibility.spec.cjs, S09-S10 |
| VAL-01-D1B3C-I01 | P1 / B5 | Migrazione Android di laboratorio e copia fisica verificata | val01-native-migration.yml, S12 |
| VAL-01-D1B3C-I02 | P1 / B5 | APK storici originali, RC2 sparso rifiutato e downgrade protetto | val01-integral-android.yml, S09-S12 |
| VAL-01-STAB06-I03 | P1 / B5 | Prove native del prodotto vincolate all'esatto sorgente | val01-product-native.yml, S12 |
| VAL-01-STAB06-I07 | P1 / B5 | Provenienza driver/APK/API, senza equivalenza con il pacchetto definitivo | val01-stab03-driver.yml, val01-stab04-native-smoke.yml, S12 |

Le 12 righe sono **DA DECIDERE**. Il risultato desiderato non è aggiungere 12 righe descrittive, ma avere per ciascuna una prova operativa, un esito motivato e una copertura conservata nel nuovo candidato.

## 4. Catena dei lavori, una dipendenza alla volta

| Ordine | Codice | Intervento | Criterio di uscita |
|---|---|---|---|
| 0 | M1-B0 | Registrare i 12 confronti sul codice attuale, prove originarie, equivalenze e carenze | Schede compilate con decisione, prove da eseguire e rischio per tutti i 12 ID |
| 1 | M1-B1 | Avvio sicuro e riconoscimento di assenza, incompletezza, blocco, errore di versione; prima RED causale, poi eventuale GREEN | Nessuna creazione indebita o sovrascrittura di un archivio già esistente |
| 2 | M1-B2 | Preparazione iniziale e migrazione legacy, sessione revocabile, password, copia v6 e commit | Nessuna doppia attivazione o perdita dei dati in caso di revoca/interruzione |
| 3 | M1-B3 | Proprietario DB2 e recuperi V6/V7/V8/V9, coda di scritture, sostituzione atomica e nuova autenticazione | Recupero verificabile senza regressione del codice DOC-01 nuovo |
| 4 | M1-B4 | Browser reale e sorgenti storiche esatte, IndexedDB/version fence, downgrade, compatibilità backup | Matrice storica PASS per tutti i casi pertinenti sul candidato |
| 5 | M1-B5 | Android API 32/36, provenienza APK/fixture, riavvio, SAF, confronto inventario | Rapporto nativo sullo SHA esatto; le prove sospese rimangono non dichiarate PASS |
| 6 | M1-C | Produrre **un solo candidato** da main con i soli interventi dimostrati necessari, recuperare e documentare le invarianti | Qualifica regressiva, 149 invarianti nuove conservate + 12 risolte con prove, build e controlli coerenti |
| 7 | M1-D | R1 revisione indipendente, R2 solo dopo sblocco autorizzato, R3 qualificazione pacchetto/aggiornamento e accettazione docente | GO soltanto con tutti i gate obbligatori effettivamente soddisfatti |
| Parallelo | W1 | Versione Web effettivamente ospitata, HTTPS, risorse distribuite, percorso J3 con dati sintetici e reload | Rapporto Web indipendente dal codice main, senza deploy implicito |

B0-B5 sono **pacchetti di lavoro dello stesso programma**, non cinque nuove iniziative autonome. Un unico ramo tecnico nascerà da main dopo la classificazione e resterà in bozza fino all'uscita positiva. La creazione di tale ramo non è parte della presente operazione documentale.

## 5. Quattordici scenari da predisporre prima di intervenire sui sorgenti

| Prova | Stimolo sintetico | Esito obbligatorio |
|---|---|---|
| S01 | Prima installazione senza archivio | Nessuna scrittura durante l'ispezione, creazione solo esplicita |
| S02 | Archivio precedentemente stabilito ma scomparso/incompleto | Rifiuto protetto e residui preservati |
| S03 | IndexedDB bloccato, timeout, richiesta tardiva o versione mutata | Operazione abbandonata non può creare o aggiornare più tardi |
| S04 | Cambio sessione, annullamento, sospensione durante setup/migrazione | Revoca effettiva e fonte preservata; riapertura dopo possibile commit |
| S05 | Copia v6 valida e inventario di 10 record coerente | Consenso monouso, autentica e confronto prima di modificare |
| S06 | Password errata, copia obsoleta/corrotta o origine cambiata | Rifiuto senza sovrascrittura o falso esito positivo |
| S07 | Scritture concorrenti durante il recupero | Coda sigillata, nessun duplicato o scrittura perduta |
| S08 | Arresto prima e dopo commit | Nessun rollback presunto; rilettura fisica e nuova autenticazione |
| S09 | Lettore storico/downgrade | Rifiuto delle versioni non supportate e contenuti invariati |
| S10 | Beta1 RC2 sparso e predecessori completi | Sparso rifiutato; completezza delle altre versioni dimostrata |
| S11 | Documenti V8/V9 | Nessuna migrazione tacita storico dimostrativo V1→istituzionale V2 |
| S12 | Android API 32/36, SAF e arresto processo | File letto fisicamente, nuova sessione e inventario identico |
| S13 | Percorso docente J3: voto/osservazione/cambio vista | Conferma dopo scrittura durevole, bozza conservata e niente doppi invii |
| S14 | Versione Web ospitata | Provenienza/asset HTTPS identificati e prova con dati sintetici |

Una verifica RED è valida soltanto se fallisce per il comportamento specificato; un errore di avvio, strumenti o dipendenze non è evidenza causale. Ogni GREEN deve rieseguire il medesimo caso e la regressione associata.

## 6. Scheda di qualificazione per singola invariante

Campi obbligatori: **ID; gruppo; main SHA; #325 SHA; contratto originale; confronto codice; esito (equivalente, reintegrare, non applicabile motivato, bloccato); test RED e causa; modifica e commit; test GREEN; regressione; browser/nativo; revisore; rischio residuo; decisione GO/NO-GO**.

Non cancellare le 149 invarianti attuali per ottenere un conteggio favorevole e non aggiungere le 12 mancanti come mere dichiarazioni senza prova. Non sommare suite di epoche diverse come se costituissero una certificazione cumulativa.

## 7. Tre condizioni di rilascio e un accertamento parallelo

- **R1 — #323:** revisione specialistica **indipendente** sul nuovo SHA, con evidenze verificabili, perimetro Web/Android, rilievi e firma attribuibile. Codex/CI non la sostituiscono. Il revisore non risulta ancora designato.
- **R2 — #307:** recupero Android S-R04b sospeso per il controllo autorizzativo del servizio; riprendere soltanto dopo risoluzione attraverso il canale ufficiale, senza aggiramenti. Include installazione pulita, copia cifrata reale, Android 12/16, interruzioni, revoche e nuova autenticazione.
- **R3 — #326:** soltanto dopo R1/R2, identità it.trama.registrodocente, versionCode maggiore di 10004, firma locale originale, aggiornamento in-place, compatibilità, verifica dati e approvazione esplicita; niente segreti in CI.
- **W1:** il verbale storico del 24/10/2026 prova una pubblicazione Web passata, non lo SHA oggi distribuito. Verificare il sito attuale e il percorso J3 senza confonderlo con il prodotto in main.

## 8. Registro di stato persistente

| Checkpoint | Stato al 20 novembre | Prossimo fatto da registrare |
|---|---|---|
| M1-A Ricognizione | COMPLETATO | Dossier differenziale già depositato |
| M1-B0 Classificazione 12 ID | DA ESEGUIRE | Decisione/evidenza per ciascuna riga |
| M1-B1 Avvio protetto | DA ESEGUIRE PER PRIMO | RED causale S01-S03 |
| M1-B2 Setup e migrazione legacy | DA ESEGUIRE | RED/GREEN S04-S06 |
| M1-B3 DB2 e copie | DA ESEGUIRE | RED/GREEN S07-S08, S11 |
| M1-B4 Compatibilità browser | DA ESEGUIRE | Chromium e predecessori S03, S09-S10 |
| M1-B5 Android | DA ESEGUIRE | Evidenze native S12; R2 resta sospesa |
| M1-C Nuovo candidato | NON CREATO | SHA esatto, test e invarianti |
| M1-D Revisione e rilascio | HOLD | R1, R2, R3 e accettazione del docente |
| W1 Accertamento Web | APERTO | URL/asset/versione reale, J3 sintetico |
| M2–M6 Evoluzione prodotto | NON AUTORIZZATE COME RILASCIO | Dopo M1 e verifiche delle piattaforme |

**Decisione guida:** prima ottenere sicurezza e continuità dei dati, poi due versioni veramente funzionanti, quindi semplicità della lezione, valutazione e documentazione, infine integrazioni TRAMA.

**Ripresa univoca del lavoro:** aprire questo file; verificare main e #384; iniziare da **M1-B0**, non dalla creazione di nuove funzionalità. Aggiornare qui il registro di stato dopo ogni risultato verificato e mantenere immutato il dossier storico M1-A.


## 9. Istruzioni pratiche per la ripresa M1-B0 e B1

**Punto di partenza fisso:** in un ambiente effimero e isolato, usare la revisione esatta di main indicata nella sezione A. Non aprire il browser con un profilo o un archivio personale; usare esclusivamente fixture sintetiche. La copia della PR #325 serve come riferimento in sola lettura. Se main è cambiato, fermare la preparazione e rigenerare il confronto prima di assumere invarianti conservate.

**Comandi già definiti dal package.json di main** (da eseguire nel clone locale, non eseguiti in questa fase documentale):
- bun install --frozen-lockfile
- bun run lint
- bun run test:security
- bun run build

**Sequenza di qualificazione in laboratorio:**
1. **B0 / acquisizione:** verificare lo SHA di main, lo SHA di #325, il conteggio e il contenuto delle invarianti; enumerare per ciascuno dei 12 ID il test e l'implementazione originari e il possibile equivalente su main. Scrivere una riga di decisione con evidenza tecnica; non segnare PASS in assenza di prova causale.
2. **B1 / RED di avvio:** utilizzare come base i contratti di src/security/protectedBootstrap.test.ts su #325, confrontandoli con il ramo principale. Preparare sul nuovo ramo test per S01-S03 e verificare che i fallimenti siano riferibili a un comportamento insicuro, non alla semplice assenza del modulo originale o a errori di importazione.
3. **B1 / GREEN minimo:** introdurre solo il controllo mancante, senza cancellare archivi, cambiare formato, modificare la firma o attivare V9; rieseguire gli stessi test RED, la suite sicurezza e il controllo di compilazione.
4. **B1 / prova browser:** eseguire nel browser reale la sequenza avvio-errore-ripresa con archivio completamente sintetico. Confrontare il contenuto fisico prima e dopo la prova; il mancato completamento lascia B1 in NO-GO.
5. **Proseguimento:** attivare B2 solo con B1 qualificato, mantenendo separati esiti su codice, browser, emulatore Android e telefono personale.

**Semaforo di arresto:** qualsiasi indicazione di cancellazione o sovrascrittura non autorizzata, dubbio sulla provenienza della copia, password/firma reale necessaria, compatibilità non dimostrata o procedura S-R04b ancora bloccata ferma la promozione. Una prova fallita non va trasformata in successo cambiando il requisito o eliminando il test.

**Regola conclusiva:** la registrazione documentale della PR #384 non è una PR di implementazione, non soddisfa R1/R2/R3 e non modifica il prodotto installato. La prossima azione tecnica non è un altro studio generale: è la classificazione misurata B0, seguita dai casi RED mirati B1.
