# STAB-06/S-R01b — Revoca della prima configurazione DB1
Base #318 0e13d7cb377508ccc742b2049a3ee9339748a8a8: 219/219 browser, 72/72 preflight. S-R04b resta separata, senza aggirare il blocco del suo flusso.

## Intervento
Dopo l'ammissione read-only, il candidato Root acquisisce un proprietario revocabile della configurazione. Controlla identità, gate, revisione di sessione, foreground Android, visibilità e assenza di sorgenti legacy. La nuova procedura iniziale verifica la guardia prima della prenotazione, durante la preparazione crittografica, prima del batch, dopo la rilettura e prima dell'attivazione. Il ramo precedente senza guardia rimane invariato. Unicamente la prenotazione riuscita attribuisce proprietà dello staging; prima dell'invocazione della scrittura ACTIVE lo staging del proprietario viene scartato in caso di errore, dopo tale invocazione non si presume rollback. Il Root chiude la chiave e rilegge lo stato fisico protetto; mostra un avviso persistente e richiede nuova configurazione o autenticazione. Non annullare transazioni già invocate, non dichiarare atomicità fra schede non cooperanti. DB2 mantiene il proprio servizio autorizzato.

## Gate
Quattro prove deterministiche su memoria per revoca prima/dopo claim, prima/dopo scrittura ACTIVE. Tre prove browser sul Root reale per ciascuno dei tre predecessori, interruzione dopo staging, batch, attivazione; conferma che non emerge il Registro, inventario e indicatore coerenti, nuovo consenso o nuova autenticazione, riapertura e dieci record. Sicurezza e contratti completi. Nessun PASS anticipato.

## Limiti
Le transazioni già invocate possono completarsi, anche in caso di revoca; la garanzia è non proseguire o pubblicare la sessione revocata e non cancellare un esito ACTIVE incerto. Residui STAGING dopo arresto del processo rimangono protetti, non recuperati automaticamente. Restano concorrenza storica non cooperante, recupero parziale, S-R04b, revisione indipendente e qualificazione nativa/cumulativa finale. Nessuna integrazione, distribuzione o modifica ai dati reali.
