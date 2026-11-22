# VAL-01/PRODUCT-05/S7d.3c — Protocollo sperimentale di transazione e quarantena V10
Data: 22 novembre 2026. Base esatta PR #406 @ 3a56726f7c4558d93a8afd9c830a6b8eedebf114.
 
## Scopo
Collaudare, **senza alcun collegamento ai dati professionali**, il protocollo di candidatura di una ricevuta V10 prima del trasferimento su sistemi effettivi. Il coordinatore usa il medesimo modello di coda seriale dei salvataggi applicativi, ma tutti i suoi componenti sono interfaccie per memoria sintetica e non possono diventare una concessione operativa.

## Le due radici sperimentali
1. **Contenitore cifrato**: archivio sintetico con confronto e sostituzione atomici del registro versionato delle ricevute e del relativo contenitore autenticato AES-GCM.
2. **Testimone indipendente**: archivio sintetico con avanzamento monotono e condizionato (epoch, intestazione digest, identificativo sessione, digest snapshot consolidato). Deve rispondere «assenza comprovata», «stato stabilito» o «impossibile verificare». Il solo file mancante non vale come assenza comprovata.

La separazione viene fatta prima delle scritture. Un controllo preventivo autentica registro e metadati con riferimenti ottenuti dal testimone; una nuova ricevuta non è mai una fonte autorevole per la sua stessa intestazione. Una prova della copia fisica è ancora la vecchia ricevuta di laboratorio V10, **non una prova autentica di possesso del file in produzione**.

## Protocollo
1. Controllo di sessione e della memoria consolidata sotto la coda seriale. Preparazione di un titolo monouso associato all'identità dell'oggetto, senza scrittura.
2. Consumo preventivo del titolo e nuovo controllo di testa, versione e impronta dello snapshot consolidato.
3. Preparazione del nuovo registro e del nuovo contenitore cifrato; confronto e sostituzione atomici della coppia (solo archivio sintetico).
4. Rilettura esatta e verifica crittografica di coppia e intestazione prevista, prima del secondo avanzamento.
5. Avanzamento condizionato del testimone indipendente; ulteriore rilettura. Solo in caso di corrispondenza esatta viene emesso **lab-anchored-not-official**, mai «backup verificato».

## Limitazioni e reazione ai guasti
Non esiste una transazione atomica distribuita tra i due archivi. Se l'archivio delle ricevute viene aggiornato e il testimone no, la condizione risultante non viene sanata automaticamente. Qualsiasi tentativo di scrittura dall'esito dubbio provoca **quarantena**, invalidazione della sessione e divieto di nuovo tentativo con la stessa autorizzazione. Il controllo di recupero è esclusivamente di lettura.

Il sistema può rilevare il riavvolgimento **di un solo archivio**, a patto che l'altro resti autentico. **Non può rilevare un riavvolgimento coerente di entrambi**. Il testimone monotono realmente durevole e indipendente dall'applicazione non viene implementato qui: finché non esiste, non è corretto affermare che il rischio di ripristino a uno stato precedente sia risolto.

## Invarianti
- Nessuna modifica di SecureMeta, SecureAppStorage, gestione V6–V9, VaultStore/DB2, Android, AppData, UI.
- Nessun diritto di ripristino o backup professionale, nessuna integrazione in main.
- Nessuna attivazione di servizi aggiuntivi, costo o pubblicazione remota.
- Collaudo su dati inventati, interruzioni prima/dopo ogni punto di scrittura, alterazione dei dati, contatori, regressione del riferimento, riuso di autorizzazioni e casi di riavvolgimento simultaneo.

## Passi successivi obbligatori
S7d.3d: laboratorio fisico browser/Android API 32/36, prova di scrittura e ripristino, valutazione di un vero testimone anti-rollback locale, senza presumere caratteristiche del dispositivo.
S7d.3e: revisione di sicurezza indipendente, analisi dei fallimenti, verifica cumulativa delle invarianti e decisione esplicita sul rilascio, senza merge automatico.
