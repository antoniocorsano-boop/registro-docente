# S-R01a — Riserva esclusiva della configurazione iniziale DB1
Base: dossier STAB-05/S, 936a27bd23075fc687899118f4af27babed88c87. Candidato non attivo nella versione distribuita.

## Obiettivo e modifica
Due richieste indipendenti del candidato, entrambe partite dalla stessa osservazione di archivio vuoto, non devono poter sostituire la riserva reciproca. La riserva dei metadati STAGING ora richiede una sola transazione IndexedDB readwrite su entrambi gli store; i conteggi fisici devono essere zero e l'inserimento è add(), non put(). Il completamento della transazione precede l'assegnazione della chiave di sessione. Un rifiuto avviene prima delle successive scritture o della pulizia STAGING dell'inizializzazione.

SecureVault riceve il port di riserva esclusiva solo dal Root candidato DB1 (compresa l'ammissione alla migrazione legacy); percorso ordinario e DB2 invariati. Nessuna modifica allo schema, ai parametri crittografici, alla compatibilità fisica, a main o alle configurazioni CI.

## Criteri di accettazione
- Due connessioni reali, due vault distinti, barriera prima della riserva per assicurare che entrambi abbiano superato la prima lettura: una sola inizializzazione completa; chiave del perdente non disponibile; riapertura con la sola credenziale del vincitore; dieci record autenticati e modalità coerente.
- Rifiuto in presenza di record residui senza metadata: nessuna nuova metadata, nessuna cancellazione o sostituzione, chiave non disponibile.
- Prove deterministiche: rifiuto della riserva non sblocca il vault; riserva ancora pendente non pubblica la chiave.
- Regressioni del normale setup, migrazione legacy e DB2; revisione specifica della sicurezza prima di qualsiasi attivazione.

## Limiti e stato
La riserva risolve in progetto il conflitto tra nuove inizializzazioni concorrenti che usano questo protocollo. Non attesta l'esclusività rispetto a client storici non cooperanti, reset esterni o operazioni legacy già iniziate e revocate. Questi confini richiedono analisi separata (S-R01/S-R02). Non modificare il comportamento del percorso ordinario per dichiarare il gate chiuso.

Quattro nuove prove predisposte (due deterministiche e due browser reali); non ancora eseguite. Issue #307 rimane aperta per il blocco della qualificazione cumulativa. Nessun PASS di prova, merge, rilascio o aggiornamento del dispositivo.