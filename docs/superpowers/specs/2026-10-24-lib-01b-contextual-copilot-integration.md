# LIB-01B — Biblioteca privata → Contextual Copilot Core

**Data:** 2026-10-24  
**Stato:** DESIGN APPROVATO IN PRINCIPIO · IMPLEMENTATION GATED  
**Baseline Registro:** `main@81513d7e74f11346f770d6f1fc4f5870142425b9`  
**Prerequisito condiviso:** TRAMA PR #279 — Contextual Copilot Core v0, exact candidate qualificato `9a0f64cd54296bcd72aee23c2be9227cb15eeaed`  
**Authority change:** NONE  
**Deploy:** NONE

## 1. Scopo

LIB-01B collega la Biblioteca privata di `registro-docente` al **TRAMA Contextual Copilot Core condiviso** senza introdurre nel Registro un resolver, orchestratore o policy engine sostitutivo.

Il docente deve poter selezionare una fonte già acquisita con **Usa** e ricevere poche azioni contestuali pertinenti al lavoro corrente. La progressione resta:

```text
Fonte privata
→ contesto minimo
→ azioni ammesse dal Core
→ proposta
→ decisione umana
→ eventuale scrittura canonica nella verticale Registro
```

La fonte resta privata e il Registro conserva authority su UDA, lezioni, attività e persistenza.

## 2. Decisione architetturale

LIB-01B usa quattro confini distinti:

1. **Library vertical** — possiede `LibrarySource`, payload, privacy, link e persistenza cifrata.
2. **Registro adapter** — costruisce un `ContextSnapshot` minimo e dichiara capability/permessi già consentiti dalla verticale.
3. **Shared Contextual Copilot Core** — risolve, ordina e governa azioni condivise.
4. **Presentation/Execution adapter** — presenta le azioni e, solo dopo decisione umana, traduce un dispatch ammesso in una proposta o in una mutazione verticale esplicitamente autorizzata.

Sono vietati:

- registry di azioni duplicato nel Registro;
- ordinamento locale alternativo alle azioni del Core;
- branching nel Core per `registro-docente`;
- copia manuale non verificata del sorgente Core;
- dipendenza runtime da un branch Git non canonico;
- invio automatico del payload della fonte a provider remoto;
- mutazioni UDA/lezioni come effetto di `Usa` o della sola risoluzione delle azioni.

## 3. Prerequisito di integrazione

Il codice prodotto LIB-01B **non può iniziare a consumare il Core** finché tutte queste condizioni non sono vere:

1. TRAMA PR #279 è stata integrata in `trama-ecosistema/main` con decisione umana;
2. esiste un commit canonico `TRAMA_CORE_SHA` su `main` che contiene `shared/contextual-copilot-core/`;
3. Governance del Core è PASS su quel contenuto;
4. il meccanismo di consumo cross-repository è materializzato con provenance verificabile;
5. nessun publish pubblico o registry esterno è necessario.

Fino a quel momento sono ammessi solo documentazione, test di contratto preparatori e scaffolding che non duplichi il Core.

## 4. Distribuzione cross-repository v0

Per il primo consumer si adotta un **vendored package snapshot pinned e verificato**, non un submodule e non una dependency su branch Git.

Percorso previsto nel Registro:

```text
vendor/trama-contextual-copilot-core/
  README.md
  index.d.ts
  package.json
  src/index.js
  UPSTREAM.json
```

`UPSTREAM.json` contiene almeno:

```json
{
  "repository": "antoniocorsano-boop/trama-ecosistema",
  "packagePath": "shared/contextual-copilot-core",
  "upstreamSha": "<merged TRAMA main SHA>",
  "packageVersion": "0.1.0",
  "files": {
    "README.md": "sha256:<digest>",
    "index.d.ts": "sha256:<digest>",
    "package.json": "sha256:<digest>",
    "src/index.js": "sha256:<digest>"
  }
}
```

Il `package.json` del Registro consuma:

```json
"@trama/contextual-copilot-core": "file:vendor/trama-contextual-copilot-core"
```

Proprietà richieste:

- installazione riproducibile e offline dopo checkout;
- nessun token o registry esterno;
- import applicativo tramite nome package stabile;
- migrazione futura a registry/package service senza cambiare gli import del prodotto;
- test che fallisce se provenance o hash non corrispondono al vendored snapshot;
- il vendor è read-only/generated: modifiche funzionali al Core avvengono solo nel repository TRAMA.

## 5. Context adapter della Biblioteca

Modulo previsto:

`src/copilot/libraryContextAdapter.ts`

Interfaccia:

```ts
interface LibraryUseContext {
  source: LibrarySource
  activeUda?: UdaRecord | null
}

function createLibraryContextSnapshot(input: LibraryUseContext): ContextSnapshot
```

Il `ContextSnapshot` usa:

```text
appId   = registro-docente
surface = LIBRARY_SOURCE
```

`entities` contiene solo riferimenti/minimo metadata, mai il payload completo della fonte:

```text
library-source:<source.id>
uda:<activeUda.id>          // solo se presente
```

Il contenuto della fonte resta nel vertical adapter e viene letto solo dall'executor specifico dopo che il Core ha ammesso l'azione.

## 6. Capability dichiarate dal consumer

LIB-01B v0 parte con un set prudente e differenziato dal contesto.

### Fonte senza UDA attiva

Capability candidabili:

```text
OPEN
REVIEW
LINK
```

### Fonte con UDA attiva

Capability candidabili:

```text
OPEN
REVIEW
LINK
PREPARE
CREATE
SUMMARIZE
EXPLAIN
```

La lista è solo un **massimo dichiarabile**. Il Registro adapter deve rimuovere capability non consentite da privacy, stato fonte, disponibilità provider e authority prima di chiamare il Core.

Il Core resta l'unico resolver/ordinatore delle azioni effettivamente mostrate.

## 7. Privacy mapping fail-closed

La privacy della Biblioteca è:

```text
unknown
teacher-professional
student-personal
```

Mappatura:

### `teacher-professional`

```text
privacy.dataClasses = [TEACHER_PROFESSIONAL]
remoteProviderAllowed = false     // default v0
```

LIB-01B v0 non abilita provider remoto. Le capability generative possono essere risolte solo quando il Core opera con una modalità generativa esplicitamente autorizzata da un incremento successivo.

### `student-personal`

```text
privacy.dataClasses = [STUDENT_PERSONAL]
remoteProviderAllowed = false
```

Il payload non viene inoltrato a provider remoto. LIB-01B v0 limita le capability a operazioni locali/non generative che non richiedono trasmissione del contenuto.

### `unknown`

Non viene falsamente riclassificata in una classe più permissiva o più specifica.

```text
privacy.dataClasses = []
remoteProviderAllowed = false
permissions include library:privacy-unclassified
```

Il Registro adapter espone soltanto capability che non richiedono lettura/trasmissione del contenuto:

```text
OPEN
REVIEW
LINK
```

Nessuna capability `requiresGenerativeAI` o `requiresSemanticSearch` viene registrata come disponibile per questa fonte finché la classificazione non diventa esplicita.

Questa scelta applica minimizzazione e fail-closed senza inventare una nuova data class del Core.

## 8. Action set LIB-01B v0

Le azioni verticali sono **binding di capability condivise**, non un resolver locale.

Set iniziale previsto:

| Action id verticale | Capability | Risk | Generative | Effetto |
|---|---|---|---|---|
| `library.open-source` | `OPEN` | `READ_ONLY` | no | apre/mostra la fonte locale/origine su azione esplicita |
| `library.review-source` | `REVIEW` | `READ_ONLY` | no | apre i dettagli e lo stato privacy/collegamenti |
| `library.link-active-uda` | `LINK` | `WRITE_REVERSIBLE` | no | propone collegamento alla UDA attiva; richiede conferma |
| `library.prepare-for-uda` | `PREPARE` | `PROPOSE` | sì | produce bozza preparatoria, nessuna scrittura canonica |
| `library.create-activity-draft` | `CREATE` | `PROPOSE` | sì | produce bozza attività, nessuna scrittura canonica |
| `library.summarize-for-uda` | `SUMMARIZE` | `PROPOSE` | sì | produce sintesi contestuale |
| `library.explain-for-uda` | `EXPLAIN` | `PROPOSE` | sì | produce spiegazione contestualizzata |

In v0, con `generativeMode = none`, le azioni generative sono correttamente non disponibili/negate dal Core. Questo è comportamento previsto, non fallback locale.

Il primo incremento LIB-01B deve dimostrare l'integrazione reale con il Core anche **senza AI** tramite `OPEN`, `REVIEW`, `LINK`.

## 9. Progressive disclosure

La UI non mostra un muro di funzioni.

Dopo **Usa**:

- massimo **3 azioni primarie** visibili;
- eventuale quarto controllo: **Altre possibilità**;
- le azioni avanzate sono mostrate solo se restituite dal Core;
- nessuna capability tecnica, risk class o provider identity è visibile al docente;
- se non esiste UDA attiva, non si mostrano trasformazioni “per questa UDA”;
- se privacy è `unknown`, la UI spiega in linguaggio docente che la fonte può essere aperta/collegata ma va classificata prima di usarla con funzioni che elaborano il contenuto.

`LibrarySourceCard` resta proprietaria del pulsante **Usa**, mentre la presentazione delle azioni viene delegata a un componente dedicato.

## 10. Presentation adapter

Modulo previsto:

`src/components/LibraryContextActions.tsx`

Responsabilità:

- ricevere `ResolvedAction[]` dal Core;
- presentare massimo tre azioni principali;
- rendere `Altre possibilità` solo se ci sono altre azioni;
- mostrare stato di risoluzione/deny in forma non tecnica;
- non creare action registry o ranking;
- non possedere logica di persistenza;
- non eseguire write senza esplicita conferma.

## 11. Execution adapter

Modulo previsto:

`src/copilot/libraryActionExecutor.ts`

Responsabilità:

- tradurre un action id già ammesso dal Core in una operazione verticale;
- leggere il payload della fonte solo al momento dell'esecuzione;
- restituire una proposta per azioni `PROPOSE`;
- per `LINK`, invocare il durable handler esistente **solo dopo** che `dispatch` restituisce/gestisce il requisito di conferma umana;
- non mutare direttamente UDA o LibraryState fuori dai durable handler esistenti;
- non eseguire provider remoto in LIB-01B v0.

## 12. Proposal boundary

Le azioni generative future dovranno produrre un oggetto di bozza separato dai dati canonici, ad esempio:

```ts
interface LibraryDraftProposal {
  id: string
  sourceId: string
  actionId: string
  targetUdaId?: string
  title: string
  body: string
  createdAt: string
}
```

In LIB-01B v0 non è necessario persistere tale oggetto se `generativeMode = none`; il tipo può essere introdotto solo quando serve al primo provider/trasformatore reale.

Nessuna proposta entra automaticamente in `UdaRecord`.

## 13. Stato “UDA attiva”

LIB-01B non inventa una nuova global selection.

Per il primo incremento, la UDA contestuale viene determinata in quest'ordine:

1. se la fonte ha esattamente un link `uda`, quella UDA è il contesto attivo;
2. se ha più link UDA o nessun link, `activeUda = null` finché il docente non seleziona esplicitamente il target dalla superficie contestuale;
3. la selezione del target è stato UI effimero, non una nuova authority canonica.

Questo evita inferenze silenziose sul lavoro corrente.

## 14. Stato fonte e capability

- `failed` → nessuna azione di trasformazione;
- `restricted` → solo `OPEN`, `REVIEW` e operazioni locali esplicitamente consentite;
- `needs-review` → `REVIEW` prioritario, trasformazioni nascoste;
- `captured` / `ready` → capability dipendono da privacy e contesto UDA.

Il Registry condiviso contiene le azioni; il Registro adapter decide solo quali capability dichiara come disponibili in base al proprio stato verticale.

## 15. Failure semantics

- errore del Core → nessuna mutazione, messaggio locale e possibilità di riprovare;
- assenza del Core/package → build/test falliscono; nessun resolver alternativo;
- provenance vendor non valida → qualification fail-closed;
- action id sconosciuto → deny, nessun fallback;
- dispatch negato → executor non invocato;
- conferma annullata → stato canonico invariato;
- errore durable dopo conferma → stato/bozza di retry preservati secondo PERSIST-01H;
- provider generativo assente → azioni generative non vengono sostituite da comportamento differente.

## 16. Gate di qualificazione

### Contratto package

- vendored package corrisponde a un commit integrato su TRAMA main;
- superficie file esatta;
- SHA256 verificati;
- package name/version corretti;
- nessuna dependency di rete/runtime aggiuntiva.

### Adapter

- `LibrarySource` non viene copiato integralmente nel `ContextSnapshot`;
- capability non dichiarate non possono apparire;
- `unknown` non abilita generazione o semantica;
- `student-personal` non abilita remoto;
- nessun branching/resolver locale alternativo.

### Dispatch

- `LINK` richiede conferma umana;
- deny non invoca durable handler;
- cancel non muta LibraryState/UDA;
- commit avviene solo tramite handler persistente esistente.

### Browser

Su mobile `390×844` e desktop `1280×900`:

1. **Usa** apre una superficie contestuale compatta;
2. massimo tre azioni primarie + `Altre possibilità`;
3. senza UDA attiva non appaiono azioni specifiche UDA;
4. con una UDA collegata il contesto è esplicito;
5. fonte `unknown` non espone trasformazioni del contenuto;
6. `LINK` mostra conferma prima della scrittura;
7. annullamento lascia invariati i dati;
8. conferma persiste il link e sopravvive al reload;
9. nessun falso successo durante persistenza pending/failure;
10. nessun overflow orizzontale o target tattile <44 px.

## 17. Fasi

### LIB-01B.0 — Shared Core deterministic integration

Obiettivo: dimostrare il consumo reale del Core condiviso con `generativeMode = none` e azioni locali `OPEN`, `REVIEW`, `LINK`.

Questo incremento è il prerequisito per qualunque trasformazione AI.

### LIB-01B.1 — Governed proposal generation

Incremento successivo separato. Introduce un provider/adapter autorizzato e produce solo proposte. Richiede una nuova decisione privacy/provider e test dedicati; non è incluso in LIB-01B.0.

## 18. Non-obiettivi LIB-01B.0

- generazione remota;
- OCR o crawling;
- vector database;
- embedding obbligatori;
- scrittura automatica di UDA/lezioni;
- nuovo database;
- nuovo server;
- nuovo modello di authority;
- sincronizzazione cloud della Biblioteca;
- pubblicazione del Core su npm/registry;
- generalizzazione prematura ad altri consumer oltre al contratto condiviso già qualificato.

## 19. Exit criteria

LIB-01B.0 è qualificato quando:

1. il Core è integrato in TRAMA main con SHA canonico;
2. il vendor snapshot nel Registro è pinned e verificato;
3. il Registro importa `@trama/contextual-copilot-core`, non una copia logica locale;
4. `Usa` passa realmente dal Core per risolvere le azioni;
5. privacy/state/authority sono fail-closed;
6. nessun resolver duplicato compare nel Registro;
7. `LINK` dimostra dispatch + conferma + durable write;
8. PREDEPLOY e Browser Qualification sono PASS sullo stesso exact application candidate;
9. review indipendente ha 0 finding bloccanti;
10. nessun deploy o merge avviene senza decisione umana separata.
