# VAL-01/D1a.2a — Raccordo esplicito ai voti, prima unità

Stato: candidato RED da qualificare. Baseline `85b859bb8360868144b0968fcd593746804ccc26`: D1a.1 #286 integrata, post-merge PREDEPLOY SUCCESS; D0 #285 ratificata. Issue #231.

## Audit del codice sulla baseline esatta
- `src/types.ts`: Grade conserva ID, batchId opzionale, studentId, data, tipo, periodo, titolo, valore, delayed e UDA opzionale. AppData non conserva anno/disciplina per singolo Grade: non inferirli dal nome della classe o dalla data soltanto.
- `src/persistence/matrixCellMutation.ts`: la cella conserva ID esistente e usa expected/metadata/roster; nessuna riscrittura dell'intera prova.
- `src/persistence/dailyMatrixWorkspace.ts`: namespace daily_ + UUID, selezione storica distinta, batch online_ escluso, verifica globalità ID e coerenza del batch.
- `src/App.tsx` handleSaveEvaluations: crea nuovi ID per tutti i voti e sostituisce batch; handleDeleteBatch elimina tutti i voti; handleRemoveStudent elimina voti e comportamenti. Il legame individuale storico non può essere riassegnato automaticamente a un nuovo ID. D1b/S5 devono bloccare o gestire esplicitamente queste operazioni prima dell'attivazione.
- `src/persistence/submissionGradeImport.ts`: online_ e online_grade_ per consegna individuale; nessuna associazione collettiva né mapping competenze.
- `src/assessment/assessmentEvidence.ts`: contratto puro locale di D1a.1, solo attività esplicita; non estendere l'autorità delle fonti per deduzione.

## Perimetro
Resolver puro `resolveAssessmentBatchLink(data, context, selection)`: contesto esplicito di classe/anno/disciplina confermato, selezione esplicita e metadati della prova congelati. Controlla identità batch globale, metadati identici, roster univoco, ID dei voti globali, esclusione online e namespace giornaliero malformato. Il contesto è fornito da chiamante, non prova autorità curricolare o appartenenza storica di un voto all'anno/discipline: in integrazione verificare configurazione e provenienza. Per anno scolastico italiano impiegare il confine civile 1 settembre–31 agosto, senza dedurre quadrimestre. Nessuna corrispondenza per titolo, data o nome. Storico con batch univoco e conferma esplicita ammesso, non classificazione automatica. UDA è soltanto confronto dell'ID del Grade: audit del catalogo e fotografia di provenienza restano successivi.
Risultato ristretto ai metadati confermati e, se richiesto, studentId/gradeId esatti, senza voto, nominativo, livello o interpretazione. Cambiamento del valore non modifica fatti osservati; cambio ID o metadati restituisce non valido, nessuna riparazione automatica. Non sostituisce convalida dello storico immutabile, né è autorizzazione alla scrittura.

## Sequenza
1. Corpus 18 prove sintetiche e invariante aggiuntiva (RED per API mancante, come D1a.1). GREEN sul medesimo corpus, exact-SHA, revisione indipendente.
2. D1a.2b: integrare il contratto con definizioni/evidenze revisionate, unicità della definizione attiva, idempotenza e proiezione attiva; conteggi senza denominatore inventato; test di assenza e storico. Eventuale linkage del voto storico richiede conservazione separata dell'identità originaria, non sostituzione. D1a.2a è prerequisito, non l'intera D1a.2.
3. D1b: archivio cifrato, backup/downgrade, compatibilità, rimozione e trasferimento. S5/S6: collegamento visibile e conferma docente, percorso rapido invariato. Repertori di studio/istituzionali, mapping Arena/Docente OS e online restano separati e non dichiarati qualificati.
Nessuna UI, schema, persistenza, IA, rete, pubblicazione, dati reali. HPR visiva non pertinente: il resolver non viene importato dal runtime. 40 casi D0 non dichiarati PASS.
