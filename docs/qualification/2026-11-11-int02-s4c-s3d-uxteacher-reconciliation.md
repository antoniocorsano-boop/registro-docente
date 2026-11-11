# INT-02 — Riconciliazione finale S4c/S3d sulla UX approvata

**Data:** 11 novembre 2026  
**Baseline di origine:** `main@11a4faa555383c5049718ec192313f420629e22f` (PR #197 UX-TEACHER-01 integrata).  
**Autorità:** [roadmap #104](https://github.com/antoniocorsano-boop/registro-docente/issues/104) · [INT-02 #140](https://github.com/antoniocorsano-boop/registro-docente/issues/140) · [S4c #191](https://github.com/antoniocorsano-boop/registro-docente/issues/191) · [S3d #192](https://github.com/antoniocorsano-boop/registro-docente/issues/192).  
**Rami storici di sola prova:** [#193](https://github.com/antoniocorsano-boop/registro-docente/pull/193), [#195](https://github.com/antoniocorsano-boop/registro-docente/pull/195). Riconciliazione delle sole differenze necessarie, senza integrare i rami divergenti.  
**Disposizione:** `DRAFT / TEST-ONLY / NO MERGE / NO DEPLOY`; `vercel.json` conserva `git.deploymentEnabled=false`.

## Contributo S4c

Ripristinati *senza modifiche applicative* lo scenario completo Chromium `tests/browser/int-02-s4-teacher-cycle.spec.cjs`, il contratto di continuità `src/security/int02S4TeacherCycleContinuity.test.ts`, il relativo invariante e l'esecuzione nella qualifica browser.

Lo scenario sintetico copre: **Oggi → Prepara → Verifiche** (scelta esplicita e salvataggio) → condivisione con classe e verifica scelte → consegna fittizia → **Registra** (scelta esplicita di classe/test/periodo/UDA; annullamento prima della scrittura, successiva conferma) → **Rivedi / Storico** → reimportazione immutata. Provider esterno non invocato. Le prove precedenti, 33/33 e 5/5, restano *storiche sul loro exact-SHA*; soltanto una nuova esecuzione sul candidato qui prodotto può attestare questa baseline.

La prova S4c non sostituisce il percorso Copilota → bozza modificabile; i due attraversamenti restano indipendenti.

## Contributo S3d dopo UX-TEACHER-01

La [PR #197](https://github.com/antoniocorsano-boop/registro-docente/pull/197), già integrata, ha sostituito la precedente interfaccia: un'azione primaria per stadio, consenso per tentativo, proposta esplicita e revisione focalizzata non salvata. Il test Chromium corrente `tests/browser/int-02-s3c02-copilot-assessment.spec.cjs` dispone **già di sei immagini** a 390×844 e 320×700:

| Fase | Immagini esistenti nella prova |
|---|---|
| Preparazione/consenso | `ux-teacher-01-prepara-390.png`, `ux-teacher-01-prepara-320.png` |
| Proposta non salvata | `ux-teacher-01-proposta-390.png`, `ux-teacher-01-proposta-320.png` |
| Editor di revisione | `ux-teacher-01-editor-390.png`, `ux-teacher-01-editor-320.png` |

Questa riconciliazione aggiunge soltanto `ux-teacher-01-guard-390.png`, acquisita con la guardia «Modifiche non salvate» effettivamente visibile, e `ux-teacher-01-synthetic-review.json`, con SHA del candidato, sette nomi delle immagini e natura simulata dell'intero scenario. Tutti i dati di classe, fonte e verifica sono fittizi; le richieste al provider HTTP sono intercettate, senza credenziali né trasmissione di dati personali. **Non si ripristinano le 52 righe della #195**, che catturavano i controlli della vecchia interfaccia e duplicavano parte delle prove della #197.

Le immagini sono evidenze automatizzate, **non una revisione umana Android**. Il test verifica anche il contenuto e la modificabilità della bozza, l'assenza di UDA selezionata, l'uscita protetta e l'assenza di salvataggi impliciti.

## Qualificazione e condizioni non risolte

- **S4c / S3d-01 (prove):** annotare solo l'esito dei controlli sul commit esatto di questo ramo, la nuova esecuzione Chromium e il relativo artefatto verificato. Non trasferire automaticamente gli esiti PASS dei rami storici.
- **S3d-02 (Android):** `PENDING / BLOCKED` finché non sia disponibile un ambiente isolato su un commit identificato, accessibile allo smartphone e chiaramente marcato «servizio simulato». Evitare ulteriori collaudi ripetuti senza questa precondizione.
- **S3d-03 (servizio remoto reale):** `NOT VERIFIED`. Il rilevamento della disponibilità non certifica una generazione `POST` reale. Eventuali verifiche con backend e credenziale **solo lato server** richiedono autorizzazione distinta, nessun segreto in chat, dati fittizi e controlli di privacy/quota/timeout.
- **Revisione indipendente:** esaminare il candidato esatto dopo i controlli; la sola creazione di questa PR non equivale ad approvazione.
- **Integrazione e distribuzione:** vietate in automatico. `main` deve restare invariato finché non arriva un'autorizzazione specifica. Nessun ambiente Vercel viene riattivato.

## Esito da registrare

Alla fine delle qualifiche, aggiornare [#191](https://github.com/antoniocorsano-boop/registro-docente/issues/191), [#192](https://github.com/antoniocorsano-boop/registro-docente/issues/192), [#140](https://github.com/antoniocorsano-boop/registro-docente/issues/140) e [#104](https://github.com/antoniocorsano-boop/registro-docente/issues/104) distinguendo: **prove tecniche integrate**, **revisione Android non ancora svolta**, **servizio reale non verificato**, **nessuna versione distribuita**.
