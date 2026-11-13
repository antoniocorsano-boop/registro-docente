# VAL-01/D0 — Valutazione integrata: modello di dominio

Stato: PROPOSTA DOCUMENTALE, da sottoporre a revisione. Issue #231; S3 #230 integrata e PREDEPLOY post-merge 43456994504 SUCCESS. Baseline c8a72ba49dc5198074ef4a3b72250f1ef2acdec0. Nessun cambiamento applicativo o migrazione in D0.

## 1. Scopo e confini
Registrare una sola volta il contesto della prova e riutilizzarlo per valutazioni, evidenze, profilo longitudinale e restituzione. Non trasformare la registrazione rapida in compilazione obbligatoria di rubriche. Le competenze richiedono evidenze pertinenti e conferma del docente; voto numerico e livello non sono equivalenti. Assenza di evidenza non significa insufficienza. Nessuna decisione automatica, invio remoto di dati individuali, certificazione ufficiale o nuova distribuzione implicita.

## 2. Contratti esistenti verificati
- Grade (src/types.ts): id, batchId opzionale, studentId, data, periodo, tipo, titolo, value, delayed, udaId opzionale. Fonte canonica dei voti.
- App.handleSaveEvaluations crea nuovi id anche in modifica, sostituendo tutto il batch. handleDeleteBatch elimina il batch. Il collegamento durevole di nuove evidenze non può dipendere dall'id di Grade attuale senza intervento esplicito. Import digitale crea online_grade_<submission.id> e online_<submission.id> per singolo elaborato, non un batch di classe.
- EvaluationsView già registra una prova per tutta la classe. MatrixView consulta. Riutilizzare il percorso di commit e durableMutationCoordinator (derive/persist/publish/afterCommit), non introdurre un archivio concorrente.
- ArenaPlanningContext V1: curricoloItems id/kind/text e masterId/masterVersion/fingerprint, autorità, vigenza, profilo e coorte. Riferimenti solo da contesto accettato, pertinente e verificato.
- DocenteOsTeachingProjection V1: sourceUdaRef/projectedUdaId, focus, packRefs, canonicalGenerationId e fingerprint. Non contiene criteri, obiettivi o rubriche strutturati; non inferirli dal titolo o dal focus. teachingUdaCatalog è il confine di risoluzione per classId, provenienza e unicità. UdaRecord locale ha competencies testuale/rubricLevels generali. Necessaria estensione contrattuale successiva o definizione locale esplicita.
- OnlineTest/OnlineSubmission: identità test e risposte; assente mapping esplicito domanda-obiettivo. Import esistente riconcilia identità e impedisce duplicati; mantenere.
- Backup V6: la modifica futura richiede revisione dell'intero percorso schema, normalizzazione, restore, convalida e migrazione. Non supporre che campo opzionale garantisca compatibilità con client precedenti.

## 3. Modello logico proposto (non schema implementativo)
| Entità | Identità e contenuto |
|---|---|
| Contesto di valutazione | assessmentId stabile, classId, anno, titolo/argomento, tipo, data, periodo, UDA facoltativa, revisione, stato |
| Fonte curricolare | contesto Arena accettato + item id + masterVersion/fingerprint; oppure riferimento locale esplicitamente definito, mai presentato come autoritativo Arena |
| Criterio della prova | criterionId stabile, assessmentId/revisione, obiettivo/i e competenza/e riferite, testo osservabile, eventuale rubrica/versione e descrittori congelati |
| Collegamento voto | assessmentId + studentId + grade/batch/source link verificato; Grade resta fonte canonica; nessuna copia numerica |
| Evidenza individuale | evidenceId, assessmentId/revisione, studentId, criterionId, fonte, data, tipo (risultato per obiettivo / livello osservato / osservazione esplicita), valore e stato; nessun dato inferito mancante |
| Proposta di livello | insieme di evidenceId/revisioni, criterio/competenza, periodo, motivazione e limiti; non costituisce livello confermato |
| Livello confermato | scelta esplicita del docente, versione rubrica e fonti, data/periodo, stato e revisione; distinto da voto e proposta |
| Restituzione | modello individuale del periodo, dati calcolati, evidenze ammissibili, testi proposti/modificati, revisione delle fonti, conferma docente e invalidazione in caso di variazione |

Identità interne non esposte in PDF. Per fonti locali, conservare fotografia minima di etichette e descrittori effettivamente selezionati. Per UDA proiettate, conservare riferimenti della provenienza e non mutare la fonte. Obiettivo associato a una prova non significa obiettivo raggiunto dall'alunno. Un criterio può riferirsi a più obiettivi, ma non attribuire automaticamente la stessa evidenza a tutti senza scelta esplicita.

## 4. Regole di ciclo di vita
- Nuova prova: selezione comune una volta; modalità rapida solo voto, per criteri, rubrica. Voti vuoti non salvati; A/NC/G distinti da 0 e non rilevato. La selezione della prova non produce livelli.
- Identità: distinguere prova didattica, sessione di registrazione, batch di voti e elaborato digitale. Prima di S5 introdurre un adattatore stabile verificato per i nuovi batch, inclusi casi di modifica e import; mai migrare storici per somiglianza di titolo/data. Grade id stabile per record modificato è una scelta candidata da qualificare; in alternativa relazione con identità canonica separata e vincoli di unicità. Decisione implementativa bloccata fino a test su edit/delete/import/restore.
- Modifica: commit atomico; evidenze indipendenti osservate non cambiano valore perché cambia un voto; evidenze derivate dalla fonte modificata diventano da riesaminare. Revisione del criterio/rubrica non riscrive retroattivamente le evidenze. Nessuna cancellazione silenziosa di evidenze al salvataggio.
- Eliminazione: anteprima conseguenze e conferma; definire rimozione/inattivazione coerente con regole di conservazione dell'istituto e privacy, no riferimenti orfani. Eliminazione studente/classe e ripristino devono includere il nuovo dominio. Non conservare dati personali eccedenti solo per audit.
- Import digitale: associazione esplicita domanda-obiettivo, versione della prova congelata, riconciliazione univoca elaborato/alunno, controlli su risposta mancante/duplicata e punteggi. Senza mapping verificato, solo evidenza globale del test; non inferire autonomia o collaborazione da risposte.
- Conferma: proposta locale riproducibile con fonti e periodo; eventuali descrittori suggeriti non sono esiti. Conferma singola docente; modifica delle fonti invalida proposta/anteprima non esportata. Una restituzione già salvata localmente non viene revocata dall'app.
- Protezione: archiviazione locale protetta, nessun servizio remoto per valutazioni individuali, nessun nome in log/fixture, privacy LIM anche in selettori e anteprima; PDF non cifrato, destinatario verificato manualmente. Nessuna certificazione automatica.

## 5. Tre scenari sintetici
1. Verifica tradizionale: UDA Agricoltura, obiettivo tecniche di coltivazione, voto 8. Il voto documenta un risultato globale su una prova associata all'obiettivo, non un livello specifico senza criterio rilevato. Nessun campo aggiuntivo individuale obbligatorio.
2. Test digitale: domande 1–3 riferite all'obiettivo riconoscere tecniche agricole, 4–6 a effetti ambientali, associazione confermata prima della prova. Risposte 3/3 e 1/3 generano due risultati parziali distinti, se punteggio e mapping sono verificati; nessun livello automatico. Test rielaborato o risposte non disponibili: niente analisi per obiettivo.
3. Plastico rurale: criteri scala, struttura, sostenibilità, autonomia. Il docente seleziona un criterio per volta sullo stesso elenco e registra il descrittore osservato. Un lavoro di gruppo non assegna automaticamente lo stesso livello ai singoli. Livello mancante = non rilevato; voto sintetico indipendente.

## 6. Sequenza di implementazione
- D0: revisione dominio e scelte di persistenza/identità. Gate: approvazione esplicita della specifica e assenza di rilievi bloccanti.
- S4a: ingresso Tabellone → «Inserisci valutazione» → contesto comune → lista compatta → conferma → ritorno Tabellone. Riuso del commit attuale con protezione bozza, errori e pending; non toccare schema o formule. UDA locale/proiettata solo secondo regole già qualificate; non abilitare nuova fonte senza contratto.
- S4b/S5: adattatore identità e contesto qualificato, riferimenti obiettivi e mapping. Prima definire convalida e migrazione (compatibilità backup V6, nuovo formato se necessario, prevenzione perdita da downgrade).
- S6: criteri/rubriche e livelli con storico, distinte osservazioni; indicatori legacy esplicitamente orientativi.
- S7: bilancio assistito con fonti e revisione, sezione Competenze documentate, livelli testuali e barre solo se confermati. Grafici comparabili facoltativi, niente radar ornamentali. S3 rimane utilizzabile.
- S8: raccordo con scrutinio/certificazione, verifica normativa e criteri istituto prima di qualsiasi equivalenza ufficiale.

## 7. Gate di accettazione
Test con dati sintetici: nuovo/edit/delete batch; identità stabile; due classi, due alunni, titoli uguali; UDA cambiata/cancellata e proiezione ambigua; import doppio, mapping mancante, correzione fonte; nessun dato cross-class/student; voto e livello indipendenti; non rilevato; draft/annulla/back/errore/pending; restore storico e nuovo formato, downgrade non distruttivo, transazione atomica. Mobile 320/390 e testo 200%, tastiera, righe compatte, privacy immediata, accessibilità e conferma docente. Invarianti additive, revisione indipendente, HPR exact SHA. Test Android reale separato dal packaging. Nessuna modifica al rilascio Beta 2 in D0.

## 8. Decisioni ancora aperte
Scelta fisica dello schema e versione backup, lifecycle revisione/cancellazione, adattatore identità voti legacy, estensione contrattuale Docente OS, criteri d'istituto e validazione del linguaggio. Non risolvere attraverso inferenze o riscrittura silenziosa. S4a può essere sviluppata dopo approvazione D0 con perimetro senza nuova persistenza; S4b–S8 richiedono specifiche e gate incrementali.
