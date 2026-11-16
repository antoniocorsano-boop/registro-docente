# VAL-01/D1a.1 — Contratto puro delle evidenze: primo incremento

Stato: RED candidato da eseguire, non qualificato. Baseline ratificata #285, merge 909b969f8869ad1dc38865e4ea007e7d34e067c4, D0 §0.1–0.8, §§3–4.1 e §8. Issue #231. D1a.1 non esaurisce D1a né i 40 casi.

## Decisioni di perimetro
- Dominio isolato e non importato da UI/appData, nessun accesso a storage, servizi, rete, Copilota o dati reali. Nessun nuovo schema persistente. Il validatore accetta input unknown e scope esplicito classId/schoolYear/subjectCode/studentIds, rifiuta forma ignota, campi estranei e scope incoerente; non muta input.
- Prima unità: riferimenti locali tipizzati, criteri, rubriche locali, definizione prova esplicita senza voto, fatti e interpretazioni, eventi e revisioni, ritiro. Nessuna autorità canonica o istituzionale attribuita. I riferimenti locali non sono importati automaticamente; i test non abilitano la UI. Il repertorio di studio/istituzionale, mapping delle fasce e riferimenti canonici hanno contratti futuri separati.
- D1a.2: audit batch/Grade e collegamenti verificati, compatibilità storico e fonti; proiezione attiva con denominatori e deduplicazione, test non Tecnologia, completare i casi puri A/P/I/R. D1b: vault, backup, restore e downgrade, procedure distruttive. Gli altri casi dipendono da S5–S8 e HPR.
- API proposta validateAssessmentEvidenceV1(value: unknown, scope: unknown): {valid: boolean; issues: readonly ...}. Esito di validazione strutturale, non giudizio sull'alunno né attestazione di conformità. Errori senza contenuti individuali.
- Primo corpus sintetico nel percorso security, incluso nella suite canonica test:security. L'import dell'API non ancora implementata è intenzionale, come il precedente CDC-02/S2b-P1. RED deve essere osservato sullo SHA esatto prima di introdurre il modello. Poi GREEN sullo stesso corpus senza indebolirlo; typecheck e regressioni, review indipendente. Assenza di evidenza non equivale a insufficienza, no soglie, no IA. Nessun rilascio.
- HPR visiva non pertinente a questo incremento isolato; quando il dominio sarà connesso a UI richiederà valutazione umana distinta. Nessuna modifica runtime, schema backup o registro ufficiale.

## Provenienza della decisione D0
Candidato 5de4e31a61384e854dc7814cb9d0c09ceec4b588, 9/9 gate e Codex senza rilievi, integrazione autorizzata il 16 novembre 2026; confronto file con merge: zero differenze. Le 40 prove sono casi progettuali, non esiti. D0 prevale sulla proposta del 13 novembre laddove differiscano.
