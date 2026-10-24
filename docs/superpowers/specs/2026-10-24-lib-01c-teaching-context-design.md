# LIB-01C — Teaching Context Design

## Intent

Trasformare la Biblioteca privata da archivio contestuale solo rispetto alla fonte in uno strumento capace di lavorare rispetto al contesto didattico reale scelto dal docente, senza introdurre inferenze automatiche, provider generativi o nuove authority di dominio.

Baseline: `main@ab1e23c1014dc96231aa92cfe8cf6e39a47c50a0` con LIB-01B integrato e `@trama/contextual-copilot-core@0.1.0` vendorizzato e verificato.

## Obiettivi

- Dopo `Usa`, permettere al docente di scegliere l'UDA corrente e, opzionalmente, una lezione della stessa UDA.
- Leggere il tipo di attività dalla lezione quando già presente nel dominio `UdaLesson.activityType`.
- Portare UDA/lezione nel `ContextSnapshot` del Core come entità minimizzate e strutturali.
- Collegare la fonte al target contestuale: `lesson` se è selezionata una lezione, altrimenti `uda`.
- Conservare il gate umano del Core prima della write reversibile.
- Mantenere le azioni generative non disponibili (`generativeMode = none`).
- Conservare progressive disclosure, privacy fail-closed e zero rete esterna nel percorso contestuale.

## Non obiettivi

- Nessuna generazione o sintesi AI.
- Nessuna inferenza automatica dell'UDA corrente da data, classe, testo o similarità.
- Nessuna persistenza del contesto di lavoro: il contesto è UI state transitorio.
- Nessuna nuova entità `material` finché il Registro non possiede un dominio canonico dei materiali.
- Nessuna nuova entità persistente `activity`: il tipo di attività resta attributo della lezione.
- Nessun cambio al modello `LibrarySourceLink`, che già supporta `uda | lesson | activity`.

## Approcci considerati

### A. Inferenza automatica dell'UDA corrente

Usare classe/data/periodo per scegliere automaticamente una UDA. Scartato: più UDA possono sovrapporsi e l'inferenza produrrebbe un contesto apparentemente certo ma non governato.

### B. Cattura del contesto dalla schermata UDA

Sollevare lo stato interno di `UdaGanttView` fino ad `App` e aprire la Biblioteca da una UDA/lezione selezionata. È una buona evoluzione futura, ma per LIB-01C allargherebbe il cambiamento a una schermata legacy molto grande e ai suoi confini di persistenza.

### C. Selezione esplicita nel pannello contestuale della Biblioteca — scelta

Dopo `Usa`, il docente sceglie UDA e opzionalmente lezione. È deterministico, non inventa contesto, usa il dominio esistente e mantiene il cambiamento locale alla Biblioteca + adapter Core.

## Contratto di contesto

Nuovo tipo applicativo:

```ts
export interface LibraryTeachingContext {
  udaId: string;
  lessonId?: string;
}
```

Il contesto è valido solo se:

- `udaId` risolve una UDA esistente;
- se `lessonId` è presente, risolve una lezione appartenente a quella UDA.

Il `ContextSnapshot` continua a includere la fonte minimizzata. Quando il contesto è valido aggiunge:

- `{ type: 'uda', id, className, period }`;
- opzionalmente `{ type: 'lesson', id, udaId, activityType? }`.

Non include titolo UDA, topic/notes della lezione, testo/URL/immagine/titolo/note della fonte.

La privacy aggiunge `CURRICOLO` alle data class del contesto didattico, mantenendo la classificazione fail-closed della fonte (`unknown -> STUDENT_PERSONAL`). `remoteProviderAllowed` resta `false`.

## Risoluzione e dispatch

`resolveLibraryContextActions(source, context?)` e `dispatchLibraryContextAction({ source, teachingContext?, ... })` usano lo stesso Core condiviso di LIB-01B.

Il Core continua a risolvere `REVIEW` e `LINK`; `PREPARE` e `SUMMARIZE` restano filtrate dal policy engine perché richiedono generazione con `generativeMode = none`.

La UI sceglie il target verticale dal contesto validato:

- lezione selezionata -> `{ targetType: 'lesson', targetId: lessonId }`;
- solo UDA -> `{ targetType: 'uda', targetId: udaId }`.

Il primo dispatch `LINK` deve restituire `HUMAN_CONFIRMATION_REQUIRED` e non mutare nulla; solo il secondo dispatch con `humanConfirmed: true` può chiamare `onLink`.

## UX

Dopo `Usa` il pannello `Che cosa vuoi farne?` mostra prima un blocco `Contesto di lavoro`:

- select UDA;
- select lezione soltanto dopo la scelta UDA e solo se sono presenti lezioni;
- riepilogo del tipo di attività se disponibile;
- messaggio chiaro quando manca un contesto selezionato.

`Rivedi nel contesto` mostra anche il contesto didattico selezionato. `Collega a una UDA` mantiene l'azione Core ma nel pannello contestuale usa direttamente il target di lavoro scelto, evitando una seconda selezione duplicata.

La gestione manuale `Gestisci -> Collega a UDA` resta invariata come percorso secondario.

## Sicurezza e privacy

- dati sintetici nei gate;
- nessun contenuto della fonte nel `ContextSnapshot`;
- nessun topic/notes della lezione nel `ContextSnapshot`;
- nessuna richiesta esterna durante il percorso LIB-01C;
- contesto invalido o stale -> fail closed: nessun target contestuale e nessuna write;
- cambio UDA azzera sempre la lezione precedentemente selezionata.

## Qualificazione

Contratto TDD dedicato + suite completa PREDEPLOY. Browser permanente desktop/mobile deve verificare:

1. azioni nascoste prima di `Usa`;
2. selezione UDA e lezione nel `Contesto di lavoro`;
3. tipo attività mostrato quando presente;
4. review del contesto senza contenuti sensibili;
5. primo dispatch senza mutazione;
6. conferma esplicita;
7. link persistito come `lesson` quando la lezione è selezionata e sopravvive a reload;
8. fallback a link UDA quando non è selezionata una lezione;
9. azioni generative assenti;
10. zero rete esterna durante il journey;
11. mobile touch-safe e senza overflow.

## Confini di integrazione

Engineering qualification non autorizza merge o deploy. Il merge resta decisione umana separata secondo OR-006.