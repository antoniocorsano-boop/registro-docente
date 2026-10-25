# LIB-03B — Relevance Resolver Design

## Stato

APPROVED FOR IMPLEMENTATION BY CONTINUATION OF THE ACCEPTED LIB-03 PLAN

Baseline: `main@b82175db604b56197171d6b1f25be249f74874db`.

## Intento

Aggiungere un resolver locale, deterministico e spiegabile che ordini le UDA e le lezioni potenzialmente pertinenti a una `LibrarySource`, usando soltanto dati già presenti nel Registro e il read model di LIB-03A.

Il resolver produce **candidati**, non decisioni: non collega la fonte, non modifica UDA o lezioni, non sceglie implicitamente una destinazione canonica e non amplia l'autorità del copilota.

## Confine architetturale

Introdurre `src/library/relevanceResolver.ts` come funzione pura.

Il resolver può leggere:

- `LibrarySource`;
- `UdaRecord` e relative lezioni;
- `ResolvedLibraryTeachingContext`, se disponibile;
- `LibraryPlanningContextResolution` prodotto da LIB-03A, se disponibile.

Non può:

- leggere o interpretare `arenaContext.curricoloItems`;
- usare `MasterProgram`, `planning.resources` o nuove strutture persistenti;
- chiamare embedding, provider IA, rete o fetch;
- creare link verso `activity`;
- scrivere nella Biblioteca, nella Programmazione, nelle UDA o nelle lezioni;
- attribuire copertura, lacune o conformità curricolare.

## Contratto di output

Il resolver restituisce una delle due forme:

- `ranked`: uno o più candidati ordinati;
- `unavailable`: nessun candidato sufficientemente motivato.

Ogni candidato contiene:

- `targetType`: solo `uda` oppure `lesson`;
- `targetId`;
- `udaId` di appartenenza;
- `score` intero e deterministico;
- `signals`: motivazioni stabili e leggibili dal prodotto;
- `matchedTerms`: termini normalizzati che hanno contribuito alla corrispondenza lessicale.

Reason minime per `unavailable`:

- `SOURCE_AND_CONTEXT_UNAVAILABLE` — la fonte non contiene testo locale utilizzabile e non esiste un contesto didattico valido;
- `NO_RELEVANT_CANDIDATE` — esistono input utilizzabili ma nessun candidato ottiene un segnale di pertinenza.

## Segnali di pertinenza

Segnali ammessi nella prima versione:

- `CURRENT_LESSON` — la lezione è quella del contesto didattico corrente;
- `CURRENT_UDA` — l'UDA è quella del contesto didattico corrente;
- `CURRENT_CLASS` — il candidato appartiene alla stessa classe del contesto corrente;
- `PLANNING_GRADE_MATCH` — LIB-03A ha risolto un solo profilo e il livello del candidato coincide con il profilo;
- `SOURCE_TITLE_MATCH` — termini del titolo della fonte coincidono con il titolo UDA o il topic lezione;
- `SOURCE_CONTENT_MATCH` — termini del contenuto locale della fonte coincidono con testo descrittivo del candidato.

Il resolver non deve esporre motivazioni generiche non riconducibili a un calcolo verificabile.

## Normalizzazione lessicale

Il confronto lessicale è locale e non semantico.

- lowercase italiano;
- rimozione dei segni diacritici;
- token alfanumerici;
- esclusione dei token sotto tre caratteri e di un piccolo insieme statico di parole funzionali italiane;
- confronto per insiemi di token, quindi la ripetizione della stessa parola non aumenta artificialmente il punteggio.

Testo della fonte utilizzabile:

- titolo;
- `extractedText`;
- `payload.text`;
- `notes`.

`dataUrl`, URL e metadati di provenienza non entrano nel punteggio lessicale.

Testo candidato:

- UDA: titolo come campo primario; descrizione, competenze e compito autentico come supporto;
- lezione: topic come campo primario; note della lezione e testo essenziale dell'UDA padre come supporto.

## Punteggio v1

I pesi sono parte del contratto e devono restare testabili:

- `CURRENT_LESSON`: +100;
- `CURRENT_UDA`: +80;
- `CURRENT_CLASS`: +30;
- `PLANNING_GRADE_MATCH`: +15;
- ogni termine `source title ↔ candidate primary`: +20;
- ogni termine `source title ↔ candidate support`: +8;
- ogni termine `source content ↔ candidate primary`: +6;
- ogni termine `source content ↔ candidate support`: +2.

Un segnale lessicale viene aggiunto una sola volta per candidato anche quando più termini contribuiscono.

Sono inclusi soltanto candidati con `score > 0`.

## Ordinamento e determinismo

Ordinamento:

1. `score` decrescente;
2. a parità di punteggio, `uda` prima di `lesson`;
3. a ulteriore parità, `targetId` crescente con `localeCompare` italiano.

Il resolver non usa timestamp, ordine di inserimento o casualità come tie-breaker.

## Collegamenti esistenti

Una destinazione già collegata alla fonte con lo stesso `targetType` e `targetId` non viene proposta nuovamente.

I link legacy `activity` possono restare persistiti, ma non vengono mai generati come candidati da LIB-03B.

## Uso del Planning Context Bridge

LIB-03B riceve il risultato già risolto da LIB-03A; non ricostruisce la logica di Programmazione.

Solo quando `planningContext.status === 'resolved'` il resolver può aggiungere `PLANNING_GRADE_MATCH` ai candidati il cui livello di classe coincide con `profile.gradeLevel`.

Se il planning context è `unavailable` o `ambiguous`, il resolver continua con gli altri segnali senza inventare un profilo alternativo e senza scegliere un contesto Arena.

`arenaContext` e `curricoloItems` non sono letti per il ranking.

## Privacy

Il resolver è interamente locale e sincrono. Una fonte `restricted`, `unknown` o `student-personal` non viene trasferita né sbloccata: il ranking locale può usare il testo già presente nel vault senza autorizzare alcun flusso remoto.

L'eventuale ricerca semantica/embedding resta fuori da LIB-03B e richiederà un contratto separato con confine privacy esplicito.

## Stati della fonte

Lo stato della fonte non concede autorità aggiuntiva. Il resolver usa soltanto il testo locale effettivamente presente e il contesto corrente.

Una fonte senza testo locale può comunque produrre candidati quando esiste un `ResolvedLibraryTeachingContext`, perché il contesto corrente è un segnale esplicito di pertinenza. Senza testo e senza contesto restituisce `SOURCE_AND_CONTEXT_UNAVAILABLE`.

## Criteri di accettazione

LIB-03B è qualificato quando:

1. produce ranking deterministico e spiegabile su UDA e lezioni;
2. il contesto corrente prevale sui soli segnali lessicali secondo i pesi dichiarati;
3. usa il profilo LIB-03A solo come boost di livello e solo quando il bridge è `resolved`;
4. non usa `curricoloItems`, embedding, provider IA o rete;
5. non propone target `activity`;
6. esclude destinazioni già collegate;
7. una fonte senza testo ma con contesto corrente produce candidati contestuali;
8. una fonte senza testo e senza contesto fallisce chiusa;
9. una fonte locale `student-personal`/`restricted` può essere ordinata senza trasferimento remoto;
10. tie-break, normalizzazione e punteggi restano deterministici;
11. `test:library`, security tests, typecheck, build e production startup smoke restano verdi.

## Non obiettivi

- semantic search;
- embedding;
- generazione IA;
- UI o progressive disclosure;
- scrittura di link;
- selezione automatica del candidato primo classificato;
- interpretazione curricolare Arena;
- attività come entità persistente.

## Confine di integrazione

L'implementazione termina con Draft PR e qualificazione exact-SHA. Nessun merge e nessun deploy senza una nuova decisione umana.