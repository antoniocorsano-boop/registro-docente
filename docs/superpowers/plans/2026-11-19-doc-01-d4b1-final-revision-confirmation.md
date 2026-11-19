# DOC-01/D4b1 — Revisione e conferma del consuntivo

19 novembre 2026. LAB / SYNTHETIC_ONLY / NO_RUNTIME. Base D4a #362 `d97896018650cd8df2156b156db9561975f54a0b`: 11/11 PASS, 130 invarianti. Riesame indipendente non registrato.

## Decisioni e motivazione
- Prima incrementazione D4b: programma svolto e relazione finale, riuso esclusivo di D4a e D3c. La proposta D4a deve essere valida e il contesto, la classe, i riferimenti istituzionali, il modello selezionato e il periodo devono coincidere esattamente con D3c. Anteprima derivata dal produttore, non contenuto fornito dal chiamante.
- Il programma svolto contiene solo le lezioni registrate selezionate (almeno una), senza verifiche o sintesi nascoste. La relazione finale include le fonti e la sintesi selezionate in D3c. Nessuna attestazione di completezza o modello ufficiale.
- Conferma distinta dalla selezione delle fonti: richiesta esplicita del docente, identificativi documento/revisione e anteprima esatta. Una conferma è valida soltanto per la specifica istanza di riesame. Il contenuto non viene mutato. Una nuova revisione parte in bozza anche se il testo è identico.
- Stato in memoria: bozza, confermato, da riesaminare, revocato. Rilevato un cambiamento della storia, contesto, contenuto o dipendenza della fonte (anche criterio non visibile), l'istanza non può tornare confermata, neppure ripristinando i dati precedenti. Revoca esplicita riferita al documento e alla revisione, terminale.
- Nessuna garanzia di unicità tra istanze, cronologia persistente, identità autenticata o testa autorevole. Il chiamante deve fornire lo stato corrente: non si rileva automaticamente una modifica non comunicata. La revoca non è retroattiva su copie e non è conservata oltre l'istanza; D4c dovrà garantire atomicità e persistenza delle transizioni prima dell'uso reale.
- Restano separati D4b2 (programmazione e contributo disciplinare generale) e il percorso riservato individuale D3b. Non introdurre un generico contenitore di testo che aggiri i contratti delle fonti.

## Qualificazione
Nove prove sintetiche predisposte prima del modulo (commit `834cf9e73d3eeaaa6cd39f492dad466c4cac42d7`); RED canonico non eseguito. Invariante DOC-01-D4B1-I01, 131 attese. CI exact-SHA e riesame indipendente richiesti. Nessuna UI, dato reale, firma, persistenza, export, merge o deploy.
