# LIB-01C — Deterministic Teaching Context Design

**Status:** approved for implementation  
**Baseline:** `main@ab1e23c1014dc96231aa92cfe8cf6e39a47c50a0`  
**Predecessor:** LIB-01B integrated via PR #40

## Intent

La Biblioteca privata deve proporre il contesto didattico più plausibile quando il docente sceglie `Usa`, usando soltanto segnali deterministici già posseduti dal Registro Docente. La proposta non è un'autorità: il docente può sempre cambiarla e scegliere un'altra UDA o lezione prima di qualunque collegamento o futura trasformazione.

Decisione umana vincolante: **il sistema fa la proposta ma il docente può sempre cambiare e scegliere altro**.

## Goals

- Suggerire UDA o lezione in modo deterministico, spiegabile e locale.
- Distinguere la proposta dalla selezione finale del docente.
- Permettere sempre `Cambia` prima della mutazione.
- Preferire nessuna proposta a un tie-break arbitrario.
- Conservare il TRAMA Contextual Copilot Core come motore condiviso di policy/dispatch.
- Mantenere il `ContextSnapshot` minimizzato, `remoteProviderAllowed = false` e `generativeMode = none`.
- Conservare il gate umano prima di qualunque `LINK` persistente.

## Non-goals

- Nessuna AI, embedding, semantic search o similarità testuale per scegliere il contesto.
- Nessun provider remoto.
- Nessun uso di titolo, testo, URL, immagine, estratto o note della fonte per il ranking.
- Nessuna nuova authority globale di “contesto corrente”.
- Nessuna nuova entità persistente `material` o `activity`.
- Nessuna attivazione di `PREPARE` o `SUMMARIZE`.
- Nessuna persistenza della proposta come fatto curricolare.

## Approcci considerati

### A. Manual-only

È la variante inizialmente implementata nella PR #41: dopo `Usa`, il docente sceglie sempre UDA e lezione. Sicura ma troppo ripetitiva e non più conforme alla decisione umana.

### B. Semantic/generative suggestion

Confrontare fonte e contenuti didattici tramite embeddings/provider. Respinta per LIB-01C: anticipa il perimetro generativo, amplia il rischio privacy ed è meno spiegabile.

### C. Deterministic, explainable suggestion — scelta

Usare solo segnali strutturali: contesto esplicito di provenienza, classe corrente, data/periodo e ultima scelta esplicita della sessione Biblioteca. Se non esiste un candidato univoco e valido, non proporre nulla.

## Current domain facts

- `AppData.currentClassId` identifica la classe corrente.
- `UdaRecord` espone `id`, `className`, `period`, `startMonth`, `durationMonths`, `lessons`.
- `UdaLesson` espone `id`, `date`, `topic`, `hours`, `activityType?`.
- `LibrarySourceLink` supporta già `uda | lesson | activity`; LIB-01C usa soltanto UDA/lezione come contesto canonico.
- LIB-01B usa già il Core condiviso e mantiene le azioni generative disabilitate.

## Architecture

`Registro signals -> TeachingContextAdapter -> suggested context -> teacher selection -> Library ContextSnapshot -> shared Core -> governed action -> vertical executor`

Il `TeachingContextAdapter` non decide policy Core e non effettua mutazioni. Produce solo un candidato minimizzato e un reason code deterministico. Non viene introdotto uno store globale: l'ultima scelta esplicita resta stato effimero della sessione Biblioteca.

## Context model

```ts
export interface LibraryTeachingContext {
  udaId: string;
  lessonId?: string;
}

export type TeachingContextSuggestionReason =
  | 'explicit-origin'
  | 'current-class-today-lesson'
  | 'current-class-active-uda'
  | 'session-last-choice';

export interface TeachingContextSuggestion {
  context: LibraryTeachingContext;
  reason: TeachingContextSuggestionReason;
}
```

La UI ricava title/topic/class dal dominio locale; questi label non entrano nel `ContextSnapshot` solo per spiegare la proposta.

## Deterministic suggestion algorithm

### 1. Explicit origin

Se la superficie di provenienza fornisce un contesto UDA/lezione valido, quello è il primo candidato. Una lezione è valida solo se appartiene all'UDA indicata. Riferimenti stale o incoerenti vengono ignorati.

### 2. Current class + local date

Se non esiste origin valido:

1. risolvere la classe corrente;
2. filtrare le UDA con `className` corrispondente;
3. cercare lezioni con `date` uguale alla data locale corrente;
4. se esiste una sola lezione valida oggi, proporla;
5. altrimenti individuare le UDA attive nel mese scolastico corrente usando `startMonth` e `durationMonths`;
6. se esiste una sola UDA attiva, proporla;
7. se restano più candidati equivalenti, non scegliere arbitrariamente.

La mappatura scolastica resta `0=Set ... 9=Giu`; luglio/agosto non generano da soli una proposta UDA attiva.

### 3. Last explicit teacher choice in Library session

Se classe/tempo non producono un candidato univoco, può essere riutilizzata l'ultima scelta **esplicita** del docente nella sessione corrente, purché il target esista ancora, la lezione appartenga ancora alla sua UDA e, quando esiste una classe corrente, il target appartenga alla stessa classe.

Questo dato non viene scritto nel vault.

### 4. No suggestion

Se nessun livello produce un candidato valido e univoco, la UI mostra la selezione manuale senza pre-selezione.

## Explainability

Reason code -> copy locale:

- `explicit-origin`: “Ti propongo questo contesto perché è quello da cui sei arrivato.”
- `current-class-today-lesson`: “Ti propongo questa lezione perché appartiene alla classe corrente ed è prevista oggi.”
- `current-class-active-uda`: “Ti propongo questa UDA perché è l'unica attiva per la classe corrente in questo periodo.”
- `session-last-choice`: “Ti propongo l'ultimo contesto che hai scelto in questa sessione.”

La spiegazione è informativa, non normativa.

## ContextSnapshot minimization

Per UDA selezionata:

```text
{ type: 'uda', id: <udaId>, className, period }
```

Per lezione selezionata:

```text
{ type: 'uda', id: <parentUdaId>, className, period }
{ type: 'lesson', id: <lessonId>, udaId: <parentUdaId>, activityType?: <enum> }
```

Non entrano nel Core: titolo/descrizione/competenze UDA, topic/notes lezione, nomi studenti, contenuto/URL/immagine/estratto/note della fonte, testo della spiegazione UX.

Un teaching context valido aggiunge `CURRICOLO` alle data classes. La fonte `unknown` resta fail-closed come `STUDENT_PERSONAL`; `remoteProviderAllowed` resta `false`.

## UX

Prima di `Usa` non appare UI avanzata.

Dopo `Usa`:

- se esiste una proposta, mostra `Contesto proposto`, target leggibile e spiegazione;
- `Cambia` è sempre disponibile e apre UDA + lezione opzionale;
- se non esiste proposta, mostra direttamente `Scegli dove usarla` senza pre-selezione;
- qualunque cambio del target annulla una conferma precedente;
- la selezione finale del docente alimenta review, ContextSnapshot e dispatch;
- il primo dispatch `LINK` resta non mutativo e richiede conferma umana;
- il secondo dispatch con `humanConfirmed: true` può chiamare il persistente verticale;
- il target persistito è sempre la selezione finale del docente, non necessariamente la proposta iniziale.

Il percorso `Gestisci -> Collega a UDA` resta invariato.

## Failure behavior

- origin invalido -> fallback deterministico;
- `currentClassId` inesistente -> nessuna derivazione da classe;
- più lezioni oggi -> nessuna scelta arbitraria di lezione;
- più UDA attive equivalenti -> nessuna scelta arbitraria di UDA;
- lezione estranea all'UDA -> fail-closed;
- target eliminato dopo la proposta -> nuova selezione prima del dispatch;
- errore Core -> nessuna mutazione;
- errore persistenza -> mantenere selezione finale per retry, senza falso successo.

## Verification

Contract tests devono coprire almeno: priorità explicit-origin, singola lezione odierna, singola UDA attiva, ambiguità -> null, luglio/agosto -> null, session-last-choice valido/compatibile, lesson ownership fail-closed, override docente, minimizzazione snapshot, `CURRICOLO`, remote provider negato, gate umano.

Browser desktop/mobile con dati sintetici deve provare: proposta spiegata, `Cambia`, scelta alternativa, primo dispatch senza mutazione, conferma che persiste la scelta del docente, reload, percorso ambiguo senza pre-selezione, touch target >=44px, no overflow, zero page errors, zero richieste esterne durante il journey, gate LIB-01A/LIB-01B ancora verdi.

## Integration boundary

La PR #41 è tecnicamente qualificata per il precedente contratto manual-only ma è semanticamente superata. Va evoluta con un nuovo ciclo RED -> GREEN e nuova qualifica exact-SHA. Engineering qualification non autorizza merge o deploy; il merge resta decisione umana separata.