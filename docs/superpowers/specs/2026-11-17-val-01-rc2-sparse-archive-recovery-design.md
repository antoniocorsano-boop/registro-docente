# VAL-01 / D1b.3c-I03 — Compatibilità protetta degli archivi storici parziali
**Stato: SOSPESO / archiviato come analisi di riserva.** Decisione del titolare del progetto del 17 novembre 2026: nessuna distribuzione a utenti reali; Beta 1 RC2 non è più un predecessore da migrare direttamente. Non implementare I03a–I03d nella sequenza corrente. Il caso sparso resta una prova negativa obbligatoria, non un successo di migrazione. Nessuna autorizzazione a migrazione produttiva, merge, rilascio o operazioni su dispositivi reali. Baseline di evidenza: `37f5809f36a45f2526ae47b2a6a61b08abf3fbe5`.

## 1. Evidenza causale e confini
- Run integrale 44029635272, job 133858171742, APK originale Beta 1 RC2, source `37c61d4c64993c986a3edcd2b421310adf20de92`, versionCode 10002: DB1 ACTIVE, autenticazione accettata, presenti e autenticati appData e meta, nessun errore di autenticazione dei record, marker sintetico persistente prima/dopo riavvio. Assenti settings, udas, customTests, submissions, planning, library, professionalMemory, copilotState. Rifiuto del gate a dieci record intenzionale. Non prova che ogni archivio parziale sia legittimo.
- RC3 e Beta2 RC2: 9/9 integrali ciascuno sullo stesso candidato; risultati conservati. RC2: 1/9; inventario separato riuscito. Il gate integrale resta FAIL. Laboratorio RC3 sul medesimo SHA non completato per risoluzione dipendenze Gradle (job 133858171980); non è una prova di regressione della migrazione. Nessun esito trasferito automaticamente a futuri SHA.
- La metadata V1 autentica la chiave, non l'insieme atteso dei record e non certifica il predecessore esatto. Il versionCode del pacchetto corrente, la data di creazione, la forma sparsa, la password corretta e un backup prodotto dopo l'assenza non provano da soli che non vi sia stata una cancellazione. Non è possibile dimostrare retroattivamente l'assenza legittima di ogni record senza evidenze indipendenti.
- Il percorso completo resta quello qualificato in D1b.3a/b: esattamente dieci record fisici, autenticazione integrale, copia v6 coerente, consenso monouso, confronto atomico, fence DB2. Nessuna modifica a validRecords, authorizedVaultMigration o versione DB in questa fase.

## 2. Semantica esatta del predecessore
Fonti: RC2 exact SHA, src/components/SecureRegistroRoot.tsx (handleSetup, loadReadySnapshot), src/App.tsx (inizializzatori, handleAddClass, getCompleteCommittedSnapshot, prepareEncryptedBackup), src/security/secureAppStorage.ts, src/persistence/backupCheckpoint.ts, src/components/PrivacyView.tsx. RC3 exact `b726f4a6dc0eb90a066113bee7cceabf29c629a5` introduce initializeNewArchive con snapshot completo.

| Categoria | Quando assente in RC2 | Rischio |
| --- | --- | --- |
| appData | INITIAL_CLASSES, currentClassId null | Contenuto iniziale non vuoto; non generare classi/alunni |
| settings | DEFAULT_SETTINGS | Profilo predefinito potenzialmente identificativo; non assumere sia quello del titolare |
| udas | INITIAL_UDAS | Contenuto iniziale non necessariamente vuoto |
| customTests | INITIAL_TESTS; se presente merge con INITIAL_TESTS | Distinguere contenuto incorporato da quello persistito |
| submissions | [] | Non interpretare automaticamente assenza come assenza di consegne |
| planning | createEmptyPlanningState() | Non cancellare programmazioni eventualmente perdute |
| library | createEmptyLibraryState() | Non cancellare materiali eventualmente perduti |
| professionalMemory | createEmptyProfessionalMemoryState() | Fallback anche in loadSnapshot, non prova di record fisico |
| copilotState | createEmptyCopilotState() | Normalizzazione in loadSnapshot, non prova di record fisico |
| meta | {changes:0,lastBackup:null} | Assenza impedisce attribuzione automatica del checkpoint |

Anche valori presenti possono avere proiezioni UI (ordinamento alunni, currentClassId neutralizzato, merge prove iniziali, settings merge, normalizzazioni planning/copilot). Il backup nativo RC2 acquisisce getCompleteCommittedSnapshot attraverso la coda mutazioni; prepareBackupCheckpoint proietta meta, createBackupPayload v6 produce il file logico completo e PrivacyView usa SAF. Non equivale al raw snapshot fisico. Non importare i default identificativi nel nuovo prodotto; non scrivere dati incorporati per ricostruzione presunta. Nessun valore personale nei test, log o documentazione.

## 3. Decisione architetturale: recupero esplicito prima del fence
Separare un percorso di **recupero/verifica DB1** dal migratore DB1→DB2 già qualificato. Preferire un ponte additivo a una riscrittura: nella prima implementazione ammessa solo aggiunta di categorie mancanti, senza modificare alcun ciphertext esistente né metadata di chiave. Se i valori logici della copia non sono compatibili con il raw presente, non forzare l'equivalenza: mantenere DB1 e offrire successivamente ripristino esplicito in ambiente separato, da progettare e qualificare. Non usare l'attuale restoreSnapshotVerified come scorciatoia: riscrive tutti i record e il rollback da previousLogical non riproduce necessariamente l'assenza fisica originaria. Il recupero non deve chiamare il fence; solo dopo nuova verifica completa il percorso ordinario potrà essere autorizzato con nuovo consenso e copia coerente.

### Classificazione fail-closed
- DB inesistente, STAGING, schema/chiavi anomale, metadata non valida, versione sconosciuta: arresto, nessuna creazione/reset.
- DB1 ACTIVE con 10 record validi: percorso ordinario invariato.
- DB1 ACTIVE con sottoinsieme noto e tutti i record presenti autenticati: stato RECUPERO_RICHIESTO, non "RC2 legittimo" o "migrabile". Nessun dato personale visualizzato senza autenticazione.
- Chiave sconosciuta, record corrotto, record decifrato ma invalido, conflitti, dipendenze referenziali incoerenti: arresto, copia indipendente e recupero assistito; non sostituire con default.
- Assenza di prova affidabile sulle categorie mancanti: percorso automatico vietato. Una copia attuale dal vecchio programma è utile alla revisione del titolare ma non dimostra la non-perdita. Se manca una copia precedente verificabile, dichiarare l'incertezza e mantenere l'archivio invariato. L'eventuale scelta di recupero manuale è distinta da una migrazione senza perdita.

### Evidenza e approvazione
1. Cattura atomica DB1 in sola lettura con schema e chiavi esatte; abortire onupgradeneeded, chiudere connessione, autenticare metadata e ogni record effettivamente presente, registrare solo categorie e impronte non identificative. Coda delle mutazioni e proprietario della sessione esclusivi.
2. Recuperare una copia v6 effettiva, riletta da file locale e autenticata; preferire copia precedente indipendentemente conservata con origine e ambito noti al titolare. Una copia v6 prodotta dall'APK storico è prova di semantica del laboratorio, non prova universale della provenienza o della storia dei record. Confrontare record presenti con la copia: uguaglianza raw rigorosa, esclusivamente proiezione meta/checkpoint esistente e trasformazioni storiche dimostrate/approvate nel progetto (nessuna normalizzazione implicita). Conflitto o elemento mancante non risolto: stop. L'autenticazione della busta non certifica provenienza storica.
3. Verificare i valori delle categorie assenti dalla copia, validazione di schema e integrità referenziale, revisione del titolare delle categorie da recuperare, non inferire automaticamente i default. Preservare una copia di recupero indipendente prima di qualsiasi scrittura. Per il laboratorio usare esclusivamente provenienza sintetica controllata e prova indipendente del dataset atteso.
4. Nuova autorizzazione monouso, vincolata a impronta file, inventario fisico, elenco categorie e sessione. Revoca su lock/reset/background, modifica, restore, scadenza/annullamento. Nessuna password persistita, nessun dato trasmesso.
5. Pre-cifrare soltanto i nuovi record con DEK autenticata e AAD esistente. Transazione DB1 readwrite su metadata+records: verificare dentro la transazione la cattura fisica completa e l'assenza delle chiavi da inserire; usare add, non put; inserire tutte le categorie mancanti o abortire. Non toccare record già presenti, metadata, versione o checkpoint. Nessuna scrittura se il controllo fallisce. Verificare raw ciphertext dei precedenti invariati, categorie nuove autentiche e valori equivalenti, riapertura a freddo; errore post-commit blocca accesso/migrazione e richiede recupero verificato, non cancellazione automatica. Il completamento additivo e la migrazione DB2 sono due transazioni distinte con confine di sicurezza DB1 stabile; non dichiarare atomicità globale.
6. Solo con DB1 completo e verificato: produrre/rileggere nuova copia v6 coerente con tutti i record, nuovo consenso esplicito, invocare il migratore completo senza alterazioni. Se i dati raw non sono compatibili con la copia v6, fermarsi e documentare caso di ripristino separato.

## 4. Fasi implementative e prove bloccanti
| Fase | Consegna | Evidenza minima |
| --- | --- | --- |
| I03a | Classificatore read-only e confronto semantico RC2 exact | Casi completo, parziale legittimo sintetico, chiave sconosciuta, rimozione da archivio completo, metadata/stato errato, corruzione, assenza DB; nessuna write |
| I03b | Prova APK RC2 integrale: creazione controllata, reale export v6 via SAF e inventario | Hash e confronto contenuti in memoria, nessun dato reale o payload in artifact; evidenziare default e differenze raw/logiche. Se fixture incorporata non è sintetica verificabile, non esportarla: usare ambiente/fixture sintetico qualificato e dichiarare il limite |
| I03c | Recupero additivo atomico isolato, autorizzazione e readback | Inserimenti tutti-o-nessuno, fault injection/abort/blocco concorrente, cambio fisico, lock, replay, copia sbagliata, omissione o sostituzione; ciphertext esistenti invariati, raw nuovi verificati; DB1 sempre fino a nuova autorizzazione |
| I03d | Riqualifica migrazione completa e compatibilità dei binari storici | RC2 sparse positivo solo con evidenze sufficienti, RC2 completo, RC3, Beta2 RC2; caso incerto deve bloccare; downgrade fail-closed e reupgrade integro |
| D1b.4–5 | Proprietario produttivo, serializzazione, UX e sicurezza cumulativa | Verifica sessione reale, interruzioni, archivio e copia locale, nessun rilascio prima del gate cumulativo |

I03b non può usare fixture che scriva arbitrariamente i record mancanti per ottenere un verde. Il caso originale sparso deve restare rilevabile. Prove di perdita simulata: partenza da archivio completo, eliminazione deliberata di categoria in fixture isolata, confronto con precedente backup indipendente; nessuna migrazione automatica in assenza di prova. Negativi non devono essere conteggiati come migrazione riuscita. Rischio di dati personali: nessun export di dati reali, solo fixture sintetiche, report di categorie/hash; artefatti firmati di laboratorio non pubblicabili.

## 5. Decisione di avanzamento
Revisione indipendente della progettazione prima di I03a. Non toccare l'app installata, non effettuare downgrade reale, non chiedere chiavi/password. Il percorso Beta2 RC2 attuale resta indipendente dalla specificità RC2; non abbassare il gate per accelerare. PR #291 in bozza.

## 6. Sospensione approvata e criterio di riapertura
La progettazione I03 resta come conoscenza conservata, non come lavoro attivo. Riaprire solo se una necessità effettiva e documentata di recupero di un archivio parziale non è risolvibile con il percorso di copia/ripristino già previsto e qualificato per quello specifico caso; serve una nuova decisione esplicita. La versione installata non dimostra la provenienza o la completezza del DB: prima della futura migrazione produttiva verificare localmente tutti i dieci record fisici e la loro autenticità, non soltanto il contenuto logico del backup. Se parziale, bloccare e conservare i dati; valutare separatamente il ripristino da una copia indipendente verificata, senza reset o downgrade reale. Il piano D1b.4–5 resta prioritario.
