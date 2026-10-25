# UX-QA-02 — Product-wide Progressive Disclosure Audit

## Intent

Estendere UX-QA-01 dal solo grafo di navigazione alla gerarchia informativa delle superfici mature del Registro Docente. Il problema da prevenire è l'accumulo di funzioni corrette ma simultaneamente visibili, che trasforma schermate operative in console dense e rende poco chiaro al docente quale azione sia primaria.

La regola di prodotto è: **non eliminare informazione; eliminare simultaneità**. Le funzioni avanzate restano disponibili, ma vengono mostrate dopo una scelta esplicita del docente.

## Baseline

- Repository: `antoniocorsano-boop/registro-docente`.
- Baseline: `main@46920f957daca12f8d4f5d9bd28b37efd4212a1f`.
- UX-QA-01 resta invariato e continua a governare navigazione, neutral entry, Back, Home e pageerror.
- Browser Qualification canonica: GitHub-hosted ephemeral runner + Playwright sull'exact candidate SHA.

## Approcci considerati

### A. Audit visuale/manuale periodico

Mantiene basso il costo iniziale, ma ripete il problema appena emerso: i difetti di densità vengono scoperti solo dopo il deploy e dipendono dal giudizio umano. Scartato come meccanismo primario.

### B. Rifacimento simultaneo di tutte le superfici dense

Porterebbe Programmazione, UDA, Biblioteca, Impostazioni, Privacy e Valutazioni in una sola grande modifica. È troppo ampia, rende difficile ottenere RED causali e aumenta il rischio di indebolire gate legacy. Scartato.

### C. Audit automatico comune + correzioni progressive per severità — scelto

Aggiungere un contratto UXPD riutilizzando l'analyzer UX-QA-01 e un nuovo browser explorer. I P1 bloccano la qualification; i P2 vengono comunque registrati nel report ma non obbligano a rifare tutte le superfici nello stesso ciclo. Il primo ciclo corregge i P1 strutturali; i P2 diventano backlog qualificato e possono essere chiusi in task successivi con lo stesso contratto.

## Superfici auditate

1. Programmazione didattica.
2. Workspace UDA.
3. Biblioteca privata.
4. Impostazioni.
5. Privacy.
6. Nuova Valutazione di Classe.
7. Card classi della Home per le azioni distruttive secondarie.

## Contratto UXPD v1

Il contratto usa `schema: registro.ux-qa-progressive-disclosure/v1`, gli stessi viewport canonici di UX-QA-01 (`390x844`, `1280x900`) e i seguenti invarianti.

- `UXPD-001` — **P1** — Programmazione apre una vista riepilogativa/read-first; il form completo non domina la vista iniziale.
- `UXPD-002` — **P1** — Programmazione espone sezioni esplicite `Profilo`, `Calendario e normativa`, `Organizzazione`; al massimo una sezione è in modifica alla volta.
- `UXPD-003` — **P1** — Workspace UDA apre una vista primaria `UDA`; `Avanzamento`, `Pianificazione`, `Analisi` sono viste esplicite e non simultanee.
- `UXPD-004` — **P1** — KPI, Gantt/dipendenze e gap analysis non sono tutti dominanti nella stessa vista UDA iniziale.
- `UXPD-005` — **P2** — Biblioteca mostra un titolo umano come label primaria; il filename tecnico è secondario.
- `UXPD-006` — **P2** — Impostazioni mostra prima profilo/identità; gruppi avanzati sono dischiusi per scelta esplicita.
- `UXPD-007` — **P2** — Privacy è summary-first: principi e stato sono visibili subito, dettagli tecnici approfonditi sono dischiusi.
- `UXPD-008` — **P2** — Nuova Valutazione presenta prima i campi essenziali; compilazione rapida e opzioni avanzate non dominano l'ingresso.
- `UXPD-009` — **P2** — Azioni distruttive di classe non competono con `Apri classe` sulla superficie primaria della card.
- `UXPD-010` — **P1** — Nei nodi auditati mobile non c'è overflow orizzontale e i controlli primari/selector di vista sono almeno 44x44 px.
- `UXPD-011` — **P0** — Pageerror fail-closed fino all'ultima evidence operation.

P0/P1 sono blocking; P2 report-only, riusando `scripts/ux-qa/analyzer.mjs` senza introdurre un secondo motore.

## Evidence browser

Il nuovo explorer `tests/browser/ux-qa-02-progressive-disclosure.spec.cjs` usa solo dati sintetici e produce `browser-evidence/ux-qa-02-evidence.json` più screenshot delle superfici. Le observation mantengono la forma UX-QA-01:

`{ id, status, node, expected, observed, evidence }`.

L'explorer deve arrivare alla raccolta evidence anche quando individua difetti di UX; il RED deve avvenire nel passaggio analyzer, non perché il crawler non riesce a navigare. Errori di bootstrap, locator o fixture non sono RED prodotto validi.

## Primo RED atteso

Sulla baseline, PREDEPLOY deve restare verde perché il prodotto non cambia. Browser Qualification deve raggiungere tutte le superfici e fallire nell'analyzer UXPD almeno per:

- `UXPD-001` / `UXPD-002` — Programmazione monolitica;
- `UXPD-003` / `UXPD-004` — UDA con funzioni avanzate simultanee.

I P2 attesi devono comparire nel report ma non essere la causa del blocking result.

## Correzioni del primo ciclo

### Programmazione

La superficie iniziale diventa read-first con sezioni `Profilo`, `Calendario e normativa`, `Organizzazione`. Ogni sezione mostra un riepilogo e un'azione `Modifica`; una sola sezione può essere editata alla volta. Il salvataggio resta sullo stesso `TeachingProfile` e non cambia schema/persistenza.

### UDA

La superficie introduce una view locale `uda | progress | planning | analysis`, default `uda`. `Nuova UDA` e l'elenco/contesto UDA restano nella vista primaria; metriche di avanzamento vanno in `Avanzamento`; Gantt/dipendenze in `Pianificazione`; gap e indicatori in `Analisi`. Nessun calcolo viene rimosso o reinterpretato.

## Non-obiettivi

- Nessun nuovo router framework.
- Nessuna migrazione del vault o del dominio.
- Nessun provider AI/LLM nel runtime.
- Nessun cambiamento ad auth/privacy boundary.
- Nessun auto-merge o deploy.
- Nessuna riscrittura estetica generale del design system.
- I P2 non vengono corretti alla cieca nello stesso ciclo: restano evidenza qualificata finché non ricevono un task dedicato.

## Success criteria

Il primo ciclo è pronto per review soltanto quando:

1. esiste un RED browser causale del contratto UXPD sulla baseline/test-only head;
2. le correzioni P1 rendono `UXPD-001..004`, `UXPD-010`, `UXPD-011` verdi;
3. UX-QA-01 continua a passare senza indebolimenti;
4. PREDEPLOY e Browser Qualification sono verdi sullo stesso exact candidate SHA;
5. i P2 residui sono presenti nel report e dichiarati esplicitamente, non nascosti;
6. merge e deploy restano decisioni umane separate.
