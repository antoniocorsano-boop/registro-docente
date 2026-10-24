# Lessons Learned

Ledger append-only delle lesson episodiche. Non riscrivere retroattivamente una lesson per adattarla a nuove conclusioni: aggiungere una nuova capsule o marcare la precedente `SUPERSEDED` con riferimento esplicito.

### LL-001 — Browser gate canonico fuori dalle sandbox conversazionali
- Stato: ACTIVE
- Ciclo/data: MEM-QUAL-01 · 2026-10-23
- Exact SHA/riferimento: baseline `main@023a6a036c4a43b71fcd408f6ecda1d92bf7a787`
- Obiettivo: rendere la qualificazione browser riproducibile e legata al candidato reale.
- Ha funzionato: i cicli recenti hanno mostrato che Chromium reale + preview di produzione + dati sintetici forniscono evidenza utile quando ambiente e candidato sono controllati.
- È fallito: affidare la disponibilità del browser gate canonico a sandbox conversazionali o ambienti non garantiti rende la certificazione non riproducibile e può interrompere il ciclo per ragioni infrastrutturali non legate al prodotto.
- Causa reale: disponibilità e co-locazione delle risorse browser non sono un contratto stabile delle sandbox conversazionali.
- Regola generalizzabile: la certificazione canonica deve usare infrastruttura effimera riproducibile e verificare l'exact candidate SHA; il browser manuale resta diagnostico.
- Recipe: `TR-003 — Stable browser qualification`.
- Non ripetere: dichiarare BROWSER QUALIFIED sulla sola base di una prova in ambiente non riproducibile o non verificato contro l'exact candidate.
- Evidenza: specifica `docs/superpowers/specs/2026-10-23-project-memory-browser-qualification-design.md` e cicli browser PERSIST-01H precedenti.
- Promozione candidata: operating rule — promossa come `OR-004`.
- Sostituita da: —

### LL-002 — PASS soltanto dopo l'ultima operazione browser
- Stato: ACTIVE
- Ciclo/data: MEM-QUAL-01 · 2026-10-23
- Exact SHA/riferimento: finding Codex sul candidate `7af8ef28fb8aa3357e5cea1de4be0f57b095950b`
- Obiettivo: garantire che il risultato del browser gate e l'evidenza JSON descrivano lo stesso stato finale osservato.
- Ha funzionato: la review indipendente ha verificato il contratto sul candidate già qualificato e ha analizzato anche l'ordine temporale tra asserzioni ed evidence capture.
- È fallito: il test assegnava `PASS` e verificava l'assenza di `pageerror` prima dello screenshot; un errore JavaScript emesso durante la cattura avrebbe potuto produrre un gate verde con `pageErrors` non vuoto nell'artefatto.
- Causa reale: l'asserzione finale precedeva un'operazione browser ancora capace di produrre eventi rilevanti per il contratto.
- Regola generalizzabile: in un browser gate fail-closed, il PASS deve essere assegnato solo dopo tutte le operazioni browser che possono ancora fallire o produrre eventi osservati; la generazione dell'evidenza richiesta fa parte del contratto di qualificazione.
- Recipe: `TR-003 — Stable browser qualification`, aggiornata con screenshot fail-closed e asserzione finale sui `pageerror`.
- Non ripetere: impostare il risultato a PASS prima dell'ultima operazione browser o trattare l'assenza dell'evidenza richiesta come successo.
- Evidenza: PR #23, thread Codex P2 su `tests/browser/browser-qualification.spec.cjs`, finding `PRRC_kwDOVR43as8AAAABBBMb6w`.
- Promozione candidata: recipe; nessuna nuova operating rule, perché il principio è già coperto da `OR-003 — No false PASS`.
- Sostituita da: —

### LL-003 — Creare e verificare il branch prima di ogni contents mutation
- Stato: ACTIVE
- Ciclo/data: POST-P2-CLOSE · 2026-10-24
- Exact SHA/riferimento: add accidentale `40f16bd901c83491638109c9cc85b1e143412e3e`; compensazione `482c62a7811655112ce91c613241e70e67464bc3`; tree ripristinato `ba5ba02d12d2920d8aa50167546516835a6cede0`.
- Obiettivo: materializzare documentazione di chiusura su un branch isolato senza mutare `main` prima della review.
- Ha funzionato: il file accidentale è stato rimosso immediatamente e il commit compensativo ha ripristinato esattamente il tree della release prima di proseguire.
- È fallito: una `create_file` è stata invocata prima di verificare l'esistenza del branch target; il retry è stato poi indirizzato erroneamente a `main`, producendo un commit placeholder non desiderato.
- Causa reale: sequenza operativa sbagliata — mutation dei contenuti prima del gate `branch exists + exact base verified`.
- Regola generalizzabile: per qualsiasi contents mutation destinata a un branch non-default, creare il branch, verificarne l'exact base SHA e passare sempre il branch esplicito alla mutation; non usare `main` come fallback operativo.
- Non ripetere: tentare `create_file`/`update_file`/`delete_file` finché il branch target non è stato creato e verificato.
- Evidenza: storia `40f16bd...` → `482c62a...`, con tree finale uguale al released tree `ba5ba02d...`.
- Promozione candidata: operating rule — promossa come `OR-009`.
- Sostituita da: —
