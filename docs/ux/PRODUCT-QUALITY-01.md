# PRODUCT-QUALITY-01 — Qualità di prodotto per Registro Docente

- **Stato:** ACTIVE nel ramo principale dopo l'integrazione approvata della PR #198; prima dell'integrazione resta una proposta
- **Data:** 2026-11-10
- **Ambito:** tutte le nuove funzionalità e modifiche a Registro Docente, incluse interfacce, contenuti, navigazione, messaggi, Copilota, verifiche, dati e manutenzione.
- **Autorità:** integra senza sostituire la specifica normativa `UX-GOV-01-registro-docente-user-flow-baseline-v1.md`. In caso di conflitto prevalgono i vincoli di UX-GOV-01, sicurezza, privacy, accessibilità e i contratti canonici.
- **Origine:** osservazioni docente sulla PR #197; issue #196; roadmap #104.

## 1. Identità e promessa del prodotto

**Registro Docente è un ambiente di lavoro professionale per l'insegnante. Non è una console tecnica né una collezione di funzioni isolate.**

Il docente deve poter preparare, condurre, registrare e rivedere l'attività didattica con pochi passaggi logici. L'applicazione conserva il contesto professionale consentito, propone solo le azioni pertinenti e lascia al docente le decisioni e le conferme rilevanti.

**Regola:** ogni intervento deve preservare o migliorare l'esperienza complessiva; non basta che un componente funzioni o che i controlli automatici siano superati.

Il criterio fondamentale è: **l'insegnante comprende subito che cosa può fare, perché gli serve e che cosa accadrà dopo.**

## 2. Progettare il lavoro, non la struttura del software

Prima di implementare, definire in termini comprensibili al docente:

1. **Situazione reale:** chi usa questa funzione, in quale momento (prima, durante o dopo la lezione, nel consiglio di classe, nella preparazione di verifiche).
2. **Obiettivo professionale:** quale risultato concreto deve ottenere.
3. **Percorso minimo:** quali azioni sono indispensabili, quali informazioni sono già note e quali possono restare nascoste finché non servono.
4. **Esito riconoscibile:** che cosa è pronto, che cosa è una bozza, che cosa è stato salvato o registrato e che cosa resta da confermare.
5. **Ritorno e continuità:** come correggere, tornare indietro e riprendere il lavoro senza perdere informazioni.

Non aggiungere un nuovo pannello solo perché esiste un nuovo modulo tecnico. Utilizzare i percorsi canonici di UX-GOV-01 e gli strumenti specialistici già presenti.

## 3. Voce e terminologia professionale

- **Tono:** italiano corretto, sobrio, professionale, diretto e rispettoso. Mai burocratese, gergo aziendale, tecnicismi non necessari, protagonismo dell'assistente o formule compiacenti.
- **Lessico:** usare parole del lavoro scolastico: classe, lezione, attività, materiale, programmazione, UDA, obiettivi di apprendimento, conoscenze, abilità, verifica, valutazione, osservazioni, esiti, registro.
- **Precisione:** non confondere *verifica* (strumento o prova) e *valutazione* (giudizio/registrazione); non confondere *proposta*, *bozza*, *salvataggio*, *pubblicazione* e *registrazione*.
- **Comandi:** indicare l'azione concreta, preferendo «Prepara le domande», «Apri e modifica», «Salva la verifica», «Registra la valutazione» a «Continua» ripetuti e privi di destinazione.
- **Messaggi:** dire cosa è successo e cosa fare ora; evitare linguaggio di implementazione, anche quando l'errore nasce da un servizio o da una validazione.
- **Sigle:** mantenere soltanto quelle consolidate nella scuola e utili alla decisione, come UDA. Niente codici di processo, revisioni, hash, nomi di modelli, identificativi e stati di sistema nella vista ordinaria.
- **Trasparenza necessaria:** non occultare informazioni su privacy, autorizzazione all'invio esterno, provenienza significativa, dati personali, conflitti o salvataggio. Renderle comprensibili e collocarle al momento della decisione.
- **Stabilità:** assegnare sempre lo stesso nome alla stessa azione o entità nelle diverse sezioni. Le etichette di navigazione devono coincidere con quelle dei percorsi reali.

### Esempi orientativi

| Da evitare nella vista ordinaria | Preferire, se semanticamente corretto |
| --- | --- |
| «Controllo il contesto…» | «Verifico la classe e il materiale…» solo se tale verifica è davvero in corso |
| «Fonte professionale» | «Materiale» oppure «Materiale della Biblioteca» |
| «Contesto didattico univoco» | «Scegli la classe» / «Indica l'UDA» secondo il caso reale |
| «Ricalcola le possibilità» | «Aggiorna le opzioni» o, meglio, l'azione specifica disponibile |
| «Verifica pronta» quando non è salvata | «Proposta di verifica disponibile» / «Domande da rivedere» |
| «Proposta restituita non valida» | «Non è stato possibile preparare le domande. Riprova o modifica la richiesta.» |
| «Flusso governato» | Spiegare solo la conferma necessaria: «Conferma prima di inviare il materiale» |

**Nota:** non applicare sostituzioni automatiche indiscriminate. Verificare sempre il significato, il contesto e l'azione effettivamente disponibile. Gli esempi sono guida editoriale, non regole di ricerca e sostituzione.

## 4. Presentazione e comportamento

- **Gerarchia:** titolo del compito, contesto essenziale, contenuto e un'azione principale pertinente allo stadio; azioni secondarie distinguibili e non concorrenti.
- **Densità:** eliminare ripetizioni di classe, materiale, origine e spiegazioni già note; dettaglio esteso solo su richiesta, senza nascondere avvisi obbligatori.
- **Leggibilità:** testo ordinario leggibile anche su smartphone; non compensare la complessità con caratteri minuscoli, etichette in maiuscolo o molte cornici annidate.
- **Identità visiva:** colori, icone, spaziature e componenti coerenti con lo stesso prodotto, senza estetica di pannello tecnico. Rispettare contrasto, modalità scura/chiara ove presenti e accessibilità.
- **Dispositivi:** verificare almeno larghezze 320 e 390 px per modifiche mobili pertinenti, senza sovrapposizioni o scorrimento orizzontale non necessario; controllare pulsante Indietro, tastiera, focus e stato dei comandi.
- **Attenzione:** evitare conferme ridondanti. Conferme esplicite sono invece inderogabili per salvataggi persistenti rilevanti, modifiche sensibili, invii esterni e operazioni di sicurezza secondo i contratti esistenti.

## 5. Ciclo minimo per ogni intervento

1. **Inquadra il prodotto:** leggere `AGENTS.md`, UX-GOV-01, questa guida e le regole operative pertinenti; descrivere scenario e risultato per il docente.
2. **Progetta prima di costruire:** scegliere il percorso più breve e scrivere le parole che compariranno sullo schermo; verificare coerenza con le sezioni già esistenti.
3. **Implementa senza regressioni:** rispettare modello dati, autorizzazioni, archivio cifrato, backup, privacy, flussi e invarianti.
4. **Verifica su due piani distinti:**
   - **tecnico:** test, invarianti, sicurezza, navigazione, regressioni ed evidenze sull'esatto candidato;
   - **di prodotto:** termini, comprensibilità, gerarchia, uso reale, leggibilità mobile e coerenza tra schermate.
5. **Decidi con revisione umana:** se l'intervento modifica l'esperienza docente, richiedere una revisione visiva/professionale prima di considerarla accettata; documentare **PASS** o **REWORK** e i rilievi. Nessun esito automatico equivale a un'accettazione del docente.
6. **Integra soltanto con autorizzazione distinta:** qualifica, accettazione, integrazione e distribuzione sono decisioni separate. Non pubblicare automaticamente.

Per modifiche esclusivamente interne, dimostrare che non cambiano interfaccia, microtesti, comportamento e percorso. Registrare motivatamente **non pertinente** per la revisione visiva; non creare collaudi manuali inutili.

## 6. Scheda di accettazione nelle richieste di modifica

Ogni richiesta di modifica deve rendere verificabili, in modo proporzionato:

- **Compito docente:** scenario e risultato atteso, descritti senza riferimenti a codice o architettura.
- **Coerenza:** percorso canonico, terminologia e identità del prodotto conservati.
- **Interfaccia:** se cambiata, catture o evidenze delle schermate reali, testi effettivi, azioni e stati (vuoto, caricamento, errore, bozza, salvato); verifica mobile e accessibilità.
- **Controllo del docente:** nessuna decisione o scrittura automatica che eluda conferme richieste; privacy e provenienza quando necessarie.
- **Evidenze:** esiti tecnici e revisione di prodotto **separati**, con stato esplicito: non iniziata / in corso / PASS / REWORK / non pertinente motivato.
- **Impatto:** quali sezioni adiacenti sono state controllate per evitare incoerenze.

Un controllo automatico del lessico può segnalare termini sospetti; **non** può dichiarare da solo la qualità linguistica o pedagogica.

## 7. Applicazione progressiva

Questa regola vale da subito **per i nuovi interventi una volta integrata**. Non obbliga a riscrivere l'intera applicazione in una sola lavorazione: gli elementi preesistenti si correggono con priorità ai percorsi più frequenti e alle schermate toccate.

La PR #197 resta oggetto di revisione specifica, senza assorbire automaticamente questo lavoro. Le anomalie linguistiche e visuali emerse vanno trattate come osservazioni di prodotto, non come malfunzionamenti che i soli test tecnici possono certificare risolti.

La versione canonica del documento è quella integrata nel repository. Eventuali modifiche significative richiedono riesame della decisione di prodotto e aggiornamento tracciabile.
