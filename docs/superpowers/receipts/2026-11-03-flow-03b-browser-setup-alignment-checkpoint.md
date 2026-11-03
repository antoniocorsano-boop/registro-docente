# FLOW-03B — Browser setup alignment checkpoint

Baseline: `main@c56ae67693b773b093e51f131053ce1c205a9508`.

## Causal browser RED

Browser Qualification #1376 / run `41627631665` sul candidato `7cf3bb905577693ca41effb5848125dd4de6d5da` ha superato `qualification-invariant-smoke` ma ha fermato TODAY-01 desktop perché il journey ereditato pretendeva ancora che una mutazione ordinaria aprisse sempre `Dati Salvati in Locale con Successo!`.

Questo comportamento non è più un requisito dopo M1: il promemoria backup è manutenzione locale, mentre la persistenza professionale resta verificata dalle superfici e dai contratti dedicati.

## Alignment

Commit prodotto `3507493c6c63f4cee9375ac3360bf58143a81421`:

- TODAY-01, FLOW-01 e FLOW-02 continuano a chiudere il reminder se presente, ma non ne richiedono la comparsa per procedere;
- la prova FLOW-03B dedicata mantiene invece l'asserzione forte che un salvataggio ordinario non venga interrotto dal reminder;
- nessun comportamento prodotto, persistenza o routing è cambiato;
- harness e patcher temporanei sono rimossi.

Prima del commit il workflow monouso ha verificato sintassi Node dei tre journey, suite `src/security/flow03*.test.ts`, TypeScript e `git diff --check`.

Questo file è solo una ricevuta di qualifica e produce il candidato human-authored da usare per i gate fresh. Nessun merge o deploy è autorizzato.
