# LIB-04 — Contextual Copilot Request & Composer

**Data:** 2026-10-25  
**Repository consumer:** `antoniocorsano-boop/registro-docente`  
**Shared dependency:** `antoniocorsano-boop/trama-ecosistema/shared/contextual-copilot-core`  
**Baseline Registro:** `main@e83882380e5aeae51d7d4024b2fd5dca25e36b69`  
**Audit:** `docs/superpowers/specs/2026-10-25-lib-end-to-end-completion-audit.md`  
**Stato:** PROPOSED / HUMAN DESIGN DECISION REQUIRED / NO IMPLEMENTATION AUTHORITY

## Intento

Chiudere il principale gap residuo della visione LIB-01: il docente deve poter usare una fonte della Biblioteca **dal copilota contestuale**, senza dover prima navigare nella superficie Biblioteca e senza dover tradurre la propria intenzione nella tassonomia dell'app.

Esperienza obiettivo:

`Sono nel lavoro corrente → apro il copilota → aggiungo/seleziono una fonte → scrivo cosa voglio → il sistema propone/risolve solo azioni consentite → decido io cosa applicare`.

Esempio:

> «Usa questa foto per preparare un'attività di osservazione per la 2C.»

Il messaggio libero non deve bypassare capability, policy, privacy, provider disclosure o human confirmation già qualificati.

## Perché LIB-04 è necessario

La baseline corrente possiede già:

- Library Store durevole;
- intake eterogeneo;
- Teaching Context;
- Planning Context;
- relevance resolver;
- action registry + policy + dispatch condivisi;
- provider runtime governato per `PREPARE`;
- draft proposal + `Adotta / Adatta / Lascia`;
- progressive relevance UX.

Manca però il contratto operativo:

```ts
CopilotRequest = ContextSnapshot + free-text message + allowed capabilities
```

Il design TRAMA di ricerca lo prevedeva, ma `@trama/contextual-copilot-core@0.1.0` non lo espone ancora.

## Decisione architetturale proposta

LIB-04 non introduce un intent resolver specifico di `registro-docente`.

La soluzione raccomandata è un vertical slice coordinato:

```text
registro-docente presentation/context adapter
                │
                ▼
TRAMA Contextual Copilot Core
  request + intent contract
  capability/policy filter
  dispatch
                │
                ▼
registro-docente vertical executors
  Library intake
  PREPARE runtime
  LINK persistence
  local REVIEW
```

## Approcci

### A — Parser locale nel Registro

Respinto. Duplica l'Intent Resolver previsto dal Core condiviso e rende il comportamento divergente rispetto agli altri consumer.

### B — Solo action sheet senza testo libero

Respinto come soluzione finale. Non chiude il requisito originario di linguaggio naturale e costringe il docente a tradurre l'intento in pulsanti.

### C — Shared request/intent contract + composer sottile

Raccomandato.

Trade-off: richiede una tranche upstream nel Core, ma evita debito architetturale e rende il risultato riusabile da Docente OS e altri consumer.

## LIB-04A — Shared Request / Intent Contract

**Repository:** `trama-ecosistema`.

### Contratto minimo proposto

Il Core deve poter ricevere una richiesta conversazionale senza acquisire dominio verticale.

Forma concettuale:

```ts
interface CopilotRequest {
  context: ContextSnapshot
  message: string
  allowedCapabilities: readonly CapabilityId[]
}

interface IntentCandidate {
  actionId: string
  capability: CapabilityId
  confidence?: number
  reason?: string
}

interface IntentResolution {
  status: 'resolved' | 'ambiguous' | 'unavailable' | 'denied'
  candidates: readonly IntentCandidate[]
}
```

I nomi definitivi appartengono al contratto TRAMA e non sono autorizzati da questo documento.

### Invarianti

1. `message` non può creare capability.
2. Ogni candidate action deve esistere nell'Action Registry.
3. Policy e guardrail Core prevalgono sull'intent ranking.
4. Intent ambiguo non produce dispatch automatico.
5. Intent unavailable degrada a action suggestions già consentite.
6. Resolver/provider failure è fail-closed.
7. Un resolver remoto non riceve contesto o fonte protetta senza autorizzazione esplicita.
8. `STUDENT_PERSONAL` / `STUDENT_SENSITIVE` restano esclusi dai flussi remoti.
9. `INSTITUTIONAL_DECISION` resta non eseguibile dal Core generico.
10. `resolveActions()` e `dispatch()` v0 restano retrocompatibili.

### Modalità

Il contratto deve restare provider-neutral. Un'implementazione di intent resolution può essere:

- deterministica/local;
- semantic local;
- semantic remote solo se autorizzata;
- unavailable, con fallback alle azioni deterministiche consentite.

LIB-04 non obbliga a introdurre embedding o un modello remoto.

## LIB-04B — Registro Composer & Source Bridge

**Repository:** `registro-docente`.

### Presentation adapter

Il composer è una superficie, non una nuova authority.

Deve mostrare in forma compatta:

- contesto didattico corrente;
- fonte selezionata/allegata, se presente;
- campo messaggio libero;
- massimo 3–4 suggerimenti primari;
- `Altre possibilità` soltanto per azioni già autorizzate dal Core.

### Source flow

Il docente può:

1. selezionare una fonte già in Biblioteca;
2. aggiungerne una nuova dal composer usando lo stesso intake LIB-02;
3. scrivere l'intento prima o dopo la selezione della fonte.

Una fonte aggiunta dal composer deve diventare una normale `LibrarySource` nel Secure Local Vault. Non deve esistere una copia chat-only destinata a scomparire.

### Context flow

Il composer riusa i contratti esistenti:

- Teaching Context LIB-01C;
- Planning Context LIB-03A quando univoco;
- relevance LIB-03B/03C per suggerimenti di destinazione;
- ContextSnapshot minimizzato LIB-01B.

Il contesto corrente deve essere visibile e sostituibile dal docente.

## LIB-04C — Primo vertical slice conversazionale

Per evitare un nuovo feature wall, il primo slice non implementa tutte le capability del vocabolario.

### In scope iniziale

#### `PREPARE`

Riusa integralmente:

- Core capability/policy;
- disclosure provider;
- consenso one-shot;
- route/runtime LIB-01D/E;
- `TeachingProposalV1`;
- `Adotta / Adatta / Lascia`.

Il messaggio libero può aggiungere istruzioni/parametri alla richiesta soltanto attraverso un payload allowlisted da definire e validare server-side.

#### `SUMMARIZE`

Seconda capability generativa proposta per dimostrare che il composer non è hard-coded su PREPARE.

Deve produrre una bozza non canonica, con provenance e nessuna scrittura automatica.

#### `LINK`

Il testo libero può risolvere l'intenzione di collegamento, ma il target deve essere:

- già valido nel contesto; oppure
- scelto esplicitamente dal docente da candidati relevance.

La write resta soggetta a dispatch + human confirmation + rivalidazione.

#### `REVIEW`

Percorso locale/read-only già esistente, riusato come fallback senza provider.

### Fuori scope iniziale

- `CREATE` generalizzato;
- `ASK` conversazionale multi-turn;
- `EXPLAIN`;
- semantic search globale;
- multi-source generation;
- attività come target canonico;
- modifica autonoma di UDA/lezioni;
- memoria conversazionale persistente;
- profili studente come contesto implicito;
- voice input.

Questi elementi possono diventare tranche successive solo dopo qualifica del request contract.

## Privacy e payload

Il testo libero è dato, non autorità.

Regole:

- messaggio e fonte restano separati dal `ContextSnapshot` quando non necessari alla risoluzione policy;
- provider remoto riceve solo payload allowlisted per l'azione richiesta;
- nessun URL arbitrario viene fetchato dal server;
- privacy della fonte prevale sull'intento testuale;
- il modello non può riclassificare `student-personal` in `teacher-professional`;
- provider/model devono restare disclosed prima del consenso remoto;
- il consenso resta request-scoped.

## Human-in-the-loop

Resta vincolante la sequenza:

`Message → Intent Resolution → Allowed Action → Draft/Preview → Human Decision → Canonical Write`.

Il sistema non deve saltare direttamente da testo libero a mutazione.

## Progressive disclosure

Stato iniziale del composer:

- campo messaggio;
- aggiungi/seleziona fonte;
- contesto corrente;
- massimo 3–4 azioni suggerite.

Solo dopo `Altre possibilità` possono comparire ulteriori azioni già risolte dal Core.

Il catalogo di trasformazioni avanzate non deve essere una griglia permanente.

## Browser acceptance minima proposta

### Desktop

1. apri una UDA/lezione;
2. apri composer;
3. aggiungi una fonte testuale o selezionane una esistente;
4. scrivi «preparami un'attività usando questa fonte»;
5. il Core risolve `PREPARE`, senza write;
6. eventuale provider disclosure + consenso one-shot;
7. genera proposta;
8. `Lascia` → zero write;
9. ripeti e `Adotta` → nuova fonte interna con provenance;
10. reload/unlock → fonte e artefatto restano persistiti.

### Intent ambiguo

Messaggio ambiguo → nessuna esecuzione automatica; mostra scelta tra sole capability consentite.

### Privacy

Fonte `student-personal` + richiesta generativa → remote denied; REVIEW locale può restare disponibile se consentita.

### Link

Messaggio di collegamento → nessuna write prima della conferma; target stale prima della conferma → fail-closed.

### Mobile 390×844

- composer leggibile;
- fonte/context chip compatti;
- nessun overflow;
- controlli primari >=44px;
- nessuna sovrapposizione permanente che copra contenuto/azioni.

## Dipendenze

Bloccante:

- LIB-04A deve essere qualificato e integrato nel Core condiviso prima che il Registro implementi un resolver conversazionale.

Non bloccanti per il design:

- semantic search;
- embeddings;
- `MasterProgram`;
- target `activity`;
- multi-source generation.

## Criterio di uscita del design

Il design può passare a implementation planning solo dopo decisione umana esplicita su:

1. adozione dell'approccio C;
2. autorizzazione della tranche upstream LIB-04A/CORE nel repository TRAMA;
3. conferma che il primo slice del Registro resta limitato a `PREPARE`, `SUMMARIZE`, `LINK`, `REVIEW`.

Fino a quella decisione:

`LIB-04 = PROPOSED / NO IMPLEMENTATION / NO MERGE / NO DEPLOY`.