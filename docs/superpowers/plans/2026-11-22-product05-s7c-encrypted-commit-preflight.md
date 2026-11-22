# VAL-01/PRODUCT-05/3 — Contratto preliminare al salvataggio cifrato

Data: 22 novembre 2026. Questo incremento si appoggia alla PR #395 `1db9f988561041df1c0de690588e4e8aa0eaeca6`, che ha superato CI-FAST e Chromium mirato.

## Vincolo principale
**Non modificare il formato `ClassData`, `AppData`, l'archivio cifrato o le versioni di backup prima di avere un protocollo end-to-end approvato.** I bilanci individuali contengono informazioni personali e non devono essere introdotti in record non validati o essere esposti in copie di sicurezza senza prova di recupero.

## Funzione qualificabile subito
`formativeBalanceCommitPreflight.ts` riceve una conferma locale **già riesaminata dal docente**, scollegata dall'interfaccia, e l'archivio corrente approvato indipendentemente. Ricomputa S7a, verifica versione e fonti, e genera esclusivamente una proposta minima:
- contesto esatto scuola/anno/classe/materia/alunno/periodo/date;
- identificativi revisioni delle prove selezionate, confronti espliciti, testo redatto dal docente;
- digest delle fonti e istante della conferma **di sessione**;
- marca obbligatoria `proposal-only-not-saved`.

Il controllo `recheckFormativeBalanceCommitPreflight` invalida la proposta se cambiano revisione, testo, periodo, provenienza, data o destinatario. Entrambi sono **puri rispetto allo stato applicativo**: nessuna funzione di scrittura, rete, backup, esportazione o pubblicazione. Il digest non è una firma e la conferma della sessione non autentica il docente.

## Successiva fase separata e obbligatoria
Prima di qualsiasi pulsante Salva e di ogni nuovo campo persistente occorre qualificare:
1. schema e validatore di archivio append-only, versionamento del documento, conflitti concorrenti;
2. transazione cifrata `appData + meta` con esclusione e rilettura durevole e divieto di falsi successi;
3. round-trip backup Web/Android e ripristino sulle versioni storiche senza perdita di bilanci già registrati;
4. negazione di output a famiglie/Consiglio fino a autorizzazione del docente e proiezione minimizzata;
5. controlli regressivi e prova sintetica di rollback, qualifica completa e revisione indipendente.

## Fusione futura
Restano vietati merge automatico, release, `main` non qualificata, modifica dati scolastici reali. La base PR #395 è già riallineata con `main@1e9bcd0e`; verificare nuovamente lo stato di main prima dell'integrazione finale.
