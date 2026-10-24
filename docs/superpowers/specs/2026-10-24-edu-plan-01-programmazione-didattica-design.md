# EDU-PLAN-01 — Programmazione didattica madre guidata

## Intent

Costruire in Registro Docente una capability teacher-first per progettare la programmazione annuale a partire da fonti con autorità diversa, mantenendo il docente come autorità finale della programmazione operativa.

La capability deve permettere di:

1. selezionare ordine scolastico, livello/classe e disciplina secondo il quadro italiano del primo ciclo;
2. proporre il monte ore ordinamentale quando esiste un valore nazionale disciplinare, oppure dichiarare esplicitamente quando esso è definito dall'istituzione scolastica;
3. collegare privatamente il libro di testo tramite ISBN e caricare la guida docente e altri materiali personali;
4. consumare il curricolo di istituto proveniente da Arena tramite snapshot/versione governata, senza creare una seconda autorità curricolare in Registro Docente;
5. costruire una doppia mappa `Curricolo Arena ↔ Libro/Guida`;
6. proporre un numero contenuto di UDA annuali con motivazione, fonti, ore, dipendenze e collocazione temporale;
7. creare una **programmazione madre per livello** e derivarne istanze per le singole classi;
8. aggiornare la programmazione madre in modo versionato, selezionando le classi destinatarie e applicando merge automatici solo quando non esistono conflitti reali;
9. confrontare programmazione prevista, disponibilità temporale reale e avanzamento effettivo.

La capability non deve trasformare il libro di testo in autorità curricolare, né trasformare una proposta automatica in programmazione approvata senza decisione del docente.

---

## Perché

La programmazione annuale richiede oggi al docente di combinare manualmente almeno cinque fonti diverse:

- quadro normativo e monte ore;
- curricolo di istituto;
- libro di testo adottato;
- guida docente/materiali editoriali;
- calendario, orario e andamento reale delle classi.

Queste fonti non hanno la stessa autorità e non sempre coincidono. Un buon ambiente di progettazione deve rendere esplicite le differenze, aiutare a comporle e lasciare traccia delle decisioni, senza appiattire tutto in una generazione AI opaca.

---

## Autorità e precedenza delle fonti

### 1. Arena — autorità curricolare

Arena resta l'autorità sul **curricolo di istituto**. Registro Docente consuma un contratto/snapshot curricolare versionato e non modifica il curricolo alla fonte.

Il contratto legacy `CurriculumSnapshot v1` resta una superficie di compatibilità; la capability deve essere progettata in modo da poter consumare la futura superficie canonica `CurricoloSnapshot v2` senza accoppiare il dominio applicativo ai nomi legacy.

Ogni snapshot deve conservare almeno:

- identificatore/versione;
- provenienza Arena;
- stato di approvazione/governance;
- data o riferimento di validità;
- ordine scolastico;
- livello/coorte;
- disciplina;
- elementi curricolari rilevanti.

Se Arena espone un curricolo non ancora definitivamente approvato, Registro Docente può usarlo per elaborare una bozza, ma deve mostrarne lo stato e non rappresentarlo come approvato.

### 2. Normativa/ordinamento — vincoli di riferimento

Il profilo ordinamentale fornisce i vincoli nazionali pertinenti:

- ordine scolastico;
- livello/classe;
- disciplina;
- modello orario quando pertinente;
- monte ore nazionale disciplinare quando previsto;
- fonte normativa e versione.

Quando non esiste un monte ore nazionale vincolante per la disciplina, l'interfaccia deve dichiarare: **"Monte ore disciplinare definito dall'istituzione scolastica"** e richiedere il quadro orario locale.

Il valore normativo non deve essere sovrascritto da un assetto locale. Devono essere conservati separatamente:

- riferimento nazionale;
- configurazione dell'istituto;
- situazione reale della classe.

### 3. Libro di testo — fonte contenutistica

Il libro descrive contenuti, sequenza editoriale e riferimenti utili. Non determina automaticamente il curricolo né il numero delle UDA.

L'ISBN identifica l'edizione/volume quando disponibile e supporta la creazione della scheda bibliografica.

### 4. Guida docente — fonte metodologica e progettuale

La guida può contribuire con:

- obiettivi proposti;
- prerequisiti;
- metodologie;
- attività;
- laboratori;
- verifiche;
- tempi indicativi;
- proposte inclusive;
- collegamenti tra capitoli e attività.

Anche la guida resta fonte, non autorità curricolare.

### 5. Docente — autorità finale della programmazione

Il docente approva, modifica, divide, unisce, sposta, elimina o integra le UDA candidate. Nessuna proposta automatica diventa programmazione madre senza una decisione esplicita.

---

## Approcci considerati

### A. Libro-first

Il sistema parte dall'indice del libro, raggruppa capitoli in UDA e verifica successivamente la corrispondenza con il curricolo.

**Vantaggio:** molto vicino al modo in cui molti docenti iniziano concretamente a programmare.

**Rischio:** il libro diventa implicitamente dominante e può nascondere lacune curricolari.

### B. Curricolo-first

Il sistema parte dagli elementi del curricolo Arena e cerca successivamente nei materiali editoriali le fonti utili.

**Vantaggio:** massima aderenza curricolare.

**Rischio:** la programmazione può risultare poco naturale rispetto al materiale realmente usato in classe.

### C. Composizione guidata a doppia mappa — scelta

Il sistema costruisce due mappe indipendenti:

- **mappa curricolare:** ciò che deve essere coperto;
- **mappa editoriale:** ciò che libro/guida rendono disponibile.

Successivamente produce corrispondenze, lacune, coperture parziali e contenuti opzionali. Solo dopo propone le UDA.

Questa è la direzione scelta perché mantiene chiara la gerarchia delle fonti, supporta la pratica reale del docente e rende spiegabile ogni proposta.

---

## Modello concettuale

```text
Profilo normativo/versione
        |
        v
Ordine + livello + disciplina
        |
        +---------------------+
        |                     |
        v                     v
Curricolo Arena         Biblioteca privata
(snapshot/versione)     Libro + Guida + fonti
        |                     |
        +----------+----------+
                   v
          Doppia mappa guidata
                   |
                   v
           UDA candidate annuali
                   |
                   v
        Programmazione madre vN
                   |
        +----------+----------+
        |          |          |
       2A         2B         2C
        |          |          |
 personalizz.  personalizz.  personalizz.
        |          |          |
        +----------+----------+
                   v
      previsto ↔ svolto ↔ proiezione
```

---

## Oggetti di dominio proposti

### `NormativeProfile`

Rappresenta il riferimento ordinamentale versionato.

Campi concettuali:

- `schoolOrder`
- `gradeLevel`
- `subject`
- `schoolYear`
- `nationalWeeklyHours?`
- `nationalAnnualHours?`
- `nationalHoursDefined: boolean`
- `sourceRef`
- `version`
- `validFrom/validTo?`

### `LocalTeachingAllocation`

Rappresenta l'eventuale adattamento locale senza cancellare il riferimento normativo.

- disciplina;
- ore settimanali/annuali locali;
- motivazione o nota;
- provenienza (`institution`, `teacher_override`);
- data/versione.

### `PrivateTeachingResource`

Risorsa privata del docente.

Tipi iniziali:

- `textbook`
- `teacher_guide`
- `personal_material`

Metadati possibili:

- ISBN;
- titolo;
- autore;
- editore;
- edizione;
- volume;
- anno;
- file privato associato;
- indice/struttura estratta;
- stato dell'analisi.

I contenuti caricati restano per uso personale del docente e non diventano automaticamente distribuibili a studenti o altri utenti.

### `CurriculumSourceSnapshot`

Adapter locale del contratto Arena, non nuova autorità.

Deve conservare:

- snapshot/versione;
- stato Arena;
- elementi curricolari;
- provenance;
- mapping verso ordine/livello/disciplina.

### `CurriculumCoverageMap`

Per ogni elemento curricolare registra:

- `covered`
- `partially_covered`
- `uncovered`

con riferimenti alle fonti editoriali candidate e motivazione.

### `EditorialCoverageItem`

Per ogni contenuto rilevato nel libro/guida registra:

- capitolo/sezione/pagine o riferimento equivalente;
- nuclei/argomenti;
- attività proposte;
- eventuali tempi;
- corrispondenze curricolari;
- stato: `required_support`, `optional_extension`, `unmapped`.

### `MasterProgram`

Programmazione madre per una combinazione almeno di:

- anno scolastico;
- ordine;
- livello;
- disciplina;
- profilo normativo;
- snapshot curricolare Arena;
- fonti editoriali selezionate.

È sempre versionata.

### `MasterProgramVersion`

Snapshot immutabile della programmazione madre approvata in un determinato momento.

Contiene:

- UDA ordinate;
- budget ore;
- margine;
- finestre temporali;
- dipendenze;
- provenance delle decisioni;
- copertura curricolare;
- riferimenti libro/guida;
- stato (`draft`, `approved`, `superseded`).

### `ClassProgramInstance`

Istanza della programmazione madre per una classe concreta.

Conserva:

- `masterProgramVersionId` adottata;
- override locali;
- stato di avanzamento;
- ore reali disponibili;
- ore svolte;
- divergenze dalla madre;
- aggiornamenti madre disponibili/non applicati.

---

## Biblioteca privata e trattamento delle fonti editoriali

### ISBN

L'ISBN è un identificatore bibliografico, non una licenza di accesso ai contenuti.

Il sistema può usarlo per assistere la compilazione dei metadati dell'edizione, ma non deve assumere che l'ISBN autorizzi download, recupero o ridistribuzione del testo.

### File del docente

Libro, guida e materiali personali caricati devono essere trattati come **fonti private**.

La capability può estrarre una rappresentazione utile alla progettazione, per esempio:

- indice;
- capitoli;
- titoli/sezioni;
- concetti;
- attività;
- riferimenti pagina;
- tempi suggeriti;
- relazioni tra contenuti.

La rappresentazione strutturata deve conservare la provenance alla fonte.

### Non-goal

Non è obiettivo di EDU-PLAN-01 creare una biblioteca pubblica di libri, condividere PDF editoriali, esporre interi testi agli studenti o trasformare contenuti privati in risorse pubbliche.

---

## Doppia mappa Curricolo ↔ Libro/Guida

Prima della generazione delle UDA il sistema deve costruire una matrice spiegabile.

Esempio:

| Elemento curricolare Arena | Libro/Guida | Stato | Azione |
|---|---|---|---|
| Nucleo A | cap. 2 + attività guida 2.3 | Coperto | usa come base |
| Nucleo B | cap. 4 parziale | Parzialmente coperto | proponi integrazione |
| Nucleo C | nessuna corrispondenza | Non coperto | proponi UDA/risorsa esterna |

Regole:

1. Se Arena richiede un elemento non coperto dal libro, **Arena prevale**.
2. Il sistema segnala la lacuna e propone un'integrazione.
3. Se il libro propone contenuti non richiesti dal curricolo, questi restano disponibili come **ampliamento facoltativo**.
4. I contenuti opzionali non consumano automaticamente budget annuale.
5. Ogni mapping deve mostrare provenienza e livello di confidenza/necessità di revisione umana.

---

## Generazione delle UDA candidate

La generazione è una proposta, non un atto autoritativo.

Ogni UDA candidata deve spiegare almeno:

- perché esiste;
- quali elementi Arena copre;
- quali sezioni del libro utilizza;
- quali attività della guida possono supportarla;
- ore proposte;
- finestra temporale suggerita;
- prerequisiti/dipendenze;
- carattere `essential`, `consolidation` o `optional_extension`;
- eventuale lacuna editoriale da colmare.

### Principio di parsimonia

Il sistema non deve trasformare ogni capitolo in una UDA.

Deve preferire **poche UDA sostanziali e leggibili** a una frammentazione eccessiva. Più capitoli possono concorrere alla stessa UDA quando appartengono allo stesso nucleo progettuale.

Il numero di UDA non è fissato a priori: deriva da copertura curricolare, budget orario, struttura dei contenuti e dipendenze didattiche.

---

## Budget didattico e margine

### Quattro misure distinte

Per disciplina/classe devono essere distinguibili:

1. **monte ore ordinamentale**;
2. **monte ore teorico dell'assetto locale/orario**;
3. **ore effettivamente disponibili** dal calendario reale;
4. **ore effettivamente svolte**.

### Riserva annuale

Default iniziale:

`budget UDA = ore effettivamente disponibili × 85%`

quindi **15% di margine**, modificabile dal docente.

Il margine è una riserva intenzionale per:

- rallentamenti;
- verifiche/recuperi;
- attività d'istituto;
- sospensioni impreviste;
- differenze tra classi;
- necessità emergenti.

Non deve essere riempito automaticamente da approfondimenti opzionali.

### Avvisi

La UI deve rendere evidente quando:

- le UDA eccedono il budget programmabile;
- la riserva si riduce significativamente;
- la copertura curricolare obbligatoria non è completa;
- l'inserimento di un ampliamento facoltativo riduce eccessivamente il margine.

---

## Calendario reale

La programmazione deve usare date e ore effettive, non solo mesi astratti.

Il calendario deve conoscere almeno:

- inizio lezioni;
- termine primo periodo;
- inizio secondo periodo se pertinente;
- termine lezioni;
- orario settimanale della classe;
- sospensioni/festività note;
- eventuali eccezioni locali disponibili.

Le UDA possono avere una finestra temporale e milestone rispetto alle date reali.

Il Gantt mensile esistente può rimanere come vista sintetica, ma non deve essere la sorgente primaria del calcolo temporale della nuova capability.

---

## Programmazione madre per livello

Una programmazione madre appartiene al livello, non alla singola sezione.

Esempio:

`Tecnologia · Classe seconda · a.s. 2026/27`

può essere adottata da `2A`, `2B`, `2C`.

L'adozione crea per ciascuna classe una `ClassProgramInstance` legata alla versione madre adottata.

La classe può poi divergere localmente senza modificare la madre.

---

## Versionamento e propagazione controllata

Ogni variazione significativa della madre genera una nuova versione proposta.

Prima di applicarla, il docente seleziona esplicitamente le classi destinatarie.

Esempio:

```text
Programmazione madre v2
[x] 2A
[x] 2B
[ ] 2C
```

La 2C può restare sulla configurazione precedente o adottare l'aggiornamento successivamente.

Nessuna propagazione automatica a tutte le classi è ammessa.

---

## Merge madre → classe

Il merge deve essere a tre vie, concettualmente basato su:

- versione madre originariamente adottata dalla classe;
- nuova versione madre;
- stato/personalizzazioni locali della classe.

### Modifiche non conflittuali

Quando madre e classe hanno modificato elementi differenti, il sistema può proporre/applicare automaticamente il merge.

### Conflitti reali

Quando madre e classe hanno modificato lo stesso elemento incompatibilmente, la UI deve mostrare il confronto e chiedere la decisione del docente.

Esempi di conflitto:

- stessa UDA spostata localmente e spostata diversamente nella madre;
- ore della stessa UDA modificate in entrambi i rami;
- UDA rimossa dalla madre ma già svolta/parzialmente svolta nella classe;
- stessa dipendenza modificata in modo divergente.

### Regola di sicurezza

Attività già svolte, evidenze già registrate e storia reale della classe non devono essere cancellate da un aggiornamento della madre.

---

## Provenance e spiegabilità

Ogni decisione/proposta significativa deve poter rispondere a domande come:

- "Perché questa UDA è stata proposta?"
- "Quale parte del curricolo copre?"
- "Da quale capitolo o attività della guida deriva?"
- "Perché sono state assegnate 8 ore?"
- "Perché è collocata prima della fine del primo periodo?"
- "Questa modifica arriva dalla madre o è specifica della 2C?"

La provenance minima deve distinguere:

- normativa;
- Arena;
- libro;
- guida;
- proposta automatica;
- decisione del docente;
- override locale di classe.

---

## Esperienza utente principale

### Fase A — Profilo

Da **Strumenti → Programmazione didattica**:

1. anno scolastico;
2. ordine scolastico;
3. livello;
4. disciplina;
5. modello orario se pertinente;
6. monte ore proposto;
7. eventuale override locale.

### Fase B — Fonti

1. collega libro tramite ISBN/metadati;
2. carica privatamente guida docente;
3. aggiungi eventuali materiali personali;
4. seleziona snapshot curricolare Arena pertinente.

### Fase C — Mappa

Il sistema presenta:

- coperture;
- coperture parziali;
- lacune;
- contenuti opzionali;
- eventuali ambiguità da confermare.

### Fase D — Proposta annuale

Il sistema propone poche UDA motivate e verifica:

- copertura curricolare;
- budget;
- riserva;
- dipendenze;
- primo periodo;
- termine anno.

### Fase E — Revisione docente

Il docente:

- modifica;
- unisce/divide;
- sposta;
- cambia ore;
- aggiunge/rimuove approfondimenti;
- approva la programmazione madre v1.

### Fase F — Adozione classi

Il docente seleziona le classi che adottano la programmazione madre.

### Fase G — Esecuzione e scostamento

Per ogni classe l'app confronta:

- previsto;
- svolto;
- ore residue;
- scostamento;
- proiezione di completamento.

---

## Stati principali

### Curricolo Arena

Almeno:

- `draft/unapproved`
- `approved/active`
- `superseded`

I nomi concreti devono adattarsi al contratto Arena effettivo; Registro Docente non deve inventare uno stato di approvazione non fornito dalla sorgente.

### Programmazione madre

- `draft`
- `approved`
- `superseded`

### Istanza di classe

- `aligned`
- `locally_modified`
- `update_available`
- `merge_conflict`

---

## Guardrail

1. **Arena authority:** Registro Docente non modifica il curricolo di istituto.
2. **No hidden authority:** libro, guida e AI non possono prevalere silenziosamente su Arena.
3. **Human approval:** nessuna programmazione madre viene approvata automaticamente.
4. **Private materials:** libro/guida caricati restano privati.
5. **No silent propagation:** le modifiche alla madre richiedono selezione esplicita delle classi destinatarie.
6. **No destructive merge:** la storia reale di una classe non viene cancellata da un aggiornamento.
7. **Explainability:** ogni UDA proposta deve essere riconducibile alle proprie fonti.
8. **Calendar realism:** il budget usa ore effettivamente disponibili quando il calendario/orario è disponibile.
9. **Reserve protection:** gli ampliamenti facoltativi non consumano automaticamente il margine.
10. **Normative provenance:** ogni dato precaricato deve conservare fonte/versione e poter essere aggiornato senza riscrivere retroattivamente programmi già approvati.

---

## Non-goal iniziali

- distribuzione agli studenti dei PDF editoriali;
- marketplace o biblioteca condivisa di libri;
- generazione automatica non revisionata di una programmazione definitiva;
- modifica del curricolo Arena da Registro Docente;
- riempimento automatico di tutto il monte ore;
- sincronizzazione automatica distruttiva madre → classi;
- definizione di un unico numero fisso di UDA per disciplina/anno;
- sostituzione del giudizio professionale del docente.

---

## Relazione con il modello UDA esistente

L'attuale `UdaRecord` lega già UDA a classe, ore, periodo, mese iniziale, durata, lezioni e dipendenze. EDU-PLAN-01 deve evolvere questo modello senza confondere:

- UDA **di programmazione madre**;
- UDA **istanziata per classe**;
- attività/lezioni **realmente svolte**.

La nuova capability deve inoltre separare il nuovo **peso di programmazione** dall'attuale indice interno delle attività UDA. Il peso di programmazione riguarda capacità annuale, rilevanza curricolare, complessità e dipendenze; non è un credito, un voto o un indice di competenza.

---

## Principi per il peso di programmazione

Non introdurre un punteggio opaco `0–100` come sorgente di decisione.

Il sistema deve spiegare il peso usando componenti leggibili:

- ore necessarie;
- rilevanza curricolare;
- complessità didattica;
- dipendenze/continuità.

Categorie iniziali suggerite:

- `essential`
- `consolidation`
- `optional_extension`

Queste categorie aiutano l'allocazione del budget, ma il valore operativo principale resta il **tempo previsto**.

---

## Criteri di accettazione di prodotto

La capability è coerente con questo design quando un docente può:

1. configurare livello e disciplina senza dover conoscere manualmente il monte ore nazionale quando esso è normativamente determinato;
2. vedere chiaramente quando il monte ore disciplinare è invece definito localmente;
3. collegare un'edizione tramite ISBN e caricare privatamente la guida;
4. importare/leggere un curricolo Arena versionato senza modificarlo;
5. vedere la matrice di copertura curricolo ↔ libro/guida;
6. distinguere elementi coperti, parzialmente coperti e scoperti;
7. vedere i contenuti editoriali opzionali senza che questi entrino automaticamente nel budget;
8. ottenere una proposta annuale con poche UDA motivate;
9. conservare almeno il 15% di riserva di default, salvo modifica esplicita;
10. approvare una programmazione madre per livello;
11. adottarla su più classi;
12. modificare la madre e scegliere a quali classi proporre/applicare la nuova versione;
13. applicare automaticamente modifiche non conflittuali;
14. risolvere esplicitamente conflitti reali;
15. preservare attività/evidenze già svolte nelle classi;
16. confrontare previsto, svolto e proiezione rispetto a fine primo periodo e fine anno;
17. ricostruire la provenienza di ogni UDA e delle principali decisioni di pianificazione.

---

## Decisioni già assunte

- Programmazione madre **per livello**, non per singola classe.
- Le classi derivano dalla madre ma possono divergere localmente.
- Gli aggiornamenti della madre sono selettivi per classe.
- Merge automatico solo per modifiche non conflittuali.
- Risoluzione guidata dei conflitti reali.
- Libro e guida sono **fonti private per uso personale**.
- Arena prevale sul libro per la copertura curricolare.
- Contenuti editoriali non richiesti restano ampliamenti facoltativi.
- Approccio scelto: **composizione guidata a doppia mappa**.
- Margine annuale iniziale: **15%**, modificabile.
- Nessun numero fisso di UDA imposto a priori.
- Il calendario reale e l'orario della classe devono determinare la capacità effettiva.
- Quando il monte ore disciplinare nazionale non è definito, il sistema lo dichiara e usa il quadro locale.

---

## Decisioni lasciate all'implementazione, senza cambiare il prodotto

Un builder può scegliere, purché rispetti i contratti sopra:

- struttura tecnica dell'indice privato dei documenti;
- algoritmo concreto di similarità/matching tra fonti;
- UI esatta della matrice di copertura;
- forma visuale del diff madre ↔ classe;
- storage fisico degli snapshot e dei mapping;
- strategia di migrazione dal modello UDA corrente;
- soglie precise degli avvisi oltre al margine default del 15%;
- formato tecnico del futuro adapter `CurricoloSnapshot v2`.

Queste scelte richiederanno un piano di implementazione separato dopo approvazione del design.
