# EDU-PLAN-01 — Copilota contestuale per progettazione e compilazione UDA

## Status

Normative companion design to:

`docs/superpowers/specs/2026-10-24-edu-plan-01-programmazione-didattica-design.md`

Questo documento estende EDU-PLAN-01 senza sostituirne i confini. In caso di conflitto, valgono congiuntamente i seguenti principi già approvati:

- Arena resta autorità curricolare;
- il docente resta autorità finale della programmazione operativa;
- libro e guida docente sono fonti private;
- le proposte AI non modificano automaticamente programmazione madre o istanze di classe;
- nessun provider remoto riceve dati senza il confine di policy e l'opt-in previsti.

---

## Intent

Integrare nel workspace di programmazione e nella scheda UDA un **copilota conversazionale contestuale** che aiuti il docente a:

- ideare UDA;
- approfondire alternative didattiche;
- verificare copertura curricolare;
- confrontare libro, guida e curricolo Arena;
- rivedere ore, sequenza e dipendenze;
- completare o migliorare la scheda UDA;
- adattare una UDA alla classe concreta;
- motivare e spiegare le proposte usando fonti identificabili.

Il copilota non è un chatbot generico separato dall'applicazione e non è un generatore autoritativo di documenti. È un **assistente contestuale di progettazione** subordinato alle fonti e alle decisioni del docente.

---

## Perché va progettato dentro EDU-PLAN-01

La progettazione di una UDA non è una compilazione lineare di campi. Il docente può dover:

- capire se un'UDA è troppo ampia;
- ridurre le ore senza perdere copertura curricolare;
- rendere un percorso più laboratoriale;
- trovare un'attività coerente nella guida docente;
- verificare cosa manca rispetto al curricolo Arena;
- decidere se un capitolo del libro va incluso o lasciato come approfondimento;
- dividere o unire UDA;
- definire una verifica o un compito autentico;
- adattare una proposta al livello reale della classe.

Queste operazioni richiedono dialogo iterativo. Se il chatbot venisse aggiunto solo in seguito come pannello generico, rischierebbe di non conoscere il contesto governato della programmazione e di duplicare la logica di recupero delle fonti.

Per questo la capability conversazionale viene modellata ora, anche se la sua implementazione può essere realizzata in una fase incrementale distinta.

---

## Stato tecnico esistente da riusare

Registro Docente possiede già due famiglie di capability AI differenti.

### Embedding locale

Esiste una configurazione `EmbeddingProvider` con provider locale e supporto a endpoint loopback (`llama.cpp`, `ollama`, `openai-compatible`). Il modello predefinito è compatibile con `embeddinggemma`.

L'embedding locale è già usato per funzioni semantiche nelle UDA, tra cui:

- ricerca semantica;
- ranking di similarità;
- suggerimento di prerequisiti/dipendenze;
- allineamento semantico di competenze.

Questo motore deve essere considerato **retrieval/ranking**, non motore conversazionale generativo.

### Generazione remota esistente

Esiste già una generazione one-shot della descrizione UDA tramite provider Gemini remoto, protetta da classificazione `TEACHER_PROFESSIONAL` e opt-in esplicito del docente.

Questa capability non va elevata direttamente a chatbot. Il nuovo design deve introdurre una separazione tra:

- retrieval;
- costruzione del contesto;
- generazione;
- proposta strutturata;
- applicazione approvata dal docente.

---

## Architettura scelta

### Copilota contestuale con retrieval locale e generatore intercambiabile

Flusso concettuale:

```text
Domanda / intento del docente
          |
          v
Context Builder governato
          |
          +-----------------------------+
          |                             |
          v                             v
Contesto strutturato              Retrieval semantico
UDA / programma / calendario      EmbeddingGemma locale
          |                             |
          +--------------+--------------+
                         v
               Evidence Context Pack
                         |
                         v
             Generatore conversazionale
              locale preferito / remoto
                         |
                         v
             Risposta + proposte strutturate
                         |
                         v
                Adotta / Adatta / Ignora
                         |
                         v
                 decisione del docente
```

Il retrieval locale e la costruzione del contesto devono funzionare indipendentemente dal provider generativo scelto.

---

## Contesto disponibile al copilota

Il copilota non deve ricevere automaticamente tutto ciò che il sistema conosce. Il `Context Builder` seleziona il minimo contesto pertinente alla richiesta.

Possibili sorgenti:

### Contesto di programmazione

- anno scolastico;
- ordine, livello e disciplina;
- profilo normativo;
- monte ore;
- budget disponibile;
- margine residuo;
- fine primo periodo;
- termine delle lezioni;
- sequenza delle UDA;
- dipendenze;
- stato della programmazione madre.

### UDA corrente

- titolo;
- finalità;
- ore;
- finestra temporale;
- competenze/elementi curricolari collegati;
- contenuti;
- attività;
- laboratorio;
- verifica;
- compito autentico;
- prerequisiti;
- dipendenze;
- note del docente;
- stato `draft/approved` pertinente.

### Curricolo Arena

Solo elementi provenienti dallo snapshot Arena pertinente, con:

- identificatore/versione;
- stato di governance;
- riferimenti agli elementi curricolari;
- provenance.

Un curricolo Arena non approvato deve rimanere visibilmente non approvato anche nelle risposte del copilota.

### Biblioteca privata

Passaggi o elementi pertinenti recuperati da:

- libro di testo;
- guida docente;
- materiali personali.

Il copilota non deve ricevere automaticamente il documento intero se bastano passaggi selezionati.

### Classe concreta, quando si lavora sull'istanza di classe

- scostamento dalla madre;
- ore effettive disponibili;
- avanzamento reale;
- attività già svolte;
- personalizzazioni locali;
- vincoli già confermati dal docente.

Dati studente-specifici non sono necessari alla progettazione ordinaria della UDA e non devono entrare nel contesto per default.

---

## Evidence Context Pack

Prima di invocare un generatore, il sistema costruisce un pacchetto di contesto governato.

Contenuto concettuale:

- `teacherIntent`;
- `currentUdaSnapshot`;
- `masterProgramSnapshot` pertinente;
- `calendarBudgetSnapshot`;
- `arenaEvidence[]`;
- `editorialEvidence[]`;
- `teacherMaterialEvidence[]`;
- `classContext?`;
- `sourcePolicy`;
- `dataClassification`;
- `providerPolicy`.

Ogni evidenza deve mantenere:

- sorgente;
- riferimento stabile quando disponibile;
- eventuale pagina/sezione;
- tipo di fonte;
- stato di autorità;
- confidenza del retrieval, se usata;
- indicazione se il contenuto è privato.

Il generatore non deve poter reinterpretare il livello di autorità di una fonte.

---

## Ruoli distinti dei motori

### 1. EmbeddingGemma / embedding locale

Ruolo:

- recuperare passaggi pertinenti;
- trovare corrispondenze semantiche;
- suggerire relazioni;
- ridurre il contesto al materiale rilevante.

Non deve:

- produrre autonomamente una risposta didattica finale;
- approvare UDA;
- stabilire autorità curricolare.

### 2. Generatore conversazionale locale

È il percorso preferenziale quando disponibile e sufficientemente capace.

Deve poter essere implementato dietro un adapter indipendente dalla UI.

Possibili runtime futuri possono includere motori locali compatibili con le infrastrutture già previste dall'app, ma EDU-PLAN-01 non vincola ora un singolo modello o runtime generativo.

### 3. Generatore remoto

È opzionale.

Può essere usato soltanto quando:

- il tipo di dato è ammesso dalla policy;
- il docente ha dato l'opt-in richiesto;
- il pacchetto inviato è minimizzato;
- materiali privati non autorizzati non vengono inclusi;
- la UI rende visibile che si sta usando un provider remoto.

La presenza di un provider remoto non deve essere necessaria per usare il workspace di progettazione.

---

## Esperienza utente

Il copilota deve essere disponibile almeno in due contesti.

### A. Workspace Programmazione madre

Il docente può discutere l'architettura annuale.

Esempi di intenti:

- "Sono troppe UDA per 52 ore programmabili?"
- "Quali UDA potrei accorpare?"
- "Cosa del curricolo Arena non è ancora coperto?"
- "Quali capitoli del libro risultano solo opzionali?"
- "Come posso conservare più margine nel secondo periodo?"
- "Quali UDA devono precedere quella sull'energia?"

### B. Scheda UDA

Il copilota lavora sulla singola UDA.

Esempi:

- "Questa UDA è troppo ampia?"
- "Riducila da 10 a 7 ore senza perdere gli elementi Arena essenziali."
- "Proponi un'attività laboratoriale coerente con la guida."
- "Quale verifica è coerente con questa UDA?"
- "Dividila in due UDA e mostrami vantaggi e svantaggi."
- "Rendi il compito autentico più realistico per una seconda media."
- "Quali contenuti del libro posso eliminare senza perdere copertura curricolare?"

---

## Risposte spiegabili

Il copilota non deve limitarsi a produrre testo.

Quando formula una proposta deve separare almeno:

### Proposta

Che cosa suggerisce.

### Motivo

Perché la proposta è coerente con il contesto.

### Fonti usate

Esempio:

- Arena — elemento curricolare X;
- Libro — cap. 6, sezione Y;
- Guida — attività 4.3;
- Calendario — 8 ore residue nella finestra;
- Decisione precedente del docente — UDA Z mantenuta come prerequisito.

### Impatto

Quando pertinente:

- variazione di ore;
- variazione della riserva;
- elementi curricolari aggiunti/persi;
- dipendenze modificate;
- classi coinvolte;
- conflitti con personalizzazioni locali.

### Incertezza

Se il retrieval non trova una fonte sufficiente o trova evidenze ambigue, il copilota deve dirlo invece di completare il vuoto come se avesse evidenza.

---

## Azioni strutturate: Adotta / Adatta / Ignora

La conversazione non deve modificare direttamente il dominio.

Ogni proposta applicabile viene trasformata in una `CopilotProposal` strutturata.

Campi concettuali:

- `id`;
- `scope` (`master_program`, `uda`, `class_instance`);
- `proposalType`;
- `summary`;
- `rationale`;
- `sourceRefs[]`;
- `before?`;
- `after?`;
- `impact`;
- `confidence?`;
- `providerKind`;
- `createdAt`;
- `status` (`proposed`, `adapted`, `accepted`, `rejected`, `expired`).

Azioni UI:

- **Adotta** — applica esattamente la proposta tramite il normale contratto di mutazione/persistenza;
- **Adatta** — apre la proposta come bozza modificabile dal docente prima dell'applicazione;
- **Ignora** — non modifica nulla e conserva solo l'eventuale traccia decisionale prevista.

L'accettazione deve essere un atto separato dalla generazione.

---

## Nessuna scrittura silenziosa

Il copilota non può:

- creare automaticamente una UDA approvata;
- cambiare ore senza conferma;
- propagare modifiche dalla madre alle classi;
- risolvere un conflitto madre ↔ classe senza decisione del docente;
- cancellare attività svolte;
- trasformare un contenuto opzionale del libro in contenuto programmato senza scelta;
- cambiare lo stato del curricolo Arena;
- scrivere direttamente nel Vault prima che il docente abbia adottato/adattato la proposta.

Le mutazioni approvate devono riusare i contratti commit-first e fail-closed del prodotto.

---

## Conversazione e stato

La chat deve essere contestuale ma non deve diventare una seconda sorgente di verità.

### Sorgente di verità

Restano canonici:

- Programmazione madre/versione;
- UDA;
- istanze di classe;
- snapshot Arena;
- mapping delle fonti;
- calendario/budget;
- decisioni persistite.

### Memoria della conversazione

La conversazione può mantenere contesto per facilitare il dialogo, ma una decisione è operativa solo quando viene materializzata in una proposta e accettata dal docente.

Una chat precedente non può sovrascrivere il dominio semplicemente perché contiene una frase come "abbiamo deciso di...".

---

## Privacy e materiali editoriali

Il design mantiene il principio già approvato: libro, guida e materiali personali sono per uso personale del docente.

### Retrieval locale preferito

Indicizzazione, embedding e selezione dei passaggi pertinenti devono essere progettati per poter avvenire localmente.

### Minima divulgazione

Se viene scelto un generatore remoto, il sistema deve inviare solo il minimo contesto necessario e consentito.

### Provenance senza ridistribuzione

La risposta può indicare riferimenti come capitolo, sezione o pagina, ma il sistema non deve trasformare il copilota in un canale di redistribuzione dei contenuti editoriali caricati.

### Dati degli studenti

Il copilota di progettazione UDA non richiede dati personali degli studenti per default. Il contesto di classe deve privilegiare dati aggregati e professionali sulla programmazione.

---

## Provider abstraction

La UI non deve dipendere da Gemini, Gemma o da un runtime specifico.

Contratto concettuale:

```text
PlanningCopilot
  -> retrieve(contextQuery)
  -> buildEvidencePack(scope)
  -> converse(message, evidencePack)
  -> proposeStructuredChange(response)
```

Adapter distinti:

- `EmbeddingRetriever`;
- `LocalGenerativeProvider`;
- `RemoteGenerativeProvider`;
- eventuale `NoGenerativeProvider` per mantenere disponibili retrieval e suggerimenti deterministici anche senza LLM generativo.

Questo permette di evolvere il motore senza riscrivere la UX o il dominio EDU-PLAN-01.

---

## Fallback e degradazione

Il workspace non deve diventare inutilizzabile se il modello generativo non è disponibile.

### Senza generatore

Devono poter restare disponibili, quando tecnicamente implementati:

- doppia mappa;
- retrieval semantico;
- fonti pertinenti;
- warning di copertura;
- budget e calendario;
- suggerimenti deterministici già previsti.

### Senza embedding locale

Il sistema può degradare a ricerca testuale/strutturata, dichiarando la capacità ridotta.

### Errore provider

Nessuna mutazione deve risultare applicata e nessun falso successo deve essere mostrato.

---

## Guardrail aggiuntivi EDU-PLAN-01

11. **Copilot subordinate:** il copilota non è autorità curricolare né autorità di approvazione.
12. **Retrieval ≠ generation:** embedding e generazione restano responsabilità distinte.
13. **Local-first retrieval:** il recupero dalle fonti private deve poter rimanere locale.
14. **Remote explicitness:** uso di provider remoto visibile e governato da policy/opt-in.
15. **Minimal context:** non inviare al generatore più contesto di quanto necessario.
16. **Source-preserving answers:** le proposte significative devono mostrare le fonti rilevanti.
17. **No evidence, say so:** mancanza o ambiguità delle fonti non può essere mascherata da una risposta sicura.
18. **Proposal boundary:** conversare e applicare una modifica sono due operazioni distinte.
19. **No student data by default:** la progettazione UDA non riceve dati personali studente-specifici salvo futura capability separatamente governata.
20. **Provider independence:** dominio e UX non dipendono da un singolo vendor o modello.

---

## Criteri di accettazione aggiuntivi

La capability complessiva EDU-PLAN-01 è coerente con questo companion design quando un docente può:

1. aprire un copilota nel workspace della programmazione madre;
2. aprire lo stesso paradigma di copilota nella scheda di una UDA;
3. porre domande sul contesto corrente senza ricopiare manualmente titolo, ore, curricolo e fonti;
4. ricevere risposte che distinguono proposta, motivazione, fonti e impatto;
5. vedere quando una risposta usa Arena, libro, guida, calendario o decisioni precedenti;
6. chiedere modifiche come riduzione ore, divisione, accorpamento o maggiore componente laboratoriale;
7. ricevere tali modifiche come proposte strutturate, non come mutazioni automatiche;
8. scegliere **Adotta**, **Adatta** o **Ignora**;
9. mantenere invariato il dominio se la conversazione fallisce o viene abbandonata;
10. usare retrieval locale sulle fonti private;
11. usare un generatore locale quando disponibile senza cambiare la UX;
12. usare eventualmente un provider remoto solo con il confine di policy e l'opt-in richiesti;
13. continuare a usare le funzioni fondamentali di programmazione anche se il generatore non è disponibile;
14. non perdere provenance e stato di approvazione del curricolo Arena;
15. non esporre per default dati personali degli studenti al copilota di progettazione.

---

## Relazione con la generazione UDA esistente

La route esistente di generazione descrizione UDA deve essere considerata **capability legacy/precursore**, non contratto finale del nuovo copilota.

Nel piano di implementazione andrà deciso se:

- adattarla dietro il nuovo provider abstraction;
- mantenerla temporaneamente come fallback;
- sostituirla progressivamente con il flusso `Evidence Context Pack -> conversation -> CopilotProposal`.

Qualunque percorso venga scelto, non deve ridurre i guardrail SEC già presenti sull'uscita verso provider remoto.

---

## Decisioni assunte con questo emendamento

- Il copilota viene progettato **ora** come parte di EDU-PLAN-01, anche se può essere implementato per tranche.
- Il paradigma scelto è **copilota contestuale**, non chatbot generico.
- EmbeddingGemma/embedding locale è il livello di retrieval/ranking, non il generatore conversazionale.
- Il generatore è intercambiabile.
- Il percorso locale è preferito quando disponibile.
- Il provider remoto resta opzionale e governato da policy/opt-in.
- Le risposte significative devono essere source-aware e spiegabili.
- La conversazione non modifica direttamente il dominio.
- Le modifiche vengono materializzate come proposte strutturate.
- Il docente applica tramite **Adotta / Adatta / Ignora**.
- Il copilota deve poter operare sia sulla programmazione madre sia sulla singola scheda UDA.

---

## Decisioni lasciate al piano di implementazione

Senza cambiare il prodotto approvato, il piano potrà definire:

- primo runtime generativo locale supportato;
- protocollo tecnico del provider adapter;
- forma tecnica dell'indice vettoriale privato;
- chunking e ranking delle fonti;
- limiti del context pack;
- strategia di citazione/riferimento alle fonti private;
- persistenza o durata delle conversazioni;
- UI concreta del pannello copilota;
- formato esatto di `CopilotProposal`;
- migrazione della generazione one-shot esistente;
- test matrix per locale/remoto/offline/failure injection.

Queste scelte devono essere sviluppate nel piano di implementazione successivo e non autorizzano ancora modifiche al prodotto.