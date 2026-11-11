# LSM-02 — Piano di incremento breve

**Data:** 2026-11-11
**Autorità:** specifica `2026-11-11-lsm-02-beta1-teacher-first-memory-design.md`, issue #205.
**Ramo isolato:** `feat/lsm02-beta1-teacher-first`
**Ambito:** esclusivamente UI Impostazioni + adeguamento test.

1. **RED contrattuale:** estendere scenario browser LSM-01C per verificare che la configurazione sia nascosta inizialmente, si apra solo su scelta, compaia ripiego comprensibile e nessun segreto sia esposto.
2. **GREEN UI:** modificare unicamente `SemanticMemorySettings.tsx`: testo orientato al docente; controllo di connessione sempre esplicito; gruppo «Configurazione avanzata» chiuso; ritorno a Biblioteca in caso di errore.
3. **REGRESSION:** preservare POST esplicita una volta sola su `/v1/session`, assenza di auto-sync, ricerca testuale, blocco fonti personali, stato session-only, disconnessione.
4. **QUALIFICATION:** usare workflow esistenti su head esatto; ispezionare fallimenti nuovi senza mascherare i test o rilanciarli indiscriminatamente. Richiedere revisione indipendente.
5. **DECISIONE:** integrazione e HPR soltanto dopo gli esiti. Aggiornare #205, #204 e #104. Nessun avvio di Termux o distribuzione.

**Stop:** se richiede un nuovo runtime o un server Android, rinviare quel lavoro alla valutazione architetturale MOBILE-01, mantenendo il Registro offline essenziale.
