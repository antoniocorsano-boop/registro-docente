# INT-02 — Continuità Biblioteca ↔ Verifiche ↔ Copilota

**Stato:** PROPOSTA / PRE-AUDIT DOCUMENTALE. Nessuna approvazione implementativa o promozione implicita.
**Data:** 7 novembre 2026
**Baseline:** `main@d548adc7e03bf4589ea42059e4ef35b0a3dcf8b1`
**Tracker:** [INT-02 #140](https://github.com/antoniocorsano-boop/registro-docente/issues/140) · [UX-GOV-01 #104](https://github.com/antoniocorsano-boop/registro-docente/issues/104)

## 1. Scopo

Consentire al docente di partire da una risorsa della propria Biblioteca, preparare o adattare una verifica didattica nel contesto esplicito di classe/UDA, utilizzare il Copilota come supporto governato e completare il ciclo Prepara → Conduci → Registra → Rivedi, senza perdere provenienza, controllo dei dati e autorizzazione delle scritture.

**Principio:** orchestrare i domini autorevoli esistenti, non crearne altri.

## 2. Evidenze della baseline

| Dominio | Elemento esistente | Limite per INT-02 |
| --- | --- | --- |
| Prepara | `src/preparation/preparationRouter.ts` offre le destinazioni `biblioteca`, `verifiche-online` e Copilota | Il percorso non trasferisce direttamente la fonte Biblioteca alle Verifiche |
| Biblioteca | `src/library/types.ts` definisce un'unica `LibrarySource` con `privacy`, `links` e `provenance` | Nessun riferimento persistente fonte→verifica in `OnlineTest` |
| Classificazione | `src/components/LibrarySourceCard.tsx` espone già in **Gestisci** la classificazione professionale confermata dal docente | La UX issue #95 va riconciliata, non duplicata |
| Copilota | `src/library/copilotLaunchContext.ts` trasferisce `sourceId`, classe, UDA, lezione e intento; `LibraryCopilotComposer` usa il flusso governato | Intento `CREATE_ASSESSMENT` oggi `UNSUPPORTED` in `agentIntentRouting.ts` |
| Verifiche | `VerificheOnlineView.tsx` dispone di editor, import DOCX/ZIP, test, simulazione, stampa e analisi | `selectedClass=classes[0] || '3ª A'`; `selectedTestId` usa il primo test; nuove/importate verifiche usano `udas[0]` |
| Contesto | `ProfessionalContextV1` ha `classId`, `udaId`, `lessonId`, `sourceId`, `assessmentId` | Serve consumo esplicito dalla superficie Verifiche, non un nuovo modello parallelo |
| Mutazioni | `App.tsx`: `commitTestsMutation` per test; `commitAppDataMutation` per importazione esiti | Sono autorità distinte, non accorpare o anticipare gli effetti professionali |

## 3. Esperienza desiderata

### J5 — Riuso di materiale professionale

1. `Oggi → Prepara → Biblioteca`, con classe selezionata esplicitamente.
2. Il docente identifica una fonte, ne verifica stato e classificazione. La fonte `unknown` **non** viene usata automaticamente; `student-personal` non può alimentare richieste generative o memoria professionale.
3. Sceglie **«Prepara una verifica con questa fonte»**. In questa fase si genera solo un **handoff sessionale**, con riferimenti, non contenuto della fonte nell'URL e non un documento/test già salvato.
4. La destinazione Verifiche mostra classe, eventuale UDA, fonte e provenienza; se classe/UDA sono ambigue o non valide, il docente deve sceglierle. Nessuna selezione arbitraria o da `[0]`.
5. Il docente crea/modifica la verifica nell'editor esistente, rivede le domande e dà l'ordine esplicito di salvataggio. Un cambiamento di classe invalida il contesto della fonte/target non più compatibile.

### J6 — Ciclo verifica

- **Prepara:** creazione/importazione/adattamento mediante l'editor esistente e in futuro il Copilota; nessun output IA distribuito senza revisione.
- **Conduci:** distribuzione o simulazione mediante i comandi esistenti, con test e classe verificati.
- **Registra:** importazione degli esiti con i controlli già implementati; non avviarla da un passaggio informativo.
- **Rivedi:** analisi e decisioni successive usando le superfici autorevoli, senza una nuova vista riepilogativa duplicata.

## 4. Autorità e scelte del docente

**Contesto canonico:** `ProfessionalContextV1`. Nelle rotte utilizzare solo riferimenti temporanei validati dalla sessione in memoria. Non mettere contenuto della fonte, nominativi, voti o identificativi degli studenti in URL, history.state, log diagnostici o chiamate non autorizzate.

**Fonte:** autoritativa in `LibraryStateV1`; la classificazione già esistente non deve essere alterata automaticamente. Per il passaggio deve essere `teacher-professional` e utilizzabile secondo lo stato della fonte. Fonte eliminata o riclassificata invalida il passaggio.

**Classe e UDA:** contesto esplicito o risoluzione unica con autorizzazione verificata. `UdaRecord` locale e proiezione `docente-os` hanno autorità diverse; nessuna scrittura a UDA proiettate in sola lettura. La scelta della prima UDA nell'array non è una prova di pertinenza.

**Verifica:** `OnlineTest` è il dominio persistente esistente. In S1 **non si estende lo schema**. Se un successivo S2 necessita riferimenti permanenti alle fonti per la provenienza, definire schema opzionale, migrazione, ripristino, validazione e rifiuto dei riferimenti inaffidabili prima di implementare.

**Copilota:** unico Composer; nessuna seconda chat o generatore di test. `CREATE_ASSESSMENT` rimane non supportato finché non esiste un contratto di autorizzazione che produca una bozza riconoscibile e richieda revisione/adozione esplicita. Una classificazione d'intento non è un permesso.

**Esiti:** nessun automatismo di voto, importazione, notifica, collegamento o somministrazione. Ogni mutazione segue il coordinatore persistente del dominio e deve completarsi prima di segnalare esito positivo.

## 5. Casi critici da gestire

- Fonte `unknown`, `restricted`, `needs-review` o `student-personal`.
- Fonte originaria eliminata/riclassificata dopo l'apertura delle Verifiche.
- Due UDA compatibili con la classe o classe assente: richiedere scelta esplicita.
- Fonte collegata a UDA di un'altra classe: non ereditare il collegamento.
- UDA proiettata da Docente OS: consentire consultazione, non edit locale non autorizzato.
- Verifica già salvata con `udaId` non più esistente: conservare dati, ma indicare collegamento non disponibile.
- Indietro/Avanti Android, schermata ricaricata e blocco Vault: invalidare handoff transitorio, non riesporre fonte o dati.
- Modifiche non salvate nella Verifica: uscita protetta, salvataggio solo dopo commit durabile.
- Import esiti con più classi: nessun effetto collaterale dalla navigazione del flusso INT-02.

## 6. Taglio implementativo proposto

1. **INT-02/S1 — passaggio contestuale Biblioteca → Verifiche**: risolutore puro di riferimenti e stati `ready / requires-choice / unavailable`, instradamento e UI contestuale minima. Nessuna modifica allo schema persistente.
2. **INT-02/S2 — igiene delle preselezioni e provenienza**: eliminare `classes[0]`, `udas[0]` e ripieghi fittizi nelle azioni professionali; filtrare UDA per classe; valutare contratto esplicito della provenienza.
3. **INT-02/S3 — Copilota governato**: bozza di verifica solo previa autorizzazione e revisione; mantenere `CREATE_ASSESSMENT` `UNSUPPORTED` finché il percorso non è qualificato.
4. **INT-02/S4 — integrazione delle fasi del ciclo**: regressioni su somministrazione/esiti, importazione, Rivedi e navigazione mobile.

Questo taglio è una proposta, non implica l'apertura simultanea di quattro PR.

## 7. Qualificazione

- **RED→GREEN** su risoluzione classe/UDAs, fonte/personale, invalidazione e nessuna preselezione arbitraria.
- **Prove di persistenza**: l'apertura non muta né fonti né test né esiti, salvataggio professionale solo con conferma e commit completato, protezione dall'uso di classi diverse.
- **Revisione indipendente exact-SHA**, qualificazione Browser Chromium con vera App e archivio interamente sintetico, HPR Android 390×844 e 320×700.
- Coprire gli scenari J5 e J6 di UX-GOV-01, indietro/avanti, privacy e stato del Vault.
- Nessuna modifica su `main` o Vercel senza autorizzazioni distinte.

## 8. Questioni da decidere prima di S2/S3

1. Serve davvero conservare nel test un riferimento durevole alla fonte, o è sufficiente la provenienza di una proposta esplicitamente adottata?
2. La prima versione deve limitarsi al **passaggio contestuale** e all'editor manuale, lasciando la generazione assistita alla fase S3? **Raccomandazione: sì.**
3. In presenza di ambiguità classe/UDA, quale azione di chiarimento presenta il minor carico cognitivo senza autoattribuzioni?
4. La classificazione già presente in Biblioteca soddisfa l'issue UX #95 su Android o restano difetti di accessibilità/scopribilità?

**Decisione preliminare raccomandata:** qualificare prima S1 e S2; non anticipare S3, memoria LSM-02, pubblicazione o dispositivi reali con dati personali.
