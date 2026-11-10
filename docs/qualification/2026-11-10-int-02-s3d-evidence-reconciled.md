# INT-02/S3d-01 — Riconciliazione delle evidenze del Copilota

**Data:** 10 novembre 2026  
**Baseline applicativa:** `main@635628db3c35b8ead3abea35369ab0d53bdfb4bf` (S3c, S4b e UX-PRINT-01 integrati)  
**Origine storica:** [PR #166](https://github.com/antoniocorsano-boop/registro-docente/pull/166) — ramo `037d777a1832e6968363f281b6d1497b29016845`, 5/5 gate PASS **solo su quel ramo**  
**Autorità:** [S3d #192](https://github.com/antoniocorsano-boop/registro-docente/issues/192) · [INT-02 #140](https://github.com/antoniocorsano-boop/registro-docente/issues/140) · [roadmap #104](https://github.com/antoniocorsano-boop/registro-docente/issues/104)  
**Stato di questo ramo:** `EVIDENCE RECONCILIATION / HPR PENDING / PROVIDER NOT VERIFIED / NO MERGE / NO DEPLOY`

## Perché il riporto è minimo

Il test in `main` (169 righe) è esattamente sottosequenza del test sul ramo #166 (221 righe): **zero righe funzionali modificate o eliminate**, soltanto **52 righe aggiuntive** per prove visive e manifesto. Il riporto applica tali aggiunte a un ramo derivato dal `main` corrente; non trascina il ramo storico né la vecchia baseline. L'invariante esistente `INT-02-S3C-02-I01` include già `tests/browser/int-02-s3c02-copilot-assessment.spec.cjs` come percorso protetto. Nessuna variazione a `src/`, `server.ts`, dipendenze, API, Vault, dati professionali o impostazioni Vercel.

## Contratto delle prove S3d-01 (solo dati sintetici)

Il test Chromium S3c-02 già presente conserva le verifiche di classificazione professionale della fonte, identificazione della classe, **consenso esplicito per ogni richiesta**, possibilità di annullare una richiesta in corso, preview da provider HTTP **intercettato e simulato**, nessuna scrittura, editor con **UDA vuota**, guardia delle modifiche non salvate e uscita senza creare verifiche.

Il riporto acquisisce nella **nuova esecuzione sul commit qualificato esatto**:

| Evidenza | Nome file | Criterio |
|---|---|---|
| Classe e fonte visibili nel Copilota | `int02-s3d-preview-context-390.png` | Elemento dentro lo scorrimento interno |
| Proposta: domande e risposte | `int02-s3d-preview-questions-390.png` | Scorrimento interno controllato |
| Azione «Apri come bozza» | `int02-s3d-preview-action-390.png` | Pulsante realmente inquadrato |
| Editor non ancora salvato | `int02-s3d-editor-390.png` | UDA vuota, nessuna scrittura |
| Guardia dell'uscita con modifiche | `int02-s3d-back-390.png` | Conferma esplicita per uscire |

Manifesto `int02-s3d-synthetic-review.json`: `commitSha`, `syntheticProvider: true`, `professionalSourceOnly: true`, `realStudentData: false`, `savedAssessment: false`, `acceptanceStatus: EVIDENCE_ONLY_NOT_HPR`. Chromium usa 390 × 844 e controlla assenza di scorrimento orizzontale a 320 × 700. Le immagini sono acquisite dopo `scrollIntoViewIfNeeded`, con rettangoli dell'elemento realmente compresi nell'area scorrevole del Copilota.

**Artefatto storico preservato:** [Browser #42571543496 — artefatto #13653920951](https://github.com/antoniocorsano-boop/registro-docente/actions/runs/42571543496/artifacts/13653920951), scadenza 16 novembre 2026, ore 06:20 UTC. Non utilizzare lo SHA dell'artefatto storico come prova della nuova baseline. Annotare URL e SHA dell'artefatto aggiornato **soltanto dopo l'esito positivo della nuova qualifica**.

## HPR Android — una sola revisione mirata, non ancora eseguita

**Precondizione:** interfaccia accessibile su un ambiente isolato autorizzato, su esatto commit qualificato; Vault e fonti con **soli dati fittizi**; modalità «fornitore simulato» chiaramente indicata. Le schermate Chromium da sole non dimostrano l'uso reale su Android. Non richiedere ripetizioni manuali finché tale ambiente non sia disponibile.

1. Aprire «Creare una verifica» e verificare che classe e fonte professionale siano corrette, senza selezioni arbitrarie.
2. Verificare obiettivo e consenso **prima** di ogni richiesta; un consenso vale per un solo tentativo.
3. Leggere proposta, alternative e spiegazioni, verificando scorrimento e leggibilità.
4. Aprire la proposta come **bozza modificabile**; Copilota chiuso, UDA vuota e nessun salvataggio/voto implicito.
5. Modificare il titolo, usare **Indietro** di Android, conservare la bozza scegliendo «Rimani nell'editor»; poi uscire senza salvare, verificando che non sia nata una verifica.

**Ricevuta HPR:** PASS / REWORK / BLOCKED, dispositivo/orientamento, data, SHA, URL di prova, modalità del fornitore, conferma dati sintetici e rilievi con passo riproducibile. L'esito HPR non coincide con i gate tecnici.

## Fornitore remoto reale — verifica separata e non autorizzata

Il codice server espone `GET /api/copilot/assessment-draft/provider` e `POST /api/copilot/assessment-draft`; `available` non dimostra una generazione riuscita. La prova qui usa **solo intercettazioni simulate**: nessuna chiave, nessuna chiamata a Gemini, nessun ambiente remoto qualificato. Un'eventuale prova reale richiede prima ambiente isolato con backend Express sul commit esatto, chiave caricata esclusivamente lato server dal responsabile autorizzato, consenso per l'unico POST di prova sintetico e verifica di privacy, tempi di risposta e limiti. Non avviare la prova reale o una distribuzione per effetto della riconciliazione documentale.

## Decisioni e chiusura

- **S3d-01:** PASS tecnico soltanto dopo cinque gate esatti, artefatto aggiornato e verifica delle cinque schermate.
- **S3d-02:** HPR non attribuibile automaticamente; BLOCKED se manca ambiente Android isolato sullo SHA qualificato.
- **S3d-03:** disponibilità reale del fornitore `NOT VERIFIED` fino a una prova separata autorizzata.
- [PR #166](https://github.com/antoniocorsano-boop/registro-docente/pull/166) è candidata a chiusura **senza merge** soltanto dopo il trasferimento qualificato delle evidenze e della documentazione utile.
- `main` e la distribuzione restano invariati; una PR di sole prove non deve essere integrata senza autorizzazione esplicita.
