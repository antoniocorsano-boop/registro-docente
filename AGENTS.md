# Agent operating entrypoint

Queste istruzioni valgono per l'intero repository.

## Qualità di prodotto — obbligatoria in ogni intervento

Prima di progettare o modificare funzionalità, testi, schermate, navigazione o comportamento, leggi [PRODUCT-QUALITY-01](docs/ux/PRODUCT-QUALITY-01.md) e la baseline normativa [UX-GOV-01](docs/ux/UX-GOV-01-registro-docente-user-flow-baseline-v1.md). Parti dal compito reale del docente, non dal componente informatico. Verifica terminologia professionale, percorso breve, leggibilità, coerenza visuale e controllo delle decisioni da parte del docente.

- Ogni PR dichiara impatto e criteri di qualità di prodotto, oppure motiva l'assenza di impatto sull'esperienza utente.
- Modifiche visibili al docente: evidenza tecnica e revisione di prodotto sono due valutazioni diverse; mai chiamare PASS UX i soli gate automatici.
- Non mostrare nomi di sistemi, codici di processo, hash, provider o dettagli di governance nella vista ordinaria. Le informazioni necessarie per privacy, consenso, provenienza e salvataggio restano invece chiare e disponibili.

## Prima di un ciclo significativo

Prima di implementazioni, incidenti, failure non banali, cambi di architettura/processo o qualificazioni finali:

1. Leggi `docs/memory/README.md`.
2. Leggi `docs/memory/OPERATING_RULES.md` e applica tutte le regole `ACTIVE` pertinenti.
3. Leggi `docs/memory/DECISIONS.md` per evitare di riaprire decisioni già congelate senza nuova evidenza.
4. Consulta `docs/memory/TOOL_RECIPES.md` per i percorsi già qualificati.
5. Consulta le lesson `ACTIVE` o `REVALIDATE` pertinenti in `docs/memory/LESSONS_LEARNED.md`.

La memoria del repository è l'autorità canonica per il processo operativo. La memoria conversazionale può aiutare a richiamarla, ma non la sostituisce.

## Durante il ciclo

- Lavora sull'exact candidate SHA dichiarato dal ciclo.
- Mantieni la disciplina RED → GREEN quando il task modifica comportamento o contratti verificabili.
- Un gate non può dichiarare PASS prima dell'evidenza che pretende di certificare.
- Usa soltanto dati sintetici nei gate e nelle prove automatiche salvo autorizzazione esplicita diversa.
- Non eseguire auto-merge o deploy automatici come conseguenza di una qualificazione.
- Non indebolire un gate per farlo diventare verde: correggi la causa dimostrata.

## Alla chiusura del ciclo

Aggiorna la memoria soltanto quando il ciclo produce conoscenza riutilizzabile: integrazioni importanti, incidenti, failure significative, cambi di architettura/processo o scoperte che cambiano il modo corretto di lavorare.

Per un micro-fix ordinario senza apprendimento generalizzabile non è richiesto alcun aggiornamento della memoria.

Quando serve memoria episodica, aggiungi una Memory Capsule in `docs/memory/LESSONS_LEARNED.md` usando il contratto definito in `docs/memory/README.md`. Se una lesson cambia stabilmente il modo di lavorare, promuovi la regola in `OPERATING_RULES.md` o la decisione in `DECISIONS.md`. Non cancellare silenziosamente una regola obsoleta: marcala `SUPERSEDED` e indica da cosa è stata sostituita.
