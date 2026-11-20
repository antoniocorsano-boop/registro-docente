# Registro Docente — Piano di realizzazione Web e Android orientato al lavoro del docente

**Data:** 20 novembre 2026  
**Stato:** piano operativo documentale, pronto per decisione di esecuzione; nessuna modifica a runtime, servizi, firma o dati.  
**Punto di partenza:** main 8d3baab8e513100887c8b81d1dbf7408bebeec6f, aggiornato con DOC-01 PR #383.  
**Audit conservato:** [Audit generale 20 novembre 2026](../audits/2026-11-20-registro-docente-audit-generale-web-android.md).  
**Governance:** [#104](https://github.com/antoniocorsano-boop/registro-docente/issues/104), [#326](https://github.com/antoniocorsano-boop/registro-docente/issues/326), [#210](https://github.com/antoniocorsano-boop/registro-docente/issues/210); qualità professionale PRODUCT-QUALITY-01 e UX-GOV-01.

## 1. Risultato da ottenere: un prodotto e due modi di utilizzarlo

**Registro Docente deve permettere all'insegnante di preparare, condurre, registrare, rivedere e riutilizzare la propria attività didattica senza perdere dati, tempo o contesto.**

- **Web:** da computer o tablet, accesso al proprio archivio cifrato nell'origine del browser; preparazione UDA/lezioni e materiali, registrazione, consultazione, analisi, documentazione e PDF. Sito HTTPS raggiungibile, con versione effettiva identificabile e procedure di aggiornamento/recupero; non confondere il codice in main con la versione attualmente ospitata.
- **Android:** applicazione autonoma installabile e aggiornabile, avvio da icona, lavoro quotidiano senza rete per le funzioni essenziali, interfaccia adatta allo smartphone, stesso significato dei dati e delle azioni Web; gestione nativa del blocco, del tasto Indietro, delle copie cifrate e dei PDF.
- **Nucleo comune:** stesso modello didattico, stesse regole di persistenza, privacy, valutazione e calcolo. Differenze tecniche solo dove indispensabili (selettori file, salvataggio PDF, navigazione di sistema, firma, ciclo di vita).
- **Passaggio tra dispositivi:** non esiste sincronizzazione automatica autorizzata. Archivi Web e Android sono distinti; il trasferimento avviene mediante una copia **cifrata**, verificata, selezionata e ripristinata dal docente, con compatibilità delle versioni comprovata. Nessun dato personale degli alunni su cloud o verso modelli remoti.
- **Assistente:** il Copilota è un supporto facoltativo e contestuale, non la condizione necessaria per svolgere i compiti fondamentali. Servizi remoti, se disponibili, restano soggetti a classificazione, consenso e disponibilità; Android non incorpora il server Node/Express.

### Non obiettivi del primo rilascio utilizzabile
Nessuna riscrittura dell'applicazione; nessun sincronismo cloud di dati degli studenti; nessun sostituto del registro elettronico istituzionale; nessuna valutazione automatica degli alunni; nessuna nuova piattaforma di pubblicazione a pagamento; nessun pacchetto Android pubblicato o firmato senza approvazione separata.

## 2. Le cinque attività del docente su cui misurare il risultato

| Codice | Percorso professionale | Esito concreto e riconoscibile | Web | Android |
|---|---|---|---|---|
| J1 | **Prepara**: scegli classe, UDA, lezione, materiali e verifica | La preparazione rimane salvata e recuperabile, con i riferimenti corretti | Obbligatorio | Consultazione e modifiche essenziali offline |
| J2 | **Conduci**: apri la classe in lezione e consulta ciò che serve | Materiali e obiettivi immediati, senza schermate tecniche o nuova selezione del contesto | Obbligatorio | Priorità massima, schermo piccolo |
| J3 | **Registra**: voto, prova svolta, comportamento, osservazione | Inserimento rapido e conferma **solo dopo scrittura durevole**; errore non cancella la bozza né duplica la registrazione | Obbligatorio | Priorità massima, offline |
| J4 | **Rivedi**: Tabellone, storico, scheda e andamento | Evidenze corrette, distinguendo fatti, interpretazioni e proposta docente; ritorno al contesto precedente | Obbligatorio | Lettura e consultazione agevoli |
| J5 | **Riusa e documenta**: riprendi attività, prepara Consiglio, bilancio e documento | Documento o proposta tracciabile, modificabile e confermato dal docente; esportazione locale protetta | Obbligatorio | Consultazione ed esportazioni supportate e verificate |

Tre scenari di prova end-to-end sintetici sostituiscono la proliferazione di micro-dimostrazioni isolate: (A) preparazione di una lezione di Tecnologia con UDA e materiale; (B) lezione con più studenti, voti/osservazioni, blocco e ritorno; (C) fine periodo con evidenze, restituzione e backup. Il collaudo dello scenario deve attraversare più schermate della **vera applicazione**, non soltanto un componente di laboratorio.

## 3. Fotografia tecnica e limiti da non confondere

| Funzione | Riscontro al 20/11/2026 | Decisione |
|---|---|---|
| Nucleo Web React/Vite, accesso al Vault cifrato, Home e aree docente | Presente in main, protetto da Web Crypto/IndexedDB | Verificare su URL realmente distribuito e sul commit sorgente corrispondente |
| Creazione archivio professionale vuoto o dimostrativo | Presente nei sorgenti; issue #217 più vecchia | Verificare primo avvio e importazioni su entrambe le piattaforme; aggiornare l'issue |
| Tabellone Smart, storico, valutazioni e comportamento | Collegati all'App | Qualificare pochi gesti essenziali in classe e coerenza salvataggio |
| Programmazione, UDA, Biblioteca, Consigli e scheda individuale | Collegati all'App; funzioni specialistiche presenti | Prova d'uso e riduzione degli attraversamenti superflui |
| Valutazione per prove/criteri/evidenze, bilancio | Moduli di dominio sviluppati, integrazione ordinaria incompleta | Completare un percorso professionale per volta, senza rifare moduli |
| Documentazione istituzionale e recupero V8/V9 | Modelli, versionamento e laboratori qualificati; V9 non attivato | Prima sicurezza e integrazione autorizzata; poi produzione documenti |
| Android Beta 2 RC2 sul telefono | Precedente aggiornamento personale riferito e prove di laboratorio | Il merge in main non aggiorna l'APK; serve un candidato esatto e una firma locale stabile |
| Candidato di sicurezza #325 | Congelato, diverge dal nuovo main | Confrontare e trasferire solo le protezioni necessarie, mai fondere i rami alla cieca |
| Web pubblicato | Sono esistite anteprime/pubblicazioni, ma Vercel automatico è disabilitato | Accertare URL, provenienza degli asset, versione e percorso di pubblicazione prima di dichiarare Web aggiornato |
| IA, memoria semantica, collegamenti TRAMA | Disponibilità differenziata, alcuni percorsi opzionali | Non trasformarli in prerequisiti per il Registro offline |

La qualifica **55/55** delle PR #379–#383 e la verifica PREDEPLOY su main costituiscono una base tecnica documentata, **non** certificano il pacchetto finale, il sito effettivamente pubblicato, la revisione specialistica o l'accettazione del docente.

## 4. Impostazione produttiva: tre filoni coordinati, non progetti paralleli

**C — Nucleo condiviso:** dati e compatibilità, salvataggi duraturi, sicurezza, significato professionale, accessibilità, materiali e modelli.  
**W — Consegna Web:** origine HTTPS stabile, versione verificabile, prova reale nel browser, gestione archivio su quell'origine e procedure di aggiornamento.  
**A — Consegna Android:** APK autonomo, verifica offline, protezione della sessione, file SAF, PDF, tasto Indietro, versione/certificato di firma e prova di aggiornamento.

I tre filoni avanzano sul **medesimo candidato funzionale dichiarato**, mantenendo due verifiche di piattaforma. Il sito Web e l'APK devono essere riconducibili allo stesso contenuto del prodotto; è vietato descrivere la versione Web ospitata o l'APK installato come identici a main senza prova della corrispondenza.

**Regola di avanzamento:** una sola integrazione funzionale attiva per volta; analisi, revisione e collaudo delle piattaforme possono procedere in parallelo se non alterano il candidato. Prima di aprire nuovi rami, esaminare ciò che è già in main e nelle PR storiche; ogni incremento produce un risultato docente, non un nuovo laboratorio indefinito.

## 5. Programma esecutivo a tappe, con condizioni di completamento

### M0 — Conservazione e ricognizione governata (documentale)
**Obiettivo:** avere una fonte unica per obiettivi, situazione reale, residui e scelte.  
**Interventi:** salvare l'audit; inventario delle funzionalità di main; riconciliare issues #104/#210/#326 e raggruppare le 120 PR aperte in *sostituite, necessarie, storiche di prova, ancora da decidere*. Non chiudere senza evidenza né integrare in massa.  
**Uscita:** audit e piano collegati; un elenco breve di interventi bloccanti, proprietario e accettazione di ogni attività; nessuna duplicazione non motivata.

### M1 — Un candidato affidabile del nucleo comune (priorità P0)
**Obiettivo:** proteggere i dati su Web e Android, conservando le correzioni più recenti.  
**Interventi:**
1. Confronto **file per file** del nuovo main, del candidato storico #325 e dei moduli di recupero; classificare differenze: protezioni indispensabili, cambiamenti già equivalenti, laboratorio non attivato, rischi incompatibili.
2. Riconciliare con correzioni minime e test causali solo per differenze comprovate; archiviare il risultato in **un candidato esatto**. Controllare compatibilità con i backup effettivamente prodotti dalle versioni precedenti.
3. R1 — revisione specialistica indipendente di sicurezza, incarico e matrici aggiornati al candidato esatto (#323), distinta da Codex.
4. R2 — completamento autorizzato della prova di recupero nativo S-R04b (#307), senza aggirare la procedura sospesa; esportazione reale cifrata, recupero su nuova installazione, integrità, interruzione e revoca, password errata, rifiuto del declassamento, nuova autenticazione.
5. R3 — inventario di identità e versioni del pacchetto Android, versione successiva a 10004, certificato originale e firma soltanto nel sistema locale sotto controllo del titolare; nessuna chiave privata in CI.
**Uscita (GO):** nessuna perdita/doppia scrittura dimostrata sui casi critici, revisioni R1/R2 positive, compatibilità attestata, pacchetto candidato riproducibile. **NO-GO:** rilievi specialistici bloccanti, prova nativa non eseguibile, perdita di archivio o firma/versione non coerenti. In NO-GO continuano solo analisi e lavoro indipendente sicuro; nessun rilascio.

### M2 — Due piattaforme realmente utilizzabili (priorità P0/P1)
**Obiettivo:** verificare il prodotto intero, non soltanto i moduli.  
**Web W1:** identificare URL e origine effettiva; controllare versione/asset e HTTPS; primo accesso, archivio vuoto/demo, J1–J5 con dati sintetici, riapertura e conservazione, privacy, PDF, backup esportato e riletto; provare due browser/finestre, schermo mobile e desktop. L'eventuale aggiornamento dell'hosting è una decisione distinta, con prova della versione pubblicata e possibilità di ripristino del sito precedente; non attivare distribuzioni automatiche per default.  
**Android A1:** eseguire gli stessi J1–J5 in assenza di rete per le funzioni essenziali; tasto/gesto Indietro, bozze e tastiera, stato dei salvataggi, oscuramento/riapertura, selettore file, PDF locale, riavvio forzato, aggiornamento sulla stessa installazione firmata, file di backup realmente leggibile. Comportamento compatibile Android API 32 e 36 e prova umana sul telefono disponibile.  
**Raccordo W↔A:** esportare da Web un archivio cifrato sintetico e ripristinarlo in Android (e percorso inverso se il formato e la politica lo ammettono), confrontando inventario e contenuti; nessun trasferimento implicito.  
**Uscita:** matrice PASS/REWORK per J1–J5 sulle due piattaforme, prove oggettive più valutazione del docente su 320/390 px e caratteri ingranditi. Un controllo automatizzato favorevole non conclude la revisione d'uso.

### M3 — La giornata del docente con pochi gesti (priorità P1)
**Obiettivo:** rendere semplice ciò che esiste già.  
**Interventi mirati:** percorso Prepara → Conduci → Registra → Rivedi con classe/UDA coerenti; Tabellone Oggi e Storico, nominativi leggibili, inserimento voto/osservazione e conferma chiara; navigazione di ritorno senza perdere posizione/bozza; eliminazione di duplicazioni nelle schede; messaggi comprensibili e differenza tra salvataggio locale e copia cifrata esterna.  
**Uscita:** completamento dei tre scenari sintetici, senza ripetere selezioni non necessarie, senza avvisi falsamente positivi e senza azioni nascoste su smartphone. I rilievi HPR #217, #242, #262, #227, #234, #125 vengono aggiornati con prova, non dati per chiusi dal solo codice.

### M4 — Valutazione e restituzione effettivamente collegate (priorità P2)
**Obiettivo:** non inserire due volte le stesse informazioni.  
**Interventi:** rendere operativo il percorso prova pianificata → prova svolta → criterio/rubrica → evidenza individuale confermata → andamento/bilancio → proposta di restituzione. Collegare il motore già presente in src/assessment al Tabellone e alla scheda senza alterare dati canonici o dedurre livelli da informazioni assenti. L'insegnante approva valutazioni e restituzioni; nessuna IA emette giudizi autonomi.  
**Uscita:** una prova con più alunni sintetici attraversa integralmente il flusso, con annullamento, correzione motivata e protezione della riservatezza documentati. Riferimenti #231/#227.

### M5 — Consigli, documenti e integrazioni mirate (priorità P2/P3)
**Obiettivo:** produrre documenti utili dalle evidenze già registrate.  
**Interventi:** sedute periodiche, monitoraggi, proposte docente distinte da deliberazioni collegiali (#170); modello istituzionale, programmazione annuale, programma svolto e relazione finale, provenienza delle fonti, storico revisioni, anteprima, conferma ed esportazione locale PDF/DOCX (#171). Attivare il recupero istituzionale V9 soltanto dopo qualificazione di prodotto, prova di compatibilità e approvazione autonoma. Raccordi TRAMA consentiti: curricolo Arena approvato, progettazione Docente OS e contenuti Atlas; dati personali e valutazioni restano nel Registro locale.  
**Uscita:** generare, modificare, confermare e recuperare un documento di prova, senza inventare fatti o decisioni collegiali; verificarne il file effettivamente prodotto su Web e Android.

### M6 — Maturità e manutenzione continuativa (successiva al prodotto utilizzabile)
**Obiettivo:** mantenere sostenibile la qualità.  
**Interventi:** ridurre progressivamente i grandi componenti centrali solo se dimostrato utile; consolidare messaggi ed elementi condivisi; controlli accessibilità, dipendenze, qualità e regressioni; valutare strumenti gratuiti Biome/Knip (#327), memoria locale e Copilota contestuale senza nuovi costi o vincoli remoti.  
**Uscita:** aggiornamenti ordinari ripetibili, documentazione tecnica e utente essenziale, nessuna regressione nelle cinque attività fondamentali.

## 6. Matrice minima di accettazione comune

| Prova | Web | Android | Esito richiesto |
|---|---|---|---|
| Primo avvio professionale e demo | Browser reale | Prima installazione | Archivio professionale vuoto, demo chiaramente distinta, nessuna inizializzazione silenziosa |
| Apertura/chiusura sessione | Blocco e riapertura | Sospensione, recenti, ripresa | Nessuna lettura non autenticata o perdita di mutazioni ammesse |
| J1 preparazione e UDA | Desktop/mobile | Offline | Salvataggio, riapertura e contesto corretti |
| J3 voto/comportamento | Browser | Smartphone offline | Una sola scrittura durevole, conferma post-commit; bozza preservata su errore |
| Indietro / cambio vista | Cronologia e dialoghi | Gesto di sistema/tastiera | Nessuna perdita di bozza, contesto e posizione coerenti |
| J4 analisi e scheda | Mobile/desktop | Smartphone | Dati calcolati coerenti, nessuna valutazione immaginaria |
| J5 documento/PDF | Download e lettura file | File locale verificato | Privacy attiva dove richiesta, contenuto/identità corretti e nessun dato di altri alunni |
| Copia cifrata | Download e verifica file | SAF e rilettura | Prova reale del file, ricevuta solo dopo conferma fisica |
| Ripristino e compatibilità | Ambiente nuovo e vecchio | API 32/36, aggiornamento | Integrità di tutti i record, nuova autenticazione, no declassamenti |
| Regressione e responsabilità | SHA del sito e fonte | SHA del pacchetto e firma | R1/R2/R3 e revisione umana, nessuna asserzione di pubblicazione senza prova |

Le verifiche specifiche di piattaforma non diventano obblighi ripetuti per ogni piccola modifica: usare test proporzionati al rischio; eseguire il ciclo integrale **quando si promuove una nuova versione** o si toccano i confini trasversali di dati/sicurezza.

## 7. Piano di rilascio: due decisioni distinte

**Rilascio Web (W-GO):** URL effettivo e origine sotto controllo, candidato Web identificato, HTTPS, funzionamento end-to-end con dati sintetici, persistenza/recovery sul medesimo browser, politiche di privacy/backup adeguate, assenza di servizi remoti non autorizzati, accettazione del docente e decisione esplicita di pubblicazione. Nessuna promessa di portabilità automatica tra origini Web diverse.

**Rilascio Android (A-GO):** esito positivo dei gate R1/R2/R3 pertinenti, APK proveniente da candidato verificato, stessa identità e certificato dell'app esistente, versionCode crescente, prova locale di aggiornamento e recupero con dati sintetici, funzionamento offline, revisione umana, decisione esplicita di firma/installazione/pubblicazione. Una build di prova su emulatore non è un aggiornamento autorizzato del telefono.

**Uso reale professionale:** autorizzazione separata dopo i gate pertinenti su sicurezza, riservatezza e procedure dell'istituto. L'utilizzo di prova del codice in main e l'esistenza di un sito pubblicato non costituiscono autorizzazione a trattare dati scolastici reali.

## 8. Ordine delle prossime attività: azioni immediatamente eseguibili

1. **M0 chiusa nella parte documentale:** audit salvato e piano registrato; collegamenti nelle issue #104/#210/#326.
2. **Avviare M1 con ricognizione differenziale sola lettura:** tabella delle protezioni del candidato #325 vs main corrente; indicare esattamente quali controlli mancano, sono equivalenti o rischiano conflitti. Non creare il nuovo candidato finché non esiste questa matrice verificata.
3. **Aprire il programma W1 con un controllo Web a dati sintetici** sulla versione realmente raggiungibile, annotando commit/asset e scostamento da main; nessuna modifica alla pubblicazione.
4. **Conservare la Beta Android installata** come riferimento e predisporre la matrice di prove sul nuovo candidato senza firmare o installare APK prima delle condizioni di rilascio.
5. **Scegliere un solo percorso docente principale** (J3 in una lezione) come criterio di accettazione trasversale prima dei nuovi sviluppi del bilancio e della documentazione.

## 9. Responsabilità e controllo delle decisioni

- **Docente responsabile del prodotto:** accettazione dei percorsi J1–J5, terminologia, qualità sul telefono, scelta dei documenti e autorizzazione a nuove versioni.
- **Sviluppo tecnico:** fonte dei dati, differenze esatte, correttivi minimi, test proporzionati, integrità e provenienza dei pacchetti; non presume la bontà UX dai test.
- **Revisore di sicurezza indipendente:** R1 con perimetro, evidenze, rilievi e firma/attribuzione del giudizio; distinto dalle revisioni automatiche.
- **Governance:** #104 resta coordinamento unico. #326 e #323 mantengono i vincoli di rilascio; #210 organizza l'evoluzione. Una PR di documentazione non modifica le condizioni di sicurezza né autorizza un rilascio.

**Principio vincolante:** misurare il progresso sul lavoro che il docente riesce davvero a completare su Web e Android. Una nuova PR, un numero maggiore di controlli o un modulo isolato qualificato non sono, da soli, risultati di prodotto.
