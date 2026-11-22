# VAL-01 / PRODUCT-05 / S7d.3d — Prove fisiche del laboratorio V10
Data: 22 novembre 2026. Base esatta PR #407 `a7924cfe93bafecd6e5f64f4553d0a696ad85533`.

## Scopo e confine
La fase S7d.3d collauda su un vero motore Chromium e su emulatore Android API 32/36 la persistenza dei **soli contratti S7d.3a–3c**, senza connetterli al salvataggio professionale. La compilazione della fixture usa il codice applicativo V10 e uno spazio di prova isolato: non legge dati scolastici, non genera un APK Beta, non installa l'app corrente e non pubblica nulla.

## Archivi effettivi del laboratorio
- **IndexedDB**: due versioni sintetiche della ricevuta (registro + metadati AES-GCM), salvate con transazione `readwrite` reale e confronto dello stato precedente; lettura e conferma dopo chiusura della transazione.
- **localStorage**: registro sperimentale dell'avanzamento, *NON* testimone autonomo a monotonicità protetta. Lo stato «assenza accertata» è scritto solo dalla procedura di pulizia del laboratorio e non ricavato dall'assenza di un file.
- **Chiave cifrante e identificativi costanti**: valori fittizi presenti soltanto nella fixture. Nessuna protezione crittografica della chiave o anti-rollback è attestata da questo esperimento.
- **Browser**: avvio di Chromium reale con Playwright, ricaricamento dell'intera pagina, controlli di risultato, prove di interruzione e screenshot sintetico.
- **Android**: pacchetto debug dedicato `it.trama.registrodocente.lab.v10`, WebView effettiva sul dispositivo emulato, controllo via protocollo di debug isolato, `adb am force-stop`, verifica dell'arresto e riavvio; nessuna installazione sul telefono dell'utente.

## Sequenza e prove
1. Identità applicativa sperimentale, archivio sintetico vuoto per controllo esplicito.
2. Primo commit V10 e rilettura dopo ricaricamento pagina o arresto completo del processo Android.
3. Secondo commit e conservazione dell'ordine/versione.
4. Ripristino di una sola coppia di ricevute senza il relativo riferimento: quarantena.
5. Perdita del contenitore o del riferimento di avanzamento: quarantena.
6. Errore simulato **dopo** il commit fisico di IndexedDB ma **prima** della conferma: blocco e successiva quarantena.
7. Ripristino simultaneo e coerente dei due archivi: situazione non rilevabile. Va registrata come **lacuna**, non come attestazione di protezione.
8. Prove automatizzate e confronto con il candidato Git esatto; raccolta automatica degli esiti per piattaforma.

## Cosa NON viene dimostrato
Non sono attivati:
- Backup V10 professionale o ripristino di dati reali;
- Copia V10 scelta tramite il selettore nativo di documenti Android o archivio web dell'utente;
- Un testimone anti-rollback hardware, remoto o duraturo sotto responsabilità indipendente;
- Persistenza transazionale incrociata fra due tecnologie di memorizzazione;
- Qualificazione PREDEPLOY completa, revisione indipendente o decisione di pubblicazione.

Non si definisce «PASS completo» sulla base delle sole prove fisiche sopra descritte. Il blocco sulla prevenzione del doppio rollback va mantenuto finché non sia dimostrabile su un testimone autonomo di monotonicità.

## Evidenze da registrare
SHA esatto, esecuzione GitHub Actions, numero delle prove, esiti Chromium, Android API32/API36, eventuali guasti e mancanze, anomalie del protocollo, verifica degli artefatti sintetici senza dati personali, scelta conservativa sulla futura integrazione. PR in bozza e nessuna fusione in `main`.
