# LIB — End-to-End Completion Audit

**Data:** 2026-10-25  
**Repository:** `antoniocorsano-boop/registro-docente`  
**Audit baseline:** `main@e83882380e5aeae51d7d4024b2fd5dca25e36b69`  
**Contratto originario:** `docs/superpowers/specs/2026-10-24-lib-01-private-library-contextual-ingest-design.md`  
**Stato:** AUDIT COMPLETE / NEXT BLOCK DEFINITION PROPOSED / NO PRODUCT CHANGE

## 1. Obiettivo

Verificare il programma Biblioteca privata end-to-end contro il contratto originario LIB-01, distinguendo:

1. requisito originario;
2. comportamento realmente integrato in `main`;
3. gap residuo reale;
4. elementi esplicitamente differiti o non più opportuni;
5. prossimo blocco da canonizzare senza duplicare il TRAMA Contextual Copilot Core.

L'audit non assume che l'integrazione di LIB-01A…LIB-03C equivalga automaticamente alla chiusura completa della visione originaria.

## 2. Baseline reale

La baseline auditata è il merge di LIB-03C:

`main@e83882380e5aeae51d7d4024b2fd5dca25e36b69`

Con provenienza:

- parent 1: `ab55ef83a38012fbaf4eb5e0c0e865cfa2aeef8a`;
- parent 2: exact candidate LIB-03C `22f55e9d30f6238b914816c55c73302b1fc78e8d`;
- PREDEPLOY post-merge #611 / run `40192426632`: PASS.

Il programma integrato comprende:

- LIB-01A — private library foundation;
- LIB-01B — Contextual Copilot Core integration;
- LIB-01C — deterministic Teaching Context;
- LIB-01D — governed teaching proposals;
- LIB-01E — governed provider runtime;
- LIB-02 — governed source acquisition;
- LIB-03A — Planning Context Bridge;
- LIB-03B — relevance resolver;
- LIB-03C — progressive relevance UX.

## 3. Esito sintetico

La Biblioteca è **engineering-complete come fondazione, acquisizione, persistenza, contesto, pertinenza, proposta governata e progressive UX dentro la superficie Biblioteca**.

Non è ancora completa rispetto alla visione LIB-01 originaria perché manca il tratto conversazionale principale:

`Copilota aperto nel lavoro corrente → aggiungo/seleziono una fonte → scrivo liberamente cosa voglio → il Core risolve l'intento tra capability già autorizzate → ottengo una proposta governata`.

Questo gap corrisponde sostanzialmente alla slice originaria **LIB-D — Copilota contestuale**, solo parzialmente coperta dalle tranche attuali.

## 4. Matrice di completamento

Legenda:

- `DONE` — requisito sostanzialmente coperto e qualificato;
- `PARTIAL` — infrastruttura presente ma esperienza/contratto incompleto;
- `DEFERRED` — requisito valido ma dipendente da un confine non ancora canonico;
- `NOT REQUIRED V1` — esplicitamente non necessario per la prima versione;
- `NEXT` — gap con priorità sufficiente per il prossimo blocco.

| Requisito originario | Stato | Evidenza / ruling |
|---|---|---|
| `LibrarySource` privata, versionata, local-first | DONE | `src/library/types.ts`, Secure Local Vault, backup/restore |
| Foto/immagine | DONE | `Aggiungi fonte → Foto o file`; immagini conservate anche senza testo |
| File/PDF/testi | DONE | LIB-02 normalizzazione locale + runtime multimodale governato |
| URL web | DONE | URL conservata separatamente; URL senza testo resta `needs-review`; nessun fetch server arbitrario |
| Testo/appunto/concetto | DONE | `text/note/concept` in intake e UI |
| Materiale interno | PARTIAL | `internal` esiste ed è usato per proposte adottate; manca un comando generale per salvare qualunque materiale già presente nel Registro come fonte |
| Stati `captured/ready/needs-review/restricted/failed` | DONE a livello dominio | Il dominio e i filtri li supportano; non ogni stato ha necessariamente un percorso UI autonomo di creazione |
| Ricerca semplice | DONE | titolo, extracted text, note, origin, URL, payload text, kind, target id |
| Recenti / Collegate / Da rivedere | DONE | `LibraryView` |
| Rinomina | DONE | menu `Gestisci` |
| Collega / scollega | DONE per UDA/lezione | write durevole + percorso governato |
| Elimina | DONE | conferma + persistenza commit-first |
| Backup/restore con fonti e link | DONE | LIB-01A + browser qualification |
| Failure-safe persistence | DONE | error state + retry; nessun publish prima del commit |
| Teaching Context esplicito | DONE | UDA/lezione selezionabile e visibile |
| Teaching Context suggerito | DONE | LIB-01C deterministico, override docente |
| Planning Context | DONE | LIB-03A fail-closed |
| Pertinenza locale della fonte | DONE | LIB-03B deterministic relevance resolver |
| Progressive relevance UX | DONE | LIB-03C: max 3 candidati iniziali, expand, ignore, link, prepare |
| Nessuna auto-selezione / auto-write | DONE | LIB-03C + Core human-confirmation gate |
| Proposta didattica governata | DONE | LIB-01D `Adotta / Adatta / Lascia` |
| Provider remoto esplicito, disclosure, one-shot consent | DONE | LIB-01E |
| `student-personal` negato al provider remoto | DONE | fail-closed UI + server boundary |
| Provenienza tecnica fonte → artefatto | DONE | `derivedFromSourceId` + provider/model/generatedAt |
| Provenienza visibile al docente | PARTIAL | la provenance è persistita/validata, ma `LibrarySourceCard` non mostra ancora esplicitamente `Derivato da: …` |
| Multi-source provenance | DEFERRED | il modello corrente è single-source; nessun contratto multi-source canonico |
| Collegamento a `activity` | DEFERRED | il tipo ammette `activity`, ma LIB-03B/03C limitano intenzionalmente i target a UDA/lezione; manca un'identità attività canonica affidabile |
| Ingresso fonte direttamente dal copilota | NEXT | assente: `Aggiungi fonte` vive nella superficie Biblioteca, non in un composer contestuale condiviso |
| Testo libero nel copilota | NEXT | assente: non esiste un `CopilotRequest.message` operativo nel consumer attuale |
| Intent routing condiviso | NEXT / UPSTREAM | il design TRAMA lo prevedeva, ma il Core v0 distribuito espone `resolveActions` e `dispatch`, non un contratto di intent resolution |
| `ASK` | NEXT | dichiarata nel design condiviso, non implementata nel consumer Biblioteca |
| `CREATE` | NEXT/LATER | non implementata; prima serve request/intent contract condiviso |
| `SUMMARIZE` | PARTIAL/NEXT | action registrata nel consumer, ma esclusa dal remote proposal registry e non eseguibile nella UX corrente |
| `EXPLAIN` | NEXT/LATER | solo nel vocabolario condiviso, non nel consumer |
| `PREPARE` | DONE per attività | un solo output strutturato `activity`; non è ancora un catalogo generale di artefatti |
| Azioni dinamiche da ultimo intento | NEXT | impossibile finché il messaggio libero non entra nel Core |
| `Altre possibilità` per trasformazioni avanzate | PARTIAL | progressive disclosure esiste per relevance; non esiste ancora un catalogo governato di trasformazioni conversazionali |
| Livello 3: durata/livello/formato/inclusione | DEFERRED | richiede prima intent + transformation request generalizzata |
| Prova un'altra versione | PARTIAL | possibile solo ripetendo il flusso; non esiste un'azione governata esplicita di variante |
| Salva come materiale | DONE equivalente | `Adotta` crea una nuova fonte `internal` con provenance |
| Ricerca semantica | NOT REQUIRED V1 | specifica originaria la dichiarava futura/opzionale |
| Crawling web generalizzato | NOT REQUIRED V1 | esplicitamente non-goal |
| Marketplace / sharing multiutente | NOT REQUIRED V1 | esplicitamente non-goal |

## 5. Verifica della slice originaria A–G

La suddivisione originaria era:

- LIB-A Domain + durable storage;
- LIB-B Intake;
- LIB-C Library surface;
- LIB-D Copilota contestuale;
- LIB-E Progressive disclosure + draft artifacts;
- LIB-F Privacy + provider boundary;
- LIB-G Browser qualification.

Ruling:

| Slice originaria | Stato reale |
|---|---|
| LIB-A | DONE |
| LIB-B | DONE |
| LIB-C | DONE |
| LIB-D | PARTIAL — manca composer + free text + intent routing |
| LIB-E | PARTIAL/DONE — progressive relevance + draft activity presenti; catalogo trasformazioni avanzate ancora assente |
| LIB-F | DONE per il percorso PREPARE corrente |
| LIB-G | DONE per i percorsi integrati esistenti |

Conclusione: **il programma non è 100% della visione originaria**, anche se tutti i piani esecutivi materializzati fino a LIB-03C sono stati completati.

## 6. Gap architetturale bloccante

`docs/superpowers/specs/2026-10-24-lib-01-contextual-core-alignment.md` stabilisce che il Registro non deve costruire un secondo motore di copilota. Il Core condiviso resta responsabile di action resolution, intent interpretation, policy e orchestrazione.

Il design di ricerca TRAMA preservato definisceva:

```ts
interface CopilotRequest {
  context: ContextSnapshot
  message: string
  allowedCapabilities: CapabilityId[]
}
```

ed esplicitava `Intent Resolver` nel Core.

Il pacchetto canonico attuale `@trama/contextual-copilot-core@0.1.0`, invece, espone soltanto:

- `resolveActions(context)`;
- `dispatch(...)`;
- `SemanticPort.search/rank` opzionali.

Non espone un contratto per il messaggio libero o una risoluzione intenti.

Quindi il gap conversazionale **non può essere chiuso correttamente da un parser locale specifico del Registro**.

## 7. Approcci valutati per il prossimo blocco

### A. Parser/intent router locale in `registro-docente`

**Scartato.** È la via più veloce ma duplica il componente che il contratto di allineamento assegna al Core condiviso e crea divergenza futura con Docente OS.

### B. Composer UI con soli pulsanti, nessun testo libero

**Scartato come chiusura LIB-D.** Migliorerebbe l'accesso ma non soddisfa il requisito originario «il docente può ignorare i suggerimenti e scrivere direttamente».

### C. Evolvere il Core condiviso con un request/intent contract, poi collegare un composer sottile nel Registro

**Raccomandato.** Preserva il confine cross-app, riusa capability/policy/dispatch esistenti e permette di aggiungere trasformazioni ulteriori senza moltiplicare resolver verticali.

## 8. Prossimo blocco raccomandato

**LIB-04 — Contextual Copilot Request & Composer**

Obiettivo prodotto:

> Il docente può aprire il copilota nel contesto corrente, aggiungere o selezionare una fonte della Biblioteca, scrivere liberamente ciò che vuole ottenere e ricevere soltanto intenti/azioni già autorizzati dal Core; ogni proposta resta separata dalla scrittura canonica.

LIB-04 deve essere un blocco coordinato cross-repository:

### LIB-04A — Shared Copilot Request / Intent Contract — `trama-ecosistema`

Responsabilità:

- introdurre un contratto provider-neutral per `CopilotRequest`;
- introdurre una risoluzione intenti che restituisca esclusivamente action/capability già dichiarate e già policy-eligible;
- nessun branching per `registro-docente` o Docente OS;
- fallback deterministico/fail-closed quando l'intento non è risolvibile;
- un intent resolver non può creare capability;
- privacy remota equivalente ai guardrail Semantic/Generative già esistenti;
- preservare `resolveActions`/`dispatch` e compatibilità v0.

### LIB-04B — Registro Context Adapter + Composer — `registro-docente`

Responsabilità:

- presentation adapter leggero, non un motore locale;
- mostrare contesto corrente compatto;
- `Aggiungi/seleziona fonte` direttamente dal composer;
- messaggio libero;
- inviare al Core solo `ContextSnapshot` + request contract consentito;
- presentare massimo 3–4 azioni/risposte primarie più `Altre possibilità`;
- nessun auto-run di una write;
- preservare LibrarySource persistente anche quando nasce dal composer;
- riusare Teaching Context, relevance, provider disclosure, proposal runtime e persistence già integrati.

### LIB-04C — Primo vertical slice conversazionale

Scope minimo raccomandato:

1. `PREPARE` — già dispone di runtime verticale qualificato;
2. `SUMMARIZE` — seconda capability proposta, senza introdurre un catalogo ampio;
3. `LINK` — resta governata e confermata;
4. `REVIEW` — locale/read-only.

`CREATE`, `ASK`, `EXPLAIN` e il catalogo avanzato restano fuori dal primo slice finché il request contract non è qualificato end-to-end.

## 9. Criteri di uscita proposti LIB-04

Un candidato LIB-04 è qualificabile solo quando:

1. la stessa API di request/intent del Core è provata almeno con fixture Registro + Docente OS;
2. un messaggio libero non può introdurre capability non dichiarate;
3. intent ambiguo → nessuna mutazione e richiesta/fallback leggibile;
4. fonte `student-personal` non raggiunge un resolver/provider remoto;
5. fonte aggiunta dal composer è persistita nel normale Library Store, non in stato chat separato;
6. `PREPARE` riusa il runtime LIB-01D/E senza duplicarlo;
7. `LINK` conserva doppio gate e rivalidazione prima della write;
8. mobile 390×844 non presenta feature wall o overflow;
9. browser qualification copre allegato + testo libero + proposta + human decision;
10. nessun merge/deploy avviene senza decisione umana separata.

## 10. Gap di pubblicazione separato

L'ultima evidenza canonica di pubblicazione/live verification nel repository riguarda il frozen release source:

`4be167245267da6d664e634e5070a2cc9beb265f`

sul target `https://registro-docente.ai.studio` (PR operativa #46).

Di conseguenza, `main@e8388238...` con LIB-01D/E, LIB-02 e LIB-03A/B/C **non dispone ancora nel repository di una ricevuta canonica di pubblicazione/live verification equivalente**.

Questo è un gap di release, non un finding sul codice LIB. Va mantenuto separato dalla definizione funzionale LIB-04.

## 11. Decisione proposta

Stato raccomandato dopo questo audit:

`LIB-01A→LIB-03C = ENGINEERING INTEGRATED / ORIGINAL LIB VISION PARTIALLY COMPLETE`

`NEXT = LIB-04 CONTEXTUAL COPILOT REQUEST & COMPOSER — DESIGN DECISION PENDING`

`LIVE = CURRENT MAIN NOT YET CANONICALLY LIVE-VERIFIED`

Nessun codice prodotto, merge o deploy è autorizzato da questo audit.