# DOC-01/D4c2a — Validazione della fotografia documentale storica

19 novembre 2026. Base #366 `751c4595c07bf9339458425c0df8241126a602d1`: gate Invarianti 44587805147, 134 registrate, 1273/1273 prove, 7/7 D4c1. Sei workflow PASS e cinque in corso al momento dell'avvio. L'incremento è isolato, non promuove la base.

## Compito professionale
Il docente deve poter riaprire la copia di un documento confermato nel passato, senza rigenerarla da fonti modificate. La verifica storica non attesta che il documento sia ancora attuale, né autorizza l'uso o il trasferimento dei dati. Il digest SHA-256 non è una firma o prova di autenticità.

## Contratto D4c2a
- `validateHistoricalDocumentRecord(record, approvedScope)` accetta solo il formato V1 D4c1 con marcatori sintetici. Scope professionale indipendente e corrispondenza esatta; non usare il record come unica fonte dell'autorità. Il chiamante reale dovrà ricavare lo scope da un contesto autorizzato, non dal documento da ripristinare.
- Distaccare senza getter, verificare schema chiuso e semantica per ciascuna variante: consuntivo, programma svolto, programmazione annuale, contributo disciplinare. Identità, periodo, classe, modello, revisione, data UTC, indici, conteggi, ore, riferimenti locali, stati di selezione e marcatori di autorità coerenti. Rifiutare proprietà extra anche se il digest viene ricalcolato.
- Conservare il digest canonico D4c1 senza alterare il formato. Validare prima di restituire una copia immutabile; non consultare fonti correnti e non ricalcolare documenti storici. Nessuna attivazione o importazione reale.
- Otto prove RED, stub fail-closed NOT_IMPLEMENTED, invariante DOC-01-D4C2A-I01; 135 invarianti attese. Verificare log prima di GREEN. Sono previste ulteriori prove delle varianti programma svolto, pianificazione con criteri e limiti dei valori numerici prima della chiusura; il corpus iniziale non le attesta tutte.
- D4c2b: collezione storica, unicità, testa autorevole, idempotenza, conflitto, append, rettifica/revoca. D4c3: compatibilità backup/downgrade, transazione appData+meta, cifratura e recuperabilità. Nessun archivio effettivo modificato ora.
- Nessuna modifica UI; nessun dato reale, documento individuale, rete, firma, esportazione, migrazione, merge, deploy. Riesame indipendente richiesto per la promozione.

## Ricevute e chiusura delle varianti
- RED #367 `10d937ef77f125e7dc8e604c6857fa65d72d3f3c`: Invarianti 44588431033, 1278 PASS/3 FAIL; tre fallimenti intenzionali della nuova suite NOT_IMPLEMENTED, cinque prove negative già PASS.
- GREEN #367 `14c747dc0d7497b2874d3710c2e0095f89af5d07`: Invarianti 44593511882, 1281/1281, 8/8 D4c2a, 135 invarianti registrate; 11/11 workflow PASS, nessuna revisione indipendente registrata. Implementazione già presente al momento del nuovo intervento, conservata senza riscrittura.
- Supplemento D4c2a-Q: cinque ulteriori prove di andata/ritorno produttore D4c1 → JSON → validatore D4c2a, programma svolto, valutazione pianificata con gruppi e collegamenti, assenza esplicita, seconda revisione, quantità orarie non ammesse e digest ricalcolato. Scope atteso derivato dalla fixture professionale prima della copia, non dal record. Nessuna modifica al validatore o alle asserzioni precedenti. 1286 prove attese, 135 invarianti (stesso contratto, copertura ampliata). Qualificazione exact-SHA da acquisire prima del dominio collezione D4c2b. Resta esclusa la verifica di autenticità, autorità della testa, continuità inter-record, revoca e persistenza.
