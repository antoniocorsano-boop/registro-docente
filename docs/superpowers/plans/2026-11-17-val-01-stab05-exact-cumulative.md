# STAB-05 — Qualificazione cumulativa del candidato stabilizzato

## Baseline immutabile
Candidato cacd34eae92cfc46f4d4bdb7462d1eb5e4fa8e44 (#311), orchestrazione ripetibilità b372e7986fd6a0a377325e2c1a864972002e85f5 (#312). Prima prova run 44151150933, artifact 14358758968; prove 2 e 3 run 44155733273, artifact 14360994304 e 14362620887. Tutte 21/21 deterministiche e 10/10 fasi native. Rilievo: durante setup storico in entrambe le repliche il primo focus password non era disponibile; driver ha recuperato con retry non persistente; successive autenticazioni al primo tentativo. Conservare tracce e non confondere il retry di azione UI con una nuova esecuzione del job. Nessuna attestazione universale.

## Matrice nativa cumulativa
Le tre evidenze precommit API36 sono riutilizzate perché stesso SHA e criteri; aggiungere sette casi:
- Beta1 RC2 API36: solo rifiuto negativo dell'archivio incompleto, non migrazione supportata.
- Beta1 RC3 API36, Beta2 RC2 API36/API32: migrazione autorizzata e ciclo DB2 completo (ripristino, cancellazione, nuova configurazione e autenticazione).
- Beta2 RC2 API36 postcommit, API32 precommit/postcommit: arresto attestato, riapertura protetta, integrità fisica/logica, downgrade rifiutato e nuovo consenso ove necessario.
Massimo tre emulatori contemporanei, nessun fail-fast e nessun retry automatico di job. Ogni job verifica l'APK storico originario e checkout esplicito del candidato, con firma effimera e dati sintetici.

## Regressioni
Riattivare i workflow esistenti su candidato esatto: browser generale, compatibilità database con tre sorgenti storici, contratti/security/memory/mobile e compilazione, avvio protetto mirato. Nessuna modifica ai sorgenti, fixture, driver, soglie o criteri. Tutte le evidenze richieste; un esito assente o negativo blocca la qualifica.

## Sicurezza e limiti
Il precedente dossier STAB-05/S sul ramo divergente test/val-01-stab05-cumulative resta un riferimento, non attestazione del candidato corrente. Rivalutare S-R01 (esclusività configurazione DB1), S-R02 (revoca durante migrazione legacy), S-R03 (interoperabilità backup reale), S-R04 (rimozione completa dello storage), S-R05 (regressioni e revisioni). Non considerare chiusi tali rilievi tramite soli PASS cumulativi. Non integrare la correzione separata S-R01a senza nuova qualificazione del candidato modificato. Revisione indipendente e specifica sicurezza obbligatorie prima di qualsiasi attivazione; nessun merge, rilascio o modifica del dispositivo. Le prove non qualificano l'APK di produzione firmato né tutte le configurazioni hardware.
