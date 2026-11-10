# INT-02/S4 — Piano operativo di qualificazione della continuità docente

**Stato:** DRAFT DOCUMENTALE, 10 novembre 2026. Base `main@d9f4c2e3af39c5365c6078dbfc89fe93de8a054c`.
**Specifica associata:** `docs/superpowers/specs/2026-11-10-int-02-s4-teacher-cycle-continuity-design.md`.
**Tracciamento:** UX-GOV-01 #104, INT-02 #140, S3d #166.
**Vincolo:** PR #184 CDC-02/P5 resta HPR REWORK e NON viene integrata in questo lavoro. Nessuna pubblicazione.

## Fase 0 — Prova della baseline e dei confini

- [ ] Registrare esatto SHA di `main`, `vercel.json` disabilitato, stato S1/S2/S3 realmente integrato e stato non-promuovibile di #184.
- [ ] Derivare ramo di lavoro separato `feat/int-02-s4-cycle-contract` da SHA di `main` verificato, senza riportare codice o branch storici.
- [ ] Mappare le funzioni canoniche: `getPreparationOptions`, `resolveAssessmentHandoff`, `prepareAssessmentEditorTransfer`, `handleSaveNewTest`, `resolveAssessmentShareTarget`, `routeForRecordEvidence`, `reconcileSubmissionGrades`, `getRecordReviewOptions`.
- [ ] Annotare esplicitamente che il provider reale/chiave server è fuori dalla prova S4 e resta nel gate S3d #166.

## Fase 1 — RED test di continuità prima di modificare il prodotto

**File candidato:** `src/security/int02S4TeacherCycle.test.ts` (modello puro e contratti) e, dopo, `tests/browser/int-02-s4-teacher-cycle.spec.cjs` con provider simulato.

- [ ] Rilevare una discontinuità **concreta** usando test che ripercorrono il passaggio Prep → Editor → Condivisione → Import → Rivedi. Ogni test RED deve nominare un comportamento osservato mancante; non introdurre un test artificiosamente irrealizzabile per giustificare codice nuovo.
- [ ] Classe assente/omonima e test eliminato: nessuna classe o verifica scelta da `[0]`, nessun collegamento ripristinato da una precedente classe.
- [ ] Dopo apertura Copilota/bozza, `customTests` e `appData.grades` restano identici. L'apertura editor non attribuisce UDA o provenienza.
- [ ] Condividere o simulare una verifica non costituisce consenso all'importazione.
- [ ] Importare solo con `SubmissionImportSelection` completo: `classId`, `testId`, `period`, `targetUdaId` (anche `null` scelto esplicitamente). Annullo: zero mutazioni. Conferma: ricontrollo del contenuto del Vault e della firma preview.
- [ ] Rivedi dopo il salvataggio: informazioni della classe corretta; controllo bozza e ritorno Android; nessuna inferenza disciplinare/collegiale.
- [ ] Conservare lo stato RED preciso (run, SHA, messaggio di fallimento). Se tutto è già GREEN, non inventare una lacuna: chiudere S4a come qualificazione dei percorsi esistenti e proporre solo miglioramenti UX documentati.

## Fase 2 — GREEN piccolo e verificabile (solo se RED autentico)

- [ ] Una sola causa per incremento, niente nuova architettura parallela. Usare `App` come coordinatore, non salvare un nuovo `AssessmentCycle` nel Vault.
- [ ] In caso di problema nei link di navigazione, modificare soltanto il codice di passaggio contestuale; mostrare classe e verifica, senza URL o log con dati riservati.
- [ ] In caso di problema nell'import, correggere il selettore e la verifica di freschezza nel gestore canonico, non abbassare il validatore.
- [ ] In caso di problema su bozze/Indietro, preservare `AssessmentDraftGuard` e i controlli Android già qualificati.
- [ ] Verificare anche compatibilità con INT-01, S3c, S2b, IMPORT-01 e CDC-01 senza modificare il modello delle fotografie.

## Fase 3 — Prova browser completa e evidenze

**Finestra:** 390 × 844 e 320 × 700, esclusivamente dati sintetici e fonte Biblioteca professionale fittizia.

- [ ] Scenario A: Oggi/Prepara → Biblioteca → Copilota con consenso simulato → anteprima e bozza Verifiche; prima del salvataggio nessun test nuovo.
- [ ] Scenario B: nuova verifica salvata mediante comando esplicito → selezione classe+verifica per condivisione; verifica nel catalogo condiviso senza proprietà automatica della classe.
- [ ] Scenario C: scelta `Registra` → Esiti verifica online; importazione con opzioni esplicite e anteprima. Un annullamento non crea voti; una conferma su dati sintetici crea solo valutazioni autorizzate. Reimportazione identica non sovrascrive.
- [ ] Scenario D: `Rivedi` → Tabellone/Storico nella classe corretta; ritorno a `Oggi`, nuova `Prepara`, nessuna perdita di bozza non confermata.
- [ ] Scenario E: rifiuto su classe ambigua/assente, test eliminato, UDA non valida, salvataggio in corso, richiesta remota annullata. Non creare nuovi dati in stato di errore.
- [ ] Acquisire quattro/cinque immagini su navigatore reale nel percorso e manifesto SHA, esclusivamente quando la prova effettiva lo consente. Non sostituire la schermata reale con una ricostruzione grafica.

## Fase 4 — Qualifica, verifica e HPR

- [ ] Aggiungere in `qualification/invariants.v1.json` il perimetro S4 soltanto quando esistono file e test della PR applicativa. Evitare invariant falsi in una PR documentale.
- [ ] Eseguire 5 gate canonici su **uno stesso SHA**: Qualification Invariants, PREDEPLOY, FLOW-03, HEADER-01 e Browser Qualification.
- [ ] Richiedere revisione Codex indipendente exact-SHA, risolvere finding importanti con RED→GREEN e nuova revisione dello SHA corretto.
- [ ] Human Product Review mirata sull'esperienza mobile: classe, test, salvataggio esplicito, esiti, ritorno, leggibilità e protezione dei dati; distinguere schermate sintetiche da un collaudo umano eseguito.
- [ ] Registrare `PASS/REWORK/BLOCKED` senza sovrastimare la prova o chiedere ripetizioni inutili sul dispositivo.
- [ ] Solo dopo accettazione e distinta autorizzazione: eventuale merge esatto e verifica albero; distribuzione sempre disabilitata finché non autorizzata separatamente.

## Dipendenze e decisioni

- S3a/S3b/S3c risultano integrate nel codice di `main`; la verifica del provider remoto **reale** non è attestata dalla prova con servizio simulato.
- La PR #166 resta contenitore delle evidenze S3d e non viene fusa automaticamente; non entra nella baseline del lavoro.
- S4 non inserisce un testo generato in un documento ufficiale, non distribuisce verifiche agli studenti automaticamente, non importa voti senza decisione del docente.
- LSM-02, MOBILE-01 e UX-QA-03 si avviano soltanto dopo la chiusura canonica della linea INT-02 secondo #104.

## Esito atteso di questa PR documentale

1. Contratto S4 comprensibile e verificabile prima del codice.
2. Matrice di test con nomi, percorsi e confini di autorità, senza creare un secondo sistema.
3. Prossima azione esatta: un test di continuità **prima** di qualsiasi mutazione applicativa; se le prove sono già positive, registrare l'assenza di lacuna invece di inventare funzionalità.
4. Nessuna modifica a `src/`, `tests/`, `qualification/`, `server.ts` o `vercel.json` e nessun salvataggio di dati del docente.
