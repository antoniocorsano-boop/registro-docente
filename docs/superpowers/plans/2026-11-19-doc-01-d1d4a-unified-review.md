# DOC-01/D1d4a — Composizione unitaria delle fonti
19 novembre 2026. Base #352 1ab6bc9810506c6a32dbee7ccdee04e38908b113, 7/7 qualificata. Proposta D1d4 sul dossier #171, commento 7000451161. Linea di laboratorio indipendente da #325 e #347.

## Contratto e scelte
Un unico contesto indipendente (istituto, coorte, classe, anno, disciplina, grado, regime, periodo) e lista ridotta delle identità delle classi, senza roster. Il contesto deve essere valido anche se tutte le fonti mancano. L'orchestratore deriva i tre sotto-contesti e richiama i validatori D1d1/d2/d3, senza accettare risultati di fonte precostituiti. Nessun trasferimento tra archivi, nessuna lettura autonoma o connessione a Vault, App o interfacce reali.

Una fonte non selezionata è missing (null); una fonte selezionata non valida è review-required e blocca la conferma. Le altre fonti restano consultabili. Almeno una fonte disponibile e nessuna non valida permettono la conferma parziale, mai la completezza. Non si asserisce che una fonte non selezionata sia inesistente nel sistema. Una nuova selezione richiede nuova revisione.

La vista espone soltanto anno e periodo, stato, numero riferimenti curricolari, numero UDA e ore programmate selezionate (non riferite al periodo consuntivo), numero e ore delle registrazioni selezionate con copertura selected-only. Non espone ID, riferimenti interni, testi, impronte o ricevute. Obiettivi disciplinari e trasversali, modalità di verifica e strategie restano esplicitamente non compilati: i contratti correnti non autorizzano derivazioni. Non dedurre attività svolte da ore programmate, non calcolare rapporto di completamento, non convertire codici di laboratorio D1b/c in contenuti reali.

La conferma richiede una nuova ispezione del contesto e di tutti gli stati; confronto del risultato Docente OS con hash e data di accettazione già validati; revisione privata esatta di Arena e delle registrazioni tramite isCurrent. Cambio di fonte, selezione o contesto invalida la conferma; la modifica di una registrazione non selezionata non attesta né altera la copertura del consuntivo parziale. Modello di presentazione immutabile. Conferma effimera, non firma, approvazione o salvataggio, sempre official:false e complete:false.

## Evidenze
Nove scenari contrattuali sintetici predisposti prima dell'implementazione; stub 10d797ea530a5d83e0f55f03ed54eb6b19e785a6, implementazione 9e014aef80f3ee114f547856e36820f637417f94. Non eseguita suite canonica sullo stub: non dichiarare RED/GREEN. Invariante DOC-01-D1D4A-I01, 99 complessive previste. Verificare sulla revisione esatta tutte le procedure, senza modifica ai gate.

## Passo successivo
D1d4b: vista isolata compatta con dati sintetici e revisione esplicita, riduzione scorrimento/avvisi duplicati, provenienza su richiesta, lacune raggruppate, 320/390px e testo 200%. Raccordo con modelli istituzionali prima dell'uso operativo. Nessun dato reale, esportazione, IA, persistenza, merge, deploy o costo.