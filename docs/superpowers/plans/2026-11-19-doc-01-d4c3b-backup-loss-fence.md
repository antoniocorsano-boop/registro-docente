# DOC-01/D4c3b — Barriera di incompatibilità dei backup v6/v7

19 novembre 2026. Base esatta: DOC-01/D4c3a GREEN `fc57388fcb08f5da7d38bb26ff18786062104c42`, 137 invarianti, 1303/1303 prove. PR #370 in bozza, indipendenza e promozione ancora da acquisire.

## Rischio e decisione
Il campo sintetico `appData.documentHistoryV1` non è conosciuto dai formati v6/v7. Il fatto che un parser restituisca JSON non prova la compatibilità di nuove revisioni: un vecchio backup può cancellarle o una versione non aggiornata può importarle senza validarle.

**Decisione D4c3b:** fino a una qualifica dedicata di un nuovo formato/contratto di restore, le API v6 e v7 rifiutano esplicitamente qualsiasi presenza del dominio DOC-01, sia nell'input da esportare, sia nel backup da importare, sia nel deposito attuale da sostituire. Il rifiuto è preferibile alla perdita silenziosa; non inventare versioni v8.

## Contratto RED
- Introdurre controllo riutilizzabile `assertNoUnsupportedDocumentHistory`: scansione difensiva con limiti, senza invocare getter, rivela chiavi riservate in qualsiasi ramo; ingresso non ispezionabile rifiutato.
- Riutilizzare la barriera nei produttori/lettori v6 e v7. La vecchia versione non diventa implicitamente proprietaria dello storico.
- `SecureAppStorage.restoreSnapshotVerified` deve controllare il contenuto fisico attuale prima della scrittura, anche se il chiamante fornisce `previousLogical` privo dello storico. Rifiutare anche snapshot candidati con DOC-01.
- Non modificare la lettura ordinaria del Vault, non introdurre deposito parallelo, versioni o scrittura DOC-01 nel runtime. Anche quando non c'è lo storico, l'intero comportamento v6/v7 deve rimanere invariato.
- Dieci prove sintetiche: nove RED di protezione, una compatibilità ereditata positiva. 138 invarianti attese. Documentare RED causale prima del GREEN senza modificare i test.

## Limiti
Questo è un *blocco di sicurezza*, non il formato backup DOC-01. Successive D4c3c/d dovranno definire versionamento, recupero, rollback/downgrade, Android e conservazione con consenso distinto. Non promuovere finché non esiste un percorso di recupero. Nessun dato reale, UI, merge o deploy.

LAB/SYNTHETIC_ONLY/NO_RUNTIME.
