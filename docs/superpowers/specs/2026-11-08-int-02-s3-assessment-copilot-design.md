# INT-02/S3 — Copilota «Crea verifica»: proposta controllata e adozione esplicita

**Stato:** S3a (contratto bozza) in realizzazione su PR #162; S3b (generazione), S3c (passaggio all'editor) e S3d (qualificazione di esperienza) NON avviate.  
**Baseline applicativa:** `main@e6b518656efbfaeeaa85e04512fa149ef48bf91a` (S2b integrata, nessun deploy).  
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

## 4. S3b — generazione governata, da implementare

- Definire endpoint/azione specifica `generate-assessment-draft` con input minimizzato, autorizzazione separata e output strutturato; non modificare il significato di `prepare-activity`.
- Riutilizzare infrastruttura esistente di provider, timeout, bilancio, errori leggibili, controllo del consenso, rifiuto del materiale non professionale e isolamento del contenuto sorgente come **dati non fidati**.
- Riesaminare il contesto classe/fonte **prima della richiesta** e **prima della consegna**; in caso di cambio, invalidare la bozza e non consegnarla all'editor.
- Contratti negativi: fonte cancellata o riclassificata, risposta malformata, risposta con IDs/metadata di autorità, opzioni impossibili, provider non configurato, consenso negato, richiesta duplicata, perdita di rete. Nessuna scrittura nel Vault.

## 5. S3c — composizione nell'editor, da implementare

1. Richiesta «Crea verifica» nel Copilota esistente; classe e obiettivo visibili, fonte opzionale se supportata dal canale autorizzato.
2. Proposta leggibile prima dell'adozione con numero di quesiti, risposte e spiegazioni e messaggio che occorre verificare la correttezza.
3. Pulsante esplicito **«Apri come bozza in Verifiche»**, che non salva: verifica di nuovo contesto e fonte e passa esclusivamente i campi `AssessmentEditorPrefill` a `VerificheOnlineView`.
4. Editor consente modifiche e annullamento; nessuna UDA assegnata automaticamente; l'eventuale provenienza S2b richiede checkbox autonoma.
5. Solo il comando **«Salva Verifica»** del docente invoca il percorso canonico `handleSaveNewTest`; prima di allora il numero di verifiche nel Vault resta invariato.

## 6. Qualificazione e condizioni di avanzamento

- **S3a:** RED test-only causale → GREEN su parser/proiezione; typecheck/build, PREDEPLOY, FLOW-03 e invarianti del candidato, revisione Codex. Nessun HPR richiesto finché non cambia UI.
- **S3b:** test avversariali provider/route, consenso, privacy, budget, timeout, regressione PREPARE e nessuna scrittura.
- **S3c:** Chromium mobile 320/390, scorrimento corretto, bozze modificate/back gesture/cambio classe, conferma fonte; prova che nessuna verifica sia salvata prima del comando esplicito. 5/5 gate, revisione indipendente e HPR visiva umana prima di promozione.
- **S3d/S4:** riprendere continuità didattica soltanto dopo l'integrazione governata di S3.

**Vincolo operativo:** PR #161 è una riconciliazione documentale indipendente ancora in bozza; non usarla come base per mutazioni S3. **Nessuna fusione o distribuzione Vercel deriva automaticamente da questa specifica.**
