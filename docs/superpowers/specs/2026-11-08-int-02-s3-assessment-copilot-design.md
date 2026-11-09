# INT-02/S3 — Copilota «Crea verifica»: proposta controllata e adozione esplicita

**Stato:** S3a INTEGRATA (PR #162); S3b INTEGRATA (PR #163); S3c-01 contratto di trasferimento INTEGRATO (PR #164); S3c-02 interfaccia Copilota→anteprima→editor su PR #165, in qualificazione, senza distribuzione; S3d revisione umana dell'esperienza ancora aperta.  
**Baseline applicativa:** `main@9b940f94f8029d4cfcec910f42a1347b45752d77` (S2b, S3a, S3b e S3c-01 integrate; PREDEPLOY post-merge #42564434718 PASS; nessun deploy).  
**Governance:** [Roadmap #104](https://github.com/antoniocorsano-boop/registro-docente/issues/104) · [INT-02 #140](https://github.com/antoniocorsano-boop/registro-docente/issues/140) · [S2b #160](https://github.com/antoniocorsano-boop/registro-docente/pull/160).

## 1. Ricognizione del codice già presente

| Dominio | Situazione osservata su main | Implicazione S3 |
| --- | --- | --- |
| Riconoscimento intento | `src/library/agentIntent.ts` prevede `CREATE_ASSESSMENT`; `agentIntentRouting.ts` lo restituisce **UNSUPPORTED** e un test lo esige espressamente | Non attivare la nuova azione finché mancano generazione, interfaccia, controllo classe e revisione |
| Avvio dal docente | `teacherFirstRequest.ts` classifica `prepare/review/link/material`, non la richiesta specifica di verifica | Aggiungere una classificazione distinta solo con percorso pronto |
| Copilota | Superficie unica `LibraryCopilotComposer`, proposta `LibraryProposalPanel`; creazione remota già con consenso, bilancio IA e fonte professionale | Riutilizzare la superficie e i controlli, non duplicare la chat o aggirare la conferma remota |
| Produzione remota | `teachingProposal.ts` / `libraryProposalRoute.ts` hanno `action: prepare-activity`, `kind: activity`, domande **testuali** senza opzioni/soluzioni | **Non** riqualificare un'attività come verifica. Nuova uscita strutturata con validatore distinto |
| Editor verifiche | `VerificheOnlineView` supporta quesiti, opzioni, risposta corretta, spiegazione; salvataggio esplicito via `onSaveNewTest` | Ricevere una **bozza in sessione** nei campi già esistenti, mai una verifica già salvata |
| Confini canonici | `App.handleSaveNewTest` ricontrolla UDA; `prepareAssessmentTestForCommit` verifica provenienza S2b dentro la mutazione serializzata | Non introdurre vie di scrittura alternative o attribuzioni implicite a UDA / fonte |
| Importazione voti | IMPORT-01 ha percorso e autorizzazioni separati | Nessun contatto con esiti, consegne, voti o pagine studente |

## 2. Invarianti di prodotto

1. Il Copilota **propone**, il docente **controlla, modifica e decide se salvare**. Nessun autosalvataggio, pubblicazione, attribuzione di punteggi, creazione UDA o valutazione a seguito della generazione.
2. Una proposta AI non è una soluzione certificata: correttezza delle risposte e spiegazioni richiedono revisione umana. Nessuna automatica asserzione «verifica corretta».
3. Per una generazione con fonte, la fonte deve essere univoca, pronta e classificata `teacher-professional`; rivalutazione dopo eventuale cambio/revoca. Fonte facoltativa per richieste basate su un obiettivo esplicito **solo dopo** aver definito un canale autorizzato senza fonte.
4. La classe è scelta in modo esplicito o determinata univocamente dal contesto attivo confermato. Mai il primo elemento dell'elenco; UDA **facoltativa**, mai preselezionata da un risultato del provider.
5. Per l'eventuale chiamata remota si richiede il consenso già previsto per il trasferimento professionale, una richiesta specifica e il controllo del bilancio. Non trasmettere nomi o dati alunni, archivi di voti, interi dati di classe o materiale non professionale.
6. Il modello non restituisce `id`, `classId`, `udaId`, `sourceId`, `provenance`, URL o permessi; qualsiasi campo aggiuntivo è respinto dal validatore. Il riferimento fonte S2b resta opzionale e necessita **conferma distinta** nell'editor al salvataggio.
7. La bozza esiste in sessione; chiusura/cambio classe/navigazione Android rispettano i controlli di modifiche non salvate, senza perdita silenziosa di testo.
8. Copilota e Verifiche condividono la stessa identità di sessione: la variazione della classe o la scomparsa della fonte invalidano il passaggio prima di popolare l'editor.

## 3. Contratto S3a — bozza strutturata

`AssessmentDraftV1` è un oggetto **non persistente**:

```ts
{
  schemaVersion: 1,
  kind: 'assessment-draft',
  title: string,
  description: string,
  questions: [{
    type: 'multiple_choice' | 'true_false',
    q: string,
    options: string[],
    correct: number,
    explanation: string
  }]
}
```

Limiti iniziali: 1–12 quesiti; 2–6 opzioni distinte; indice intero nell'intervallo; spiegazione non vuota; per vero/falso esattamente «Vero», «Falso». È esclusa in questa prima versione la risposta breve aperta, che richiederebbe un contratto separato di correzione. `parseAssessmentDraftV1` respinge campi imprevisti e normalizza le stringhe senza mutare l'input. `toAssessmentEditorPrefill` restituisce solo `title`, `description`, `questions`, senza ID o scritture.

**Attenzione:** S3a realizza il formato e il passaggio puro ai campi editor; **non** abilita da solo l'intento o la generazione né rende possibile creare una verifica tramite Copilota.

## 4. S3b — generazione remota governata (PR #163, NON integrata)

**Contratto iniziale volutamente ristretto:** generazione di una **bozza non persistente** soltanto da una fonte Biblioteca testuale professionale, pronta e selezionata esplicitamente. Nessun contenuto binario, immagine, documento personale, generazione senza fonte o creazione automatica di UDA. L'obiettivo e la classe devono essere indicati e confermati.

- `src/library/assessmentGeneration.ts`: costruzione della richiesta `generate-assessment-draft` con fonte pronta, `teacher-professional`, classe attiva confermata, obiettivo, consenso esplicito e identificativo di attività budget `assessment:class:...` distinto dai codici UDA. La proiezione trasmessa **non contiene sourceId, UDA, alunni o valutazioni**.
- `src/server/assessmentGenerationRoute.ts`: gestore separato, con rifiuto restrittivo di campi imprevisti, policy SEC di egress, segnali di dati personali riconoscibili, misurazione dimensioni, `resolvePrepareBudget`, richiesta duplicata simultanea negata, singola chiamata con scadenza e annullamento, gestione sicura degli errori e convalida della risposta tramite `parseAssessmentDraftV1`. Ricevuta limitata a metadati tecnici e budget.
- `src/server/geminiAssessmentGenerationProvider.ts`: provider con JSON vincolato allo schema, isolamento esplicito della fonte come dato non attendibile, nessuno strumento disponibile e nessuna istruzione di salvataggio o valutazione; modulo separato dal generatore di attività `prepare-activity`.
- `server.ts`: coppia di endpoint `GET /api/copilot/assessment-draft/provider` e `POST /api/copilot/assessment-draft` con body ridotto, controller di annullamento e provider costruito una sola volta sul server. API disponibile nel codice, **non collegata alla UI**.
- `src/services/assessmentGenerationService.ts`: una sola POST, senza tentativi automatici, con convalida dell'output e **rivalidazione della fonte e della classe lette dal Vault client** prima di restituire la proposta.

**Confine di fiducia cruciale:** il server non legge lo stato del Vault cifrato nel dispositivo del docente e non può attestare autonomamente che una fonte dichiarata pronta sia ancora tale. L'applicazione client deve pertanto effettuare la selezione autorevole della fonte, la conferma della classe, il consenso e le verifiche prima/dopo l'invio; l'integrazione UI S3c sarà qualificata anche contro cambiamenti concorrenti del contesto. La semplice esistenza dell'endpoint NON autorizza nuove operazioni nell'app.

**Gate:** test RED→GREEN, privacy, limiti IA, provider mock, timeout, deduplicazione, regressione `prepare-activity`, cinque qualifiche exact SHA e Codex prima di dichiarare l'incremento qualificato.

## 5. S3c — trasferimento controllato e composizione nell'editor

**S3c-01 (PR #164, in qualificazione):** `src/library/assessmentEditorTransfer.ts` espone una proiezione **solo in memoria** `AssessmentEditorTransferV1` e `prepareAssessmentEditorTransfer`. Il trasferimento richiede l'approvazione esplicita del docente, ID della classe originaria catturato nella sessione prima della generazione e confrontato con ID e nome della classe attiva univoci (anche contro eliminazione e ricreazione con lo stesso nome), identità della fonte originaria (non quella di una sostituta con contenuto uguale), fonte ancora `ready` e `teacher-professional`, e riutilizza il validatore S3a per consentire soltanto titolo, descrizione e quesiti. `checkAssessmentEditorTransferContext` ricontrolla il contesto dopo la navigazione. `canAcceptAssessmentEditorTransfer` vieta di sovrascrivere un editor con modifiche non salvate o salvataggio pendente.

L'oggetto di trasferimento contiene i riferimenti locali alla classe e alla fonte **solo per controllare il passaggio**, mai come assegnazione di UDA o provenienza canonica. Non contiene test ID, voti, consegne, salvataggio o pubblicazione. Nessun canale di persistenza viene aggiunto. La sola funzione pura non rende attivo `CREATE_ASSESSMENT`.

**S3c-02 — interfaccia realizzata su PR #165, ancora in qualificazione:**

1. Richiesta «Crea verifica» nel Copilota esistente; classe e obiettivo visibili, fonte testuale professionale selezionata come prevede S3b. Non assumere una classe o fonte dall'ordine dell'elenco.
2. Proposta leggibile prima dell'adozione con numero dei quesiti, risposte e spiegazioni e avvertenza: correttezza da controllare dal docente.
3. Pulsante esplicito **«Apri come bozza in Verifiche»**, con nuova verifica non salvata e nuovo controllo fonte/classe prima della consegna dei campi `AssessmentEditorPrefill` a `VerificheOnlineView`. Mai scavalcare il controllo delle bozze sporche.
4. Editor consente modifiche e annullamento; nessuna UDA assegnata automaticamente; l'eventuale provenienza S2b richiede checkbox autonoma. Il comportamento Android «Indietro» resta governato dai controlli di navigazione esistenti.
5. Solo il comando **«Salva Verifica»** del docente invoca il percorso canonico `handleSaveNewTest`; prima di allora il numero di verifiche nel Vault resta invariato.

**Controlli aggiuntivi richiesti dalla revisione Codex/Chromium:** al termine della conferma «Apri come bozza in Verifiche», chiudere **l'intera superficie del Copilota**, non solo il pannello interno: il primo browser test sulla PR #165 ha individuato un dialogo mobile ancora aperto sopra l'editor. Imporre un **termine massimo lato browser** per una richiesta HTTP sospesa, con **«Annulla richiesta»** e ripristino della possibilità di operare, senza re-invio implicito e richiedendo nuovo consenso. Nella prova browser con provider simulato verificare un annullamento effettivo e il passaggio riuscito al secondo invio esplicitamente autorizzato.

**Vincolo S3c-02:** nessuna promozione dalla sola qualificazione del contratto S3c-01; completare tutti i cinque gate sul commit esatto, revisione indipendente e revisione umana dell'esperienza prima di un'eventuale distribuzione. La PR rimane in bozza fino alla risoluzione dei rilievi.

## 6. Qualificazione e condizioni di avanzamento

- **S3a:** RED test-only causale → GREEN su parser/proiezione; typecheck/build, PREDEPLOY, FLOW-03 e invarianti del candidato, revisione Codex. Nessun HPR richiesto finché non cambia UI.
- **S3b:** test avversariali provider/route, consenso, privacy, budget, timeout, regressione PREPARE e nessuna scrittura.
- **S3c:** Chromium mobile 320/390, scorrimento corretto, bozze modificate/back gesture/cambio classe, conferma fonte; prova che nessuna verifica sia salvata prima del comando esplicito. 5/5 gate, revisione indipendente e HPR visiva umana prima di promozione.
- **S3d/S4:** riprendere continuità didattica soltanto dopo l'integrazione governata di S3.

**Vincolo operativo:** PR #161, #162, #163 e #164 sono integrate in `main`; la PR #165 sviluppa la nuova interfaccia S3c-02 in un ramo separato, non ancora integrato. La funzione `CREATE_ASSESSMENT` è attiva soltanto come percorso guidato in tale ramo, non nell'applicazione distribuita. **Nessuna fusione o distribuzione Vercel deriva automaticamente da questa specifica.**
