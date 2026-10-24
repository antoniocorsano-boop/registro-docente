# UX-QA-01 — Autonomous Navigation & Usability Qualification

## Intent

Registro Docente deve smettere di scoprire regressioni strutturali di UX soltanto tramite review manuali episodiche. UX-QA-01 introduce un qualificatore browser riutilizzabile che attraversa il prodotto con dati sintetici, costruisce evidenza della navigazione reale, applica invarianti di usabilità deterministiche e produce un report machine-readable/agent-readable. Il primo pilota corregge due difetti già osservati in produzione: classe riattivata implicitamente all'ingresso e home con priorità visiva invertita rispetto al compito principale del docente.

## Perché ora

Il prodotto ha già browser qualification, exact-SHA discipline, screenshot/evidence e dati sintetici. Manca uno strato che tratti la navigazione e la gerarchia UX come contratti verificabili, non come impressioni. L'obiettivo è trasformare i finding umani ricorrenti in regole che impediscono regressioni future e forniscono a un reviewer AI un pacchetto di evidenza affidabile.

## Obiettivi

- Navigare l'app reale in Chromium sull'exact candidate SHA con dati esclusivamente sintetici.
- Rappresentare il journey come grafo di nodi/edge osservati e non come lista informale di screenshot.
- Applicare invarianti UX fail-closed con severità P0/P1/P2.
- Produrre `ux-qa-01-evidence.json` e `ux-qa-01-report.md` come artifact del browser gate.
- Rendere il report adatto a una seconda passata agentica/AI senza introdurre provider o token nel runtime dell'app.
- Correggere nel primo incremento la separazione fra contesto di navigazione e dato persistente di classe.
- Rendere la home teacher-first: classi come vista predefinita, sintesi e confronto disponibili ma non simultaneamente dominanti.

## Non obiettivi

- Nessun provider LLM nel runtime di Registro Docente.
- Nessuna decisione UX irreversibile affidata automaticamente a un modello.
- Nessun merge/deploy automatico in seguito a un audit.
- Nessuna pretesa di coprire tutta l'accessibilità con automazione in UX-QA-01.
- Nessuna riscrittura generale del routing framework o migrazione a un router esterno.
- Nessuna modifica ai confini privacy/local-first.

## Vincoli

- Baseline: `main@e1aa8f405d8929d3759c9a87abdf2ff79db31128`.
- Browser canonico: runner GitHub effimero + Playwright sull'exact candidate SHA.
- Dati di qualifica: sintetici soltanto.
- TDD RED→GREEN causale per ogni comportamento corretto.
- Nessun nuovo token esterno e nessun costo ricorrente.
- `main` non viene mutato durante l'implementazione; branch isolato e PR Draft.
- Merge e deploy restano decisioni umane separate.

## Approcci considerati

### A. Screenshot + reviewer AI soltanto

Il browser cattura schermate e un modello produce un audit. È veloce da costruire, ma non è abbastanza deterministico per diventare gate: lo stesso difetto potrebbe essere classificato diversamente e mancherebbe un contratto stabile per i regressioni P0/P1.

### B. Crawler deterministico + invarianti + pacchetto per reviewer AI — scelto

Playwright osserva il journey reale, registra stato/edge e misura proprietà visibili. Le violazioni note e strutturali sono deterministiche; il pacchetto risultante può poi essere letto da ChatGPT/Codex per finding più interpretativi. Questo mantiene zero dipendenze AI nel prodotto e rende i finding riproducibili.

### C. Analisi statica del codice

Può individuare pattern sospetti, ma non sa se un docente può realmente tornare al punto di provenienza, se una classe appare attiva al primo ingresso o quale elemento è prioritario sul viewport. È utile come supporto, non come autorità UX.

## Architettura

### 1. Navigation contract

File canonico: `ux/qa/navigation-contract.v1.json`.

Definisce:
- nodi UX attesi (`home.classes`, `class.dashboard`, `class.evaluations`, `library`, `planning`);
- transizioni principali;
- invarianti con ID stabile, severità e messaggio;
- viewport minimi di qualifica (`390x844`, `1280x900`).

Il contratto descrive l'esito utente, non i dettagli React.

### 2. Browser explorer

`tests/browser/ux-qa-01-navigation.spec.cjs` usa il vault sintetico e attraversa almeno:

`HOME → CLASSE → RIEPILOGO → VALUTAZIONI → BACK → RIEPILOGO → BACK → HOME → BIBLIOTECA → BACK → HOME → PROGRAMMAZIONE → BACK → HOME`.

Durante il percorso registra:
- nodo osservato;
- URL/history state rilevante;
- presenza o assenza del contesto classe;
- heading/landmark principali;
- posizione verticale dell'azione primaria;
- overflow orizzontale;
- target touch principali;
- screenshot richiesti;
- `pageerror`.

### 3. Deterministic analyzer

`scripts/ux-qa/analyze.mjs` legge il JSON prodotto dal browser e il navigation contract. Genera:
- `browser-evidence/ux-qa-01-report.json`;
- `browser-evidence/ux-qa-01-report.md`.

Il processo termina non-zero quando esiste almeno un finding P0 o P1. P2 resta visibile nel report ma non blocca UX-QA-01.

### 4. Agent review package

Il report contiene prove e non prescrive patch automaticamente. Un agente può usare:
- contract ID;
- nodo/edge fallito;
- screenshot path;
- stato osservato;
- comportamento atteso;
- severità;
- file candidati rilevati dal repository.

L'agente propone design/piano e implementa soltanto attraverso il normale ciclo branch → RED → GREEN → qualification → human decision.

## Invarianti UX-QA-01

### UXNAV-001 — ingresso neutro (P0)

All'apertura del registro autenticato/sbloccato il docente atterra su `home.classes` con `currentClass = null`, anche se il vault contiene un precedente `currentClassId`. L'ultima classe può essere suggerita in futuro, ma non diventa contesto attivo senza una nuova scelta esplicita.

### UXNAV-002 — navigazione di classe contestuale (P0)

La bottom navigation `Riepilogo / Valutazioni / Comportamento / Tabellone / Analisi` non è visibile in home senza classe attiva. Compare soltanto dopo una scelta esplicita.

### UXNAV-003 — back relativo dalla classe (P0)

Dopo `HOME → CLASSE`, browser Back ritorna a HOME e rimuove il contesto classe.

### UXNAV-004 — back relativo tra viste di classe (P0)

Dopo `CLASSE/RIEPILOGO → VALUTAZIONI`, browser Back ritorna a `CLASSE/RIEPILOGO`, preservando la stessa classe. Un secondo Back ritorna a HOME.

### UXNAV-005 — home teacher-first (P1)

La vista iniziale della home è `Classi`. Le class card sono visibili prima che l'utente apra volontariamente `Sintesi` o `Confronto`.

### UXNAV-006 — progressive disclosure home (P1)

La home offre tre viste mutuamente esclusive: `Classi`, `Sintesi`, `Confronto`. KPI globali e tabella di confronto non sono entrambi espansi nella vista `Classi`.

### UXNAV-007 — class card compatte e distinguibili (P1)

Su mobile almeno due class card devono essere raggiungibili senza attraversare prima KPI o tabella globale. Ogni card ha un accento categoriale stabile non semantico (non rosso/verde valutativo), un nome classe e una sintesi minima.

### UXNAV-008 — mobile fit (P1)

A 390x844 non esiste overflow orizzontale e i controlli primari del journey hanno target minimo 44x44 CSS px.

### UXNAV-009 — pageerror fail-closed (P0)

Il PASS viene assegnato soltanto dopo screenshot/evidence finali e `pageerror` deve restare vuoto.

## Correzione prodotto inclusa nel pilota

### Separazione navigation state / persisted data

`currentClassId` resta nel formato `AppData` per compatibilità storage, ma al bootstrap non viene riattivato come contesto visibile. La sessione parte sempre da `null`. Una futura migrazione potrà rimuoverlo dal formato persistente; UX-QA-01 non richiede una migrazione del vault.

### History state

Le navigazioni utente significative usano `history.pushState` con `{ classId, tab }`. `popstate` resta l'autorità del browser Back. Le transizioni causate da salvataggi interni non devono creare history entry artificiali.

### Home a viste

`HomeView` introduce stato locale `classes | summary | comparison`, default `classes`.

- `Classi`: griglia compatta in testa; `Nuova classe`; azioni distruttive secondarie.
- `Sintesi`: KPI globali + stato backup.
- `Confronto`: tabella comparativa.

Nessuna funzione viene rimossa; cambia soltanto priorità e progressive disclosure.

## Evidenza e severità

Ogni finding JSON contiene almeno:

```json
{
  "id": "UXNAV-003",
  "severity": "P0",
  "status": "FAIL",
  "node": "class.dashboard",
  "expected": "Back returns to home.classes with no active class",
  "observed": "...",
  "evidence": ["screenshots/...png"]
}
```

Il report Markdown ordina P0 → P1 → P2 e include una sezione `Suggested remediation boundary` senza patch automatica.

## Browser qualification

UX-QA-01 viene registrato nel workflow browser esistente, non crea una seconda infrastruttura Chromium. Il workflow:

1. verifica exact SHA;
2. installa da lockfile;
3. build produzione;
4. avvia server;
5. esegue i browser spec esistenti + `ux-qa-01-navigation.spec.cjs`;
6. esegue `bun scripts/ux-qa/analyze.mjs`;
7. carica evidence e report nello stesso artifact.

## Success criteria

UX-QA-01 è qualificato quando sullo stesso exact SHA:

- PREDEPLOY è verde;
- Browser Qualification è verde;
- gli invarianti UXNAV-001…009 risultano PASS;
- report ed evidence sono presenti nell'artifact;
- nessun browser test preesistente viene rimosso o indebolito;
- nessun merge/deploy è avvenuto.

## Evoluzione successiva

Dopo il pilota il navigation contract può essere esteso a Biblioteca, Programmazione, UDA, valutazioni dettagliate e percorsi longitudinali. L'AI reviewer resta esterno al runtime e usa il pacchetto di evidenza per proporre finding interpretativi, design e piani; l'autorità di integrazione resta umana.
