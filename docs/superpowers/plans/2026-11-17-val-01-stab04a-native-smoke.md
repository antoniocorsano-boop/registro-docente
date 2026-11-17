# STAB-04a — Collaudo Android circoscritto
Base #304 c480ba75da86ee64310fb8e9540629b8cc4a3f1e: 14/14 deterministiche, sintassi PASS, review ordinaria senza rilievi. Questo passo non modifica il codice applicativo.

## Perimetro e gate
Il workflow verifica prima l'esatto SHA del driver, la sintassi e le 14 prove deterministiche. Solo dopo esito positivo avvia due job distinti, API32 (Android 12) e API36 (Android 16), con emulatori isolati. Stesso APK originale Beta2 RC2, fonte ddbf60781514b866b09e1fa1e014e6a6fc3989d3, artifact 14200343425/run 43811185219. Verifica provenienza, checksum, manifest, versione 10004, package, non-debuggability. Firma temporanea di laboratorio; confronto integrale dei file originali non di firma. Nessuna compilazione/installazione del candidato, nessun uso DevTools, nessuna migrazione, ripristino o cancellazione.
1. Configurare esplicitamente ambiente demo e autenticare (una sola conferma).
2. Creare una sola classe sintetica, verificare schermata di gestione e visibilità dopo ritorno alla home.
3. Arrestare il processo, verificare assenza PID.
4. Riaprire e attestare la schermata protetta, senza accesso alla classe prima dell'autenticazione.
5. Autenticare nuovamente (una sola conferma), verificare classe visibile.
6. Confermare stesso UID, firstInstallTime e versione originale. Gate strutturato esatto sulle sei fasi, conteggio delle due conferme di autenticazione, unica creazione, nessun invio ripetuto.
Eventuali retry restano confinati a interazioni UI non persistenti; evidenza di ciascun tentativo e cause dell'errore. Conservare solo dati sintetici e diagnostica priva di credenziali, distruggere firma temporanea e APK di laboratorio. Nessun artefatto installabile pubblicato.

## Decisione successiva
Se entrambe le prove passano e la revisione è positiva, STAB-04b: prova candidata mirata del recupero precommit su API36, con trace bootstrap STAB-01 e driver STAB-03. Solo dopo il suo superamento si procede alla qualificazione cumulativa STAB-05, comprensiva di regressioni e revisione specifica sicurezza. Un fallimento va classificato ed esaminato, non rilanciato indiscriminatamente.
Questo collaudo attesta il percorso di base storico sugli emulatori selezionati; non dimostra ancora stabilità della migrazione, integrità fisica completa dopo hard-stop o comportamento sul dispositivo reale. Nessuna integrazione in main, nessun rilascio.
