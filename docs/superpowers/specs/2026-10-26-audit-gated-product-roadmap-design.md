# Audit-Gated Product Roadmap — Release Current + EDU-FLOW-01

**Date:** 2026-10-26  
**Repository:** `antoniocorsano-boop/registro-docente`  
**Baseline:** `main@0ebda92248b9bb984f2e3e201661292daa47e96d`  
**Status:** DESIGN APPROVED BY HUMAN DIRECTION / EXECUTION AUTHORIZED UNTIL NEXT HUMAN BOUNDARY

## Intent

Portare il Registro Docente dall'attuale stato engineering-qualified a un prodotto pubblicato, verificato e poi progressivamente completato come workflow docente longitudinale, evitando di aprire nuove capability IA prima di aver chiuso i collegamenti essenziali tra Programmazione, UDA, lezioni, materiali, svolto ed evidenze.

Il principio operativo vincolante è **audit before change**: ogni momento capace di cambiare architettura, authority, persistenza, comportamento utente, release source o deploy boundary deve iniziare con un audit esplicito della baseline reale. L'audit produce una decisione `PROCEED | REWORK PLAN | STOP`, con evidenza sufficiente a evitare patch speculative e correzioni tardive.

## Product direction

Sequenza canonica:

`RELEASE-CURRENT-01 → EDU-FLOW-01A → EDU-FLOW-01B → workflow observation audit → EDU-FLOW-01C → EDU-FLOW-01D → re-audit → eventuale EDU-FLOW-01E / COPILOT-EXPAND-01`

La fase attuale non autorizza nuove capability generative, nuovi intent, RAG persistente, multi-source synthesis o nuovi provider.

## Current baseline

La baseline di partenza è `main@0ebda92248b9bb984f2e3e201661292daa47e96d`, merge di LIB-CONSOLIDATE-01.

Fatti già verificati:

- exact qualified candidate LIB-CONSOLIDATE-01: `6c1c3d3473267845b9faeade54c5c3dea03d33ca`;
- candidate tree: `87483ccc4b693b0250ec3d338015fd2a9f6b350b`;
- merge commit: `0ebda92248b9bb984f2e3e201661292daa47e96d`;
- merge tree: `87483ccc4b693b0250ec3d338015fd2a9f6b350b`;
- PREDEPLOY #721 PASS sul candidate;
- Browser Qualification #428 PASS 43/43 sul candidate, UX-QA-01/02 0 finding;
- post-merge PREDEPLOY #722 PASS su `main@0ebda922...`;
- nessun deploy è stato eseguito nel ciclo LIB-CONSOLIDATE-01.

L'identità di tree consente di affermare equivalenza del contenuto integrato, ma **non trasferisce automaticamente** Browser #428 al merge SHA: RELEASE-CURRENT-01 eseguirà un audit release dedicato sul frozen release source.

## Audit gate model

Ogni tranche significativa usa cinque gate.

### A0 — Baseline / contract audit

Prima di scrivere codice o workflow:

- exact baseline SHA;
- stato PR/branch e lavoro parallelo;
- contratti e authority esistenti;
- schema/persistenza coinvolti;
- workflow/gate esistenti;
- evidence già valida e evidence non trasferibile;
- rischio di duplicazione o capability già presente;
- confini di privacy e dati sintetici;
- decisione `PROCEED | REWORK PLAN | STOP`.

### A1 — RED design audit

Prima della correzione/implementazione:

- il RED deve essere causale e limitato al contratto nuovo;
- test legacy, build e infrastruttura devono restare distinguibili;
- se il RED non dimostra la lacuna prevista, non implementare.

Per tranche docs-only o qualification-only dove non cambia comportamento prodotto, A1 diventa **evidence-gap audit**: si dimostra quale ricevuta o gate manca, senza creare un RED artificiale.

### A2 — GREEN / boundary audit

Dopo il primo GREEN:

- controllare diff reale contro lo scope;
- verificare che non siano entrati provider, authority, schema o persistence non previsti;
- verificare stale-state, commit-first e human-confirmation dove applicabili;
- rieseguire i gate mirati.

### A3 — Exact-SHA qualification + independent review

Prima della decisione umana di integrazione:

- exact SHA congelato;
- PREDEPLOY PASS;
- Browser Qualification PASS quando esiste superficie utente o rischio regressivo browser;
- UX-QA-01/02 PASS quando applicabili;
- fresh whole-branch review;
- 0 finding bloccanti irrisolti;
- memoria aggiornata solo se emerge conoscenza riutilizzabile.

### A4 — Post-integration / post-deploy audit

Dopo merge o deploy:

- verificare SHA/tree realmente integrato o pubblicato;
- eseguire i gate post-merge previsti;
- per deploy: live browser verification separata dall'evidenza pre-deploy;
- nessun PASS finale senza evidenza terminale.

## RELEASE-CURRENT-01

### Goal

Pubblicare l'attuale `main` sul target già esistente e produrre una ricevuta live che dimostri che il sito pubblico serve il frozen release source e i workflow principali.

### Release source

Frozen source iniziale proposto:

`0ebda92248b9bb984f2e3e201661292daa47e96d`

Se `main` cambia prima del freeze A0/A1, il ciclo non deve inseguire automaticamente il nuovo SHA: si apre un nuovo audit e si decide se aggiornare il release source.

### Release A0 — preliminary audit

Verificare:

- `main` exact SHA;
- candidate/merge tree identity;
- post-merge PREDEPLOY #722;
- assenza di PR aperte che rendano ambiguo il freeze;
- ultima release/live receipt e relativo source SHA;
- differenza tra public release source storico e current main;
- capacità del Browser Qualification corrente di coprire Home, UDA, Programmazione, Biblioteca, Copilota, semantic retrieval e Student Portal;
- nessuna necessità di cambiare codice prodotto per preparare il deploy.

### Release A1 — fresh release-source qualification

Prima della decisione deploy eseguire un qualification runner isolato che:

- checkoutta **esattamente** `0ebda922...` come application source;
- usa frozen dependencies;
- esegue PREDEPLOY-equivalent checks o riusa la ricevuta #722 solo dove semanticamente equivalente;
- esegue il Browser Qualification corrente contro una build locale dello stesso frozen source;
- conserva artifact e digest;
- non modifica il frozen source;
- non pubblica nulla.

Stato richiesto: `RELEASE SOURCE QUALIFIED / READY FOR HUMAN DEPLOY DECISION`.

### Human deploy boundary

Il deploy è un'azione separata e richiede decisione umana esplicita, anche se A0-A3 sono verdi.

### Release A4 — live verification

Dopo deploy, usare runner GitHub effimero e Chromium contro il target pubblico già esistente. Dati sintetici/browser-local soltanto.

Inventario minimo:

- Home teacher-first;
- Programmazione;
- UDA;
- Biblioteca privata;
- Copilota contestuale con REVIEW, LINK e PREPARE nei limiti già qualificati;
- local semantic retrieval quando il fixture controllato lo abilita;
- Valutazioni / Tabellone / Analisi / Scheda alunno;
- Verifiche online / Student Portal;
- Privacy / backup surface;
- mobile 390×844 e desktop 1280×900;
- zero pageerror e console error inattesi;
- zero overflow bloccante;
- required evidence presente.

Il live gate non modifica dati reali e non trasferisce automaticamente evidence dai gate locali.

## EDU-FLOW-01 — teacher longitudinal workflow

### Product goal

Rendere leggibile e operativo il ciclo:

`Programmazione → UDA → lezione/attività → materiali/fonti → svolto → evidenze → avanzamento/ripianificazione`

senza attribuire automaticamente copertura curricolare, acquisizione di competenza o decisioni pedagogiche che restano del docente/Arena.

### EDU-FLOW-01A — Longitudinal state audit + read model

Prima di introdurre schema nuovo, auditare ciò che già esiste in:

- `PlanningStateV1`;
- UDA/lesson domain;
- diary/logged hours;
- evaluation/evidence links;
- Library teaching links;
- Arena accepted context;
- current progress semantics.

Preferenza architetturale: **derived read model prima di nuova persistenza**. Nuovo schema è ammesso solo se l'audit dimostra che lo stato richiesto non è ricostruibile in modo deterministico e stabile.

Output previsto: stati teacher-facing `previsto | in corso | svolto | da recuperare` definiti come read model spiegabile, non come nuova authority curricolare.

### EDU-FLOW-01B — “Dove sono?” teacher surface

Una superficie focalizzata per classe che risponda a:

- cosa sto facendo adesso;
- cosa avevo previsto;
- cosa viene dopo;
- quali scostamenti richiedono attenzione.

Progressive disclosure obbligatoria: niente dashboard monolitica, score opachi o semafori non spiegabili.

### Workflow observation gate

Dopo 01B, fermare l'espansione e rieseguire un audit end-to-end del journey reale. Solo evidence di uso/browser e Human Review possono autorizzare 01C/01D senza redesign.

### EDU-FLOW-01C — Materials in the flow

Integrare Biblioteca/Copilota dal punto di lavoro reale (UDA/lezione) senza duplicare il Composer. Riutilizzare launch-context e provenance già integrati.

### EDU-FLOW-01D — Taught / evidence closure

Collegare svolto reale ed evidenze al read model, senza dichiarare automaticamente competenza acquisita o curricolo coperto.

### EDU-FLOW-01E — Assisted replanning

Solo dopo nuovo audit. Il Copilota può proporre ripianificazione o segnalare scostamenti, ma non applica modifiche canoniche senza decisione docente e non acquisisce authority Arena.

## COPILOT-EXPAND-01 decision gate

Capability candidate come multi-source, `SUMMARIZE`, target `activity`, chunk retrieval/RAG o vector persistence non sono pianificate automaticamente. Verranno valutate solo dopo EDU-FLOW observation/re-audit e con un nuovo design decision record.

## Global constraints

- Repository memory protocol obbligatorio.
- Exact-SHA discipline e OR-001…OR-009 applicabili.
- No auto-merge.
- No deploy/publish senza decisione umana separata.
- Synthetic-only qualification data.
- Privacy-first; nessun dato studente reale nei gate.
- Arena conserva authority curricolare.
- TRAMA Contextual Copilot Core conserva authority sulle azioni condivise.
- Nessun nuovo provider o remote fallback implicito.
- Non indebolire test/gate per ottenere verde.
- Audit prima di ogni modifica irreversibile, schema/authority change, cross-repo contract change o nuovo capability boundary.

## Approaches considered

### A. Continuare feature-by-feature

Respinto. Riduce il tempo iniziale ma aumenta il rischio di duplicazione, regressioni semantiche e redesign tardivi.

### B. Un unico grande programma end-to-end fino a ripianificazione IA

Respinto. Produce una tranche troppo ampia per attribuire causalmente errori e rende fragili review e decisioni umane.

### C. Tranche piccole con audit gate espliciti e release prima dell'espansione

Selezionato. Mantiene candidate piccoli, conserva TDD/qualification discipline, allinea prima il prodotto pubblico e usa audit intermedi per correggere il piano prima di scrivere codice costoso.

## Success criteria

Il programma è riuscito quando:

1. current `main` è pubblicata e live-verified sul target esistente;
2. il docente può leggere il proprio stato longitudinale senza interpretazioni opache;
3. Programmazione, UDA, lezioni, Biblioteca e Copilota formano un unico flusso operativo;
4. svolto ed evidenze alimentano il quadro senza auto-certificare curricolo/competenze;
5. ogni espansione IA successiva è giustificata da evidence e da una nuova decisione esplicita.