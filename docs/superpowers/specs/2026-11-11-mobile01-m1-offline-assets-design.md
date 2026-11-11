# MOBILE-01/M1 — Risorse offline per PDF e caratteri

**Decisione di prodotto:** mantenere invariata la generazione del prospetto tramite html2pdf.js 0.10.1, sostituendo solo il modo con cui è fornita al browser. Evitare nuove dipendenze applicative, conservare licenze dei terzi e non dichiarare in anticipo il salvataggio su Android. Issue [#212](https://github.com/antoniocorsano-boop/registro-docente/issues/212) sotto [#207](https://github.com/antoniocorsano-boop/registro-docente/issues/207).

## Perimetro

- Bundle browser UMD `public/vendor/html2pdf.bundle.min.js` e `.LICENSE.txt`, acquisiti dal tag sorgente **v0.10.1** di `eKoopmans/html2pdf.js` con confronto di identità blob Git: `c57dc9292239c50312222b91f45613b5cb93518c` e `7cc52ed18f3e7f0e8b62ae003872b5031ea80635`.
- `index.html` carica il bundle mediante percorso locale `/vendor/html2pdf.bundle.min.js` e non richiede Google Fonts. `src/index.css` adotta `system-ui` con sostituti del dispositivo.
- La logica `AnalyticsView.handleExportPDF` resta invariata. Non introdurre un falso PDF o chiamate automatiche a provider remoti.
- Niente download/CDN **durante l'uso** o **durante la build** per queste risorse: il file è versionato nel repository. Vite lo include in `dist/vendor`.
- Android debug S0 di PR #208 resta separato: M1 qui qualifica anzitutto la build browser. La presenza nel vero APK e il salvataggio/visualizzazione file Android vanno verificati nel successivo esperimento con Capacitor.

## Qualificazione

Il contratto `mobile01M1OfflineAssetsContract.test.ts` controlla provenienza/licenze, riferimenti locali, mantenimento generatore PDF e assenza URL esterni. Un test Chromium specifico con rete verso terzi **bloccata** deve generare un PDF reale e confrontarne i byte iniziali `%PDF-`, senza dati personali. Il gate è registrato nell'invariante `MOBILE-01-M1-I01`.

**Non qualifica:** salvataggio di file nel WebView Android, backup cifrato, archivio dopo aggiornamento, output tipografico perfettamente identico, firma release o Copilota autonomo offline. Questi temi restano in M2–M5 e UX-QA-03.
