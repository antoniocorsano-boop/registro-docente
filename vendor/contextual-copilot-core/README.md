# TRAMA Contextual Copilot Core

Nucleo headless, provider-neutral e privacy-first per la risoluzione delle azioni contestuali e delle richieste di copilota condivise fra prodotti TRAMA.

## Confini

- nessuna UI e nessuna route applicativa;
- nessun tipo verticale di Docente OS o registro-docente;
- nessun provider generativo obbligatorio;
- capability dichiarate dall'app prima di semantica, intenti o preferenze;
- policy valutata prima della risoluzione e prima del dispatch;
- i guardrail minimi del Core non possono essere indeboliti da policy iniettate;
- azioni mutative subordinate a conferma/autorità umana;
- `INSTITUTIONAL_DECISION` non è eseguibile dal Core generico;
- `resolveRequest()` non è un secondo authority layer: parte soltanto dalle azioni già risolte e può restringerle, mai ampliarle;
- ogni Semantic Port e Intent Port dichiara `local` o `remote`;
- un port remoto riceve contesto e, nel caso dell'Intent Port, messaggio soltanto quando il flusso remoto è autorizzato e non contiene classi studente protette;
- `ContextSnapshot` e le azioni passate alle estensioni vengono difensivamente copiate e rese read-only;
- `generativeMode = none | local | remote` è una guardia del Core: una policy personalizzata non può autorizzare un flusso generativo remoto vietato dal contesto privacy;
- nessuna autorità di dominio, persistenza dei messaggi o persistenza applicativa acquisita dal Core.

Il pacchetto implementa il contratto del Contextual Copilot Core come libreria subordinata ai contratti TRAMA OR-07 Shared Capability Layer e OR-08 Runtime Portability. Non è un server centrale né un nuovo prodotto.

## Richieste contestuali

`resolveRequest({ context, message, allowedCapabilities })` aggiunge un ingresso conversazionale senza modificare l'autorità del normale resolver:

1. il Core valida la richiesta e risolve le azioni tramite `resolveActions()`;
2. `allowedCapabilities` restringe ulteriormente le capability già dichiarate dal consumer;
3. un `IntentPort` opzionale può selezionare e ordinare soltanto action id già autorizzati;
4. action id sconosciuti, non autorizzati o score non finiti vengono ignorati;
5. assenza del port, nessun match valido, errore del resolver o blocco privacy producono `UNRESOLVED` con il fallback deterministico delle sole azioni consentite;
6. un Intent Port remoto non riceve il messaggio se `remoteProviderAllowed = false` o il contesto contiene `STUDENT_PERSONAL` / `STUDENT_SENSITIVE`.

Il Core non persiste `message`, non crea capability dal testo libero e non converte una proposta in write senza i normali guardrail di rischio e conferma.

Le ragioni di fallback previste includono `INTENT_PORT_UNAVAILABLE`, `NO_INTENT_MATCH`, `INTENT_RESOLUTION_FAILED`, `REMOTE_PROVIDER_NOT_AUTHORIZED` e `PROTECTED_DATA_REMOTE_DENIED`.

## Verifica

```bash
npm test
npm pack --dry-run
```

La prova cross-app usa fixture Docente OS e registro-docente con lo stesso motore e fallisce se il sorgente del Core introduce identificatori o branching applicativi. Le regressioni di confine verificano inoltre che policy permissive non aggirino i guardrail obbligatori, che semantica e intenti remoti non ricevano contesti protetti o non autorizzati, che l'intent resolution non introduca nuove capability e che estensioni non possano mutare snapshot o azioni per ampliare authority in chiamate successive.
