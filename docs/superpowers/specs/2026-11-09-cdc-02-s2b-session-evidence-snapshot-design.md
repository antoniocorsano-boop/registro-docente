# CDC-02/S2b — Fotografia confermata delle evidenze per seduta

- Data: 2026-11-09
- Stato: **PROPOSTA DI CONTRATTO / DESIGN REVIEW PENDING**, solo documentazione; nessuna implementazione o HPR attestata
- Base verificata: Registro Docente main @ 994725b39385e79510e6eaccc44607dcf4f07b0f
- Dipendenze integrate: CDC-02/S1 (PR #176), CDC-02/S2a (PR #178)
- Autorità: quadro e registrazioni **personali del docente**, non verbale, delibera, voto collegiale o ricostruzione attendibile dello stato del registro nel passato
- Roadmap: issue #170 e UX-GOV-01 #104

## 1. Problema, valore e limiti

S1 memorizza identità, anno, tipo e data di ciascuna seduta; S2a calcola in sola lettura sei indicatori **correnti** da ClassData.students, grades e councilAssessments. Attualmente, se le valutazioni cambiano, il quadro ricalcolato cambia anche visualizzando una seduta precedente. S2b deve consentire al docente di **confermare e conservare la lettura di quel momento**, in modo da poterla confrontare con il quadro corrente senza riscrivere la registrazione originaria.

La fotografia **non** nasce da una semplice apertura/riapertura della seduta, non copia i testi delle verifiche, non genera proposte e non attribuisce un giudizio agli alunni. Non include nella prima versione nominativi, singoli voti, note individuali o documentazione ufficiale. Le letture individuali e i confronti tra popolazioni confrontabili sono un'eventuale estensione successiva con decisione privacy separata.

Distinguere espressamente tre date:
- **data della seduta**: data indicata dal docente nella registrazione S1;
- **data limite delle prove**: quali date dei record Grade il calcolo S2a considera;
- **data/ora dell'acquisizione**: quando il docente ha realmente confermato la fotografia nel dispositivo.

Una fotografia creata oggi per una seduta passata documenta **un'acquisizione odierna di dati attualmente disponibili e filtrati per data**, non prova che tutti quei record esistessero già nel giorno storico della seduta. Il modello Grade non registra la cronologia delle modifiche necessaria a ricostruirlo.

## 2. Contratto canonico v1 (proposta)

Aggiungere a ClassData un campo facoltativo councilEvidenceSnapshots?: CouncilEvidenceSnapshotV1[]. La sua assenza nei dati e backup storici equivale ad archivio vuoto. Non introdurre una nuova chiave Vault separata o modificare il formato delle valutazioni esistenti.

Ogni record conserva esattamente:

| Campo | Significato e invarianti |
|---|---|
| schemaVersion: 1 | Discriminante di formato, con validazione rigorosa e migrazione soltanto esplicita |
| id | Identificatore stabile e univoco della fotografia, validato nel perimetro della classe |
| classId, schoolYear | Classe di appartenenza e anno canonico: devono corrispondere al contenitore e alla seduta |
| sessionId, sessionDate, sessionKind | Legame a una seduta S1 realmente presente nella stessa classe/anno; copia dei valori della seduta al salvataggio per rilevare correzioni future |
| revision, supersedesSnapshotId? | Numerazione 1, 2, … per singola seduta; versioni precedenti immutabili; revisione successiva richiesta esplicitamente |
| capturedAt, confirmedByTeacher: true | Istante ISO 8601 UTC normalizzato (`YYYY-MM-DDTHH:mm:ss.sssZ`) del comando confermato, ricavato dall'orologio del dispositivo; attestazione di conferma, **non** firma, timestamp certificato o identità personale |
| captureLocalDate, captureUtcOffsetMinutes | Data civile di acquisizione `YYYY-MM-DD` e offset rispetto a UTC, in minuti, secondo `Date.getTimezoneOffset()` al **medesimo istante** `capturedAt`; entrambi persistiti e coperti dal digest per validazione deterministica tra fusi orari |
| requestedCutoff, effectiveCutoff, cutoffClampedToSchoolYear | Limite selezionato e limite effettivo del calcolo; date ISO valide, con vincoli temporali spiegati sotto |
| calculationContract: 'council-evidence-overview-v1' | Versione esatta della semantica dei conteggi S2a, indipendente dal codice futuro |
| aggregates | Copia **dei sei interi** di CouncilEvidenceOverviewV1: totalStudents, withNumericEvidence, withoutNumericEvidence, numericEvidenceCount, withSavedTeacherProposal, withoutSavedTeacherProposal |
| rosterFingerprint, sourceFingerprint | Impronte SHA-256 su rappresentazioni canoniche determinate e versionate degli ID del gruppo e dei record sorgente rilevanti |
| contentDigest | SHA-256 su serializzazione canonica della fotografia escluso il campo contentDigest; controllo locale di integrità, **non firma digitale né garanzia di autenticità esterna** |

Non conservare un duplicato dei nominativi, dei singoli record Grade o dei valori CouncilAssessment in v1. I fingerprint sono comunque **derivati potenzialmente personali**: rimangono esclusivamente nell'archivio cifrato e nei backup cifrati, mai in telemetria, log, URL, Copilota remoto o repository. Non considerarli dati anonimizzati.

Gli aggregati devono soddisfare sempre:
- totalStudents, numericEvidenceCount e tutte le altre quantità sono interi non negativi;
- withNumericEvidence + withoutNumericEvidence = totalStudents;
- withSavedTeacherProposal + withoutSavedTeacherProposal = totalStudents;
- numericEvidenceCount >= withNumericEvidence e, se totalStudents = 0, tutti i contatori = 0.

L'algoritmo esatto di serializzazione per digest/fingerprint va fissato con vettori di prova statici **prima** di introdurre persistenza: ordine chiavi e ordinamento degli ID stabili, Unicode normalizzato, gestione dei numeri e separatori, codifica UTF-8. Non affidarsi all'ordine arbitrario degli oggetti JSON. La modifica dell'algoritmo richiede un nuovo identificatore di contratto, non un ricalcolo retroattivo dei record v1.

## 3. Contesto, semantica temporale e provenienza

- La classe, l'anno e la seduta devono essere **selezionati esplicitamente**; non dedurli dalla schermata visitata in precedenza. La seduta deve già essere confermata nel Vault.
- La data limite deve essere una vera data calendario e appartenere all'anno scolastico. In v1 non può superare né la **data della seduta** né `captureLocalDate` (la data locale di acquisizione **salvata nel record**). Proporre inizialmente il minore dei due limiti; il docente può anticiparlo. **Non** ricalcolare il giorno locale durante la lettura/ripristino nel nuovo fuso del dispositivo.
- Rilevare istante UTC, offset e data locale **da un unico oggetto Date acquisito al commit**: `capturedAt = instant.toISOString()`, `captureUtcOffsetMinutes = instant.getTimezoneOffset()`, `captureLocalDate = formatLocalCalendarDate(instant)` con parti locali numeriche e padding, senza parsing ambiguo di stringhe. L'offset segue la convenzione JavaScript `UTC − ora locale`, quindi a Roma in ora solare è `-60`. Nessuna dipendenza da `Intl` o dalle impostazioni linguistiche al ripristino.
- Validazione fail-closed: `capturedAt` è UTC ISO canonico, `captureUtcOffsetMinutes` è un intero nel range `[-840, +840]`, `captureLocalDate` è una data calendario valida e deve coincidere con `new Date(Date.parse(capturedAt) - captureUtcOffsetMinutes * 60_000).toISOString().slice(0, 10)`. Rifiutare valori mancanti, non interi, incoerenti, cutoff successivi alla data locale acquisita e digest non corrispondenti. L'offset fotografa il **solo istante di acquisizione**, non una zona IANA permanente né la sua storia legale.
- Esempio vincolante: `capturedAt=2026-11-09T23:30:00.000Z`, `captureUtcOffsetMinutes=-60`, `captureLocalDate=2026-11-10`: il cutoff `2026-11-10` è consentito se appartiene all'anno scolastico e non supera `sessionDate`. Ripristinato su un dispositivo a New York, il medesimo record deve restare valido **senza ricalcolare `captureLocalDate`** dalla zona corrente. Un record con gli stessi `capturedAt` e offset ma `captureLocalDate=2026-11-09` è invalido.
- Vicino al cambio del giorno o a un cambio di fuso/orario estivo fra anteprima e commit, **ricontrollare il contesto temporale**: la preview deve essere rinnovata se cutoff, giorno locale, offset o limite temporale cambiano. Non salvare una fotografia oltre il limite solo perché l'anteprima era stata preparata prima di mezzanotte.
- Non retrodatare capturedAt né dedurre la data da sessionDate. Per una seduta passata mostrare sempre l'avviso: «Fotografia acquisita il [captureLocalDate] su prove registrate con data fino al [limite]; non certifica quando i dati furono inseriti». L'ora proviene dall'orologio del dispositivo, non da una fonte temporale certificata.
- **Non** ricalcolare as-of-time i voti di ingresso: S2a legge CouncilAssessment salvati nell'anno/momento selezionato, non uno storico delle modifiche. Il riepilogo indica i voti **presenti e salvati al momento della cattura**, anche quando aggiornati successivamente alla data della seduta.
- In v1 mantenere moment='ingresso' esplicito, perché S2a implementa e presenta soltanto quel momento. Non convertire il tipo seduta monitoraggio/finale in un momento di valutazione ancora non implementato.
- I record fonte non numerici, fuori data, fuori anno e le bozze seguono **esattamente la semantica S2a**; la fotografia congela il risultato, non introduce una seconda formula. Se la semantica S2a cambia, occorre un nuovo calculationContract.
- I fingerprint rilevano variazioni nei dati sorgente e nella popolazione; non ricostruiscono record cancellati, non attestano che un voto fosse disponibile storicamente e non autorizzano confronti individuali.

## 4. Interazione e scrittura governata

Percorso: **Consigli di classe → classe → anno → seduta archivio S1 → Prepara fotografia → Esamina → Conferma e salva fotografia**.

1. Il pannello «Prepara fotografia» apre una **anteprima in sola lettura** dei sei indicatori, con seduta, anno, cutoff, momento, ora di cattura prevista, avviso di storicità e distinzione dai voti ufficiali. La sola apertura non muta dati e non crea alcuna seduta.
2. Se esistono voti di ingresso non salvati o un salvataggio è in corso, l'azione viene bloccata e richiede prima salvataggio/annullamento. Non includere bozze nella fotografia, non salvarle automaticamente.
3. Prima della conferma calcolare un fingerprint di revisione del contesto sorgente e dell'anteprima. Alla scrittura, nel coordinatore seriale, rileggere **appDataRef.current e settingsRef.current correnti**, verificare identità classe/anno/seduta, cutoff e ultima revisione, e confrontare la fonte con quella esaminata.
4. Se nel frattempo sono cambiati studenti, prove, voti salvati, seduta, impostazioni pertinenti o versione precedente: **abortire senza scrivere**, mostrare «I dati sono cambiati; riesamina la fotografia», ricostruire la preview e richiedere una nuova conferma.
5. Su conferma stabile: generare id, un unico campione temporale per capturedAt/captureLocalDate/captureUtcOffsetMinutes, aggregati e digest; aggiungere un nuovo record (append-only) ad appData e incrementare i metadati di backup **nella stessa transazione logica persistente** con SecureAppStorage.saveAppDataAndMeta attraverso il coordinatore delle mutazioni. Pubblicare lo stato React e la conferma **solo dopo** il successo del Vault. Doppio clic e retry non devono creare duplicati.
6. Una seduta può possedere più revisioni **soltanto** con il comando «Acquisisci nuova versione». Ogni revisione rimanda alla precedente; mai sovrascrittura silenziosa. La vista mostra entrambe e distingue la più recente senza nascondere la cronologia.
7. Alla riapertura mostrare in colonne/pannelli distinti «Fotografia del [capturedAt]» e «Quadro corrente»; differenze numeriche spiegate senza giudizi automatici. Se i record fonte non sono più presenti, la fotografia resta leggibile e mostra lo stato di origine non verificabile: non cambiare il contenuto congelato.

## 5. Persistenza, ripristino, cancellazione e privacy

- Persistenza: campo opzionale ClassData nel valore appData esistente del Vault; l'archivio cifrato è l'unica autorità, non localStorage in chiaro e non un servizio remoto.
- Backup: createBackupPayload attuale è v6 e include appData; **nessun bump di versione previsto in prima ipotesi**, ma la compatibilità deve essere dimostrata su import/export V2–V6 e legacy. La scelta v6-invariata è condizionata a test: se un client/normalizzatore scarta o altera il campo, fermarsi e rivalutare versione/strategia.
- Estendere isCouncilAppDataValid: tipo e soli campi previsti, numero revisione e catena, unicità ID, sessionId esistente nello stesso contenitore, anno/date coerenti, aggregati complementari, formato degli hash, digest del record; rifiutare duplicati, dati incoerenti, record spostati tra classi, schemi futuri ignoti e snapshot orfani durante import/restore.
- Estendere wouldLoseCouncilEntries in modo che una fotografia salvata mancante, alterata o appartenente a classe cancellata nel candidato di ripristino attivi l'avviso esplicito di perdita, **anche se voti e sedute sono ancora presenti**. La scelta di procedere può sostituire il dataset come un normale ripristino autorizzato, ma non deve avvenire in silenzio.
- I backup vecchi senza il campo devono restare validi e importabili. Proteggere le copie già esistenti con il controllo di perdita; non fabbricare fotografie retroattive.
- Eliminazione di classe e ripristino sostitutivo devono considerare anche le fotografie collegate. La policy di eliminazione per obblighi di privacy rimane esplicita e governata: «immutabile» significa non modificabile automaticamente durante il normale uso, **non** impossibile da cancellare su decisione legittima.
- Nessun invio di nomi, voti, digest o altri metadati ai modelli IA e nessuna esposizione nelle proiezioni studente. La schermata rispetta Privacy Shield e gli stessi confini del Registro.

## 6. Scelte deliberate e decisioni rinviate

**Scelta v1 proposta:** aggregati della classe congelati, un record distinto per versione e seduta, impronte di provenienza interne e scrittura solo dopo conferma. Questa è la **fase minima per la continuità storica di S2a**.

Rinviati a un gate privacy/prodotto separato:
- fotografie per singolo alunno, nominativi, voti nominativi e copie dei record di prova;
- confronti S2c «medesimi alunni nel tempo»: il solo fingerprint segnala cambiamento della popolazione, **non** permette accoppiamento individuale. In caso di popolazioni diverse la vista S2c v1 potrà confrontare soltanto totali dichiarati «popolazione diversa / non comparabile individualmente»;
- verbalizzazione, delibere, esiti ufficiali, orientamento terze, esportazioni esterne, Copilota e generazione automatica di documenti;
- correzioni UX-P3 già tracciate sulle date e sul testo della didascalia S2a, da mantenere separate dall'immutabilità e dallo schema S2b.

## 7. Criteri di accettazione e rischi da qualificare

Criteri vincolanti prima di qualsiasi integrazione S2b:
1. **RED→GREEN causale** sulla creazione soltanto confermata; «apri», «seleziona» e «annulla» non scrivono nel Vault e non aumentano le revisioni.
2. Snapshot V1 dei sei indicatori identico al calcolo S2a per la medesima fonte e data; persiste dopo ricaricamento; i record originari successivi possono cambiare senza alterare la fotografia.
3. Una seduta può avere versioni 1 e 2 concatenate e leggibili; duplicazioni/conflitti sono rifiutati, non risolti mediante sovrascrittura.
4. Un voto in bozza, un cutoff non valido o incompatibile con la seduta, una data locale mancante/incoerente con l'istante UTC e l'offset, un cambio classe/anno, una modifica concorrente dei dati, un digest invalido o una sessione inesistente **non producono salvataggio**. Nel restore l'esito è indipendente dal fuso orario corrente.
5. Vault fallisce → nessun aggiornamento ottimistico React, nessun finto messaggio di conferma; retry idempotente.
6. Export/import backup cifrato conserva fotografie bit-a-bit nei formati supportati; backup legacy ammessi; import che cancellerebbe fotografie richiede consenso e può essere annullato.
7. Due sedute dello stesso tipo e giorno mantengono fotografie rigorosamente distinte per ID di seduta.
8. I nomi e i voti individuali non entrano nella fotografia; schermate sintetiche e log non trasmettono dati personali.
9. Suite: unità pure + qualità dati + integrità backup + concorrenza mutazioni + Chromium mobile 360/390 px, regressioni CDC-01/S1/S2a, 5 gate exact SHA, revisione indipendente e HPR specifica prima di autorizzare merge.

**Rischio principale da validare prima dello sviluppo:** l'attuale struttura non conserva una cronologia delle modifiche dei record Grade e dei CouncilAssessment; S2b non deve presentarsi come «registro com'era alla data della seduta». Il nome prodotto raccomandato è «Fotografia acquisita per la seduta», con data di acquisizione visibile.

## 8. Condizioni di avanzamento

La presente specifica è una **proposta**, non una decisione implementativa già promossa. La revisione deve ratificare il contratto minimo, il perimetro aggregato e le tre date. Il piano di realizzazione distinto è in docs/superpowers/plans/2026-11-09-cdc-02-s2b-session-evidence-snapshot-implementation.md.

Non intervenire automaticamente su main, schema, Vault, backup, UI o distribuzione come conseguenza della sola approvazione documentale. Il rilascio richiederà un candidato qualificato, HPR e autorizzazione di fusione separata.
