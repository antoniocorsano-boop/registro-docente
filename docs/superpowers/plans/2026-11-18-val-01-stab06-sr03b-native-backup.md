# STAB-06/S-R03b — Copia reale Android, migrazione e ripristino
Base #316: 98c11753ca1736310348d9ad9659d446f58682be; 6/6 job, 1474/1474 security, 216/216 browser PASS. Nessuna modifica al codice applicativo. Collaudo isolato sul candidato esatto della nuova PR.

## Perimetro
Android 12/API32 e Android 16/API36, predecessore originale Beta2 RC2 (10004), artefatto 14200343425/run 43811185219 e firma CI effimera; stesso UID e prima installazione. Solo emulatore con dati sintetici. La copia viene creata dall'interfaccia reale Privacy, tramite ACTION_CREATE_DOCUMENT, salvataggio Downloads, rientro e nuova autenticazione. Il driver legge i byte solo per attestare l'evidenza; non crea copie, non usa adb push, non chiama i grant del prodotto.
La diagnosi CI read-only confronta tutti e dieci i dataset, v2/v6, checkpoint e attestazione android-readback con SHA-256 effettiva. La stessa copia fisica è selezionata attraverso SAF per migrare DB1 e poi ripristinare DB2 dopo creazione di una seconda classe tramite UI. Il ripristino non importa la ricevuta locale. Ogni operazione richiede consenso e nuova autenticazione; verificare riavvio dopo migrazione e dopo ripristino. Conservare solo evidenze sintetiche, conteggi e impronte; non distribuire APK o file cifrati.

## Gate
Nove stage per API, tutti obbligatori; impronta del file identica in export, migrazione, ripristino e verifica finale; 10 dataset autentici, readback esatto, destinazione effettivamente modificata, protezione al riavvio. Preflight driver/process esistente prima dell'emulatore. Nessuna ripetizione completa dei collaudi precedenti in questa fase. Nessun PASS anticipato.
Rimangono la qualificazione cumulativa finale sul candidato esatto, recupero senza archivio (S-R04), revoca setup, concorrenza storica, revisione indipendente. Nessun merge, rilascio, installazione su dispositivo reale o modifica dei dati dell'utente.
