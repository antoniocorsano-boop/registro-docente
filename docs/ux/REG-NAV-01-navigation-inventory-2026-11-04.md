# REG-NAV-01 — Inventario delle transizioni e dei ritorni (4 novembre 2026)

Baseline: `main@0488cd50287ef26883f395e2b79ab1fcba11ccdc`, lettura del codice. Il ramo INT-01 #116 aggiunge la guardia draft e un algoritmo di ripristino cronologia più articolato; viene qualificato a parte. **Questa tabella non dichiara ogni percorso difettoso:** classifica le divergenze fra vista e cronologia da verificare.

| Origine / azione | Gestione nel codice | Cronologia | Politica REG-NAV-01 | Priorità |
|---|---|---|---|---|
| Oggi → seleziona classe | `handleSelectClass` | `pushState` classe/dashboard | PUSH; Back → Oggi | già coperto |
| Classe → Valutazioni / Analisi / Tabellone | `handleNavigateTab` | `pushState` | PUSH; Back → classe | già coperto |
| Menu → sezione specialistica | `Navbar.handleNav → handleNavigateTab` | `pushState` | PUSH | già coperto |
| Storico → Nuova valutazione | `setActiveTab('voti')` | **nessuna nuova voce** | PUSH; Back → Storico | NAV-S1 |
| Storico → Modifica valutazione | `handleEditBatch → setActiveTab('voti')` | **nessuna nuova voce** | PUSH; Back → Storico | NAV-S1 |
| Analisi → Scheda alunno | `setSelectedStudentForReport; setActiveTab('report')` | **nessuna nuova voce** | PUSH; Back → Analisi | NAV-S1 |
| Tabellone → Scheda alunno | come sopra | **nessuna nuova voce** | PUSH; Back → Tabellone | NAV-S1 |
| Registra → scelta tipo evidenza | `handleChooseRecordEvidence` | `pushState` | PUSH e classe coerente | esistente |
| Registra → risultato salvato | `completeRecordFlow → setActiveTab('dashboard')` | **non allineata** | REPLACE o esito esplicito; mai riaprire l'editor | NAV-S2 |
| Registra → Torna a Registra | `handleReturnToRecord → setActiveTab('dashboard')` | **non allineata** | GO_TO_CONTEXT/REPLACE documentato | NAV-S2 |
| Registra → Altra registrazione | `handleRecordAnother → setActiveTab('dashboard')` | **non allineata** | nuova fase dello stesso lavoro, evita doppie entry | NAV-S2 |
| Registra → Rivedi | `handleContinueRecordToReview → setActiveTab('dashboard')` | **non allineata** | REPLACE con contesto di revisione | NAV-S2 |
| Salva valutazione autonoma → Storico | `afterCommit → setActiveTab('storico')` | **non allineata** | REPLACE dopo conferma di scrittura, Back non riapre editor completato | NAV-S2 |
| Salva comportamento → dashboard | `afterCommit → setActiveTab('dashboard')` | **non allineata** | REPLACE dopo conferma | NAV-S2 |
| Home → Oggi dal menu | `handleNavigateHome` | `pushState` Home | GO_TO_HOME esplicito, non Back | da qualificare |
| UDA ↔ Programmazione | INT-01 #116 `handleNavigateTab` + bozza | `pushState` e guard | PUSH, destinazione immutabile | NAV-S3 |
| Indietro del browser | `popstate` → tab da `history.state` | lettura della entry | POP coerente; fail-safe se entry non riconosciuta | NAV-S3 |
| Ricarica / lock / unlock | `SecureRegistroRoot.loadReadySnapshot` | sostituzione Home neutra | protezione da mantenere | invariante |
| Modali / pannelli mobili | stato locale delle viste e menu | variabile | DISMISS prima di POP, accessibilità | NAV-S4 |
| Copilota contestuale | pannello / stato missione | superficie separata | DISMISS / ritorno al lavoro senza duplicare classe | NAV-S4 |

### Rischio comune

Alcuni cambi di schermata non attraversano `handleNavigateTab`, benché `popstate` ricostruisca la schermata da `history.state`. L'utente può quindi visualizzare una pagina diversa da quella registrata nell'entry corrente. Il primo Indietro può portarlo oltre la pagina attesa. Il problema INT-01 ha in più la competizione fra conferma delle bozze e cronologia nativa.

### Principio di riparazione

Non sostituire in blocco ogni `setActiveTab`: distinguere le transizioni fra superfici dai cambi dello stato interno e dagli esiti dopo scrittura. Introdurre regressioni specifiche, correggere per incrementi e mantenere il comportamento sicuro dell'archivio.
