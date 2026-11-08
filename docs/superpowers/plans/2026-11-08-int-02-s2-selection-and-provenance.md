# INT-02/S2 — Piano di esecuzione differenziato

**Data:** 8 novembre 2026 · **Stato:** SOLO DOCUMENTAZIONE · **Baseline:** `main@71e4a437acd9b15bcab28d32a13c6b4026fb29bc`.  
**Specifica:** [INT-02/S2 — scelte e provenienza](../specs/2026-11-08-int-02-s2-selection-and-provenance-design.md) · **Tracker:** [#140](https://github.com/antoniocorsano-boop/registro-docente/issues/140).

## Precondizioni

- INT-02/S1 PR #142 integrata, A1–A4.1 HPR Android PASS, 5 suite tecniche PASS. NON riaprire le correzioni già chiuse.
- Codice attuale: `selectedClass` e `selectedTestId` nella vista Verifiche possono partire dal primo elemento in assenza di handoff; `editorUdaId` e import DOCX/ZIP NON associano la prima UDA.
- `OnlineTest` è un catalogo comune, `OnlineSubmission` registra separatamente classe e test, `LibrarySource` è autoritativa sulle fonti. Le fonti non passano nel payload URL/history.
- Due binari indipendenti: **S2a (scelte di condivisione/simulazione)**, **S2b (provenienza durevole)**. Il percorso **importazione batch degli esiti** possiede un consenso e un contratto di persistenza separati: non dipende dalla coppia classe/test Padlet. S2b non parte senza autorizzazione esplicita dello schema.

## S2a — Scelte professionali per classe e test

1. **RED:** fixture con 3ª A, 3ª B, test diversi e primo elemento deliberatamente sbagliato. Controllare creazione link, copia, simulazione, cambio classe, cancellazione classe e test, accesso diretto, handoff da Biblioteca. Asserire che le modifiche alla scelta Padlet non cambiano le consegne storiche o il perimetro d'importazione.
2. **GREEN:** risolutore di scelta esplicita classe+test (o contesto unico convalidato); placeholder informativi e azioni non attive se target assente. Nessuna «prima classe» o «primo test» capace di provocare condivisione involontaria.
3. **Regressione:** `initialClassName` da sessione Registra, analisi, stampa, catalogo comune, edit con `udaId` preesistente e import DOCX/ZIP. Preservare i contenuti, non reimpostare automaticamente gli ID di test/UDA. **Separare** il controllo d'importazione voti: batch di classi/test differenti, verifica eliminata, UDA del test selezionato diversa da quella delle consegne, esiti già importati. Non imporre una scelta test+classe Padlet per eseguire l'importazione.
4. **Qualificazione:** lint, test sicurezza e biblioteca, invarianti, PREDEPLOY, FLOW-03, HEADER-01, Chromium completo e prova dedicata S2a; revisione Codex, HPR Android su dati sintetici.
5. **Decisione:** S2a può essere proposta per merge in maniera autonoma, senza attendere S2b; nessun deploy Vercel.

## Confine S2a / Registra — consenso importazione distinto

1. Registrare esplicitamente il comportamento attuale: `handleImportSubmissionsToRegister` passa **tutte** le `OnlineSubmission` al riconciliatore; `handleImportSubmissions` inoltra `currentSelectedTest?.udaId` come UDA comune; il riconciliatore usa `targetUdaId || submission.testId` per il campo `udaId`. Queste sono evidenze di rischio, **non** un comportamento UDA già qualificato.
2. Le preselezioni Padlet non devono cambiare, limitare o ampliare automaticamente le consegne da importare. Consegne relative a test eliminati rimangono gestibili senza selezionare un test sostitutivo.
3. Progettare separatamente il riepilogo e il **consenso esplicito all'importazione** con convalida delle associazioni UDA per ogni classe/consegna. Una UDA globale non deve essere applicata a classi diverse senza autorizzazione e controllo di compatibilità; `testId` non è una UDA.
4. Prima di modificare il percorso `Registra`, richiedere test RED→GREEN dedicati a multi-classe, omonimie, test assente, import ripetuto, rifiuto dell'associazione curricolare arbitraria e persistenza/rollback. Non introdurre questa modifica applicativa nella PR documentale né usarla come presupposto per il via libera delle preselezioni S2a.

## S2b — Provenienza: prima decidere il modello

1. Inventariare i formati reali di backup/esportazione/importazione della chiave `customTests`, i controlli di decodifica e le transizioni privacy della Biblioteca. Documentare i rischi senza eseguire migrazioni.
2. Scrivere test RED di compatibilità con test storici, metadato opzionale assente, contenuto di fonte revocato, duplicazioni, origine sconosciuta, fonte spostata/eliminata, cambio classe prima del commit, ripristino archivio e collegamento UDA di classe differente.
3. Confrontare due opzioni, indicando una raccomandazione motivata: (A) solo attestazione sessionale della fonte, senza modifiche `OnlineTest`; (B) metadato opzionale e minimale di riferimento nel test al salvataggio esplicito, senza payload e con controllo autoritativo.
4. **Gate umano vincolante:** scegliere (A) o (B); nessun cambiamento di schema/persistenza prima di tale decisione. Se (B), redigere separata specifica di migrazione/versionamento/restore e ripetere test integrali.
5. **Gate HPR:** in eventuale editor aggiornato mostrare origine verificata / non registrata / non disponibile senza includere titoli o testi non più autorizzati; proteggere la bozza e Back Android.

## Esclusioni e controlli

Nessuna chiamata esterna, generazione IA, importazione voti, modifiche alle classi reali o pubblicazione. Nessuna variazione a `main`, `vercel.json` o ai dati del Vault in questa PR documentale. S3 Copilota e S4 ciclo professionale restano separati.

## Uscita da questa PR

- Riesame indipendente del piano e della specifica S2a/S2b.
- Approvazione esplicita della strategia S2a, prima dell'implementazione.
- Decisione differita o esplicita sul metadato durevole S2b.
- Solo a valle: PR di prodotto S2a con test RED→GREEN. 
