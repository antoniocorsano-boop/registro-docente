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

### LL-004 — Integrare PR impilate senza perdere il confine di qualificazione
- Stato: ACTIVE
- Ciclo/data: UX-TRUST-01 · 2026-10-24
- Exact SHA/riferimento: candidate qualificato `1f98efb6638a5ef43d3da94f671fae2ca5a6b614`; application merge `7491ed86941ca677b49ce15bb413affe45971cdd`; receipt merge `76c837470485bfcf9eaddb7e14aeff68a15a26ef`.
- Obiettivo: integrare una PR applicativa qualificata costruita sopra una PR baseline separata senza cambiare il candidate né attribuire evidenza a SHA non verificati.
- Ha funzionato: prima è stata integrata la baseline #29; poi #30 è stata retargettata a `main` mantenendo invariato l'exact head qualificato; il merge è stato eseguito con `expected_head_sha` pinning e il tree dell'application merge è risultato identico al tree del candidate qualificato. I gate post-integrazione hanno confermato il nuovo stato del repository.
- È fallito: il receipt preparato prima della decisione umana era diventato semanticamente obsoleto dopo l'integrazione e avrebbe registrato ancora `NOT AUTHORIZED / OPEN` se fosse stato mergiato senza correzione.
- Causa reale: nelle integrazioni impilate esistono due rischi indipendenti — drift del codice tra qualification e merge, e drift documentale tra decisione registrata e decisione effettivamente eseguita.
- Regola generalizzabile: per integrare una PR qualificata impilata, integrare prima la base, retargettare la PR figlia senza cambiare head, pinning del merge all'exact qualified SHA, verificare la tree identity quando applicabile e aggiornare i receipt dopo la decisione umana senza trasferire la qualification a nuovi SHA.
- Recipe: candidata una futura recipe di integrazione stacked/exact-SHA; non ancora promossa.
- Non ripetere: rebase/cherry-pick non necessario di un candidate già qualificato, merge senza head pinning, oppure merge di un receipt che conserva uno stato decisionale ormai falso.
- Evidenza: PR #29 → merge `c1fce98f977c27e6fdf711c53202435128e33c9d`; PR #30 exact head `1f98efb...` → merge `7491ed...`; tree condiviso `cce9c8ae9f9b8c161aa65b79cb77420911ca195c`; PREDEPLOY #321 PASS; PR #33 receipt aggiornato e merge `76c837...`; PREDEPLOY #324 PASS.
- Promozione candidata: recipe.
- Sostituita da: —

### LL-005 — Il Planning Context resta vincolato al Teaching Context che lo ha risolto
- Stato: ACTIVE
- Ciclo/data: LIB-03B · 2026-10-25
- Exact SHA/riferimento: review RED `53aacd9a40e65d09cef7efe49a3c9bc43c2272dc`; qualified candidate `524a4bf9cf5799906d74f0527e654b18c0bad87d`; merge `ab55ef83a38012fbaf4eb5e0c0e865cfa2aeef8a`.
- Obiettivo: usare il profilo annuale LIB-03A come segnale di pertinenza senza trasferirlo a un contesto didattico diverso.
- Ha funzionato: un ciclo RED → GREEN dedicato ha imposto che il resolver usi il Teaching Context incorporato nel risultato LIB-03A quando è l'unica fonte disponibile e neghi `PLANNING_GRADE_MATCH` quando un Teaching Context esplicito è incompatibile.
- È fallito: la prima implementazione consentiva di riusare un planning profile già risolto insieme a un Teaching Context esplicito diverso, creando un boost di pertinenza non più legato alla stessa identità operativa.
- Causa reale: il risultato del Planning Context Bridge veniva trattato come profilo annuale riutilizzabile invece che come read model derivato e vincolato al Teaching Context di origine.
- Regola generalizzabile: ogni segnale derivato da un contesto composto deve restare legato all'identità operativa che lo ha prodotto; un override esplicito richiede rivalidazione e deve fallire chiuso in caso di mismatch.
- Recipe: nessuna nuova recipe; applicare TDD causale e rivalidazione dell'identità prima di riusare segnali derivati.
- Non ripetere: combinare un `LibraryPlanningContextResolution` risolto con un Teaching Context differente assumendo che il solo livello classe renda il profilo ancora valido.
- Evidenza: PREDEPLOY #595 RED causale; PREDEPLOY #596 PASS; Browser Qualification #315 PASS; PR #51.
- Promozione candidata: nessuna per ora; il principio è coperto da fail-closed/causalità, ma resta memoria episodica utile per LIB-03C.
- Sostituita da: —
