# VAL-01/S6d.2a — Commit durevole delle evidenze, laboratorio

## Basi esatte e responsabilità
- Linea B: PR #337, `90f72bdf0dec285ad59881b0a006488662a8cd35`, 8/8 workflow; 106/106 Chromium.
- Linea A: candidato #325, `6063fc0ff2809584c266b3161dafea9ffba92a8d`, congelato. Contiene codec V7 isolato (`src/security/assessmentBackupPayload.ts`) e sessione protetta DB2; non equivale a un'autorizzazione ad attivare il dominio.
- D1b.1: `validateAssessmentArchiveV1` comune a entrambe le linee (blob identico). Il contenitore è class-level `assessmentEvidenceV1`, con documenti distinti per anno/disciplina e legami storici.

## Incremento corrente
Una revisione confermata viene derivata dal documento già esistente nell'ultimo appData committed. Il chiamante deve fornire scope indipendentemente approvati e roster atteso; nessuna creazione di documenti, migrazione o deduzione di contesto. Si invocano i comandi S6b originali, si rivalida l'intero envelope, si appende un solo record. Voti, comportamenti, classi, legami e revisioni precedenti sono preservati. Gli identificatori e le conferme non sono generati dalla funzione.

Il collaudo accoppia il modulo puro al coordinatore canonico, al vero SecureVault e a SecureAppStorage.saveAppDataAndMeta in un VaultStore esclusivamente sintetico in memoria. Il doppio record cifrato appData+meta è una sola operazione putMany. Il publish avviene dopo persist. Verifica riapertura con nuovo oggetto SecureVault e nuova autenticazione, senza affermare cold restart IndexedDB o Android. Il fallimento è iniettato prima della scrittura atomica nel deposito sintetico. Coda sigillata, retry, rifiuto duplicati, revisione stantia, roster e scope.

## Gate residui, in ordine
1. Qualificare questo incremento sullo SHA esatto.
2. S6d.2b: raccordo controllato con la linea A protetta, senza cambiare #325. Conservare l'esatto codec V7; verificare dipendenze, compatibilità, cifratura, lettura e ripristino completo. Il V6 non può essere presentato come backup delle evidenze; rifiutare export/import storico che perderebbe il dominio. Nessuna attestazione di downgrade fino a verifica.
3. S6d.2c: sessione DB2 autenticata, coda e proprietario unici, test IndexedDB reale e cold restart Android, revoca, rimozione studente/classe e ripristino con perdita; gate di sicurezza e revisione specialistica prima dell'attivazione.
4. S6d.3: collegare le viste all'owner autorizzato; successo solo dopo ricevuta durevole, errore conserva bozza, protezione identità. Qualificazione cumulativa e autorizzazione separata al rilascio.

Questa PR non attiva il dominio nell'App, non tocca backupPayload, secureAppStorage, SecureRegistroRoot, DB1/DB2 o il candidato release. Nessuna scrittura su dati reali. Non è una qualificazione del backup V7 o del supporto operativo.

## Decisione di sequenza del 18 novembre 2026
Dopo la chiusura del ciclo VAL-01 (inclusi raccordo protetto, persistenza, restituzione individuale e controlli di qualificazione), la priorità successiva è il ciclo **Documentazione didattica e professionale**. Non iniziare implementazioni parallele di documentazione prima della chiusura valutativa. Primo passo del ciclo successivo: ricognizione dei modelli effettivamente adottati dalla scuola, dei documenti fondativi TRAMA e delle funzioni già esistenti. Definire con il docente il perimetro, la provenienza delle evidenze, la distinzione tra documenti personali e ufficiali, l'approvazione e la protezione dei dati. Riutilizzare le evidenze confermate senza dedurre giudizi o compilare attestazioni non autorizzate. La presente nota registra esclusivamente la priorità; non è progettazione approvata del nuovo ciclo.

## S6d.2c.1 — Raccordo DB2, primo incremento
Base #339 qualificata (52e241fd). Riutilizzo byte-identico dal candidato #325 dei moduli Vault, confine DB2, migrazione autorizzata e autorità copia versionata V7, senza attivare Root/App. Le prove Chromium usano un'origine isolata: DB1 sintetico completo, copia V6 corrispondente, consenso di prova, migrazione DB2; solo dopo la barriera si predispone un documento sintetico, non una migrazione reale del dominio. Scrittura mediante coordinatore esistente e store a generazione vincolata; verifica delle due sole impronte cifrate cambiate, riapertura autenticata dopo chiusura pagina, catena di correzione/ritiro, abort reale IDB e nuova sessione, rifiuto del downgrade, ispezione V7 e rifiuto V6.
Il servizio DB2 del candidato è intenzionalmente V6-only e rifiuta il ripristino che perderebbe evidenze. L'autorità V7 qui verifica una copia Blob sintetica, non pubblica ricevute persistenti (SecureMeta produttivo è ancora V6-only). Non equivale a ripristino V7 autorizzato, selettore SAF reale o riavvio di processo Android. Questi sono gate residui distinti; non iniziare prove native prima del GREEN Chromium, né introdurre un nuovo percorso di restore non verificato.
