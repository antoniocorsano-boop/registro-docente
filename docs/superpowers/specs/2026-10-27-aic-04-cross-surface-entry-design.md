# AIC-04 — Cross-surface Copilot entry design

**Baseline:** `main@5eabbee84c4c7c7fe350d2fee5ef737084d3cf70`

## Intent

Rendere il Copilota utilizzabile dal punto in cui il docente sta già lavorando, senza obbligarlo a partire dalla Biblioteca e senza creare Copiloti distinti per superficie.

Il comportamento desiderato è **obiettivo prima, fonte se necessaria**: il docente può aprire il Composer globale, formulare una richiesta usando il contesto professionale corrente e lasciare che l'interprete stabilisca se per quell'intento serve una fonte della Biblioteca. La selezione/acquisizione della fonte resta disponibile nello stesso Composer, senza cambio di pagina.

## Goals

- Mantenere **un solo `LibraryCopilotComposer` globale** come superficie conversazionale.
- Permettere l'invio di una richiesta anche quando `selectedSource` è assente.
- Costruire la richiesta agente dal `CopilotContextProjectionV1` corrente con `hasSelectedSource=false` quando non esiste una fonte.
- Se l'intento corrente richiede una fonte (`REVIEW`, `LINK`, `PREPARE` nel perimetro AIC-04), restituire un esito strutturato `SOURCE_REQUIRED` e guidare il docente a selezionare o acquisire una fonte nello stesso Composer.
- Conservare invariati Core authority, conferme umane, PREPARE proposal flow, durable persistence e privacy boundary.
- Mantenere la navigazione tradizionale e la Biblioteca pienamente utilizzabili.
- Coprire almeno class dashboard, planning, online tests, evaluation-related surfaces e altre superfici professionali attraverso l'ambient context già qualificato da AIC-01.

## Non-goals

- Nessuna nuova capacità generativa o azione esecutiva.
- Nessuna persistenza autonoma o implicita.
- Nessun nuovo provider, modello, retry o budget policy.
- Nessun invio remoto di dati studente, nomi classe, identificatori UDA/source o contenuti sorgente oltre il contratto remoto minimizzato esistente.
- Nessun nuovo Copilota specifico per singola pagina.
- Nessuna modifica allo schema persistente di Biblioteca, UDA, planning o valutazioni.

## Anti-goals

AIC-04 è fallito se il docente può aprire il Copilota da una superficie diversa dalla Biblioteca ma deve comunque prima navigare in Biblioteca per poter formulare la richiesta; oppure se l'ingresso source-less bypassa il Core o trasmette nuovo contesto sensibile.

## Constraints

- Privacy-first: su superfici studente-bearing il contesto remoto continua a essere soltanto la proiezione minimizzata già qualificata; nessun dato per-studente.
- L'interprete agente propone un intento ma non autorizza né persiste.
- `REVIEW`, `LINK` e `PREPARE` restano legati a una fonte professionale quando arrivano al routing governato.
- Un intento che richiede fonte senza fonte non deve essere trasformato in `DENIED` generico né in azione implicita: deve produrre `SOURCE_REQUIRED`.
- La selezione di una fonte dopo `SOURCE_REQUIRED` invalida la precedente risoluzione e richiede un nuovo invio; nessun auto-replay remoto.
- Il Composer deve rimanere chiudibile e la navigazione tradizionale non deve dipendere dall'AI.

## Approaches considered

### A. Copilota separato per ogni superficie

Scartato: duplica stato, routing, privacy e UI; aumenta il rischio di divergenza e contraddice il principio già stabilito del Copilota unico.

### B. Pulsanti contestuali per ogni superficie che aprono il Composer esistente

Utile come possibile evoluzione visuale, ma non risolve da solo il blocco principale: oggi il Composer richiede comunque una fonte per inviare la richiesta. Non è il primo slice minimo.

### C. Composer globale source-optional con handoff strutturato `SOURCE_REQUIRED`

**Scelta.** Riusa l'ingresso globale esistente, sblocca davvero il percorso cross-surface e non amplia le capacità. Il routing distingue tra “capisco l'obiettivo ma serve una fonte” e “azione non autorizzata/unsupported”, mantenendo il Core come autorità sulle azioni reali.

## Design

### 1. Routing source-optional

`routeAgentIntent` accetta `source: LibrarySource | null`.

Prima di interrogare il Core:
- `CLARIFY`/low confidence/context binding restano invariati;
- per `REVIEW`, `LINK`, `PREPARE`, se `source === null`, restituisce `{ kind: 'SOURCE_REQUIRED', envelope }`;
- con fonte presente, il comportamento AIC-01/AIC-03 resta invariato.

`SOURCE_REQUIRED` non è autorizzazione e non esegue nulla.

### 2. Composer source-optional

Il `LibraryCopilotComposer`:
- permette `submit` con messaggio non vuoto anche senza fonte;
- costruisce sempre il projection/wire request dall'ambient context corrente;
- usa il routing agente con `source: selectedSource ?? null`;
- su `SOURCE_REQUIRED` mostra una guida esplicita a selezionare una fonte esistente o ad acquisirne una nello stesso Composer;
- non esegue il fallback locale source-based quando manca una fonte; se il provider/interprete non è disponibile senza fonte, mostra un messaggio fail-closed che chiede di selezionare una fonte o riprovare, senza fingere di aver interpretato l'intento.

### 3. Privacy e superficie

L'ambient context già definito in `App.tsx` resta la sorgente delle superfici. `toRemoteRoutingProjection` continua a inviare solo:
- surface normalizzata;
- `hasCurrentClass`;
- `hasCurrentUda`;
- `hasSelectedSource`.

Nessun nome studente, voto, comportamento, identificatore individuale o payload sorgente entra nella richiesta remota di routing.

### 4. Progressive disclosure

Fonte e acquisizione restano visibili ma non prerequisito per digitare l'obiettivo. Dopo `SOURCE_REQUIRED`, l'area fonte viene presentata come il prossimo passo necessario, non come navigazione obbligatoria alla Biblioteca.

## Acceptance

AIC-04 è qualificabile quando:

1. Da class dashboard/planning/online-tests/evaluation-related surface il docente può aprire il Composer e inviare un obiettivo senza fonte selezionata.
2. La richiesta remota conserva `hasSelectedSource=false` e nessun dato studente.
3. `REVIEW`, `LINK`, `PREPARE` senza fonte producono `SOURCE_REQUIRED`, zero Core action resolution e zero write.
4. Dopo selezione fonte, il percorso storico REVIEW/LINK/PREPARE continua a funzionare senza regressioni.
5. Un cambio di superficie o fonte invalida risultati asincroni obsoleti come nei contratti AIC-01.
6. Mobile 390×844 e desktop restano usabili.
7. Nessun merge, deploy o pubblicazione è implicito nella qualification.
