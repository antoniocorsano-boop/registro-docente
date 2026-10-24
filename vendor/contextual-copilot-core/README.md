# TRAMA Contextual Copilot Core

Nucleo headless, provider-neutral e privacy-first per la risoluzione delle azioni contestuali condivise fra prodotti TRAMA.

## Confini

- nessuna UI e nessuna route applicativa;
- nessun tipo verticale di Docente OS o registro-docente;
- nessun provider generativo obbligatorio;
- capability dichiarate dall'app prima di semantica o preferenze;
- policy valutata prima della risoluzione e prima del dispatch;
- i guardrail minimi del Core non possono essere indeboliti da policy iniettate;
- azioni mutative subordinate a conferma/autorità umana;
- `INSTITUTIONAL_DECISION` non è eseguibile dal Core generico;
- ogni Semantic Port dichiara `local` o `remote`;
- un Semantic Port remoto riceve il contesto solo quando il flusso remoto è autorizzato e non contiene classi studente protette;
- `ContextSnapshot` viene validato e trasformato in uno snapshot difensivo/read-only prima di attraversare policy, Semantic Port o executor;
- `generativeMode = none | local | remote` è una guardia del Core: una policy personalizzata non può autorizzare un flusso generativo remoto vietato dal contesto privacy;
- nessuna autorità di dominio o persistenza acquisita dal Core.

Il pacchetto implementa il contratto del Contextual Copilot Core come libreria subordinata ai contratti TRAMA OR-07 Shared Capability Layer e OR-08 Runtime Portability. Non è un server centrale né un nuovo prodotto.

## Verifica

```bash
npm test
npm pack --dry-run
```

La prova cross-app usa fixture Docente OS e registro-docente con lo stesso motore e fallisce se il sorgente del Core introduce identificatori o branching applicativi. Le regressioni di confine verificano inoltre che policy permissive non aggirino i guardrail obbligatori, che la semantica remota non riceva contesti protetti o non autorizzati e che estensioni non possano mutare lo snapshot del consumer per introdurre capability o autorizzazioni successive.
