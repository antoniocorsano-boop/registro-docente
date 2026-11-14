# B4.2 — Collaudo Android isolato del candidato Beta 2

Baseline applicativa qualificata: PR #244, `5aed586347f1cb8a34ab5e333c7e7007f2f7e60c`, 8/8 workflow e revisione indipendente senza rilievi. Il ramo B4.2 contiene soltanto confezionamento di laboratorio e questo piano. Nessun merge main, rilascio, migrazione o modifica dei dati. Identità separata `it.trama.registrodocente.lab.b42`, etichetta Registro Docente - Collaudo B4.2, versionCode 10004. Firma debug; nessuna firma stabile. Backup automatico Android e trasferimento dati disabilitati. Se Android rifiuta il pacchetto, fermarsi, non rimuovere app o aggirare protezioni. Solo archivio sintetico; non importare copie reali.

## Sequenza unica sul dispositivo

| ID | Operazione | Criterio |
|---|---|---|
| B42-01 | Creare classe sintetica con due nominativi fittizi; aprire Tabellone Oggi. | Conferma voto con tocco, tipo prova al primo voto, comportamento, nessuna scrittura involontaria. |
| B42-02 | Navigare Riepilogo, Tabellone, Analisi, Biblioteca e UDA; gesto Indietro e pulsante di sistema. | Ritorno all'origine corretta, nessun ritorno anomalo a home, bozze protette, root non esce; tastiera e finestre gestite. |
| B42-03 | Aprire Copilota in Riepilogo/Biblioteca; cambiare schermata; Registra → Attività UDA. | Assente nelle viste escluse; nessun pannello residuo; accesso contestuale nel fascicolo utilizzabile, ritorno al diario senza perdita. |
| B42-04 | Bloccare, riaprire e riavviare, anche offline. | Dati sintetici conservati; protezione attiva; nessuna finestra di backup forzata. |
| B42-05 | Avviare esportazione, annullare selettore; poi esportare in cartella di prova. | Annullamento senza attestazione; copia verificata, indicatore coerente dopo riapertura. |
| B42-06 | Inserire altra registrazione. | Nuova registrazione salvata; copia da aggiornare. |
| B42-07 | Provare file o password di prova errati; annullare prima di sostituire archivio. | Nessuna sostituzione; errore chiaro. |
| B42-08 | Solo archivio di laboratorio, confermare ripristino copia sintetica precedente; riaprire e riesportare. | Dati checkpoint corretti, nessuna falsa attestazione ereditata, nuova copia verificata. |

Registrare PASS/FAIL/NOT RUN e solo evidenze sintetiche, SHA sorgente, SHA256 APK. Il ripristino reale su altro dispositivo e l'aggiornamento con firma proprietaria sono prove distinte. Nessun PASS fisico dedotto da compilazione o Chromium. Il Copilota remoto non è incluso nel pacchetto locale. Il collaudo visuale può produrre rilievi separati; non aprire ulteriori sviluppi prima di conoscere esito B4.2.
