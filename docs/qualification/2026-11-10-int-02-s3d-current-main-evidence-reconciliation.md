# INT-02/S3d — Riconciliazione evidenze Copilota sul ramo canonico

**Data di riferimento:** 10 novembre 2026. **Baseline applicativa:** `main@635628db3c35b8ead3abea35369ab0d53bdfb4bf`; nessun cambiamento di codice prodotto, Vault o backend.
**Lavori collegati:** [S3d #192](https://github.com/antoniocorsano-boop/registro-docente/issues/192), [INT-02 #140](https://github.com/antoniocorsano-boop/registro-docente/issues/140), [PR storica #166](https://github.com/antoniocorsano-boop/registro-docente/pull/166), [PR S4c #193](https://github.com/antoniocorsano-boop/registro-docente/pull/193).

## 1. Provenienza verificata — nessun rebase del ramo storico

- La PR #166 era **OPEN/DRAFT, 4 commit avanti e 126 indietro** rispetto al `main` del 10 novembre. Non è stata fusa.
- I cambiamenti sostanziali della #166 erano soltanto `tests/browser/int-02-s3c02-copilot-assessment.spec.cjs` e un dossier storico. Il test del vecchio ramo, **privato delle sole aggiunte per le immagini e il manifesto**, è stato confrontato byte per byte con la versione corrente sul `main`: **identico**. È stato quindi riportato soltanto il differenziale delle evidenze, non l'intero ramo divergente.
- Storico già qualificato sul commit `037d777a1832e6968363f281b6d1497b29016845`: cinque gate PASS; [archivio Chromium #13653920951](https://github.com/antoniocorsano-boop/registro-docente/actions/runs/42571543496/artifacts/13653920951) ancora disponibile il 10 novembre, con scadenza GitHub **16 novembre 2026 alle 06:20 UTC**.
- L'archivio è stato letto: contiene le cinque immagini dichiarate e `int02-s3d-synthetic-review.json`, che riporta `commitSha=037d777...`, `syntheticProvider=true`, `realStudentData=false`, `savedAssessment=false` e due tentativi simulati, di cui il primo annullato.

## 2. Evidenze da rigenerare sul nuovo SHA

La prova S3c già inclusa nelle qualificazioni viene estesa su un **ramo isolato nato dal main attuale**. Le cinque immagini storiche vengono rigenerate in **due modalità per ciascuno stato**:

1. `int02-s3d-preview-context-390.png` — fonte e classe professionale sintetiche, obiettivo e consenso disattivato.
2. `int02-s3d-preview-questions-390.png` — proposta sintetica con una domanda, risposta e spiegazione soggette a revisione.
3. `int02-s3d-preview-action-390.png` — scelta esplicita «Apri come bozza in Verifiche».
4. `int02-s3d-editor-390.png` — editor precompilato, UDA non attribuita, nessuna verifica salvata automaticamente.
5. `int02-s3d-back-390.png` — dialogo di uscita che protegge le modifiche non salvate.

**Originale a pagina intera:** i cinque nomi sopra (per confronto con #166). **Effettivo viewport 390×844:** cinque file corrispondenti con suffisso `-viewport.png`; `fullPage` da solo non equivale allo schermo Android visibile. Controllo di assenza scorrimento orizzontale anche a 320×700. Il manifesto distingue le due famiglie di screenshot e identifica il commit.

Questo riporto non certifica ancora `PASS HPR`: le immagini sono prodotte automaticamente con servizio **simulato** e dati inventati. I pulsanti fissi, il contenuto nell'area scorrevole interna e la leggibilità dell'interazione vanno valutati sulle immagini del viewport e, se disponibile un ambiente adeguato, su dispositivo.

## 3. Unico percorso HPR Android già definito nella PR #166

Lo schema in cinque passi del dossier del 9 novembre resta valido: fonte/classe → obiettivo/consenso per richiesta → lettura della proposta → editor non salvato con UDA vuota → Indietro Android, «Rimani nell'editor», uscita senza salvataggio. **Non richiedere un test Android ripetitivo**: eseguire un unico HPR soltanto quando esistono URL isolato per esatto SHA e prova verificabile della modalità simulata. Esito `PASS / REWORK / BLOCKED` con ricevuta.

## 4. Fornitore reale — gate distinto e non attribuibile alle immagini

`server.ts` usa `process.env.GEMINI_API_KEY` lato server ed espone `/api/copilot/assessment-draft/provider` e `/api/copilot/assessment-draft`. `GET` indica se la chiave è configurata, **non** prova che la generazione reale risponda, che ci siano quote disponibili o che un modello restituisca un oggetto valido. La prova S3d intercetta la rete e **non chiama il fornitore reale**. Non inviare alcun nominativo o documento reale.

Stato di questo pacchetto: **PROVIDER NOT VERIFIED; HPR ANDROID BLOCKED** in assenza di un ambiente isolato autorizzato e verificato. La sola qualifica del test non autorizza a creare un deploy né a configurare segreti.

## 5. Esiti e governance

**Da completare con prove effettivamente terminate:** ID workflow, commit candidato, manifesto delle immagini, controllo visuale delle immagini 390×844, cinque gate exact-SHA e revisione Codex. PR in bozza, non integrare automaticamente. `main` e `vercel.json` devono restare invariati (`git.deploymentEnabled=false`).

**S4c** è tecnicamente qualificata sulla PR #193 ma non ancora integrata; il suo stato non modifica il gate provider/HPR S3d. La linea INT-02 #140 rimane aperta.