# VAL-01/PRODUCT-01 — Evidenze per criterio nella Scheda alunno

**Data:** 21 novembre 2026  
**Stato:** sviluppo incrementale, qualificazione del candidato da acquisire.  
**Governance:** [#104](https://github.com/antoniocorsano-boop/registro-docente/issues/104), [#231](https://github.com/antoniocorsano-boop/registro-docente/issues/231), [#210](https://github.com/antoniocorsano-boop/registro-docente/issues/210).  
**Base esatta:** M1-C qualificata `d14001bc80f5514fedf7fac27d0cf2f0f114061f`, PR #385, 8/8 workflow PASS.  
**Ramo dedicato:** `feat/val01-student-confirmed-evidence`; richiesta di modifica in bozza, rivolta al ramo M1-C (non al main).

## Obiettivo di prodotto

Rendere effettivamente consultabile nella Scheda alunno parte delle evidenze **già registrate e confermate** per prova e criterio, senza creare nuovi giudizi, voti o livelli di competenza. Questo primo incremento è una **lettura protetta**; non propone ancora il flusso di registrazione per criterio dal Tabellone. È distinto dalla Restituzione verso le famiglie e non ne modifica l'esportazione.

## Superfici effettive riutilizzate

- `StudentReportView.tsx`: esiste il percorso mobile Essenziale / Dossier / Restituzione e la scheda individuale del docente; l'incremento aggiunge un solo pannello comprimibile nel Dossier, utilizzando la medesima logica di riservatezza e senza alterare navigazione o voto.
- `assessmentArchive.ts`: archivio facoltativo per classe con documenti e legami, validato senza inferenza o riscritture.
- `assessmentEvidenceProjection.ts`: proietta esclusivamente evidenze attive di uno studente, escludendo ritirate e revisioni superate; mantiene distinti gli stati.
- `studentCriterionReadModel.ts`: richiede anno e disciplina dall'attuale configurazione del docente, non assume come autoritativa la dichiarazione presente nell'archivio importato.
- `StudentCriterionEvidencePanel.tsx`: mostra solo data, titolo prova, criterio e stato; non visualizza nomi di altri studenti, fatti privati integrali né un livello calcolato. Con riservatezza disattivata, non mostra le evidenze.

## Criteri e confini

1. Archivio facoltativo assente: presentare **nessuna evidenza per criterio registrata**, senza dedurre risultati dai voti.
2. Archivio presente, ma soggetto/anno/classe/elenco studenti discordanti: schermare i dati e dichiarare **non verificabile**; nessuna correzione silenziosa dei codici o uso di dati da altre classi.
3. Proiezione per studente: sole rilevazioni confermate; osservato, non osservato, non pertinente e assenza restano distinti; ritiri e revisioni superate non ricompaiono.
4. La conferma da parte del docente dell'osservazione non coincide con certificazione ufficiale delle competenze; niente automatismi da medie, comportamento o rendimento.
5. Dati soltanto nel vault locale dell'app; nessuna nuova rete, esportazione, modifica dell'archivio, provider IA, nuova dipendenza o attivazione del recupero.
6. Inizialmente possono mancare osservazioni qualificate nel prodotto utilizzato dal docente: la nuova superficie non fabbrica dati e non dimostra l'esistenza di un flusso di inserimento. Il successivo incremento dovrà riguardare la **registrazione esplicita di evidenze per criterio** nel Tabellone, con consenso e scrittura durevole.
7. Verificare controllo dei tipi, contratti, regressioni del dossier, visualizzazione mobile 320/390px e testo 200% prima dell'integrazione di sviluppo. Il percorso generale dei 154 invarianti M1-C non viene degradato.

## Qualificazione proposta

Nove prove in `src/security/val01StudentCriterionReadModel.test.ts`, incluse due di rendering React sul pannello effettivo: isolamento studente, corrispondenza del contesto, stati distinti, assenza senza inferenza da voti, rifiuto per archivio discordante, ritiro, collegamento della vista e sicurezza della riservatezza.

**Candidato attuale:** prova automatica da eseguire sul commit finale, comprendendo controllo dei tipi, rendering React, regressioni del navigatore e dati sintetici. La qualifica appartiene all'ultimo commit della PR di prodotto, non viene ereditata dagli 8/8 PASS di M1-C. Esito completo da registrare dopo GitHub Actions.

## Separazione sviluppo / rilascio

R1, R2 e R3 sono differiti alla fase di accettazione/distribuzione secondo #104: **non limitano questo sviluppo**. Si applicano invece i normali controlli di sicurezza dei dati. Nessuna installazione sul telefono, firma, pubblicazione, integrazione automatica in `main` o uso di dati di studenti reali da questo intervento.
