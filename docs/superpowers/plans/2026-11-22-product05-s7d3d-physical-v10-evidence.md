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

## Rilievo fisico confermato — Android API 32 e 36 (22 novembre 2026)

La prima esecuzione [GitHub Actions #45028137336](https://github.com/antoniocorsano-boop/registro-docente/actions/runs/45028137336) ha restituito Chromium PASS e **Android API 32 FAIL / API 36 FAIL**. Entrambe le prove native arrestano realmente il processo emulato dopo un primo commit sintetico e, alla riapertura, rilevano lo stato `quarantined` anziché `consistent-synthetic-lab`.

La seconda esecuzione di diagnosi [#45028611201](https://github.com/antoniocorsano-boop/registro-docente/actions/runs/45028611201) ha confermato su ENTRAMBE le versioni:
- origine WebView: `https://localhost`;
- coppia registro/ricevuta cifrata **presente** in IndexedDB, con un record (`recordCount:1`);
- IV e testo cifrato ancora rappresentati correttamente come `Uint8Array` e `ArrayBuffer`;
- testimone sperimentale in `localStorage` **non verificabile** dopo riavvio (`witness:unverifiable`, nessuna versione autorevole disponibile);
- esito applicativo: **quarantena corretta**, nessun falso riconoscimento di backup ufficiale.

**Decisione:** stato tecnico S7d.3d = `BLOCKED_NATIVE_DURABLE_WITNESS`, non PASS complessivo. Non si modifica il protocollo per accettare un archivio senza intestazione fidata; non si qualifica la V10 professionale.

### Lavoro correttivo richiesto prima di S7d.3e
1. Definire un testimone di avanzamento su Android che sia realmente durevole **anche dopo arresto immediato del processo**, con rilettura indipendente prima di attestare il commit. Verificare se una conservazione nativa con conferma esplicita e recupero conservativo sia praticabile; non assumere che `localStorage` sia sufficiente.
2. Conservare la distinzione tra **durabilità locale** e **protezione anti-rollback**. Una seconda base IndexedDB, SharedPreferences o un file nativo possono essere durevoli, ma non per questo non riportabili indietro insieme ai dati. Servono evidenze ulteriori per una radice di fiducia realmente indipendente.
3. Ripetere i collaudi reali API 32/36 con guasto subito dopo ogni scrittura, arresto dell'app e ripartenza, includendo verifica dell'assenza del testimone, impatto sui dati e divieto di retry implicito.
4. Confrontare i limiti reali del dispositivo con Android Keystore / StrongBox senza presumerne disponibilità o protezione della cronologia applicativa. Fonti: https://developer.android.com/privacy-and-security/keystore ; https://source.android.com/docs/security/features/keystore/implementer-ref .
5. Solo dopo PASS nativo motivato, svolgere selezione fisica SAF V10, revisione indipendente e qualificazione cumulativa. Nessuna fusione di questa PR nello stato corrente.

Le prove Chromium 9/9 e i 42 contratti V10 superati restano valide **solo nei rispettivi perimetri**. I due FAIL Android sono evidenze negative canoniche, non successi da ignorare.
