# FLOW-04 — Review Session Design

## Intent

FLOW-04 trasforma **Rivedi** da selettore di destinazioni a **sessione professionale di revisione**. Il docente mantiene una missione unica mentre attraversa le superfici autorevoli già presenti nel Registro Docente; il sistema conserva il contesto necessario a orientarsi, ma non produce verdetti, non duplica analisi e non crea nuova autorità professionale.

Baseline canonica: `main@a8fa0acc64e035aa5c0c968f5c0a6af1dcb73026` (FLOW-03B / PR #112 integrata; PREDEPLOY post-merge #1732 PASS).

Tracker: UX-GOV-01 #104. Scope: FLOW-04 #113.

Principio di governance:

> `Rivedi` evidenzia, ordina e collega evidenze professionali; non decide, non corregge automaticamente e non trasforma indicatori derivati in fatti canonici.

## Current state

La baseline FLOW-03B possiede già:

- `todayAction === 'review'` come intento di sessione;
- `reviewEvidenceKind` come stato session-only proveniente dal post-registrazione;
- `getRecordReviewOptions(reviewEvidenceKind)` per ordinare Tabellone, Analisi, Storico, Scheda alunno, UDA/diario e Comportamento in base al tipo di evidenza;
- invalidazione di `reviewEvidenceKind` al cambio classe;
- nessuna apertura automatica della prima destinazione.

Il limite architetturale è in `handleContinueToday()`: quando viene scelta una destinazione, l'app azzera `todayAction`, `reviewEvidenceKind` e la sessione di registrazione prima della navigazione. La missione `Rivedi` termina quindi esattamente quando il docente entra nella superficie che deve consultare.

Inoltre, nella Dashboard il pannello `Rivedi` precede immediatamente la Panoramica Sezione completa. Su mobile la missione non resta visivamente dominante abbastanza a lungo.

## Goals

1. Introdurre un **ReviewSessionContext** esplicito e soltanto session-only.
2. Distinguere l'origine della revisione: `Oggi → Rivedi` oppure `Registra → Rivedi`.
3. Preservare classe, eventuale `evidenceKind` e superficie corrente durante la revisione.
4. Consentire di passare tra le superfici di revisione e tornare all'orchestratore `Rivedi` senza perdere la missione.
5. Invalidare in modo fail-closed la sessione quando cambia la classe o quando il docente esce verso una superficie non appartenente alla revisione.
6. Rendere la missione `Rivedi` visivamente primaria sulla Dashboard e riconoscibile anche dentro le superfici specialistiche.
7. Riutilizzare le superfici autorevoli esistenti senza copiarne dati, KPI, logiche o scritture.
8. Conservare il carattere non deliberativo degli indicatori e la distinzione tra evidenza canonica e lettura derivata/euristica.

## Non-goals

- nessuna nuova pagina o dashboard di analisi;
- nessun nuovo modello persistente per voto, batch, alunno, UDA o insieme di evidenze;
- nessun deep-link Programmazione ↔ UDA ↔ lezione/attività: **INT-01**;
- nessuna catena Biblioteca ↔ Verifiche ↔ Copilota: **INT-02**;
- nessuna memoria semantica locale o recupero automatico di elementi rilevanti: **LSM-02**;
- nessun ridisegno della shell, della navigazione inferiore, della PWA o dei controlli fissi: **MOBILE-01**;
- nessun suggerimento automatico di voto, scrutinio, correzione, decisione disciplinare o altra decisione professionale;
- nessuna elevazione delle euristiche della Scheda alunno o di altri indicatori derivati a fonte canonica;
- nessun cambiamento all'autorità PERSIST-01H.

## Approaches considered

### A — Nuova pagina `Rivedi` — scartata

Una pagina autonoma aggregando KPI, trend, storico e dossier renderebbe la missione molto visibile, ma duplicherebbe Tabellone, Analisi, Storico, Scheda alunno e UDA. Creerebbe una nuova superficie semi-autorevole e aumenterebbe il rischio di divergenza dei dati.

### B — Migliorare soltanto il menu esistente — scartata

Aggiungere descrizioni o un ordinamento migliore al pannello attuale avrebbe un delta minimo, ma non risolverebbe il problema principale: la missione si perderebbe al primo click verso una superficie specialistica.

### C — ReviewSession + orchestrazione delle superfici esistenti — scelta

Introdurre un piccolo contratto di sessione, mantenere `Rivedi` come orchestratore sulla Dashboard e mostrare un banner di missione nelle superfici specialistiche supportate.

**Vantaggi:** nessuna nuova autorità, continuità professionale, riuso del resolver FLOW-03B, delta circoscritto, testabilità deterministica e confine netto rispetto a INT-01/02, LSM-02 e MOBILE-01.

## Domain contract

Nuovo modulo: `src/review/reviewSession.ts`.

```ts
import type { RecordEvidenceKind } from '../recording/recordSession';
import type { ActiveTab } from '../types';

export type ReviewOrigin = 'today-review' | 'post-record';

export type ReviewSurface = Extract<
  ActiveTab,
  'tabellone' | 'analytics' | 'storico' | 'report' | 'uda-gantt' | 'comportamenti'
>;

export interface ReviewSessionContext {
  classId: string;
  className: string;
  origin: ReviewOrigin;
  evidenceKind?: RecordEvidenceKind;
  currentSurface?: ReviewSurface;
}
```

Il modulo espone funzioni pure con questi contratti:

```ts
export interface BuildReviewSessionInput {
  classId: string;
  className: string;
  origin: ReviewOrigin;
  evidenceKind?: RecordEvidenceKind | null;
}

export function buildReviewSession(input: BuildReviewSessionInput): ReviewSessionContext;
export function isReviewSurface(tab: ActiveTab): tab is ReviewSurface;
export function enterReviewSurface(session: ReviewSessionContext, surface: ReviewSurface): ReviewSessionContext;
export function returnToReviewRouter(session: ReviewSessionContext): ReviewSessionContext;
export function keepReviewSessionForClass(
  session: ReviewSessionContext | null,
  classId: string | null | undefined
): ReviewSessionContext | null;
```

### Construction rules

- `classId` e `className` vengono normalizzati con `trim()`;
- valori vuoti falliscono con `REVIEW_CLASS_REQUIRED`;
- `origin` è sempre esplicita;
- `evidenceKind` è ammesso per entrambe le origini a livello di tipo, ma nella costruzione canonica viene popolato solo dall'handoff `post-record`; `today-review` parte senza evidenza contestuale;
- la sessione nasce senza `currentSurface` perché l'orchestratore è la Dashboard.

### Surface rules

Le sole superfici FLOW-04 sono:

- `tabellone`;
- `analytics`;
- `storico`;
- `report`;
- `uda-gantt`;
- `comportamenti`.

`enterReviewSurface()` aggiorna soltanto `currentSurface`. `returnToReviewRouter()` rimuove `currentSurface` mantenendo classe, origine ed eventuale `evidenceKind`.

### Class invariant

`keepReviewSessionForClass()` restituisce la sessione soltanto se `session.classId === classId.trim()`. In ogni altro caso restituisce `null`.

Il cambio classe in `App` non tenta riconciliazioni o migrazioni: **chiude la ReviewSession**. Questo conserva la regola già introdotta da FLOW-03B ed evita contaminazione cross-class.

## Session lifecycle

### Entry from `Oggi → Rivedi`

1. `resolveTodayRoute('review', currentClassId)` continua a richiedere una classe valida.
2. Quando la classe esiste, `App` costruisce `ReviewSessionContext` con `origin: 'today-review'`.
3. `todayAction` resta `review`.
4. `activeTab` diventa `dashboard`.
5. Nessun `evidenceKind` viene inventato.

### Entry from `Registra → Rivedi`

1. la `RecordSessionDraft` deve appartenere alla classe corrente;
2. `App` costruisce `ReviewSessionContext` con `origin: 'post-record'` ed eventuale `session.evidenceKind`;
3. la `RecordSessionDraft` viene chiusa come oggi;
4. `todayAction` diventa `review`;
5. `activeTab` diventa `dashboard`.

Il resolver `getRecordReviewOptions(evidenceKind)` resta la sorgente qualificata dell'ordinamento iniziale. FLOW-04 non introduce un secondo motore di priorità.

### Enter a review surface

Il pannello `Rivedi` chiama un handler dedicato, non `handleContinueToday()`.

L'handler:

1. verifica che esista una ReviewSession per la classe corrente;
2. aggiorna `currentSurface` con `enterReviewSurface()`;
3. mantiene `todayAction === 'review'`;
4. naviga alla superficie richiesta;
5. non tocca dati durevoli.

### Move between review surfaces

Se una ReviewSession è attiva e la navigazione ordinaria punta a un'altra `ReviewSurface`, la sessione resta attiva e `currentSurface` viene aggiornato. Questo consente di passare, per esempio, da Tabellone ad Analisi senza perdere la missione.

### Return to `Rivedi`

Il banner specialistico espone `Torna a Rivedi`:

1. `returnToReviewRouter()` rimuove `currentSurface`;
2. `activeTab` torna `dashboard`;
3. `todayAction` resta `review`;
4. ordine contestuale e origine restano disponibili.

### Exit from review

La ReviewSession viene chiusa quando:

- il docente usa `Chiudi` nel pannello o nel banner;
- cambia classe;
- naviga verso una tab che non è `dashboard` né una `ReviewSurface`;
- torna a Home tramite il percorso globale che già invalida l'intento transitorio;
- avviene restore/reset o altra invalidazione di sessione già prevista dall'app.

L'uscita azzera sia `reviewSession` sia `todayAction` quando quest'ultimo è `review`.

## App integration

`src/App.tsx` sostituisce lo stato isolato `reviewEvidenceKind` con:

```ts
const [reviewSession, setReviewSession] = useState<ReviewSessionContext | null>(null);
```

Non serve un ref separato finché gli handler leggono lo stato attraverso dipendenze React stabili; se l'implementazione incontra callback che richiedono lettura sincrona della sessione corrente, si può adottare lo stesso pattern `publish*Session` già usato da `RecordSession`, ma solo se necessario.

Responsabilità di `App`:

- costruire la sessione nelle due origini;
- preservarla soltanto nelle superfici FLOW-04;
- chiuderla negli exit path;
- sincronizzare `currentSurface` con la navigazione;
- passarla a Dashboard e banner;
- non serializzarla.

## UI architecture

### `ReviewRouterPanel`

Nuovo componente `src/components/ReviewRouterPanel.tsx` che sostituisce il blocco inline `todayAction === 'review'` in `DashboardView`.

Il pannello non calcola nuovi indicatori. Mostra:

- **missione:** `Oggi · Rivedi`;
- **classe:** `Stai rivedendo la classe {className}`;
- **origine contestuale** solo quando utile: dopo una registrazione può indicare che l'ordine riflette il tipo di evidenza appena registrata;
- **domanda professionale:** `Che cosa vuoi controllare o approfondire?`;
- le destinazioni esistenti ordinate da `getRecordReviewOptions(evidenceKind)`;
- una descrizione breve e non deliberativa del ruolo di ciascuna superficie;
- comando `Chiudi`.

Descrizioni canoniche:

- Tabellone — `Sintesi matematica delle valutazioni registrate.`
- Analisi — `Indicatori e trend per leggere l'andamento.`
- Storico — `Traccia delle registrazioni e delle correzioni.`
- Scheda alunno — `Dossier individuale delle evidenze disponibili.`
- UDA e diario — `Progressione didattica e diario della classe.`
- Comportamento — `Evidenze comportamentali registrate.`

Nessuna descrizione usa verbi prescrittivi come `devi`, `assegna`, `correggi`, `decidi`.

### `ReviewMissionBanner`

Nuovo componente `src/components/ReviewMissionBanner.tsx`, mostrato sopra la superficie specialistica quando:

- esiste una ReviewSession valida per la classe corrente;
- `activeTab` è una `ReviewSurface`;
- `reviewSession.currentSurface === activeTab`.

Contenuto minimo:

- `Rivedi · {className}`;
- superficie corrente;
- `Torna a Rivedi`;
- `Chiudi`.

Il banner non mostra KPI, insight o raccomandazioni. È un segnale di missione, non un nuovo pannello analitico.

### Dashboard hierarchy

Quando `todayAction === 'review'` e la ReviewSession appartiene alla classe corrente:

- `ReviewRouterPanel` è il primo contenuto;
- `Panoramica Sezione` resta disponibile ma chiusa/collassata di default, usando lo stesso principio già qualificato in FLOW-03B per l'azione focalizzata;
- nessuna scorciatoia viene rimossa definitivamente;
- quando la ReviewSession termina, la Panoramica torna aperta come oggi.

Questo riduce la competizione visiva senza introdurre una shell nuova.

## Professional authority and provenance

FLOW-04 non interpreta i numeri per il docente. Le superfici continuano a possedere la loro semantica:

- Tabellone e Analisi restano supporto matematico/descrittivo e non deliberativo;
- Storico resta archivio e correzione;
- Scheda alunno resta dossier, includendo eventuali euristiche già esistenti con la loro provenienza;
- UDA/diario resta progressione didattica;
- Comportamento resta registro delle evidenze comportamentali.

Il pannello e il banner non promuovono alcun indicatore a decisione, voto o fatto canonico. FLOW-04 compone **navigazione e contesto**, non evidenze nuove.

## Persistence boundary

`ReviewSessionContext` è esclusivamente UI/session state.

Non deve comparire in:

- `AppData`;
- `SecureAppSnapshot`;
- backup payload;
- `PlanningState`;
- `LibraryStateV1`;
- `ProfessionalMemoryStateV1`;
- `CopilotStateV1`;
- PERSIST-01H;
- semantic memory projections.

La chiusura e riapertura dell'app non ripristinano una ReviewSession.

## Compatibility

- `TodayAction` continua a includere `review`;
- `resolveTodayRoute()` non cambia semantica;
- `getRecordReviewOptions()` resta in `src/recording/reviewRouting.ts` per non riaprire FLOW-03B con una migrazione di modulo non necessaria;
- `handleContinueToday()` resta il percorso di continuazione che chiude gli intenti per Prepara/Conduci e altri handoff esistenti; FLOW-04 usa un handler dedicato per entrare nelle superfici di revisione;
- i contratti TODAY-01 e FLOW-03B vengono aggiornati solo dove la nuova continuità di `review` sostituisce intenzionalmente il comportamento precedente.

## Accessibility and mobile

- viewport qualificata mobile: 390×844;
- touch target minimo: 44 px;
- il banner deve andare a capo senza overflow orizzontale;
- `Torna a Rivedi` e `Chiudi` devono essere distinguibili, raggiungibili da tastiera e avere etichette accessibili;
- la Panoramica collassata usa `details/summary` o pattern già qualificato equivalente;
- nessun controllo FLOW-04 deve sovrapporsi al Copilota o a controlli fissi della shell;
- nessuna modifica strutturale a Navbar o PWA in questa milestone.

## Qualification

FLOW-04 richiede:

1. RED → GREEN sul dominio `ReviewSessionContext`;
2. RED → GREEN sull'integrazione `Oggi → Rivedi` e `Registra → Rivedi`;
3. prova di continuità Dashboard → superficie → superficie → Dashboard;
4. prova fail-closed sul cambio classe;
5. prova di chiusura su navigazione esterna alla review;
6. prova che ReviewSession non entri in snapshot, backup o altri stati durevoli;
7. regressione TODAY-01, FLOW-03 e FLOW-03B;
8. Qualification Invariants PASS;
9. PREDEPLOY PASS;
10. Browser Qualification desktop + mobile 390×844;
11. Human Product/UX Review comparativa con focus su gerarchia missione/Panoramica;
12. Final Independent Review sull'exact SHA;
13. nessun merge o deploy senza autorizzazione esplicita separata.
