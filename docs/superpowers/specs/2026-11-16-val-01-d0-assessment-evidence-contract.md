# VAL-01/D0 — Contratto di valutazione formativa integrata (v1 proposta)

Data: 2026-11-16 · Stato: SPECIFICA PROPOSTA, da revisionare; nessuna implementazione, migrazione, release o pubblicazione.
Autorità: #104, #210, #231; continuità #235/#237 e #227/#230; dipendenze #170/#171.
Baseline Registro: `0f6eb66a776ac040131f00214b87e8573d4ee573` (main, successiva al candidato Beta 2 RC2 #283). Applicare AGENTS.md, PRODUCT-QUALITY-01, UX-GOV-01 e OR-001–010. HPR Beta 2 rimane una linea separata.


## 0. Allineamento pedagogico fondativo — D0-PED (16 novembre 2026)

**Stato:** proposta documentale conseguente alla richiesta esplicita del docente. Il fondamento pedagogico precede il contratto tecnico; nessuna nuova autorità curricolare, nessuna deliberazione scolastica implicita. Le fonti personali sono identificate per titolo/data/sezione, non replicate nel repository; non importare documenti riservati, nominativi, o file di valutazione reali.

### 0.1 Repertorio delle fonti recuperate e loro funzione

| ID | Fonte effettivamente consultata | Ambito e statuto |
|---|---|---|
| PED-01 | DocentOS — Documento fondativo di studio, Human has the loop, v1.0 (3 giugno 2026), §§1–3, 5–9, 11 | Visione professionale: evidenza prima del testo, inclusione strutturale, semplicità, responsabilità docente, memoria e revisione. Documento di studio, non delibera. |
| PED-02 | 01_Dossier_Studio_Tecnologia_v1_0.docx (12 giugno 2026), §§1–5 | Fonte-madre istruttoria della revisione: osservare, rappresentare, progettare, produrre, valutare; evidenze di prestazioni e processi, UDL, compiti autentici. |
| PED-03 | 04_UDA_Tecnologia_2026_2027_v1_0.docx (12 giugno), §§1–4; 07_Allegati_Operativi_Tecnologia_v1_0.docx, A–E | Fascicolo delle 12 UDA e schede operative in bozza; UDA 2.1 filiere, prodotti, rubriche, autovalutazione e orientamento. Il documento di giugno ha allegati D/E orientamento/verbale, non confonderli con la numerazione di settembre. |
| PED-04 | 03_Allegati_Operativi_Tecnologia.docx, allegati C–I | Format UDA, rubriche sintetiche, griglia laboratorio, autovalutazione, monitoraggio, verbale e leggibilità. Strumenti adattabili, non scala deliberata. |
| PED-05 | 02_Curricolo_Tecnologia_Aggiornato.docx / bozza Curricolo verticale di Tecnologia, 3 settembre 2026, §§5–11 | Progressione, conoscenze, abilità, competenze, processo/prodotto e valutazione. |
| PED-06 | 00_Relazione_gruppo_Tecnologia.docx (8 settembre 2026), §§3–9; A_Curricolo_verticale_Tecnologia.docx, §§10–12; B_Modello_Unita_di_Apprendimento_Tecnologia.docx, §§3–12; C_Prove_iniziali_Tecnologia_e_griglia.docx, §§1,5–7 | Materiali per esame collegiale, esplicita natura di proposta. Rubrica analitica e sintetica, finalità diagnostica/formativa senza automatismo di voto; inclusione, consuntivo e interventi. La relazione riporta regime per coorte: prima nuovo quadro; seconde/terze continuità del precedente. Non certifica il regime per altri istituti o anni; verifica Arena, fonti normative e criteri deliberati prima dell'uso ufficiale. |
| PED-07 | Valutazione formativa.pdf, Federico Marchetti, pp. 2–4, 6–12 | Materiale di approfondimento: processo, orientamento, feedback bidirezionale, osservazione, autovalutazione e collegialità. Non trattare come testo normativo o protocollo approvato. |
| PED-08 | TRAMA — Dossier ufficiale dell'ecosistema, baseline 23 settembre 2026, §§1–4,7,10–12; [Progettazione didattica universale v1, 25 settembre](https://github.com/antoniocorsano-boop/trama-ecosistema/blob/4d9b7b487f3f920dad54593683b19a742d639b84/docs/architecture/trama-universal-didactic-planning-artifact-orchestration-v1.md), §§3,5,6,14,17–18 | Continuità curricolo → esperienza e riflessione, controllo umano, specifica universale PROPOSED/NO_RUNTIME. Non modifica i ruoli o autorizza integrazioni. |
| PED-09 | curmanlight-docente-os-tecnologia-secondaria-2C.cml-handoff.json (21 settembre 2026); [Arena interopCurriculumContextV2](https://github.com/antoniocorsano-boop/CurManLight_arena/blob/d8b1bf43388cb5c4cdcc940b0c558bb128976c4c/src/domain/transfer/interopCurriculumContextV2.ts) e [pilota ECO02](https://github.com/antoniocorsano-boop/CurManLight_arena/blob/d8b1bf43388cb5c4cdcc940b0c558bb128976c4c/src/domain/transfer/eco02P1Technology2CHandoff.ts) | Esiste un contratto strutturato Arena → Docente OS: CML_LOCAL_HANDOFF_V2 / CML_CURRICULUM_CONTEXT_V1, target DOCENTE_OS, anteprima, accettazione esplicita. Nel file storico il curricolo è PROVISIONAL_COMPLETE e la coorte TRANSITIONAL. Le requirementId e curriculumNodeRef esistono per competenze, obiettivi e conoscenze; non attestano singoli criteri/rubriche, né la vigenza o un contratto Registro. |

Allegati di settembre ulteriori o deliberazioni non recuperati non sono presunti esistenti o approvati. Nessuna trasposizione automatica dei materiali di un istituto nel contesto di un altro. Le fonti di studio orientano la semantica; le fonti ufficialmente adottate, applicabili e versionate determinano l'autorità. Prima di usare una rubrica comune o una scala ufficiale verificare protocollo/atto pertinente e versione; non inventare corrispondenze.

### 0.2 Modello pedagogico unitario e confini

Profilo in uscita / competenze chiave → traguardi → nuclei fondanti → obiettivi (generali/specifici) → conoscenze essenziali e abilità osservabili → competenza attesa nel contesto → situazione-problema, attività e compito → evidenza attesa → evidenza effettiva (processo/prodotto/argomentazione) → interpretazione mediante criteri e rubriche → restituzione, autovalutazione, intervento → nuova osservazione e riprogettazione.

È una rete di relazioni, non un albero gerarchico rigido: un criterio può riferirsi a più obiettivi, un'evidenza a più aspetti ma senza duplicazione statistica, un'esperienza a più nuclei o discipline. La competenza mobilita conoscenze e abilità in situazioni significative; non è la somma o media dei voti. Distinguere progettato/svolto, evidenza attesa/effettiva, fatto osservato/interpretazione, giudizio/proposta/decisione. Una prestazione con supporto è evidenza contestuale, non difetto personale; nessuna graduatoria, profilo psicologico, attribuzione di tratti stabili o penalizzazione automatica per strumenti o adattamenti.

La finalità valutativa va dichiarata per prova/attività: diagnostica (prerequisiti e bisogni), formativa in itinere (feedback e decisioni), eventuale sommativa (bilancio). Autovalutazione/metacognizione è voce distinta dell'alunno e non giudizio docente. La finalità di una prova non genera da sé un voto. Le attività di gruppo conservano la distinzione fra prodotto comune e contributo individuale osservato, non replicano un esito individuale per l'intero gruppo.

Arena conserva autorità e applicabilità; Docente OS progetta compiti, evidenze attese, criteri comunicabili e adattamenti; Atlas fornisce esperienze senza tracciamento individuale; Registro raccoglie solo evidenze locali del docente e sostiene la restituzione. Docente OS può conservare consuntivo e riflessione professionale non personale; nessun dato individuale da Registro verso Docente OS, Arena o Atlas senza un contratto e autorizzazione distinti (non previsti da D0). TRAMA governa la semantica comune. Non generalizzare un repertorio disciplinare Tecnologia a tutte le discipline/ordini; modello estensibile anche a campi di esperienza e percorsi, senza imporre voti o Q1/Q2 agli altri ordini.

### 0.3 Repertori esistenti: riuso, non invenzione

- PED-04, allegato D: rubriche distinte per metodo progettuale, disegno, digitale/IA, sostenibilità e collaborazione. Allegato E: osservazione laboratorio con sicurezza, precisione/metodo, autonomia, collaborazione, documentazione, revisione/miglioramento. Allegato F: riflessione dello studente sul problema, soluzione, saperi utilizzati, riuscita, miglioramento e responsabilità. Allegato G: monitoraggio e interventi; H: decisioni; I: chiarezza e osservabilità.
- PED-06, A §10: otto dimensioni (conoscenze e lessico; analisi e problema; progetto e metodo; misura e rappresentazione; realizzazione e sicurezza; dati e digitale; verifica e sostenibilità; autonomia e collaborazione). B §10: sette dimensioni del format con evidenza, strumento e peso/funzione; B §11: rubrica sintetica complessiva; C §5: cinque indicatori diagnostici. Non appiattire questi tre strumenti: ciascuno ha finalità, contesto e descrittori specifici.
- Scale di lavoro: Iniziale/Base/Intermedio/Avanzato (PED-04) e In via di prima acquisizione/Base/Intermedio/Avanzato (PED-06). Identità distinte per repertorio e versione; non equiparare automaticamente nemmeno le etichette simili, non tradurre numeri 1–4 in voti, non trasformare la rubrica sintetica in media dei criteri. D1 deve supportare descrittori personalizzati/confermati, non una scala hardcoded. Nessuna attribuzione ufficiale senza delibera verificata.
- Il docente seleziona soltanto i criteri pertinenti e li comunica prima dell'attività. Proposte di repertorio riusabili (non assegnazioni automatiche); registrazione minima invariata. Rubrica selezionata e revisionata una volta per prova, senza ripetere la configurazione per ogni studente.

### 0.4 Rettifica della diagnosi di interoperabilità

I contratti attualmente consumati da Registro v1 rimangono limitati come descritto in §2. Tuttavia PED-09 smentisce una lettura assoluta di «nessun ID puntuale esistente nell'ecosistema»: Arena ha già un contratto upstream che distingue COMPETENCE, GENERAL_OBJECTIVE, SPECIFIC_LEARNING_OBJECTIVE, ESSENTIAL_KNOWLEDGE, INSTITUTIONAL_REQUIREMENT con requirementId, curriculumNodeRef, sourceRefs, authorityLevel, coverageRequired e curriculumVersionRef. La vigenza/approvazione non deriva da authorityLevel o dal completamento per progettazione. Gli identificativi sono riferimenti da risolvere insieme al contesto/versione, non equivalenze universali tra revisioni.

Prima di inventare un nuovo identificativo canonico, auditare il produttore e il consumer Docente OS del CML_LOCAL_HANDOFF_V2, la relazione con CurriculumSnapshot/il master attuale e la corrispondenza per coorte/istituto/disciplina. Non passare un payload destinato a DOCENTE_OS al parser Registro, non cambiare target, non promuovere la proiezione storica a curricolo vigente. Progettare un adapter/handoff minimizzato separato, con corpus positivo e negativo e prova di autorità; riuso dei riferimenti esistenti preferito a nuovi ID. Fino a qualifica, percorso locale con origine esplicita e senza duplicazione di autorità. Nessun import automatico. Non bloccare il voto rapido o il lavoro locale per l'assenza dell'adapter.

### 0.5 Matrice di allineamento con D0 e decisioni per D1

| Requisito derivato | Copertura D0 originaria | Integrazione progettuale richiesta |
|---|---|---|
| Nuclei, traguardi, competenze chiave, conoscenze e abilità | Obiettivo e riferimenti annualità | Riferimento semantico tipizzato e revisionato, distinguere obiettivi e competenza attesa; non duplicare il master. |
| Finalità diagnostica/formativa/sommativa | Prova e periodo | Finalità esplicita per definizione; prova diagnostica senza voto possibile; nessuna conversione automatica. |
| Processo/prodotto e prestazione | Criteri e outcome | Tipologia di evidenza, fase di attività, contesto/strumento, descrizione osservabile o livello; supporti e fonte minima, senza obbligo di allegati. |
| Rubriche e griglie comuni | Revisioni rubriche | Repertorio di modelli versionati con provenienza/stato e selezione docente, non tutti i criteri sempre attivi. |
| Inclusione e differenziazione | Non specificata | Adattamento del compito/obiettivo/strumento e contesto di supporto; prodotti equivalenti. Non registrare diagnosi/PEI/PDP come prerequisito né inferire capacità. Dettagli sensibili esclusi da questo dominio; futuro contratto autorizzato separato. |
| Portfolio | Evidenze e dossier | Vista cronologica degli stessi record, con eventuale riferimento minimo a prodotto locale autorizzato; niente allegati binari o immagini persone in D1; nessun secondo archivio. |
| Autovalutazione e metacognizione | Domanda nella restituzione | In futuro risposta facoltativa e attribuzione esplicita all'alunno, raccolta locale mediata dal docente; non scambiare per livello osservato, nessun account/tracking Atlas. |
| Feedback e riprogettazione | Bilancio | Osservazione → feedback concreto → azione di miglioramento → nuova evidenza; distinguere intervento previsto/svolto ed esito, anche assenza di evidenza. S7/CDC/DOC e raccordo professionale non personale. |
| Collegialità e monitoraggio | S8 | Criteri deliberati e livelli confermati, aggregati con denominatori di copertura, distinguere dati di classe e decisione collegiale. Nessuna equivalenza normativa presunta. |

**Decisione progettuale da revisionare:** D1a deve modellare almeno finalità valutativa, riferimento semantico tipizzato, evidenza attesa vs effettiva, processo/prodotto/prestazione, rubrica con origine, contesto di rilevazione e supporti in forma minima. D1b resta dedicata alla sicurezza. Portfolio come vista sulle evidenze; risposta di autovalutazione, interventi, feedback e bilancio sono incrementi successivi, ma D1a non deve impedirne i riferimenti. Nessuna implementazione massiva o interfaccia aggiuntiva per ognuno di questi concetti. Precisare insieme al revisore i campi indispensabili del nucleo puro prima della ratifica; non implementare dati sensibili o integrazioni premature.

### 0.6 Esempi e criteri aggiuntivi di accettazione pedagogica

Scenario di prova derivato da PED-03 (UDA 2.1) e PED-06/B, non equivalenza automatica a una UDA canonica o a un curricolo vigente: rappresentare una filiera alimentare locale, motivare alternative, documentare il processo. Esempio interamente sintetico: evidenza di processo (pianificazione/revisione), prodotto (schema o spiegazione equivalente), argomentazione (scelta motivata); un prodotto comune di gruppo non attribuisce un livello identico a tutti. Un alunno che utilizza un mediatore visivo può dimostrare lo stesso obiettivo; il supporto è contesto, non penalità. Prova iniziale senza voto con esito per indicatore e azione di recupero, seguita da nuova osservazione. L'autovalutazione può motivare la revisione, non sostituire il giudizio. I dati non rilevati non producono livelli.

- P1: prova diagnostica senza voto; un voto preesistente non cambia per aggiunta di evidenza. Nessuna classifica.
- P2: stessa evidenza attesa, prodotto equivalente e modalità diversa; valutare l'obiettivo pertinente, non la disponibilità di strumenti, né dedurre diagnosi.
- P3: prodotto di gruppo e osservazione individuale distinti; autonomia/collaborazione solo se rilevate e contestualizzate.
- P4: rubrica di giugno/strumento diagnostico di settembre hanno identità/versioni distinte, anche se etichette comuni; nessun mapping di livelli implicito.
- P5: fonti CML upstream con coorte/transizione/versione discordante o target DOCENTE_OS non autorizzato rifiutate dal percorso Registro; non promuovere storico/provvisorio. Nessuna invenzione di ID o criterio ufficiale.
- P6: dossier/portfolio riutilizza evidenze esistenti senza raddoppiare conteggi; autovalutazione attribuita separatamente; assenza ≠ insufficienza.
- P7: feedback e intervento riferiti a evidenza/obiettivo, nuova osservazione e consuntivo; docente conferma, nessuna generazione automatica di tratti o giudizi.
- P8: un contesto senza repertorio ufficiale può usare criteri locali espliciti; niente penalizzazione, niente regressione del voto rapido. HPR confronta percorso ordinario e approfondito.
- P9: separare modello didattico generale da verticale Tecnologia; test di generalità su un caso non Tecnologia e uno senza voto, senza dichiarare certificazione o universalità raggiunta.

Questi nove casi integrano A1–A15; non sono test già eseguiti. Revisione pedagogica e revisione tecnica del nuovo SHA richieste prima di D1a. L'approvazione della direzione non equivale a ratifica automatica di schema, criteri istituzionali, pubblicazione o trattamento di dati scolastici reali.


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
| [docenteOsTeachingProjection](../../../src/planning/docenteOsTeachingProjection.ts) e [fixture sintetica](../../contracts/fixtures/docente-os-registro-teaching-projection-v1.json) | DOCENTE_OS_REGISTRO_TEACHING_PROJECTION_V1: proiezione sola lettura, sourceSectionId, projectedUdaId, sourceUdaRef, canonicalGenerationId, title/focus/period/packRefs; riconciliazione classe separata. | Il formato destinato a Registro non contiene obiettivi/criteri strutturati. Vedi PED-09 per il contratto upstream con identificativi esistenti. Non cambiare il formato v1 né dedurre ID da title/focus. La fixture usa provenienza sintetica, non prova di disponibilità di export reale. |
| [backupPayload](../../../src/security/backupPayload.ts), [secureAppStorage](../../../src/security/secureAppStorage.ts) | Backup v6, lettori storici, snapshot completo, appData+meta atomici, convalida e readback/rollback restore. | Nuovo dominio deve avere convalida pre-write e pre-restore; mai perdere campi ignoti silenziosamente. |
| [formativeRestitution](../../../src/report/formativeRestitution.ts), [competencySemantics](../../../src/analytics/competencySemantics.ts) | Riepilogo voti con pesi, testo docente, PDF protetto nei nominativi; indicatori di copertura e raccomandazione numerica. | Estendere in seguito con evidenze realmente rilevate, conservando separazione da medie e note private. |

**Verifica a monte Arena:** [handoff ufficiale del progetto](https://github.com/antoniocorsano-boop/CurManLight_arena/blob/d8b1bf43388cb5c4cdcc940b0c558bb128976c4c/docs/architecture/ARENA_REGISTRO_PLANNING_HANDOFF_V1.md), [fixture Tecnologia classe I](https://github.com/antoniocorsano-boop/CurManLight_arena/blob/d8b1bf43388cb5c4cdcc940b0c558bb128976c4c/docs/contracts/fixtures/arena-registro-planning-context-tech-grade1.json). La fixture è PROVISIONAL_COMPLETE/NON_VIGENTE, master 1.3, fingerprint di scope MASTER; non è prova di approvazione corrente, né fonte di ID obiettivo. Non trasferire il contesto della prima alla seconda. Il produttore Docente OS (main 27e20e72454eafb0cf8212f61422f02dc6a60d6e) non ha fornito in questa ricognizione un export strutturato obiettivo/criterio direttamente verificato: la specifica usa il contratto consumer effettivo, non presume capacità del produttore. Prima di ogni scambio nuovo, verifica producer/consumer con corpus e specifica separata.

## 3. Autorità e ancoraggio delle fonti

Arena è autorità del curricolo; Docente OS della progettazione professionale proiettata; Atlas delle esperienze pubblicate; Registro delle rilevazioni private. Conservare il contesto accettato senza leggere dati alunni da altri prodotti. Per un riferimento Arena distinguere master, versione, fingerprint di scope MASTER, sourceCommit, sourceDocumentId/sourceRevisionId, itemId, sezione e stati di applicabilità/autorità/vigenza. Se non approvato e vigente con ricevuta, mostrare «Riferimento provvisorio», non presentarlo come curricolo ufficiale; D1 deve bloccare la qualifica ufficiale di tali riferimenti. L'accettazione del docente non cambia l'autorità Arena.

D0 propone due origini dei riferimenti didattici tipizzati: (a) **obiettivo locale definito/confermato dal docente**, con id locale stabile, revisione, testo e facoltativo riferimento documentale all'annualità accettata; (b) riferimento puntuale canonico da riusare (vedi PED-09), disponibile in Registro soltanto con contratto di trasferimento esplicito, ID e revisione verificati. Non usare hash del testo come ID canonico. Riferimenti e obiettivi locali possono essere utilizzati per il lavoro professionale anche senza fonte a monte; restano etichettati come locali, non come curricolo approvato. Nessun trasferimento di obiettivi/criteri che contengano note individuali, nessun identificativo studente all'esterno.

Docente OS: projectedUdaId è legato alla generazione e alla sezione; per agganciarlo richiedere classe riconciliata univocamente, anno/ordine/disciplina coerenti e decisione esplicita. Conservare sourceUdaRef, projectedUdaId, canonicalGenerationId, projectionFingerprint e sourceCommit, senza dedurre equivalenza fra rigenerazioni. Per UDA locale conservare id, classe e snapshot minimo di titolo/revisione locale; non usare className come chiave del nuovo dominio. Nuova versione della UDA o del curricolo non riscrive evidenze storiche. Se la fonte scompare, mostrare «Riferimento storico» con testo congelato e provenienza, non rimappare per somiglianza.

## 4. Modello candidato (logico, non codice implementato)

Collocazione proposta: `ClassData.assessmentEvidenceV1?` (documento versionato dentro appData cifrato), per sfruttare il confine atomico appData+meta e mantenere la classe come limite di integrità. Entità distinte, identificatori opachi locali. Per tutti i record: schoolYear canonico YYYY/YYYY, classId stabile, subjectCode risolto e confermato; nessuna deduzione da nome. Verificare coerenza del profilo e data/periodo effettivo; Q1/Q2 dei Grade restano invariati, eventuali nuovi periodi non si mappano implicitamente. Nessun archivio parallelo di voti.

| Entità proposta | Campi minimi e regole |
|---|---|
| LearningReferenceRevision (generalizza ObjectiveRevision) | referenceId, revisionId, kind (competenza, obiettivo generale/specifico, conoscenza, abilità, traguardo, nucleo, competenza chiave o requisito), testo congelato, sourceKind local/arena-point (disabilitato finché manca contratto Registro), origine e versione, eventuale riferimento annualità/authority sopra, confirmedAt. Revisioni append-only. Kind non implica mapping CML automatico; non tutti i riferimenti sono obiettivi direttamente valutabili. |
| CriterionRevision | criterionId, revisionId, descrittore osservabile, targetReferenceRevisionIds non vuoti e univoci (obiettivi o competenze attese esplicitamente operazionalizzati), contextualReferenceRevisionIds facoltativi. Criterio = ciò che si osserva, non voto. La rubrica è selezionata nel legame della prova, non dal criterio, evitando dipendenze cicliche. |
| RubricRevision | rubricId, revisionId, origine (locale, repertorio di studio, repertorio istituzionale verificato), sourceRef/versione/stato ed eventuale atto di adozione applicabile, criteri revisionati e livelli con levelId, etichetta e descrittore per criterio, ordine esplicito senza conversione in numeri; conferma docente. Livello identificato nel contesto esatto criterio+rubrica+revisione; AV/IN/BA/PA non automaticamente equivalenti. |
| AssessmentDefinitionRevision | assessmentId, revisionId, classId/anno/disciplina, data, periodo, tipo canonico, titolo, finalità dichiarata diagnostica/formativa/sommativa (uso esplicito, nessun default sommativo), UDA snapshot opzionale, riferimenti didattici, legami univoci criterio+rubrica opzionale, evidenza attesa per criterio (descrizione, tipo processo/prodotto/prestazione/argomentazione, modalità o strumento), sourceKind daily-batch / explicit-activity / future-online, sourceLink verificato; confirmedAt. Stato pianificata/svolta/annullata e data effettiva confermati; nessuna inferenza da voto o apertura. Nessuna creazione automatica da storico. |
| IndividualEvidenceRevision | evidenceId, revisionId, supersedesRevisionId opzionale, assessmentRevisionId, observationEventId, studentId, criterionRevisionId, evidenza effettiva (tipo, fatto osservabile minimo, modalità/strumento, eventuale fase, riferimento locale facoltativo a prodotto anche comune), contesto di supporto didattico minimo opzionale (no diagnosi), outcome interpretativo separato, eventuale gradeId, observedOn, recordedAt, confirmedByTeacher. Unicità per classe/alunno/assessmentId/criterionId/observationEventId; nuova osservazione = nuovo evento e identità; correzione = stesso evidenceId e nuova revisione. Nessun livello individuale da prodotto comune senza contributo osservato. |
| FormativeConclusion (fase S7, non prima) | conclusionId/revisionId, studentId, periodo e cutoff, riferimenti a revisioni effettive, testo modificabile, stato bozza/confermato/superato; conferma docente e impronta locale delle fonti. Separata da eventuale PDF e da delibere. |

### Semantica delle rilevazioni

Outcome discriminato, senza valori impliciti:
- `observed`: fatto osservabile minimo effettivamente documentato, anche mediante selezione strutturata di una prestazione concreta o annotazione breve. Interpretazione distinta: non ancora espressa, oppure livello scelto dal docente nella rubrica congelata, oppure giudizio descrittivo confermato senza rubrica. Il livello non è il fatto osservato e non può inventarlo. Se è previsto un risultato quantitativo per criterio, richiede contratto separato di unità, dominio, denominatore e regole; D1 non inventa conversioni.
- `not_observed`: esplicita mancata rilevazione, eventuale motivazione non valutativa.
- `not_applicable`: criterio non pertinente al caso, scelta esplicita; mai usato per mascherare insufficienze.
- `withdrawn`: ritiro motivato e confermato di un record precedente, conserva la catena di revisioni; escluso dai conteggi. Gli stati non osservato, non pertinente e ritirato non hanno livelli interpretativi attivi.
- Assenza di record = non ancora registrato, non livello zero e non equivalente a not_observed esplicito.

Gli stati A/NC/G del Grade non sono risultati per criterio. Non creare automaticamente evidenze in seguito a voto, presenza, import, apertura scheda o aggiornamento. Se manca voto è comunque possibile registrare un'osservazione didattica per criterio; se manca criterio si conserva la registrazione rapida tradizionale. Non inferire comportamento. In caso di ripensamento, correzione/annullamento esplicito con revisione che conserva lo storico; definire nel contratto eseguibile uno stato di ritiro auditabile (escluso dai conteggi), nessuna cancellazione silenziosa. Niente confronto classificatorio tra alunni.

### Collegamento alla prova e gestione storico

Per prove batch normali: una definizione attiva per batch nel contesto della classe; validare unicità globale del batch, coerenza data/tipo/titolo/periodo/UDA e roster. Una associazione non modifica Grade. In caso di cambiamento dei dati di prova, nuova revisione esplicita; evidenze storiche mantengono la revisione usata. Controllare che gradeId eventuale appartenga a stesso studente, classe e prova. Se la prova è senza voto (laboratorio) usare identità attività autonoma, non creare Grade fittizio. Batch legacy assente o ambiguo: lasciare il voto consultabile, nessun collegamento automatico; eventuale associazione manuale successiva solo su identità verificata e non per titolo/data. Per online: D1 non abilita mapping; D2 separato richiede test revisionato con ID stabili domanda, mapping esplicito confermato e prova della versione consegnata, non semplice indice o titolo; gli esiti preesistenti non vengono reinterpretati.

### Mutazioni e conflitti

Riusare durableMutationCoordinator e commit AppData+meta. Per la nuova cella verificare expected revision e contesto prima di commit, all'interno della coda. Se contesto o fonte cambia durante salvataggio, rifiutare la mutazione non più valida mantenendo bozza e stato precedente; nessun doppio commit per retry. Correzioni dei voti restano sul percorso canonico; non riscrivono risultati per criterio. Operazioni di eliminazione alunno/prova/UDA, trasferimento classe, modifica anno e reset: progettare esplicitamente trattamento dei record dipendenti prima di attivare scritture; bloccare operazioni distruttive che rendono riferimenti orfani finché non esiste procedura sicura autorizzata. Rispettare diritto di cancellazione/procedure d'istituto tramite percorso distinto, non promettere immutabilità assoluta in conflitto con questi obblighi. Non memorizzare testo libero o nominativi nei log, screenshot, provider, telemetria, memoria professionale/semantica o repository.


### 4.1 Chiarimenti emersi dalla rilettura critica D0-PED (16 novembre 2026)

Queste precisazioni si applicano alle entità della tabella e ai casi A1–A15/P1–P9; sono una proposta da revisionare, non un'implementazione.

- **Identità temporale:** un evento di osservazione corrisponde a una rilevazione effettiva, identificata esplicitamente, anche se ripetuta nello stesso giorno. Una correzione mantiene identità, contesto e catena lineare (una sola testa attiva); non sostituisce una nuova prestazione. Un retry riusa identità/evento; non crea un evento aggiuntivo. Dossier: conserva osservazioni distinte, conta una sola volta ciascun evento valido; mostra la cronologia, non riduce la crescita all'ultimo livello.
- **Fatto e interpretazione:** evidenza attesa appartiene alla definizione di prova; il fatto effettivo è registrato solo quando osservato. L'interpretazione può essere successiva, revisionata o assente; nessun giudizio dedotto dal semplice completamento, supporto utilizzato o voto. Per il percorso rapido per criterio, consentire selezione di un fatto concreto preconfigurato, con annotazione opzionale; niente obbligo di digitare testo a ogni cella. La scelta di un descrittore interpretativo non basta se non attesta anche un fatto effettivamente osservato. La registrazione del voto rimane invariata.
- **Attività cooperative:** il riferimento locale a un prodotto comune può essere riusato senza replicare allegati; ciascuna rilevazione individuale richiede fatto/contributo pertinente documentato. Nessun punteggio comune propagato automaticamente; nessun archivio nominativo aggiuntivo di gruppi in D1a. Quando il contributo non è osservabile, stato appropriato senza livello.
- **Rubriche e contesto:** selezione per finalità, criterio e revisione, con provenienza e stato; i livelli non sono intercambiabili fra repertori. I supporti sono condizioni didattiche minime e facoltative (es. modalità visiva, orale, manipolativa), mai diagnosi, etichette personali o motivazioni sanitarie. D1a prepara il riferimento alla differenziazione, non apre un archivio PEI/PDP. Distinguere obiettivo comune con modalità equivalente e obiettivo personalizzato esplicitamente definito.
- **Copertura:** denominatore di opportunità effettivamente svolte e pertinenti per alunno/obiettivo, non numero di prove pianificate o voti. Le opportunità di rilevazione vanno confermate esplicitamente prima di mostrare una percentuale; in assenza di denominatore verificato mostrare solo numero di evidenze e copertura non determinabile. Non sommare la stessa opportunità a ogni criterio o revisione; escludere annullate/non pertinenti, mantenere separate non rilevate e non ancora registrate.
- **Confine D1a/D1b:** D1a definisce tipi, validatore puro e corpus sintetico; non aggiunge scritture, storage, UI, allegati o dati reali. D1b qualifica il confine persistente, incluse eliminazione/trasferimento, backup, ripristino, compatibilità e downgrade prima di qualsiasi attivazione. Il formato e la collocazione restano decisioni aperte; non assumere che il lettore legacy rifiuti automaticamente i nuovi dati: provarlo. Riferimenti futuri per feedback, autovalutazione e intervento non significano implementazione immediata.

**Estensione dei casi già previsti:** A5/A6 verificano catene lineari, eventi distinti, correzione e retry idempotente; P2/P3 verificano contesto/supporti non penalizzanti e prodotto collettivo distinto da contributo; P4 verifica legame rubrica-criterio-revisione; A9/P6 verificano fatto senza interpretazione, assenza di denominatore e opportunità non duplicate; P7 verifica osservazione successiva a intervento, non sostituzione del passato. La revisione del presente modello non attribuisce PASS ai test di comportamento futuri.

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
5. Raccordo con produttori: identificativi puntuali già presenti nel CML upstream verso Docente OS (PED-09); contratto qualificato di trasferimento a Registro e repertorio criteri non ancora attestati; non blocca il percorso locale, blocca pretesa di import canonico puntuale. Mapping online è fuori D1.
6. Conferma del percorso professionale e revisione indipendente di questa specifica prima della prima PR di codice.

Questo documento è la specifica di lavoro collegata a #231, non una seconda roadmap. #104 rimane autoritativa. Non modificare le definizioni di Beta 2 né accreditare prove non eseguite.
