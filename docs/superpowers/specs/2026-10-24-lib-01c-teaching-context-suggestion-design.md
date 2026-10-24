# LIB-01C — Deterministic teaching-context suggestion design

**Status:** proposed for human approval  
**Repository baseline:** `main@ab1e23c1014dc96231aa92cfe8cf6e39a47c50a0`  
**Predecessor:** LIB-01B integrated via PR #40  
**Existing superseded variant:** PR #41 implements manual-only teaching-context selection and must not be merged as-is after the new human decision recorded on 2026-10-24.

## Intent

La Biblioteca privata deve smettere di comportarsi come un archivio isolato e diventare contestuale al lavoro didattico reale del docente. Quando il docente sceglie `Usa` su una fonte, il sistema deve **proporre** il contesto didattico più plausibile usando solo segnali deterministici già posseduti dal Registro Docente. La proposta non è un'autorità: il docente può sempre cambiarla e scegliere un'altra UDA o lezione prima di qualsiasi collegamento o futura trasformazione.

La proposta deve essere spiegabile, locale, privacy-first e indipendente da provider generativi o semantic search.

## Human decision

Decisione approvata nella conversazione del 2026-10-24:

> Il sistema fa la proposta ma il docente può sempre cambiare e scegliere altro.

Conseguenze vincolanti:

- niente selezione manuale obbligatoria quando esiste un contesto plausibile;
- niente scelta automatica irreversibile;
- `Cambia` deve essere sempre disponibile prima della mutazione;
- in caso di ambiguità il sistema deve preferire **nessuna proposta** a una proposta opaca o arbitraria.

## Goals

1. Suggerire UDA o lezione corrente usando segnali strutturali del prodotto.
2. Rendere visibile perché quella proposta è stata fatta.
3. Permettere al docente di sostituire la proposta con qualunque altro contesto valido.
4. Conservare il TRAMA Contextual Copilot Core come motore condiviso di policy/dispatch, senza introdurre un resolver Core sostitutivo nel Registro.
5. Mantenere il `ContextSnapshot` minimizzato e privo di contenuti della fonte o contenuti didattici estesi.
6. Mantenere `remoteProviderAllowed = false` e `generativeMode = none` in LIB-01C.
7. Mantenere il gate umano prima di qualunque `LINK` persistente.

## Non-goals

LIB-01C non deve:

- usare AI, embeddings, semantic search o similarità testuale per scegliere il contesto;
- inviare dati a provider remoti;
- interpretare titolo, testo, URL, immagine, estratto o note della fonte per fare ranking;
- introdurre una nuova authority globale di “contesto corrente”;
- introdurre una nuova entità persistente `material` o `activity`;
- attivare `PREPARE`, `SUMMARIZE` o altre trasformazioni generative;
- modificare automaticamente un'UDA o una lezione perché è stata proposta;
- persistere la proposta come fatto canonico del dominio.

## Approaches considered

### A. Manual-only selection

Dopo `Usa`, il docente sceglie sempre UDA e lezione. È semplice e totalmente esplicito, ed è la variante già implementata nella PR #41.

**Trade-off:** sicura ma poco contestuale; costringe il docente a ripetere una scelta che spesso il prodotto può dedurre in modo affidabile dai propri segnali strutturali.

**Decisione:** non più conforme alla decisione umana attuale.

### B. Semantic/generative suggestion

Confrontare la fonte con UDA/lezioni usando testo, embeddings o un provider e scegliere il contesto semanticamente più vicino.

**Trade-off:** potenzialmente più sofisticata ma anticipa LIB-01E, amplia il perimetro privacy, rende il ranking meno spiegabile e introduce una dipendenza esterna non necessaria.

**Decisione:** respinta per LIB-01C.

### C. Deterministic, explainable suggestion — selected

Usare solo segnali già presenti nel Registro: contesto esplicito di provenienza, classe corrente, data/periodo delle UDA e lezioni, ultima scelta esplicita del docente nella sessione. Se questi segnali non identificano un candidato univoco, non inventare una proposta.

**Trade-off:** meno “intelligente” di un ranking semantico, ma verificabile, privacy-safe, offline, stabile e coerente con l'authority verticale.

**Decisione:** selezionata.

## Current product facts that constrain the design

- `AppData` possiede `currentClassId` e le classi hanno `id`/`name`.
- `UdaRecord` possiede `id`, `title`, `className`, `period`, `startMonth`, `durationMonths` e opzionalmente `lessons`.
- `UdaLesson` possiede `id`, `date`, `topic`, `hours`, note opzionali e `activityType` opzionale.
- `LibrarySourceLink` supporta già `uda`, `lesson` e `activity`, ma nel dominio corrente non esiste una prima entità persistente autonoma `activity` da promuovere a contesto canonico.
- LIB-01B usa già il Core condiviso e mantiene `PREPARE`/`SUMMARIZE` non disponibili con `generativeMode = none`.

Perciò LIB-01C v1 propone solo **UDA o lezione**. `activity` resta compatibilità del tipo link, non una nuova authority di contesto.

## Architecture

La nuova logica appartiene a un adapter verticale sottile:

`Registro signals -> TeachingContextAdapter -> suggested context -> Library ContextSnapshot -> shared Core -> governed action -> vertical executor`

Il `TeachingContextAdapter` non decide policy Core e non effettua mutazioni. Produce soltanto un candidato didattico minimizzato e la motivazione deterministica della proposta.

Non viene introdotto uno store globale del contesto didattico. Il contesto esplicito proveniente da una superficie viene passato come input. L'ultima scelta manuale del docente viene mantenuta soltanto nello stato della sessione della Biblioteca e non nel vault persistente.

## Teaching context model

Il modello applicativo deve distinguere la **proposta** dalla **selezione effettiva** del docente.

Forma concettuale:

```ts
interface TeachingContextRef {
  targetType: 'uda' | 'lesson';
  targetId: string;
  parentUdaId?: string;
}

interface TeachingContextSuggestion {
  context: TeachingContextRef;
  reason:
    | 'explicit-origin'
    | 'current-class-today-lesson'
    | 'current-class-active-uda'
    | 'session-last-choice';
}
```

La UI può ricavare i label leggibili (`title`, `topic`, classe) dal dominio locale. Questi label non devono entrare nel `ContextSnapshot` solo per rendere leggibile la proposta.

## Deterministic suggestion algorithm

La risoluzione è ordinata e fail-closed.

### 1. Explicit origin context

Se la superficie che ha portato il docente in Biblioteca fornisce un riferimento UDA/lezione valido, quello è il primo candidato.

Una lezione è valida solo se appartiene realmente all'UDA indicata. Riferimenti inesistenti o incoerenti vengono ignorati, non corretti euristicamente.

### 2. Current class + date/period

Se non esiste un origin context valido:

1. risolvere `currentClassId` nella classe corrente;
2. filtrare le UDA con `className` corrispondente alla classe corrente;
3. tra quelle UDA, cercare lezioni con `date` uguale alla data locale corrente;
4. se esiste **una sola** lezione valida oggi, proporre quella lezione;
5. altrimenti individuare le UDA il cui intervallo `startMonth + durationMonths` include il mese scolastico corrente;
6. se esiste **una sola** UDA attiva, proporre quella UDA;
7. se ci sono più candidati equivalenti, non applicare tie-break arbitrari: passare al livello successivo.

La mappatura mese scolastico usa il dominio esistente `0=Set ... 9=Giu`. Luglio e agosto non generano da soli una proposta “UDA attiva”.

### 3. Last explicit teacher choice in current Library session

Se i segnali di classe/tempo sono ambigui, può essere riutilizzata l'ultima scelta **esplicita** fatta dal docente nella sessione corrente della Biblioteca, purché:

- il target esista ancora;
- una lezione appartenga ancora alla sua UDA;
- se esiste una classe corrente, il target appartenga alla stessa classe.

Questo dato è effimero: reload/nuova sessione può eliminarlo. Non diventa una preferenza persistente né una nuova authority.

### 4. No suggestion

Se nessuno dei livelli precedenti produce un candidato univoco e valido, il sistema mostra la scelta manuale senza pre-selezionare un contesto.

Non esistono confidence score nascosti o ranking semantici.

## Explainability contract

Ogni proposta deve avere un reason code deterministico traducibile in copy locale. Esempi di UX:

- `explicit-origin` → “Ti propongo questa UDA perché è il contesto da cui sei arrivato.”
- `current-class-today-lesson` → “Ti propongo questa lezione perché appartiene alla classe corrente ed è prevista oggi.”
- `current-class-active-uda` → “Ti propongo questa UDA perché è l'unica attiva per la classe corrente in questo periodo.”
- `session-last-choice` → “Ti propongo l'ultimo contesto che hai scelto in questa sessione.”

La spiegazione è informativa, non una giustificazione normativa.

## ContextSnapshot minimization

LIB-01C estende lo snapshot LIB-01B solo con entità strutturali minime.

Per una UDA selezionata:

```text
{ type: 'uda', id: <udaId> }
```

Per una lezione selezionata:

```text
{ type: 'uda', id: <parentUdaId> }
{ type: 'lesson', id: <lessonId>, parentUdaId: <parentUdaId>, activityType?: <existing enum> }
```

Non entrano nel Core per la risoluzione/dispatch:

- titolo UDA;
- descrizione/competenze/rubrica;
- topic o note lezione;
- nomi studenti;
- testo/URL/immagine/estratto/note della fonte;
- testo della spiegazione UX della proposta.

Se un teaching context è presente, `CURRICOLO` viene aggiunto alle data classes insieme alla classificazione privacy della fonte. `unknown` della fonte resta fail-closed come `STUDENT_PERSONAL`. `remoteProviderAllowed` resta `false`.

## UX / progressive disclosure

Prima di `Usa` non compare alcuna UI avanzata.

Dopo `Usa`:

1. il sistema risolve le azioni Core come in LIB-01B;
2. per un'azione che richiede contesto didattico, mostra un blocco `Contesto proposto` quando esiste un suggerimento;
3. il blocco mostra il target leggibile e una breve spiegazione;
4. `Cambia` è sempre disponibile e apre/seleziona UDA + lezione opzionale;
5. se non esiste proposta, la UI parte direttamente dalla scelta manuale con copy neutro (`Scegli dove usarla`);
6. ogni cambio del target annulla un'eventuale conferma precedente;
7. il primo dispatch `LINK` resta non mutativo e deve richiedere conferma umana;
8. solo il secondo dispatch con `humanConfirmed: true` invoca il persistente verticale;
9. il target persistito è sempre la **selezione finale del docente**, non necessariamente la proposta iniziale.

Il percorso precedente `Gestisci -> Collega a UDA` resta disponibile e non viene reinterpretato come contesto automatico.

## Failure and ambiguity behavior

- origin context invalido → ignorato e fallback deterministico;
- `currentClassId` inesistente → nessuna derivazione da classe;
- più lezioni candidate oggi → nessuna scelta arbitraria di lezione;
- più UDA attive equivalenti → nessuna scelta arbitraria di UDA;
- lezione non appartenente all'UDA → fail-closed;
- target eliminato dopo la proposta → richiedere nuova selezione prima del dispatch;
- errore Core → fonte e dominio restano invariati;
- errore di persistenza → preservare selezione finale per retry, senza falso successo.

## Privacy and authority boundaries

- La proposta usa solo dati già locali al Registro.
- Nessuna richiesta di rete è necessaria.
- Nessun contenuto privato viene inviato al Core oltre ai metadati strutturali minimizzati già ammessi.
- Il Core non sceglie l'UDA: riceve la selezione finale per policy/dispatch.
- Il TeachingContextAdapter non può scrivere nel dominio.
- L'UDA/lezione resta authority verticale del Registro.
- La proposta non viene persistita come decisione curricolare.

## Verification design

### Contract tests

Il ciclo TDD deve introdurre un RED causale che provi almeno:

- priorità `explicit-origin`;
- proposta della singola lezione odierna per la classe corrente;
- proposta della singola UDA attiva quando non esiste una singola lezione odierna;
- ambiguità => nessuna proposta;
- luglio/agosto => nessuna UDA attiva derivata solo dal mese;
- `session-last-choice` solo se ancora valido e compatibile con la classe corrente;
- lezione estranea all'UDA => fail-closed;
- teacher override sostituisce la proposta;
- ContextSnapshot minimizzato senza contenuti fonte/UDA/lezione;
- `CURRICOLO` aggiunto e remote provider ancora negato;
- `LINK` ancora dietro gate umano.

### Browser qualification

Con dati esclusivamente sintetici, desktop e mobile devono coprire almeno:

1. classe corrente + una sola UDA attiva → `Usa` mostra proposta spiegata;
2. docente preme `Cambia` e sceglie un'altra UDA/lezione;
3. `Continua` non muta nulla e apre il gate umano;
4. `Conferma collegamento` persiste **la scelta del docente**, non il suggerimento iniziale;
5. reload verifica il collegamento persistito;
6. percorso ambiguo → nessun contesto pre-selezionato;
7. nessun overflow mobile e target touch >=44x44;
8. zero page errors;
9. zero richieste esterne durante il journey contestuale governato;
10. tutti i gate LIB-01A/LIB-01B preesistenti restano verdi.

## Migration from the existing PR #41

La PR #41 è tecnicamente qualificata ma implementa il contratto manual-only ormai superato. Non deve essere mergiata così com'è.

Dopo approvazione di questo design, il piano di implementazione deve decidere il percorso meno rischioso tra:

- aggiornare `feat/lib-01c-teaching-context` mantenendo i componenti già validi (teaching-context model, minimizzazione, gate umano, browser fixtures) e sostituendo soltanto il manual-only contract con la suggestion policy; oppure
- chiudere #41 e ripartire da `main` se il diff esistente rende difficile ottenere un nuovo RED causale pulito.

La scelta deve essere guidata dal diff reale e dal costo di preservare evidenza TDD, non dalla quantità di codice già scritto.

## Acceptance boundary

LIB-01C sarà completato solo quando, sullo stesso exact SHA:

- Product/PREDEPLOY è verde;
- Browser Qualification desktop/mobile è verde;
- la proposta deterministica è spiegabile e modificabile;
- i casi ambigui non generano scelte arbitrarie;
- il collegamento persistito coincide con la selezione finale del docente;
- nessun provider generativo è attivo;
- nessun dato privato aggiuntivo entra nel Core;
- nessun merge o deploy avviene senza decisione umana separata.
