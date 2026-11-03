# FLOW-03B — Active-session focus repair checkpoint

Baseline: `main@c56ae67693b773b093e51f131053ce1c205a9508`.

## Causal evidence

Browser Qualification #1380 sul candidato `a9b1f1d65754a954f6352b99e97bb36551fd3b00` ha raggiunto FLOW-03 e ha mostrato lo stesso difetto su desktop e mobile: la Panoramica Sezione restava aperta all'ingresso in Registra.

Root cause: `buildRecordSession()` crea correttamente una nuova sessione con `status: 'choose'`; il focus FLOW-03B era invece vincolato a `status === 'editing'`. Il segnale rappresentava quindi lo stato della mutazione specialistica, non l'intera missione Registra non ancora salvata.

Il contratto sorgente è stato corretto sul RED `6720680f7806ad12549bfb238e80cd20d17682ac`; FLOW-03 Contract #233 ha confermato il fallimento prima del repair.

## Repair

Product commit: `4fbeaafce882f033199ce6afd2918331f9a3749b` — `fix(flow-03b): focus unsaved same-class Registra sessions`.

Il focus attivo ora richiede:

- `todayAction === 'record'`;
- sessione Registra presente;
- stato diverso da `saved` (`choose` oppure `editing`);
- `recordSession.context.classId` uguale alla classe corrente.

Lo stesso segnale fail-closed governa il trigger ambientale del Copilota; il comando Copilota inline resta disponibile durante `choose|editing` e scompare dopo `saved`.

Workflow monouso `FLOW-03B Active Session Repair`, run `41628967695`: **PASS**, inclusi focused contract, intera suite FLOW-03, TypeScript e `git diff --check`. Harness e patcher temporanei sono rimossi nel commit prodotto.

Questo file è solo una ricevuta e produce l'exact SHA human-authored per la qualifica fresh. Nessun merge o deploy è autorizzato.
