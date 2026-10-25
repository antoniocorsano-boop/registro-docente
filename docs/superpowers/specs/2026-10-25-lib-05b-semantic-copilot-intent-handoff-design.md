# LIB-05B — Semantic Copilot Intent Handoff Design

**Status:** continuation-authorized design  
**Repository:** `antoniocorsano-boop/registro-docente`  
**Baseline:** `main@72a7413ec8f764b7711592919d6ebcb430b18df3`  
**Upstream Core:** `antoniocorsano-boop/trama-ecosistema@f5549b8a9cbbcd40752f8aa85183b3db23faf0ce` / `@trama/contextual-copilot-core@0.3.0`

## Intent

LIB-05B collega la ricerca semantica locale già qualificata in LIB-05A al Copilota della Biblioteca e introduce finalmente un `IntentPort` locale compatibile con il Core 0.3.0.

Il docente deve poter formulare una richiesta naturale come “usa questa fonte per preparare un’attività” e ottenere il riconoscimento locale dell’intento `PREPARE` senza che questo renda PREPARE già autorizzato o eseguibile.

La separazione resta netta:

`quale fonte è pertinente?` -> semantic retrieval LIB-05A  
`che cosa vuole farne il docente?` -> local IntentPort + Core DISCOVER  
`si può eseguire?` -> percorsi Core RESOLVE/DISPATCH + LibraryProposalPanel governato

## Goals

1. Aggiornare il Core vendorizzato da 0.2.0 a 0.3.0 usando esclusivamente la distribuzione canonica TRAMA e aggiornando provenance/hash.
2. Aggiungere un `IntentPort` locale request-scoped che implementi `discover()` tramite il motore embedding locale esistente.
3. Mantenere `resolve()` fail-closed per il nuovo port: LIB-05B non deve trasformare discovery in authorization.
4. Consentire a `LibraryCopilotComposer` di riconoscere `PREPARE` da testo libero quando il motore locale è disponibile.
5. Mostrare il riconoscimento come proposta di prosecuzione (`Apri preparazione assistita`), non come esecuzione automatica.
6. Riutilizzare `LibraryProposalPanel` come unico percorso PREPARE, con classificazione privacy, provider disclosure e consenso one-shot invariati.
7. Consentire l’handoff di una fonte risultata pertinente semanticamente dalla Biblioteca al Copilota senza copiarne il contenuto nel `ContextSnapshot`.
8. Preservare ricerca testuale, LIB-03B relevance resolver, LIB-05A retrieval, LINK e tutti i confini privacy/authority esistenti.

## Non-goals

- Nessuna fusione ibrida del punteggio LIB-03B + embedding.
- Nessun persisted vector index.
- Nessun RAG/chunking o multi-source synthesis.
- Nessun parser keyword/regex per riconoscere PREPARE.
- Nessun provider remoto per intent discovery.
- Nessuna modifica al Core condiviso 0.3.0.
- Nessuna nuova route generativa.
- Nessuna scrittura diretta in UDA/lezione.
- Nessuna attivazione automatica di `SUMMARIZE`.
- Nessun deploy, publish o merge automatico.

## Approcci considerati

### A. Parser locale di parole chiave nel Composer

Scartato. Reintrodurrebbe esattamente il resolver specifico del Registro che LIB-04B/04D avevano escluso, creando drift rispetto al Core condiviso.

### B. Usare il ranking delle fonti di LIB-05A come decisione di intento

Scartato. `retrieveLibrarySourcesByMeaning()` risponde a “quale fonte è simile alla query?”, non a “quale capability vuole il docente?”. Mescolare i due segnali produrrebbe falsi positivi e renderebbe poco spiegabile il confine di authority.

### C. IntentPort locale dedicato + handoff della fonte — scelto

Un adapter locale separato usa lo stesso `getEmbedding()` già disponibile, ma confronta il messaggio con prototipi d’intento limitati alle action candidate che il Core 0.3 passa a `IntentPort.discover()`. Il Core continua a restringere il set di candidate prima dell’adapter e restituisce solo intenti non eseguibili.

La fonte resta una responsabilità separata: un risultato semantico LIB-05A può essere consegnato al Composer come fonte pre-selezionata, ma il contenuto della fonte non entra nel `ContextSnapshot`.

## Architecture

```text
LibraryView
  -> LIB-05A local semantic retrieval
  -> teacher chooses/uses a semantic result
  -> App handoff: selected LibrarySource id
  -> LibraryCopilotComposer preselects that source

LibraryCopilotComposer
  -> message + source + teaching/planning context
  -> discoverLibraryCopilotIntent(...)
  -> request-scoped Core 0.3
       -> DISCOVER candidates already narrowed by registry/capabilities/policy
       -> localLibraryIntentPort.discover(...)
            -> existing local getEmbedding()
            -> intent prototypes for candidate actions only
            -> cosine similarity
       -> CopilotIntentDiscovery
  -> PREPARE discovered
  -> explicit CTA: Apri preparazione assistita
  -> existing LibraryProposalPanel
       -> privacy classification
       -> provider disclosure
       -> one-shot consent
       -> remote PREPARE authorization
       -> proposal
       -> Adotta | Adatta | Lascia
```

## Core vendor boundary

Registro continues to consume `@trama/contextual-copilot-core` from `file:vendor/contextual-copilot-core`.

LIB-05B updates exactly the canonical package files from TRAMA 0.3.0:

- `README.md`
- `index.d.ts`
- `package.json`
- `src/index.js`

`vendor/contextual-copilot-core.provenance.json` must bind:

- package version `0.3.0`;
- source/distribution commit `f5549b8a9cbbcd40752f8aa85183b3db23faf0ce`;
- exact SHA-256 digests from the qualified TRAMA distribution.

The existing LIB-01B security contract is updated rather than duplicated so the vendored package remains one canonical dependency boundary.

## Local intent adapter

New module: `src/library/localIntentPort.ts`.

It exposes a factory/function that receives the existing `LocalEmbeddingConfig` and returns an `IntentPort` with `mode: 'local'`.

### Discovery behavior

`discover({ context, message, actions })`:

1. fails closed when query is empty, local embedding disabled or provider is not `local`;
2. never calls Gemini or a remote provider;
3. embeds the teacher message once using classification `TEACHER_PROFESSIONAL` and `explicitTeacherOptIn: false`;
4. builds text prototypes only for `actions` supplied by Core;
5. embeds those prototypes through the existing embedding service;
6. computes cosine similarity;
7. drops non-finite scores and values below a conservative threshold;
8. sorts score desc, then candidate priority desc, then action id asc;
9. returns `IntentMatch[]` only.

`resolve()` returns an empty array in LIB-05B. This is deliberate: the adapter may discover, but it does not make an action authorized.

### Intent prototypes

Prototypes are product-language descriptions bound to action ids already present in the Registry. Minimum supported mappings:

- `prepare-from-source`: prepare/create/adapt a teaching activity or material from the selected source;
- `review-source`: review/read the source in the current teaching context;
- `link-source-to-uda`: link/connect the source to the current UDA or lesson.

No `summarize-source` activation in LIB-05B. If Core passes an unmapped candidate, the adapter does not invent a prototype and therefore cannot match it.

## Core adapter changes

`src/library/contextualCoreAdapter.ts` keeps the current module-level fail-closed execution core unchanged for `resolveActions()`, `resolveRequest()` and `dispatch()`.

A new request-scoped discovery path is added:

```ts
discoverLibraryCopilotIntent({
  source,
  teachingContext,
  planningContext,
  message,
  embeddingConfig
}): Promise<CopilotIntentDiscovery>
```

It creates a Core 0.3 instance with:

- the same `actionRegistry`;
- the same fail-closed policy engine;
- `generativeMode: 'none'`;
- the local IntentPort for that request.

This keeps the new dependency on embedding configuration out of the normal action resolver and dispatch path.

## Semantic result handoff

LIB-05A results already render normal `LibrarySourceCard` instances. LIB-05B adds a thin application-level handoff so a source chosen from a semantic result can become the Copilot’s initial selected source.

The handoff carries only the `source.id`.

Required properties:

- no source text copied into App-level transient state;
- deleting/staling the source clears the handoff;
- changing source manually in the Composer takes precedence;
- opening the Copilot from a semantic result does not run intent discovery automatically;
- changing the handed-off source invalidates prior discovery state.

## Teacher UX

The default Copilot remains compact and progressive.

After the teacher submits text:

- existing non-generative `RESOLVE` behavior remains available for REVIEW/LINK;
- in parallel/sequentially, local DISCOVER may recognize PREPARE;
- when PREPARE is discovered, show a compact, non-authoritative callout such as:
  - `Posso aiutarti a preparare un’attività da questa fonte.`
  - button `Apri preparazione assistita`;
- clicking the CTA opens the existing `LibraryProposalPanel`;
- no remote request occurs until the panel reaches its existing consent gate.

If the local embedding engine is unavailable, the Copilot remains usable for current deterministic actions and the UI reports that intent recognition locale is unavailable without falling back remotely.

## Privacy and authority boundaries

- `student-personal` and `unknown` source content is never embedded for intent discovery because the adapter embeds only the teacher’s message and fixed local prototypes; the `ContextSnapshot` still carries only minimized metadata.
- no remote provider is used by the local IntentPort.
- `DISCOVERED PREPARE` is not equivalent to `ResolvedAction` and cannot be dispatched.
- `LibraryProposalPanel` remains the sole path that can later authorize remote PREPARE after privacy classification and explicit one-shot consent.
- LINK keeps its existing human-confirmation gate.
- no mutation occurs on discovery or semantic handoff.

## Failure behavior

- Core 0.3 vendor/provenance mismatch -> security tests fail closed.
- embedding disabled -> discovery unavailable, normal Copilot actions remain usable.
- provider != local -> no intent embedding call, no remote fallback.
- local endpoint unreachable -> retryable intent-discovery message; no mutation.
- no candidate above threshold -> no PREPARE suggestion.
- stale handed-off source -> selection cleared.
- source/context/message changes after discovery -> discovery state invalidated.
- source switches while PREPARE panel open -> panel closes; existing one-shot consent is revoked by existing behavior.

## Verification

### Vendor/security

- LIB-01B contract binds Core 0.3.0 source, distribution commit and exact hashes.
- package dependency remains `file:vendor/contextual-copilot-core`.
- Core 0.3 API surface exposes `discoverRequestIntent()` and `IntentPort.discover?()`.

### Unit

New `src/library/localIntentPort.test.ts`:

- PREPARE prototype ranks for a controlled semantic vector;
- only candidate actions supplied by Core may be returned;
- unmapped SUMMARIZE cannot be invented;
- provider remote/disabled fails closed before embedding;
- non-finite/low scores dropped;
- deterministic tie-break;
- `resolve()` returns `[]`.

### Contract

New `src/security/lib05bSemanticCopilotIntentHandoffContract.test.ts`:

- discovery path uses Core 0.3 `discoverRequestIntent()`;
- no keyword/regex parser in Composer;
- IntentPort mode is local;
- Composer receives `embeddingConfig` and uses discovery separately from `resolveLibraryCopilotRequest()`;
- PREPARE discovery only exposes CTA to existing `LibraryProposalPanel`;
- semantic source handoff stores only an id;
- no modification of LIB-03B relevance resolver.

### Browser

Desktop and 390×844:

1. semantic result can be handed to Copilot and appears preselected;
2. opening Copilot does not call embedding automatically;
3. teacher submits a PREPARE-like request; local discovery returns PREPARE;
4. CTA appears, but no remote proposal request has occurred;
5. CTA opens existing proposal flow;
6. provider disclosure + one-shot consent are still required before remote PREPARE;
7. LINK path remains unchanged and human-confirmed;
8. local embedding unavailable -> readable fallback, no remote intent call;
9. source change invalidates discovery and closes PREPARE;
10. zero unexpected page/console errors and no permanent mobile overflow.

## Success criteria

LIB-05B is qualified when a teacher can move from a semantically relevant Library source to the Copilot, express a natural PREPARE intent, have that intent recognized locally by Core 0.3, and then enter the existing governed PREPARE flow without any authority, privacy or provider shortcut.

## Deferred

- hybrid LIB-03B + semantic relevance scoring;
- persisted vector index/invalidation;
- chunk-level RAG;
- multi-source synthesis;
- optional SUMMARIZE intent activation after a separately governed design.