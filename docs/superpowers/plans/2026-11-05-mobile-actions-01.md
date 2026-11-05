# MOBILE-ACTIONS-01 — Piano di qualificazione

1. **Specifica:** fissare perimetro A/B e contratti di sicurezza.
2. **RED:** test sorgente Bun e prova Chromium mobile per trigger Copilota compatto/scroll/focus, con dati sintetici. Registrare entrambi nel catalogo invarianti.
3. **GREEN A:** realizzare logica di visibilità locale al componente, senza interferire con sessione o navigazione.
4. **Regressioni:** 390×844, 320×700, desktop 1280×900, pannello Copilota, blocco manuale, input con fuoco, barra inferiore.
5. **Qualifiche:** Invariants, PREDEPLOY, FLOW-03 e Browser Qualification sullo stesso SHA; revisione indipendente con zero rilievi importanti.
6. **Revisione umana:** collaudo Android in Vercel isolato senza dati reali, solo dopo qualifica. L'eventuale lavoro sui controlli di sicurezza è incremento B separato e richiede proprie prove/approvazione.

**Blocchi:** nessun merge, produzione, alias stabile, modifica Vault o persistenza. **Dipendenza:** NAV-S1 #117 non integrato; questa PR non contiene la sua implementazione.
