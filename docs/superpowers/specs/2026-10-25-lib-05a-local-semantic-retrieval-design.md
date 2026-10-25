# LIB-05A — Local Semantic Retrieval Design

## Intent

Aggiungere alla Biblioteca privata un recupero semantico locale che aiuti il docente a trovare materiali pertinenti anche quando query e fonte non condividono le stesse parole.

LIB-05A non sostituisce il relevance resolver LIB-03B e non interpreta intenzioni del Copilota. Introduce un secondo segnale, esplicitamente richiesto dal docente, per cercare *fonti della Biblioteca* per significato.

## Baseline

- Repository: `antoniocorsano-boop/registro-docente`
- Baseline: `main@a79925a33ee32be02f2a2c32a866357341db2381`
- Branch: `feat/lib-05a-local-semantic-retrieval`
- Infrastruttura embedding esistente: `src/services/embeddingService.ts`
- Ricerca Biblioteca esistente: `searchLibrarySources` in `src/library/libraryState.ts`
- Resolver di rilevanza didattica esistente: `src/library/relevanceResolver.ts`

## Goals

1. Consentire al docente di attivare una ricerca semantica locale dalla Biblioteca con una query esplicita.
2. Riutilizzare il motore embedding esistente senza creare provider, route o storage paralleli.
3. Mantenere la ricerca testuale corrente come comportamento predefinito e fallback sicuro.
4. Non usare mai automaticamente Gemini o altro provider remoto per questa funzione.
5. Non persistere vettori, query o indici in LIB-05A: cache solo di sessione già gestita dall'Embedding Service.
6. Restituire risultati ordinati semanticamente senza trasformare la similarità in decisione o autorizzazione.
7. Mantenere progressive disclosure e touch target >=44px.

## Non-goals

- IntentPort o interpretazione del testo libero del Copilota.
- RAG/chunking documentale.
- Persistenza di vector index.
- Embedding di immagini prive di testo/descrizione.
- Multi-source synthesis.
- Sostituzione di LIB-03B.
- Modifica del Contextual Copilot Core.
- Provider remoto come fallback.

## Approcci considerati

### A. Sostituire la ricerca testuale con embedding

Scartato. Renderebbe una capability opzionale dipendente dal runtime locale e degraderebbe il comportamento quando il motore non è disponibile.

### B. Inserire embedding direttamente dentro LIB-03B

Scartato. LIB-03B è deliberatamente deterministico, spiegabile e privo di dipendenze provider/network. Il suo contratto non va indebolito.

### C. Retrieval semantico separato, locale e progressivo — scelto

Un modulo dedicato recupera fonti dalla Biblioteca usando l'Embedding Service esistente. La UI mantiene la ricerca testuale normale; il docente abilita esplicitamente `Ricerca per significato`. Se il motore locale è disabilitato, configurato come remoto o non raggiungibile, la modalità semantica fallisce senza chiamare provider remoti e senza alterare i dati.

## Architecture

`LibraryView -> semantic search disclosure -> localSemanticRetrieval -> existing getEmbedding -> loopback local provider -> cosine similarity -> ranked LibrarySource IDs`

La ricerca testuale rimane:

`LibraryView -> searchLibrarySources`

I due percorsi sono indipendenti. Nessuna mutazione della Biblioteca avviene durante retrieval.

### `src/library/semanticRetrieval.ts`

Nuovo modulo con responsabilità limitata:

- costruire un testo rappresentativo della fonte usando soltanto `title`, `extractedText`, `payload.text`, `notes`;
- escludere fonti senza testo semanticamente utilizzabile;
- escludere fonti `student-personal` e `unknown` dal percorso embedding in LIB-05A;
- richiedere `config.enabled === true` e `config.provider === 'local'`;
- usare `getEmbedding` con `classification: 'TEACHER_PROFESSIONAL'` e `explicitTeacherOptIn: false`;
- calcolare similarità coseno;
- restituire massimo risultati ordinati deterministicamente: similarity desc, poi titolo/id;
- applicare una soglia minima conservativa, configurata nel modulo e testata;
- non fare fallback remoto;
- non scrivere storage.

Il modulo espone uno stato esplicito, ad esempio:

- `ranked`
- `unavailable` (`LOCAL_EMBEDDING_DISABLED`, `LOCAL_EMBEDDING_REQUIRED`, `NO_ELIGIBLE_SOURCE`, `NO_SEMANTIC_MATCH`)
- errore runtime normalizzato per la UI (`LOCAL_EMBEDDING_UNREACHABLE`).

## Privacy boundary

LIB-05A è local-only per contratto.

- `provider !== 'local'` => semantica non disponibile; nessuna chiamata a Gemini.
- endpoint locale resta soggetto al guard loopback già implementato da `embeddingService`.
- `student-personal` => mai inviato all'Embedding Service.
- `unknown` => non viene semanticamente indicizzato finché il docente non lo classifica `teacher-professional`.
- le fonti escluse restano comunque ricercabili con la ricerca testuale locale.
- nessun vettore viene persistito dalla nuova feature.

## Teacher UX

La Biblioteca mantiene il campo `Cerca nella biblioteca` come controllo principale.

Sotto il campo, una disclosure compatta `Ricerca per significato` appare solo come funzione secondaria. Quando aperta:

- spiega che usa il motore locale configurato e non invia automaticamente i materiali a servizi remoti;
- il docente avvia esplicitamente la ricerca semantica;
- durante l'esecuzione mostra stato pending;
- risultati semanticamente ordinati riusano le stesse `LibrarySourceCard`;
- viene mostrata una dicitura qualitativa `Pertinenza semantica` senza esporre il valore numerico del coseno;
- se il motore non è disponibile, messaggio chiaro e la normale ricerca testuale resta utilizzabile.

Cambiare query chiude/invalida i risultati semantici precedenti; nessun risultato stale deve sopravvivere come se appartenesse alla nuova query.

## Ranking semantics

LIB-05A non fonde ancora il punteggio embedding con LIB-03B. Restano due problemi distinti:

- LIB-03B: `source -> UDA/lesson` con segnali deterministici e contestuali.
- LIB-05A: `query -> LibrarySource` con similarità semantica locale.

Una futura fusione ibrida potrà usare entrambi come segnali, ma richiederà un contratto separato.

## Failure behavior

- query vuota: nessuna esecuzione;
- local embedding disabilitato: nessuna esecuzione;
- provider Gemini selezionato: nessuna esecuzione e nessun fallback;
- endpoint non loopback: guard esistente blocca;
- errore endpoint: messaggio retryable, nessuna alterazione dati;
- dimensioni vettoriali incompatibili: similarità 0 e candidato escluso;
- nessuna fonte eleggibile: stato vuoto spiegabile;
- cambio query durante pending: il risultato precedente non viene pubblicato per la query nuova.

## Verification

### Contract/TDD

Nuovo contratto `src/security/lib05aLocalSemanticRetrievalContract.test.ts` deve verificare almeno:

- nuovo modulo esiste e usa l'Embedding Service esistente;
- `provider === 'local'` ed `enabled` sono prerequisiti;
- nessun riferimento a Gemini route/provider nel modulo;
- fonti unknown/student-personal escluse;
- nessuna persistenza o modifica di `relevanceResolver.ts`;
- LibraryView riceve `embeddingConfig` da App e mantiene la ricerca testuale predefinita;
- semantic search è progressive disclosure e non automatica.

### Unit tests

Nuovo `src/library/semanticRetrieval.test.ts` con embedding port controllato per provare:

- ranking semantico;
- tie-break deterministico;
- esclusione privacy;
- no match;
- local-only guard;
- limite risultati.

### Browser

Nuovo gate desktop/mobile:

1. Biblioteca con fonti professionali sinteticamente correlate e non correlate.
2. Ricerca testuale continua a funzionare senza semantic mode.
3. Semantic disclosure è chiusa di default.
4. Con endpoint embedding di test controllato/local mock: query semantica porta la fonte concettualmente pertinente in cima.
5. Nessuna richiesta a route Gemini/remota.
6. Cambiare query invalida risultati precedenti.
7. Mobile 390×844: controlli >=44px e nessun overflow permanente.
8. UX-QA-01/02 restano PASS.

## Success criteria

LIB-05A è qualificato quando il docente può trovare una fonte della propria Biblioteca per significato usando esclusivamente il motore embedding locale, mentre ricerca testuale, LIB-03B, privacy, persistenza e Core condiviso restano invariati.

## Deferred

- LIB-05B: eventuale handoff dei risultati semantici al Copilota/IntentPort.
- Hybrid semantic + deterministic relevance score.
- Persisted vector index e invalidation strategy.
- Chunk-level retrieval/RAG.
