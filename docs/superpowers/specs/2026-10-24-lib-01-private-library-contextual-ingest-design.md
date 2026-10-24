# LIB-01 — Biblioteca privata e trasformazione contestuale delle fonti

**Data:** 2026-10-24  
**Repository:** `antoniocorsano-boop/registro-docente`  
**Baseline:** `main@d346e1210d780519674a5ea79828a3178b8d37a8`  
**Stato:** READY FOR IMPLEMENTATION PLANNING  
**Ambito:** biblioteca privata del docente, ingresso multimodale, collegamento a UDA/attività/lezioni, progressive disclosure, governance delle trasformazioni

## Intento

Permettere al docente di partire da qualunque materiale utile incontrato nel lavoro reale — una foto, una pagina di libro, un articolo di giornale, un post o una pagina web, un PDF, un documento, un'immagine, un appunto, un collegamento o anche un semplice concetto — e portarlo nel Registro Docente come **fonte privata riusabile**.

Il docente deve poter chiedere al copilota, in linguaggio naturale, di usare quella fonte per il lavoro didattico che sta già svolgendo, ad esempio:

- arricchire una UDA esistente;
- costruire o adattare un'attività;
- preparare una lezione;
- creare una scheda, una traccia, domande guida o materiali di supporto;
- ricavare spunti, concetti, esempi, collegamenti interdisciplinari;
- collegare la fonte a una UDA senza trasformarla subito;
- conservarla per un uso successivo.

La biblioteca non deve diventare un archivio separato che obbliga il docente a interrompere il flusso di lavoro. Deve essere una **memoria privata di fonti**, accessibile sia direttamente sia dal copilota contestuale.

## Problema da risolvere

Il materiale didattico nasce spesso fuori dal Registro: una fotografia scattata durante una visita, un ritaglio di giornale, un post, una pagina web, una risorsa ricevuta da un collega, una schermata, un testo incollato, un'idea annotata al volo.

Un sistema che accetta solo documenti già strutturati costringe il docente a fare prima il lavoro di normalizzazione. Un sistema che mostra subito decine di trasformazioni possibili produce invece sovraccarico cognitivo.

LIB-01 deve risolvere entrambi i problemi:

1. **ingresso libero e rapido** del materiale;
2. **scelta guidata e progressiva** di ciò che il docente vuole farne.

## Principi di prodotto

1. **Teacher-first.** Il punto di partenza è il materiale reale del docente, non la tassonomia del sistema.
2. **Private by default.** Una fonte entra nella biblioteca privata e non diventa automaticamente contenuto condiviso, pubblico o canonico.
3. **Contesto prima delle funzioni.** Se il docente si trova dentro una UDA, una lezione o un'attività, il sistema propone prima gli usi pertinenti a quel contesto.
4. **Progressive disclosure.** Le funzioni avanzate esistono, ma non vengono mostrate tutte contemporaneamente.
5. **Proposta, non mutazione.** Il copilota produce bozze, collegamenti e proposte. Nessuna trasformazione modifica automaticamente UDA, lezioni, valutazioni o altri dati canonici senza conferma esplicita del docente.
6. **Provenienza visibile.** Ogni artefatto derivato deve poter conservare il collegamento alla fonte da cui è nato.
7. **Reversibilità.** Salvare una fonte, collegarla, scollegarla o scartare una proposta non deve compromettere il contenuto originario.
8. **Privacy-first.** Materiali con dati personali o riferimenti a studenti richiedono trattamento esplicito e non devono essere inviati a servizi esterni implicitamente.
9. **No feature wall.** Il docente deve capire cosa può fare, ma vedere solo le opzioni utili al momento.

## Approcci considerati

### A. Biblioteca come sezione autonoma principale

Una pagina ricca con cartelle, etichette, trasformazioni, filtri e strumenti sempre visibili.

**Vantaggi:** grande potenza esplorabile; modello mentale simile a un archivio digitale.  
**Svantaggi:** introduce un nuovo centro operativo, aumenta la complessità dell'interfaccia e separa il materiale dal contesto didattico in cui serve.

**Decisione:** non adottato come esperienza primaria.

### B. Tutto attraverso la chat, senza biblioteca persistente

Ogni allegato vive nella conversazione e viene trasformato al momento.

**Vantaggi:** flusso semplice e immediato.  
**Svantaggi:** scarsa riusabilità, perdita di provenienza e difficoltà nel ritrovare una fonte settimane dopo o usarla in più UDA.

**Decisione:** non adottato.

### C. Modello ibrido: biblioteca privata + copilota contestuale

La fonte viene salvata come oggetto privato riusabile. Il docente può raggiungerla dalla biblioteca, ma può anche caricarla direttamente nel copilota mentre sta lavorando su una UDA, una lezione o un'attività. Le azioni proposte dipendono dal contesto corrente.

**Vantaggi:** mantiene memoria e provenienza senza trasformare la biblioteca in un'applicazione separata; riduce il sovraccarico; favorisce riuso e continuità.  
**Svantaggi:** richiede un contratto chiaro tra sorgente, contesto attivo e trasformazione proposta.

**Decisione:** approccio raccomandato e assunto da LIB-01.

## Modello mentale per il docente

Il docente deve percepire una sequenza semplice:

**Porto dentro qualcosa → scelgo cosa voglio farne → vedo una proposta → decido se usarla → la fonte resta disponibile.**

Il sistema non deve chiedere al docente di classificare tutto prima di poterlo usare.

## Tipi di ingresso

LIB-01 deve prevedere almeno questi ingressi:

- **foto/immagine** caricata o acquisita dal dispositivo;
- **file**: PDF, documenti di testo e formati già supportati dal prodotto;
- **pagina o post web** tramite URL;
- **testo incollato**;
- **appunto breve** scritto direttamente;
- **concetto/idea** espresso in linguaggio naturale;
- **materiale già presente nel Registro** che il docente vuole salvare anche come fonte riusabile.

Il modello dati non deve dipendere da una specifica origine. Tutti gli ingressi diventano una `LibrarySource` con tipo, titolo, provenienza, data, anteprima e stato.

## Contratto `LibrarySource`

La specifica logica minima della fonte deve includere:

- identificatore stabile;
- `kind`: image, file, web, text, note, concept, internal;
- titolo modificabile dal docente;
- data di acquisizione;
- provenienza/origine, quando disponibile;
- URL originario, se applicabile;
- contenuto o riferimento al contenuto conservato;
- estratto testuale derivato, quando disponibile;
- stato di elaborazione;
- collegamenti a UDA, lezioni o attività;
- eventuali artefatti derivati;
- metadati di provenienza;
- indicatore privacy/sensibilità quando necessario.

La fonte originaria deve essere distinta dagli artefatti prodotti a partire da essa.

## Stati della fonte

Stati minimi consigliati:

1. `captured` — materiale acquisito, non ancora elaborato;
2. `ready` — materiale disponibile per ricerca e trasformazione;
3. `needs-review` — estrazione incompleta o dubbia, da verificare;
4. `restricted` — materiale che richiede una decisione privacy prima di uso con servizi esterni;
5. `failed` — acquisizione/elaborazione non completata, con possibilità di nuovo tentativo.

Una fonte deve poter essere salvata anche se l'estrazione del testo non è possibile.

## Ingresso dal copilota

Il composer del copilota deve avere un unico accesso iniziale chiaro, ad esempio **Aggiungi fonte**.

Da lì il docente può scegliere o trascinare il materiale. Dopo l'acquisizione non va mostrato un pannello con tutte le trasformazioni disponibili.

Il primo messaggio operativo deve essere contestuale:

> **Che cosa vuoi farne?**

Se esiste un contesto attivo, le prime azioni devono riferirsi a quel contesto.

Esempio dentro una UDA:

- **Usala in questa UDA**
- **Crea un'attività da questa fonte**
- **Prepara materiale per una lezione**
- **Salvala soltanto in biblioteca**
- **Altre possibilità**

Esempio fuori da una UDA:

- **Crea un'attività**
- **Ricava idee didattiche**
- **Collegala a una UDA**
- **Salvala in biblioteca**
- **Altre possibilità**

Il testo libero resta sempre possibile: il docente può ignorare i suggerimenti e scrivere direttamente, ad esempio «Usa questa foto per preparare un'attività di osservazione per la 2C».

## Progressive disclosure

Le funzionalità devono emergere per livelli.

### Livello 0 — ingresso

Il docente vede soltanto:

- campo di conversazione;
- comando di aggiunta fonte;
- eventuale indicazione del contesto attivo.

### Livello 1 — azioni principali

Dopo l'aggiunta di una fonte vengono mostrate **3–4 azioni contestuali ad alta probabilità** e `Altre possibilità`.

### Livello 2 — trasformazioni avanzate

Solo dopo `Altre possibilità` o una richiesta esplicita diventano disponibili funzioni come:

- scheda studente;
- domande guida;
- attività laboratoriale;
- discussione/debate;
- sintesi e parole chiave;
- adattamento per diversi livelli;
- verifica formativa;
- compito autentico;
- collegamenti interdisciplinari;
- rubrica/criteri;
- materiale per spiegazione;
- traccia per presentazione;
- estensione o recupero;
- proposta di collegamento a competenze/obiettivi già presenti nel contesto autorizzato.

Queste funzioni non devono comparire come una griglia permanente nell'interfaccia principale.

### Livello 3 — rifinitura della proposta

Quando il docente sceglie una trasformazione, il sistema può porre o inferire solo i parametri necessari: classe, durata, livello, formato, uso individuale/gruppo, eventuale inclusione. I parametri già noti dal contesto non vanno richiesti di nuovo.

## Contesto didattico

Il copilota deve poter ricevere un `TeachingContext` esplicito e limitato, ad esempio:

- UDA attiva;
- lezione selezionata;
- attività in preparazione;
- classe e disciplina;
- obiettivi già presenti;
- materiali già collegati;
- eventuali vincoli temporali.

Il contesto deve essere visibile al docente con una sintesi breve, ad esempio:

`Stai lavorando su: UDA Energia · 3C`

con possibilità di cambiare o rimuovere il contesto.

Il copilota non deve usare silenziosamente dati non necessari provenienti da altre classi, studenti o sezioni del Registro.

## Trasformazioni come proposte governate

Ogni trasformazione deve produrre un oggetto di proposta separato dal dato canonico.

Esempio concettuale:

`Source → TransformationRequest → DraftArtifact → HumanDecision → CanonicalWrite`

La decisione umana può essere:

- **Usa** — applica/crea il contenuto nella destinazione selezionata;
- **Modifica** — apre la bozza per revisione;
- **Prova un'altra versione**;
- **Salva come materiale**;
- **Scarta**.

La semplice generazione non equivale mai a una scrittura canonica.

## Collegamento con UDA, attività e lezioni

Una fonte può essere:

- collegata a una o più UDA;
- collegata a una specifica lezione;
- usata per generare più artefatti;
- riutilizzata in contesti diversi senza duplicare l'originale.

Il collegamento deve essere semantico e reversibile. Scollegare la fonte da una UDA non cancella la fonte dalla biblioteca.

Quando un artefatto viene applicato a una UDA, il sistema deve conservare almeno il riferimento alla fonte di origine, così il docente può capire da dove proviene il materiale.

## Biblioteca privata — superficie dedicata

La biblioteca esiste, ma deve restare semplice.

Vista iniziale consigliata:

- **Recenti**;
- **Collegate al lavoro in corso**;
- **Da rivedere**;
- ricerca;
- filtro leggero per tipo o UDA.

Ogni elemento mostra solo le informazioni necessarie:

- anteprima/titolo;
- tipo;
- provenienza;
- collegamenti correnti;
- azione primaria `Usa`;
- menu secondario per rinomina, collega, scollega, elimina.

Le trasformazioni avanzate non vanno replicate tutte nella biblioteca: vengono riaperte nel copilota contestuale quando il docente sceglie `Usa`.

## Ricerca e recupero

La ricerca deve poter funzionare almeno su:

- titolo;
- testo estratto;
- note del docente;
- provenienza;
- UDA collegate;
- tipo di fonte.

Una futura ricerca semantica può essere aggiunta senza modificare il modello concettuale, ma non è requisito necessario per la prima versione.

## Materiali web

Per una fonte web devono essere conservati separatamente:

- URL originario;
- titolo;
- data di acquisizione;
- estratto/contenuto disponibile al momento dell'acquisizione;
- eventuale autore/sito, se disponibile;
- stato di accessibilità.

Il prodotto non deve dare per scontato che la pagina resterà disponibile o invariata in futuro. Per questo la trasformazione deve riferirsi alla copia/estratto effettivamente acquisito quando consentito.

## Foto e immagini

Una foto deve poter essere salvata come fonte anche senza estrazione testuale.

Quando viene eseguita analisi visiva o estrazione di testo:

- il risultato derivato non sostituisce l'immagine originale;
- contenuto incerto deve essere marcato come tale;
- il docente deve poter correggere titolo o testo estratto;
- l'uso con servizi esterni deve rispettare il contratto privacy.

## Privacy e dati personali

LIB-01 eredita e rafforza il modello local-first del Registro.

Vincoli:

- nessun caricamento automatico verso provider esterni al semplice salvataggio nella biblioteca privata;
- prima di inviare una fonte a un modello esterno il sistema deve sapere che tale invio è necessario per la richiesta corrente;
- contenuti che possono includere studenti, nominativi, volti, elaborati identificabili o altri dati personali devono attivare un trattamento restrittivo;
- il docente deve poter usare la biblioteca come archivio locale anche senza richiedere trasformazioni IA;
- nessun tracciamento studente;
- nessuna pubblicazione automatica;
- nessuna fonte privata diventa materiale condiviso per implicazione.

L'implementazione dovrà definire il punto esatto in cui avviene l'eventuale trasferimento a un provider IA e mostrare una comunicazione comprensibile quando il contenuto esce dal dispositivo/archivio locale.

## Provenienza e trasparenza

Ogni proposta generata a partire da una fonte deve poter mostrare un'indicazione del tipo:

`Derivato da: Articolo X · acquisito il 24/10/2026`

Se vengono usate più fonti, il docente deve poter vedere quali.

Il sistema non deve presentare come contenuto originario una sintesi o un'interpretazione prodotta dall'IA.

## Azioni suggerite contestuali

Il motore di suggerimento non deve essere una lista statica universale. Deve considerare almeno:

- tipo di fonte;
- superficie corrente;
- presenza di UDA/lezione attiva;
- classe e disciplina note;
- stato della fonte;
- ultimo intento espresso dal docente.

Esempi:

- foto di un oggetto tecnico dentro UDA sui materiali → osservazione, classificazione, attività laboratoriale;
- articolo di attualità dentro UDA energia → discussione, analisi delle fonti, collegamento al tema, domande guida;
- post web fuori da un contesto → ricava idee, collega a UDA, salva;
- documento lungo → sintetizza per la lezione, estrai concetti, crea attività, collega sezioni pertinenti.

Il sistema può suggerire, ma non deve pre-selezionare una trasformazione irreversibile.

## Anti-goal UX

LIB-01 fallisce anche se tecnicamente completo quando:

- la prima schermata mostra decine di pulsanti;
- il docente deve scegliere tassonomie prima di caricare una fonte;
- la biblioteca diventa un file manager complesso;
- il docente perde il contesto didattico mentre usa una fonte;
- un allegato in chat scompare e non è più recuperabile;
- una proposta viene applicata alla UDA senza decisione esplicita;
- il sistema nasconde il fatto che una fonte è stata inviata a un servizio esterno;
- una risorsa privata viene confusa con materiale già approvato o canonico.

## Confini della prima versione

### In scope

- nuova entità privata `LibrarySource`;
- acquisizione dei principali tipi di fonte;
- salvataggio e recupero;
- collegamento a UDA/lezione/attività;
- ingresso fonte dal copilota;
- progressive disclosure delle azioni;
- generazione di bozze governate;
- provenienza fonte → artefatto;
- ricerca semplice;
- contratti privacy e fail-closed.

### Non-goal iniziali

- repository pubblico o marketplace di materiali;
- collaborazione multiutente;
- condivisione automatica tra docenti;
- sincronizzazione cloud obbligatoria;
- indicizzazione semantica remota obbligatoria;
- crawling web generalizzato;
- gestione documentale avanzata con cartelle profonde;
- modifica autonoma del curricolo;
- trasformazioni automatiche senza conferma;
- dati o profili degli studenti come sorgente implicita del copilota.

## Architettura logica proposta

Separare quattro responsabilità:

1. **Library Store** — conserva fonte, metadati, collegamenti e stato;
2. **Content Intake** — normalizza ingressi differenti e produce una rappresentazione comune;
3. **Context Resolver** — espone al copilota solo il contesto didattico pertinente e autorizzato;
4. **Transformation Gateway** — produce bozze/artefatti derivati e richiede una decisione umana prima di una scrittura canonica.

Il `Transformation Gateway` non deve scrivere direttamente nelle collezioni UDA o nelle strutture applicative canoniche.

## Integrazione con persistenza e backup

La biblioteca privata entra nel dominio persistente del Registro e deve rispettare le semantiche durevoli già definite dal progetto:

- nessun falso successo prima del commit;
- pending/failure preservano la possibilità di nuovo tentativo;
- backup cifrato e restore devono includere la biblioteca una volta che l'entità diventa canonica;
- export/restore non devono produrre perdita di fonti o collegamenti;
- eliminazione di una fonte deve essere una mutazione esplicita e durevole.

L'implementazione non deve bypassare `SecureAppStorage` con uno store parallelo non governato.

## Contratto di accessibilità e mobile

Su mobile:

- `Aggiungi fonte` deve essere raggiungibile con un controllo touch-safe;
- l'anteprima non deve occupare permanentemente gran parte del viewport;
- le azioni principali devono restare leggibili senza scorrimento orizzontale;
- `Altre possibilità` deve espandersi in modo reversibile;
- il contesto attivo deve essere visibile ma compatto;
- la chiusura dell'anteprima non deve perdere la fonte già salvata.

Su desktop può essere mostrata più informazione, ma la gerarchia delle azioni deve restare identica.

## Metriche qualitative di riuscita

La prima versione è corretta se un docente può completare questi percorsi senza conoscere l'architettura del sistema:

1. scatta/carica una foto → la usa per proporre un'attività nella UDA aperta → rivede → conferma;
2. incolla un link a un articolo → lo salva → lo ritrova giorni dopo → lo collega a un'altra UDA;
3. carica un documento → chiede «preparami una scheda per questa lezione» → ottiene una bozza senza modifica automatica;
4. scrive un concetto al volo → lo salva come idea → successivamente lo usa per una lezione;
5. apre la biblioteca → capisce subito quali fonti sono recenti, collegate o da rivedere;
6. usa `Altre possibilità` solo quando ha bisogno di funzioni più avanzate.

## Contratti da provare in browser

La qualificazione futura deve includere almeno:

- acquisizione di immagine/file/testo/link;
- persistenza dopo chiusura e riapertura;
- progressive disclosure mobile e desktop;
- corretto binding del contesto UDA;
- nessuna scrittura canonica prima della conferma;
- collegamento/scollegamento senza perdita della fonte;
- failure injection durante salvataggio;
- restore da backup con fonte + collegamenti;
- fonte `restricted` non inviata a provider esterno senza decisione prevista;
- nessun overflow o controllo coperto su viewport mobile di riferimento.

## Suddivisione consigliata in slice

### LIB-A — Domain + durable storage

`LibrarySource`, metadati, collegamenti, persistenza, backup/restore e test di mutazione.

### LIB-B — Intake

Ingresso file/immagine/testo/URL/concetto, anteprima, stati `captured/ready/needs-review/restricted/failed`.

### LIB-C — Library surface

Recenti, ricerca, filtri leggeri, dettaglio fonte, collegamenti e cancellazione.

### LIB-D — Copilota contestuale

Allegato fonte, `TeachingContext`, azioni principali dinamiche, testo libero.

### LIB-E — Progressive disclosure + draft artifacts

Azioni avanzate, bozza governata, provenienza e decisione umana.

### LIB-F — Privacy + provider boundary

Classificazione restrittiva, comunicazione trasferimento esterno, fail-closed.

### LIB-G — Browser qualification

Percorsi integrati mobile/desktop, persistenza, failure injection, backup/restore e assenza di scritture premature.

## Regola finale di autorità

La biblioteca privata amplia ciò che il docente può portare nel sistema e ciò che il copilota può trasformare. **Non amplia l'autorità del copilota.**

Il docente resta l'unico soggetto che decide se una proposta diventa parte di una UDA, di una lezione, di un'attività o di un altro contenuto canonico del Registro.