# Project Memory Protocol

Questa directory è la memoria operativa canonica di `registro-docente`.

## Autorità

Il repository è la fonte della verità per regole operative, decisioni durevoli, ricette collaudate e lesson learned. Le conversazioni e gli appunti esterni possono fornire contesto, ma una regola di processo diventa canonica solo quando è materializzata qui.

## Ordine di lettura

Per un ciclo significativo:

1. `OPERATING_RULES.md` — regole stabili `ACTIVE`.
2. `DECISIONS.md` — decisioni durevoli e relative sostituzioni.
3. `TOOL_RECIPES.md` — procedure già qualificate per strumenti e gate.
4. `LESSONS_LEARNED.md` — lesson pertinenti marcate `ACTIVE` o `REVALIDATE`.

`AGENTS.md` alla radice del repository rende questo protocollo il punto d'ingresso operativo per gli agenti.

## Cosa memorizzare

Memorizzare soltanto conoscenza che può cambiare un futuro ciclo:

- integrazioni importanti;
- incidenti e failure significative;
- cambi di architettura o di processo;
- limiti reali degli strumenti;
- scoperte riutilizzabili che evitano falsi PASS, lavoro duplicato o regressioni.

Non creare una Memory Capsule per micro-fix ordinari privi di apprendimento generalizzabile.

## Classificazione

- **Operating rule**: regola stabile e generalizzabile che governa i cicli futuri.
- **Tool recipe**: sequenza riproducibile di strumenti, configurazioni e verifiche.
- **Lesson learned**: evidenza episodica proveniente da un ciclo concreto.
- **Decision**: scelta durevole che definisce un confine, un'autorità o un metodo.

Run ID, SHA, date e risultati di singoli gate sono normalmente evidenza episodica. Una regola come «il browser gate canonico deve essere eseguito sull'exact candidate SHA» è invece memoria stabile.

## Memory Capsule

Ogni capsule deve usare questo schema:

```markdown
### <ID> — <titolo breve>
- Stato: ACTIVE | SUPERSEDED | REVALIDATE
- Ciclo/data: <ciclo> · YYYY-MM-DD
- Exact SHA/riferimento: <sha o riferimento equivalente>
- Obiettivo: <cosa si voleva ottenere>
- Ha funzionato: <evidenza utile>
- È fallito: <evidenza utile oppure “nessun failure rilevante”>
- Causa reale: <causa dimostrata>
- Regola generalizzabile: <lezione riutilizzabile>
- Recipe: <nuova recipe o riferimento a TOOL_RECIPES.md>
- Non ripetere: <anti-pattern concreto>
- Evidenza: <run, PR, file o altra prova verificabile>
- Promozione candidata: <nessuna | operating rule | decision | recipe>
- Sostituita da: <ID/riferimento, solo se SUPERSEDED>
```

## Promozione

Una lesson viene promossa quando l'evidenza dimostra che deve cambiare stabilmente il modo di lavorare. La promozione non elimina la lesson originale: la lesson resta come provenienza dell'evidenza e la nuova regola/decisione riceve il proprio identificatore.

## Obsolescenza

Una regola o lesson obsoleta non viene cancellata silenziosamente. Va marcata `SUPERSEDED` e deve indicare il riferimento che la sostituisce. `REVALIDATE` segnala invece una conoscenza plausibile ma da riesaminare prima di applicarla come vincolo.

## Chiusura di un ciclo importante

La sequenza canonica è:

`engineering evidence → review → lesson learned → eventuale promozione a operating rule`

Il ciclo resta tecnicamente incompleto se produce una conoscenza riutilizzabile ma questa non viene classificata nel livello corretto della memoria.
