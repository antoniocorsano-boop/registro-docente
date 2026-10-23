# MEM-QUAL-01 — Project Memory Protocol + stable Browser Qualification design

## Intent
Trasformare l'apprendimento operativo del progetto in una memoria canonica, versionabile e consultabile dagli agenti, e sostituire i browser gate ad hoc con una qualificazione riproducibile su GitHub-hosted ephemeral runner legata all'exact candidate SHA.

## Evidence
Alla baseline `main@023a6a036c4a43b71fcd408f6ecda1d92bf7a787` esistono `docs/superpowers/{specs,plans}` e workflow PREDEPLOY/SEC-0…SEC-3, ma non esistono `docs/memory/`, un protocollo di lesson learned o un browser qualification workflow stabile. Il runtime di produzione serve `dist/` tramite `server.ts`; le dipendenze applicative sono già installabili con `bun install --frozen-lockfile`.

## Goals
- Il repository diventa la fonte canonica della memoria operativa del progetto.
- Ogni agente riceve un punto d'ingresso esplicito che impone la lettura di `docs/memory/README.md` prima del lavoro significativo.
- Separare regole stabili, ricette di strumenti, decisioni durevoli e lesson learned episodiche.
- Standardizzare una Memory Capsule con stato `ACTIVE`, `SUPERSEDED` o `REVALIDATE`.
- Promuovere una lesson learned a regola stabile solo quando cambia stabilmente il modo di lavorare; le regole obsolete non vengono cancellate silenziosamente.
- Aggiungere un Browser Qualification su Chromium reale in runner GitHub effimero, con checkout dell'exact candidate SHA, dipendenze applicative congelate, build di produzione, server reale e Playwright pinning esplicito.
- Conservare evidenze diagnostiche riutilizzabili senza dati reali o credenziali.

## Non-goals
- Nessuna memoria automatica basata su dati utente o conversazioni private.
- Nessun obbligo di aggiornare `LESSONS_LEARNED.md` per micro-fix ordinari.
- Nessun auto-merge, deploy o pubblicazione.
- Nessuna modifica al comportamento applicativo, alla persistenza o ai dati canonici.
- Nessuna certificazione browser affidata a sandbox conversazionali con risorse non garantite.

## Approaches considered
1. Solo memoria ChatGPT: respinto come fonte canonica perché non è versionata nel repository e non garantisce conservazione letterale di una voce.
2. Solo documenti Markdown passivi: respinto perché versionabile ma facilmente ignorabile dagli agenti.
3. Memoria ibrida agentica: scelto. Repository come autorità, `AGENTS.md` come punto di ingresso operativo, Memory Capsule come meccanismo di apprendimento continuo.

Per il browser gate:
1. Browser manuale o sandbox conversazionale: mantenuto solo come diagnostica, non come certificazione canonica.
2. GitHub-hosted ephemeral runner + Playwright: scelto per riproducibilità, isolamento e legame verificabile all'exact SHA.

## Canonical memory structure
- `docs/memory/README.md`: indice e protocollo di lettura/scrittura.
- `docs/memory/OPERATING_RULES.md`: regole stabili e generalizzabili.
- `docs/memory/TOOL_RECIPES.md`: sequenze di strumenti già collaudate.
- `docs/memory/LESSONS_LEARNED.md`: ledger append-only delle Memory Capsule.
- `docs/memory/DECISIONS.md`: decisioni durevoli, stato e sostituzioni.
- `AGENTS.md`: obbligo operativo di consultare la memoria prima dei cicli significativi e di aggiornare la memoria solo quando il ciclo produce conoscenza riutilizzabile.

## Memory Capsule contract
Ogni capsule significativa contiene almeno:
- ciclo e data;
- exact SHA o riferimento equivalente;
- obiettivo;
- cosa ha funzionato;
- cosa è fallito;
- causa reale;
- regola generalizzabile;
- recipe nuova o aggiornata;
- cosa non ripetere;
- evidenza;
- stato: `ACTIVE`, `SUPERSEDED`, `REVALIDATE`;
- eventuale decisione candidata alla promozione in memoria stabile.

La prima lesson learned canonica è: un browser gate canonico non deve dipendere da una sandbox conversazionale con disponibilità non garantita; la certificazione usa un runner GitHub effimero e Playwright sull'exact candidate, mentre il browser manuale resta uno strumento diagnostico.

## Stable Browser Qualification contract
- Trigger: `pull_request` verso `main` e `workflow_dispatch`.
- Permessi minimi: `contents: read`.
- Runner effimero: `ubuntu-22.04`.
- Candidate SHA: `github.event.pull_request.head.sha` per PR, `github.sha` negli altri casi.
- `actions/checkout` riceve esplicitamente il candidate SHA; un gate successivo verifica `git rev-parse HEAD == CANDIDATE_SHA`.
- Dipendenze applicative: `bun install --frozen-lockfile`.
- Build: `bun run build`.
- Runtime: `NODE_ENV=production PORT=4173 bun run start` con readiness HTTP prima del browser test.
- Browser toolchain: `@playwright/test@1.64.1` installato in una directory temporanea separata dal grafo applicativo; nessuna modifica runtime al lockfile del prodotto.
- Browser: Chromium installato dal Playwright pinning indicato sopra.
- Smoke contract: HTTP 200, titolo Registro Docente, `#root` visibile e non vuoto, assenza di page error non gestiti.
- Evidence: screenshot della home, JSON con candidate SHA e risultato, log server e report/test-results Playwright caricati come artifact con `if: always()`.
- Dati: nessun dato studente reale, nessuna credenziale, nessun secret richiesto.

## Failure semantics
- Un mismatch SHA è FAIL immediato.
- Installazione/build/readiness/browser failure è FAIL, mai degradato a warning.
- Gli artifact diagnostici vengono tentati anche in caso di FAIL.
- Il gate non dichiara PASS prima del completamento del browser smoke sul candidate esatto.

## Process integration
Per integrazioni, incidenti, failure importanti, cambi di architettura/processo o scoperte riutilizzabili, la chiusura del ciclo è:

`engineering evidence → review → lesson learned → eventuale promozione a operating rule`

Per micro-fix senza apprendimento generalizzabile non è richiesto aggiornare la memoria episodica.

## Qualification
- Self-review di specifica e piano.
- RED strutturale: il branch iniziale non contiene `docs/memory/`, `AGENTS.md` né il nuovo workflow Browser Qualification.
- GREEN strutturale: tutti gli artefatti previsti esistono e il workflow è sintatticamente valido.
- GitHub Actions Browser Qualification sul branch/PR, legato all'exact head.
- PREDEPLOY esistente deve restare verde.
- Review indipendente finale prima di qualunque merge.
- Nessun merge/deploy automatico.
