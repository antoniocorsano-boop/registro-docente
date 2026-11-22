# VAL-01/PRODUCT-05/S7d.2d — Ricevuta V10 persistita in archivio cifrato sintetico

**Data:** 22 novembre 2026. **Base:** PR #401, SHA `a15c8da02271fa06323043a9fe6cc3fce82ca736`.

## Decisione di progetto
Non scrivere nel `SecureMeta` ufficiale una ricevuta V10 quando la validazione esistente accetta esclusivamente formati pregressi. Non modificare i dieci record fisici del Vault dell'utente. La fase S7d.2d deve dimostrare la serializzazione cifrata, la rilettura e il blocco delle conferme false **in un Vault sintetico interamente separato**; non sblocca il salvataggio professionale.

## Contratto di laboratorio
- Un'istanza possiede sia l'autorità di prova della copia S7d.2c sia l'operazione di memorizzazione. Non accetta ricevute isolate o fornite da terzi: soltanto la propria identità monouso.
- La preparazione avviene nella coda condivisa delle scritture, dopo lettura dello snapshot effettivamente confermato dal laboratorio; acquisisce un digest SHA-256 dell'intero snapshot, non soltanto il numero di modifiche.
- L'operazione di registrazione ricontrolla nel medesimo coordinatore l'intero snapshot, quindi consuma la prova fisica verificata e salva il record `lab-durable-not-official` in un'archiviazione sintetica. Non è un'attestazione ufficiale né una firma.
- Il record cifrato viene riletto e confrontato per intero. Guasto, incongruenza, revoca o stato incerto invalidano l'autorità e impediscono un messaggio di successo. Nessun ripristino retroattivo o riscrittura del record reale.
- Per evitare false certezze, questo laboratorio rifiuta di sovrascrivere un record preesistente. Non implementa ancora la conservazione append-only delle ricevute successive, che richiede modello storico autonomo.
- Una prova usa un SecureVault distinto con un VaultStore fittizio in memoria: cifratura AES-GCM reale, chiusura e riapertura con password, rilettura verificata. Non è una prova di IndexedDB o di sistema di file Android.

## Condizioni per la promozione
1. Nuovo validatore durabile e conservativo di `SecureMeta` che conservi V6–V9 e verifichi anche V10, con contatore delle modifiche e copia già registrata.
2. Estensione autenticata dell'archivio produttivo e validazione di `formativeBalanceHistoryV1` senza perdita o aggiramento delle protezioni.
3. Copia verificata e restaurata in ambiente browser reale, anche dopo chiusura/apertura; Android nativo API 32/36, incluse transazioni interrotte e copia di recupero.
4. Verifica codice indipendente, candidata cumulativa allineata con main, qualificazione completa e decisione esplicita.

**Divieti:** nessuna modifica ai dati reali, nessun backup V10 ufficiale, nessun ripristino effettivo, nessun merge né pubblicazione.
