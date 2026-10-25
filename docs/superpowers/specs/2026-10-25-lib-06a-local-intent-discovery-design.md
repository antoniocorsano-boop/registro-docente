# LIB-06A — Local Intent Discovery Consumer Design

## Intent

Collegare il Copilota della Biblioteca privata al nuovo adapter condiviso `@trama/contextual-copilot-intent-embedding@0.1.0`, così che il testo libero del docente possa riconoscere in locale gli intenti REVIEW, LINK e PREPARE senza trasformare il riconoscimento dell'intento in autorizzazione o mutazione.

Il valore per il docente è eliminare la lista indistinta di possibilità: una frase naturale come “collega questa fonte alla UDA” o “prepara un'attività da questo materiale” deve portare al flusso già esistente pertinente, mantenendo progressive disclosure e i gate umani già presenti.

## Goals

- Riutilizzare l'adapter condiviso TRAMA come package vendorizzato verificabile.
- Aggiungere un embedding locale, deterministico e senza rete nel consumer Registro.
- Tenere il catalogo degli esempi nel consumer, non nel package condiviso.
- Riconoscere soltanto `review-source`, `link-source-to-uda`, `prepare-from-source`.
- Usare `discoverRequestIntent()` per riconoscere PREPARE anche quando il Core locale non ha un provider generativo.
- Per REVIEW e LINK, passare comunque da `resolveRequest()` prima di presentare un'azione come disponibile.
- Per PREPARE, aprire soltanto l'esistente `LibraryProposalPanel`; nessuna generazione parte dal riconoscimento dell'intento.
- Preservare invariati conferma umana e dispatch governato del LINK.
- Mantenere SUMMARIZE fuori da questo slice.

## Non-goals

- Nessun modello remoto, SDK, API key, fetch o endpoint di embedding.
- Nessun RAG, vector store, persistenza di vettori o telemetria.
- Nessuna modifica al package Core vendorizzato.
- Nessuna nuova superficie generativa.
- Nessun collegamento a Docente OS.
- Nessun deploy o publish.

## Constraints

- Baseline: `main@38b7f0dd874806aaf56dd0ecef7e93d01ce34039`.
- Core consumer: `@trama/contextual-copilot-core@0.3.0` già vendorizzato.
- Adapter source canonico: TRAMA `@trama/contextual-copilot-intent-embedding@0.1.0`, source freeze `4cd5d41176a63f15939162b7c33275fbb4130ac5`, final receipt candidate `13aeba119ce041850ac78ce97c0d19d58a179b4f`.
- Privacy: il testo dell'utente non lascia il browser per la classificazione dell'intento.
- Authority: discovery non abilita azioni; il Core resta l'unico confine di policy/dispatch.

## Approaches considered

### A. Parser di keyword nel Registro

Più semplice, ma duplicherebbe logica di intent routing nel consumer e ricreerebbe il problema che il nuovo adapter condiviso è nato per eliminare. Rejected.

### B. Embedding remoto

Offrirebbe maggiore copertura semantica ma introdurrebbe rete, consenso, provider e nuove superfici di rischio privacy per una funzione che deve essere locale. Rejected.

### C. Adapter TRAMA + embedding locale deterministico

Selected. Il package condiviso resta responsabile di ranking, soglia e ambiguità; Registro possiede una funzione locale di feature hashing su testo normalizzato e il catalogo di esempi italiani. Nessuna dipendenza esterna e nessun dato inviato fuori dal dispositivo.

## Architecture

### Vendoring

Aggiungere `vendor/contextual-copilot-intent-embedding/` con i quattro file canonici della source freeze TRAMA e `vendor/contextual-copilot-intent-embedding.provenance.json` con source commit, receipt commit e SHA-256. `package.json` e `bun.lock` puntano al package locale via `file:`.

### Local embedding

`src/library/localIntentEmbedding.ts` espone:

```ts
export function embedLocalIntentText(text: string): Promise<readonly number[]>
```

L'implementazione normalizza Unicode/case/whitespace, genera feature lessicali e character n-gram, le proietta con hashing deterministico in un vettore fisso e normalizza L2. Non consulta cataloghi, action id o stato applicativo: trasforma soltanto testo in vettori.

### Consumer catalog

`src/library/libraryIntentCatalog.ts` contiene esempi per:

- `review-source`
- `link-source-to-uda`
- `prepare-from-source`

Non contiene `summarize-source`.

### Core adapter

`src/library/contextualCoreAdapter.ts` crea un `IntentPort` locale con `createEmbeddingIntentPort(...)` e lo inietta nel Core locale. Espone inoltre:

```ts
export function discoverLibraryCopilotIntent(input: LibraryCopilotRequestInput): Promise<CopilotIntentDiscovery>
```

`resolveLibraryCopilotRequest()` resta disponibile e diventa la fase di autorizzazione per REVIEW/LINK dopo la discovery.

### Composer flow

Alla submit del messaggio:

1. `discoverLibraryCopilotIntent()` riconosce l'intento.
2. Se nessun match: messaggio neutro, nessuna azione.
3. Se PREPARE: verificare source + Teaching Context + UDA e aprire `LibraryProposalPanel`; nessun dispatch e nessuna generazione automatica.
4. Se REVIEW o LINK: invocare `resolveLibraryCopilotRequest()`; mostrare soltanto ciò che il Core ha effettivamente risolto.
5. LINK continua a richiedere il flusso esistente `dispatchLibraryContextAction()` + conferma umana.

## Failure behavior

- Classificazione locale ambigua o sotto soglia → no-match, nessuna azione.
- Errore tecnico embedding/ranking → errore tecnico visibile, non degradare a falsa intenzione.
- PREPARE senza contesto UDA valido → non aprire il panel e spiegare che serve un contesto didattico univoco.
- Cambio fonte/contesto → reset della disclosure PREPARE e della risoluzione precedente.
- SUMMARIZE → no-match in questo slice.

## Acceptance

- TDD RED causale prima dell'implementazione.
- Test runtime su REVIEW/LINK/PREPARE e SUMMARIZE escluso.
- Test statici che PREPARE apre il panel senza chiamare direttamente servizi generativi.
- Test che LINK conserva conferma umana e dispatch esistenti.
- Typecheck, security suite, library suite, build e production smoke verdi sull'exact SHA candidato.
- PR Draft fino a decisione umana di integrazione.
