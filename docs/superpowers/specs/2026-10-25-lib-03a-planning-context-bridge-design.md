# LIB-03A — Planning Context Bridge Design

## Stato

APPROVED FOR IMPLEMENTATION

Baseline: `main@c9dd66c35b65a9edfe0f508f6842eefe4be562bf`.

## Intento

Creare un read model minimo e fail-closed che permetta alla Biblioteca privata di leggere insieme il contesto operativo UDA/lezione e il contesto annuale di Programmazione senza fondere i due domini, senza migrazioni e senza scritture incrociate.

LIB-03A è un prerequisito di LIB-03B (relevance resolver). Non produce ancora suggerimenti di pertinenza, ranking, UI o semantic search.

## Problema attuale

Il repository contiene due domini distinti:

- `UdaRecord` / `UdaLesson`: dominio operativo legacy, oggi realmente usato per UDA e lezioni;
- `PlanningStateV1`: dominio annuale con `TeachingProfile`, contesti Arena e strutture future `MasterProgram` / `ClassProgramInstance`.

La separazione è intenzionale finché una migrazione non sarà qualificata. `MasterProgram` non è ancora operativo e non può diventare implicitamente fonte canonica durante LIB-03A.

## Decisione architetturale

Introdurre un modulo puro `src/library/planningContextBridge.ts` che costruisce un contesto derivato soltanto da dati già disponibili in memoria.

Il bridge:

1. riceve il contesto didattico già risolto della Biblioteca (`ResolvedLibraryTeachingContext`), lo stato Programmazione, anno scolastico e disciplina correnti;
2. deriva il livello della classe dall'identità operativa in modo stretto e testabile;
3. individua i soli `TeachingProfile` compatibili con anno, disciplina e livello;
4. se il match è unico, espone il profilo;
5. seleziona un contesto Arena solo se esiste una singola versione accettata compatibile e autorevole per l'identità corrente del profilo; in caso di zero contesti il bridge resta valido ma senza Arena; in caso di più candidati il contesto Arena viene marcato ambiguo e non scelto arbitrariamente;
6. non legge né materializza `MasterProgram`, non modifica `PlanningStateV1`, UDA o Biblioteca.

## Contratto di risoluzione

Il bridge restituisce sempre un risultato strutturato:

- `resolved`: un solo `TeachingProfile` compatibile; `arenaContext` può essere presente o assente;
- `unavailable`: contesto operativo insufficiente oppure nessun profilo compatibile;
- `ambiguous`: più profili compatibili oppure più contesti Arena compatibili.

Il risultato deve includere una `reason` stabile, pensata per test e diagnostica, non per essere mostrata direttamente all'utente.

### Reason minime

- `TEACHING_CONTEXT_MISSING`
- `GRADE_LEVEL_UNRESOLVED`
- `PLANNING_PROFILE_NOT_FOUND`
- `PLANNING_PROFILE_AMBIGUOUS`
- `ARENA_CONTEXT_AMBIGUOUS`
- `RESOLVED`

## Identità e normalizzazione

### Classe / livello

Il resolver non deve usare il solo primo carattere della stringa. Accetta forme comuni che iniziano con un livello intero da 1 a 5 seguito da separatore/indicatore di classe, per esempio `3ª C`, `3A`, `3 A`, `3^A`. Stringhe non interpretabili o livelli fuori range restituiscono `null`.

Questa derivazione serve solo a collegare temporaneamente il dominio operativo al profilo annuale. Non crea una nuova identità persistente della classe.

### Anno scolastico

Per il confronto sono equivalenti le forme `2026-2027`, `2026/2027` e `2026/27`. Il bridge normalizza solo per il confronto e non modifica i valori persistiti.

### Disciplina

Il confronto usa trim + lowercase; nessuna tabella di alias viene introdotta in LIB-03A.

## Contesto Arena

Un contesto Arena è candidato solo se coincide con **l'identità corrente del profilo**, non semplicemente con l'identità che aveva al momento di una precedente accettazione. Questo è necessario perché il profilo può essere modificato dopo l'accettazione e i contesti Arena già persistiti non vengono automaticamente rimossi.

Il bridge replica quindi il confine identitario usato dall'accettazione Arena e richiede:

- `profileId` coincidente;
- `schoolYear` equivalente dopo normalizzazione;
- `schoolOrder` coerente (`primary → primaria`, `lower_secondary → secondaria`);
- `subjectCode` coincidente dopo normalizzazione;
- `gradeLevel` coincidente;
- `cohortRef` coincidente esattamente;
- `regimeRef` coincidente esattamente con il `normativeRegime` corrente e non vuoto;
- `privacyClass === 'PROFESSIONAL_NON_PERSONAL'`;
- `authorityState === 'APPROVED'`;
- `vigencyStatus === 'VIGENTE'`.

Un contesto precedentemente accettato ma diventato stale dopo una modifica a ordine scolastico o regime normativo viene ignorato e non riutilizzato implicitamente.

Se non esiste un candidato, il bridge restituisce `resolved` con `arenaContext: null`.

Se esistono più candidati, non sceglie “l'ultimo” o il più recente: restituisce `ambiguous` con `ARENA_CONTEXT_AMBIGUOUS`.

I `curricoloItems` restano read-only e non vengono interpretati come copertura curricolare. Tale semantica appartiene al punto 3 del piano.

## Privacy e rete

LIB-03A:

- non riceve `LibrarySource`;
- non chiama embedding;
- non chiama provider IA;
- non effettua fetch;
- non modifica la classificazione privacy;
- non autorizza flussi remoti.

Questo evita che il bridge erediti il default storico `TEACHER_PROFESSIONAL` di `embeddingService`.

## Persistenza

Nessuna nuova persistenza e nessuna modifica schema.

Il bridge è una funzione pura. `PlanningStateV1`, `LibraryStateV1`, UDA e backup restano invariati.

## Non obiettivi

LIB-03A non deve:

- migrare UDA in `MasterProgram`;
- usare o popolare `planning.resources`;
- creare link Biblioteca → UDA;
- generare proposte didattiche;
- fare ranking semantico;
- usare `targetType: activity`;
- dichiarare coperture o lacune rispetto agli item Arena;
- aggiungere UI.

## Approcci considerati

### A. Migrare subito UDA nel nuovo dominio Programmazione

Scartato. Il dominio annuale non è ancora operativo fino a `MasterProgramVersion` e class instances; allargherebbe il perimetro e renderebbe LIB-03 dipendente da una migrazione non qualificata.

### B. Collegare direttamente Biblioteca alle UDA legacy e ignorare Programmazione

Scartato. Funzionerebbe nel breve periodo ma renderebbe impossibile distinguere pertinenza operativa da contesto annuale e ci costringerebbe a rifare LIB-03 dopo la migrazione.

### C. Read-only bridge tra i due domini

Scelto. È reversibile, testabile, non introduce nuove autorità e prepara LIB-03B senza anticipare il punto 3.

## Criteri di accettazione

LIB-03A è qualificato quando:

1. il livello classe viene risolto solo da input validi e resta fail-closed sugli input ambigui/malformati;
2. un solo profilo annuale compatibile viene risolto correttamente;
3. zero profili produce `unavailable`;
4. più profili producono `ambiguous`;
5. zero contesti Arena non invalida il profilo risolto;
6. un solo contesto Arena pienamente coerente, APPROVED e VIGENTE viene esposto;
7. più contesti Arena validi producono `ambiguous`;
8. contesti Arena provisional, non-vigenti, non-professionali, identity-mismatched o stale rispetto a `schoolOrder`/`normativeRegime` vengono ignorati;
9. nessun file UI, schema di persistenza, provider, embedding o runtime remoto viene modificato;
10. `test:library`, security tests, typecheck, build e production startup smoke restano verdi.

## Confine di integrazione

L'implementazione termina con Draft PR e qualificazione exact-SHA. Nessun merge e nessun deploy senza una nuova decisione umana.