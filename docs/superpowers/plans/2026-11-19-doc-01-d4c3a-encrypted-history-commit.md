# DOC-01/D4c3a — Ammissione cifrata e atomica dello storico (laboratorio)

Data: 19 novembre 2026. Base esatta: PR #369, SHA `4fa180e7d825a7801e9aa5e0b6e76938903dc37b`. D4c2b: 11/11 workflow PASS, 136 invarianti registrate, 1295 prove contrattuali PASS. Non è una revisione indipendente né autorizzazione a pubblicare.

## Scelta architetturale

Il deposito corrente DB2 ammette solo le dieci chiavi professionali di `VaultRecordKey` e ne verifica il numero in fase di lettura, ripristino e autenticazione. Inserire una undicesima chiave a posteriori nella base corrente o occultare lo storico dentro un altro dataset romperebbe le invarianti di compatibilità e la reversibilità. Nessuna scrittura nella base reale è autorizzata da D4c3a.

Si introduce un *raccordo transazionale* con interfaccia minima `DocumentHistoryAtomicStorage`, isolata in `src/persistence/documentHistoryEncryptedCommit.ts`:
- il proprietario della sessione fornisce il coordinatore canonico delle mutazioni, una chiave AES-GCM già autenticata e il deposito; non vengono generate chiavi operative nuove;
- le richieste sono copiate difensivamente prima dell'accesso asincrono, poi si rilegge lo storico cifrato autorevole e si applica il validatore D4c2b sull'intera catena e sui soli scope approvati;
- l'impronta D4c2b controlla l'integrità logica; `encryptJsonRecord` vincola la cifratura autenticata AES-GCM alla chiave logica e alla versione del formato;
- il deposito DEVE confrontare la generazione e scrivere il nuovo record in un'unica transazione durevole `compareAndSwap`; il valore restituito deve rappresentare una transazione conclusa, non una richiesta avviata;
- dopo la scrittura si verifica la rilettura della generazione e l'intero archivio decifrato prima della ricevuta; un esito incerto nega la ricevuta e richiede rilettura o retry idempotente;
- il cambio di sessione prima, durante o dopo il salvataggio impedisce di confermare successo a un proprietario non attuale. Non si riscrivono copie storiche né si ammettono fork.

## Cosa NON è dimostrato da D4c3a

L'interfaccia descrive le garanzie obbligatorie ma il deposito DB2/DB3 non è ancora collegato. Le prove con un simulatore atomico dimostrano comportamento della logica, non persistenza fisica IndexedDB, crash recovery o protezione da rollback. AES-GCM non equivale a firma; una catena di impronte non prova l'identità del docente e non impedisce da sola il ripristino di un archivio interamente precedente.

## Percorso verso la persistenza effettiva

1. **D4c3b:** definire e qualificare il formato nuovo versionato, migrando il contenuto cifrato DB2 solo dopo copia di recupero verificata e autorizzazione esplicita; proprietario unico della sessione e generazione verificata nella transazione IndexedDB; nessun aggiornamento implicito al caricamento.
2. **D4c3c:** backup e ripristino: formato esplicito, conservazione dello storico confermato, rifiuto di downgrade e di perdita delle revoche; protezione dall'eventuale ripristino di una testa più vecchia con riferimento durevole indipendente. Verificare disconnessione, interruzioni, scritture simultanee e fallimenti alla lettura.
3. **D4c3d:** collegamento dell'interfaccia docente solo dopo verifica indipendente delle precedenti garanzie, gestione del tempo di conservazione e prova di cancellazione autorizzata; nessuna nuova interfaccia operativa in D4c3a.

## Qualificazione richiesta

Nuova prova specifica `src/security/doc01EncryptedDocumentHistoryCommit.test.ts`, con documenti esclusivamente fittizi derivati dal produttore D4c1: crittografia e lettura; retry invariato; revoca; conflitto di generazione; mancata persistenza; archivio manomesso; lettura incoerente; revoca di sessione; richiesta/scope non validi; separazione dalla produzione. Registro invarianti esteso a 137 con DOC-01-D4C3A-I01. Conservare integralmente le 1295 prove D4c2b e le 5 prove di convergenza D4c2a-Q.

**Stato:** LAB/SYNTHETIC_ONLY/NO_RUNTIME; branch separato. Nessun merge in `main`, distribuzione, modifiche agli archivi, backup o dati personali. Richiesta revisione indipendente prima della promozione. Conservare traccia di ogni decisione e della ricevuta GREEN/RED con SHA esatto.
