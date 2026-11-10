# INT-02/S4 — Continuità Biblioteca, Verifiche e ciclo docente

**Stato:** PROPOSTA DI SPECIFICA, solo documentazione; nessuna approvazione HPR, codice o distribuzione.
**Data:** 10 novembre 2026.
**Baseline:** `main@d9f4c2e3af39c5365c6078dbfc89fe93de8a054c`.
**Riferimenti:** roadmap UX-GOV-01 #104, INT-02 #140, PR #142 (S1), #149 (S2a), #160 (S2b), #162–#165 (S3), #166 (evidenze S3d, aperta).
**Confine contemporaneo:** CDC-02/S2b-P5 PR #184 è in HPR REWORK, non si deve integrare né assumere che sia una dipendenza S4.

## 1. Scopo dell'incremento

Collegare, **senza creare un secondo sistema di verifiche**, il ciclo professionale:
`Prepara → Conduci → Registra → Rivedi → successiva preparazione`.

La prima consegna S4a non è una nuova interfaccia: è l'inventario verificabile dei passaggi e delle autorizzazioni esistenti, con criteri di accettazione e prove di continuità. Eventuali lacune dell'esperienza vengono affrontate con incrementi separati S4b/S4c. La generazione remota non è condizione per testare il ciclo con verifiche salvate o con una risposta simulata.

## 2. Autorità e percorso già disponibili su main

| Passaggio | Autorità e funzione rilevate | Garanzia da preservare |
| --- | --- | --- |
| Prepara | `src/preparation/preparationRouter.ts`: opzione `assessment` → `verifiche-online`; `copilot` → contesto per singola classe | Il contesto professionale non seleziona da solo una verifica o una UDA |
| Biblioteca → Verifiche | `src/library/assessmentHandoff.ts`; fonte professionale pronta, classe univoca | Passaggio informativo, niente copia del contenuto in URL o nuove verifiche |
| Copilota → bozza | S3 `AssessmentCopilotPanel`, `assessmentEditorTransfer.ts`, `VerificheOnlineView` | Richiesta remota autorizzata e bozza modificabile non salvata; nessuna provenienza/assegnazione UDA implicita |
| Salva verifica | `VerificheOnlineView` `onSaveNewTest` → `App.handleSaveNewTest` | Solo comando esplicito del docente, scrittura canonica del catalogo condiviso |
| Conduci/condividi | `src/library/assessmentShareSelection.ts`: `resolveAssessmentShareTarget` | Coppia classe + verifica esplicita e valida; nessuna autorizzazione a importare voti |
| Registra esiti | `src/recording/recordSession.ts`: `online-outcomes` → `verifiche-online`; `src/persistence/submissionGradeImport.ts` | Importazione con classe, test, periodo e UDA (anche scelta `null`) espliciti, anteprima e consenso separato |
| Rivedi | `src/recording/reviewRouting.ts`: per `online-outcomes` → Tabellone, Storico, Analisi, Scheda alunno | Viste della stessa classe attiva; nessuna generazione di valutazioni dal cambio vista |

Il catalogo `OnlineTest` è condiviso; l'UDA della verifica e l'UDA **di destinazione dei voti** sono due decisioni diverse. Il riferimento durevole `OnlineTest.provenance?` non concede il consenso a generare, condividere o importare.

## 3. Cosa resta da dimostrare in S4

**S4a — Contratto e matrice dei passaggi.** Testare, su dati sintetici, il ciclo completo e le interruzioni:
1. senza classe univoca: niente generazione remota, link per studenti, importazione o passaggio implicito alla classe precedente;
2. nuova bozza dal Copilota: titolo/quesiti in editor, 0 test creati fino a «Salva Verifica»; uscita senza salvare e ritorno non risuscitano la bozza;
3. salvataggio esplicito: verifica unica nel catalogo condiviso; il riuso non attribuisce automaticamente proprietà alla classe;
4. condivisione/simulazione: classe e test selezionati, nessuna importazione voti innescata;
5. `Registra`/esiti online: anteprima con quattro decisioni `classId/testId/period/targetUdaId`, annullamento senza scritture; dopo conferma, evitare duplicati, errori di identità, sovrascritture o inferenze;
6. `Rivedi`: accesso al Tabellone o Storico nella classe corretta dopo un import realmente salvato; ritorno a `Oggi`/preparazione senza perdere dati o aggirare guardie;
7. tap/gesto Indietro, cambio classe, assenza sorgente, UDA non valida e attesa del salvataggio sono protetti;
8. nessuna alterazione di copia di sicurezza, alunni, consensi remoti, URL, `history.state` o metadati di origine non autorizzati.

**S4b — Minimo intervento causale.** Solo se la prova S4a trova un'interruzione reale, correggere il punto che la causa. Non introdurre «autosalvataggio per continuità» né una seconda copia di `OnlineTest`.

**S4c — Qualifica complessiva e revisione umana.** Chromium 320/390 px, dati esclusivamente sintetici e, per il Copilota, provider simulato con richiesta remota controllata; 5/5 verifiche exact-SHA, revisione indipendente e giudizio HPR esplicito prima della promozione.

## 4. Confini inderogabili

- **Rete e privacy:** non richiedere né configurare chiavi dal client; non inviare nomi, voti o dati personali degli alunni; la prova remota usa solo simulazione. Il lavoro S3d della PR #166 conserva il gate distinto dell'ambiente reale (backend Express e credenziali server) e non viene dichiarato chiuso da S4.
- **Integrità:** nessuna valutazione derivante dalla sola apertura/navigazione; nessuna origine fonte retroattribuita o nuova UDA scelta automaticamente; bloccare ambiguità classe/test e cambi concorrenti.
- **Persistenza:** solo i gestori `App` già canonici; niente nuova chiave Vault, migrazione del backup o stato parallelo.
- **Interfaccia:** riusare `Prepara`, `Conduci`, `Registra`, `Rivedi` e `VerificheOnlineView`; non confondere il portale degli studenti con le autorizzazioni del docente.
- **Governance:** nessun merge, distribuzione Vercel o aggiornamento della versione ordinaria; `git.deploymentEnabled=false`. PR #184 resta in HPR REWORK e fuori dal perimetro.

## 5. Criteri di accettazione del ciclo

| Codice | Prova richiesta | Esito atteso |
| --- | --- | --- |
| S4-F1 | Prepara/Biblioteca/Copilota → nuova bozza Verifiche | Nessuna scrittura prima del salvataggio manuale |
| S4-F2 | Classe o test assenti, duplicati o cambiati | Fallimento chiuso e nessuna scelta del primo elemento |
| S4-F3 | Verifica salvata → condivisione/simulazione | Classe/test espliciti e nessuna importazione derivata |
| S4-F4 | Consegne → anteprima importazione → annulla/conferma | Nessuna scrittura con annulla; commit solo nel perimetro selezionato |
| S4-F5 | Registra esiti → Rivedi | Stessa classe; nessuna conclusione/valutazione automatica |
| S4-F6 | Android Indietro/cambio classe/bozza | Modifiche non perse silenziosamente |
| S4-F7 | Regressioni Catalogo/INT-01/INT-02/CDC-01 | Nessun indebolimento di test o fonte canonica |
| S4-F8 | Prove, review e autorizzazione | RED→GREEN, 5/5 gate, revisione Codex, HPR e promozione distinti |

## 6. Decisioni ancora aperte

- Quali passaggi di S4 necessitino realmente di un raccordo visibile dopo aver eseguito la prima prova integrata: **non presupporre** che serva una nuova barra o schermata.
- Eventuale disponibilità del servizio remoto reale: gate di infrastruttura e consenso separato dalla continuità locale.
- La chiusura formale di INT-02 sulla roadmap #104 solo dopo S4c, HPR e promozione: **non anticiparla** dalla sola apertura di questa specifica.
