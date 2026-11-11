# MOBILE-01/M1 — Piano di implementazione e prova

1. Sorgente e licenza: recuperare **stessa** versione UMD 0.10.1 e relativa licenza dal repository del manutentore, verificare che i blob Git coincidano; conservarli in `public/vendor`.
2. Caricamento: aggiornare esclusivamente riferimenti esterni in `index.html` e la catena tipografica del `body`; non cambiare componenti, contenuti o dati.
3. Regressione automatica: contratto SHA blob/licenza e verifica reale in Chromium di un PDF sintetico generato con tutte le richieste esterne bloccate.
4. Qualificazione: test di sicurezza, invariante, PREDEPLOY, Browser e revisione indipendente exact-SHA. Correggere soltanto gli errori riprodotti sul commit candidato.
5. Allineamento Android: dopo M1, riconciliare il ramo Capacitor #208 e generare un **nuovo** APK sperimentale con risorse PDF locali, senza pubblicazione o dati reali. Verificare anche eventuali richieste di rete derivanti da altri moduli non compresi in M1.
6. Non considerare completato MOBILE-01 senza test Android su Vault, import/export, aggiornamento e UX-QA-03. Nessun merge senza qualificazione, nessun deploy da solo.

**Nota:** la modifica della fonte tipografica verso il font di sistema può cambiare lievemente spaziature; validare le schermate pertinenti e mantenere i comandi del docente leggibili.
