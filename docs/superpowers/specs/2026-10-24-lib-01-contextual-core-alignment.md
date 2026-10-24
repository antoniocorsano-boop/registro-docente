# LIB-01 — allineamento normativo con TRAMA Contextual Copilot Core

**Data:** 2026-10-24  
**Repository:** `antoniocorsano-boop/registro-docente`  
**Documento principale:** `docs/superpowers/specs/2026-10-24-lib-01-private-library-contextual-ingest-design.md`  
**Riferimento cross-app:** `antoniocorsano-boop/trama-ecosistema`, branch `docs/contextual-copilot-core`, `docs/superpowers/specs/2026-10-22-trama-contextual-copilot-core-design.md`  
**Baseline del riferimento verificata:** `57f4d2d36b7ebc3e50a2aa268a7e27193603a015`  
**Stato:** NORMATIVE ALIGNMENT — evita duplicazione del copilota nel Registro

## Decisione

LIB-01 non autorizza la costruzione di un secondo motore di copilota specifico per `registro-docente`.

La biblioteca privata è **dominio verticale del Registro**. Il motore che decide quali azioni mostrare, interpreta intenti, applica policy e orchestra il copilota resta il **Contextual Copilot Core condiviso** definito in TRAMA.

Confine obbligatorio:

```text
registro-docente
  ├─ LibrarySource / LibraryState / persistence
  ├─ Library intake
  ├─ UDA/lesson linking
  ├─ registro Context Adapter
  └─ presentation adapter
             │
             ▼
TRAMA Contextual Copilot Core
  ├─ Context Engine
  ├─ Action Registry
  ├─ Intent Resolver
  ├─ Policy Engine
  └─ Copilot Orchestrator
```

## Conseguenza sul modello di contesto

Il `TeachingContext` descritto da LIB-01 è un concetto verticale e deve essere convertito dall'adapter del Registro nel `ContextSnapshot` condiviso.

Esempio per una fonte caricata mentre è aperta una UDA:

```ts
{
  appId: 'registro-docente',
  surface: 'UDA_LIBRARY_SOURCE',
  entities: [
    { type: 'uda', id: udaId },
    { type: 'library-source', id: sourceId }
  ],
  capabilities: [
    'ASK',
    'SEARCH',
    'CREATE',
    'SUMMARIZE',
    'PREPARE',
    'LINK',
    'IMPORT',
    'REVIEW',
    'EXPLAIN'
  ],
  permissions: [...],
  privacy: {...}
}
```

I nomi concreti dei tipi condivisi devono provenire dal core materializzato; l'adapter del Registro non deve mantenere un fork locale di tali contratti.

## Progressive disclosure

La regola LIB-01 «3–4 azioni principali + Altre possibilità» deve essere implementata come **presentation policy sul risultato già risolto dal core**, non come un elenco hard-coded indipendente.

Ordine di autorità invariato:

```text
Policy > capabilities app > stato > semantica > preferenze
```

La UI può mostrare al massimo 3–4 azioni primarie ad alta pertinenza. `Altre possibilità` espande soltanto azioni che il core ha già dichiarato consentite.

Un provider generativo, un embedding o una preferenza locale non possono introdurre una capability non dichiarata dall'applicazione.

## Capability iniziali della biblioteca

La biblioteca espone al core un insieme verticale di capability, non comandi di UI.

Set iniziale:

- `IMPORT` — acquisire una fonte nella biblioteca privata;
- `LINK` — collegare/scollegare fonte e UDA/lezione/attività;
- `SEARCH` — ritrovare fonti private;
- `ASK` — porre una domanda sulla fonte nel contesto corrente;
- `SUMMARIZE` — ottenere una sintesi proposta;
- `PREPARE` — preparare materiale/lezione a partire dalla fonte;
- `CREATE` — produrre una bozza di attività/artefatto;
- `REVIEW` — analizzare criticamente la fonte o la proposta;
- `EXPLAIN` — spiegare concetti derivati dalla fonte.

La capability non implica autorità di scrittura.

## Human-in-the-loop

Mappatura obbligatoria:

- ricerca/apertura fonte → `READ_ONLY`;
- sintesi, attività, materiale, proposta di collegamento → `PROPOSE`;
- applicazione di una bozza a UDA/lezione → almeno `WRITE_REVERSIBLE`, con preview o conferma;
- invio a servizio esterno → `WRITE_EXTERNAL`, con policy e conferma esplicita quando prevista;
- decisioni curricolari/istituzionali → `INSTITUTIONAL_DECISION`, mai delegate al modello.

La trasformazione segue sempre:

```text
Source → CopilotRequest → DraftArtifact → HumanDecision → CanonicalWrite
```

## Privacy

LIB-01 deve riusare il principio fail-closed già adottato dal core e da `registro-docente`:

- `STUDENT_PERSONAL` non è indicizzato o inviato automaticamente;
- una fonte con privacy `unknown` può essere conservata localmente, ma non deve essere inoltrata a provider remoto finché la policy non autorizza il flusso;
- il core non può riclassificare autonomamente un contenuto protetto in una classe più permissiva;
- l'adapter del Registro espone soltanto dati necessari alla richiesta corrente.

## Modalità senza IA generativa

La biblioteca deve mantenere valore anche con `NoGenerativeProvider`:

- importare e salvare;
- cercare;
- aprire;
- collegare a UDA/lezione;
- mostrare provenienza;
- recuperare fonti pertinenti;
- proporre azioni deterministiche già dichiarate.

L'assenza di un provider generativo non rende la biblioteca inutilizzabile.

## Confine di implementazione

`LIB-01A` può essere implementato interamente in `registro-docente`: dominio, intake, storage, backup, ricerca, collegamenti e superficie Biblioteca.

La parte conversazionale e di action resolution di `LIB-01B` **non deve essere implementata con un resolver locale sostitutivo**. Può iniziare quando il Contextual Copilot Core condiviso dispone di un artefatto/import stabile oppure quando una decisione umana autorizza esplicitamente un adapter transitorio compatibile.

Questo vincolo prevale su qualunque tentazione di accelerare la UI duplicando Action Registry, Intent Resolver o Policy Engine nel Registro.
