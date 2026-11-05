# HEADER-01 — Piano di implementazione e qualificazione

**Stato:** piano preparatorio, senza implementazione, merge o deploy.
**Specifica:** `docs/superpowers/specs/2026-11-05-header-01-contextual-topbar-design.md`.
**Fonte canonica:** UX-GOV-01 #104; dipendenza prodotto MOBILE-ACTIONS-01 PR #118, exact SHA `89064d8b083605f952da13c6d7c1c93174d25540`.
**Condizione di partenza per il codice:** HPR Android della #118 PASS, verificata baseline definitiva (eventuale integrazione e ricalcolo SHA), confermata la posizione nella roadmap senza promuovere linee canoniche prematuramente.

## Preparazione completata (documentale)

- Analisi `Navbar.tsx`: menu, logo, privacy LIM, `registro-vault-header-actions`, selezione classe, `saveIndicatorText`, banner classe/Oggi, barra inferiore.
- Analisi `VaultControls.tsx`: portale Vault e valori blocco automatico, nessuna modifica alla sicurezza.
- Analisi `App.tsx`: origine/uso dei messaggi `toast` e timer 2800ms; pericolosa equivalenza apparente fra «Sincronizzato» e conferma di salvataggio; `handleNavigateHome` interrompe contesto classe e missione.
- Decisione UX approvata: professionale evoluta, essenziale nell'aspetto; Chromium prevalente con HPR Android essenziale.

## Incrementi RED→GREEN programmati

### Task 1 — Mappa di contesto e navigazione (RED)
- Definire un `HeaderContext` puro derivato da `activeTab`, classe autorizzata, sessioni verificate e stato di editing.
- Testare home, vista classe, tabellone, valutazioni, biblioteca, programmazione, stato senza classe, cambio contesto, titoli lunghi.
- Verificare tutti i percorsi per Oggi/Classe/ritorno e protezione della bozza. Prima di cambiare logo e breadcrumb, riprodurre un caso di editing con annullamento del passaggio.
- GREEN: mappa titolo/sottotitolo + comando di ritorno con gli stessi vincoli protettivi esistenti; non creare una nuova fonte di autorità per classe o UDA.

### Task 2 — Barra mobile compatta e pannello secondario (RED)
- Richiedere tre target accessibili sempre presenti: Menu, Privacy LIM, Blocca Registro.
- Richiedere nessun overflow 320×700 / 390×844 e nessun contrasto o focus degradato a zoom/font ingrandito.
- Richiedere che i valori di blocco automatico Mai/15/30/60 min siano accessibili tramite menu/pannello senza rimuovere il comando blocco diretto.
- GREEN: cambiare disposizione del solo header, non duplicare Copilota e barra inferiore. Tenere il contenitore del portale nella disposizione e non cambiare `SecureRegistroRoot`.

### Task 3 — Semantica della privacy e stato dell'interfaccia (RED)
- Testare stato attivo di default, alternanza dei nomi visibili/protetti, etichetta accessibile e `aria-pressed`.
- Testare disattivazione volontaria senza cambi automatici in navigazione; non mostrare dati in un'anteprima sintetica quando la protezione è attiva.
- GREEN: semantica accessibile e segnale coerente, nessuna nuova logica di mascheramento.

### Task 4 — Contratto persistente dei salvataggi (RED)
- Prima mappare tutte le sorgenti dei commit durevoli e le notifiche oggi condivise con `saveIndicatorText`.
- Definire un discriminante `SaveStatus` con origine, ambito e transizione deterministica: `unknown`, `unsaved` solo se accertato, `saving`, `saved-local`, `error`.
- Testare commit riuscito, fallito, due scritture in sequenza, toast generico tra due eventi, selezione classe, remount dell'header, conflitto di stati e fallimento in altro dominio.
- RED di regressione: una notifica qualsiasi o timeout 2800 ms non devono convertire `error` in `saved-local`.
- GREEN: separare toast informativi da stato transazionale duraturo, senza cambiare metodo o ordine dei commit; messaggio senza «Sincronizzato» fittizio. Evitare di integrare domini non ancora qualificati come «salvati».

### Task 5 — Copertura automatica e verifica indipendente
- Eseguire Invarianti, FLOW-03, PREDEPLOY, browser storico e dedicato, UX-TRUST/P2-CORE.
- Playwright reale su 320×700 e 390×844, desktop 1280×900; tastiera/focus, gesti di scorrimento, salvataggio, modalità LIM, popover Sicurezza, Copilota aperto e soppresso nelle schermate previste da #118.
- Registrare evidenze riproducibili, exact SHA, assenza di riscritture di dati reali e nessuna modifica a #116/#117.
- Revisione indipendente con 0 Critical / 0 Important e nessun thread aperto.

### Task 6 — Human Product/UX Review essenziale (non sostituibile da Chromium)
- Anteprima isolata esatta; smartphone reale con soli dati fittizi.
- Tre osservazioni mirate: comprensibilità titolo/classe; facilità tattile del blocco e della privacy; tastiera e salvataggio senza coperture o feedback ingannevoli.
- HPR PASS esplicito prima di merge e distribuzione; in caso contrario REWORK sul finding reale.

## Sequenza e limiti

1. Oggi: documenti di specifica e piano in un ramo autonomo, PR Draft documentale.
2. Alla qualifica di #118: aggiornare la base, conservare l'esatto contratto di sicurezza mobile, avviare RED→GREEN in piccoli incrementi.
3. Non promuovere HEADER-01 come linea canonica in anticipo rispetto all'ordine di #104; integrare solo dopo review e autorizzazione.
4. Niente lavoro anticipato sui dati reali, Vercel, main o altre PR.

**Esito previsto della fase presente:** specifica e piano persistenti, senza alcuna qualifica dichiarata sulla nuova interfaccia.
