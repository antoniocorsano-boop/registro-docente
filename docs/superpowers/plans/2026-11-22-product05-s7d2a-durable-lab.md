# VAL-01/PRODUCT-05/S7d.2a — Laboratorio convergente con PR #398

Data: 22 novembre 2026. La base autorevole è PR #398 `9c922eb221e32563426526071efb5f1aa07395b1` (S7d.1b). La precedente PR #399 si basava sullo storico S7d.1 privo dei miglioramenti di #398: questa convergenza conserva le evidenze storiche della lavorazione, ma sostituisce il contenuto del ramo con la nuova API e con i controlli S7d.1b. Nessun merge in main.

## Contratto aggiornato
1. Il laboratorio usa la nuova versione `FormativeBalanceHistoryV1` con `version/classId/schoolYear/subjectCode/records`, catena con `contentDigest` e `previousDigest`. Il candidato S7c viene riqualificato con le fonti attuali e il contesto indipendente.
2. La richiesta di append contiene `expectedHeadDigest` che deve coincidere con la testa effettivamente letta dentro la coda condivisa. Revisioni e digest sono validati prima e dopo la proposta.
3. L'adattatore verifica il salvataggio atomico dei dati/metadati e la loro rilettura **solo con un archivio sintetico iniettato**. Errori, revoche o disallineamenti quarantinano la sessione e impediscono false ricevute.
4. La PR #398 rende `SecureAppStorage.saveAppDataAndMeta` esplicitamente non autorizzato per `formativeBalanceHistoryV1`: il laboratorio DEVE verificare il rifiuto, non aggirarlo. La barriera V6–V9 è quella esistente di #398, mantenuta senza duplicazioni.
5. Nessuna modifica a codice di produzione che autorizzi il salvataggio, nessuna estensione di `ClassData/AppData`, nessuna pubblicazione o PDF. I test impiegano soltanto dati sintetici.

## Gate prima della promozione
Occorre realizzare un codec esplicito per una versione successiva dei backup, definire il percorso di migrazione e ripristino conservativo anche Android, poi aggiungere un'autorità di scrittura cifrata che sia ristretto alla sessione docente e convalida l'integrità dello storico e dei dati. Successivamente prova integrale su commit finale, Chromium, Android/DB2, ripristino reale, revisione indipendente e decisione umana. Mai fondere #399 direttamente in main.
