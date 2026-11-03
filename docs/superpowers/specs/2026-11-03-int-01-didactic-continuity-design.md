# INT-01 — Continuità Programmazione ↔ UDA ↔ lezione/attività

**Status:** DESIGN READY FOR REVIEW  
**Date:** 2026-11-03  
**Baseline:** `main@0488cd50287ef26883f395e2b79ab1fcba11ccdc`  
**Scope:** issue #115  
**Roadmap:** issue #104

## Intento

INT-01 rende **Programmazione → UDA → lezione/attività** un unico filo professionale percepibile senza trasformare Programmazione in una seconda UDA, senza migrare prematuramente i dati legacy e senza introdurre un nuovo contesto concorrente con CTX-01.

Il docente deve poter entrare da `Prepara`, vedere la cornice annuale corretta per la classe, passare all'UDA mantenendo la classe e l'eventuale focus didattico esplicito, quindi tornare alla Programmazione senza ricominciare la selezione.

Principio UX-GOV-01 applicato:

> **Programmazione è la cornice professionale stabile; UDA è il livello di attuazione; lezione/attività è l'unità operativa. L'app mantiene il contesto, ma non inventa i collegamenti che il docente non ha scelto.**

## Stato attuale rilevato

### Programmazione

`PlanningProfileView` gestisce oggi:
- `TeachingProfile`;
- contesti Arena accettati;
- modifica/salvataggio del profilo.

La vista mantiene un proprio `selectedId` e, in assenza di un riferimento contestuale, usa il primo profilo disponibile. Non riceve la classe corrente né un teaching focus.

### UDA / lezione

`UdaRecord` e `UdaLesson` costituiscono il dominio operativo effettivo. Una UDA contiene `className`, ore, periodo, cronologia/lezioni e dipendenze, ma nessun riferimento persistente a `TeachingProfile` o Arena.

`UdaGanttView` possiede selezioni interne (`selectedUdaForDetail`, filtri, handoff Registra), ma non espone all'applicazione un teaching focus generale condiviso con Programmazione.

### CTX-01

`ProfessionalContextV1` contiene già:
- `classId / className`;
- `udaId`;
- `lessonId`;
- `planningProfileId`;
- `arenaContextId`;
- tempo e privacy.

Questa è la proiezione canonica da preservare. Oggi l'ambient context costruito in `App` parte soprattutto dalla classe corrente e non viene alimentato in modo stabile dalla selezione UDA/lezione né da una cornice Programmazione class-first.

### Bridge Programmazione esistente

`resolveLibraryPlanningContext()` risolve profilo e Arena partendo da un `ResolvedLibraryTeachingContext`. È corretto per LIB-03, ma è Biblioteca-specifico e non consente di risolvere Programmazione dalla sola classe.

### Strutture annuali future

`MasterProgram`, `MasterProgramVersion` e `ClassProgramInstance` esistono nel modello, ma `MasterProgramVersion` non è incluso in `PlanningStateV2` e non è consumato dal prodotto. La relazione `udaIds[]` non è quindi oggi una relazione operativa.

INT-01 non la promuove implicitamente ad autorità.

## Obiettivi

1. Risolvere la cornice Programmazione dalla **classe corrente**, senza richiedere una UDA fittizia.
2. Riutilizzare un unico teaching focus `{ udaId, lessonId? }` session-only.
3. Validare sempre il teaching focus contro classe e catalogo didattico.
4. Alimentare `ProfessionalContextV1` con classe + cornice Programmazione + teaching focus quando disponibili.
5. Rendere visibile la continuità nelle superfici esistenti Programmazione e UDA con un elemento compatto, non con una nuova dashboard.
6. Consentire Programmazione → UDA e UDA → Programmazione mantenendo il contesto valido.
7. Preservare l'autorità delle UDA proiettate da Docente OS (`writableByRegistro=false`).
8. Mantenere LIB-03, FLOW-01/02/03/04 e i payload persistenti compatibili.

## Non-obiettivi

- nessuna migrazione UDA → `MasterProgramVersion`;
- nessuna aggiunta di `MasterProgramVersion[]` a `PlanningStateV2`;
- nessun `planningProfileId` persistito in `UdaRecord`;
- nessun nuovo `IntegrationContext` persistente;
- nessuna generazione automatica di UDA/lezioni;
- nessuna mappatura automatica UDA ↔ singoli `ArenaCurricoloItem`;
- nessuna clonazione di UDA Docente OS in UDA Registro;
- nessun anticipo di INT-02, LSM-02 o MOBILE-01;
- nessun ridisegno strutturale di `UdaGanttView`.

## Approcci considerati

### A. Migrare subito le UDA nel dominio MasterProgram

Si renderebbe operativo `MasterProgramVersion`, si aggiungerebbero versioni persistite e si legherebbero le UDA al programma annuale.

**Scartato per INT-01.** Il modello è incompleto nello stato persistito, la migrazione toccherebbe backup/restore e autorità dati e trasformerebbe un incremento di continuità UX in una migrazione di dominio.

### B. Aggiungere `planningProfileId` a ogni `UdaRecord`

Creerebbe un legame durevole semplice.

**Scartato.** Il profilo è già derivabile in modo deterministico da anno, disciplina e livello quando il contesto è valido. Persistire l'id duplichererebbe identità e introdurrebbe link stale da governare.

### C. Cornice class-first + teaching focus condiviso session-only

Estrarre un resolver generico della cornice annuale; riusare `{udaId, lessonId?}` come unico focus didattico; alimentare CTX-01 e le superfici esistenti con lo stesso contesto.

**Scelto.** È il minimo incremento che rende operativa la continuità professionale, resta reversibile, non cambia l'autorità persistente e prepara una futura migrazione MasterProgram senza anticiparla.

## Architettura

### 1. `planningFrameResolver` generico

Creare `src/planning/planningFrameResolver.ts`.

Contratto proposto:

```ts
export type PlanningFrameReason =
  | 'CLASS_CONTEXT_MISSING'
  | 'GRADE_LEVEL_UNRESOLVED'
  | 'PLANNING_PROFILE_NOT_FOUND'
  | 'PLANNING_PROFILE_AMBIGUOUS'
  | 'ARENA_CONTEXT_AMBIGUOUS'
  | 'RESOLVED';

export interface ResolvePlanningFrameInput {
  className: string | null | undefined;
  planning: PlanningState;
  schoolYear: string;
  subjectCode: string;
}

export type PlanningFrameResolution =
  | {
      status: 'resolved';
      reason: 'RESOLVED';
      className: string;
      profile: TeachingProfile;
      arenaContext: ArenaPlanningContext | null;
    }
  | {
      status: 'unavailable';
      reason:
        | 'CLASS_CONTEXT_MISSING'
        | 'GRADE_LEVEL_UNRESOLVED'
        | 'PLANNING_PROFILE_NOT_FOUND';
    }
  | {
      status: 'ambiguous';
      reason: 'PLANNING_PROFILE_AMBIGUOUS' | 'ARENA_CONTEXT_AMBIGUOUS';
    };
```

Il resolver riusa le stesse regole già qualificate da LIB-03A:
- normalizzazione anno scolastico;
- livello classe fail-closed;
- disciplina normalizzata;
- Arena valido solo se coerente con profilo corrente, `APPROVED`, `VIGENTE`, `PROFESSIONAL_NON_PERSONAL`.

Nessun fallback al primo profilo o all'ultimo Arena.

### 2. LIB-03 delega al resolver generico

`src/library/planningContextBridge.ts` conserva `LibraryPlanningContextResolution` e le reason pubbliche esistenti.

Il bridge:
1. fallisce con `TEACHING_CONTEXT_MISSING` se manca il teaching context;
2. chiama `resolvePlanningFrame()` con `teachingContext.className`;
3. mappa le reason generiche nelle reason LIB-03 esistenti;
4. su `resolved` riattacca `teachingContext` al risultato.

Così INT-01 non crea due algoritmi di matching Programmazione.

### 3. Teaching focus unico e session-only

Riutilizzare `LibraryTeachingContext`:

```ts
interface LibraryTeachingContext {
  udaId: string;
  lessonId?: string;
}
```

In `App` introdurre una sola variabile session-only, ad esempio:

```ts
const [teachingFocus, setTeachingFocus] = useState<LibraryTeachingContext | null>(null);
```

Non entra in snapshot, backup o stato persistente.

Creare un helper puro `src/context/teachingFocus.ts` che valida il focus contro:
- catalogo didattico corrente;
- classe corrente per id;
- eventuale `lessonId` solo quando la UDA Registro contiene davvero quella lezione.

Risultato:
- target valido → `ResolvedLibraryTeachingContext`;
- target assente/mismatch/ambiguo → `null` o reason strutturata;
- UDA Docente OS → risolvibile come UDA read-only, senza lesson locale inventata.

### 4. CTX-01 resta canonico

Estendere `ResolveProfessionalContextInput` con una cornice Programmazione generica opzionale:

```ts
planningFrame?: PlanningFrameResolution | null;
```

Compatibilità:
- `planningContext?: LibraryPlanningContextResolution | null` resta supportato per i consumer esistenti;
- se entrambe le forme sono presenti, devono descrivere la stessa classe/profilo oppure il resolver fallisce chiuso;
- `planningFrame.status === 'ambiguous'` produce il conflitto professionale già previsto per ambiguità Programmazione;
- su `resolved`, `planningProfileId` e `arenaContextId` entrano in `ProfessionalContextV1` anche quando non esiste ancora una UDA selezionata.

Nessun dato studente viene aggiunto.

### 5. Perimetro della continuità

Il teaching focus è mantenuto mentre il docente lavora tra:
- `programmazione`;
- `uda-gantt`;
- Copilota aperto come overlay da una di queste superfici, perché la tab sottostante non cambia.

Il focus viene invalidato almeno su:
- cambio classe;
- restore/reset/nuovo ingresso applicativo;
- target UDA non più risolvibile;
- mismatch classe;
- navigazione esplicita fuori dal perimetro INT-01, salvo handoff specialistici già governati da FLOW-02/03 che possiedono un proprio contesto.

Non deve esistere un focus latente che riappaia dopo aver lavorato su una classe o superficie incompatibile.

### 6. Continuità UI

Creare un componente compatto, ad esempio `DidacticContinuityBar`, usato da Programmazione e UDA.

Mostra solo informazioni già risolte:
- `Classe 2C`;
- `Cornice: Tecnologia · classe 2 · 2026-27` quando risolta;
- stato Arena sintetico se presente;
- `UDA: ...` quando esplicita;
- `Lezione: ...` solo quando esiste un lesson focus esplicito.

Azioni:
- in Programmazione: `Apri UDA`;
- in UDA: `Apri Programmazione`;
- eventuale `Cambia UDA` resta dentro UDA, non nella barra.

La barra non mostra KPI, percentuali, gap o raccomandazioni. Non è una dashboard.

### 7. Programmazione context-aware

`PlanningProfileView` riceve un `focusedProfileId?: string | null` derivato da `PlanningFrameResolution`.

Regole:
- con classe corrente e frame `resolved`, focalizza quel profilo;
- con frame `ambiguous/unavailable`, non sceglie arbitrariamente un profilo per conto del docente;
- senza classe corrente, conserva la modalità esperta attuale e può mostrare il primo profilo come comportamento standalone;
- una selezione manuale del docente resta possibile, ma non modifica la classe o il teaching focus implicitamente.

### 8. UDA context-aware

`UdaGanttView` riceve:
- classe corrente/focus classe;
- teaching focus opzionale;
- callback per notificare selezioni esplicite di UDA/lezione.

Regole:
- entrando da Programmazione senza UDA, filtra/focalizza la classe ma non sceglie una UDA se più candidati esistono;
- con UDA esplicita valida, apre/focalizza quella UDA;
- con lessonId esplicito già valido, preserva il riferimento senza introdurre un nuovo selettore lezione;
- INT-01 non modifica le regole di scrittura UDA né il lifecycle PERSIST-01H.

## Autorità e provenienza

### UDA Registro

`origin='registro'`, `writableByRegistro=true`: il focus può guidare la vista; le modifiche continuano a passare dai mutation coordinator esistenti.

### UDA Docente OS

`origin='docente-os'`, `writableByRegistro=false`: può essere mostrata come contesto didattico riconciliato, ma INT-01 non abilita editing, lezione locale o clonazione implicita.

### Arena

Il contesto Arena resta cornice read-only accettata. INT-01 non interpreta `curricoloItems` come copertura automatica di una UDA.

## Persistenza e privacy

Nessun nuovo campo persistente.

Il teaching focus e la continuità di navigazione non entrano in:
- `AppData`;
- `PlanningState`;
- `SecureAppSnapshot`;
- backup;
- `LibraryStateV1`;
- `ProfessionalMemoryStateV1`;
- `CopilotStateV1`;
- memoria semantica.

`ProfessionalContextV1` resta una proiezione runtime e continua a escludere dati studente per default.

## Failure mode obbligatori

1. Classe corrente 2C + UDA di 3C → focus invalidato, nessun trasferimento.
2. Due profili compatibili → `ambiguous`, nessun profilo auto-selezionato.
3. Due contesti Arena pienamente validi → `ambiguous`, nessun Arena auto-selezionato.
4. UDA cancellata mentre è il focus → focus invalidato.
5. lessonId inesistente → non viene inventata né mantenuta.
6. UDA Docente OS con lessonId → fail closed sul lessonId; la proiezione non possiede lezioni locali.
7. Cambio classe → focus precedente eliminato prima del rendering della nuova cornice.
8. Reload/unlock → nessun teaching focus ripristinato dal vault.

## Qualifica

### Dominio
- contract test `PlanningFrameResolution` RED → GREEN;
- parità/regressione completa LIB-03A;
- teaching focus resolver RED → GREEN;
- CTX-01 con planning frame senza UDA;
- mismatch class/planning/teaching fail-closed;
- UDA Docente OS read-only.

### Persistenza
- source/contract test che `teachingFocus` non entra in snapshot/backup;
- backup restore invariato;
- nessuna modifica schema Planning/UDA.

### Browser
Journey dedicato desktop + 390×844:
1. `Oggi → Prepara`;
2. selezione classe;
3. `Definisci la cornice` → Programmazione focalizzata sul profilo coerente;
4. `Apri UDA` → stessa classe, nessuna auto-creazione;
5. selezione UDA esplicita;
6. `Apri Programmazione` → stessa classe + UDA visibile nella continuità;
7. ritorno UDA → stessa UDA focalizzata;
8. cambio classe → focus precedente scompare;
9. scenario profilo ambiguo → nessun profilo arbitrario;
10. mobile: nessun overflow, target >=44 px, barra non copre contenuti.

### Regressioni
- FLOW-01 / FLOW-02 / FLOW-03 / FLOW-04;
- LIB-03;
- CTX-01;
- PERSIST-01H;
- A4-R2 Docente OS projection authority;
- PREDEPLOY completa.

## Human Product/UX Review

PASS richiede che il docente percepisca una sola catena:

**classe → cornice Programmazione → UDA → eventuale lezione**, senza dover capire il dominio tecnico sottostante.

La review deve verificare in particolare:
- nessuna nuova dashboard;
- nessuna selezione arbitraria;
- Programmazione non appare scollegata dalla classe;
- UDA non appare come applicazione parallela;
- il passaggio tra le due superfici conserva il contesto;
- l'autorità read-only delle proiezioni è comprensibile e non confusa con un errore.

## Confine di promozione

INT-01 può diventare Ready solo dopo:
- engineering qualification exact-SHA;
- Browser Qualification exact-SHA;
- Final Independent Review senza finding Critical/Important aperti;
- Human Product/UX Review PASS.

Nessun merge o deploy senza autorizzazione esplicita separata.