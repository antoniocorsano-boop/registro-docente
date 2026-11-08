# Registro Docente — Audit dei rami aperti rispetto al main autoritativo

**Data:** 8 novembre 2026  
**Stato:** ricognizione verificabile / **non** autorizza merge, rebase indiscriminato, deploy o modifica di dati  
**Baseline:** `main@7333f6eb28fd99101e2d243515c994d1faf99c49` (INT-02/S2a #149 integrata); S1 #142 già integrata  
**Distribuzione:** `vercel.json → git.deploymentEnabled=false`

## Decisione generale

Non introdurre in `main` contenuto da rami storici solo per ridurne la distanza cronologica. Prima distinguere per ogni PR: **(A)** contenuto identico a `main`, **(B)** funzionalità già presente ma implementata in modo successivo, **(C)** funzione assente, **(D)** controlli/prove mancanti, **(E)** conflitto o rischio di regressione. Integrare solo un residuo (C/D) dimostrato e qualificato su un ramo nuovo derivato dal `main` corrente; non riscrivere in massa `App.tsx`, `qualification/invariants.v1.json` o i workflow.

I conteggi `behind` descrivono *commit di distanza*, non quantità di conflitti. Le PR storiche ancora aperte sono in bozza e non integrabili automaticamente al momento dell'audit. **Verifica delle PR successore già completate:** #135 ha riconciliato e integrato NAV-S1, #137 ha riconciliato e integrato INT-01, entrambe con qualificazioni exact-SHA e HPR Android. La funzione residua va verificata rispetto a questi successori e non al solo vecchio ramo.

## P0 — PR #116: INT-01 continuità Programmazione / UDA / lezione

- PR: https://github.com/antoniocorsano-boop/registro-docente/pull/116
- Candidato storico: `bd18a0af9f1db97e95afeae1a56177c215158402` · confronto `main…PR`: **308 behind**, 120 ahead; `mergeable=false`; 30 file modificati rispetto alla base storica.
- **Evidenza (A), SHA di contenuto uguale a main:** `DidacticContinuityBar.tsx`, `UdaGanttView.tsx`, `UdaWorkspaceView.tsx`, `PlanningProfileEditor.tsx`, `PlanningProfileView.tsx`, `professionalContext.ts`, `teachingFocus.ts`, `udaClassScope.ts`, `planningContextBridge.ts`, `curricularSubjectCode.ts`, `planningFrameResolver.ts`; verificati inoltre diversi contratti INT-01 identici (`int01AppContextContract`, `int01DidacticContinuityUiContract`, `int01FinalReviewScopeContract`, `int01PlanningFrameContract`, `int01ProfessionalContextContract`, `int01QualificationContract`, `int01TeachingFocusContract`, `flow03FocusedUdaDiaryContract`).
- **Differenza (B/E):** `src/App.tsx` del ramo è precedente e molto differente dal `main` (127.499 vs 148.865 caratteri nell'ispezione); `SecureRegistroRoot.tsx` differisce perché `main` passa `headerSecurity` ad App e configura `VaultControls mobileControlsEnabled={false}`, caratteristiche non presenti nel ramo storico. Le prove Browser INT-01 e UX-QA presentano versioni diverse, da confrontare semanticamente, non copiare automaticamente.
- **Residuo non ancora qualificato:** criterio umano ancora descritto nella PR per «Apri UDA», corretto contesto di classe, ritorno/Indietro e scelta «Continua senza salvare» e comandi mobili; il contenuto identico non dimostra automaticamente PASS del comportamento su `main`.

**Stato del successore già verificato:** [PR #137](https://github.com/antoniocorsano-boop/registro-docente/pull/137), «INT-01/S1 — riconciliazione continuità didattica su main post NAV-S1», è **integrata in `main`** tramite commit `d548adc7e03bf4589ea42059e4ef35b0a3dcf8b1` dal sorgente qualificato `e8a6fed673dc1f4c43ced71e951e9146c6758784`. Il verbale #137 attesta **5 qualificazioni PASS**, Codex senza rilievi, Chromium INT-01 19/19 e storico 71/71 PASS, HPR Android sintetica A0–A5 PASS per i casi osservati. L'episodio iniziale di uscita verso Riepilogo è stato successivamente non riprodotto nel percorso isolato; non equivale a diagnosi certa della prima deviazione.

**Azione P0 completabile senza codice:** marcare la #116 come **sostituita da #137**, chiuderla senza merge e conservarne le evidenze. Le eventuali anomalie future si riproducono solo sull'ultimo `main` e si correggono con nuova PR ristretta, mai reintegrando l'`App.tsx` storico.

## P1 — PR #117: REG-NAV-01 ritorni specialistici

- PR: https://github.com/antoniocorsano-boop/registro-docente/pull/117
- Candidato storico `440c71d2e17a703665b6f7f60f0869f06f9fef39` · **308 behind**, 49 ahead; `mergeable=false`.
- **Evidenza (A):** `src/navigation/specialistTargetMemory.ts` e `specialistTargetMemory.test.ts` sono già byte-per-byte uguali a `main`.
- **Evidenza (B/E):** `App.tsx` è differente (106.393 vs 148.865 caratteri). Il `main` gestisce adesso la cronologia della scheda alunno tramite `createStudentReportHistoryState` e contesto di ritorno dedicato; usa `rememberSpecialistTarget` per il target valutazione e protezioni aggiuntive delle transizioni. Il ramo storico applica anche ai report studente una mappa volatile di token opachi: **non** portare quel router nel `main` perché il modello di cronologia corrente è cambiato.
- **Evidenza (D):** `regNav01SpecialistRoutingContract.test.ts` e `tests/browser/reg-nav-01-specialist-return.spec.cjs` non sono presenti in `main`; non significa che il comportamento sia assente, ma i controlli vanno confrontati con le prove di navigazione successive. Contratti `durableAppMutationIntegrity.test.ts` e `homeNavigationDuringSaveIntegrity.test.ts` differiscono.
- **Confine:** non introdurre nella cronologia web ID o nominativi di alunni/valutazioni; il comportamento esistente usa dati sintetici per la qualifica.

**Stato del successore già verificato:** [PR #135](https://github.com/antoniocorsano-boop/registro-docente/pull/135), «REG-NAV-01/NAV-S1 — riconciliazione mirata con Tabellone e Scheda alunno integrati», **integrata in `main`** tramite commit `4a165521333e816c91dc5c7df1137eddc153341d` da sorgente `305aacb8fca1878a9175f8834e11e474b1db5c61`. Il verbale finale #135 conferma 5 gate PASS, revisione Codex senza thread, HPR Android locale con dati sintetici A0–A5 (annullamento, controllo valori visibili, Indietro/Avanti, navigazione rapida, ritorno al Tabellone espanso). Il limite del controllo A2 è documentato: soltanto voti/flag visibili, non un controllo di tutte le righe non mostrate.

**Azione P1 completabile senza codice:** marcare la #117 come **sostituita da #135**, chiuderla senza merge conservando le prove originali. Nuove regressioni devono essere diagnosticate nel router attuale, non mediante trasferimento del vecchio `App.tsx`.

## P2 — PR #92: anteprima importazione proiezione Docente OS (primo residuo funzionale non ancora integrato)

- PR: https://github.com/antoniocorsano-boop/registro-docente/pull/92
- Candidato `4b0dd2e8ca16456bcdc34757acd29078f80e87ff` · **890 behind**, 4 ahead; `mergeable=false`.
- Il componente `DocenteOsProjectionPanel.tsx` e il relativo contratto `a4R2ProjectionImportUiContract.test.ts` **non esistono attualmente in `main`**. Non può essere archiviata come già integrata. `src/App.tsx` e `PlanningProfileView.tsx` sono però cambiati successivamente.
- **Azione P2:** conservare i contratti di importazione come materiale di specifica, riqualificare compatibilità con modello canonicale classe/contesto e anteprima attuale, protezione privacy e riconciliazione, senza import automatico. Nuovo incremento isolato dalla base `main` solo dopo la chiusura P0/P1.

## P3 — PR documentali #141 e #148

- `#141` (pre-audit INT-02/S0): 58 commit dietro `main`; contiene 2 file di documentazione, le implementazioni S1 e S2a sono già integrate. Non promuovere una pianificazione superata come se fosse una novità funzionale.
- `#148` (specifica INT-02/S2): 17 commit dietro `main`; contiene 2 file di documentazione, incluse le distinzioni S2a vs S2b e importazione esiti. Il contratto S2b va **recuperato in modo selettivo** nella nuova documentazione derivata da `main`, riconoscendo S2a già completata; nessuna modifica di schema `OnlineTest` senza decisione su backup/restore e privacy.
- Entrambe rimangono documentali; evitare merge in blocco. Conservare gli esiti della revisione indipendente come evidenze storiche.

## Gate e criterio di fine audit

1. Nessun merge, deploy, modifica Vault o personale da questa PR. La chiusura **amministrativa senza merge** dei due rami storici #116 e #117 è consentita una volta documentata la successione rispettivamente con #137 e #135.
2. Su ogni vecchio ramo registrare la classificazione (A/B/C/D/E) con riferimenti alle prove verificabili.
3. Prima di ogni eventuale promozione, verificare `main` corrente, SHA esatto, 5 qualificazioni, revisione indipendente e HPR Android nei soli percorsi effettivamente modificati.
4. Separare **integrazione in `main`** da pubblicazione: `git.deploymentEnabled=false` deve restare in vigore.
5. #116 e #117: chiusura amministrativa giustificata dalla promozione dei successori #137/#135 e dalle loro HPR, conservando i riferimenti; #92: mantenere aperta finché la funzione assente non è riprogettata/qualificata; #141/#148: documentazione da riutilizzare selettivamente.
6. L'ultima Browser Qualification #1729 sul commit sorgente di INT-02/S2a ha eseguito con esito SUCCESS anche i passi «Run INT-01 Chromium qualification» e «Run historical Chromium qualification»; sul merge in main non vi sono differenze di file rispetto alla sorgente qualificata.
