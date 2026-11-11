# MOBILE-01/S0 — involucro Android sperimentale

**NON È UN RILASCIO** e non è destinato a dati di studenti. L'applicazione di prova `it.trama.registrodocente.prova` viene costruita esclusivamente sui runner GitHub. Il codice dell'app rimane nel frontend Vite; **nessun server Node/Express** viene incorporato nel telefono.

- `package.json`: versioni specifiche Capacitor 8.6.0, indipendenti dal package/lock del Registro.
- `capacitor.config.json`: WebView con `webDir=../../dist`, nessun URL di distribuzione.
- `.github/workflows/mobile-01-android-probe.yml`: costruzione debug senza chiavi segrete, verifiche, archivio SHA-256 del commit e del pacchetto.
- La firma debug è temporanea: **non consente di promettere aggiornamenti senza perdita dati** tra esecutori.
- **M1 riconciliata:** PDF `html2pdf.js@0.10.1` e avvisi licenza inclusi in `assets/public/vendor` senza dipendenza CDN; nessun caricamento Google Fonts. Il workflow controlla **il contenuto effettivo dell'APK byte per byte**. Questo prova l'inclusione della libreria, non il salvataggio del PDF in Android.
- Il browser Android e il WebView Capacitor hanno archivi IndexedDB con origini differenti; passaggio dati solo tramite esportazione/ripristino cifrato, ancora da verificare sul dispositivo.
- Tutte le API Express/Gemini restano non incluse e devono degradare in modo sicuro quando offline.

**Per Beta 1:** asset e PDF locali, autenticazione locale, backup file Android, navigazione/Indietro, stabilità su aggiornamento e firma di rilascio sono attività future obbligatorie; vedasi issue #207 e #204.
