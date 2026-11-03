# FLOW-03 Human Product/UX Rework — Design

## Intento
Chiudere i due finding **Important** della Human Product/UX Review della PR #110 senza riscrivere FLOW-03, senza duplicare moduli specialistici e senza modificare l'autorità di persistenza già qualificata.

Il docente deve percepire `Registra` come **un unico gesto professionale** anche quando l'implementazione attraversa Valutazioni, Comportamento, Verifiche online o Diario UDA.

## Baseline

- Repository: `antoniocorsano-boop/registro-docente`.
- PR: #110 — FLOW-03.
- Candidato sottoposto a Human Product/UX Review: `efb0b075aecc337dc699f699d913c5e3d2b08f84`.
- Esito review: `REWORK — 0 Critical / 2 Important / 3 Moderate`.
- I tre Moderate sono trasferiti a FLOW-03B / issue #111 e sono fuori scope.

## Obiettivi

1. Rendere persistente e leggibile la missione corrente `Registra` nelle superfici specialistiche aperte dall'orchestratore.
2. Fornire un ritorno esplicito e sicuro a `Registra` senza invalidare la sessione corrente.
3. Quando `Attività / nota UDA` nasce da FLOW-03, ridurre la superficie iniziale al compito di registrazione: scelta UDA esplicita se necessaria, quindi diario focalizzato.
4. Conservare lo stesso `handleAddLesson` e la stessa `commitUdaViewMutation` come unica autorità durevole.
5. Mantenere il fascicolo UDA completo accessibile tramite disclosure esplicita, non eliminarlo.
6. Qualificare desktop e mobile 390×844 con evidenze browser comparabili alla review che ha prodotto il REWORK.

## Non-obiettivi

- Nessun nuovo modulo di Valutazione, Comportamento, Verifiche online o Diario UDA.
- Nessuna nuova entità persistente.
- Nessuna modifica a PERSIST-01H o alle regole di completamento durevole FLOW-03.
- Nessuna scrittura automatica.
- Nessuna selezione automatica di UDA quando il contesto è ambiguo.
- Nessuna modifica a backup, Panoramica Sessione o gerarchia `Rivedi`: sono FLOW-03B (#111).
- Nessuna modifica a Docente OS.

## Approcci considerati

### A. Modificare ogni superficie specialistica
Aggiungere banner e logica FLOW-03 direttamente a `EvaluationsView`, `BehaviorsView`, `VerificheOnlineView` e UDA.

**Scartato:** diff ampio, accoppiamento tra moduli maturi e orchestratore, maggiore rischio di regressione.

### B. Contesto visivo posseduto da App + modalità focalizzata UDA
`App` rende un piccolo componente di missione sopra la superficie specialistica quando esiste una `recordSession` coerente. Il componente non salva nulla e offre soltanto contesto e ritorno. L'UDA riceve un flag di focus e riusa il diario autorevole esistente, nascondendo inizialmente la parte progettuale non necessaria.

**Scelto:** è il delta più piccolo che rispetta l'architettura FLOW-03 e la regola UX-GOV-01 secondo cui le superfici mature non vengono riscritte.

### C. Nuova schermata intermedia `Registrazione rapida`
Creare un modulo dedicato che raccoglie i dati e poi li trasferisce alle superfici specialistiche.

**Scartato:** duplicherebbe responsabilità, aumenterebbe il rischio di due fonti di verità e contraddirebbe il disegno approvato di FLOW-03.

## Disegno scelto

### 1. RecordMissionBanner
Nuovo componente puramente presentazionale, visibile solo quando:

- `recordSession.status === 'editing'`;
- la classe della sessione coincide con la classe corrente;
- `activeTab` coincide con la route specialistica dell'`evidenceKind` corrente.

Contenuto minimo:

- `Stai registrando · <classe>`;
- etichetta della superficie (`Valutazione`, `Comportamento`, `Esiti verifica online`, `Attività / nota UDA`);
- eventuale UDA/attività sicura già presente nel contesto;
- pulsante `Torna a Registra` con target minimo 44 px.

Il ritorno usa un handler dedicato di `App` che mantiene la `recordSession`, imposta `todayAction='record'` e torna al dashboard. Non passa dalla navigazione ordinaria che invalida FLOW-03.

### 2. Modalità focalizzata UDA
`UdaWorkspaceView` riconosce il focus dalla presenza di `recordLessonPrefill`.

- Se `udaId` è presente e coerente, entra direttamente nella pianificazione focalizzata.
- Se `udaId` manca, mostra soltanto le UDA della classe della sessione con azione esplicita `Scegli questa UDA`.
- La scelta del docente produce localmente un `RecordLessonPrefill` derivato con quell'`udaId`; non persiste nulla e non modifica il contesto canonico della sessione.
- In focus non sono mostrati selettori di workspace, creazione UDA, avanzamento o analisi.

Il legacy `UdaGanttView.tsx` riceve `focusedRecordMode` e, quando attivo:

- sopprime dashboard, KPI, Gantt, gap analysis e strumenti di pianificazione sottostanti;
- apre lo stesso fascicolo/diario già autorevole;
- nel fascicolo mostra inizialmente una testata `Registrazione rapida` e la sola sezione Diario;
- nasconde inizialmente propedeuticità, descrizione, competenze, analisi semantiche e storico lezioni;
- offre `Mostra dettagli UDA` per espandere lo stesso fascicolo completo;
- mantiene `handleAddLesson` e `commitUdaViewMutation` invariati come unica scrittura autorevole.

### 3. Ritorno e completamento
Prima del salvataggio, `Torna a Registra` conserva la bozza session-only. Dopo il salvataggio autorevole riuscito, il comportamento FLOW-03 esistente continua a riportare al dashboard in stato `Registrazione completata`.

## Stati di sicurezza

- Sessione/classe incoerente: nessun banner e nessun focus UDA.
- UDA iniziale assente: nessuna selezione automatica.
- UDA scelta di classe diversa: rifiutata/ignorata.
- Navigazione ordinaria esterna al flusso: continua a invalidare la sessione come nel candidato già qualificato.
- Salvataggio UDA fallito: diario e bozza restano disponibili; nessun falso completamento.

## Criteri di accettazione Human Product/UX

1. In tutte le quattro superfici specialistiche, il docente vede chiaramente che sta ancora completando `Registra` e per quale classe.
2. È sempre disponibile un ritorno esplicito a `Registra` durante l'editing.
3. Su 390×844, `Registra → Attività / nota UDA` non espone inizialmente l'intero workspace UDA.
4. Senza `udaId`, la scelta UDA è esplicita e limitata alla classe corrente.
5. Dopo la scelta, il primo contenuto operativo è il diario focalizzato con data, argomento, tipologia, durata, nota e azione di registrazione.
6. Il fascicolo completo è raggiungibile tramite disclosure volontaria.
7. Nessuna nuova persistenza, nessuna auto-scrittura, nessuna regressione sui contratti FLOW-03.

## Qualifica

- TDD RED → GREEN per continuità missione e focus UDA.
- Contratti FLOW-03 esistenti PASS.
- Typecheck/build PASS.
- Browser Qualification fresh su exact SHA, desktop + mobile 390×844.
- Final Independent Review: 0 Critical / 0 Important.
- Nuova Human Product/UX Review: PASS richiesta prima di Ready/merge.
- Nessun merge o deploy senza autorizzazione separata.
