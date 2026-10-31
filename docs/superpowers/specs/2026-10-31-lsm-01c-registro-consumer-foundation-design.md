# LSM-01C-A — Registro Docente consumer foundation

**Data:** 2026-10-31  
**Repository:** `antoniocorsano-boop/registro-docente`  
**Baseline:** `main@d496b51a5a1677c1c6893010c28bea2ba43dc91b`  
**Shared contract:** `@trama/contextual-copilot-semantic-memory@0.1.0`  
**Reference runtime:** LSM-01B integrated in `trama-ecosistema@947e18de723dc1e4e2eb2c9031596f8c552a848a`  
**Status:** APPROVED DIRECTION / IMPLEMENTATION BRANCH

## 1. Intent

Adottare la Local Semantic Memory condivisa come **indice derivato opzionale** del Registro Docente, senza creare una seconda fonte di verità e senza sostituire i percorsi locali già qualificati.

Il primo incremento deve consentire al docente di collegare esplicitamente il Registro a `trama-semantic-memoryd`, sincronizzare contenuti professionali ammessi e usare il namespace della Biblioteca per una ricerca per significato condivisa. La Professional Memory resta canonica nel Registro e viene soltanto proiettata nell'indice.

## 2. Autorità e non-goals

Restano canonici nel Registro:

- `LibraryStateV1` per le fonti della Biblioteca;
- `ProfessionalMemoryStateV1` per la memoria professionale;
- Planning e UDA per i rispettivi domini;
- Contextual Copilot Core per l'autorità sulle azioni governate.

LSM-01C-A **non**:

- modifica dati canonici a partire da hit semantici;
- persiste il token LSM in backup, vault o `localStorage`;
- invia contenuti a provider remoti;
- esegue probe loopback all'avvio della pagina;
- sostituisce `embeddingService` o `retrieveLibrarySourcesByMeaning`;
- aggiunge retrieval cross-corpus al Copilota in questo incremento;
- indicizza dati studente, classificazioni ambigue o fonti `unknown`;
- implementa sincronizzazione continua in background;
- introduce deploy o publish automatici.

## 3. Approcci considerati

### A. Sostituire la ricerca semantica Biblioteca con LSM

Riduce duplicazione, ma rende LSM un requisito operativo immediato e crea una regressione quando il runtime non è disponibile. **Scartato per il primo consumer.**

### B. Indicizzare soltanto Professional Memory

È il percorso più piccolo, ma non dimostra il valore del runtime condiviso sulla superficie già usata dal docente e lascia la Biblioteca fuori dal primo verticale. **Scartato come incremento iniziale.**

### C. LSM opzionale affiancata a Biblioteca + Professional Memory

Mantiene il comportamento esistente, rende il rollout reversibile e consente di qualificare separatamente projection, privacy, CAS e retrieval. **Selezionato.**

## 4. Contratto vendorizzato

Il Registro consuma esattamente `@trama/contextual-copilot-semantic-memory@0.1.0` come package locale vendorizzato, seguendo lo stesso modello già usato per Core e Intent Embedding.

La provenienza deve dichiarare:

- repository sorgente `antoniocorsano-boop/trama-ecosistema`;
- package source commit `fc85d33fd0e9ef3f452f3c823027a0b2b9a74808`;
- consumer mode `vendored-file-package`;
- build senza registry o rete esterna;
- digest dei file del distribution receipt LSM-01A.

## 5. Configurazione session-only

La connessione LSM è session-only:

```ts
export interface SemanticMemorySessionConfig {
  endpointUrl: string;
  token: string;
}
```

Default UI: `http://127.0.0.1:8765`.

Regole:

- endpoint esclusivamente HTTP loopback (`127.0.0.1`, `localhost`, `::1`);
- il token non entra in `AppSettings`, backup, IndexedDB o `localStorage`;
- nessuna richiesta viene effettuata alla costruzione del client;
- il primo `health()` è provocato dal pulsante esplicito `Connetti memoria locale`;
- le POST usano `Authorization: Bearer <token>`;
- redirect vietati, credenziali browser omesse, timeout finito, `cache: no-store`;
- per il browser la fetch dichiara `targetAddressSpace: 'loopback'` quando supportato dal tipo/runtime.

## 6. Projection Biblioteca

Namespace: `registro/library`  
`sourceAppId`: `registro-docente`  
`sourceType`: `library-source`

È proiettabile soltanto una `LibrarySource` che:

- ha `privacy === 'teacher-professional'`;
- non ha stato `restricted` o `failed`;
- possiede testo semantico non vuoto.

Il testo semantico usa lo stesso ordine già qualificato nella ricerca corrente:

`title + extractedText + payload.text + notes`.

Mappatura:

- `dataClass = TEACHER_PROFESSIONAL`;
- `canonicalRef = registro://library/source/<id>`;
- `updatedAt = capturedAt` finché `LibrarySource` non espone una revisione/updatedAt canonica separata;
- `revision` = digest deterministico del payload semantico proiettato, non timestamp ordinabile;
- metadata solo stringhe e senza payload grezzo.

Fonti `student-personal` e `unknown` non producono projection.

## 7. Projection Professional Memory

Namespace: `registro/professional-memory`  
`sourceAppId`: `registro-docente`  
`sourceType`: `professional-memory-entry`

Sono proiettate soltanto entry `status === 'active'`.

Mapping data class:

```text
TEACHER_PROFESSIONAL        -> TEACHER_PROFESSIONAL
CURRICULUM_PLANNING         -> CURRICOLO
PUBLIC_EXTERNAL_CONTENT     -> PUBLIC_APP
AGGREGATED_NON_IDENTIFIABLE -> AGGREGATED_NON_IDENTIFIABLE
```

Mappatura:

- `text = entry.summary`;
- `canonicalRef = registro://professional-memory/entry/<id>`;
- `updatedAt = entry.updatedAt`;
- `revision` = digest deterministico del contenuto semantico e dei metadati governati;
- correzioni del docente cambiano revision e sostituiscono via CAS;
- entry stale non sono desiderate nell'indice e vengono rimosse al refresh.

## 8. Ledger di sincronizzazione derivato

Per rispettare il CAS senza duplicare authority, il consumer conserva un piccolo ledger **device-local e non canonico**:

```ts
interface SemanticMemorySyncLedgerV1 {
  schema: 'registro.semantic-memory-sync-ledger/v1';
  endpoint: string;
  sources: Record<string, { revision: string }>;
}
```

Il ledger:

- non contiene testo, token o dati professionali;
- non entra nel backup;
- è separato per endpoint;
- serve soltanto a ricordare l'`expectedRevision` osservata;
- se corrotto viene ignorato fail-closed.

Se il runtime riporta `indexRevision === '0'`, il ledger locale viene azzerato perché l'indice è vuoto.

Perdita del ledger mentre il runtime contiene ancora projection del Registro può produrre `REVISION_CONFLICT`: v1 lo espone come stato da riconciliare/rebuild, senza bypass del CAS.

## 9. Sincronizzazione esplicita

`Sincronizza ora` è un gesto esplicito e usa uno snapshot canonico corrente di Biblioteca + Professional Memory.

Sequenza:

1. `health()`;
2. se `rebuild-required` -> stop, nessuna mutation;
3. se indice vuoto -> reset ledger;
4. costruzione projection ammesse;
5. upsert con `expectedRevision` dal ledger o `null`;
6. remove CAS delle source precedentemente indicizzate ma non più desiderate;
7. aggiornamento ledger soltanto dopo receipt valido;
8. conflict/errore tecnico -> stato esplicito, nessun overwrite forzato.

La sincronizzazione non viene attivata automaticamente da ogni mutation canonica in v1.

## 10. Retrieval Biblioteca tramite LSM

La query LSM per Biblioteca usa:

```ts
{
  schema: 'trama.semantic-memory-search-request/v1',
  namespaces: ['registro/library'],
  allowedDataClasses: ['TEACHER_PROFESSIONAL'],
  limit: 8
}
```

Regole:

- solo su azione esplicita del docente;
- hit chunk della stessa source vengono deduplicati per `sourceId`, conservando il punteggio massimo;
- ogni hit viene risolto nuovamente contro `LibraryStateV1` corrente;
- source cancellate, privacy cambiata o non più ammissibili vengono ignorate;
- score è ranking, non authority;
- nessuna selezione o binding automatico della fonte.

Quando LSM non è connessa o non è pronta, la ricerca semantica Biblioteca esistente tramite `embeddingService` resta disponibile e invariata.

## 11. UI e progressive disclosure

Nelle Impostazioni compare una sezione separata `Memoria semantica locale` con:

- endpoint loopback;
- token password session-only;
- `Connetti memoria locale`;
- stato health;
- `Sincronizza ora` disponibile solo dopo connessione valida;
- riepilogo dell'ultimo refresh, senza contenuti professionali.

Nella Biblioteca la disclosure esistente `Ricerca per significato` resta una sola superficie. Se una sessione LSM è pronta usa `registro/library`; altrimenti usa il motore locale esistente. La UI deve indicare quale motore locale è attivo senza esporre dettagli sensibili.

Nessun probe LSM avviene all'avvio e nessun errore LSM blocca la ricerca testuale normale.

## 12. Privacy e fail-closed

- `student-personal` Biblioteca: mai proiettato;
- `unknown`: mai proiettato;
- entry Professional Memory già ammesse dal suo dominio: mappate esplicitamente alle sole quattro classi LSM v1;
- nessun payload studente entra nelle query/projection;
- token esclusivamente in memoria di sessione;
- endpoint non-loopback rifiutato prima della rete;
- response envelope validato con il package condiviso;
- conflitti CAS non vengono convertiti in overwrite.

## 13. Qualification

Engineering gate sull'exact SHA:

- RED -> GREEN per ogni nuovo comportamento;
- `bun install --frozen-lockfile`;
- typecheck;
- security + semantic-memory tests;
- library tests;
- build;
- browser certification canonica solo su GitHub-hosted runner quando la UI cambia;
- dati esclusivamente sintetici;
- nessun merge/deploy implicito.

Il loopback reale Android/Termux è già qualificato come runtime LSM-01B; LSM-01C-A richiederà un targeted consumer smoke sul nuovo exact SHA prima del merge, ma non una ripetizione dell'intero runtime qualification.

## 14. Follow-on

Dopo LSM-01C-A qualificato:

- **LSM-01C-B Registro Copilot retrieval**: retrieval cross-corpus governato da namespace e contesto, senza trasferire authority agli hit;
- **LSM-01C-C Docente OS adoption**: projection materiali/preparazione e retrieval locale condiviso;
- Planning projection viene valutata nel follow-on, non inclusa in 01C-A.
