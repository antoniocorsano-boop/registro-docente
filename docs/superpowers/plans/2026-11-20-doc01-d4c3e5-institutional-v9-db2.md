# DOC-01/D4c3e5 — Recupero fisico cifrato istituzionale V9 su DB2

**Data:** 20 novembre 2026  
**Base:** PR #381, ramo `lab/doc01-d4c3e4-institutional-v9-encrypted-codec`.  
**Stato di attivazione:** laboratorio isolato, archivi e documenti esclusivamente sintetici. Nessuna integrazione in `main`, nessuna pubblicazione.

## Decisione e motivazione

Il modello istituzionale V2 e il formato cifrato di archivio V9 non devono usare il ripristino V8 del modello documentale dimostrativo V1. Il recupero richiede un adattatore V9 distinto, pur riutilizzando l'infrastruttura già qualificata per la transazione fisica DB2. Le tre numerazioni non coincidono: documenti schema V2, contenuto backup V9, involucro crittografico AES-GCM V2.

## Sequenza protetta, senza attivazione sul prodotto

1. **Titolarità e contesto.** Il proprietario è una sessione autenticata su `ExistingSessionVaultStore(2)`, con chiave presente, coda delle scritture e identificativo di sessione nativa. Ambiti di valutazione e contesto scolastico autorizzato provengono dall'esterno dei file.
2. **Acquisizione.** Selezione separata della copia cifrata di recupero e della copia di destinazione tramite il lettore Android SAF esistente, soggetto alle verifiche native di dimensione e impronta quando effettivamente utilizzato. Gli adattatori fittizi sono ammessi soltanto nelle prove isolate del navigatore.
3. **Preparazione.** Riscontro del proprietario fisico, chiusura delle nuove scritture, completamento di quelle già ammesse, lettura esatta dei dieci record. Rifiuto della storia V1 e verifica dello storico V2 contro il contesto approvato. Decrittazione autenticata delle due copie, proiezione V9 senza perdite di revisioni, valutazioni, studenti e dati pregressi.
4. **Dismissione.** Prima di un possibile rilascio del permesso fisico, l'ambiente precedente perde lo stato applicativo, chiude la connessione e blocca la chiave. Un fallimento dopo la chiusura delle scritture non riattiva automaticamente la precedente sessione.
5. **Conferma.** Un supervisore separato dalla vecchia vista gestisce un'autorizzazione docente esplicita `RIPRISTINA`, con permesso utilizzabile una sola volta. Nessuna conferma produce di per sé un esito positivo del ripristino.
6. **Sostituzione.** Nuova immagine completa cifrata, verificata prima della scrittura. Confronto atomico dell'intero inventario DB2 e del precedente proprietario, rifiuto della sessione scaduta e della seconda utilizzazione del permesso. Nessun ripristino automatico all'indietro in caso di esito incerto.
7. **Riaccesso indipendente.** Una nuova autenticazione, con identificativo di sessione differente, riapre DB2, verifica tutti i record cifrati e lo storico V2 istituzionale e rivalida l'archivio valutativo. **Solo allora** può risultare completato.

## Prove e limiti

- `src/security/doc01InstitutionalDb2V9Boundary.test.ts`: vincoli del servizio, separazione dal prodotto, revisione e conferma del docente, autenticazione successiva.
- `tests/browser/doc01-d4c3e5-institutional-v9-db2.spec.cjs`: sette scenari su un vero IndexedDB2 sintetico: sostituzione fisica e riapertura, annullamento, sessione scaduta, checkpoint di recupero errato, contesto non autorizzato, password errata, tentativo di attribuire successo senza nuova sessione.
- Le verifiche specifiche Android del formato V9, comprese la persistenza dopo interruzione del processo e l'acquisizione SAF su dispositivo, **non sono considerate superate** per analogia con V8. Restano un collaudo distinto.
- Nessun collegamento a `App.tsx`, `SecureRegistroRoot.tsx`, `PrivacyView.tsx`, registro elettronico, distribuzione o dati reali.
- Non è affrontata la migrazione V1→V2, né è introdotto un servizio remoto o un costo.

## Riesame prima di un eventuale rilascio

Verificare i risultati automatici sul codice esatto, le prove di recupero dopo riavvio del processo Android con dati sintetici, la protezione della sessione e delle copie native, il comportamento nei casi di interruzione del sistema, le condizioni di attivazione per la privacy e la revisione indipendente. Tenere separati stato del codice, qualificazione tecnica e autorizzazione alla pubblicazione.
