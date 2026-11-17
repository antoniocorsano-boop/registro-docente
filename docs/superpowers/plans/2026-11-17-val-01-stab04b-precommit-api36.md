# STAB-04b — Recupero precommit Android 16
Base immutata: PR #305, 4b75b6f5e5ecd39d61fa626b00a29eaba3739221; run 44124347463, driver e due smoke positivi. Il presente passo non integra #305 in main e non modifica il codice applicativo.

## Perimetro
Un solo caso: Beta2 RC2 originale (ddbf60781514b866b09e1fa1e014e6a6fc3989d3, run 43811185219, artifact 14200343425), aggiornamento in-place al candidato CI, API36, interruzione prima del commit DB1→DB2. Riutilizzare il workflow prodotto esistente, con controllo sintassi e prove deterministiche del driver/probe come prerequisito. APK e chiave temporanei, dati esclusivamente sintetici. Nessuna pubblicazione, nessun dispositivo reale.

## Criteri vincolanti
- Origine verificata e identità di installazione conservata.
- Archivio iniziale completo (10 record); copia verificata e autorizzazione esplicita; checkpoint versionchange reale; unico force-stop con PID attivo e due osservazioni consecutive di assenza.
- Nuovo processo, schermata Sblocca Registro, archivio non esposto, trace STAB-01 osservabile prima dell'autenticazione. Non ripetere autenticazioni né intervenire sullo storage per ottenere un PASS.
- Dopo autenticazione: DB1, stesso digest fisico, chiavi e snapshot; riapertura con APK storico; migrazione soltanto dopo nuova lettura e nuovo consenso; DB2 con digest invariato; downgrade rifiutato; riapertura finale DB2.
- Esito strutturato con sequenza esatta delle fasi; diagnostica di bootstrap e archivio in sola lettura su errore. Nessun retry indiscriminato, nessun ripristino automatico, nessuna cancellazione dell'archivio.
- Conservazione dei soli allegati diagnostici sintetici; distruzione APK di laboratorio e chiave.

## Decisione
PASS del caso singolo non equivale a qualificazione cumulativa né a revisione specifica sicurezza. Prima di STAB-05 esaminare le evidenze del caso e il diff. Se fallisce, classificare la causa prima di qualsiasi rilancio. Nessun merge o rilascio.