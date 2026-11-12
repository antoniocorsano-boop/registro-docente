# MOBILE-01/S0 — involucro Android sperimentale

**NON È UN RILASCIO** e non è destinato a dati di studenti. L'applicazione di prova `it.trama.registrodocente.prova` viene costruita esclusivamente sui runner GitHub. Il codice dell'app rimane nel frontend Vite; **nessun server Node/Express** viene incorporato nel telefono.

- `package.json`: versioni specifiche Capacitor 8.6.0, indipendenti dal package/lock del Registro.
- `capacitor.config.json`: WebView con `webDir=../../dist`, nessun URL di distribuzione.
- `.github/workflows/mobile-01-android-probe.yml`: costruzione debug senza chiavi segrete, verifiche, archivio SHA-256 del commit e del pacchetto.
- La firma debug è temporanea: **non consente di promettere aggiornamenti senza perdita dati** tra esecutori.
- **HPR Android 11/11 REWORK:** l'APK precedente si avvia su telefono, ma lo screenshot rivela la barra di stato sovrapposta all'intestazione e «Gestisci» accostato ai titoli lunghi. Il nuovo candidato usa gli inset CSS nativi di Capacitor 8 per l'intestazione e il menu e distingue il nome di classe dalla sua descrizione, senza modificare i dati. **La correzione deve ancora essere verificata su APK ricostruito, e non rappresenta un PASS umano.** Tracciamento: issue #216.
- **M1 riconciliata:** PDF `html2pdf.js@0.10.1` e avvisi licenza inclusi in `assets/public/vendor` senza dipendenza CDN; nessun caricamento Google Fonts. Il workflow controlla **il contenuto effettivo dell'APK byte per byte**. Questo prova l'inclusione della libreria, non il salvataggio del PDF in Android.
- Il browser Android e il WebView Capacitor hanno archivi IndexedDB con origini differenti; passaggio dati solo tramite esportazione/ripristino cifrato, ancora da verificare sul dispositivo.
- Tutte le API Express/Gemini restano non incluse e devono degradare in modo sicuro quando offline.

**Per Beta 1:** asset e PDF locali, autenticazione locale, backup file Android, navigazione/Indietro, stabilità su aggiornamento e firma di rilascio sono attività future obbligatorie; vedasi issue #207 e #204.

## M2a — Prova di esportazione del backup Android

Il candidato introduce un selettore di documenti Android locale e un plugin che scrive soltanto il backup già cifrato, poi lo rilegge e restituisce una ricevuta di lunghezza/SHA-256. La vista Privacy aggiorna lo stato del backup solo dopo la ricevuta verificata. Annullamento, errore, bridge assente e interruzione non attivano il download Blob nativo e non attestano successo. Logging Capacitor disattivato. Destinazioni inizialmente limitate a Download e memoria locale Android, dimensione massima 32 MiB. La compilazione non attesta il salvataggio su un telefono, il ripristino o la persistenza del Vault: occorrono prove reali con dati sintetici prima della Beta 1. Tracciamento #215.

## M2b — Recupero di un documento cifrato

Il selettore Android apre soltanto documenti locali autorizzati. Il lettore nativo verifica dimensione (32 MiB), codifica e struttura dell'involucro cifrato, e restituisce il testo e l'impronta; il frontend confronta la ricevuta, autentica con il motore AES-GCM esistente e richiede conferma prima del ripristino transazionale già previsto. Nessuna password passa al codice Java. Le copie cifrate storiche senza versione sono ammesse dal lettore, mentre l'importazione dei JSON non cifrati rimane disponibile soltanto nel percorso browser esistente. La prova Chromium con ponte simulato deve verificare salvataggio, password errata, annullamento e ripristino di una classe sintetica. **Non equivale a una prova Android reale.**
