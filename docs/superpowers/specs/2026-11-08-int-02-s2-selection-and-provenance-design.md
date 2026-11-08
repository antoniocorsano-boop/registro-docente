# INT-02/S2 — Selezioni governate e provenienza delle verifiche

**Stato:** PROPOSTA DOCUMENTALE, non approva implementazione, modifica del modello dati, merge o pubblicazione.  
**Data:** 8 novembre 2026  
**Baseline:** `main@71e4a437acd9b15bcab28d32a13c6b4026fb29bc` (PR #142, INT-02/S1 integrata)  
**Tracker:** [#140](https://github.com/antoniocorsano-boop/registro-docente/issues/140) · [roadmap #104](https://github.com/antoniocorsano-boop/registro-docente/issues/104)  
**Riferimenti:** PR #141 (S0) e #142 (S1).

## 1. Decisioni già chiuse: non rifare S1

1. La Biblioteca è la fonte autorevole di `LibrarySource`; l'azione «Prepara una verifica con questa fonte» trasferisce solo `sourceId` e `classId` in stato **sessionale** verificato, mai il contenuto della fonte nell'URL.
2. S1 ha già qualificato su Chrome Android il passaggio Biblioteca→Verifiche, protezione della bozza con Indietro/Rimani/Esci e filtro UDA 3ª A/3ª B. La verifica delle UDA avviene anche al confine del salvataggio.
3. Un nuovo test in editor parte con `udaId` vuoto; import DOCX/ZIP usa `udaId: undefined`. Nessuna UDA va preassegnata in base all'ordine.
4. Il **catalogo OnlineTest è condiviso** e riutilizzabile tra classi: non trasformarlo surrettiziamente in archivio per classe.
5. `CREATE_ASSESSMENT` del Copilota resta `UNSUPPORTED`; S2 non introduce generazione IA, pubblicazione, assegnazione di voti o importazione automatica di esiti.

## 2. Inventario residuo sul codice integrato

| Dominio | Codice osservato | Conseguenza per S2 |
| --- | --- | --- |
| Condivisione | `VerificheOnlineView.tsx` inizializza `selectedClass` con `assessmentHandoff?.className ?? classes[0]?.name ?? ''` | In accesso diretto può indicare una classe non scelta dal docente |
| Catalogo / Padlet | `selectedTestId = Object.keys(tests)[0] || 'energia'` | Il primo test può risultare selezionato senza scelta esplicita, anche nell'azione «Copia link» |
| Edit e import | Nuova verifica `editorUdaId=''`; import ZIP/DOCX `udaId: undefined`; selettori UDA filtrati | **Già corretto:** copertura di regressione, non reimplementazione |
| Persistenza | `OnlineTest` comprende `udaId?`, ma nessun `sourceId` né metadato di provenienza dalla Biblioteca | In S1 il legame si perde dopo salvataggio; scegliere la semantica S2 prima di modificare lo schema |
| Test storici | `App.tsx` carica `{ ...INITIAL_TESTS, ...initialSnapshot.customTests }`; `VaultRecordKey` contiene `customTests` | Non sostituire test storici o alterare backup/ripristino per un miglioramento visivo |
| Risultati | `OnlineSubmission` conserva `class` e `testId?`; `App.tsx::handleImportSubmissionsToRegister` passa **tutte** le consegne a `reconcileSubmissionGrades`; `VerificheOnlineView.tsx::handleImportSubmissions` passa `currentSelectedTest?.udaId` come parametro globale e `gradeFromSubmission` usa `targetUdaId || submission.testId` per il campo `udaId` | **Rischio distinto:** la selezione per Padlet non determina il perimetro dell'importazione batch né può attribuire automaticamente un'UDA comune a esiti di classi/test differenti. Preservare gli esiti storici anche se il test originario non è più a catalogo; qualificare separatamente la semantica delle UDA nei voti |
| Origine | `LibraryStateV1.sources` con `privacy`, `status`, `links`, `provenance`; `assessmentHandoff` con riferimenti transitori | Qualsiasi riferimento durevole deve poter rilevare fonte scomparsa, riclassificata o non pronta senza riesporre il payload |

## 3. Obiettivi di S2

### S2a — Scelte sicure in Condivisione

- Se la navigazione proviene da **contesto esplicitamente convalidato**, può mostrare la classe pertinente, senza presumere che il docente intenda pubblicare.
- In accesso ordinario alla sezione Verifiche, classe e test destinatari di un collegamento devono essere scelti esplicitamente oppure riconfermati in modo inequivoco. Non interpretare `classes[0]`, il primo test o la stringa `energia` come una scelta professionale.
- «Copia link», «Prova come alunno» e le altre **azioni di condivisione/simulazione** che consumano test+classe devono restare disabilitate o richiedere una selezione valida quando il contesto è assente, cambiato o ambiguo. Questo vincolo **non si applica** alla raccolta o all'importazione delle consegne.
- Se la classe è eliminata o cambia mentre si compila, invalidare l'intento pendente e richiedere nuova conferma; non associare il test alla classe successiva per posizione.
- La selezione *di una prova condivisa* per la somministrazione è distinta da `udaId`, che rappresenta un collegamento curricolare: non inventare una proprietà `classId` su `OnlineTest` come surrogato.
- Conservare i percorsi leciti da `initialClassName` (continuità professionale esistente) e la modalità di analisi; rimuovere soltanto l'autorità implicita nelle azioni.

### S2b — Provenienza della fonte: punto di decisione obbligatorio

**Due livelli da distinguere:**
1. **Provenienza sessionale**, già presente: pannello con titolo della fonte e classe, nessuna scrittura.
2. **Provenienza durevole**, non presente: dichiarazione verificabile che un determinato test sia stato preparato a partire da una fonte specifica dopo decisione del docente.

**Opzione raccomandata, soggetta a specifica approvazione:** campo **opzionale e retrocompatibile** su `OnlineTest`, associato solo al salvataggio umano esplicito, es. `provenance?: { version: 1; kind: 'library-source'; sourceId: string; confirmedByTeacher: true }`. Questo è un *contratto candidato*, non una modifica di schema autorizzata. Evitare `sourceTitle`, estratti, contenuti, URL o dati di studenti nel metadato. Non creare un archivio parallelo.

- Il salvataggio del riferimento è permesso solo se, **al momento del commit**, classe e fonte sono ancora coerenti con la richiesta e `LibrarySource.status === 'ready'` e `privacy === 'teacher-professional'`.
- La fonte non deve essere rinominata, riclassificata o copiata nel test dal passaggio contestuale; indicare in consultazione l'esito della verifica del riferimento.
- Per fonte mancante, riclassificata, non pronta o non disponibile: mostrare «Origine non disponibile/non verificabile» e **non** riproporre testo della fonte. Nessun ripristino automatico dell'origine né associazioni per titolo.
- Test esistenti privi del campo restano legittimi e visualizzati come «Origine non registrata», mai «Origine certificata».
- Se il test viene riutilizzato per un'altra classe, il riferimento descrive l'origine del materiale e **non** attribuisce automaticamente una nuova UDA, un permesso di consultazione o una classe proprietaria.
- La visibilità della provenienza verso studenti o destinatari esterni non è prevista da S2. Condivisione, stampa e URL studente non devono includere `sourceId`.
- Da validare prima del codice: comportamento per modifica di test preesistenti, esportazione/importazione, backup/ripristino, campi sconosciuti, fonte eliminata, classe cambiata durante il salvataggio, duplicazione e revoca della classificazione.
- Se una delle prove di compatibilità fallisce, S2b deve rimanere **deferita** e S2a potrà essere integrata separatamente.

### S2a — Confine dell'importazione esiti: contratto indipendente dalla condivisione

- **Non** imporre selezione Padlet (test+classe) come prerequisito per «Importa Voti nel Registro». L'importazione usa un insieme di `OnlineSubmission` che può comprendere più classi, più test e verifiche non più presenti nel catalogo.
- L'intento di importare deve avere **conferma propria** prima del commit, con riepilogo del perimetro e dei collegamenti UDA proposti, senza usare implicitamente il test momentaneamente selezionato per la condivisione.
- Oggi `handleImportSubmissions` propaga `currentSelectedTest?.udaId` come destinazione comune e `gradeFromSubmission` usa `targetUdaId || submission.testId` come `udaId`: questa logica è un **rischio di associazione curricolare preesistente**, non un comportamento da estendere o dichiarare già corretto. Verificarne la compatibilità prima di qualsiasi modifica al percorso `Registra`.
- Se il batch contiene classi/test differenti, un'unica UDA va rifiutata quando non è stata **autorizzata e validata per tutte** le singole consegne; in assenza di attribuzione verificata non inventare un collegamento curricolare né usare `submission.testId` come se fosse un identificativo UDA. La scelta del comportamento sostitutivo è un gate dedicato alla persistenza.
- Conservare la possibilità di importare consegne storiche di test rimossi, senza forzare la selezione di un altro test. L'azione è distinta dalla somministrazione e deve conservare gli attuali controlli sulle classi/studenti, da valutare separatamente per possibili ambiguità.
- **Ambito di questa PR:** modifica della specifica e casi di regressione; non si modifica ora il codice dell'importazione, né si dichiara qualificata la sua attuale semantica UDA. L'eventuale correzione applicativa richiede test RED→GREEN, revisione indipendente, consenso esplicito e prova di non alterazione degli esiti già registrati.

## 4. Compatibilità dei collegamenti UDA preesistenti

Un test storico può avere `udaId` di una classe diversa da quella attiva. La nuova verifica di classe deve continuare a impedire una **nuova associazione** incrociata, ma l'apertura di un test storico non deve cancellare il suo riferimento esistente né sovrascriverlo silenziosamente. Specificare «Collegamento UDA già esistente, fuori dal contesto della classe attuale» e consentire soltanto un'azione coerente: cambiare classe, aprire in consultazione oppure rimuovere il legame con conferma esplicita. Non salvare modifiche collaterali a titolo/quesiti se il legame diventa illegittimo: fallimento spiegato, senza commit parziale.

## 5. Sicurezza e criteri di accettazione

- **F1:** senza classe/test esplicitamente selezionati, **nessun link studenti copiato o simulazione aperta**; nessuna selezione fittizia nella condivisione. **Non estendere F1 all'importazione degli esiti.**
- **F2:** un handoff S1 valido presenta contesto verificabile, ma non equivale a consenso a salvare, pubblicare o collegare la fonte.
- **F3:** dopo cambio/eliminazione della classe, scomparsa/riclassificazione della fonte, test rimosso o UDA ambigua, invalidazione spiegata e zero scritture.
- **F4:** catalogo comune e test storici leggibili; nessun `udaId` cancellato o trasferito silenziosamente; UDA sempre compatibile con classe attiva al momento della nuova attribuzione.
- **F5:** nessun `sourceId`, payload fonte, titolo riservato, nominativo o voto in URL, `history.state`, registrazioni diagnostiche o richieste remote non autorizzate.
- **F6:** se S2b autorizzata, riferimento minimo opzionale; prove di esportazione/ripristino e di fallback per fonte mancante, senza alterare il contenuto di test/esiti.
- **F7:** prove RED→GREEN su vera App Chromium, 320/390 px e Android, incluse Indietro/Avanti e bozza non salvata; qualificazione invarianti, sicurezza, FLOW-03, HEADER-01 e Browser, revisione indipendente sull'esatto SHA.
- **F8:** `main` e `vercel.json` immutati fino a promozione separata. Test soltanto con dati sintetici.
- **F9 — Importazione indipendente:** prove di non regressione con batch di più classi/test, test originario eliminato, selezione Padlet diversa dal test delle consegne, UDA del test selezionato appartenente a un'altra classe, UDA assente e consegne storiche già importate. L'importazione deve richiedere consenso proprio e non imporre un test del catalogo come destinatario. Prima di cambiare la persistenza, dimostrare assenza di attribuzioni UDA arbitrarie e nessun voto aggiunto, perso o riattribuito per effetto delle selezioni di condivisione.

## 6. Decisioni escluse da S2

Nessun secondo Copilota, generazione IA di verifiche, modifica ai voti, cambio autorità di Programmazione/Arena/Docente OS, import automatico di risultati, nuova Biblioteca o filtraggio distruttivo del catalogo. S3 e S4 restano iterazioni autonome.

## 7. Gate di autorizzazione

**Gate S2a:** approvare semantica «nessuna scelta arbitraria» e salvaguardie dei flussi condivisione/simulazione.  
**Gate S2b:** approvare o differire il contratto opzionale di provenienza **solo dopo** verifica di compatibilità tecnica.  
**Gate integrazione:** qualificazione exact-SHA + revisione umana Android + decisione separata sul merge. Distribuzione Vercel non autorizzata per effetto di questa proposta.
