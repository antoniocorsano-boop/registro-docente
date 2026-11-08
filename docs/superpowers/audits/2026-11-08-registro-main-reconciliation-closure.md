# Registro Docente — Chiusura della riconciliazione dei rami storici

**Data di consolidamento:** 8 novembre 2026  
**Baseline autoritativa verificata:** `main@d3faf94d3afc1d7134cf75d3b04a5d6a983fddfe`  
**Natura:** documento di governo, senza modifiche a codice applicativo, Vault, dati personali o distribuzioni.  
**Fonti originarie:** [audit #152](https://github.com/antoniocorsano-boop/registro-docente/pull/152), [S0 INT-02 #141](https://github.com/antoniocorsano-boop/registro-docente/pull/141), [S2 INT-02 #148](https://github.com/antoniocorsano-boop/registro-docente/pull/148).

## 1. Regola di riconciliazione

Il `main` corrente è l'unica base per nuovi incrementi. Un ramo vecchio non va integrato soltanto per ridurre il numero di commit di distanza: l'anzianità cronologica non equivale a numero di conflitti e un `App.tsx` più vecchio può reintrodurre regressioni.

Classificare i contenuti vecchi rispetto al `main` corrente in: A = già identici; B = funzionalità già presente ma evoluta; C = funzionalità mancante; D = evidenza/prova ancora assente; E = rischio di regressione o conflitto. Per C/D aprire un nuovo incremento limitato da `main`, con controlli exact-SHA, revisione indipendente e HPR Android se l'interfaccia cambia. Non trasferire in blocco vecchi router, test con assunzioni superate, schema, invarianti o configurazioni.

**Protezione distribuzioni:** `vercel.json` mantiene `git.deploymentEnabled=false`. Integrazione in `main` e pubblicazione esterna sono operazioni distinte, con autorizzazioni distinte.

## 2. Rami storici sostituiti

| PR storica | Stato sostitutivo autorevole | Decisione di conservazione |
| --- | --- | --- |
| [#116 — INT-01](https://github.com/antoniocorsano-boop/registro-docente/pull/116) | [#137 — INT-01/S1](https://github.com/antoniocorsano-boop/registro-docente/pull/137), integrata al commit `d548adc7e03bf4589ea42059e4ef35b0a3dcf8b1` | #116 chiusa senza merge. Componenti didattici identici in `main`, router storico non da recuperare; conservare evidenze |
| [#117 — REG-NAV-01](https://github.com/antoniocorsano-boop/registro-docente/pull/117) | [#135 — NAV-S1](https://github.com/antoniocorsano-boop/registro-docente/pull/135), integrata al commit `4a165521333e816c91dc5c7df1137eddc153341d` | #117 chiusa senza merge. Memoria dei target già presente; vecchio `App.tsx` sostituito da router più recente |
| [#92 — Docente OS](https://github.com/antoniocorsano-boop/registro-docente/pull/92) | [#154 — A4-R2B/Task7](https://github.com/antoniocorsano-boop/registro-docente/pull/154), integrata al commit `d3faf94d3afc1d7134cf75d3b04a5d6a983fddfe` | #92 chiusa senza merge. Recuperati esclusivamente pannello locale di anteprima e protezioni mancanti, non la vecchia applicazione |
| [#153 — recupero alternativo A4-R2B](https://github.com/antoniocorsano-boop/registro-docente/pull/153) | Stessa funzione già fornita dalla #154, completa di correzione letture concorrenti, 5 gate e HPR Android | #153 da chiudere amministrativamente senza merge, preservandone prove e cronologia |

I successori sono stati qualificati e integrati singolarmente su candidati esatti. **Non** ne consegue che ogni byte o ogni test dei vecchi rami sia stato integrato; ne consegue che i percorsi funzionali previsti sono stati riconciliati e i rami precedenti non sono una base di promozione.

## 3. Distinzione corretta della cronologia di navigazione

La prima versione dell'audit #152 conteneva un divieto troppo ampio: «non introdurre ID alunno in URL o `history.state`». Il codice canonico usa in realtà due contratti diversi:

- **URL:** non contiene identificativi o dati personali degli alunni, voti o contenuti di fonte; non introdurre query string con dati sensibili.
- **`history.state` della scheda alunno:** il router attuale usa il riferimento strutturato `{ classId, tab: 'report', studentId }` tramite `src/navigation/studentReportHistory.ts` e `App.tsx`. Non definirlo inesistente né cambiarlo indirettamente tramite una specifica di audit.
- **Percorsi valutazione specialistica:** applicano la gestione dei target tramite riferimenti/token opachi e controlli dedicati di ritorno; non trasferire i token della PR #117 alle schede alunno.

Ogni modifica del contratto di navigazione richiede analisi privacy e prove Android dedicate, senza esporre nominativi o voti in URL e senza reintrodurre una mappa volatile superata. Questo chiarisce il rilievo P2 aperto sull'audit #152, che non va promosso senza correzione.

## 4. Documenti INT-02 storici: valore residuo

### PR #141 — S0 / piano originario

- Le osservazioni su Biblioteca autorevole, fonte professionale validata, contesto `ProfessionalContextV1`, consenso umano, navigazione senza scritture e Copilota governato rimangono **principi utili**.
- La sezione che propone «S1 come prossimo sviluppo» è **superata**: [#142](https://github.com/antoniocorsano-boop/registro-docente/pull/142) ha già integrato S1.
- Non spostare i vecchi file originali in `main` come piani operativi correnti. Preservarne link e ricevute di revisione nel ramo storico.

### PR #148 — S2 / piano di selezione e provenienza

- **S2a conclusa:** [#149](https://github.com/antoniocorsano-boop/registro-docente/pull/149) integrata al commit `7333f6eb28fd99101e2d243515c994d1faf99c49`, con classe e test espliciti per la condivisione e simulazione, nessun riutilizzo involontario al cambio classe.
- **S2b non autorizzata:** eventuale provenienza durevole in `OnlineTest` richiede una decisione di modello, compatibilità Vault/esportazione/ripristino, validazione delle fonti e privacy. La proposta di `sourceId` opzionale è solo **candidata**.
- **Importazione esiti distinta:** la selezione Padlet non deve diventare requisito o filtro del batch voti. Il vecchio piano segnala un rischio di associazione UDA globale o di uso improprio di `submission.testId` come `udaId`. Occorre audit separato del codice corrente prima di proporre una correzione.
- La seconda versione della PR #148 ha corretto un rilievo P2 che confondeva il consenso alla condivisione con quello all'importazione. Il nuovo documento dei gate aperti conserva questa distinzione.

### PR #152 — audit non ancora attuale

Il rapporto originario documenta il percorso di scoperta e la classificazione A–E. Tuttavia precede le integrazioni #154 e la chiusura di #92 e conserva il rilievo sulla cronologia sopra corretto. Mantenerlo come evidenza storica **senza integrare il vecchio documento invariato**. Questo rapporto lo sostituisce come stato corrente.

## 5. Chiusura governata

- Promuovere soltanto **questo inventario consolidato e il documento dei gate aperti** tramite PR documentale nuova, derivata dal `main` corrente; qualificare le modifiche come documentali.
- Dopo la promozione documentale, chiudere amministrativamente #141, #148, #152 e #153 **senza merge** e annotare i documenti sostitutivi. Non eliminare i rami e non alterare i verbali.
- Il prossimo incremento di prodotto deve avere base `main` aggiornata e un proprio gate; **S2b** e **importazione esiti / UDA** non sono la stessa modifica.
- Nessun esperimento Android richiesto per una sola variazione documentale. Qualsiasi codice/UI futuro richiede una qualificazione nuova e revisione umana mirata.
