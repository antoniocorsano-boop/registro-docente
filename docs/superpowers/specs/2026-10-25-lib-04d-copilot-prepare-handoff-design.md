# LIB-04D — Copilot PREPARE Governed Handoff

**Status:** approved by continuation decision  
**Baseline:** `main@b6ad698bb8d52d9869d66fd0d57d9c5193762796`  
**Predecessors:** LIB-04B Composer & Source Bridge, LIB-04C LINK Vertical Slice, LIB-01D/01E governed proposal runtime

## Intent

Collegare il Copilota globale della Biblioteca al percorso PREPARE già esistente e qualificato senza creare un secondo flusso generativo.

Il docente deve poter partire dalla fonte e dal contesto didattico correnti nel `LibraryCopilotComposer`, aprire in modo progressivo la preparazione assistita e arrivare allo stesso flusso governato già usato nella Biblioteca:

`fonte + teaching context -> consenso remoto one-shot -> Core remoto -> PREPARE -> proposta -> Adotta | Adatta | Lascia`.

LIB-04D non introduce interpretazione libera dell'intento. Finché `IntentPort` non è disponibile, il testo del Composer continua a degradare correttamente a `INTENT_PORT_UNAVAILABLE`; il prodotto non deve compensare con parser o keyword resolver locali.

## Goals

- Rendere la preparazione assistita raggiungibile dal Copilota globale.
- Riutilizzare direttamente `LibraryProposalPanel` come unica superficie generativa.
- Riutilizzare `handleUpdateLibrarySource` e `handleAddLibrarySource` come unici ingressi alle mutazioni durevoli necessarie al proposal flow.
- Mostrare la preparazione come progressive disclosure separata dalle azioni locali già autorizzate dal Core.
- Mantenere `prepare-from-source` invisibile come azione operativa finché `LibraryProposalPanel` non completa consenso one-shot e risoluzione Core remota.
- Preservare classificazione privacy, provider disclosure, request-scoped consent, provenance e `Adotta / Adatta / Lascia` già qualificati da LIB-01D/01E.
- Preservare mobile 390×844, touch target >=44px e assenza di overflow orizzontale permanente.

## Non-goals

- Nessun nuovo provider, route, prompt o adapter generativo.
- Nessuna modifica a `TeachingProposalV1`, `LibraryProposalRequestV1` o provenance.
- Nessun `IntentPort` in LIB-04D.
- Nessun parser locale di parole come “prepara”, “crea”, “adatta”.
- Nessuna semantic search o multi-source.
- Nessuna chat multi-turno.
- Nessuna attivazione di `SUMMARIZE`.
- Nessuna scrittura diretta dentro UDA/lezione.
- Nessun merge, deploy o publish automatico.

## Approcci considerati

### A. Duplicare il proposal flow nel Composer

Scartato. Duplicherebbe consenso, provider disclosure, policy remota, request builder, gestione proposta e adozione. Creerebbe due superfici con rischio di divergenza e bypass dei gate già qualificati.

### B. Navigare forzatamente alla card Biblioteca che contiene `LibraryProposalPanel`

Scartato. Riutilizzerebbe il flusso ma romperebbe il contesto del Copilota, introdurrebbe un salto di navigazione non necessario e renderebbe il percorso meno leggibile su mobile.

### C. Montare direttamente `LibraryProposalPanel` nel Composer — scelta

Il Composer resta un contenitore sottile. Quando fonte e Teaching Context sono validi, una disclosure esplicita apre lo stesso `LibraryProposalPanel` già qualificato, con le stesse callback durevoli del `LibraryView`.

## Architecture

```text
LibraryCopilotComposer
  -> selected LibrarySource
  -> deterministic TeachingContext
  -> explicit progressive disclosure: Preparazione assistita
  -> LibraryProposalPanel (existing)
       -> privacy classification if needed
       -> provider metadata disclosure
       -> one-shot consent
       -> resolveLibraryRemoteProposalActions(...)
       -> PREPARE from shared Core
       -> /api/copilot/library-proposal
       -> TeachingProposalV1
       -> Adotta | Adatta | Lascia
       -> existing onAddSource / onUpdateSource
       -> Secure Local Vault
```

Il Composer non importa direttamente `libraryProposalService`, `teachingProposal` o provider runtime. Il solo nuovo coupling consentito è il componente `LibraryProposalPanel` e la callback `onUpdateSource`.

## Entry point e progressive disclosure

La superficie PREPARE nel Composer è una disclosure, non una falsa azione già autorizzata.

Può apparire soltanto quando:

- esiste una fonte selezionata;
- esiste un `ResolvedLibraryTeachingContext` valido;
- la UDA del contesto è ancora presente in `udas`.

Il copy deve chiarire che l'apertura non invia dati a servizi remoti e non genera ancora nulla. L'invio remoto resta confinato dentro `LibraryProposalPanel`, dopo provider disclosure e consenso one-shot.

Il pulsante/disclosure non deve chiamarsi o comportarsi come `prepare-from-source` prima della risoluzione remota del Core. Una formulazione ammessa è `Preparazione assistita` / `Apri preparazione assistita`.

## State reset

Cambio di fonte o cambio del Teaching Context deve chiudere la disclosure PREPARE. Il nuovo contesto deve richiedere una nuova apertura e, dentro `LibraryProposalPanel`, un nuovo consenso one-shot.

La chiusura del Composer non deve produrre mutazioni. Quando il Composer viene riaperto nella stessa sessione, nessun consenso remoto può essere considerato persistente.

## Mutation boundary

`LibraryCopilotComposerProps` viene esteso con:

```ts
onUpdateSource: (sourceId: string, patch: LibrarySourcePatch) => Promise<void>;
```

`onAddSource` resta invariato.

`App.tsx` passa:

- `onUpdateSource={handleUpdateLibrarySource}`;
- `onAddSource={handleAddLibrarySource}`.

Nessuna nuova funzione di persistenza viene introdotta.

## Privacy and authority boundaries

- `unknown`: `LibraryProposalPanel` richiede classificazione esplicita prima del remoto.
- `student-personal`: remoto negato.
- `teacher-professional`: provider disclosure + consenso one-shot.
- `ContextSnapshot` resta minimizzato; nessun payload fonte viene aggiunto al Composer.
- PREPARE resta `PROPOSE`: nessuna modifica canonica finché il docente non adotta.
- `Lascia` resta non mutante.
- errore provider o adozione: nessun falso successo; stato utile conservato secondo il contratto LIB-01D/01E.

## Failure behavior

- fonte eliminata/stale -> disclosure chiusa, nessun proposal flow montato;
- Teaching Context nullo/stale -> disclosure assente/chiusa;
- UDA del contesto non trovata -> fail closed;
- cambio fonte mentre il panel è aperto -> panel chiuso e consenso revocato;
- cambio Teaching Context -> panel chiuso e consenso revocato;
- provider assente -> stesso errore leggibile già fornito da `LibraryProposalPanel`;
- richiesta remota fallita -> nessuna mutazione Biblioteca;
- adozione fallita -> proposta mantenuta per retry, nessun falso successo;
- `Lascia` -> zero persistenza.

## Verification

### Contract/security

Aggiungere un contratto LIB-04D che verifichi:

- il Composer importa `LibraryProposalPanel` ma non importa `libraryProposalService` o `teachingProposal`;
- `LibraryCopilotComposerProps` espone `onUpdateSource`;
- il panel viene montato solo con source + Teaching Context + UDA validi;
- la disclosure è separata dalle `resolution.actions` e non chiama direttamente `prepare-from-source`;
- cambio fonte resetta la disclosure;
- App riusa `handleUpdateLibrarySource` e `handleAddLibrarySource`.

### Browser

Con route proposal intercettate e dati sintetici:

- desktop: dal Copilota si apre la preparazione assistita senza rete generativa prima del consenso;
- fonte `unknown`: classificazione richiesta prima del remoto;
- dopo classificazione + provider metadata + consenso, il Core remoto rende disponibile PREPARE;
- una proposta strutturata viene mostrata nello stesso Composer;
- `Lascia` non persiste;
- `Adotta` crea una fonte `internal` con provenance/link e resta dopo reload;
- cambio fonte prima del consenso chiude la disclosure e non genera richieste;
- mobile 390×844: disclosure/panel touch-safe, nessun overflow permanente;
- zero page errors/console errors inattesi;
- LIB-04B, LIB-04C, LIB-01D/01E e UX-QA restano verdi.

## Integration boundary

LIB-04D termina quando il Copilota globale raggiunge il proposal flow esistente senza duplicarlo e con browser evidence sul percorso completo. L'interpretazione semantica del testo libero tramite `IntentPort` resta deliberatamente un blocco successivo.