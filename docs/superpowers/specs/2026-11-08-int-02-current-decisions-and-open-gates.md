# INT-02 — Decisioni correnti e gate ancora aperti

**Aggiornamento:** 8 novembre 2026  
**Riferimento:** `main@d3faf94d3afc1d7134cf75d3b04a5d6a983fddfe`  
**Tracker:** [INT-02 #140](https://github.com/antoniocorsano-boop/registro-docente/issues/140) · [roadmap #104](https://github.com/antoniocorsano-boop/registro-docente/issues/104)  
**Provenienza decisionale:** [S0 #141](https://github.com/antoniocorsano-boop/registro-docente/pull/141), [S2 #148](https://github.com/antoniocorsano-boop/registro-docente/pull/148); entrambe **proposte storiche**, non codice corrente.

## 1. Avanzamento confermato

| Fase | Stato comprovato | Autorizzazione |
| --- | --- | --- |
| S0: inventario autorità e contesto | Documentazione storica #141, sostituita da questo quadro aggiornato | Nessuna modifica di prodotto richiesta |
| S1: fonte Biblioteca → Verifiche | **Integrata** tramite [PR #142](https://github.com/antoniocorsano-boop/registro-docente/pull/142), merge `71e4a437acd9b15bcab28d32a13c6b4026fb29bc` | Completata, non riaprire |
| S2a: classe e verifica esplicite per condivisione/simulazione | **Integrata** tramite [PR #149](https://github.com/antoniocorsano-boop/registro-docente/pull/149), merge `7333f6eb28fd99101e2d243515c994d1faf99c49` | Completata, HPR Android PASS |
| A4-R2B/Task7: anteprima locale Docente OS | **Integrata**, tema separato da INT-02, tramite [PR #154](https://github.com/antoniocorsano-boop/registro-docente/pull/154), merge `d3faf94d3afc1d7134cf75d3b04a5d6a983fddfe` | Completata, non introduce nuove autorità UDA |
| S2b: provenienza permanente fonte→verifica | **Non adottata / in valutazione** | Nessun cambiamento di schema autorizzato |
| Importazione batch esiti → valutazioni / UDA | **Rischio da analizzare separatamente** | Nessuna correzione applicativa approvata da questo documento |
| S3: proposta di verifica tramite Copilota | **Non avviata da questa linea** | Richiede verifica aggiornata di capacità e contratto di consenso |
| S4: continuità completa del ciclo | **Non chiusa da questa linea** | Richiede incrementi e HPR propri |

Il catalogo `OnlineTest` rimane condiviso fra classi; non trasformarlo implicitamente in un archivio di proprietà della singola classe. L'handoff sessionale non certifica una provenienza durevole.

## 2. Gate S2b — provenienza durevole della fonte Biblioteca

**Decisione da prendere prima di scrivere codice:**

- **A — Stato soltanto sessionale (nessuna modifica di schema):** conservare la provenienza nel solo passaggio di lavoro finché il docente prepara il test. Vantaggio: massima compatibilità; limite: nessuna attestazione dopo il salvataggio.
- **B — Metadato minimo e opzionale in `OnlineTest`:** proposta candidata, mai implicita, ad esempio `provenance?: { version: 1; kind: 'library-source'; sourceId: string; confirmedByTeacher: true }`. Non include titolo, testo, URL, documento né dati di studenti. **Non è uno schema approvato.**

Prima di un eventuale sì a B:
1. Identificare l'esatto modello `OnlineTest` attuale, serializzazione di `customTests`, controllo dei campi sconosciuti, versione backup/export, ripristino e cifratura del Vault; testare test storici privi di metadato.
2. Verificare nello stesso commit che la fonte originaria sia ancora `ready` e `teacher-professional`; la fonte eliminata, non disponibile o riclassificata non è «certificata» per un nuovo salvataggio. Non collegare titoli simili come sostituto di `sourceId`.
3. Conservare i test già salvati quando la fonte scompare; mostrare «Origine non registrata» (campo assente) o «Origine non disponibile/non verificabile» (riferimento invalidato), senza riesporre il contenuto sorgente.
4. Impedire che `sourceId` o il contenuto della Biblioteca compaiano in URL per gli studenti, `history.state` usato per trasmettere il materiale, stampe pubbliche, log o richieste remote non autorizzate.
5. Preservare bozza, cambio classe, UDA esistente, catalogo comune, import DOCX/ZIP, restore/esportazione e test duplicati. La provenienza descrive **l'origine del materiale**, non la classe proprietaria, l'autorizzazione di consultazione o l'attribuzione automatica dell'UDA.
6. RED→GREEN, 5 qualificazioni exact-SHA, revisione indipendente e HPR Android sintetica **solo se** è autorizzata un'implementazione.

**Decisione corrente:** **S2b DIFFERITA**, raccogliere prima una matrice di compatibilità e proposta A/B. Nessuna migrazione automatica.

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
