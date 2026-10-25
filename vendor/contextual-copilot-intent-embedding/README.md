# @trama/contextual-copilot-intent-embedding

Adapter condiviso, provider-neutral e local-only per il contratto `IntentPort` di `@trama/contextual-copilot-core@0.3.x`.

Il package espone `createEmbeddingIntentPort()` e restituisce un port con `mode: 'local'`, `resolve()` e `discover()`. Il motore interpreta semanticamente il testo tramite una funzione `embed(text)` iniettata dal consumer e un catalogo di esempi posseduto dal consumer stesso.

## Confine architetturale

Il package classifica intenzioni ma non crea authority. Un match semantico non autorizza dispatch, provider, rete, persistenza, mutazioni o decisioni. Il Core resta l’unica superficie che filtra le azioni autorizzate per `resolveRequest()`, le candidate non eseguibili per `discoverRequestIntent()` e le policy di dispatch.

Il runtime è stateless: non mantiene indici, cache persistenti, database, RAG, vector store, telemetria o stato di sessione. Non contiene SDK provider, endpoint, URL, API key, `fetch()` o fallback remoto. La funzione embedding è un boundary del consumer; è responsabilità del consumer fornire una funzione coerente con il proprio confine dati locale.

La dipendenza da `@trama/contextual-copilot-core` è soltanto tipologica tramite peer dependency e `import type`. Il runtime del ranker non importa codice dal Core.

## API

```ts
createEmbeddingIntentPort({
  embed,
  intents,
  minSimilarity,
  minMargin,
})
```

Il catalogo `intents` è una lista di action id con uno o più esempi linguistici. Gli action id duplicati, vuoti o privi di esempi validi sono rifiutati alla costruzione. Il catalogo viene copiato difensivamente: modifiche successive ai dati del consumer non alterano un port già creato.

Sia `resolve()` sia `discover()` possono classificare soltanto gli action id presenti nel rispettivo input ricevuto dal Core. Voci presenti nel catalogo ma assenti dall’input non vengono embeddizzate e non possono apparire nell’output.

## Ranking

Il motore usa cosine similarity con strategia best-example per action.

- `minSimilarity`: default `0.75`, valore finito ammesso nell’intervallo `[-1, 1]`;
- `minMargin`: default `0.08`, valore finito ammesso nell’intervallo `[0, 2]`;
- per ogni action viene usato il punteggio migliore fra i suoi esempi;
- gli score sotto `minSimilarity` vengono scartati;
- i match sopravvissuti sono ordinati per score decrescente e poi per action id crescente;
- se almeno due action sopravvivono e `topScore - secondScore < minMargin`, l’esito è ambiguo e il port restituisce `[]`;
- se la differenza è esattamente uguale a `minMargin`, il match non è considerato ambiguo.

Messaggio vuoto, insieme azioni vuoto o assenza di esempi configurati per le action ricevute sono no-match validi e restituiscono `[]` senza chiamare `embed()`.

## No-match e failure tecniche

Un vero no-match semantico resta `[]`. Il Core può quindi conservarlo come `NO_INTENT_MATCH`.

Una failure tecnica non viene mascherata come no-match. Il port propaga l’eccezione quando:

- `embed()` fallisce;
- il vettore non è un array o è vuoto;
- contiene componenti non numeriche, `NaN` o `Infinity`;
- le dimensioni non coincidono;
- la norma del vettore è zero.

Quando il port è usato dal Core, queste failure restano distinguibili come `INTENT_RESOLUTION_FAILED` o `INTENT_DISCOVERY_FAILED`.

## Obblighi del consumer

Il consumer deve:

- fornire una funzione embedding realmente locale se usa questo adapter local-only;
- possedere e versionare il proprio catalogo linguistico;
- non trattare un match come authority;
- lasciare al Core policy, capability filtering e dispatch;
- qualificare separatamente ogni eventuale wiring verso UI, proposal flow o provider generativi.

Il package non contiene action id verticali di Registro Docente, Docente OS, Arena o Atlas.
