# CDC-02/S2b — Piano eseguibile della fotografia per seduta

- Data: 2026-11-09
- Stato: **PIANO PROPOSTO / NON AVVIATO**. Solo documentazione; non attestare implementazione, test PASS o accettazione.
- Design: ../specs/2026-11-09-cdc-02-s2b-session-evidence-snapshot-design.md
- Baseline verificata: main@994725b39385e79510e6eaccc44607dcf4f07b0f
- Gate prodotti predecessori: S1 #176 MERGED; S2a #178 MERGED, HPR e 5/5 qualificati prima delle fusioni; Vercel git.deploymentEnabled=false.
- Governance: AGENTS.md, OR-001..009, TR-001..004, D-004, privacy sintetica e decisione umana distinta su merge e distribuzione.

## Sequenza ordinata, senza fasi implicite

### Gate S2b-D0 — Ratifica del contratto prima del codice

- Revisionare specifica e scegliere consapevolmente **aggregati soltanto** per v1; le impronte sono metadati cifrati e non anonimizzazione.
- Definire la forma serializzata deterministica dei fingerprint (Unicode, ordine liste/chiavi, versioni, trattamento dei decimali e dei dati assenti) con due vettori statici noti.
- Chiarire limite temporale del calcolo e nomenclatura «Fotografia acquisita per la seduta», non «stato del registro alla data della seduta».
- Verificare con un prototipo isolato che i backup v6 conservino un campo opzionale di ClassData senza perdita; nessun cambio versione sulla sola supposizione.
- Registrare la decisione durevole in docs/memory/DECISIONS.md **solo dopo** ratifica, con riferimenti al progetto. Non inserire dati reali nel repository.

**Uscita:** design ratificato, nessuna modifica applicativa.

### S2b-P1 — Modello puro e RED causale

Percorsi candidati:
- src/types.ts: CouncilEvidenceSnapshotV1 e ClassData.councilEvidenceSnapshots?;
- src/council/councilEvidenceSnapshots.ts: funzioni pure di preparazione/validazione/lettura e append-only, senza side effects;
- src/security/cdc02CouncilSnapshots.test.ts: contratti sintetici;
- src/council/councilEvidenceOverview.ts: **riuso** del calcolo S2a, non duplicazione.

Prima scrivere test che falliscano per **assenza** di:
1. filtro e identità espliciti di classe/anno/seduta;
2. rispetto cutoff (anno scolastico, sessionDate, capturedAt) e separazione delle tre date;
3. calcolo dei sei numeri e complementarità; bozza ignorata; zero studenti;
4. immutabilità della versione precedente, versionamento e idempotenza;
5. corrispondenza della fonte valutata in anteprima e della fonte confermata al momento della scrittura;
6. valori e fingerprint malformed, duplicate ID, orfani, alterazione di sessionKind/date/anno.

Conseguire il GREEN correggendo solo il modello, con risultati deterministici e senza produrre scritture nel Vault. Congelare i vettori di hash in test, documentando che il digest non è una firma.

**Uscita:** RED→GREEN isolato sul contratto di modello, SHA verificato, nessun collegamento UI.

### S2b-P2 — Compatibilità Vault, import/export e protezione da perdita

Percorsi:
- src/council/councilModel.ts: integrazione in isCouncilAppDataValid e wouldLoseCouncilEntries;
- src/security/backupPayload.ts: riuso del validatore esistente; cambiare strategia solo se i test impongono versione nuova;
- src/security/cdc02CouncilSnapshotsBackup.test.ts: export/import V2–V6 e legacy, con/senza snapshot, duplicati, record corrotti, snapshot per seduta mancante, restituzione esatta dei record, avviso perdita e rinuncia all'import;
- src/security/secureAppStorage.ts: **nessuna nuova chiave** come default; dimostrare che saveAppDataAndMeta resta atomico;
- src/persistence/durableMutationCoordinator.ts: riuso del coordinatore senza scorciatoie o scritture fuori coda.

Sequenza di verifica: salvataggio→rilettura Vault→esportazione cifrata→ripristino→confronto canonico; fallimento del persist deve lasciare invariato lo stato pubblicato; ripristino di archivio precedente senza fotografie deve essere riconosciuto come perdita e fermarsi prima del consenso.

**Uscita:** compatibilità dimostrata e nessuna sovrascrittura silenziosa.

### S2b-P3 — Anteprima e conferma esplicita nel percorso Consigli

Percorsi:
- src/components/CouncilView.tsx: accanto alla **seduta selezionata**, azioni «Prepara fotografia», «Conferma e salva fotografia», «Acquisisci nuova versione», «Annulla»; mostrare elenco revisioni, capturedAt, data limite, avvertenza sulle registrazioni retroattive;
- src/App.tsx: callback che entra nel coordinatore con commit atomico da ref canonici, revalidazione della fonte e gestione esatta degli errori;
- eventuali componenti piccoli dedicati, senza trasformare l'intero tabellone.

**Flusso di conferma:** preparazione read-only, blocco con voti in bozza, confronto fingerprint della preview e della fonte nel coordinatore, arresto in caso di drift, transazione Vault, stato visibile aggiornato solo dopo successo. Apertura o ritorno da «Oggi» **non** crea istantanee. Errori mostrati in modo distinto e con azione di recupero, non «salvato» ottimistico.

**Uscita:** percorso funzionale locale con due versioni della stessa seduta e selezione dello storico.

### S2b-P4 — Prove browser, privacy e regressioni

Scenari minimi Playwright su runner GitHub ephemeral, con soli alunni sintetici:
1. classe e seduta selezionate: prima dell'azione non esiste alcuna fotografia;
2. «Prepara» e «Annulla»: nessuna mutazione, anche riaprendo la seduta;
3. «Conferma»: un record persistito e ritrovato dopo ricaricamento;
4. variazione successiva di prove/voti: il quadro S2a cambia, la fotografia precedente no;
5. nuova versione esplicita: due revisioni in sequenza e la prima ancora consultabile;
6. doppio tap, cambio classe/anno e mutazione concorrente: nessun doppio record/commits errati;
7. cutoff futuro, anno incompatibile, seduta orfana, hash invalido: fail closed;
8. import da backup vecchio che eliminerebbe fotografie: avviso e annullamento efficace;
9. formato mobile 360 e 390 px, Privacy Shield, niente traboccamento della pagina, testo di provenienza comprensibile;
10. regressione S1, S2a, CDC-01, Browser Qualification esteso.

Gate esatti: Invarianti, PREDEPLOY, FLOW-03, HEADER-01, Browser Qualification **5/5** sul medesimo head SHA. Una prova isolata o un artifact scaricato **non** costituisce il gate Chromium totale. Se un gate fallisce si corregge la causa dimostrata; commit nuovo = nuovo candidato e nuove prove. Richiedere revisione indipendente exact-SHA e zero thread irrisolti.

**Uscita:** ENGINEERING QUALIFIED, ancora senza HPR o promozione.

### S2b-P5 — Accettazione umana e integrazione governata

- Preparare un dossier **sintetico e leggibile** con quattro stati almeno: anteprima non salvata; fotografia confermata; quadro corrente diverso dal congelato; nuova revisione esplicita con precedente ancora presente.
- Acquisire un giudizio umano PASS/REWORK sulla differenza fra seduta, cutoff e capturedAt, senza indurre l'idea di verbale ufficiale.
- Solo dopo eventuale HPR positiva, chiedere una **autorizzazione separata** per fondere la singola PR qualificata.
- Merge con expected_head_sha, controllo del nuovo main e confronto dei blob/tree su file mutati; distinguere fedelmente la parità dei contenuti dai run indipendenti su evento push, quando non recuperabili.
- Conservare Vercel disabilitato. La distribuzione è una decisione diversa, non implicita.

**Uscita:** merge governato e ricevute di stato; nessuna pubblicazione automatica.

## Invarianti che non devono regredire

- La foto di S2b è *append-only, confermata, datata*, mentre S2a resta sempre una vista corrente e non salva nulla da sola.
- Nessuna modifica ad AppData.grades o CouncilAssessment come side effect di fotografia, né voto ricostruito da media.
- L'archivio sedute S1 può avere più sedute con stesso giorno/tipo; le fotografie sono collegate alla **ID stabile** della seduta, non a data+tipo.
- L'anno e la data devono essere validati in forma canonica; non riconciliare silenziosamente sedute fuori anno o riferimenti orfani.
- Le informazioni risultanti non sono verbali o deliberazioni e non derivano attestazioni temporali impossibili dai dati disponibili.
- L'archivio attuale, i backup storici e il Privacy Shield funzionano senza introdurre memorizzazioni in chiaro o reti remote.
- La data ISO canonica è distinta dalle sue etichette locali. Il debito UX-P3 esistente non deve diventare una modifica di schema in S2b.

## Punti che richiedono valutazione nella review del design

1. Si accetta un **v1 di soli aggregati**, rinviando i dati individuali al relativo gate di privacy e prodotto?
2. I fingerprint su fonti correnti e roster sono sufficienti per segnalare differenze di provenienza senza duplicare voti? Sono descritti correttamente come **controlli interni**, non anonimizzazione o prova forense?
3. Il vincolo di cutoff fino alla seduta e al giorno di cattura è appropriato per sedute passate/future?
4. La versione v6 del backup può restare invariata **solo dopo prove di compatibilità documentate**?
5. I messaggi UI spiegano adeguatamente che una foto retroattiva non ricostruisce il contenuto del registro nella data storica?

## Stato di avvio

- S2b-D0: **questa proposta, in revisione**.
- S2b-P1…P5: **NON AVVIATI**.
- Nessuna nuova struttura serializzata, callback, salvataggio, collaudo o migrazione implementati.
- La promozione di questa documentazione non equivale all'autorizzazione per i futuri merge applicativi.

La roadmap di controllo è issue #170 / issue #104. S2c (confronti) e S3 (ordine del giorno, note e seguito) restano successivi e separati.
