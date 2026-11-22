# VAL-01/PRODUCT-05 — Prova cumulativa di integrazione (22 novembre 2026)

## Scopo e limite
Candidato sintetico **non destinato alla fusione**. Riproduce la somma della sequenza M1→VAL-01 fino a PRODUCT-05/1 e delle modifiche recenti di `main`, per verificare regressioni e conflitti prima di una proposta formale. Questo ramo non sostituisce le PR originali, né il loro ordine di approvazione e la revisione indipendente.

## Provenienza esatta
- `main`: `1e9bcd0eb8bd5c7e72ea059b3f90f72805f9cdd1`
- Sorgente cumulativa PR #394: `8dc8d8fc6903ac67806118c05875b9ca5097db51`
- Primo antenato comune: `8d3baab8e513100887c8b81d1dbf7408bebeec6f`
- Il ramo origine #385 non era direttamente integrabile (mergeable_state = dirty), sovrapposizione in `qualification/invariants.v1.json`.

## Risoluzione tecnica circoscritta
L'albero applicativo proviene integralmente dalla PR #394. Si reintegrano **esattamente** i cinque file che sono stati modificati in `main` dopo la divergenza: `.github/workflows/ci-fast-development.yml`, `.github/workflows/predeploy-security-qualification.yml`, `docs/qualification/OPERATING_PROTOCOL.md`, `scripts/qualification/ci-fast-plan.mjs`, `scripts/qualification/ci-fast-plan.test.mjs`.

Per `qualification/invariants.v1.json` si conserva l'elenco esatto delle **159** invarianti di PR #394 e si aggiunge la singola `CI-FAST-01-I01` di `main`, senza sostituire o rinominare alcuna voce: totale atteso **160**, con identificativi univoci. Le altre modifiche da `main` non sono presenti nella differenza temporale controllata.

**Importante:** si tratta di una riconciliazione esplicita del contenuto a monte del collaudo, non di un normale rebase completato su tutte le PR accatastate. Una successiva proposta di integrazione richiede nuova qualificazione completa sul proprio SHA, revisione indipendente e decisione espressa.

## Sicurezza
Soltanto dati sintetici. Vietati modifiche a dati scolastici, rilascio APK, deploy, automerge, alterazioni di `main` o integrazioni delle PR.

## Accettazione della prova
1. Le 160 invarianti risultano valide, senza collisioni.
2. S7/PRODUCT-05, S7a e S7b sono qualificati.
3. TypeScript, build e intera suite di sicurezza/memoria superano.
4. Chromium su scheda, riservatezza, navigazione e densità mobile supera.
5. Il rapporto finale distingue questa prova dai gate richiesti per la pubblicazione e dall'eventuale correzione delle singole PR.
