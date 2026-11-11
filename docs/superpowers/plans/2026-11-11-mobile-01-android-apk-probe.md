# MOBILE-01/S0 — Piano di realizzazione della prova Android

**Data:** 11 novembre 2026  
**Stato:** PR isolata, nessuna pubblicazione.
**Specifica:** `docs/superpowers/specs/2026-11-11-mobile-01-android-apk-probe-design.md`

1. **Contratti**: provare che configurazione ed esecutore sono isolati, che non viene aggiunto un server HTTP Android o un URL remoto, che workflow e package non richiedono segreti e che non esiste evento di distribuzione `push: main`.
2. **Scaffolding di prova**: creare `mobile/android-probe/package.json` con tre dipendenze Capacitor 8.6.0 bloccate e `capacitor.config.json` con `webDir: ../../dist`, appId di sola prova.
3. **Esecutore GitHub**: checkout dello SHA esatto della PR; Bun con lock congelato per compilare il frontend; Node 22 + Java 21 + SDK 36; installazione isolata del progetto Capacitor; `cap add android`, `cap sync android`, `gradlew assembleDebug`; verifica firma debug e hash; caricamento artefatto GitHub di breve durata.
4. **Diagnosi**: distinguere dipendenza Gradle/npm/rete da errore applicativo. Non cambiare main e non moltiplicare workflow; riparare solo lo step effettivamente fallito. Registrare esito con SHA esatto.
5. **Revisione**: esaminare il codice/workflow prima di ogni nuova prova, chiedere revisione indipendente exact-SHA; non integrare in main né pubblicare APK.
6. **Decisione**: se S0 PASS, passare all'inventario di interventi offline/PDF/Vault/backup necessari; il primo APK resta una prova non utilizzabile con dati veri.

**Stop condition:** nessun artefatto o manifest dopo fallimento dei prerequisiti; nessuna dichiarazione di rilascio senza UX-QA-03.
