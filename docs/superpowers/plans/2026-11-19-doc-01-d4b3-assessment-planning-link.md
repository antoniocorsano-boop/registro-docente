# DOC-01/D4b3 — Raccordo tra programmazione, UDA e valutazione

19 novembre 2026. LAB / SYNTHETIC_ONLY / NO_RUNTIME. Base #364 `6cbf1a7c81c6f911179267ade3845eaa748d1264`, 11/11 controlli PASS, 132 invarianti. Revisione indipendente non registrata; non blocca il laboratorio, resta requisito di promozione e rilascio. Nessuna modifica al candidato congelato #325.

## Compito professionale
Nel riesame della programmazione annuale o del contributo disciplinare al Consiglio il docente può selezionare criteri e strumenti attesi, collegarli esplicitamente alle UDA selezionate e distinguere obiettivi locali da riferimenti curricolari istituzionali. Nessun nuovo percorso di navigazione o interfaccia in questa fase.

## Contratto
- Riutilizzo D4b2, D2b1 e D3a. Estensione opzionale della fonte di programmazione con graph/selection/links. Il contratto D4b2 senza estensione resta valido. Fonte esplicitamente assente distinta da selezione non valida.
- Grafico professionale senza evidenze individuali, selezione attesa esplicita e validazione nativa D3a. Non proiettare gli esiti o le date effettive, livelli di rubriche o osservazioni. Obiettivi locali legati ai criteri come riferimenti locali, mai come obiettivi ufficiali Arena; non inferire equivalenza, copertura o competenze acquisite.
- Collegamenti dichiarati dal docente fra identificativi delle UDA e revisioni delle verifiche già selezionate; nessun collegamento per somiglianza, titolo o data. Rifiutare elementi estranei, duplicati, decisioni non confermate. Esposizione tramite indici nell'anteprima, non identificativi sorgente.
- Rivedere l'esatta versione e le dipendenze D3a, comprese rubriche non visualizzate. Modifiche delle fonti o dei collegamenti invalidano irreversibilmente l'istanza già confermata.
- Test sintetici esclusivamente. Non attestare privacy dei testi liberi, adozione istituzionale, completezza, approvazione collegiale, salvataggio o autenticazione. I documenti individuali D3b e il contratto produttivo strutturato Arena restano separati.

## Sequenza causale OR-002
1. RED: mantenere invariato il codice applicativo D4b2, introdurre il nuovo file di 8 prove e registrare l'invariante DOC-01-D4B3-I01 (133 attese); ottenere l'esecuzione e il fallimento per il requisito mancante, non per errori del compilatore o dell'ambiente.
2. GREEN: implementare la minima estensione dopo l'acquisizione del RED effettivo; eseguire qualificazione cumulativa sul nuovo SHA. Non modificare le asserzioni per farle passare.
3. Riesame del risultato e degli ambiti residui. Nessun merge, deploy, dati reali, firma, esportazione o persistenza.

## Ricevuta RED e implementazione GREEN
RED exact SHA `d6771b57616440bdd8fbf5f022e19954b6f19b28`, Qualification Invariants run 44550583345 / job 135652905174, step Run inherited invariant contracts. 1260 PASS, 6 FAIL su 1266 test; tutti i fallimenti appartengono alla nuova suite e riportano INVALID_SOURCE nell'accettazione dell'estensione non implementata. 2 test negativi della nuova suite già verdi. Nessun altro fallimento nel gate. Quattro workflow complessivi falliti sul RED, sette superati; il RED causale è attestato dal log del gate Invarianti, non dal mero stato dei workflow.
GREEN implementato in `9f36f9e6fccd98838c00b6c20d5ebfa1f90ef028` senza modificare le otto prove: estensione opzionale del contratto D4b2, riuso D3a per validazione e isCurrent delle dipendenze, proiezione dei soli target locali e dei collegamenti espliciti alle UDA, mantenimento della distinzione missing/invalid e delle conferme specifiche di revisione. Verifica cumulativa sul nuovo head ancora necessaria. Nessuna attestazione di completezza o approvazione ufficiale; resta da integrare il contratto produttivo strutturato Arena e da progettare la gestione individuale protetta.
