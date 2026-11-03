# FLOW-03B — Active-focus qualification checkpoint

Baseline: `main@c56ae67693b773b093e51f131053ce1c205a9508`.

## Causal RED

Exact RED candidate: `d28a55eedc4221d6b62256585828ae594d5c3d3e`.

FLOW-03 Contract Qualification #224 / run `41626568553` ha confermato un RED isolato in `flow03bActiveRecordFocusContract.test.ts`: il trigger ambientale del Copilota restava soppresso per tutto `todayAction === 'record'`, quindi anche dopo `recordSession.status === 'saved'`.

Tutti gli altri contratti FLOW-03 precedenti risultavano PASS nello stesso run.

## Repair

Product commit: `d7453b092806daff64766edc2e940e92044c5b33` — `fix(flow-03b): restore ambient Copilot after save`.

Il repair modifica soltanto il confine di focus attivo:

- il trigger ambientale Copilota è soppresso solo durante `record/editing`;
- il Copilota inline di `RecordLessonPanel` è visibile solo durante `editing`;
- dopo `saved`, l’interfaccia ambientale può tornare disponibile;
- nessuna persistenza, autorità professionale o routing specialistico è cambiato.

## GREEN evidence

Workflow monouso `FLOW-03B Active Focus Repair`, run `41626674530`: **PASS**.

Prima del commit ha verificato:

- `flow03bActiveRecordFocusContract.test.ts`;
- `flow02AppIntegrationContract.test.ts`;
- intera suite `src/security/flow03*.test.ts`;
- `bunx tsc --noEmit`;
- `git diff --check`.

Workflow e patcher temporanei sono stati rimossi nel commit prodotto.

Questo file è un checkpoint documentale: non modifica prodotto o test. Il commit risultante è il candidato human-authored da usare per i gate fresh exact-SHA. Nessun merge o deploy è autorizzato.
