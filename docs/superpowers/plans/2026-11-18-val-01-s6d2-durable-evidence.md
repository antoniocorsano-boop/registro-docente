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
