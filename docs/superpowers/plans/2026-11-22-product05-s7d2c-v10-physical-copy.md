# VAL-01/PRODUCT-05/S7d.2c — Laboratorio di verifica fisica della copia V10

Data: 22 novembre 2026. Base PR #400, SHA 754c0c6ee5c01fd34f53157bcf22f5da0a6e8c36.

## Motivazione
Il codec V10 (S7d.2b) produce e ispeziona una copia cifrata AES-GCM V2, ma non dimostra che un file sia stato scritto/riletto. Gli archivi effettivi usano BACKUP-02 Web con verifica di file riscelto e il ponte Android RegistroBackupFiles con ricevuta di byte e SHA-256. Il campo di attestazione persistente in `SecureMeta` è ancora legato a versione 6: non aggiornarlo con una V10 simulata.

## Ambito dell'incremento
- `src/persistence/formativeV10CopyLaboratory.ts` crea un'autorità monouso di **sola simulazione**, attiva esclusivamente con `laboratoryApproved()` e `isActive()`.
- Preparazione: snapshot staccato, checkpoint logico con contatore azzerato, creazione V10 valida, cifratura con codec esistente, decrittazione e controllo di esatta corrispondenza V10 del file serializzato. Il controllo SHA-256 sui byte cifrati è separato dall'autenticazione AES-GCM.
- Verifica Web: NON considera confermato il download, controlla un Blob realmente letto e byte-identico alla copia attesa.
- Verifica Android: utilizza il ponte nativo esistente che rilegge il contenuto cifrato e restituisce byte+digest, solo tramite un adattatore sintetico iniettato. Nessuna nuova interfaccia Android.
- Consumo: permesso una sola volta, senza scritture in `SecureMeta`; rifiuta prove obsolete, modifiche intervenute tra preparazione e attestazione e revoche di sessione. Nessuna memorizzazione della password o del testo in chiaro nell'autorità.
- Ripristino: preview di due file cifrati autenticati, copia di recupero esatta e proiezione senza perdita mediante le protezioni V9/V10; non passa a `SecureAppStorage.restoreSnapshotVerified` e non scrive DB2.
- I test usano esclusivamente dati inventati e stubs del file system / ponte Android.

## Protezioni non rimosse
Restano vietati salvataggio di `formativeBalanceHistoryV1` nel `SecureAppStorage` di produzione, backup V6–V9 incompleti, promozione automatica della V10, diffusione e merge. Le prove native vere su Android e il flusso Web reale rimangono da qualificare. La protezione amministrativa di `main` resta posticipata e non viene toccata.

## Gate finale rimasto
Nuovo formato di ricevuta locale di versione, adapter fisico di scrittura cifrata con autorizzazione docente, verifica della transazione e recupero sui dispositivi Android API 32/36, browser, revisione indipendente; candidatura cumulativa allineata con main, qualifica completa e decisione esplicita.
