# DOC-01/D4c3a — Persistenza documentale verificabile, laboratorio

19 novembre 2026. Base esatta: PR #369 head `4fa180e7d825a7801e9aa5e0b6e76938903dc37b`; D4c2b 11/11 controlli completati, 136 invarianti e 1295 prove. La PR è aperta in bozza; non è autorizzata la sua integrazione.

## Compito del docente e confine di sicurezza
La conferma di un documento deve essere **durevole soltanto quando il salvataggio è verificato**, senza trasformare copie di laboratorio in documenti ufficiali. Rettifica e revoca restano eventi append-only, non riscritture. Non esiste una nuova schermata in D4c3a; impatto UX diretto nullo. In futuro la conferma userà un messaggio chiaro di esito verificato, non un successo anticipato.

## Ricognizione verificata
- Vault esistente: `SecureAppStorage.saveAppDataAndMeta` usa `vault.putMany`; coordinatore `DurableMutationCoordinator` serializza richieste.
- Il formato del Vault fisico DB2 ha dieci record; non aggiungere chiavi o creare un secondo deposito.
- V6 e V7 sono già utilizzati per le copie valutative ma **non riconoscono DOC-01**. È vietato accettare come sicuro un ripristino che cancelli revisioni o una vecchia versione che le ometta. La compatibilità e la protezione dal downgrade devono essere qualificate prima di qualsiasi attivazione.
- Campo candidato di laboratorio `appData.documentHistoryV1?` (non ancora formato di produzione). Vietato collegarlo al runtime, alla UI o ai normali backup in questa fase.

## D4c3a — Contratto RED
- API asincrona `commitDocumentHistoryOperation(owner,approvedScopes,request)`, con `owner` autenticato/iniettato dal chiamante e `request.mode=SYNTHETIC_ONLY`.
- Copia difensiva di request e scope prima del primo await. Nel coordinatore: valida intero archivio e scope **dalla versione committed più recente**; applica esattamente la transizione D4c2b, verificando la testa e senza sanare input illeciti.
- Nuovo evento: incremento meta e salvataggio atomico `appData + meta`; readback fisico della versione appena scritta; pubblicazione soltanto dopo readback identico e validazione del nuovo storico.
- Retry esatto: nessuna scrittura, incremento del contatore o pubblicazione. Conflitti e scope non autorizzati: nessuna modifica.
- Salvataggio incerto, readback discordante, perdita della sessione: nessuna ricevuta di successo; quarantena dell'owner e riapertura controllata, senza replay automatico.
- Ricevuta esplicita `verified:true` soltanto dopo lettura corrispondente. Non equivale a backup, firma, anti-rollback, timestamp certificato o idoneità alla distribuzione.
- Otto prove sintetiche RED, stub NOT_IMPLEMENTED, invariante DOC-01-D4C3A-I01; non alterare prove per raggiungere GREEN.

## Fasi successive obbligatorie
D4c3b: protezione incompatibilità v6/v7, formato futuro versionato, roundtrip v8 o decisione alternativa, downgrade e retention. D4c3c: DB2 restore/crash/Android e test di conservazione di valutazioni, Consigli, programmazione. D4c3d: autorizzazione separata dopo revisione indipendente; mai merge o deploy automatici.

LAB / SYNTHETIC_ONLY / NO_RUNTIME. Nessun archivio reale, dato scolastico, accesso ad ambienti distribuiti, versione backup promossa o modifica di `main`.
