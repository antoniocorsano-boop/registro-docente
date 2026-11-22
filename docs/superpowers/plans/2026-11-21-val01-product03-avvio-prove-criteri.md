# VAL-01/PRODUCT-03 — Prima prova con obiettivo e criteri dal Tabellone

**Data:** 21 novembre 2026. **Origine:** chat Registro Docente «Ok, allora proseguiamo».
**Base esatta qualificata:** [PR #387](https://github.com/antoniocorsano-boop/registro-docente/pull/387), SHA `2b49b404b3329f795963d34f5ae4b9da5df90ab3`, 10/10 workflow PASS, 156 invarianti.
**Ramo:** `feat/val01-product03-prepare-assessment`; destinazione la PR #387, senza integrazione in `main`.
**Governo:** [issue #104](https://github.com/antoniocorsano-boop/registro-docente/issues/104), [VAL-01 #231](https://github.com/antoniocorsano-boop/registro-docente/issues/231). R1/R2/R3 riservati all’accettazione e alla distribuzione.

## Funzione effettiva

Nel Tabellone giornaliero il docente dispone del pannello comprimibile **«Predisponi prova e criteri»**, senza modificare la registrazione rapida dei voti e del comportamento. Consente di:
- Indicare titolo e data della prova svolta (la giornata attiva del Tabellone), periodo e finalità diagnostica, formativa o sommativa.
- Dichiarare **un obiettivo di apprendimento**, manualmente e senza accreditarlo come importato da Arena; aggiungere da **uno a quattro criteri**. Per ciascun criterio il docente indica descrizione, tipo di evidenza attesa, contenuto da osservare e metodo.
- Esaminare le informazioni, quindi confermare separatamente. La prima conferma crea l'archivio V1 soltanto quando in precedenza era **assente** e autorizzato; quelle successive aggiungono le revisioni senza alterare il passato. Non crea voti o osservazioni sugli alunni.
- Recuperare la prova confermata nel pannello già implementato da PR #387, dove il docente può registrare un'osservazione individuale per criterio. La Scheda alunno della PR #386 legge la stessa archivistica.

## Riutilizzo rigoroso

La funzione non reinventa la disciplina valutativa: `dailyAssessmentSetup.ts` richiama **`previewAssessmentDefinition` / `confirmAssessmentDefinition` (S5b)** per la definizione pianificata e **`previewAssessmentCompletion` / `confirmAssessmentCompletion` (S6a)** per registrare la prova come già svolta, utilizzando il validatore strutturale V1. I documenti vengono costruiti **in memoria**, senza persistenza anticipata.

Il docente non è ancora guidato dal curricolo autorevole Arena; l'obiettivo dichiarato ha fonte locale esplicita `manual-v1`, non un'impropria autorità curricolare.

In `App.tsx` la conferma è ricalcolata **sull'ultimo stato committato**. Il confronto con il documento iniziale esatto, con l'elenco studenti corrente e con anno/disciplina indipendenti impedisce la sovrascrittura di un archivio creato nel frattempo. La modifica attraversa **`commitAppDataMutation`**, la stessa coda durevole cifrata dei voti, e acquisisce ricevuta solo dopo scrittura. Nessuna autorità alternativa, dipendenza, servizio di rete, trasferimento di dati o nuova struttura di conservazione.

Il Tabellone unifica guardie delle bozze e dei salvataggi: cambiare data, prova o schermata non deve eliminare una configurazione non confermata. I comandi di voto/comportamento restano bloccati durante il salvataggio della prova.

## Test e confini dichiarati

- `src/security/val01Product03AssessmentSetup.test.ts`: 10 prove sintetiche per archivio inizialmente assente, creazione completa S5b/S6a, successive prove non distruttive, revisione datata, doppia conferma, contesto/roster errato, salvataggio atomico fallito e ri-tentato esplicitamente, riservatezza e integrazione nel vero `App`.
- Invariante `VAL-01-PRODUCT03-I01` aggiunta, totale 157, nessuna modifica alle 156 precedenti.
- Da qualificare sullo SHA finale: TypeScript, prove contrattuali, regressione Chromium, geometria 320/390 px con testo 200%, integrità Android DB2 e compatibilità backup; esito non ereditato da PR #387.
- **Disciplina dell'utente reale:** il valore di impostazione `Tecnologia & Disegno Tecnico` è un'etichetta leggibile e non può essere usato direttamente come `subjectCode` V1. `assessmentSubjectScope.ts` riusa `resolveCurricularSubjectCode` per la corrispondenza già prevista (`tecnologia`), conserva i codici tecnici validi esistenti e rifiuta qualsiasi disciplina non identificabile; la stessa risoluzione è applicata a preparazione, scrittura, registrazione per criterio e Scheda alunno.
- **Prova reale nel laboratorio:** `val01-s6d-operational.spec.cjs` utilizza il vero archivio cifrato DB2 sintetico: la prova confermata è scritta e riletta, compare come prova selezionabile e consente la successiva registrazione individuale. Sono verificate la geometria 320 px con testo 200% e la geometria 390 px. I controlli utilizzano etichette non ambigue (ad esempio `Secondo periodo della prova`) e nomi di campo esatti.
- **Limite intenzionale:** questa prima azione raccoglie una prova **già svolta**. La programmazione anticipata di una prova ancora pianificata e la successiva conferma a fine attività restano ulteriori funzioni. Non importa automaticamente obiettivi da Arena/UDA e non deduce le evidenze dai voti.
- La qualifica automatica e sintetica **non** dimostra l'installazione sull'Android reale dell'utente né l'accettazione pubblica. Nessun merge, distribuzione, nuova spesa o dato studente reale.
