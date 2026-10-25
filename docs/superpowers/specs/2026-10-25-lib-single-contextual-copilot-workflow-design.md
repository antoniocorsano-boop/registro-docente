# LIB — Single Contextual Copilot Workflow Design

**Data:** 2026-10-25  
**Repository:** `antoniocorsano-boop/registro-docente`  
**Baseline:** `main@4e370d214cc2ec6ff00a2032667d7697a7f6e868`  
**Audit:** `docs/superpowers/specs/2026-10-25-lib-post-06a-end-to-end-audit.md`  
**Status:** PROPOSED / HUMAN DESIGN DECISION PENDING / DOCS ONLY

## 1. Intent

Portare la Biblioteca privata e il Copilota contestuale alla forma originaria prevista da LIB-01: la Biblioteca è memoria privata e superficie di recupero/gestione; il Copilota è l'unica superficie di trasformazione contestuale.

Il docente deve poter:

1. partire da una fonte già in Biblioteca oppure acquisirne una dal Copilota;
2. aprire il Copilota dal lavoro che sta svolgendo o dalla fonte;
3. vedere quale contesto didattico è attivo;
4. scrivere in linguaggio naturale cosa vuole fare;
5. ottenere solo l'azione coerente con l'intento riconosciuto e autorizzato;
6. decidere esplicitamente prima di qualunque scrittura o uso remoto;
7. ritrovare la fonte e la provenienza dell'artefatto successivamente.

## 2. Non-goals del prossimo blocco

- Nessun nuovo intent oltre `REVIEW`, `LINK`, `PREPARE`.
- Nessuna attivazione di `SUMMARIZE`.
- Nessun `ASK`, `CREATE`, `EXPLAIN`.
- Nessun multi-source synthesis.
- Nessun target `activity` finché non esiste identità canonica affidabile.
- Nessun nuovo modello locale o Transformer.
- Nessun nuovo provider remoto, endpoint, SDK o API key.
- Nessun RAG, chunking o vector index persistito.
- Nessun cambio al TRAMA Contextual Copilot Core salvo finding bloccante dimostrato.
- Nessun deploy/publish implicito.

## 3. Product model

### 3.1 Ownership delle superfici

**LibraryView / LibrarySourceCard owns:**

- acquisizione della fonte;
- titolo/anteprima/origine;
- ricerca e filtri;
- semantic retrieval esplicito;
- collegamenti già esistenti;
- rinomina/scollega/elimina;
- provenienza visibile;
- ingresso `Usa con Copilota`.

**LibraryCopilotComposer owns:**

- source binding corrente;
- launch/teaching/planning context corrente;
- free text;
- local intent discovery;
- REVIEW experience;
- LINK proposal + Core confirmation/dispatch;
- PREPARE disclosure + existing `LibraryProposalPanel`;
- failure/no-match/clarification state.

Il `LibraryProposalPanel` non deve più essere renderizzato direttamente dalla source card.

### 3.2 Explicit launch context

Introdurre un tipo session-only, non persistente e metadata-only:

```ts
export type CopilotLaunchSurface =
  | 'library'
  | 'home'
  | 'class-dashboard'
  | 'uda'
  | 'lesson'
  | 'planning'
  | 'other-teacher-surface';

export interface CopilotLaunchContext {
  surface: CopilotLaunchSurface;
  className?: string;
  udaId?: string;
  lessonId?: string;
  sourceId?: string;
}
```

Vincoli:

- nessun nome studente, voto, comportamento o payload sorgente;
- explicit context prevale sul suggestion resolver;
- riferimenti stale/non validi vengono scartati fail-closed;
- il docente vede sempre una sintesi del contesto usato;
- il docente può `Cambia` o `Rimuovi contesto`;
- assenza di explicit context può ancora usare l'attuale suggestion deterministico, ma la UI deve distinguerlo come **Contesto proposto**, non come fatto implicito.

### 3.3 Launch contract

Il Copilota deve poter essere aperto da più superfici con una sola API applicativa, per esempio:

```ts
interface OpenLibraryCopilotInput {
  sourceId?: string;
  context?: CopilotLaunchContext;
}

type OpenLibraryCopilot = (input?: OpenLibraryCopilotInput) => void;
```

App possiede lo stato session-only del launch request e lo passa al Composer. Le superfici non implementano intent/policy/generazione.

### 3.4 Library card handoff

L'azione primaria `Usa` della card diventa semanticamente `Usa con Copilota` oppure mantiene `Usa` con copy esplicativo equivalente.

La card può ancora:

- mostrare destinazioni rilevanti;
- permettere al docente di scegliere un contesto prima del handoff;
- gestire collegamenti esistenti nel menu secondario.

Ma non deve più:

- renderizzare `LibraryProposalPanel`;
- duplicare REVIEW/PREPARE transformation actions;
- costruire un secondo percorso di proposal generation.

Se il docente sceglie un candidato in `LibraryRelevancePanel`, il risultato può essere passato al Copilota come explicit context, senza scrittura automatica.

### 3.5 Progressive disclosure nel Copilota

#### Livello 0

- contesto attivo/proposto;
- fonte corrente;
- `Aggiungi fonte` / `Trova nella Biblioteca` secondari;
- campo `Che cosa vuoi farne?`.

#### Livello 1

Dopo free text:

- `REVIEW` -> mostra soltanto REVIEW;
- `LINK` -> mostra soltanto LINK governato;
- `PREPARE` -> apre soltanto PREPARE;
- `NO_INTENT_MATCH` -> nessuna azione, spiegazione breve e modi per riformulare;
- errore tecnico -> nessuna action fallback inventata.

Non mostrare PREPARE solo perché esiste un contesto valido.

#### Livello 2

Fuori scope nel primo blocco. Verrà riaperto soltanto dopo l'intent-evaluation gate.

### 3.6 REVIEW semantics

Per il prossimo blocco REVIEW deve essere esplicitamente locale e non generativa.

Rinominare il comportamento/copy verso una promessa verificabile, ad esempio:

- azione: `Controlla nel contesto`;
- contenuto: stato fonte, privacy, contesto scelto/proposto, link esistenti, eventuale stato `needs-review`, provenienza e disponibilità di testo.

Non deve dichiarare adeguatezza pedagogica o qualità curricolare se non esiste un motore che la valuti.

Il capability ID/Core action può restare `REVIEW`; il cambiamento è semantico/presentazionale nel consumer.

### 3.7 PREPARE semantics

PREPARE resta un handoff al `LibraryProposalPanel` già qualificato.

Invarianti:

- intent discovery non genera;
- apertura panel non invia ancora dati al provider;
- provider metadata/disclosure e consenso one-shot restano invariati;
- source/context change chiude il panel e invalida proposal/request state;
- nessuna seconda route generativa.

### 3.8 LINK semantics

LINK resta invariato come authority model:

1. intent discovery;
2. `resolveRequest()` Core;
3. mostra proposta target;
4. primo dispatch `humanConfirmed:false` -> confirmation required;
5. conferma docente;
6. rivalidazione source/context/action;
7. dispatch `humanConfirmed:true`;
8. durable persistence;
9. successo UI soltanto dopo `EXECUTED` + commit.

### 3.9 Intent evaluation boundary

Prima di aggiungere nuovi intenti, creare un reference corpus versionato nel consumer.

Schema suggerito:

```ts
export interface LibraryIntentFixture {
  id: string;
  utterance: string;
  expected:
    | 'review-source'
    | 'link-source-to-uda'
    | 'prepare-from-source'
    | 'NO_INTENT_MATCH';
  class: 'canonical' | 'paraphrase' | 'noisy' | 'mixed' | 'hard-negative' | 'oos';
}
```

Il corpus deve includere italiano reale da docente, non solo variazioni dei testi catalogo.

Evaluator offline minimo:

- exact expected action / no-match;
- confusion matrix;
- per-intent precision/recall;
- OOS abstention rate;
- hard-negative false-positive count;
- mixed-intent abstention count.

Le soglie (`minSimilarity`, `minMargin`) diventano una decisione basata sul corpus, non su singoli browser fixtures.

### 3.10 Clarification policy

Non implementare una domanda di chiarimento nel primo task se l'adapter non espone abbastanza evidenza per distinguere:

- vero ambiguity tra 2 intenti;
- semplice low-confidence/OOS.

Primo comportamento sicuro:

- high-confidence single intent -> proceed to Core;
- ambiguous/low/OOS -> no-match, no action.

Una futura clarification UX potrà essere introdotta solo con un contratto esplicito che non trasformi l'incertezza in falsa capability.

### 3.11 Retrieval handoff

Dopo la consolidazione del Copilota, aggiungere `Trova nella Biblioteca` come disclosure secondaria:

- ricerca testuale sempre disponibile;
- semantic search solo su azione esplicita e solo con provider locale già configurato;
- nessun embedding while typing;
- nessun automatic source selection;
- click sul risultato -> bind source al Composer;
- retrieval score non entra nell'intent classifier.

### 3.12 Visible provenance

Per fonti `internal` derivate:

- mostrare `Derivato da: <titolo fonte>`;
- se la fonte originale esiste, permettere di raggiungerla/selezionarla;
- provider/model/generatedAt in disclosure secondaria, non nel primary card chrome;
- provenance non viene persa da backup/restore o rename della fonte derivata.

## 4. State invalidation rules

Qualunque cambio tra questi valori invalida intent/resolution/proposal/link confirmation precedente:

- source ID;
- explicit launch context;
- resolved Teaching Context;
- relevant UDA/lesson disappearance;
- source privacy/status;
- message text dopo submit.

Il sistema non deve mantenere una confirmation o proposal riferita a uno snapshot precedente.

## 5. Privacy and authority invariants

- local intent text never leaves the browser for classification;
- no source payload enters Core `ContextSnapshot`;
- student-personal/unknown remains governed exactly as today for remote provider use;
- semantic retrieval is not authority;
- relevance ranking is not authority;
- launch context is not authority;
- Core remains the authority boundary for executable contextual actions;
- only durable mutation handlers write canonical state.

## 6. Approaches rejected

### A. Keep both card transformation flow and Copilot

Rejected: duplicate ownership and inevitable drift.

### B. Remove LibraryView and make everything chat-only

Rejected: violates reusable source memory, provenance and long-term retrieval goals.

### C. Expand intent catalog first

Rejected: no calibrated corpus yet and progressive-disclosure ownership is unresolved.

### D. Replace feature-hash intent embedding now

Rejected: technically possible, but no reference evidence that it is the bottleneck.

## 7. Acceptance criteria

The design is implemented only when all are true:

1. one proposal-generation surface remains: `LibraryCopilotComposer -> LibraryProposalPanel`;
2. `LibrarySourceCard` no longer embeds `LibraryProposalPanel`;
3. explicit launch context can open/bind the Composer from Library and at least one non-Library teacher surface;
4. explicit context is visible, changeable and removable;
5. suggestion fallback is clearly labelled as proposed;
6. PREPARE is not visible after REVIEW/LINK/no-match unless explicitly requested later;
7. REVIEW is actionable and copy is truthful/local;
8. LINK behavior/gates are unchanged;
9. intent corpus exists and evaluates canonical/paraphrase/noisy/mixed/hard-negative/OOS cases;
10. thresholds are frozen only after evaluator evidence;
11. source/context/message changes invalidate stale state;
12. desktop + 390x844 browser journeys pass with no new UX-QA blocking findings;
13. no new remote network path is introduced by intent or evaluation;
14. no deploy/publish is part of engineering qualification.

## 8. Follow-on decision gate

Only after this design is qualified should the project choose among:

- enable `SUMMARIZE` as the next governed capability;
- add advanced transformation taxonomy;
- introduce `activity` identity/linking;
- add multi-source transformation;
- evaluate an on-device Transformer intent model.

Those are separate decisions and must not be bundled into the consolidation block.
