# PRODUCT-05/S7d.3a — Registro versionato di attestazioni V10 (candidatura isolata)
Data: 22 novembre 2026. Base immutabile: PR #402 @da740b1d718b246cd2ddb07681d9246423f3abb9.

## Oggetto del primo incremento
Modello pure-data di **proposte non ufficiali** di attestazioni V10, ordinate e collegate tramite SHA-256 dei campi canonici. Requisiti: payload V10, fonte fisica Web/Android già verificata nel laboratorio, digest dell'intero snapshot confermato, contatore delle modifiche e momento del controllo; nessun testo individuale nel registro.

Il validatore rifiuta sequenze alterate, salto di progressione, riutilizzo del checkpoint, campi inattesi, letture con accessori, date e impronte errate. La funzione di append richiede il digest dell'intestazione precedente **fornito da fonte indipendente**. Questa richiesta da sola non costituisce protezione dal rollback finché l'intestazione non sia conservata in archivio autenticato e protetto.

## Confine deliberato
- Stato prodotto: `staged-not-official`; una ricevuta `lab-durable-not-official` non è elevabile a certificazione professionale attraverso questo modulo.
- Nessuna modifica a SecureMeta, dieci record cifrati, SecureAppStorage, selezione file, backup attivo, app mobile o interfaccia.
- Rimangono operative le barriere per `formativeBalanceHistoryV1` nel salvataggio canonico e nei formati V6–V9.
- La proposta può essere generata da fixture sintetiche, non implica autenticazione del file o possesso del dispositivo.

## Successione dei lavori prima di qualunque uso professionale
S7d.3b: progettazione e qualifica del contenitore dei metadati per V10, senza convertire `verifiedBackupEvidence` V6 in modo incompatibile; conservazione append-only della testa autenticata e gestione dello stato incerto.
S7d.3c: autorizzazione all'operazione completa, atomica e serializzata con il resto del Vault, con preflight di recupero esatto, rilettura, quarantena e ripristino conservativo.
S7d.3d: verifica fisica su browser reale e Android nativo API 32/36, comprese interruzioni, restore parziale, differenze versione e invalidazione.
S7d.3e: revisione indipendente, candidato cumulativo riallineato a main, sicurezza e regressioni complete, decisione umana esplicita prima del merge.

Nessun dato reale; nessuna pubblicazione; nessun costo o attivazione remota; nessuna autorizzazione automatica.
