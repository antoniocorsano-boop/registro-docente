# MOBILE-01/M2a — Scrittura di una copia cifrata su Android

**Stato:** candidato di implementazione, non qualificato su dispositivo. Issue #215; baseline `main@4e83a60497f1c99de5259df28564dc9322175958`.

## Problema

La vista Privacy genera correttamente un contenitore AES-GCM v2, ma il browser avvia un download con un link Blob e non può dimostrare che il WebView Android lo abbia salvato. Il contatore delle modifiche da esportare non deve essere aggiornato dopo una semplice apertura del selettore.

## Soluzione e confini

- Solo Android nativo: usare il selettore documenti del sistema (`ACTION_CREATE_DOCUMENT`, `CATEGORY_OPENABLE`, richiesta locale). Limitare le destinazioni ai provider Android di memoria locale e Download, senza autorizzazioni generali, URL o percorsi provenienti da JavaScript.
- Primo passaggio: scegliere il nome del file; nessun contenuto cifrato nelle opzioni dell'attività. Il plugin restituisce un token casuale, in memoria, monouso. Non recuperare una selezione interrotta dopo la ricreazione del processo.
- Secondo passaggio: passare esclusivamente l'involucro cifrato AES-GCM v2 già prodotto dal motore esistente. Niente password, snapshot in chiaro, modifica del formato o scritture del Vault dal codice Java. Validare formato e limiti, scrivere, chiudere, riaprire in lettura e confrontare lunghezza e SHA-256. Il frontend confronta la ricevuta con il proprio digest. Logging Capacitor disabilitato. Nessuna trasmissione di rete.
- Solo dopo una ricevuta valida e una vista ancora attiva si chiama l'attuale `onRecordBackupExport(checkpoint)`: il coordinatore di mutazioni rimane l'unico proprietario dello stato backup. Un annullamento, errore, chiusura della vista o ricevuta incoerente non registra un successo.
- Browser ordinario: percorso esistente preservato; non è attestazione di scrittura fisica del browser. Nessun fallback Blob nell'app nativa in assenza del plugin.
- Limite iniziale deliberato di 32 MiB per il passaggio in memoria. Su provider OEM non inclusi nell'allowlist e su file troppo grandi l'operazione deve fallire in sicurezza. Un file vuoto/parziale può rimanere dopo un errore o interruzione; non è attestato come backup e va ignorato.

## Qualificazione

1. Test della boundary TypeScript, cifratura effettiva con dati sintetici, annullamento, assenza plugin, digest/byte errati, vista inattiva e errore di scrittura.
2. Test di contratto su Java, registrazione, workflow, assenza permessi ampi/endpoint, ordine read-back → receipt → aggiornamento.
3. Compilazione APK dal commit esatto e revisione indipendente. Non attribuire un PASS Android alla sola build.
4. **Prova successiva obbligatoria:** su Android con dati sintetici, selezionare Download, salvare, aprire/recuperare la copia, verificare annullamento e persistenza; M2b resta importazione/ripristino e prova reale andata-ritorno. PDF, Vault dopo riavvio, upgrade, firma stabile e UX-QA-03 rimangono aperti.

Riferimenti: https://developer.android.com/training/data-storage/shared/documents-files ; https://github.com/ionic-team/capacitor/tree/8.6.0/android/capacitor/src/main/java/com/getcapacitor . Nessuna distribuzione o dati scolastici reali.
