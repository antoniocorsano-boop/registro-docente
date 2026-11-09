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

### LL-006 — Screenshot mobili attendibili solo dopo la conclusione delle transizioni
- Stato: ACTIVE
- Ciclo/data: INT-02/S2b · 2026-11-08
- Exact SHA/riferimento: candidato `a6d5d24e3e373c75da59f25172046bae7eeb7bb7`; merge `e6b518656efbfaeeaa85e04512fa149ef48bf91a`.
- Obiettivo: produrre quattro evidenze visive sintetiche della scelta esplicita della provenienza Biblioteca e della sua conservazione nelle verifiche, senza ripetere collaudi manuali Android.
- Ha funzionato: test Playwright sul runner GitHub, quattro screenshot mobili 390×844 nell'artefatto del browser #1803, revisione umana HPR PASS; codice applicativo immutato dopo il primo candidato qualificato e identità dell'albero del merge verificata.
- È fallito: una prima immagine acquisita subito dopo il cambio di vista mostrava il pannello di navigazione in uscita ancora parzialmente sovrapposto al contenuto, sebbene i controlli funzionali fossero verdi.
- Causa reale: `aria-hidden` precede la conclusione dell'animazione del menu laterale (300 ms), perciò la sola verifica di stato logico non garantisce un'immagine visivamente stabile.
- Regola generalizzabile: quando l'evidenza HPR dipende dall'aspetto dopo una navigazione animata, attendere una condizione geometrica osservabile (pannello completamente fuori dallo schermo) prima dello screenshot; non usare un semplice ritardo arbitrario e non attribuire HPR PASS alla sola qualificazione automatica.
- Recipe: `TR-003` per la certificazione; asserzione mirata `expectDrawerFullyOffscreen` in `tests/browser/int-02-s1-library-assessment.spec.cjs` per l'evidenza visiva.
- Non ripetere: fotografie immediatamente dopo il cambio `aria-hidden` o dichiarazione di accettazione umana senza presa visione e approvazione esplicita.
- Evidenza: PR #160, Browser Qualification #1802 (rilevazione visiva), #1803 PASS (artifact `13635091930`), ricevuta HPR #6727478607, revisione Codex #6727240052.
- Promozione candidata: nessuna nuova operating rule; caso particolare dei contratti già coperti da `OR-003` e `TR-003`.
- Sostituita da: —

### LL-007 — Il clock non puo trasferire proprieta arbitrarie alla fotografia
- Stato: ACTIVE
- Ciclo/data: CDC-02/S2b-P1 · 2026-11-09
- Exact SHA/riferimento: RED `8d2967904f9f08a946994ce8041ec3c2b8298d6b`; GREEN `a8ccaa4538293d884f3e65181a8994d355ddcb03`; merge `700428f6edf2e7b94ff3fa9b2ddf8c5d5b09cc41`.
- Obiettivo: impedire che i campi temporali introdotti alla conferma riscrivano identita e revisione di una fotografia immutabile.
- Ha funzionato: test RED causale sulla proprieta `revision: 99` e `sessionId: 'S2'` iniettate nel clock; allowlist di tre chiavi, copia esplicita dei soli campi temporali in preview e nel retry; GREEN invariato e 5/5 gate qualificati, review indipendente senza rilievi successivi.
- E fallito: un oggetto TypeScript strutturalmente compatibile con il tipo clock conteneva chiavi estranee, propagate con object spread fino ai campi canonici della fotografia. La prima fotografia poteva essere generata con revisione falsa e quindi fallire la validazione successiva.
- Causa reale: uso di spread di un oggetto di input non verificato come se fosse un insieme chiuso di proprieta autorizzate.
- Regola generalizzabile: ai confini fra input e record con identita o versione canonica, validare esattamente la forma dell'oggetto e copiare singolarmente solo i campi consentiti; testare tentativi di sovrascrittura attraverso proprieta aggiuntive.
- Recipe: applicare OR-002, OR-003 e qualificazione TR-001/003; per PR impilate usare il processo provato da LL-004 (base prima, retarget senza cambiare head, merge vincolato a exact-SHA, verifica identita dei contenuti).
- Non ripetere: trattare un tipo strutturale come garanzia di assenza di proprieta extra a runtime, ne trasferire ai futuri P2/P3 la qualifica P1.
- Evidenza: PR #181, test `src/security/cdc02CouncilSnapshots.test.ts`, run RED #42679197272, run PASS #42679348812 e Chromium #42679348562, receipt #6748973795.
- Promozione candidata: nessuna nuova regola globale; principio compreso nei controlli di validazione e OR-007.
- Sostituita da: —

### LL-008 — Il backup deve rifiutare identita di classe ambigue prima di convalidare lo storico
- Stato: ACTIVE
- Ciclo/data: CDC-02/S2b-P2 · 2026-11-09
- Exact SHA/riferimento: RED `318e34d235e55f837923713001d6401c6e57281e`; GREEN `acd22f5c7b20196af58ebc6fc23d962923d82f15`; merge `b919bbec4da7f3893069ee18dc3042f1cf4f0d41`.
- Obiettivo: ripristinare e conservare fotografie delle sedute associate a una sola classe, senza perdita silenziosa o identita ambigue.
- Ha funzionato: revisione indipendente Codex ha identificato il duplicato di ID classe; il test RED ha riprodotto l'accettazione erronea, prima della correzione. Nel GREEN `isCouncilAppDataValid` respinge ID classe duplicati/vuoti e `wouldLoseCouncilEntries` considera non garantita la conservazione degli storici in un backup con classi ambigue. Verifica integrita SHA-256 prima di Vault/restore; 5/5 gate exact-SHA e re-review Codex senza finding residui.
- E fallito: il controllo iniziale validava ogni classe isolatamente; due classi con lo stesso ID potevano superare l'importazione, mentre il selettore autorevole delle fotografie falliva per ambiguita, rendendo lo storico non consultabile.
- Causa reale: mancato controllo dell'unicita dell'identita di classe sull'intero AppData prima di validare i record locali e la loro provenienza.
- Regola generalizzabile: prima di un import/salvataggio autorevole, validare unicita e forma delle identita al livello del contenitore intero, poi integrita dei riferimenti e digest dei record; non confondere validita di ogni sotto-record con validita della struttura globale. Proteggere restore con avviso di perdita e verifica crittografica prima delle scritture.
- Recipe: OR-002/003/005/007, TR-001/002/003; PR impilate e ricevute aggiornate secondo LL-004.
- Non ripetere: validare le classi indipendentemente quando le fotografie si collegano mediante ID globale, o attribuire un PASS di revisione a uno SHA precedente alla correzione.
- Evidenza: PR #183, test `src/security/cdc02CouncilSnapshotsBackup.test.ts`, RED run #42688392188, GREEN Invarianti #42688544625, PREDEPLOY #42688544619, Browser #42688544626, seconda revisione Codex exact-SHA, ricevuta #6750192954.
- Promozione candidata: nessuna nuova operating rule; controllo di identita e fail-closed gia coerenti con OR-007.
- Sostituita da: —
