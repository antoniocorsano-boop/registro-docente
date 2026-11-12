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

## M2c — Prospetto PDF di lavoro (Analisi)

Il PDF viene generato localmente dal prospetto esistente, mantenendo i nominativi oscurati quando Privacy è attiva. Prima della scelta della cartella viene richiesto il consenso esplicito al salvataggio di un documento **non cifrato**. Nome neutro, provider locali, token monouso, limite 32 MiB, scrittura e rilettura SHA-256/lunghezza. Il lettore/writer backup resta distinto e invariato. Le verifiche automatiche simulano il ponte Android, ma non dimostrano l'apertura del file sul dispositivo. La qualifica riguarda solo il prospetto Analisi; le altre funzioni di stampa/condivisione restano fuori da questo incremento. Nessun rilascio o firma stabile.

Correzione M2c: il primo collaudo del prospetto reale non raggiungeva il selettore Android. La composizione usa ora direttamente jsPDF già incluso nella libreria locale, leggendo le righe del prospetto privacy-aware, senza rasterizzare il DOM nascosto. La pagina tecnica iniziale viene eliminata; intestazioni, colonne, righe, nota di lavoro e numerazione sono composte esplicitamente. Le verifiche richiedono contenuto testuale PDF oltre a firma, lunghezza e digest. Il collaudo reale Android resta necessario.

Revisione P2 Unicode: font DejaVu Sans locale con dipendenza esatta 2.37.3 e integrità lockfile; licenza inclusa nella build, entrambi i font presenti byte-per-byte nell'APK. In caso di testo fuori WinAnsi il PDF incorpora il carattere Unicode, verificando i glifi prima di salvare. I caratteri non coperti o fuori BMP sono rifiutati in modo esplicito anziché alterati. Test di estrazione PDF effettiva con due nominativi sintetici (polacco e cirillico), mascherati e non mascherati. Non implica supporto universale a tutti gli alfabeti o script complessi. Nessun caricamento da CDN.

## M4 — Identità Beta e firma stabile (candidato non distribuito)

Il conflitto Android M2→M2c è confermato dal confronto dei certificati debug degli artefatti: chiavi diverse, stessa identità sperimentale. La Beta usa una nuova identità `it.trama.registrodocente`, distinta dalla Prova, e parte da versionCode 10001. La compilazione release non firmata è separata dalla compilazione debug; la CI verifica identità, versione, assenza di debug e firma, asset locali e regole di esclusione del backup automatico. Nessuna chiave del titolare passa in GitHub Actions.

**Firma una tantum, in ambiente locale sotto il controllo del titolare:** creare un archivio PKCS12 con alias `registro-docente` usando keytool o Android Studio; conservarlo in due copie protette, fuori dal repository. Usare SDK Android build-tools 36.0.0 e lo script `sign-beta-locally.sh` con APK non firmato, SHA-256 atteso dal manifesto qualificato, archivio chiave locale, destinazione APK firmato; per gli aggiornamenti passare anche il precedente APK firmato. Le password sono richieste localmente dal firmatario, mai inserite in chat o nella riga di comando. Non usare una chiave debug o condivisa. Conservare SHA-256 del certificato pubblico e APK firmato precedente per la continuità. Non pubblicare prima dei gate.

**Migrazione:** non disinstallare la Prova. Installare la Beta firmata a fianco della Prova; configurare l'archivio protetto nella Beta e ripristinare il backup cifrato dimostrativo già verificato. Verificare classe Prova M2 e PDF, poi un secondo APK con versionCode maggiore e la medesima firma. Solo in seguito valutare la qualifica Beta 1. Le impostazioni di backup Android non sostituiscono la prova reale; non attestano il comportamento di ogni OEM. Niente dati scolastici reali durante i test.
