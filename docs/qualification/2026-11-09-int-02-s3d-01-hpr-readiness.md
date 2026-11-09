# INT-02/S3d-01 — Preparazione della revisione umana dell’esperienza Android

**Data:** 9 novembre 2026  
**Stato:** preparazione delle evidenze, non accettazione e non autorizzazione al deploy  
**Autorità applicativa:** `main@87529c2257554f37a31eed85589b9a4e75ac6d80`, PR #165 integrata; nessuna modifica a main in questo incremento.  
**Programma:** [INT-02 #140](https://github.com/antoniocorsano-boop/registro-docente/issues/140) · [Roadmap #104](https://github.com/antoniocorsano-boop/registro-docente/issues/104)

## 1. Evidenze esistenti confermate

- [PR #165](https://github.com/antoniocorsano-boop/registro-docente/pull/165): S3c-02 integrata su main. Candidato `d6d3201baf7e2903c5f5d0d09e7c470e7ac1f60e`, revisione indipendente Codex completata senza rilievi, quattro thread corretti e chiusi.
- Cinque qualificazioni candidate **PASS**: [Invarianti #940](https://github.com/antoniocorsano-boop/registro-docente/actions/runs/42567272894), [PREDEPLOY #2221](https://github.com/antoniocorsano-boop/registro-docente/actions/runs/42567272932), [FLOW-03 #716](https://github.com/antoniocorsano-boop/registro-docente/actions/runs/42567272948), [HEADER-01 #290](https://github.com/antoniocorsano-boop/registro-docente/actions/runs/42567272972), [Browser #1864](https://github.com/antoniocorsano-boop/registro-docente/actions/runs/42567273004).
- [Pacchetto browser originale #1864](https://github.com/antoniocorsano-boop/registro-docente/actions/runs/42567273004/artifacts/13652516178) registrato come `browser-qualification-d6d3201baf7e2903c5f5d0d09e7c470e7ac1f60e`; dimensione 11.429.177 byte, scadenza **16 novembre 2026 alle 05:35 UTC** (ritenzione GitHub di sette giorni). La prova S3c-02 usa una classe, una fonte e un servizio di generazione **sintetici**.
- [PREDEPLOY dopo fusione #42569998722](https://github.com/antoniocorsano-boop/registro-docente/actions/runs/42569998722) **PASS** sul commit `87529c2257554f37a31eed85589b9a4e75ac6d80`; albero di merge identico al candidato qualificato.
- `vercel.json` su main mantiene `git.deploymentEnabled=false`; nel collegamento Vercel interrogato non risulta alcuna distribuzione per il commit di merge.

**Attenzione all’interpretazione:** PASS tecnico della prova browser **non** equivale a revisione umana dell’interfaccia, disponibilità della generazione reale o pubblicazione dell’applicazione.

## 2. Fornitore reale e ambiente: precondizioni distinte

Il server Express in `server.ts` espone `GET /api/copilot/assessment-draft/provider` e `POST /api/copilot/assessment-draft`, predisponendo `createGeminiAssessmentGenerationProvider` con `process.env.GEMINI_API_KEY`. Il risultato di `GET` espone `available` basandosi sulla configurazione della chiave, ma **non prova da solo** funzionamento del modello, raggiungibilità del servizio, quote o buon esito del POST. La costruzione delle schermate in Vite (`vite build` o `vite preview`) non garantisce che tali endpoint Express siano attivi.

**Stato verificato:** le anteprime Vercel storiche disponibili fanno riferimento a revisioni anteriori a S3c-02; per esse non è attestata una configurazione del fornitore S3c. Nessun ambiente di prova raggiungibile da Android e basato sul commit integrato è stato qualificato in questa fase. Non dedurre `PROVIDER_READY`.

Separare obbligatoriamente:
1. **Revisione visuale e di navigazione:** utilizzare un fornitore **simulato** con dati sintetici e risposta deterministica; nessun invio a Gemini. Gli strumenti browser possono produrre immagini consultabili prima di avere un collegamento Android.
2. **Prova di integrazione del fornitore reale, se necessaria prima del rilascio:** solo in ambiente isolato, con chiave caricata **lato server** dal responsabile autorizzato (mai nella UI, nei log o nel repository); controllare metadati, un singolo POST con fonte professionale sintetica e consenso esplicito, ricevuta e limiti. Non eseguire automaticamente da questa PR.

## 3. Pacchetto visuale S3d-01

La prova sintetica esistente `tests/browser/int-02-s3c02-copilot-assessment.spec.cjs` è estesa **solo su ramo separato** con acquisizioni visive nel pacchetto GitHub Actions, senza modifica del prodotto né del `main`. I file attesi, prodotti soltanto se la prova ha successo, sono:

| File | Evidenza | Dimensioni |
|---|---|---|
| `int02-s3d-preview-390.png` | Anteprima con fonte, classe, quesito, risposta proposta e comando «Apri come bozza» | 390×844 |
| `int02-s3d-editor-390.png` | Editor precompilato, UDA non attribuita e salvataggio ancora manuale | 390×844 |
| `int02-s3d-back-390.png` | Conferma per modifiche non salvate prima di lasciare la bozza | 390×844 |
| `int02-s3d-synthetic-review.json` | Provenienza, commit esatto della prova, nomi delle immagini, indicazione `syntheticProvider=true` | n.d. |

Nella medesima prova controllare anche il limite di larghezza a **320×700**, senza attribuire a tale verifica un’accettazione umana. Le immagini con `fullPage` possono essere più alte della finestra dichiarata; nel nome la misura identifica il **viewport**, non le dimensioni finali del file.

**Ricevuta:** registrare URL del nuovo workflow, SHA esatto, esito e URL dell’artefatto soltanto dopo la sua effettiva generazione. Non associare al documento un file previsto ma non ancora prodotto.

## 4. Unico percorso HPR Android — S3d-02

**Prerequisiti obbligatori:** ambiente isolato su esatto commit qualificato, nessuna esposizione di dati reali, modalità/provider chiaramente identificati, prova browser delle schermate PASS, ritorno Android già verificabile. Nessuna modifica al registro professionale dell’utente.

1. Aprire il Copilota e scegliere «Creare una verifica»; confermare che **classe e fonte** siano leggibili, corrette e non selezionate arbitrariamente.
2. Impostare un obiettivo. Verificare che **prima del consenso non parta alcun invio**. Acconsentire per un tentativo di prova; generare una sola proposta sintetica.
3. Leggere titolo, domande, alternative, risposte e spiegazioni; verificare ingombro, leggibilità, scorrimento, possibilità di annullamento. La proposta è da controllare, non una valutazione attendibile automaticamente.
4. Toccare «Apri come bozza in Verifiche»: il Copilota deve **chiudersi completamente**; devono comparire i soli campi modificabili, **UDA vuota, nessun voto o attribuzione automatica**. Non premere «Salva Verifica».
5. Modificare il titolo, provare **Indietro** di Android, scegliere «Rimani nell’editor» e confermare che la modifica sia conservata. Uscire poi **senza salvare**, verificando che nessuna verifica sia stata creata.

**Esito unico:** `PASS` se tutte le cinque verifiche visibili e di navigazione funzionano; `REWORK` con uno o più rilievi specifici, accompagnati da screenshot e passo riproducibile; `BLOCKED` se manca un ambiente isolato o la modalità di prova non è verificabile. La revisione umana deve registrare data, dispositivo/orientamento, commit/URL esatto, modalità del fornitore, esito e conferma che il Vault contiene soltanto dati sintetici.

## 5. Condizioni per avanzare

- **S3d-01** termina quando dossier e immagini sintetiche sono raccolti e verificati; da solo non autorizza `PASS HPR`.
- **S3d-02** è un unico ciclo di accettazione mirato; non ripetere test GitHub già qualificati e non richiedere nuove prove sullo smartphone prima che l’ambiente sia pronto.
- **S3d-03** registra `PASS / REWORK / BLOCKED` e separa esplicitamente l’eventuale decisione di distribuzione dalla semplice integrazione in `main`.
- Nessun merge, attivazione Vercel, invio reale al fornitore o scrittura professionale è autorizzato da questo documento.
