# AGENT-INTENT-01 — Agent-first intent routing design

**Status:** proposed / awaiting human design approval  
**Baseline:** `main@0ebda92248b9bb984f2e3e201661292daa47e96d`  
**Primary surface:** Copilota contestuale / Biblioteca privata / UDA  
**Triggering finding:** una richiesta docente semanticamente chiara — “Preparazione Attività per fare comprendere il funzionamento della centrale elettrica” — degrada a `NO_INTENT_MATCH` nel classificatore locale corrente.

## Intento

Rendere l’agente conversazionale il **primo interprete** delle richieste in linguaggio naturale del docente, senza trasferirgli autorità operativa.

Il nuovo confine canonico è:

`Docente -> agente interprete -> IntentEnvelope -> Contextual Copilot Core -> policy -> eventuale consenso -> azione`

L’agente comprende e struttura la richiesta. Il Contextual Copilot Core continua a decidere quali capability siano realmente disponibili e autorizzate nel contesto corrente. Nessuna interpretazione dell’agente può produrre da sola una scrittura, un invio remoto di contenuto, un cambio curricolare o una persistenza.

## Perché cambiare

L’attuale `IntentPort` usa un embedding locale deterministico basato su parole, bigrammi e character n-gram e applica una soglia di similarità. Questo è utile come meccanismo privato, offline e verificabile, ma non costituisce comprensione semantica sufficiente per il linguaggio docente reale.

La failure osservata non è un caso limite: sono naturalmente fragili formulazioni nominali, ellittiche, indirette, dettate a voce, con refusi o con obiettivi espressi senza il verbo canonico dell’azione.

Continuare ad ampliare il solo corpus lessicale ridurrebbe alcune omissioni, ma manterrebbe il problema strutturale.

## Decisione architetturale

Adottare **AGENT-FIRST INTENT ROUTING**:

- l’agente interviene subito su ogni richiesta conversazionale;
- l’agente produce un output strutturato e non eseguibile (`IntentEnvelope`);
- il Core resta l’autorità esclusiva per capability, contesto operativo, policy e dispatch;
- il classificatore locale resta disponibile come supporto, fallback offline e strumento di valutazione, ma non determina più da solo l’esperienza utente quando l’agente è disponibile;
- in caso di ambiguità l’agente deve chiedere chiarimento, non indovinare;
- il contenuto completo della fonte non viene inviato al solo scopo di capire l’intento.

## Obiettivi

1. Comprendere richieste naturali del docente senza richiedere formule predefinite.
2. Preservare integralmente i confini di governance già presenti.
3. Minimizzare il contesto inviato all’interprete remoto.
4. Distinguere rigorosamente **comprensione** da **autorizzazione** e **esecuzione**.
5. Rendere espandibile il Copilota oltre i tre intenti iniziali senza introdurre parser a parole chiave.
6. Mantenere un percorso locale/offline fail-closed.
7. Rendere testabile il comportamento su corpus realistici e casi reali emersi dall’uso.

## Non-obiettivi

- L’agente non diventa autorità curricolare.
- L’agente non scrive direttamente in UDA, lezioni, Biblioteca o valutazioni.
- L’agente non bypassa conferme umane già richieste dal Core.
- L’agente non sceglie autonomamente provider o modello.
- L’agente non riceve automaticamente dati studente.
- L’agente non riceve automaticamente il testo integrale della fonte durante il solo routing.
- Nessuna eliminazione immediata dell’IntentPort locale.
- Nessun abbassamento generalizzato della soglia del classificatore locale come soluzione al finding.

## Approcci considerati

### A. Rafforzare soltanto il classificatore locale

Aggiungere esempi, forme nominali, sinonimi e ulteriori feature locali.

**Vantaggi:** privacy massima, latenza minima, comportamento deterministico.  
**Svantaggi:** crescita continua del corpus, fragilità su linguaggio spontaneo, impossibilità pratica di coprire tutte le formulazioni reali.

**Esito:** non scelto come architettura principale. Rimane utile come fallback e controllo.

### B. Delegare interpretazione e azione all’agente

L’agente interpreta la richiesta e decide direttamente cosa fare.

**Vantaggi:** esperienza conversazionale molto fluida.  
**Svantaggi:** mescola comprensione e autorità, indebolisce governance, rende più difficile garantire consenso, privacy e persistenza controllata.

**Esito:** scartato.

### C. Agente interprete primario + Core governato — scelto

L’agente produce soltanto un’intenzione strutturata. Il Core valida il contesto e autorizza o rifiuta l’azione.

**Vantaggi:** comprensione semantica naturale senza perdita dei confini di sicurezza e autorità.  
**Svantaggi:** introduce una chiamata interpretativa remota quando l’agente è disponibile e richiede una disciplina rigorosa di minimizzazione del contesto.

**Esito:** scelto.

## Contratto `IntentEnvelope`

Il routing agent-first non deve restituire testo libero come base di dispatch. Deve produrre una struttura tipizzata e validata localmente.

Shape proposta:

```ts
export type AgentIntentId =
  | 'REVIEW'
  | 'LINK'
  | 'PREPARE'
  | 'ADAPT'
  | 'SIMPLIFY'
  | 'COMPARE'
  | 'CREATE_MATERIAL'
  | 'CREATE_ASSESSMENT'
  | 'RETRIEVE_LIBRARY'
  | 'ANSWER'
  | 'CLARIFY'
  | 'UNSUPPORTED';

export interface IntentEnvelopeV1 {
  schema: 'registro.agent-intent/v1';
  intent: AgentIntentId;
  goal: string;
  requestedArtifact?: string;
  contextTarget: 'current' | 'explicit' | 'unknown';
  classReference?: 'current' | string;
  udaReference?: 'current' | string;
  sourceReference?: 'current' | string | 'none';
  confidence: 'high' | 'medium' | 'low';
  needsClarification: boolean;
  clarificationQuestion?: string;
}
```

Il contratto deve essere allowlistato e validato localmente. Campi o intenti non previsti non possono diventare azioni.

## Contesto minimo per l’interpretazione

Per il solo routing, l’agente riceve il minimo indispensabile:

- messaggio del docente;
- superficie corrente (`home`, `class-dashboard`, `library`, `uda`, ecc.);
- presenza o assenza di classe corrente;
- presenza o assenza di UDA corrente;
- presenza o assenza di fonte selezionata;
- eventuali identificatori tecnici opachi se indispensabili alla disambiguazione, senza contenuto sensibile.

Per default **non** riceve:

- nomi studenti;
- valutazioni o osservazioni;
- testo integrale di documenti o fonti;
- allegati/binari;
- contenuto completo dell’UDA;
- cronologia applicativa non necessaria;
- segreti o credenziali.

Se una capability successiva richiede il contenuto della fonte, quel trasferimento avviene nel flusso governato già esistente e non durante l’interpretazione.

## Flusso primario

```text
1. Docente invia un messaggio al Copilota
2. UI costruisce AgentRoutingContext minimizzato
3. agente interpreta -> IntentEnvelopeV1
4. validatore locale verifica schema/allowlist
5. adapter traduce l’intento in una capability candidata del Core
6. Core risolve contesto + policy
7a. se ammessa -> presenta la prossima azione governata
7b. se ambigua -> CLARIFY
7c. se non supportata -> risposta informativa, nessun dispatch
8. eventuale conferma/consenso umano resta invariata
9. solo dopo: dispatch o flusso generativo governato
```

## Esempio reale

Input:

> Preparazione Attività per fare comprendere il funzionamento della centrale elettrica

Output atteso dall’interprete:

```json
{
  "schema": "registro.agent-intent/v1",
  "intent": "PREPARE",
  "goal": "far comprendere il funzionamento della centrale elettrica",
  "requestedArtifact": "attività didattica",
  "contextTarget": "current",
  "classReference": "current",
  "udaReference": "current",
  "sourceReference": "current",
  "confidence": "high",
  "needsClarification": false
}
```

Questo output **non autorizza PREPARE**. Il Core deve ancora verificare che esistano il contesto didattico univoco, le capability necessarie e gli eventuali requisiti di consenso remoto.

## Smistamento tra intenti e capability

L’agente può comprendere più intenti di quelli oggi implementati. La comprensione non equivale alla disponibilità del prodotto.

Esempio:

- agente -> `CREATE_ASSESSMENT`;
- registry/Core -> capability non disponibile nella superficie corrente;
- risultato -> nessuna azione inventata; il Copilota informa che la funzione non è disponibile oppure propone una capacità realmente supportata solo se semanticamente appropriata.

Questo consente di ampliare il linguaggio senza dover ampliare contemporaneamente l’autorità del sistema.

## Ambiguità e chiarimento

`confidence=low` oppure `needsClarification=true` deve impedire il dispatch.

Il Copilota formula una domanda breve e contestuale, per esempio:

> Vuoi preparare una nuova attività per l’UDA corrente oppure collegare questo materiale a un’attività già esistente?

Non deve mostrare messaggi tecnici come `NO_INTENT_MATCH` al docente.

## Ruolo futuro del classificatore locale

L’attuale IntentPort locale viene declassato da **autorità primaria di routing** a uno dei seguenti ruoli:

1. **fallback offline/failure:** se l’agente non è disponibile, può riconoscere solo intenti con confidenza locale qualificata;
2. **pre-check opzionale:** può fornire un segnale locale all’orchestratore senza autorizzare azioni;
3. **valutazione/regressione:** resta utile per confrontare copertura e verificare che il fallback non produca falsi positivi;
4. **privacy fast-path futuro:** eventuale uso locale su comandi canonici molto evidenti, solo se progettato separatamente e senza cambiare la regola agent-first percepita dall’utente.

In fallback, l’astensione resta preferibile a una classificazione errata.

## Confini di autorità

### Agente interprete

Può:
- comprendere;
- estrarre obiettivo e riferimenti contestuali;
- indicare ambiguità;
- proporre un intento strutturato.

Non può:
- autorizzare;
- scrivere;
- scegliere autonomamente UDA/fonte se il contesto è ambiguo;
- inviare contenuti ulteriori a provider secondari;
- cambiare provider/modello;
- bypassare consenso.

### Contextual Copilot Core

Resta responsabile di:
- capability disponibili;
- policy;
- contesto operativo risolto;
- dispatch;
- conferme richieste;
- fail-closed.

### SEC / route server

Resta responsabile di:
- minimizzazione e allowlist del payload remoto;
- divieto di dati studente;
- confine `TEACHER_PROFESSIONAL -> REMOTE_PROVIDER`;
- validazione delle risposte strutturate.

### Docente

Resta responsabile della decisione finale quando una modifica deve essere adottata, adattata o persistita.

## Provider e costo

L’interprete deve usare il runtime/provider già governato o un endpoint dedicato costruito sugli stessi principi:

- configurazione server-only;
- un solo provider attivo;
- output strutturato;
- nessun tool;
- nessuna ricerca web implicita;
- nessun retry/fallback automatico;
- timeout e error taxonomy;
- nessun logging del contenuto della richiesta.

Il routing deve avere un budget molto più piccolo della generazione didattica: input minimizzato, output `IntentEnvelopeV1`, candidate count 1.

## Failure semantics

- agente non disponibile -> fallback locale qualificato;
- output agente non valido -> fallback locale o `CLARIFY`, mai dispatch;
- intento non supportato -> informazione, nessuna azione;
- contesto ambiguo -> `CLARIFY`;
- Core nega capability -> nessuna azione, anche se l’agente aveva confidenza alta;
- provider timeout/rate limit -> nessun retry automatico;
- mismatch fra intento agente e capability Core -> prevale il Core.

## Esperienza utente target

L’interazione deve passare da:

`scrivi -> Mostra le possibilità -> classificatore -> errore/no-match`

verso:

`scrivi -> agente comprende -> presenta la prossima possibilità pertinente`

Il pulsante e il copy possono essere rivisti in un incremento UX separato, ma il principio prodotto è che il docente non debba conoscere l’elenco degli intenti supportati né imparare formule specifiche.

## Qualificazione

La modifica dovrà essere sviluppata TDD e qualificata almeno su:

1. **regressione reale**: la frase “Preparazione Attività per fare comprendere il funzionamento della centrale elettrica” -> `PREPARE`;
2. varianti nominali/verbo/sinonimo della stessa intenzione;
3. richieste indirette ed ellittiche;
4. refusi e dettatura plausibile;
5. ambiguità -> `CLARIFY`, non scelta arbitraria;
6. richieste fuori dominio -> `UNSUPPORTED`/astensione;
7. intenti compresi ma capability non disponibili -> nessun dispatch;
8. agent output malformed -> fail-closed;
9. assenza agente -> fallback locale qualificato;
10. zero invio di testo fonte/dati studente durante il solo routing;
11. browser desktop e 390x844;
12. zero regressioni UX-QA-01 / UX-QA-02;
13. conferme e consenso PREPARE/LINK invariati;
14. nessuna scrittura durevole prima della conferma richiesta.

## Metriche di accettazione

Non congelare soglie numeriche prima del corpus RED iniziale. Il piano dovrà introdurre un corpus realistico separato da quello locale legacy e misurare almeno:

- accuracy su casi canonici;
- recall su parafrasi/noisy/ellittiche;
- tasso di chiarimento corretto sui casi ambigui;
- false-action rate su richieste non supportate;
- Core-denial preservation: 100%;
- privacy payload violations: 0;
- durable write without required confirmation: 0.

Il finding reale deve essere obbligatoriamente incluso nel corpus, non soltanto nel test browser.

## Compatibilità e migrazione

L’incremento deve essere reversibile:

- nessuna migrazione dati;
- nessuna modifica schema Vault necessaria per il routing;
- IntentPort locale preservato;
- feature boundary isolabile;
- rollback possibile tornando al routing locale senza alterare dati persistiti.

## Decisioni umane già acquisite

- l’agente deve intervenire **subito**, non soltanto dopo il fallimento del classificatore locale;
- l’agente deve **smistare** la richiesta;
- il Core mantiene l’autorità operativa;
- il contesto fornito automaticamente all’agente deve essere utile ma minimizzato e privo di contenuti sensibili non necessari.

## Decisioni non ancora autorizzate

Questa specifica non autorizza ancora:

- implementazione;
- modifica del provider runtime;
- nuovo endpoint;
- cambiamento del copy/UI;
- merge;
- deploy/pubblicazione.

Dopo l’approvazione umana della specifica, il passo successivo è un piano di implementazione dedicato con RED causale sul finding reale.