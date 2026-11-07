# INT-02 — Piano di sviluppo incrementale (proposta)

**Data:** 7 novembre 2026  
**Stato:** PRE-AUDIT DOCUMENTALE — non autorizza implementazione né merge.  
**Baseline:** `main@d548adc7e03bf4589ea42059e4ef35b0a3dcf8b1`  
**Tracker:** [#140](https://github.com/antoniocorsano-boop/registro-docente/issues/140)  
**Specifica:** [INT-02 design](../specs/2026-11-07-int-02-library-assessment-copilot-design.md).

## Decisione di priorità

**Prima S1 → S2**, perché il collegamento fonte→verifica e le preselezioni arbitrarie dell'editor sono problemi di continuità e autorità. **S3** (generazione assistita) è subordinato ai controlli di classe, fonte e provenienza. **S4** conclude il ciclo e la revisione umana. Un solo incremento qualificabile per volta.

## S0 — Verifica iniziale dei contratti (solo lettura)

Leggere e mantenere invariati i seguenti domini autorevoli:

- `src/library/types.ts`, `libraryState.ts`, `intake.ts`: fonte, classificazione e provenienza;
- `src/library/copilotLaunchContext.ts`, `agentIntentRouting.ts`: autorizzazione dell'intento e passaggio al Copilota;
- `src/context/professionalContext.ts`: contesto professionale CTX-01;
- `src/preparation/preparationRouter.ts`: ingresso Prepara e navigazione;
- `src/components/LibraryView.tsx`, `LibrarySourceCard.tsx`: selezione fonte ed esplicito comando umano;
- `src/components/VerificheOnlineView.tsx`, `src/types.ts`: editor, test/udaId, import, simulazione e risultati;
- `src/App.tsx`: gestori di navigazione e mutazioni persistenti;
- `src/security/*`, `tests/browser/*`: integrità, privacy, navigazione e fixture.

Confrontare anche l'issue [#95](https://github.com/antoniocorsano-boop/registro-docente/issues/95): la UI `LibrarySourceCard` già espone `Classifica come materiale professionale`, quindi distinguere funzionalità presente da eventuale debito UX residuo.

**Evidenza di uscita S0:** inventario delle autorità e dei casi di conflitto aggiornato sul tracker.

## S1 — Biblioteca → Verifiche: passaggio privo di scritture

**Obiettivo:** l'azione esplicita dalla fonte professionale attiva l'editor Verifiche con la classe e l'eventuale UDA giustificate dal contesto, senza scegliere da un elenco per posizione.

### RED

Creare test puri dedicati (nomi proposti):
- `src/library/assessmentHandoff.test.ts`: fonte autorizzata/unica, fonte eliminata, non classificata, personale, classe assente o diversa, UDA ambigua, UDA solo proiettata;
- `src/security/int02AssessmentHandoffContract.test.ts`: nessun testo della fonte, credenziale o studente nell'URL/history; nessun `commitTestsMutation` dall'apertura; transizione protetta;
- test di regressione in `src/security/flow01PreparationRouterContract.test.ts` o test equivalente esistente: nessuna rottura Prepara.

**Atteso RED:** i casi non sono soddisfatti dal comportamento corrente.

### GREEN

- Introdurre un piccolo **risolutore puro di passaggio**, che consuma il contesto CTX-01 e restituisce `ready / requires-choice / unavailable`. Non introdurre un nuovo modello di contesto professionale.
- Aggiungere in Biblioteca un'unica azione esplicita **«Prepara una verifica con questa fonte»** visibile solo nello stato appropriato; selezione confermata, non apertura automatica.
- Trasferire a Verifiche soltanto identificativi sessionali verificabili: `sourceId, classId/className, udaId?`, validandoli nuovamente all'arrivo.
- Presentare l'informazione contestuale in una sezione compatta dell'editor, senza creare una nuova schermata principale.
- Fonte riclassificata/scomparsa o cambio classe → annullamento del passaggio, senza navigazione verso riferimenti scaduti.

**File probabili:** `src/library/assessmentHandoff.ts` (nuovo), `LibrarySourceCard.tsx`, `LibraryView.tsx`, `VerificheOnlineView.tsx`, `App.tsx`.

**Non incluso:** generazione IA, nuovi campi persistenti su `OnlineTest`, collegamento automatico o salvataggio del test.

## S2 — Correggere le preselezioni e definire la provenienza

### RED

Test con classi 3ª A / 3ª B, UDA di entrambe le classi, primo elemento dell'array deliberatamente di classe diversa; verificare:
- apertura Verifiche non seleziona `classes[0]` se diversa dal contesto;
- nuovo test non eredita `udas[0]`;
- import DOCX/ZIP non collega la prima UDA disponibile;
- una UDA assente/ambigua o proiettata in sola lettura non riceve scritture indebite;
- i test preesistenti restano leggibili/modificabili con i collegamenti originari.

### GREEN

- Rimuovere le preselezioni arbitrarie dalle operazioni che possono creare o attribuire test. La scelta del docente deve essere esplicita o derivata da un target univoco validato.
- Non cambiare schema o dati dei test già salvati soltanto per rendere più comoda l'interfaccia.
- **Punto di decisione separato** sul tracciamento permanente della fonte: eventuale campo opzionale su `OnlineTest` richiede prima contratto compatibilità, backup/ripristino, classificazione e Provenienza; non introdurre automaticamente identificativi sensibili.

**File probabili:** `VerificheOnlineView.tsx`, un resolver class/UDA puro, test in `src/security`, nessuna modifica a formule, criteri o import degli esiti.

## S3 — Supporto Copilota per preparare la verifica

**Precondizioni:** S1/S2 qualificate; provenienza esplicita e nessuna selezione arbitraria.

- Mantenere l'unico `LibraryCopilotComposer` e il controllo in `agentIntentRouting.ts`.
- `CREATE_ASSESSMENT` **è oggi `UNSUPPORTED`**: prima di rimuovere tale esito, definire bozza/formato di uscita, anteprima, responsabilità, consenso e revoca.
- Un agente può proporre una bozza, mai registrare autonomamente verifiche, voti o collegamenti di dominio.
- Test della negazione quando fonte non professionale, consenso assente, contesto non autorizzato, attività già scaduta o dati scolastici personali.
- Se manca un esecutore qualificato, mantenere il comando non operativo e la descrizione onesta.

## S4 — Continuità del ciclo di valutazione

Verificare `Prepara → Conduci → Registra → Rivedi` riutilizzando i servizi attuali:
- test e classe corretti nella simulazione/condivisione;
- importazione degli esiti separata da anteprima/materiali e sottoposta a conferma;
- nessuna mutazione di `OnlineSubmission` o voti per il solo cambio schermata;
- revisione e indicatori esistenti preservati.

## Qualificazione di ciascuna parte

1. Implementare RED→GREEN con fixture esclusivamente sintetiche.
2. Verificare invarianti privacy, autorità del dominio, competenze di scrittura, persist/restore e percorsi mobile già integrati: REG-NAV-01, INT-01, Tabellone, Scheda alunno.
3. Eseguire PREDEPLOY Security, Invariants, FLOW-03, HEADER-01 e Browser Qualification, più specifica suite INT-02, sull'**exact SHA**.
4. Revisione indipendente senza rilievi bloccanti, correzioni con nuova verifica.
5. HPR Android sullo stesso SHA, possibilmente con pacchetto Termux locale e dati fittizi: Biblioteca→Verifiche, fonte personale/non classificata, classe diversa, UDA ambigua, Indietro/Avanti, abbandono bozza, consent/review Copilota.
6. Solo dopo HPR positiva, proposta distinta di integrazione in `main`; pubblicazione Vercel esplicitamente separata.

## Divieti della linea

- Nessuna nuova Biblioteca, chat/assistente, archivio parallelo o cruscotto.
- Nessuna generazione o importazione autonoma di valutazioni.
- Nessun invio remoto di dati personali o classificazioni implicite.
- Nessuna trasformazione delle UDA Docente OS read-only in entità modificabili del Registro.
- Nessun accorpamento preventivo con LSM-02 o MOBILE-01.
- Nessun merge o deploy in questa PR documentale.

## Stato attuale e decisione successiva

**Documenti proposti, nessuna funzione modificata.** Il passo successivo, dopo riesame della proposta, è limitato a **S1 (passaggio Biblioteca → Verifiche)** e al primo gruppo di test RED. Non avviare S2/S3/S4 nello stesso commit.
