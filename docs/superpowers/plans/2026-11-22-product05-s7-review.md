# VAL-01/PRODUCT-05/S7 — Bilancio formativo: bozza e riesame in Scheda alunno

**Base tecnica:** ramo pulito `integration/val01-main-aligned` sul commit `b16c15d2a4acdc74901bac8656762ac9a9bcab53`, antenati `main@1e9bcd0e` e `PRODUCT-05/1@8dc8d8fc`; in questo modo lo sviluppo segue anche gli ultimi cambiamenti a CI-FAST e PREDEPLOY.

## Contratto
- Visibile soltanto dal Dossier della Scheda alunno, sotto le fonti validate e con protezione riservatezza attiva.
- L'utente seleziona periodo e date effettive, le prove individuali confermate, eventualmente due osservazioni, e scrive testo proprio; nessuna scelta o giudizio automatico.
- Il riesame usa `prepareFormativeBalance`, controlla fonte/ambito/destinatario e restituisce una proiezione destinatario tramite `projectFormativeRestitution` con elenco consentito.
- Conferma esplicita tramite `confirmFormativeBalance`, rilegge l'archivio corrente, rileva versioni obsolete e aggiorna solo stato effimero. Non salva nulla, non produce PDF, non trasferisce voti o dati.
- Cambio alunno, classe, materia, anno e protezione riservatezza smonta la sessione. L'editor segnala la perdita della bozza temporanea. La visibilità dell'anteprima è legata al riferimento applicativo corrente.
- S7b sperimentale ed esportazione istituzionale già in produzione restano distinti: nessuna regressione di navigazione o scheda.
- Qualificazione minima: contratto S7a/S7b, sintesi sicura, privacy fail-closed, CI-FAST, typecheck, build, Chromium 320/390/200%; collaudo generale per eventuale futura integrazione.

**Escluso:** conferma durevole, collegamento contributo Consiglio di classe, invio, PDF, nuova tabella IndexedDB, nuovo formato backup, inferenza sulle competenze, valutazione automatica.

## Verifica browser riproducibile incorporata
La suite autonoma S7 (6 scenari Chromium già superati sul commit 8c3aa82b) è ora conservata in `tests/browser/val01-product05-s7-review.spec.cjs`, con fixture solo sintetica, registrata nell'invariante S7 e invocata dal gate generale `beta2-reference-qualification.yml`. Non dipende dal ramo temporaneo di qualificazione.
