# LIB-03C — Progressive Relevance UX Design

## Stato

APPROVED FOR IMPLEMENTATION — decisione umana successiva all’audit di preparazione del 2026-10-25.

Baseline: `main@ab55ef83a38012fbaf4eb5e0c0e865cfa2aeef8a`.

## Intento

Portare il relevance resolver qualificato in LIB-03B dentro l’esperienza reale della Biblioteca privata senza trasformarlo in una decisione automatica.

Il docente parte da una fonte, sceglie `Usa`, quindi può chiedere **Trova dove può servire**. Il prodotto mostra pochi candidati UDA/lezione ordinati e spiegabili; il docente decide se collegare la fonte, usare quel contesto per preparare materiale oppure ignorare il candidato.

LIB-03C è una presentation/integration layer: non crea un nuovo motore di pertinenza, non duplica il Contextual Copilot Core e non amplia le autorità di scrittura.

## Stato attuale

Sono già integrati:

- Biblioteca privata, intake e persistenza;
- Teaching Context e suggerimento contestuale;
- Contextual Copilot Core condiviso con policy fail-closed;
- proposta didattica governata con consenso remoto esplicito;
- LIB-03A Planning Context Bridge;
- LIB-03B Relevance Resolver locale, deterministico e senza scritture.

Manca il wiring di presentazione tra il resolver e la card della fonte. `LibraryView` riceve oggi Biblioteca, UDA e classe corrente, ma non riceve ancora `PlanningStateV1`.

## Approcci considerati

### A. Selettore UDA/lezione manuale ampliato

Riutilizzare soltanto i select già esistenti e ordinarli con LIB-03B.

Scartato: il docente dovrebbe comunque esplorare una lista tecnica; il valore del resolver resterebbe poco visibile e la progressive disclosure sarebbe debole.

### B. Auto-selezionare il primo candidato

Usare direttamente il candidato con punteggio più alto come nuovo Teaching Context.

Scartato: confonde ranking con decisione e viola il confine umano fissato da LIB-03B.

### C. Pannello progressivo di candidati governati

Scelto. Dopo `Usa`, un comando esplicito `Trova dove può servire` calcola il ranking locale. La UI mostra inizialmente massimo tre candidati e consente di espandere gli altri solo su richiesta. Ogni candidato resta una proposta e nessuna destinazione viene selezionata o scritta automaticamente.

## Architettura

### Modulo puro di presentazione

Introdurre `src/library/relevancePresentation.ts` per il solo adattamento necessario alla UI.

Responsabilità:

1. derivare in modo fail-closed un Planning Context utilizzabile per la pertinenza quando l’identità annuale è univocamente deducibile dai profili già presenti;
2. costruire una descrizione leggibile del candidato a partire da UDA/lezione e segnali già prodotti da LIB-03B;
3. non modificare il punteggio e non introdurre nuove fonti di autorità.

### Identità Programmazione

LIB-03C non hard-coda `2026/27`, `tecnologia` o altra identità annuale.

Dato un `ResolvedLibraryTeachingContext`:

- deriva il livello con `resolveClassGradeLevel`;
- considera i `TeachingProfile` dello stesso livello;
- normalizza `schoolYear` con `normalizeSchoolYear` e `subjectCode` con trim + lowercase;
- se tutti i profili compatibili convergono su una sola coppia `schoolYear + subjectCode`, può invocare `resolveLibraryPlanningContext` con tale identità;
- se non esiste una coppia univoca, il planning context viene omesso dal ranking;
- eventuali profili multipli sulla stessa identità restano responsabilità di LIB-03A, che può restituire `ambiguous`.

Questa inferenza non crea un “profilo corrente” persistente e non sceglie tra identità concorrenti.

### UI

Creare `src/components/LibraryRelevancePanel.tsx` e integrarlo dentro `LibrarySourceCard` soltanto dopo `Usa`.

Il pannello:

- non è visibile prima di `Usa`;
- parte chiuso con il comando `Trova dove può servire`;
- usa `resolveLibraryRelevance` localmente;
- mostra massimo 3 candidati iniziali;
- se i candidati sono più di 3, espone `Mostra altri risultati`;
- non mostra il punteggio numerico come decisione di prodotto;
- mostra target, UDA/classe di appartenenza e una motivazione breve derivata dai segnali/matched terms;
- mantiene `Ignora` come stato effimero della sessione, senza persistenza.

## Azioni candidato

### Collega

`Collega` non scrive immediatamente.

1. Il candidato viene convertito in un Teaching Context valido (`udaId`, eventuale `lessonId`).
2. Il primo `dispatchLibraryContextAction` con capability `LINK` e senza `humanConfirmed` deve ottenere `HUMAN_CONFIRMATION_REQUIRED`.
3. La UI mostra `Conferma collegamento` + `Annulla`.
4. Prima della conferma finale il ranking viene ricalcolato sui props correnti.
5. Se il target non è più presente tra i candidati (perché eliminato, già collegato o contesto cambiato), la scrittura viene negata e i suggerimenti aggiornati.
6. Solo con target ancora valido, secondo dispatch con `humanConfirmed: true` può eseguire `onLink`.

Il link può essere `uda` oppure `lesson`, coerentemente con LIB-03B.

### Usa per preparare

Non genera nulla direttamente. Seleziona esplicitamente il candidato come Teaching Context nella card e riusa il `LibraryProposalPanel` già governato.

Da quel momento valgono invariati:

- privacy fail-closed;
- classificazione professionale;
- consenso remoto per singola richiesta;
- disclosure provider;
- proposta effimera finché il docente non la adotta.

### Ignora

Nasconde il candidato soltanto nella sessione corrente della card. Non modifica la fonte, non crea negative preference persistenti e non altera il ranking canonico.

## Motivazioni leggibili

La UI traduce i segnali senza inventare semantica:

- `CURRENT_LESSON` → `Lezione corrente`;
- `CURRENT_UDA` → `UDA corrente`;
- `CURRENT_CLASS` → `Stessa classe`;
- `PLANNING_GRADE_MATCH` → `Coerente con il livello della programmazione`;
- `SOURCE_TITLE_MATCH` / `SOURCE_CONTENT_MATCH` → `Parole in comune` con gli effettivi `matchedTerms` quando presenti.

Non mostrare messaggi di “copertura curricolare”, “conformità”, “lacuna” o equivalenti.

## Stato unavailable

- `SOURCE_AND_CONTEXT_UNAVAILABLE`: messaggio neutro che invita a selezionare un contesto o completare il contenuto della fonte;
- `NO_RELEVANT_CANDIDATE`: messaggio `Non ho trovato collegamenti utili con i dati disponibili.`

Nessun fallback semantico/remoto viene attivato automaticamente.

## Privacy

Il ranking resta interamente locale. Fonti `unknown`, `restricted` o `student-personal` possono essere ordinate usando il contenuto già presente nel vault senza trasferimenti esterni.

`Usa per preparare` non aggira le policy esistenti: il pannello proposta continua a negare generazione remota per dati studente e richiede opt-in per materiale professionale.

## Wiring applicativo

`App.tsx` passa `planning` a `LibraryView`; `LibraryView` lo passa a ogni `LibrarySourceCard`; la card lo usa solo per costruire il Planning Context opzionale del ranking.

Nessuna nuova persistenza, migrazione, preferenza o modifica a `PlanningStateV1`.

## Criteri di accettazione

LIB-03C è qualificato quando:

1. prima di `Usa` non compare alcuna UI di pertinenza;
2. dopo `Usa`, `Trova dove può servire` produce candidati ordinati da LIB-03B;
3. sono mostrati al massimo 3 candidati iniziali e gli altri richiedono espansione esplicita;
4. nessun candidato viene auto-selezionato o auto-collegato;
5. le motivazioni derivano solo da `signals`/`matchedTerms`;
6. un’identità Programmazione non univoca non blocca il ranking locale e non viene inventata;
7. un’identità Programmazione univoca può alimentare LIB-03A e il boost già previsto da LIB-03B;
8. `Collega` richiede conferma umana e rivalida il target prima della scrittura;
9. un target eliminato/già collegato/stale viene negato prima della scrittura;
10. `Usa per preparare` cambia soltanto il Teaching Context e riusa il proposal flow governato;
11. `Ignora` è solo sessione/UI;
12. fonti studente/restricted restano ordinabili localmente senza ottenere permessi remoti;
13. nessun `curricoloItems`, semantic search, embedding, `MasterProgram`, `planning.resources` o target `activity` entra nel nuovo flusso;
14. mobile 390×844 e desktop restano leggibili senza sovrapposizioni o feature wall;
15. typecheck, security, Library tests, build, startup smoke e Browser Qualification exact-SHA sono PASS.

## Non obiettivi

- semantic search o embedding;
- ranking IA;
- interpretazione curricolare Arena;
- persistenza di preferenze positive/negative;
- nuovo provider o nuovo runtime IA;
- creazione automatica di UDA/lezioni;
- nuova entità `activity` persistente;
- migrazione UDA → MasterProgram;
- modifica dei pesi LIB-03B.

## Confine di integrazione

L’implementazione termina con Draft PR e qualificazione exact-SHA. Nessun merge, deploy o pubblicazione senza nuova decisione umana.
