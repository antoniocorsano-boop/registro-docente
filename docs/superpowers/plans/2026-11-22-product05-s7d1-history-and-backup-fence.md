# VAL-01/PRODUCT-05/S7d1 — Archivio storico immutabile, senza attivazione della scrittura

22 novembre 2026. Dipendenza: PR #396, exact SHA `1356e30a465bc758859f9d4edbbe8dbe3f355aab`. Base cumulativa precedentemente allineata con main. L'attuale blocco di integrazione della PR storica #385 rimane documentato.

## Contratto di dominio approvabile
Un archivio S7d1 per una singola classe, anno e disciplina, con intestazione esplicita e revisioni `records` concatenate per alunno e periodo. Nessun campo di questo tipo è aggiunto a `ClassData`, `AppData` o ai documenti professionali attivi. L'archivio è **una proposta isolata**, non un record salvato.

Ogni revisione conserva l'identità del singolo alunno, le date effettive del periodo, gli identificativi delle evidenze selezionate, il testo completo redatto dal docente, la conferma S7a di sessione, l'istante di acquisizione, un numero progressivo, il riferimento alla revisione precedente, il digest della revisione precedente e il proprio digest SHA-256. Nessun voto sintetico, descrizione grezza della prova, nome alunno, riferimento interno della rubrica o giudizio generato. Il digest è una verifica di integrità locale, **non** una firma o un'autorizzazione.

Il validatore rifiuta date invalide, ambito/roster diverso da quello approvato indipendentemente, firme di JSON non attese, revisione in conflitto, valori modificati, conferma di sessione riutilizzata, record soppressi, riordinati o contenenti campi aggiunti. La verifica dello storico è indipendente dall'archivio correntemente attivo: il successivo ritiro di una fonte non può cancellare un bilancio già acquisito correttamente, ma impedisce il nuovo impiego della vecchia conferma.

## Barriera di compatibilità temporanea
`formativeBalanceHistoryV1` è una chiave riservata NON supportata dagli attuali codec di backup V6/V7/V8/V9. Il controllo di dominio già usato dai relativi percorsi di backup/ripristino deve respingerla ovunque compaia. Anche `SecureAppStorage.saveAppData` e `saveAppDataAndMeta` rifiutano la chiave, senza bloccare `documentHistoryV2` legittimo. Queste barriere impediranno che un chiamante futuro conservi il dominio senza il contratto di ripristino.

## Prove obbligatorie
Suite sintetica di integrità cronologica, concatenazione, recupero, immutabilità, rifiuto di alterazioni, destinatario errato, assenza di fonti e getter malevoli; test di sicurezza/backup/Android ereditati, TypeScript e compilazione; qualifica sullo SHA esatto.

## S7d2 — Non autorizzata da questo incremento
Richiede una versione backup più recente con validazione indipendente, importazione/ripristino conservativo di tutti i record esistenti, persistenza cifrata atomica appData+meta e verifica di rilettura in Vault, gestione conflitti e modalità di recupero; solo in seguito comando di conferma durevole nella Scheda alunno. Nessuna PR di questa serie può essere integrata in main senza review indipendente, test completi Android/DB2, tutte le qualifiche e una decisione docente esplicita.
