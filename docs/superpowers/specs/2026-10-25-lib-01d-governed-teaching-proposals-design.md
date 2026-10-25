# LIB-01D — Governed Teaching Proposals Design

**Status:** approved for implementation  
**Baseline:** `main@4be167245267da6d664e634e5070a2cc9beb265f`  
**Predecessors:** LIB-01A, LIB-01B, LIB-01C integrated and live verified

## Intent

Completare il primo ciclo realmente utile della Biblioteca privata:

`fonte -> contesto didattico -> proposta -> decisione del docente`.

Il docente deve poter prendere una fonte già presente nella Biblioteca, usarla nel contesto di una UDA o lezione e ottenere una proposta didattica concreta senza trasformare il copilota in un'autorità curricolare o in un canale implicito di invio dati a provider remoti.

Decisione umana vincolante: **una proposta non modifica il Registro, la UDA o la lezione finché il docente non sceglie esplicitamente di adottarla**.

## Outcome del primo incremento

LIB-01D implementa un solo vertical slice completo e verificabile:

1. il docente sceglie `Usa` su una fonte;
2. il teaching context LIB-01C propone o richiede UDA/lezione;
3. per una fonte classificata `teacher-professional`, la UI può offrire una disclosure separata per la generazione remota;
4. l'autorizzazione è **per singola richiesta**, non persistente;
5. il Core condiviso viene rieseguito con `generativeMode = remote` e `remoteProviderAllowed = true` soltanto dopo quell'autorizzazione;
6. la capability `PREPARE` può allora essere risolta dal Core;
7. il server genera una proposta strutturata usando un adapter provider-neutral; l'implementazione iniziale usa l'infrastruttura Gemini già presente nel repository;
8. la proposta resta effimera finché il docente non sceglie `Adotta` o `Adatta`;
9. `Adotta` / salvataggio dopo `Adatta` crea un nuovo materiale `internal` nella Biblioteca privata, collegato alla UDA/lezione selezionata e con provenienza dalla fonte originale;
10. `Lascia` scarta la proposta senza mutazioni.

## Goals

- Attivare per la prima volta `PREPARE` attraverso il TRAMA Contextual Copilot Core condiviso.
- Non duplicare il policy engine del Core nel Registro.
- Mantenere il `ContextSnapshot` privo del contenuto integrale della fonte.
- Separare chiaramente **policy context** e **generation payload**.
- Richiedere classificazione `teacher-professional` e opt-in esplicito prima di ogni richiesta remota.
- Vietare invio remoto di `unknown`, `student-personal`, `STUDENT_PERSONAL` o `STUDENT_SENSITIVE`.
- Produrre una proposta strutturata, leggibile ed editabile.
- Rendere `Adotta / Adatta / Lascia` il confine human-in-the-loop.
- Riutilizzare Secure Local Vault, backup cifrato e dominio Biblioteca per il materiale adottato.
- Preservare progressive disclosure, touch target mobile e i gate UX-QA esistenti.

## Non-goals

- Nessuna semantic search o retrieval intelligente della Biblioteca.
- Nessun ranking generativo del teaching context.
- Nessuna nuova entità persistente `activity` o `material` fuori dalla Biblioteca.
- Nessuna scrittura diretta dentro UDA/lezione in questo incremento.
- Nessuna modifica dell'autorità curricolare Arena.
- Nessun invio di nomi studenti, voti, comportamento, note sensibili o dati di classe individuali.
- Nessuna attivazione di `SUMMARIZE` nel primo vertical slice.
- Nessun fetch server-side arbitrario di URL esterni.
- Nessun provider configurabile dall'utente in LIB-01D.
- Nessun auto-merge o deploy implicito.

## Approcci considerati

### A. Chiamata Gemini diretta dal browser

Scartato. Esporrebbe troppo il provider, indebolirebbe il confine server-side per le chiavi e renderebbe più facile bypassare SEC/Core.

### B. Template locale deterministico

Scartato come soluzione finale del vertical slice. Sarebbe sicuro ma non risponderebbe al requisito di trasformare davvero una fonte eterogenea in una proposta didattica pertinente.

### C. Generazione server-side governata — scelta

Il browser chiede una capability al Core; il server riceve un payload separato, minimizzato e validato; una porta provider-neutral esegue la generazione. Gemini è soltanto il primo adapter concreto perché l'infrastruttura `@google/genai` e `GEMINI_API_KEY` esistono già nel repository.

## Architecture

```text
LibrarySource
  -> deterministic TeachingContext (LIB-01C)
  -> ContextSnapshot minimizzato
  -> Contextual Copilot Core
  -> explicit one-shot remote consent
  -> PREPARE resolved/dispatch
  -> LibraryProposalRequest separato dal ContextSnapshot
  -> server policy validation
  -> TeachingProposalProvider
  -> structured TeachingProposalV1
  -> preview/edit
  -> Adotta | Adatta | Lascia
  -> internal LibrarySource + provenance + UDA/lesson link
  -> Secure Local Vault
```

Il Core decide **se l'azione è ammessa**. Il provider genera **il contenuto della proposta**. Il Registro decide **come rappresentare e, dopo decisione umana, persistere il risultato**.

## Core policy

Il registry esistente mantiene `prepare-from-source` con capability `PREPARE`, rischio `PROPOSE`, `requiresGenerativeAI = true`.

Due modalità devono coesistere:

- core locale predefinito: `generativeMode = none`, `remoteProviderAllowed = false`;
- core remoto one-shot: `generativeMode = remote`, utilizzabile soltanto con snapshot che abbia `remoteProviderAllowed = true` e nessuna data class protetta.

Il Core già nega in modalità remota quando:

- `remoteProviderAllowed = false`;
- `dataClasses` contiene `STUDENT_PERSONAL` o `STUDENT_SENSITIVE`.

LIB-01D non deve indebolire questi guard.

## Remote consent

L'opt-in remoto è **effimero e request-scoped**.

Non viene scritto nel vault, in localStorage o nelle preferenze.

La UI può mostrare `Usa IA per preparare un'attività` soltanto quando:

- esiste un teaching context valido;
- la fonte ha contenuto utilizzabile;
- la fonte è `teacher-professional` oppure il docente la classifica esplicitamente come tale.

Per `unknown`, la UI deve prima richiedere una classificazione esplicita con copy chiaro. Per `student-personal` la generazione remota resta indisponibile.

La classificazione `teacher-professional` è una mutazione locale reversibile della fonte; l'opt-in remoto resta separato e non persiste.

## Generation payload vs ContextSnapshot

Il `ContextSnapshot` continua a contenere soltanto identificatori e metadati strutturali già ammessi.

Il payload generativo è separato e può contenere solo ciò che serve per quella richiesta:

```ts
export interface LibraryProposalRequestV1 {
  schemaVersion: 1;
  action: 'prepare-activity';
  classification: 'TEACHER_PROFESSIONAL';
  explicitTeacherOptIn: true;
  source: {
    id: string;
    kind: LibrarySourceKind;
    title: string;
    text?: string;
    mimeType?: string;
    dataBase64?: string;
  };
  context: {
    udaId: string;
    udaTitle: string;
    className: string;
    period: string;
    lessonId?: string;
    lessonTopic?: string;
    activityType?: UdaActivityType;
  };
}
```

Non sono ammessi: nomi studenti, studentId, voti, comportamento, osservazioni, note personali, roster o dati istituzionali non necessari.

## Source eligibility

### Text / note / concept

Usare `extractedText ?? payload.text`.

### Web

Usare soltanto testo già acquisito localmente (`extractedText` o `payload.text`). Un URL senza contenuto catturato non autorizza fetch server-side e deve produrre uno stato leggibile: `Contenuto della pagina non disponibile nella fonte`.

### Image

Usare `payload.dataUrl` soltanto se il MIME è `image/*` e la fonte è entro il limite di acquisizione Biblioteca. Il client rimuove il prefisso data URL e invia base64 + MIME.

### File

Nel primo incremento sono supportati inline soltanto:

- `application/pdf`;
- `text/*`;
- immagini già classificate come `image`.

Altri MIME restano archiviabili nella Biblioteca ma non generabili finché non esiste un estrattore/adapter dedicato.

Il limite Biblioteca resta 8 MiB. Il route body limit deve essere specifico dell'endpoint generativo e non ampliare indiscriminatamente tutti gli endpoint JSON.

## TeachingProposalV1

```ts
export interface TeachingProposalV1 {
  schemaVersion: 1;
  kind: 'activity';
  title: string;
  objective: string;
  teacherSetup: string;
  studentTask: string;
  steps: string[];
  questions: string[];
  adaptationHint: string;
  sourceId: string;
  context: {
    udaId: string;
    lessonId?: string;
  };
  provenance: {
    mode: 'remote';
    provider: string;
    model: string;
    generatedAt: string;
  };
}
```

Server e client devono validare la struttura prima di renderla come proposta utilizzabile.

Non si accetta testo libero non validato come successo.

## Provider-neutral server port

```ts
export interface TeachingProposalProvider {
  readonly id: string;
  readonly model: string;
  generate(input: TeachingProposalProviderInput): Promise<TeachingProposalContent>;
}
```

La route `/api/copilot/library-proposal`:

1. valida shape e allowlist;
2. verifica `classification === TEACHER_PROFESSIONAL`;
3. verifica `explicitTeacherOptIn === true` tramite la policy SEC già disponibile;
4. rifiuta payload senza contenuto utilizzabile;
5. rifiuta MIME non supportati;
6. invoca una sola volta il provider;
7. valida la risposta strutturata;
8. aggiunge provenance server-side;
9. restituisce `TeachingProposalV1`.

Nessun retry automatico in LIB-01D.

## Prompt contract

Il provider riceve una richiesta che impone:

- italiano;
- livello scuola secondaria di primo grado salvo contesto più specifico già presente;
- uso esclusivo della fonte e del contesto forniti;
- nessuna invenzione di dati sugli studenti;
- attività realizzabile;
- struttura JSON compatibile con `TeachingProposalContent`;
- niente saluti o metadiscorso.

Il prompt non trasferisce authority: la risposta è sempre etichettata come `Proposta`.

## Adoption model

`Adotta` non modifica la fonte originale.

Crea un nuovo `LibrarySource`:

- `kind: 'internal'`;
- `status: 'ready'`;
- `privacy: 'teacher-professional'`;
- `payload.text`: rappresentazione leggibile della proposta;
- `links`: UDA o lezione selezionata;
- `provenance`: riferimento alla fonte originale + provider/model/generatedAt + proposal kind.

Il dominio `LibrarySource` viene esteso con provenance opzionale e retrocompatibile:

```ts
export interface LibrarySourceProvenance {
  derivedFromSourceId: string;
  generation?: {
    provider: string;
    model: string;
    generatedAt: string;
    kind: 'activity';
  };
}
```

Il backup v4 resta leggibile; il validator deve validare i nuovi campi opzionali senza invalidare vecchie fonti.

## Adatta

`Adatta` apre un editor locale della proposta con campi controllati. Le modifiche non chiamano il provider e non scrivono nel vault.

Il salvataggio finale usa lo stesso percorso `Adotta`, con il contenuto modificato dal docente.

## Lascia

`Lascia` chiude la proposta e azzera lo stato effimero. Nessuna mutazione, nessuna nuova fonte, nessun link.

## UX

Progressive disclosure obbligatoria:

1. card fonte normale;
2. `Usa`;
3. contesto proposto/selettore;
4. azioni locali Core;
5. disclosure generativa separata;
6. consenso remoto one-shot;
7. `Prepara attività` appare solo dopo autorizzazione Core;
8. durante la richiesta: stato pending non re-entrant;
9. proposta in una sola superficie leggibile;
10. `Adotta`, `Adatta`, `Lascia` come uniche decisioni primarie sul risultato.

Mobile: controlli primari >=44x44, nessun overflow orizzontale.

## Failure behavior

- `unknown` -> nessuna richiesta remota prima della classificazione;
- `student-personal` -> remoto sempre negato;
- teaching context stale -> nessuna generazione;
- URL-only web source -> nessun fetch remoto implicito;
- MIME non supportato -> messaggio locale, nessuna richiesta;
- provider assente/errore -> fonte e contesto restano invariati, retry esplicito possibile;
- output provider malformato -> FAIL, non rendering parziale come proposta valida;
- doppio click pending -> una sola richiesta;
- cambio UDA/lezione -> revoca opt-in e scarta eventuale proposta precedente;
- `Lascia` -> zero persistenza;
- errore persistente su `Adotta` -> proposta/edit conservata per retry, nessun falso successo.

## Verification

### Contract/security

Coprire almeno:

- generative action assente con core locale;
- `PREPARE` presente solo con remote mode + one-shot opt-in + `TEACHER_PROFESSIONAL`;
- `unknown` e `student-personal` negati;
- ContextSnapshot senza payload fonte;
- generation request senza dati studente;
- URL-only fail-closed;
- MIME allowlist;
- size limit;
- server SEC opt-in enforcement;
- output parser fail-closed;
- provenance validation e backup restore.

### Browser

Con dati sintetici e route API intercettata:

- fonte `unknown`: nessuna rete generativa;
- classificazione professionale + consenso one-shot;
- `PREPARE` appare solo dopo il consenso;
- request payload non contiene dati studenti;
- proposta strutturata renderizzata;
- `Lascia` non persiste;
- `Adatta` modifica localmente;
- salvataggio crea fonte `internal` collegata al teaching context;
- reload/lock-unlock mantiene il materiale adottato;
- cambio contesto revoca il consenso;
- mobile 390x844 touch-safe e senza overflow;
- desktop 1280x900;
- zero page errors/console errors inattesi;
- tutti i gate LIB-01A/B/C e UX-QA restano verdi.

## Integration boundary

LIB-01D può essere qualificata e portata a decisione umana separata. Nessuna qualifica autorizza merge o deploy. Il provider iniziale non diventa parte dell'autorità di dominio e potrà essere sostituito dietro la porta server senza cambiare il contratto Biblioteca/Core.