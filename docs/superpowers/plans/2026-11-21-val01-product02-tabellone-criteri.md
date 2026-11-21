# VAL-01/PRODUCT-02 — Registrazione esplicita per criterio dal Tabellone

**Data decisione:** 21 novembre 2026.
**Origine:** chat Registro Docente «Okay, prossimo sviluppo», in continuità con la verifica finale della PR #386.
**Base qualificata:** [PR #386](https://github.com/antoniocorsano-boop/registro-docente/pull/386) exact `187d1e306da942fa4d5d27206384cd66421d2eeb`, 9/9 workflow SUCCESS, comprese 71/71 prove Chromium al secondo tentativo, 155 invarianti.
**Ramo incremento:** `feat/val01-product02-daily-criterion-recording`, base esatta PR #386 (non `main`).
**Governance:** [#104](https://github.com/antoniocorsano-boop/registro-docente/issues/104), [#231](https://github.com/antoniocorsano-boop/registro-docente/issues/231).
**Perimetro:** sviluppo Web e Android privato senza distribuzione; R1/R2/R3 non sono prerequisiti di sviluppo.

## Risultato concreto

Il Tabellone giornaliero, senza alterare le colonne voto e comportamento, contiene un pannello compatto «Rileva evidenza per criterio». Il docente:
1. Apre volontariamente il pannello, che non entra nel percorso rapido del voto.
2. Seleziona **una prova già dichiarata svolta e verificata** nel documento valutativo attuale.
3. Seleziona un **criterio confermato** appartenente a quella revisione della prova.
4. Sceglie **l'alunno** e lo **stato**: osservato, non osservato o non pertinente. L'assenza di rilevazione non viene trasformata automaticamente in uno stato.
5. Se osservato, descrive **fatto realmente osservato** e **metodo**; la tipologia di evidenza deve essere selezionata dal docente, senza convertire un voto in livello.
6. Esamina la proposta, quindi conferma esplicitamente il salvataggio cifrato.
7. Solo dopo commit durevole e ricevuta verificata vede conferma; la nuova rilevazione compare nella Scheda alunno perché entrambe le viste condividono l'archivio locale.

## Contratti riutilizzati

- `assessmentEvidence.ts`: modello validato e revisione confermata per prova, obiettivo, criterio, rubrica e rilevazione.
- `assessmentArchive.ts`: validazione dell'archivio facoltativo indipendente e dei riferimenti all'elenco di alunni. Nessuna creazione o migrazione retroattiva di documenti.
- `individualObservation.ts`: `previewIndividualObservation` rifiuta la revisione superata, l'evento duplicato, il contenuto non valido e il cambio del criterio.
- `assessmentEvidenceMutation.ts`: `deriveConfirmedEvidenceMutation` riaccerta il grafo **al momento della scrittura** e non applica conferme scadute.
- `App.tsx`: `commitAppDataMutation` gestisce l'unica coda di scrittura, `secureStorage.saveAppDataAndMeta`, il contatore delle variazioni da salvare e la pubblicazione dello stato **solo dopo** persistenza; non è stato creato un secondo archivio.
- `DailyMatrixWorkspace.tsx`: unifica le bozze e l'operazione in sospeso con il blocco della navigazione; cambia data, prova o classe solo rispettando la conferma o rinuncia della bozza.
- `StudentReportView.tsx`: il pannello di consultazione PR #386 legge già dallo stesso campo locale `assessmentEvidenceV1`.

## Condizioni effettive per l'uso

Una prova con criteri **deve già esistere**, essere stata confermata come svolta e appartenere alla stessa classe, anno e disciplina selezionati dal docente. Il pannello **non crea** una prova dal voto né la finge; se la fonte manca indica «Nessuna prova con criteri predisposta» e non permette la registrazione. L'introduzione del **flusso di predisposizione di una prova con criteri**, tramite pianificazione didattica/UDA e consenso docente, resta un successivo incremento necessario per un prodotto utilizzabile da archivio completamente vuoto. Evitare di chiamare questo passaggio già completato.

Per contesti di archivio errati, sconosciuti o non corrispondenti, rifiutare con messaggio non tecnico senza mostrare evidenze. Durante una scrittura in sospeso nessun voto o comportamento concomitante deve aggirare la coda e nessuna schermata può presentare un successo anticipato. Se la persistenza fallisce, mantenere la proposta riesaminabile, avvisare sul possibile esito incerto e **non riprovare automaticamente**.

## Verifiche richieste e registrazione

- Nove prove di dominio e collegamento nel file `src/security/val01Product02DailyCriterionRecording.test.ts` coprono contesto, assenza, rifiuti, scrittura confermata, replay, preservazione dei voti e rollback di un persist fallito.
- Il contratto `val01OperationalEvidenceBoundary.test.ts` viene aggiornato affinché distingua l'attivazione del nuovo percorso reale dal vecchio laboratorio isolato, **senza** permettere l'ingresso in produzione delle fixture e delle diagnostiche.
- Nuova invariante `VAL-01-PRODUCT02-I01`, registro 155→156, enunciati precedenti intatti.
- Qualificazione CI e regressioni Chromium / Android da attribuire al solo exact SHA finale di questo incremento. Il successo dei test di dominio non sostituisce un collaudo di UI 320/390px e testo 200% con un archivio già qualificato.
- Nessun merge, firma, installazione, rilascio, dati reali di studenti, rete o servizio a pagamento.

**Prossimo passaggio di prodotto dopo la qualificazione:** rendere disponibile dal Tabellone la predisposizione manuale e confermata di prova, obiettivi e criteri, riutilizzando UDA/curricolo senza estrarre livelli dai voti.
