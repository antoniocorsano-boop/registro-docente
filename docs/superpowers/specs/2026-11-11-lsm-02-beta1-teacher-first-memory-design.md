# LSM-02 — Memoria locale essenziale per Beta 1

**Data:** 2026-11-11
**Stato:** Design di incremento isolato; nessuna distribuzione
**Autorità:** UX-GOV-01 #104, BETA-1 #204, LSM-02 #205, PRODUCT-QUALITY-01
**Baseline:** `main@ce4644fc63b4b08090ab6737746caa86da01f576`

## Problema
Il componente `SemanticMemorySettings` oggi espone un indirizzo tecnico e cita Termux nella vista ordinaria. Il motore resta facoltativo, il Registro mantiene la ricerca testuale della Biblioteca e il token non viene digitato.

## Obiettivo dell'incremento
Il docente capisce **in un colpo d'occhio** che la ricerca testuale è disponibile, può attivare esplicitamente la memoria per significato quando esiste un servizio locale e, in caso di mancata disponibilità, continua a lavorare senza comandi tecnici.

## Interfaccia
- Stato iniziale: «Non attiva. Puoi continuare a cercare nella Biblioteca.»
- Azione principale: «Attiva memoria locale»; non promette l'installazione di un motore.
- In assenza di servizio: «La ricerca per significato non è disponibile su questo dispositivo. Puoi continuare a cercare nella Biblioteca.»
- Pronta: «Memoria locale connessa e pronta.» con azioni «Sincronizza» (volontaria) e «Disattiva».
- Unica sezione secondaria chiusa per impostazione iniziale: «Configurazione avanzata» con campo «Endpoint locale» e nota sulla credenziale locale effimera.
- Nessuna informazione su Termux, porte, token o server compare nella superficie ordinaria.

## Vincoli
Nessuna modifica a client di rete, avvio runtime, policy privacy, Secure Vault, proiezioni professionali, contratto di sincronizzazione, sessioni effimere. Nessuna richiesta su apertura Impostazioni. Nessuna promessa di IA generativa senza rete.

## Accettazione
Contratti LSM-01C/01D invariati, scenario Chromium con dettagli tecnici chiusi all'avvio, apertura deliberata dei dettagli, pulsante di attivazione e fallback testuale; prova su telefono riservata alla UX-QA-03 complessiva se il funzionamento è congruente. Qualifiche e revisione indipendente sul commit esatto, nessuna integrazione o distribuzione automatica.

## Confine di Beta 1
Un'eventuale memoria semantica non disponibile nel contenitore APK non blocca le funzioni fondamentali: il ripiego testuale rimane. L'avvio realmente autonomo di un motore sul telefono non è dichiarato finché non viene qualificato in MOBILE-01.
