# S-R03b — Recupero storico: anteprima di compatibilità e politica di conservazione
Base #309, 4e44fb46e8c996caa488f8548b06412961903bc9. Stato: modulo isolato, non collegato al prodotto, prove da eseguire.

## Decisione di progetto
Non estendere il ripristino DB2 con una modifica del solo numero di versione. Il normalizzatore storico può riempire dataset assenti con stati vuoti, ereditare la modalità archivio e, per payload legacy senza versione, prendere alcuni dataset dalla destinazione. Questa semantica non va applicata implicitamente a un archivio attivo.

| Formato dati | Dataset presenti | Dataset non previsti all'epoca |
| --- | --- | --- |
| v2 | 6 | progettazione, biblioteca, memoria professionale, Copilota |
| v3 | 7 | biblioteca, memoria professionale, Copilota |
| v4 | 8 | memoria professionale, Copilota |
| v5 | 9 | Copilota |
| v6 | 10 | nessuno |
| Legacy senza versione | variabili | da ricostruire in base al formato esatto |
| v7 | dominio valutativo aggiuntivo | richiede autorità e verifica dedicate |

## Primo incremento
historicalRecoveryPreview.ts riceve un payload già autenticato da un futuro chiamante autorizzato. Verifica struttura esatta v2–v5, data, metadati essenziali, validazione esistente e controllo del dominio valutativo. Restituisce solo data, versione, elenco dei dataset presenti/assenti e obbligo di revisione. Nessun contenuto didattico, accesso a file, scrittura, grant o modifica a DB2. Il chiamante futuro dovrà autenticare il contenitore cifrato e la sessione; l'anteprima non autentica il file. Rifiuta legacy, v6, v7 e versioni ignote nel proprio perimetro; non cambia il ripristino v6 già previsto.

## Percorso successivo proposto (non implementato)
1. Esaminare esempi sintetici rappresentativi e attestare la provenienza dei formati.
2. Presentare un riepilogo delle informazioni presenti e assenti; non confondere assenza nel file con assenza nell'archivio attuale.
3. Conservare il file originale e la copia verificata dell'archivio corrente. Stabilire la destinazione di recupero separata prima di consentire eventuale sostituzione, senza mescolare dati da due archivi o inventare valutazioni. Nessun supporto diretto legacy prima del contratto di ricostruzione.
4. Validare e qualificare ogni formato, verificare la conservazione dei dati e richiedere consenso specifico prima di qualsiasi sostituzione. Restano vincolanti le autorizzazioni, le invarianti e i controlli di sicurezza già previsti.

## Evidenze richieste
Sette prove predisposte: quattro formati e tre gruppi di rifiuto (dataset mancanti/estranei, data e meta invalide, formati fuori perimetro). Nessun PASS nuovo attribuito. Le prove reali #308/#309 e la qualificazione cumulativa restano aperte; issue #307 non risolta. Nessuna modifica alla configurazione CI, a main o ai guardiani del ripristino. Nessuna attivazione o rilascio.