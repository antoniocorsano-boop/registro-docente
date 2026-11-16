# VAL-01/D0 — Contratto di valutazione formativa integrata (v1 proposta)

Data: 2026-11-16 · Stato: SPECIFICA PROPOSTA, da revisionare; nessuna implementazione, migrazione, release o pubblicazione.
Autorità: #104, #210, #231; continuità #235/#237 e #227/#230; dipendenze #170/#171.
Baseline Registro: `0f6eb66a776ac040131f00214b87e8573d4ee573` (main, successiva al candidato Beta 2 RC2 #283). Applicare AGENTS.md, PRODUCT-QUALITY-01, UX-GOV-01 e OR-001–010. HPR Beta 2 rimane una linea separata.

## 1. Compito professionale e risultato

Durante una lezione il docente deve poter registrare un voto o un'osservazione con la stessa rapidità del Tabellone Smart. In preparazione, oppure in revisione di una prova, può indicare quali obiettivi intende rilevare e con quali criteri. In seguito può consultare evidenze individuali, confermare un bilancio e produrre una restituzione. Non richiedere selezione obbligatoria di obiettivi ad ogni voto, non creare una seconda matrice o un nuovo menu generale, non sostituire il registro ufficiale.

Il voto complessivo, una osservazione comportamentale, un risultato per criterio, un livello di competenza confermato e un giudizio collegiale sono fatti diversi. Un obiettivo associato alla prova non dimostra che sia stato rilevato per ogni alunno. Un voto non dimostra autonomia, collaborazione, impegno o competenze specifiche. L'assenza di evidenza non è insufficienza. I livelli ricavati da soglie numeriche oggi presenti (getCompetenceLevel e grafici) sono indicatori storici, non certificazioni né livelli osservati; non promuoverli automaticamente.

## 2. Ricognizione verificabile: cosa esiste e cosa manca

| Fonte (baseline sopra salvo indicazione) | Contratto effettivo | Conseguenza D0 |
|---|---|---|
| [types.ts](../../../src/types.ts) | Grade: id, batchId opzionale, studentId, data, tipo, periodo Q1/Q2, titolo, valore, delayed, udaId opzionale. BehaviorRecord separato. UdaRecord: className, competencies testuale, rubricLevels generali, lessons. | Non aggiungere significati impliciti ai voti; UDA e rubrica non costituiscono per sé un repertorio strutturato. |
| [matrixCellMutation](../../../src/persistence/matrixCellMutation.ts), [dailyMatrixWorkspace](../../../src/persistence/dailyMatrixWorkspace.ts) | Una cella, mutazione durevole; batch coerente, unicità alunno, expected grade, contesto comune; batch giornaliero stable, prova storica recuperata solo se non ambigua; online escluso dalla risoluzione giornaliera. | Riusare Grade e batch; estensione esplicita senza riscrivere i voti né allungare la registrazione. |
| [types.ts](../../../src/types.ts), [submissionGradeImport](../../../src/persistence/submissionGradeImport.ts) | OnlineTest domande per indice; OnlineSubmission risposte per indice; batch online per singola consegna, import esplicito e idempotente. | Niente equivalenza batch online = prova collettiva, né mapping domanda-obiettivo inferito; serve futura versione immutabile della prova. |
| [planning/types](../../../src/planning/types.ts), [arenaPlanningContext](../../../src/planning/arenaPlanningContext.ts) | ARENA_REGISTRO_PLANNING_CONTEXT_V1, accettazione locale, profilo, masterId/version, fingerprint MASTER, provenance, curricoloItems id/kind/testo/sezione. Il validator ammette kind ANNUALITA_DISCIPLINARE. | ID annualità non è ID del singolo obiettivo. Nessun obiettivo canonico inventato. |
| [docenteOsTeachingProjection](../../../src/planning/docenteOsTeachingProjection.ts) e [fixture sintetica](../../contracts/fixtures/docente-os-registro-teaching-projection-v1.json) | DOCENTE_OS_REGISTRO_TEACHING_PROJECTION_V1: proiezione sola lettura, sourceSectionId, projectedUdaId, sourceUdaRef, canonicalGenerationId, title/focus/period/packRefs; riconciliazione classe separata. | Non contiene obiettivi/criteri strutturati. Non cambiare il formato v1 né dedurre ID da title/focus. La fixture usa provenienza sintetica, non prova di disponibilità di export reale. |
| [backupPayload](../../../src/security/backupPayload.ts), [secureAppStorage](../../../src/security/secureAppStorage.ts) | Backup v6, lettori storici, snapshot completo, appData+meta atomici, convalida e readback/rollback restore. | Nuovo dominio deve avere convalida pre-write e pre-restore; mai perdere campi ignoti silenziosamente. |
| [formativeRestitution](../../../src/report/formativeRestitution.ts), [competencySemantics](../../../src/analytics/competencySemantics.ts) | Riepilogo voti con pesi, testo docente, PDF protetto nei nominativi; indicatori di copertura e raccomandazione numerica. | Estendere in seguito con evidenze realmente rilevate, conservando separazione da medie e note private. |

**Verifica a monte Arena:** [handoff ufficiale del progetto](https://github.com/antoniocorsano-boop/CurManLight_arena/blob/d8b1bf43388cb5c4cdcc940b0c558bb128976c4c/docs/architecture/ARENA_REGISTRO_PLANNING_HANDOFF_V1.md), [fixture Tecnologia classe I](https://github.com/antoniocorsano-boop/CurManLight_arena/blob/d8b1bf43388cb5c4cdcc940b0c558bb128976c4c/docs/contracts/fixtures/arena-registro-planning-context-tech-grade1.json). La fixture è PROVISIONAL_COMPLETE/NON_VIGENTE, master 1.3, fingerprint di scope MASTER; non è prova di approvazione corrente, né fonte di ID obiettivo. Non trasferire il contesto della prima alla seconda. Il produttore Docente OS (main 27e20e72454eafb0cf8212f61422f02dc6a60d6e) non ha fornito in questa ricognizione un export strutturato obiettivo/criterio direttamente verificato: la specifica usa il contratto consumer effettivo, non presume capacità del produttore. Prima di ogni scambio nuovo, verifica producer/consumer con corpus e specifica separata.

## 3. Autorità e ancoraggio delle fonti

Arena è autorità del curricolo; Docente OS della progettazione professionale proiettata; Atlas delle esperienze pubblicate; Registro delle rilevazioni private. Conservare il contesto accettato senza leggere dati alunni da altri prodotti. Per un riferimento Arena distinguere master, versione, fingerprint di scope MASTER, sourceCommit, sourceDocumentId/sourceRevisionId, itemId, sezione e stati di applicabilità/autorità/vigenza. Se non approvato e vigente con ricevuta, mostrare «Riferimento provvisorio», non presentarlo come curricolo ufficiale; D1 deve bloccare la qualifica ufficiale di tali riferimenti. L'accettazione del docente non cambia l'autorità Arena.

D0 propone due tipi di obiettivo: (a) **obiettivo locale definito/confermato dal docente**, con id locale stabile, revisione, testo e facoltativo riferimento documentale all'annualità accettata; (b) futuro riferimento puntuale canonico, disponibile soltanto con contratto a monte esplicito, ID e revisione verificati. Non usare hash del testo come ID canonico. Obiettivi locali possono essere utilizzati per il lavoro professionale anche senza fonte a monte; restano etichettati come locali, non come curricolo approvato. Nessun trasferimento di obiettivi/criteri che contengano note individuali, nessun identificativo studente all'esterno.

Docente OS: projectedUdaId è legato alla generazione e alla sezione; per agganciarlo richiedere classe riconciliata univocamente, anno/ordine/disciplina coerenti e decisione esplicita. Conservare sourceUdaRef, projectedUdaId, canonicalGenerationId, projectionFingerprint e sourceCommit, senza dedurre equivalenza fra rigenerazioni. Per UDA locale conservare id, classe e snapshot minimo di titolo/revisione locale; non usare className come chiave del nuovo dominio. Nuova versione della UDA o del curricolo non riscrive evidenze storiche. Se la fonte scompare, mostrare «Riferimento storico» con testo congelato e provenienza, non rimappare per somiglianza.

## 4. Modello candidato (logico, non codice implementato)

Collocazione proposta: `ClassData.assessmentEvidenceV1?` (documento versionato dentro appData cifrato), per sfruttare il confine atomico appData+meta e mantenere la classe come limite di integrità. Entità distinte, identificatori opachi locali. Per tutti i record: schoolYear canonico YYYY/YYYY, classId stabile, subjectCode risolto e confermato; nessuna deduzione da nome. Verificare coerenza del profilo e data/periodo effettivo; Q1/Q2 dei Grade restano invariati, eventuali nuovi periodi non si mappano implicitamente. Nessun archivio parallelo di voti.

| Entità proposta | Campi minimi e regole |
|---|---|
| ObjectiveRevision | objectiveId, revisionId, testo congelato, sourceKind local/arena-point (quest'ultimo disabilitato finché contratto assente), eventuale riferimento annualità/authority sopra, confirmedAt; revisioni append-only. |
| CriterionRevision | criterionId, revisionId, descrittore osservabile, objectiveRevisionIds non vuoti e univoci, rubricRevisionId facoltativo; criterio = ciò che si osserva, non voto. |
| RubricRevision | rubricId, revisionId, livelli con levelId stabile, etichetta e descrittore per criterio, ordine esplicito senza conversione in numeri; conferma docente. Il repertorio AV/IN/BA/PA esistente non viene assunto equivalente. |
| AssessmentDefinitionRevision | assessmentId, revisionId, classId/anno/disciplina, data, periodo, tipo canonico, titolo, UDA snapshot opzionale, criteri e obiettivi referenziati, sourceKind daily-batch / explicit-activity / future-online, sourceLink verificato; confirmedAt. Nessuna creazione automatica da storico. |
| IndividualEvidenceRevision | evidenceId, revisionId, supersedesRevisionId opzionale, assessmentRevisionId, studentId, criterionRevisionId, outcome, eventuale gradeId di supporto, osservazione breve facoltativa privata, observedOn (data reale), recordedAt, confirmedByTeacher. Id logico unico per alunno/prova/criterio; aggiornamenti append-only; ultima revisione valida, non duplicare nei conteggi. |
| FormativeConclusion (fase S7, non prima) | conclusionId/revisionId, studentId, periodo e cutoff, riferimenti a revisioni effettive, testo modificabile, stato bozza/confermato/superato; conferma docente e impronta locale delle fonti. Separata da eventuale PDF e da delibere. |

### Semantica delle rilevazioni

Outcome discriminato, senza valori impliciti:
- `observed`: scelta docente di un livello presente nella rubrica congelata; oppure descrizione osservabile confermata quando non è prevista rubrica. Se è previsto un risultato quantitativo per criterio, richiede contratto separato di unità, dominio, denominatore e regole; D1 non inventa conversioni.
- `not_observed`: esplicita mancata rilevazione, eventuale motivazione non valutativa.
- `not_applicable`: criterio non pertinente al caso, scelta esplicita; mai usato per mascherare insufficienze.
- Assenza di record = non ancora registrato, non livello zero e non equivalente a not_observed esplicito.

Gli stati A/NC/G del Grade non sono risultati per criterio. Non creare automaticamente evidenze in seguito a voto, presenza, import, apertura scheda o aggiornamento. Se manca voto è comunque possibile registrare un'osservazione didattica per criterio; se manca criterio si conserva la registrazione rapida tradizionale. Non inferire comportamento. In caso di ripensamento, correzione/annullamento esplicito con revisione che conserva lo storico; definire nel contratto eseguibile uno stato di ritiro auditabile (escluso dai conteggi), nessuna cancellazione silenziosa. Niente confronto classificatorio tra alunni.

### Collegamento alla prova e gestione storico

Per prove batch normali: una definizione attiva per batch nel contesto della classe; validare unicità globale del batch, coerenza data/tipo/titolo/periodo/UDA e roster. Una associazione non modifica Grade. In caso di cambiamento dei dati di prova, nuova revisione esplicita; evidenze storiche mantengono la revisione usata. Controllare che gradeId eventuale appartenga a stesso studente, classe e prova. Se la prova è senza voto (laboratorio) usare identità attività autonoma, non creare Grade fittizio. Batch legacy assente o ambiguo: lasciare il voto consultabile, nessun collegamento automatico; eventuale associazione manuale successiva solo su identità verificata e non per titolo/data. Per online: D1 non abilita mapping; D2 separato richiede test revisionato con ID stabili domanda, mapping esplicito confermato e prova della versione consegnata, non semplice indice o titolo; gli esiti preesistenti non vengono reinterpretati.

### Mutazioni e conflitti

Riusare durableMutationCoordinator e commit AppData+meta. Per la nuova cella verificare expected revision e contesto prima di commit, all'interno della coda. Se contesto o fonte cambia durante salvataggio, rifiutare la mutazione non più valida mantenendo bozza e stato precedente; nessun doppio commit per retry. Correzioni dei voti restano sul percorso canonico; non riscrivono risultati per criterio. Operazioni di eliminazione alunno/prova/UDA, trasferimento classe, modifica anno e reset: progettare esplicitamente trattamento dei record dipendenti prima di attivare scritture; bloccare operazioni distruttive che rendono riferimenti orfani finché non esiste procedura sicura autorizzata. Rispettare diritto di cancellazione/procedure d'istituto tramite percorso distinto, non promettere immutabilità assoluta in conflitto con questi obblighi. Non memorizzare testo libero o nominativi nei log, screenshot, provider, telemetria, memoria professionale/semantica o repository.

## 5. Percorso docente: rapido per scelta, approfondito quando serve

1. Tabellone → Oggi → voto e Invio (come oggi). La scelta tipo/argomento al primo voto resta invariata, UDA facoltativa; nessuna modale, nessun criterio obbligatorio. Niente nuovo salvataggio del contesto per ogni alunno.
2. Prepara/Storico → prova selezionata → «Obiettivi e criteri»: associa una volta alla prova; riepilogo leggibile di ciò che si intende osservare, origine visibile al bisogno, conferma. Se fonti assenti, «Definisci un obiettivo» locale; non bloccare la prova semplice.
3. Stesso elenco di classe, azione facoltativa «Rileva per criterio»: un criterio comune alla volta, righe con nominativo protetto quando privacy attiva, scelta del descrittore/livello (dettaglio su richiesta), stato non rilevato/non pertinente; nessun riempimento automatico. Conferma della singola cella solo dopo scrittura durevole; focus e ritorno conservati, nessun dialogo backup per cella. Separare le osservazioni di comportamento.
4. Scheda alunno → «Dossier»: per periodo e obiettivo, mostra fonti, date, descrittori e copertura (es. 2 prove con rilevazione su 3 associate; denominatore definito e non confuso con numero di voti). Non aggregare livelli ordinali con media; mostrare evoluzione cronologica e differenze di criterio/revisione; nessun livello globale senza scelta esplicita e regola documentata.
5. «Restituzione»: proposta locale modificabile, indicare dati mancanti, fonti e limiti, conferma esatta singolo destinatario; se fonti cambiano, bozza da rivedere e documento storico riconoscibile. Riutilizzare PDF dedicato #230, esclusioni, protezione nominativi, nessun invio automatico; PDF locale non cifrato, avviso e canale ufficiale a cura docente previa verifica istituzionale. Nessuna nota interna o dati di compagni.

Schermi 320/390 px, testo 200%, una azione principale, niente schede annidate, simboli con etichetta accessibile e feedback non soltanto cromatico. Verifica umana separata: percorso voto invariato, registrazione criteri utilizzabile con una mano, ritorno, tastiera, blocco e privacy. Non introdurre termini tecnici nella UI. Questo documento non qualifica alcuna schermata.

## 6. Persistenza, compatibilità e sicurezza (gate prima del codice)

- D0 propone estensione opzionale e validatore rigoroso, con assenza come archivio senza evidenze; **nessuna migrazione dei Grade o delle UDA storiche**. Per record presenti, versione nota, unicità, integrità riferimenti/revisioni e tipi; versione sconosciuta o grafo incoerente → stop prima della scrittura, mai normalizzare a vuoto. Distinguere assenza da presenza malformata.
- Backup attuale v6. Prima di qualunque scrittura della nuova struttura, progettare e provare un formato esplicitamente distinguibile (proposta backup v7 con v6/v5/... leggibili dalla nuova app e nessuna evidenza sintetizzata; v6 reader rifiuta v7). Non confondere versione del payload backup, versione del dominio e versione Vault. Audit compatibilità dell'archivio nativo e downgrade: un APK precedente non deve aprire/modificare in modo distruttivo un archivio nuovo; se impossibile garantire, bloccare il rilascio del nuovo schema fino a procedura qualificata. Non dichiarare che il comportamento è già implementato.
- Verifica restore cifrato completo, readback e rollback su errore, copie vecchie e nuove, nessun azzeramento al riavvio. Restore sostitutivo storico deve mostrare anteprima delle evidenze che verranno sostituite/perse, richiedere conferma e backup preventivo secondo policy; non aggiungere merge automatico. Salvataggio e copia esterna distinti.
- Tutte le nuove scritture condividono appData+meta, guardie di sessione, cifratura e conteggio modifiche; prove in coda durante lock, navigazione, errore e ripresa. Nessuna rete richiesta, nessun invio a IA, no costi impliciti. Dati sintetici soltanto in test e artefatti.

## 7. Esempio professionale sintetico — Tecnologia, classe seconda

Scenario didattico inventato per qualificazione, non estratto da un curricolo approvato. UDA «Agricoltura come sistema tecnologico», attività «Filiera a chilometro zero»; definizioni locali: O1 rappresentare relazioni input/processo/output, O2 motivare una scelta rispetto a risorse e impatti. C1 completezza della rappresentazione (O1), C2 motivazione della scelta (O2). Descrittori illustrativi per C1: «Relazioni essenziali da integrare», «Relazioni principali rappresentate correttamente», «Relazioni complete e motivate». Non sono soglie o livelli ufficiali.

| Dato fittizio | Voto | C1 | C2 |
|---|---|---|---|
| Alunno 01 | 8 | Relazioni principali rappresentate correttamente | Non rilevato (esplicito) |
| Alunno 02 | 8 | Nessun record | Motivazione osservata e confermata (descrizione) |
| Alunno 03 | A | Nessun record | Nessun record |
| Alunno 04 | Nessun voto | Relazioni essenziali da integrare, osservate durante laboratorio autonomo | Non pertinente (esplicito) |

Esito atteso: 01 e 02 hanno stesso voto ma evidenze diverse; 03 non ha livelli assegnati; 04 conserva osservazione anche senza voto (prova autonoma, non batch altrui). La restituzione di 01 può riportare il descrittore C1 confermato, non la presunta padronanza di O2. Una correzione successiva di C1 produce revisione storica e aggiorna solo la vista corrente. Se UDA cambia titolo o generazione, il riferimento storico rimane interpretabile. Il bilancio non diventa certificazione ufficiale.

## 8. Incrementi e prove di accettazione (nessuna prova dichiarata eseguita)

| Fase | Consegna | Gate mirato |
|---|---|---|
| D0 | Specifica e revisione indipendente; riconciliare S4a/S4b già integrati | Coerenza fonte/autorità, modello e flusso; decisioni aperte sotto |
| D1a | Contratti puri versionati + corpus sintetico RED→GREEN, nessuna UI | A1–A5, A8–A11 |
| D1b | Persistenza, backup, restore e migrazione compatibili | A6, A7, A10–A12; nessuna scrittura attiva senza gate |
| S5 | Associazione obiettivo/criterio una volta per prova; percorso locale | A1–A4, A8, A13 |
| S6 | Rilevazione per criterio, stessa lista; dossier | A4–A7, A9, A13 |
| S5-online separata | Solo dopo prova di versionamento e identità domanda | A14 |
| S7 | Bilancio e PDF da evidenze validate | A9, A12, A15 |
| S8 | Raccordo Consigli e certificazione come supporto | criteri istituto e norme da verificare separatamente |

Casi minimi:
- A1: fonti mancanti/provvisorie, master diverso, anno/disciplina/classe non coerenti, UDA proiettata ambigua → nessuna promozione o associazione canonica.
- A2: revisione fonte e rigenerazione UDA non modificano definizioni/rilevazioni storiche; ID locale non spacciato per Arena.
- A3: batch univoco accettato; senza batch o incoerente rifiutato come legame automatico; attività senza voto indipendente.
- A4: stesso voto, evidenze diverse; nessuna inferenza da A/NC/G o media; stati distinti e livelli fuori rubrica rifiutati.
- A5: duplicati, grade/student/class mismatch, criterionRevision estraneo, revisioni cicliche/orfane o versione ignota rifiutati; nessun effetto su altre classi.
- A6: correzione revisione attesa, doppio tap/retry, scrittura in corso, errore e lock; precedente intatto o commit unico; nessun indicatore di salvataggio anticipato.
- A7: eliminazione/trasferimento/reset con dipendenze non gestite bloccati; nessun orfano.
- A8: archivio legacy aperto senza riscrittura di Grade, UDA, BehaviorRecord; nessuna evidenza inventata.
- A9: conteggio solo revisioni attive confermate; assenti/non rilevati/non pertinenti distinguibili; nessuna media di livelli ordinali.
- A10: backup v6 e precedenti → nuova app; nuovo backup → nuova app con tutte le revisioni, cifratura, readback; backup nuovo → vecchio reader rifiutato; downgrade archivio nativo verificato o impedito.
- A11: appData/meta atomici; dati malformati o versione sconosciuta mai normalizzati a vuoto; restore error rollback verificato.
- A12: proiezioni esterne, memoria semantica, log e PDF non contengono ID individuali/record altrui; ripristino e protezione anteprime invariati; PDF protetto non equivale ad anonimizzazione.
- A13: HPR mobile sintetica: voto rapido come baseline, una associazione per prova, rilevazione per criterio, conferma, ritorno, 320/390, 200%, tastiera, offline e privacy; confronto numero di azioni con baseline e nessun aggravio del percorso semplice.
- A14: versione test/risposte non verificata o mapping ambiguo → nessuna evidenza per obiettivo; idempotenza import conservata.
- A15: restituzione singolo destinatario da fonti effettive, note interne escluse, cambi fonte rendono revisione necessaria; nessun invio e nessun giudizio automatico.

Prima della promozione: CI canonica exact SHA, RED causale/GREEN, regressioni sicurezza e navigazione, revisione indipendente e HPR reale mirata con soli dati fittizi. Nessuna pubblicazione, uso istituzionale di dati reali o APK aggiornato impliciti.

## 9. Decisioni aperte da ratificare prima di D1

1. Collocazione proposta in appData per classe e confini di identità: confermare con audit di rimozione alunni, gestione anni e compatibilità del vault.
2. Contratto di backup v7 e strategia di downgrade/restore: non implementare fino a test di compatibilità e perdita dati.
3. Stati di ritiro, correzione e revisione: definire forma eseguibile, gestione dei record orfani storici e politica di cancellazione autorizzata.
4. Granularità livelli e criteri: adottare descrittori espliciti confermati, non soglie uniformi; eventuale calcolo quantitativo o certificazione resta fase distinta.
5. Raccordo con produttori: contratto per ID canonici obiettivo e criteri non ancora disponibile/attestato; non blocca il percorso locale, blocca pretesa di import canonico puntuale. Mapping online è fuori D1.
6. Conferma del percorso professionale e revisione indipendente di questa specifica prima della prima PR di codice.

Questo documento è la specifica di lavoro collegata a #231, non una seconda roadmap. #104 rimane autoritativa. Non modificare le definizioni di Beta 2 né accreditare prove non eseguite.
