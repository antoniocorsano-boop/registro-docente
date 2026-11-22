# AI Teacher Copilot v1 — Product & Architecture Design

**Status:** DRAFT — human approval required before implementation planning  
**Repository baseline:** `main@315c467494fbdc7d4185863410483c96dc79899c`  
**Scope:** `registro-docente`  
**Date:** 2026-10-26

## 1. Intent

Trasformare il Copilota da router governato di poche azioni in un **layer intelligente trasversale dell'intero Registro**, mantenendo inalterati privacy-first, autorità del docente, fail-closed e persistenza governata.

Il docente deve poter partire prevalentemente dall'obiettivo espresso in linguaggio naturale, senza essere obbligato a conoscere la struttura interna dell'app. Le schermate tradizionali restano pienamente utilizzabili: il Copilota è **punto di ingresso principale ma non esclusivo**.

North star:

> Il docente dice cosa vuole ottenere. Il Copilota comprende il contesto corrente, recupera solo ciò che serve, propone o prepara il risultato, attraversa le funzioni dell'app necessarie e chiede conferma quando sta per produrre un effetto persistente, sensibile o economicamente rilevante.

## 2. Decisioni di prodotto approvate

1. Architettura a **due livelli**:
   - **L1 — Orchestrazione intelligente**: comprende l'obiettivo e usa funzioni già qualificate dell'app.
   - **L2 — Generazione governata**: crea bozze/artefatti quando il risultato non esiste ancora.
2. Il Copilota è **principale ma non obbligatorio**: nessuna funzione tradizionale viene rimossa.
3. Il Copilota può essere **proattivo**, ma solo con suggerimenti ad alta pertinenza e progressive disclosure.
4. Il sistema include una **memoria professionale** del lavoro docente.
5. La memoria può apprendere dalle decisioni del docente (adozioni, modifiche, rifiuti, riusi) senza usare dati personali degli studenti.
6. L'uso AI deve essere **token/cost efficient**: memoria ricca nel sistema, contesto piccolo nel prompt.
7. Il **budget AI è configurabile e dinamico**; l'escalation può essere autorizzata per singola operazione o temporaneamente per attività/sessione.
8. Le azioni a basso rischio, reversibili e privacy-safe possono essere eseguite autonomamente; **qualsiasi scrittura persistente o modifica reale richiede decisione del docente**.
9. Privacy-first è gerarchicamente superiore ad autonomia, comodità e qualità generativa.
10. **Nessun modello remoto riceve dati riferibili a singoli studenti, nemmeno pseudonimizzati.** Sono ammessi solo contesto professionale del docente, contenuti didattici autorizzati e dati aggregati realmente non identificabili.
11. Strategia di delivery: **evoluzione incrementale dell'architettura attuale**, non riscrittura agentica separata.

## 3. Goals

### G1 — Intent-to-outcome
Portare una richiesta autentica del docente fino a un risultato utile, non solo fino al riconoscimento dell'intento.

### G2 — Cross-surface context
Rendere il Copilota consapevole della superficie corrente e del contesto disponibile: classe, UDA, lezione, programmazione, Biblioteca, verifiche e altri domini professionali compatibili.

### G3 — Governed generation
Generare nuovi artefatti soltanto come proposte effimere, revisionabili e adottabili dal docente.

### G4 — Professional continuity
Usare memoria professionale e decision history per ridurre ripetizioni, ritrovare materiali utili e riconoscere continuità tra attività, UDA e anni scolastici.

### G5 — Proactivity without noise
Suggerire opportunità concrete solo quando la pertinenza è alta, senza notifiche continue e senza interrompere il flusso di lavoro.

### G6 — Cost-aware intelligence
Usare il livello minimo di capacità AI sufficiente al compito; aumentare costo/contesto/modello solo quando il valore atteso lo giustifica.

## 4. Non-goals

- Nessun agente autonomo con libertà generale di mutare il Registro.
- Nessuna sostituzione delle schermate tradizionali con una chat-only UI.
- Nessuna memoria globale opaca delle conversazioni.
- Nessuna profilazione personale del docente oltre preferenze professionali esplicitamente consentite.
- Nessun uso remoto di dati individuali studente.
- Nessuna pubblicazione, valutazione, invio o modifica persistente senza decisione umana quando l'effetto esce dallo stato effimero.
- Nessun aumento di token come scorciatoia per evitare retrieval, caching o strutture locali.

## 5. Anti-goals

Il progetto è considerato fallito se il Copilota:

- diventa un semplice menu di comandi mascherato da linguaggio naturale;
- richiede al docente di conoscere action id, capability o struttura tecnica;
- produce suggerimenti continui e poco pertinenti;
- aumenta fortemente latenza o costi per richieste semplici;
- crea una seconda fonte di verità rispetto ai domini esistenti;
- aggira il Contextual Copilot Core o i Durable Mutation contract;
- introduce dati studente in prompt, log, telemetria o memoria AI remota;
- modifica contenuti persistenti perché "ha capito l'intento" senza un'esplicita decisione docente.

## 6. Approcci considerati

### A. Evoluzione incrementale del Copilota attuale — **SCELTO**
Estendere progressivamente l'architettura `intent -> Core -> capability -> proposal/action -> human decision -> persistence`.

**Pro:** preserva i contratti qualificati, consente vertical slice piccole, TDD causale e rollout reversibile.  
**Contro:** richiede disciplina architetturale per evitare crescita organica disordinata.

### B. Nuovo runtime agentico centrale
Un nuovo agente usa il Registro come collezione di tool.

**Scartato:** duplica o rischia di bypassare governance e persistenza appena stabilizzate.

### C. AI-first radicale
Conversazione come UI primaria e schermate come tool richiamati dall'agente.

**Scartato per ora:** troppo prematuro; resta una possibile direzione futura se l'approccio A dimostra valore reale.

## 7. Architecture principles

### 7.1 One Copilot, many surfaces
Esiste **un solo Copilota concettuale**. Ogni superficie produce un `CopilotLaunchContext` / context snapshot più ricco, non un copilota separato.

### 7.2 Understand != authorize != execute
Tre passaggi distinti:

1. **Understand** — l'interprete identifica obiettivo, riferimenti e necessità di chiarimento.
2. **Authorize** — il Core determina se una capability è consentita nel contesto corrente.
3. **Execute/Propose** — un executor locale o remoto produce una proposta oppure esegue un'azione low-risk autorizzata.

Il modello remoto non possiede autorità di scrittura.

### 7.3 Local-first context assembly
Prima di qualunque chiamata remota:

1. classificare i dati;
2. risolvere il contesto localmente;
3. recuperare solo elementi pertinenti;
4. comprimere/sintetizzare dove possibile;
5. verificare policy privacy;
6. stimare budget/costo;
7. chiamare il provider solo se necessario.

### 7.4 Proposal-first generation
Gli output generativi entrano sempre come **draft/proposal**, mai direttamente come stato canonico.

### 7.5 Persistence boundary
Navigazione, retrieval, ranking, confronto, contestualizzazione e bozze effimere possono essere automatici se low-risk. Ogni mutazione persistente passa da una decisione docente.

## 8. Privacy architecture

### 8.1 Data classes
Il sistema deve distinguere almeno:

- `TEACHER_PROFESSIONAL` — materiale professionale del docente;
- `CURRICULUM/PLANNING` — contesto curricolare e programmazione;
- `PUBLIC/EXTERNAL_CONTENT` — materiale pubblico acquisito dal docente;
- `AGGREGATED_NON_IDENTIFIABLE` — aggregati non ricostruibili a livello individuale;
- `STUDENT_PERSONAL` — qualsiasi dato riferibile a singolo studente;
- `AMBIGUOUS` — contenuto non classificabile con sicurezza.

### 8.2 Remote rule
`STUDENT_PERSONAL` è **remote-denied** senza eccezioni, inclusa pseudonimizzazione. `AMBIGUOUS` è fail-closed finché il docente non classifica o il sistema non può dimostrare una classe consentita.

### 8.3 Data minimization
Anche per classi consentite il provider riceve soltanto il sottoinsieme minimo necessario al compito.

### 8.4 Logs and diagnostics
Diagnostica e telemetria, se presenti, registrano codici, metadati tecnici e metriche aggregate; mai prompt completi, contenuti studente o documenti integrali salvo opt-in esplicito e policy dedicata.

### 8.5 Compliance gate
Ogni nuova capability che amplia il trattamento remoto, le classi di dati, la persistenza della memoria o le integrazioni esterne richiede **privacy/compliance review prima dell'abilitazione**. L'implementazione deve rispettare i regolamenti applicabili e le policy del sistema; il Copilota non può estendere per inferenza un consenso o una base di trattamento esistente.

Le superfici che contengono dati studente possono fornire al Copilota soltanto un **context projection sanitizzato** che esclude dati individuali prima di qualsiasi confine remoto.

## 9. Professional memory

### 9.1 Purpose
Ricordare il lavoro professionale già svolto per ridurre ripetizioni e migliorare continuità e rilevanza.

### 9.2 Memory layers

**Event memory locale**
- proposta adottata/rifiutata/modificata;
- materiale riutilizzato;
- collegamento fonte-UDA;
- artefatto creato;
- preferenza professionale osservabile e consentita.

**Consolidated professional memory**
Riepiloghi compatti derivati da molte decisioni, es. preferenze di formato o pattern didattici, senza cronologia conversazionale completa.

**Retrieved working set**
Per ogni richiesta vengono caricati soltanto pochi elementi pertinenti.

### 9.3 Memory choice
Il docente può configurare categorie da ricordare automaticamente oppure scegliere `Ricorda questo`. Contenuti ambigui richiedono decisione esplicita.

### 9.4 Never-memory
Dati personali studente, valutazioni individuali, comportamenti, informazioni sanitarie, PEI/PDP e altri dati individualizzanti non entrano nella memoria professionale AI.

### 9.5 Memory controls
La memoria professionale deve essere:

- **privata** e local-first per default;
- **ispezionabile**: il docente può vedere che cosa il sistema sta ricordando;
- **correggibile**: una preferenza o sintesi inferita può essere modificata;
- **rimovibile**: singoli elementi/categorie possono essere cancellati;
- **disattivabile per categoria**;
- dotata di provenienza sufficiente a distinguere fatto professionale, decisione esplicita e inferenza consolidata.

La rimozione dalla memoria professionale non deve cancellare automaticamente il documento/UDA/artefatto canonico da cui l'informazione deriva.

## 10. AI budget governor

### 10.1 Objective
Minimizzare costo e token senza degradare inutilmente la qualità.

### 10.2 Resolution ladder
Ordine preferenziale:

1. regole/local deterministic resolution;
2. retrieval e memoria locale;
3. cache di risultati già qualificati;
4. modello remoto economico con contesto minimo;
5. escalation a contesto/modello/elaborazione più costosi solo se il task lo richiede.

### 10.3 User control
Profilo di base configurabile (nomenclatura UI da definire in design UX). Se una richiesta supera la soglia configurata, il sistema propone:

- **Autorizza solo questa operazione**;
- **Autorizza per questa attività/sessione**.

Le autorizzazioni temporanee scadono automaticamente. Nessuna escalation permanente implicita.

### 10.4 Explainability
La richiesta di escalation deve spiegare in linguaggio docente perché serve più capacità, non esporre token, temperature o dettagli di provider salvo area tecnica dedicata.

## 11. Proactivity model

Il Copilota può generare suggerimenti spontanei solo quando:

1. il contesto è sufficientemente risolto;
2. l'opportunità è concretamente azionabile;
3. la confidenza supera una soglia alta;
4. il suggerimento non richiede dati vietati;
5. non replica suggerimenti recentemente ignorati;
6. il suggerimento può essere ignorato senza conseguenze.

Pattern UI: segnale discreto -> breve ragione -> dettaglio/azione soltanto su apertura.

### 11.1 Background-cost rule
La proattività deve essere **local-first e event-driven**. Non deve generare chiamate remote continue o polling generativo in background. Il provider remoto può essere coinvolto solo quando un trigger locale ha già individuato un'opportunità plausibile e la policy/budget lo consente; per default la semplice presenza dell'utente in una schermata non giustifica consumo di token.

Esempi ammessi:
- fonte pertinente all'UDA corrente;
- proposta adottata che può diventare lezione;
- attività da cui può derivare una verifica formativa;
- materiale professionale simile già usato;
- collegamento mancante evidente tra artefatti professionali.

## 12. Capability model

### Tier 0 — Observe / Retrieve / Navigate
Low-risk, automatico se privacy-safe:
- resolve current context;
- retrieve relevant professional sources;
- navigate/open relevant surface;
- compare local metadata;
- surface relevant memory.

### Tier 1 — Analyze / Review
Produce valutazioni effimere:
- `REVIEW_CONTEXTUAL_RELEVANCE`;
- coherence/gap analysis;
- duplicate/reuse detection;
- planning alignment.

### Tier 2 — Generate proposal
Sempre effimero e revisionabile:
- `PREPARE_ACTIVITY`;
- `ADAPT_MATERIAL`;
- `SIMPLIFY_MATERIAL`;
- `CREATE_MATERIAL`;
- `CREATE_ASSESSMENT_DRAFT`;
- future rubric/worksheet/lesson-draft capabilities.

### Tier 3 — Reversible write
Richiede conferma docente:
- link source to UDA;
- adopt proposal into Library;
- add adopted activity/lesson to UDA;
- save assessment draft;
- persist approved professional memory.

### Tier 4 — Higher-impact operations
Qualunque futura pubblicazione, comunicazione esterna, valutazione o operazione equivalente richiede contratto separato, human confirmation forte e audit dedicato.

## 13. Close the loops

Principio: una capability è completa solo se porta a un outcome operativo senza copia/incolla manuale.

Esempio PREPARE:

`source -> teaching context -> proposal -> review/edit -> teacher choice ->`

- `Adotta in Biblioteca`, oppure
- `Adotta e aggiungi all'UDA`, oppure
- `Lascia`.

`Adotta e aggiungi all'UDA` deve essere una decisione esplicita, non checkbox attiva di default.

La persistenza multi-dominio non può essere simulata con due mutation indipendenti chiamate in sequenza: se l'operazione deve essere atomica, serve un **compound durable mutation contract** qualificato.

## 14. REVIEW v2

`REVIEW` deve passare da controllo tecnico/metadati a **analisi didattica contestuale**.

Input ammessi, minimizzati:
- fonte professionale autorizzata;
- Teaching Context;
- Planning Context;
- profilo disciplina/grado;
- collegamenti professionali già presenti;
- memoria professionale pertinente.

Output atteso:
- pertinenza per il lavoro corrente;
- ragioni concrete;
- copertura rispetto agli obiettivi/contesto disponibile;
- lacune;
- possibili riusi/collegamenti;
- livello di confidenza e limiti dell'analisi.

REVIEW non modifica nulla.

## 15. Inclusion boundary

`ADAPT` / `SIMPLIFY` sono consentiti come **trasformazioni del materiale**, non come profilazione di singoli studenti.

Esempi consentiti:
- versione ad alta leggibilità;
- glossario;
- schema/mappa;
- riduzione del carico linguistico;
- variante con maggiore scaffolding.

Non consentito al provider remoto:
- usare dati di un singolo alunno;
- leggere PEI/PDP;
- generare raccomandazioni individualizzate basate su dati personali.

## 16. Cross-surface handoff

Ogni superficie deve poter fornire al Copilota un contesto coerente e minimale. Le superfici student-bearing devono applicare la proiezione privacy-safe prima di costruire il context snapshot utilizzabile dal Copilota remoto.

Priorità iniziali:
1. Biblioteca;
2. UDA/lezione;
3. Dashboard classe;
4. Programmazione annuale;
5. Verifiche online;
6. ulteriori superfici professionali solo dopo audit privacy/authority.

Il Copilota non duplica la business logic delle superfici: orchestra funzioni/contratti esistenti.

## 17. Reliability requirements

Prima dell'espansione funzionale, l'esistente deve distinguere in modo osservabile e sicuro:

- intent compreso e autorizzato;
- `CLARIFY`;
- `UNSUPPORTED`;
- `DENIED`;
- provider timeout/unavailable/rate-limit/error;
- provider output invalid;
- client response invalid;
- local fallback/no-match.

Nessun errore provider deve essere mascherato come incomprensione semantica.

## 18. Delivery roadmap — sequence only

Questa sezione definisce **ordine e dipendenze**, non ancora task implementativi.

### Phase 0 — Reliability baseline
Stabilizzare routing agent-first, diagnostics, semantic/live qualification e failure taxonomy.

### Phase 1 — Orchestration foundation
Formalizzare context bus cross-surface, action/tool registry e handoff non persistenti.

### Phase 2 — Close existing loops
Completare PREPARE fino a Biblioteca/UDA con compound mutation dove richiesto.

### Phase 3 — REVIEW v2
Usare planning/context/memory per vera revisione didattica contestuale.

### Phase 4 — Professional memory v1
Event memory locale, preference signals, retrieval selettivo, controlli utente.

### Phase 5 — Proactivity v1
Suggerimenti ad alta confidenza, suppression/feedback e progressive disclosure.

### Phase 6 — Governed generation expansion
Aggiungere una capability alla volta: `ADAPT_MATERIAL`, `SIMPLIFY_MATERIAL`, `CREATE_ASSESSMENT_DRAFT`, poi altri artefatti solo se giustificati dall'uso.

### Phase 7 — AI budget governor
Budget profile, cost estimator, escalation consent, session grants, metrics privacy-safe.

### Phase 8 — Cross-surface completion
Dashboard, Programmazione, Verifiche e ulteriori superfici professionali.

## 19. Qualification strategy

Ogni phase deve essere una o più vertical slice indipendentemente qualificabili con:

- exact-SHA;
- TDD RED -> GREEN causale;
- security/privacy contracts;
- typecheck/build/startup smoke;
- browser qualification desktop + mobile quando c'è UI;
- failure-path tests;
- human UX review quando cambia il percorso docente;
- nessun auto-merge;
- nessun deploy implicito;
- decisione umana prima dell'integrazione irreversibile.

Le capability generative richiedono inoltre corpus di casi reali/sintetici, hard-negative e misure di qualità del routing/output senza contenuti studente.

## 20. Product success criteria

La trasformazione è riuscita quando:

1. il docente può formulare obiettivi naturali senza conoscere i menu;
2. richieste comuni arrivano a outcome utili senza copia/incolla manuale;
3. il Copilota usa contesto corretto senza chiedere ripetutamente informazioni già presenti;
4. le proposte AI restano chiaramente distinguibili dallo stato adottato;
5. il sistema sa quando stare zitto;
6. il provider remoto non riceve mai dati individuali studente;
7. il costo medio di una richiesta semplice resta vicino al minimo tecnicamente necessario;
8. memoria e retrieval riducono ripetizioni senza inviare cronologia completa al modello;
9. le decisioni del docente migliorano progressivamente la rilevanza dei suggerimenti;
10. ogni mutazione persistente resta attribuibile a una decisione umana.

## 21. Builder constraints

L'implementazione futura deve:

- estendere, non bypassare, `@trama/contextual-copilot-core`;
- mantenere provider interpretation separata da authority;
- riusare `DurableMutationCoordinator` o introdurre un contratto composto qualificato, non side-effect paralleli ad hoc;
- mantenere memoria e budget come servizi/local contracts interrogabili e testabili, non logica nascosta nel prompt;
- evitare provider lock-in nel dominio: Gemini è un adapter/runtime choice, non una dipendenza del modello di prodotto;
- mantenere fallimenti osservabili con codici safe;
- progettare mobile-first il Copilot workspace: le proposte lunghe non devono essere compresse in un drawer stretto senza alternativa di espansione.

## 22. Decisions intentionally deferred to implementation planning

Queste scelte non cambiano l'intento del prodotto e possono essere definite nel piano, con eventuale human checkpoint se producono effetti di governance:

- schema esatto del professional-memory store;
- algoritmo locale di retrieval/ranking;
- soglie iniziali di proattività;
- nomi UI dei profili budget;
- formato del cost estimate;
- ordine preciso tra `ADAPT_MATERIAL` e `CREATE_ASSESSMENT_DRAFT` dopo REVIEW v2;
- forma UX desktop/mobile del workspace espanso;
- granularità delle session grants.

## 23. Canonical product rule

> **Privacy first. Teacher authority always. Local context before remote intelligence. Minimum sufficient cost. AI proposals before persistent effects.**
