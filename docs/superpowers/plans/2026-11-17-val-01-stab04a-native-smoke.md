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

## Correzione P2 — verifica del processo
Prima esecuzione 44110018205, SHA 20550b297e9206096e7ab7bf58ed249821cf30ef: driver 14/14, API32/36 verdi; entrambi gli emulatori hanno completato setup, inserimento password, creazione classe, riapertura e autenticazione senza retry del driver. Review P2: adb shell concatena argomenti, quindi il precedente sh -c pidof non verificava il package. Non usare quel PASS come evidenza della morte effettiva del processo. Correzione comune smoke e interruzione: comando remoto unico con package validato, status reale pidof esplicito; ammettere soltanto PID numerici con exit 0 o inventario vuoto con exit 1; rifiutare output malformato, errori di trasporto e status incoerenti. Osservare PID attivo prima dell'unico force-stop e due campioni vuoti consecutivi dopo; nello smoke osservare nuovo processo attivo prima dell'accesso. Nessuna ripetizione force-stop. Gate JSON richiede le evidenze PID in entrambe le procedure. Sette nuove prove rapide (inclusa esecuzione shell controllata, errore trasporto, reappearance e deadline), quindi due smoke reali. La prova di interruzione resta sospesa sino a STAB-04b. Rilievo da chiudere soltanto a nuova qualifica e review positive.
