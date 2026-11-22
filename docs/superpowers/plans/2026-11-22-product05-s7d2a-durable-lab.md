# VAL-01/PRODUCT-05/S7d.2a — Laboratorio cifrato e blocco di compatibilità

**Base:** PR #397 `85f0457c7ebc7d4bf813fc319d38af4c57826b07`.

## Decisone di sicurezza
Lo storico S7d.1 è definito, ma nessuna versione esistente di copia di sicurezza Web/Android (V6–V9) ha una qualifica esplicita per conservarlo. **Non attivare la scrittura nel prodotto** fintanto che un nuovo contratto di backup, ripristino conservativo e lettura nativa non sia qualificato. In particolare la proprietà `formativeBalanceHistoryV1` viene respinta dal controllo trasversale preesistente contro la perdita delle storie documentali, esteso anche al bilancio.

## Lavoro effettivo
- Nuovo adattatore isolato `src/persistence/formativeHistoryLaboratoryCommit.ts`: usa l'owner autenticato e il coordinatore condiviso esistente, fotografia dati verificata, selezione dell'alunno e ambito, confronto con revisione precedente, riconvalida delle fonti correnti S7c.
- Scrittura atomica di `appData + meta` tramite `SecureAppStorage.saveAppDataAndMeta`; incremento contatore modifiche e successiva verifica rilettura integrale `appData + meta`. Esito di successo soltanto dopo rilettura e pubblicazione. Fallimenti / revoca comportano quarantena dell'owner senza tentativo di ripristino su stato incerto.
- Le prove in memoria/cifratura sintetica usano il vero SecureVault con archivio di prova solo locale, mai dati professionali.
- È una funzione di laboratorio: esige che l'owner dichiari esplicitamente `laboratoryApproved()`, nessun import nei componenti reali, nessun pulsante Salva. La riuscita del laboratorio non costituisce autorità di scrittura professionale.
- Nessuna estensione di ClassData/AppData nei tipi canonici, niente chiavi fisiche del Vault aggiuntive, nessuna modifica al formato attivo dei backup.

## Blocchi per promozione S7d.2b
1. Definire nuovo schema esplicito (e versione backup appropriata) con validazione completa dei contenuti, protezione da decremento della versione e lettura di tutte le versioni storiche.
2. Round-trip completo browser/Android (salvataggio, chiusura, riapertura, esportazione cifrata, rilettura e ripristino, controllo revisioni senza perdita) con prove di guasto.
3. Qualifica integrale sullo SHA definitivo, revisione indipendente e decisione esplicita prima di integrare in main e prima di attivare la funzione nel prodotto.
