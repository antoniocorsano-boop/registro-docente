# B4.3 — Collaudo Android isolato del candidato Beta 2

Baseline applicativa qualificata: PR #248, `eecc8502bd5c9b8a143c44926a6c57596052cb11`, compilazione e revisione indipendente PASS; collaudo comparativo API 32/36 PASS (run 43619792620), artefatto applicativo 14123541005. La qualifica completa sullo SHA finale e la prova fisica restano aperte. Il ramo B4.3 contiene soltanto confezionamento di laboratorio e questo piano. Nessun merge main, rilascio, migrazione o modifica dei dati. Identità separata `it.trama.registrodocente.lab.b43`, etichetta Registro Docente - Collaudo B4.3, versionCode 10005. Firma debug; nessuna firma stabile. Backup automatico Android e trasferimento dati disabilitati. Se Android rifiuta il pacchetto, fermarsi, non rimuovere app o aggirare protezioni. Solo archivio sintetico; non importare copie reali.

## Sequenza unica sul dispositivo

| ID | Operazione | Criterio |
|---|---|---|
| B43-01 | Creare classe sintetica con due nominativi fittizi; aprire Tabellone Oggi. | Conferma voto con tocco, tipo prova al primo voto, comportamento, nessuna scrittura involontaria. |
| B43-02 | Navigare Riepilogo, Tabellone, Analisi, Biblioteca e UDA; gesto Indietro e pulsante di sistema. | Ritorno all'origine corretta, nessun ritorno anomalo a home, bozze protette, root non esce; tastiera e finestre gestite. |
| B43-03 | Aprire Copilota in Riepilogo/Biblioteca; cambiare schermata; Registra → Attività UDA. | Assente nelle viste escluse; nessun pannello residuo; accesso contestuale nel fascicolo utilizzabile, ritorno al diario senza perdita. |
| B43-04 | Bloccare, riaprire e riavviare, anche offline. | Dati sintetici conservati; protezione attiva; nessuna finestra di backup forzata. |
| B43-05 | Avviare esportazione, annullare selettore; poi esportare in cartella di prova. | Annullamento senza attestazione; copia verificata, indicatore coerente dopo riapertura. |
| B43-06 | Inserire altra registrazione. | Nuova registrazione salvata; copia da aggiornare. |
| B43-07 | Provare file o password di prova errati; annullare prima di sostituire archivio. | Nessuna sostituzione; errore chiaro. |
| B43-08 | Solo archivio di laboratorio, confermare ripristino copia sintetica precedente; riaprire e riesportare. | Dati checkpoint corretti, nessuna falsa attestazione ereditata, nuova copia verificata. |

Registrare PASS/FAIL/NOT RUN e solo evidenze sintetiche, SHA sorgente, SHA256 APK. Il ripristino reale su altro dispositivo e l'aggiornamento con firma proprietaria sono prove distinte. Nessun PASS fisico dedotto da compilazione o Chromium. Il Copilota remoto non è incluso nel pacchetto locale. Il collaudo visuale può produrre rilievi separati; non aprire ulteriori sviluppi prima di conoscere esito B4.3.


Priorità assoluta B43-02: ripetere Riepilogo → Tabellone → Analisi → gesto dal bordo destro, senza cambiare configurazione Android. Se fallisce, non qualificare e non introdurre altri cambiamenti senza evidenze. Il laboratorio è un nuovo pacchetto: il PASS emulatori riguarda il candidato applicativo, non l'APK B4.3, che richiede ancora verifica confezionamento e prova fisica. Nessuna modifica stabile, nessuna richiesta di disattivare protezioni Android.
