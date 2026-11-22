# VAL-01/PRODUCT-05/S7d.1 — Schema storico append-only, senza persistenza
Data: 22 novembre 2026. Base PR #396 SHA 1356e30a465bc758859f9d4edbbe8dbe3f355aab.

## Confine
Modello di archivio **isolato e in memoria** per la successiva persistenza cifrata, non ancora un formato ufficiale di `ClassData`, `AppData` o backup. Nessuna scrittura o pubblicazione.

## Contratto
- Cronologia `FormativeBalanceHistoryV1` con schemaVersion 1, voci ordinate e mai sovrascritte.
- Ogni voce identifica `id`, revisione numerica crescente, `supersedes` esatto, data UTC e candidato S7c verificato.
- Catene separate per classe, anno, disciplina, alunno, periodo e intervallo; verifica della versione attesa prima dell'append.
- Validatore completo e deterministico, con rifiuto di chiavi non previste, duplicati, revisioni alterate e date non coerenti.
- La proposta richiede riconvalida S7c contro l'archivio valutativo corrente, non eredita una conferma dalla vista.
- Stato di ritorno `proposed-not-persisted`, senza autorizzazione a scrittura o invio.

## Passaggio obbligatorio successivo S7d.2
Definire il contenitore effettivo cifrato e validare l'intero percorso di scrittura serializzata, controllo conflitti con snapshot aggiornato, rilettura verificata e copia di sicurezza/ripristino Web e Android. Conservare tutte le revisioni anche nelle copie storiche. Solo dopo prove native e revisione indipendente attivare un comando di salvataggio in interfaccia.

## Integrazione
Questa PR dipende da #396 che dipende da #395. Nessun merge verso main finché non è ricostruito un candidato cumulativo allineato con main corrente e superati tutti i controlli.
