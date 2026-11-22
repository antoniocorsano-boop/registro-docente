# VAL-01/PRODUCT-04 — Programmare una prova e confermarne lo svolgimento

**Origine:** chat del progetto Registro Docente, richiesta «Possiamo Possiamo procedere» del 21 novembre 2026.  
**Base qualificata:** [PR #388](https://github.com/antoniocorsano-boop/registro-docente/pull/388) exact `107a094f4af986a5d96ff580d464daeb5a2fe54c`, 10/10 workflow PASS, 157 invarianti.  
**Ramo:** `feat/val01-product04-planned-assessment-lifecycle`, sviluppato sopra #388, separato da `main`.

## Motivo e percorso del docente

PRODUCT-03 permette già di registrare una prova **svolta** e subito utilizzabile per rilevazioni individuali, ma non di programmare la lezione. Ora il docente può:

1. Aprire nel Tabellone giornaliero «Predisponi prova e criteri».
2. Selezionare **«Da svolgere»**, la **data prevista**, titolo, finalità, obiettivo dichiarato e 1–4 criteri, ciascuno con evidenza e metodo atteso.
3. Esaminare e confermare la **programmazione**. La prova rimane nell'archivio cifrato con stato `planned`; non compare tra le prove concluse e non attiva livelli individuali.
4. In un momento distinto scegliere «Concludi una prova programmata», selezionare la prova e la **data effettiva**, esaminare e confermare lo svolgimento. Una nuova revisione `completed` conserva il collegamento alla precedente.
5. Solo da quel momento la prova è disponibile nel registratore per criterio già realizzato (#387); le osservazioni confermate vengono consultate nella Scheda alunno (#386).

La modalità già esistente **«Già svolta»** continua a produrre un'operazione unica, senza cambiamento di significato o tracciati precedenti.

## Contratti e confini

- Nuovo modo opzionale `planned` in `dailyAssessmentSetup.ts`, senza cambiare il formato storico delle richieste PRODUCT-03: S5b conferma la revisione `planned` senza eseguire in anticipo S6a.
- `dailyPlannedAssessmentCompletion.ts` elenca solo prove attivamente programmate e ricalcola `previewAssessmentCompletion` / `confirmAssessmentCompletion` (S6a), con validazione indipendente di classe, anno, disciplina e studenti.
- Il completamento verifica la **corrispondenza esatta dell'intero documento** prima del commit. Il rifiuto di un documento modificato tra anteprima e conferma evita qualsiasi sovrascrittura di prove o rilevazioni effettuate nel frattempo.
- Il salvataggio utilizza esclusivamente `commitAppDataMutation`, la medesima coda cifrata e l'archivio V1; nessun altro sistema di memorizzazione, provider remoto o scrittura anticipata. Un errore non produce ricevute né rettifiche silenziose.
- Il Tabellone continua a custodire le bozze e a bloccare altre scritture durante la conferma. Riservatezza attiva per consultare e operare sul pannello.
- Obiettivi manuali esplicitamente locali; non promuovere gli obiettivi a riferimenti approvati da Arena senza contratto esterno.
- La programmazione non costituisce un voto, un esito negativo o una certificazione di competenza. Nessuna inferenza da medie, nessun invio remoto di dati studente, nessun dato reale negli scenari.

## Evidenze di sviluppo

- `src/security/val01Product04PlannedLifecycle.test.ts`: 10 test di dominio, continuità PRODUCT-03, documenti inizialmente assenti, prova pianificata esclusa da registrazione, S6a distinto, preservazione riferimenti, replay, contesto errato, salvataggio interrotto, sicurezza UI e titolarità applicativa.
- `tests/browser/val01-s6d-operational.spec.cjs`: tre nuovi scenari di navigazione reale sul laboratorio cifrato DB2, tra cui l'intera filiera programmazione → completamento → evidenza e la geometria 320 px con testo 200% e 390 px.
- Invariante **VAL-01-PRODUCT04-I01**, totale candidate **158**; tutte le 157 precedenti conservate.
- Acquisire compilazione TypeScript, prove sintetiche, Chromium, laboratorio Android DB2, compatibilità Beta1 e altre verifiche sullo SHA *esatto della PR* prima di dichiarare PASS.
- Le prove automatiche in laboratorio non certificano l'installazione fisica sul dispositivo. R1/R2/R3 restano riservati alla fase di accettazione/distribuzione secondo issue #104.

## Decisioni sul seguito

Prima di ampliare ulteriormente la valutazione verificare in un collaudo docente sintetico la fruibilità del Tabellone come prodotto: pochi tocchi, navigazione coerente, selezione UDA/riferimenti curricolari versionati e assenza di duplicazioni. Le quattro PR #385–#388 sono ancora accatastate in bozza: programmare l'integrazione tecnica di sviluppo **separatamente** dalla firma e dalla distribuzione Android, senza riqualificare il medesimo SHA se non cambia.
