# DOC-01/D4c3c1 — Conservazione della successione documentale nel recupero (laboratorio)

19 novembre 2026. Base esatta D4c3b GREEN `45562e1fc92daecf8039af140343bb55a24ac20a`, PR #372. Redazione e riesame distinti: le prove sui backup v6/v7 impediscono perdita ma non li abilitano a conservare DOC-01.

## Scopo
Qualificare una **proiezione di recupero isolata** prima di introdurre formati nuovi e operazioni DB2. La conservazione delle revisioni e delle revoche è requisito inderogabile. Nessuna operazione di ripristino fisico né accesso ai dati reali.

## Contratto D4c3c1
- Confrontare `current`, `incoming`, `recovery` tramite `validateDocumentHistory` indipendente e scope approvati. Nessuna consultazione di fonti attuali né autorità dedotta dal digest.
- La copia di recupero fornita deve coincidere esattamente con il documento corrente, come controllo preparatorio; non certifica la lettura di bytes cifrati. Il futuro D4c3c2 controllerà origine e readback.
- Una nuova storia è ammissibile soltanto se contiene la sequenza corrente completa come prefisso immutato. Nessuna perdita, riorganizzazione, revoca omessa, rettifica retroattiva, o riassegnazione di identità.
- Nessuna riscrittura a recupero identico. Risultato soltanto immutabile e distaccato; senza I/O e senza ricevuta di successo.
- RED causale di nove nuove prove; nuova invariante DOC-01-D4C3C1-I01.

## Confini successivi
Versionamento di backup non deciso, compatibilità DB2 / backup Android ancora da qualificare. Nessun nuovo formato v8 reale, conversione automatica, UI, merge, deploy, firma, attestazione di autenticazione o ripristino. Retention e cancellazione governata separatamente. Revisione indipendente prima della promozione.
