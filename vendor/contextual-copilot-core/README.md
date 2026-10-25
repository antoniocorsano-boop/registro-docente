# TRAMA Contextual Copilot Core

Nucleo headless, provider-neutral e privacy-first per la risoluzione delle azioni contestuali e delle richieste di copilota condivise fra prodotti TRAMA.

## Confini

- nessuna UI e nessuna route applicativa;
- nessun tipo verticale di Docente OS o registro-docente;
- nessun provider generativo obbligatorio;
- capability dichiarate dall'app prima di semantica, intenti o preferenze;
- policy valutata prima di discovery, risoluzione e dispatch;
- i guardrail minimi del Core non possono essere indeboliti da policy iniettate;
- azioni mutative subordinate a conferma/autorità umana;
- `INSTITUTIONAL_DECISION` non è eseguibile né discoverable dal Core generico;
- `WRITE_EXTERNAL` non è discoverable nel contratto v0.3;
- `resolveRequest()` non è un secondo authority layer: parte soltanto dalle azioni già risolte e può restringerle, mai ampliarle;
- `discoverRequestIntent()` riconosce possibili intenzioni ma non rende un'azione disponibile, autorizzata o eseguibile;
- `DISCOVERED` non equivale mai a `allowed`;
- ogni Semantic Port e Intent Port dichiara `local` o `remote`;
- un port remoto riceve contesto e, nel caso dell'Intent Port, messaggio soltanto quando il flusso remoto è autorizzato e non contiene classi studente protette;
- `ContextSnapshot` e le azioni passate alle estensioni vengono difensivamente copiate e rese read-only;
- `generativeMode = none | local | remote` resta una guardia di execution per `RESOLVE` e `DISPATCH`; una policy personalizzata non può autorizzare un flusso generativo remoto vietato dal contesto privacy;
- nessuna autorità di dominio, persistenza dei messaggi o persistenza applicativa acquisita dal Core.

Il pacchetto implementa il contratto del Contextual Copilot Core come libreria subordinata ai contratti TRAMA OR-07 Shared Capability Layer e OR-08 Runtime Portability. Non è un server centrale né un nuovo prodotto.

## Richieste contestuali autorizzate

`resolveRequest({ context, message, allowedCapabilities })` interpreta il testo libero soltanto entro azioni già autorizzate:

1. il Core valida la richiesta e risolve le azioni tramite `resolveActions()`;
2. `allowedCapabilities` restringe ulteriormente le capability già dichiarate dal consumer;
3. `IntentPort.resolve()` può selezionare e ordinare soltanto action id già autorizzati;
4. action id sconosciuti, non autorizzati o score non finiti vengono ignorati;
5. assenza del port, nessun match valido, errore del resolver o blocco privacy producono `UNRESOLVED` con il fallback deterministico delle sole azioni consentite;
6. un Intent Port remoto non riceve il messaggio se `remoteProviderAllowed = false` o il contesto contiene `STUDENT_PERSONAL` / `STUDENT_SENSITIVE`.

`IntentPort.resolve()` conserva il contratto v0.2 e continua a ricevere esclusivamente `ResolvedAction[]`.

## Intent discovery non eseguibile

`discoverRequestIntent({ context, message, allowedCapabilities })` separa il riconoscimento dell'intento dalla disponibilità runtime dell'azione.

La discovery:

1. considera soltanto azioni presenti nel registry, dichiarate in `context.capabilities` e incluse in `allowedCapabilities`;
2. valuta la policy con `phase: 'DISCOVER'`;
3. esclude sempre `INSTITUTIONAL_DECISION` e, in v0.3, `WRITE_EXTERNAL`;
4. può riconoscere localmente una generative `PROPOSE` action come `PREPARE` anche con `generativeMode: 'none'`, perché non esegue generazione né abilita provider;
5. usa esclusivamente l'opzionale `IntentPort.discover()` e non ripiega su `resolve()` quando `discover()` manca;
6. per port remoti applica i guardrail di accesso prima di inoltrare messaggio o contesto;
7. filtra match inventati/non candidati e score non finiti, mantiene il miglior punteggio per action id e ordina score desc, priority desc, id asc;
8. restituisce soltanto `{ actionId, capability }`, senza score, `ResolvedAction`, policy `allowed` o executor;
9. non effettua dispatch, non muta il contesto e non acquisisce authority.

Le ragioni fail-closed comprendono `NO_DISCOVERABLE_ACTIONS`, `INTENT_PORT_UNAVAILABLE`, `INTENT_DISCOVERY_UNAVAILABLE`, `REMOTE_PROVIDER_NOT_AUTHORIZED`, `PROTECTED_DATA_REMOTE_DENIED`, `INTENT_DISCOVERY_FAILED` e `NO_INTENT_MATCH`.

Un consumer che riceve `DISCOVERED PREPARE` deve comunque passare attraverso il proprio percorso governato di autorizzazione/esecuzione prima che PREPARE diventi operativo.

## Verifica

```bash
npm test
npm pack --dry-run --json
```

La prova cross-app usa fixture Docente OS e registro-docente con lo stesso motore e fallisce se il sorgente del Core introduce identificatori o branching applicativi. Le regressioni verificano inoltre che policy permissive non aggirino i guardrail obbligatori, che semantica e intenti remoti non ricevano contesti protetti o non autorizzati, che intent resolution/discovery non introducano nuove capability e che le estensioni non possano mutare snapshot o azioni per ampliare authority in chiamate successive.
