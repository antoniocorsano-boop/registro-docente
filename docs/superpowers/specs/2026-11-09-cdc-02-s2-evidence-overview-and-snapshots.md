# CDC-02/S2 — Quadro valutativo, confronto e fotografie delle evidenze

Data: 9 novembre 2026. Stato: specifica incrementale e prima implementazione S2a sulla PR #173, ora riconciliata con le correzioni S1 UX #176, senza autorizzazione a integrare.

## Dipendenze e regole

- Baseline originaria S1 `731aa092df27f6f27bbc5378795739c80bfef998`; composizione corrente su S1 UX `48a7eaee4539dd959242639feccd232a07eafa7a`, non ancora fusa in main. L'eventuale fusione di S2 richiede prima accettazione e integrazione governata di S1.
- S1 conserva identità/anno/classe/data/tipo della seduta; non conserva ancora fotografie delle evidenze.
- I voti di prova restano autoritativi in `ClassData.grades`; le proposte del docente restano in `CouncilAssessment`. Nessun dato derivato è un voto attribuito o una decisione del Consiglio.
- Non aggiungere nuove chiavi del Vault né cambiare formato dei backup senza test di compatibilità e decisione separata. Nessuna trasmissione remota o contenuto personale nel repository.

## Incrementi distinti

### S2a — Quadro essenziale di consultazione (questo ramo)

Calcolo deterministico, in sola lettura, per anno scolastico, classe e data limite esplicitamente visibili. Valori: totale alunni, studenti con/senza almeno una prova numerica valida, numero di prove numeriche, con/senza voto di ingresso **salvato**. Le prove non numeriche non diventano zeri, le bozze di voti non diventano valori salvati. Anno canonico e limite temporale obbligatori; data oltre il 31 agosto dell'anno selezionato ricondotta esplicitamente a tale confine. Duplicazioni ID studente, anno/data invalidi bloccano il riepilogo.

Il quadro si apre sulla classe esplicitamente scelta e compare prima del tabellone esistente. L'utente deve leggere chiaramente **dati correnti, non fotografia storica della seduta**. La prima colonna fissa del tabellone e lo scorrimento interno restano invariati. Non modifica archivi, prove, proposte, sedute, flussi di salvaguardia o importazione.

### S2b — Fotografia datata della seduta (futura, richiede gate S2a)

Al comando esplicito del docente, associare alla seduta selezionata una versione minima, congelata e verificabile del quadro delle evidenze, comprendente criteri di calcolo, data limite, anno/classe, data di acquisizione e versione del contratto. Il congelamento non è implicito all'apertura della seduta. Preferire riepilogo aggregato e riferimenti minimizzati; decidere separatamente se e quali dati per studente siano indispensabili, prima di introdurre un nuovo campo nel Vault.

Quando i dati originari cambiano, mostrare affiancati quadro storico e quadro attuale, con differenza spiegata, senza modificare automaticamente la fotografia approvata. Definire politica di nuova versione esplicita (mai sovrascrittura silenziosa). Validazione stretta in lettura/ripristino e avviso prima di restauri che eliminino fotografie già salvate.

### S2c — Confronti intermedia/finale (futura)

Confrontare soltanto fotografie confermate o proposte salvate comparabili e identificare chiaramente: periodi, date limite, metodo di calcolo, popolazione d'origine e popolazione confrontabile. Indicare ingressi/uscite dalla popolazione; evitare classifiche o interpretazioni automatiche dei progressi individuali. Distinguere differenze aritmetiche da giudizi didattici.

### S2d — Filtri e proposte indipendenti (futura)

Filtri per senza prove e senza proposta; valorizzazione distinta di ingresso, intermedia e finale in `CouncilAssessment` con azioni e persistenza esplicite. Le fasce vanno indicate come classificazione analitica modificabile secondo i criteri d'istituto, non come standard normativo.

## Verifiche e accettazione S2a

1. Prove con dati sintetici: assente, NC, voto numerico, voto successivo alla data limite, voto fuori anno, classe senza alunni, date impossibili.
2. Identità classe e alunni e quadri di ingresso/intermedia indipendenti; conteggi complementari quadrano al totale iscritti.
3. Nessun salvataggio o mutazione generata dal solo quadro; l'indicazione del cutoff effettivo è corretta anche consultando anni precedenti.
4. Chromium mobile con vista leggibile e nominativi fissi nel tabellone invariato; regressioni CDC-01/S1, import/ripristino e sicurezza.
5. Qualificazioni e revisione indipendente exact-SHA; un eventuale collaudo umano è successivo a un ambiente isolato verificato, senza dati reali.

## Gate

- PR S2a originale #173 in bozza e dipendente da `feat/cdc-02-s1-sedute-archivio`; il candidato di riconciliazione da S1 UX resta autonomo, in bozza, senza merge né deploy.
- Prima della promozione: S1 qualificata/accettata e integrata in main, confronto del diff, test ed eventuali correzioni, decisione esplicita di promozione S2a.
- Le sezioni S2b/S2c/S2d non vengono dichiarate realizzate dalla sola presenza di questo documento.
