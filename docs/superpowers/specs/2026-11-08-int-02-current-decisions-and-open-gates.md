# INT-02 — Decisioni correnti e gate ancora aperti

**Aggiornamento:** 8 novembre 2026  
**Riferimento corrente:** `main@e6b518656efbfaeeaa85e04512fa149ef48bf91a` (PR #160 integrata; Vercel disabilitato)  
**Tracker:** [INT-02 #140](https://github.com/antoniocorsano-boop/registro-docente/issues/140) · [roadmap #104](https://github.com/antoniocorsano-boop/registro-docente/issues/104)  
**Provenienza decisionale:** [S0 #141](https://github.com/antoniocorsano-boop/registro-docente/pull/141), [S2 #148](https://github.com/antoniocorsano-boop/registro-docente/pull/148); entrambe **proposte storiche**, non codice corrente.

## 1. Avanzamento confermato

| Fase | Stato comprovato | Autorizzazione |
| --- | --- | --- |
| S0: inventario autorità e contesto | Documentazione storica #141, sostituita da questo quadro aggiornato | Nessuna modifica di prodotto richiesta |
| S1: fonte Biblioteca → Verifiche | **Integrata** tramite [PR #142](https://github.com/antoniocorsano-boop/registro-docente/pull/142), merge `71e4a437acd9b15bcab28d32a13c6b4026fb29bc` | Completata, non riaprire |
| S2a: classe e verifica esplicite per condivisione/simulazione | **Integrata** tramite [PR #149](https://github.com/antoniocorsano-boop/registro-docente/pull/149), merge `7333f6eb28fd99101e2d243515c994d1faf99c49` | Completata, HPR Android PASS |
| A4-R2B/Task7: anteprima locale Docente OS | **Integrata**, tema separato da INT-02, tramite [PR #154](https://github.com/antoniocorsano-boop/registro-docente/pull/154), merge `d3faf94d3afc1d7134cf75d3b04a5d6a983fddfe` | Completata, non introduce nuove autorità UDA |
| S2b: provenienza permanente fonte→verifica | **Integrata** tramite [PR #160](https://github.com/antoniocorsano-boop/registro-docente/pull/160), merge `e6b518656efbfaeeaa85e04512fa149ef48bf91a` | Qualificazione 5/5, Codex e HPR visiva umana PASS; nessun deploy |
| Importazione batch esiti → valutazioni / UDA | **Rischio da analizzare separatamente** | Nessuna correzione applicativa approvata da questo documento |
| S3: proposta di verifica tramite Copilota | **Non avviata da questa linea** | Richiede verifica aggiornata di capacità e contratto di consenso |
| S4: continuità completa del ciclo | **Non chiusa da questa linea** | Richiede incrementi e HPR propri |

Il catalogo `OnlineTest` rimane condiviso fra classi; non trasformarlo implicitamente in un archivio di proprietà della singola classe. L'handoff sessionale non certifica una provenienza durevole.

## 2. S2b — provenienza durevole della fonte Biblioteca: INTEGRATA

**Decisione B adottata e integrata.** Il modello `OnlineTest.provenance?` contiene soltanto `{ version: 1, kind: 'library-source', sourceId, confirmedByTeacher: true }` come riferimento permanente **minimo e opzionale**. Non sono trasferiti testo, titolo, URL, allegati o dati personali dalla Biblioteca alla verifica.

**Contratto applicativo qualificato:**
1. La provenienza è registrata solo previa conferma esplicita del docente, inizialmente non selezionata. Il salvataggio riesamina fonte `ready` e `teacher-professional` e classe autorizzata, senza inferenze dal titolo.
2. I riferimenti storici restano conservati nelle modifiche delle verifiche anche se la fonte viene eliminata o riclassificata; l'interfaccia distingue «Origine non registrata», «Origine disponibile» e «Origine non disponibile o non verificabile».
3. Il riferimento non è autorità su classe proprietaria, UDA, condivisione, importazione di voti o permanenza della fonte. La proiezione per gli studenti non espone il riferimento.
4. Compatibilità con Vault cifrato, backup/ripristino v2–v6 e legacy; metadati malformati rifiutati, test precedenti senza provenienza ancora validi.
5. Nessuna migrazione automatica; import DOCX/ZIP e testo manuale non acquisiscono provenienze implicite.

**Evidenze di promozione:** [PR #160](https://github.com/antoniocorsano-boop/registro-docente/pull/160), candidato `a6d5d24e3e373c75da59f25172046bae7eeb7bb7`, invarianti [#879](https://github.com/antoniocorsano-boop/registro-docente/actions/runs/42524273803), sicurezza [#2155](https://github.com/antoniocorsano-boop/registro-docente/actions/runs/42524273969), FLOW-03 [#655](https://github.com/antoniocorsano-boop/registro-docente/actions/runs/42524273837), HEADER-01 [#229](https://github.com/antoniocorsano-boop/registro-docente/actions/runs/42524273820), browser [#1803](https://github.com/antoniocorsano-boop/registro-docente/actions/runs/42524273802), revisione Codex senza rilievi e [HPR visiva umana PASS](https://github.com/antoniocorsano-boop/registro-docente/pull/160#issuecomment-6727478607) su quattro schermate mobili sintetiche.

**Fusione approvata separatamente dal docente:** commit `e6b518656efbfaeeaa85e04512fa149ef48bf91a`. Identità dell'albero del merge con il candidato qualificato verificata. `vercel.json`: `git.deploymentEnabled=false`. **Nessuna distribuzione autorizzata.**

## 3. Gate indipendente — importazione delle consegne e associazione UDA

La PR #148 ha individuato una possibile interferenza preesistente fra i controlli di condivisione Padlet e l'importazione di esiti. Nel codice esaminato in quel momento:

- `handleImportSubmissionsToRegister` elaborava il batch `OnlineSubmission` complessivo tramite `reconcileSubmissionGrades`;
- `VerificheOnlineView.handleImportSubmissions` trasmetteva `currentSelectedTest?.udaId` come destinazione potenzialmente globale;
- `gradeFromSubmission` poteva usare `targetUdaId || submission.testId` come `udaId` della valutazione.

Queste sono **evidenze storiche di rischio**, non una diagnosi aggiornata del `main` attuale e non una correzione implementata. Verificare di nuovo il codice prima di formulare interventi.

**Principi del contratto:**
- I comandi «Copia link» e «Prova come alunno» richiedono la coppia classe/test esplicitamente scelta (S2a). Questo **non** limita né autorizza di per sé l'importazione batch.
- L'importazione ha perimetro, riepilogo e consenso propri: gestire classi/test differenti, test origine eliminato, esiti storici già importati e riferimento UDA mancante/ambiguo senza perdere o riattribuire voti.
- `testId` non equivale a `udaId`. Non applicare una UDA unica a un batch multiclasse senza controllo e conferma per ciascuna consegna.
- L'apertura di un test storico con UDA fuori contesto **non** autorizza cancellazione silenziosa del collegamento; un collegamento nuovo deve rispettare la classe.
- Qualsiasi modifica futura richiede test RED→GREEN su batch misto, errori, ripetizioni, persist/rollback e assenza di scritture collaterali, più verifica Android sullo SHA qualificato.

**Decisione corrente:** avviare soltanto un **audit mirato in lettura** del percorso di importazione, separato da S2b e dal Copilota; nessuna migrazione o registrazione di valutazioni in questa fase.

## 4. S3 e S4 — confini non anticipabili

Per S3 non assumere che la sola classificazione di intento `CREATE_ASSESSMENT` equivalga alla produzione di una verifica. Confermare lo stato effettivo di `agentIntentRouting.ts` sul ramo corrente prima di proporre una funzione. Eventuali output assistiti sono bozze soggette a revisione e adozione esplicite tramite il **Copilota già esistente**, senza nuove chat o autorizzazioni implicite.

Per S4 verificare `Prepara → Conduci → Registra → Rivedi` riusando le superfici autorevoli; non eseguire un import di voti per un semplice cambio di schermata o per la presenza di un handoff informativo.

## 5. Disciplina di promozione

- Partire sempre dal `main` corrente, non dai vecchi rami documentali #141/#148.
- Definire un piccolo incremento distinto con contratto, prove e confini di privacy.
- Nessun identificativo o contenuto sensibile di alunni/fonti negli URL; i contratti di `history.state` già usati dal router del Registro vanno preservati e riesaminati per ogni modifica, senza inventare restrizioni incompatibili con il sistema vigente.
- Escludere operazioni su dati reali, UDA non autorizzate, fonti non professionali, importazione di voti non richiesta o invii a servizi esterni.
- L'integrazione in `main` richiede gate tecnici, revisione indipendente e HPR per modifiche osservabili su Android. **Vercel rimane disabilitato** e un eventuale rilascio richiede autorizzazione separata.

**Nessuna nuova PR applicativa è autorizzata dalla sola presenza di questo documento.**
