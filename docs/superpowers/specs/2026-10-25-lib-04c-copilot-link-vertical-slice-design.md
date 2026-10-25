# LIB-04C — Copilot LINK Vertical Slice

**Data:** 2026-10-25  
**Repository:** `antoniocorsano-boop/registro-docente`  
**Baseline:** `main@3bc9347152079c7370f4e6de830910b478919258`  
**Dipendenza:** LIB-04B integrato; `@trama/contextual-copilot-core@0.2.0`  
**Stato:** IMPLEMENTATION AUTHORIZED

## Intento

Rendere il Copilota del Registro concretamente operativo con il primo vertical slice `LINK`: da una fonte della Biblioteca e dal contesto didattico già risolto, il docente può chiedere di collegare la fonte al lavoro corrente, vedere una proposta di destinazione e applicarla soltanto dopo conferma esplicita.

Il valore di LIB-04C è dimostrare l’intera catena operativa condivisa senza introdurre generazione remota: `messaggio -> Core -> azione LINK autorizzata -> proposta -> conferma docente -> dispatch governato -> persistenza durevole`.

## Decisione architetturale

Il Composer non introduce un secondo percorso di linking. Riusa i contratti già qualificati:

`LibraryCopilotComposer -> CopilotRequestResolution -> LINK proposal -> dispatchLibraryContextAction -> onLink -> Secure Local Vault`

Il Core resta l’unica autorità per stabilire se l’azione `link-source-to-uda` è disponibile. Il Registro determina soltanto il target concreto a partire dal Teaching Context già risolto; il Planning Context può informare la richiesta ma non autorizza né esegue la mutazione.

## Approcci considerati

### A. Collegamento diretto appena compare LINK

Scartato: tecnicamente semplice, ma violerebbe il confine `WRITE_REVERSIBLE` già qualificato perché trasformerebbe una possibilità autorizzata in una mutazione senza decisione umana separata.

### B. Nuovo flusso di linking specifico del Composer

Scartato: duplicherebbe la logica già presente in `LibrarySourceCard`/`dispatchLibraryContextAction`, aumentando il rischio di drift tra Biblioteca e Copilota.

### C. Proposta nel Composer + dispatch governato esistente

Scelto. Il Composer mostra il target risolto, richiede conferma esplicita e usa il dispatcher condiviso con `humanConfirmed: true`; la persistenza resta nell’handler `onLink` di App. È il percorso più piccolo, verificabile e reversibile.

## In scope

- rendere cliccabile nel Composer soltanto l’azione Core `link-source-to-uda` quando presente nella `CopilotRequestResolution`;
- costruire una proposta di destinazione dal `ResolvedLibraryTeachingContext`:
  - lezione, quando `lessonId` è presente;
  - altrimenti UDA;
- mostrare al docente cosa verrà collegato e a quale destinazione prima della mutazione;
- ottenere dal Core `HUMAN_CONFIRMATION_REQUIRED` prima di consentire la conferma finale;
- al click finale, chiamare `dispatchLibraryContextAction` con `humanConfirmed: true` e `executor: () => onLink(...)`;
- considerare successo soltanto `status === 'EXECUTED'` dopo la persistenza durevole;
- mantenere la proposta aperta e riprovabile se il salvataggio fallisce;
- impedire doppi submit durante pending;
- mantenere le altre azioni (`REVIEW`, `PREPARE`, `SUMMARIZE`) non operative nel Composer;
- coprire contratto statico, comportamento applicativo e browser reale desktop/mobile.

## Fuori scope

- `IntentPort` o provider esterni;
- inferenza semantica del target diversa dal Teaching Context già risolto;
- selezione arbitraria di un target fuori contesto dal Composer;
- generazione PREPARE/SUMMARIZE;
- conversazione multi-turno;
- semantic search o multi-source;
- target `activity`;
- modifica dei contratti del Core condiviso;
- merge, deploy o publish automatici.

## Contratto operativo

### 1. Risoluzione

Il Composer continua a invocare `resolveLibraryCopilotRequest(...)`. Soltanto se `resolution.actions` contiene `link-source-to-uda`, l’azione può entrare nel flusso operativo.

Il testo libero non può forzare LINK se il Core non lo espone.

### 2. Target

Il target deriva esclusivamente dal `resolvedTeachingContext` già costruito da `suggestLibraryTeachingContext` + `resolveLibraryTeachingContext`:

- con `lessonId`: `{ targetType: 'lesson', targetId: lessonId }`;
- senza `lessonId`: `{ targetType: 'uda', targetId: udaId }`.

Se il contesto è nullo o diventa invalido, il flusso fallisce chiuso e non chiama `onLink`.

### 3. Conferma

Primo passaggio operativo:

`dispatchLibraryContextAction({ actionId: 'link-source-to-uda', humanConfirmed: false, executor: async () => undefined })`

L’unico esito che apre la conferma finale è `HUMAN_CONFIRMATION_REQUIRED`.

Secondo passaggio:

`dispatchLibraryContextAction({ actionId: 'link-source-to-uda', humanConfirmed: true, executor: () => onLink(source.id, target) })`

L’interfaccia comunica successo solo dopo `EXECUTED`. Nessuna optimistic publication prima della persistenza.

## UX

- L’azione `Collega a una UDA` nella lista delle possibilità diventa il solo comando operativo di LIB-04C.
- Il primo click non scrive: apre una scheda di conferma con fonte e destinazione.
- Copy esplicito: il collegamento sarà salvato nella Biblioteca e potrà essere rimosso successivamente.
- Pulsanti primari: `Conferma collegamento` e `Annulla`.
- Durante pending, controlli di mutazione disabilitati e feedback `Salvataggio…`.
- Dopo successo, la scheda si chiude e appare conferma breve; il link è visibile nello stato Biblioteca aggiornato.
- In errore, nessun falso successo e proposta conservata per il retry.
- Su 390×844: target leggibile, pulsanti >=44px, nessun overflow orizzontale permanente.

## Privacy e authority

- Nessun contenuto aggiuntivo della fonte viene inviato fuori dal dispositivo.
- Nessun provider remoto viene introdotto.
- `student-personal` non acquisisce capability ulteriori.
- Il Composer non chiama direttamente `onLink` prima che il dispatch del Core richieda e riceva conferma umana.
- Planning Context non diventa authority di scrittura.

## Criteri di accettazione

1. `LINK` è operativo nel Composer solo se l’azione `link-source-to-uda` è presente nella risoluzione del Core.
2. Il primo click produce richiesta di conferma e non chiama `onLink`.
3. La conferma esplicita usa `dispatchLibraryContextAction(... humanConfirmed: true ...)`.
4. Il target è lezione se il Teaching Context ha `lessonId`, altrimenti UDA.
5. Nessun Teaching Context valido => nessuna mutazione.
6. Un errore di persistenza non produce successo e mantiene il retry disponibile.
7. Le altre azioni restano non operative nel Composer.
8. I test dimostrano RED causale prima dell’implementazione e GREEN sul candidate.
9. Browser reale verifica desktop e 390×844, inclusa persistenza dopo reload.
10. Nessun merge, deploy o publish automatico.
