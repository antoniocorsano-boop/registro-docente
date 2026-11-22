# VAL-01/PRODUCT-05/S7d.3b — Metadati V10 cifrati, separati e non ufficiali
Data: 22 novembre 2026. Base: PR #403 @ d05fc503ead7d626f5ecb6f0e1703b308e3a506d.

## Contenuto di S7d.3b
Contenitore candidato versione 1 (payload V10) sottoposto a cifratura autenticata AES-GCM con AAD dedicata tramite le primitive già presenti nel progetto. Conserva soltanto identificativi tecnici: intestazione SHA-256 del registro S7d.3a, versione, conteggio, digest della copia fisica, digest dello snapshot, legame con la sessione sintetica e date. Non contiene nominativi né dati scolastici.

L'apertura richiede un registro completo verificato e tre riferimenti passati indipendentemente: intestazione del registro, impronta dell'ultimo snapshot consolidato e identificatore della sessione. La corrispondenza con i dati cifrati viene verificata dopo l'autenticazione. Una firma crittografica valida di un contenitore antico, da sola, non impedisce il rollback: se anche il riferimento esterno viene riportato indietro, questo modulo non lo riconosce.

## Confini di sicurezza e compatibilità
- Solo prove sintetiche, chiave AES-GCM di laboratorio fornita dal chiamante; nessuna integrazione con SecureVault in produzione, SecureMeta, AppData, DB2 o Android.
- Stato costante: lab-authenticated-not-official. Nessuna emissione di verifiedBackupEvidence, nessuna promozione a backup ufficiale.
- La V6 resta l'unica attestazione prevista dal percorso applicativo attivo. I percorsi V6–V9 e le barriere per formativeBalanceHistoryV1 restano invariati.
- Non è ancora disponibile una radice di fiducia duratura o una transazione unica tra file, registro, metadati e Vault: la progettazione deve assumerne l'assenza e bloccare ogni promozione.

## Verifiche
Cifratura/decifratura, chiave e dominio errati, IV/testo cifrato alterati, cambio sessione, snapshot e testa, registro troncato, riuso di ricevuta vecchia, strutture malevole, date regressive e regressione V6.

## Successive fasi vincolanti
S7d.3c: coordinamento delle scritture con autorizzazione monouso, commit e rilettura esatti, persistenza fidata della testa e protocollo di quarantena e recupero; disegno esplicito della minaccia rollback.
S7d.3d: browser fisico Web e Android nativo API 32/36 con interruzioni e recupero conservativo.
S7d.3e: prova completa di non regressione, revisione indipendente e decisione umana prima di ogni integrazione.

Nessuna integrazione nel ramo principale e nessuna pubblicazione.
