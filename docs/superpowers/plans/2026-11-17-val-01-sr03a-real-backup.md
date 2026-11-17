# S-R03a — Contratto di interoperabilità e copia realmente esportata
Base #308, 6d44fa959244b7a44b0031eba269fc876e71e577. Candidato non attivo in produzione. Riesame statico e prove predisposte, non ancora eseguite.

## Riscontri
PrivacyView.tsx usa createBackupPayload(checkpoint.snapshot) e encryptDataWithPassword; backupPayload.ts emette v6 completo (dieci dataset), cryptoUtils.ts emette envelope cifrato v2. Android conferma solo dopo rilettura nativa; web richiede la selezione del file scaricato e il confronto byte/digest. Il checkpoint viene registrato tramite la coda e autorizzazione monouso in App.tsx/backupCheckpoint.ts. Migrazione DB1→DB2 verifica corrispondenza completa; ripristino DB2 richiede v6 completo, envelope v2, confronto atomico e nuovo accesso. Nessuna evidenza statica di incompatibilità del formato ordinariamente esportato; resta da provare il file reale.

## Matrice
| Formato dati | Esportazione corrente | Migrazione protetta DB1 | Ripristino protetto DB2 |
| --- | --- | --- | --- |
| v6 completo, envelope v2 | Sì | Ammesso con corrispondenza esatta | Ammesso con verifiche e consenso |
| v2–v5 storico | No | No | No, percorso da qualificare |
| Legacy / envelope storico | No | No | No, percorso da qualificare |
| v7 valutativo | No nell'interfaccia attuale | No | No, richiede contratto dominio e revisione |
| Incompleto o ignoto | No | Rifiutato | Rifiutato |

Il ripristino ordinario DB1 dispone di normalizzatori storici; non si deduce da ciò la compatibilità del nuovo ripristino DB2. La compatibilità dei vecchi file deve essere trattata prima dell'attivazione, preservando originali, provenienza, dati mancanti e consenso. Nessuna conversione implicita, nessun abbassamento della versione fisica DB2, nessuna rimozione del controllo v7. La scelta di mantenere il supporto storico è una proposta da qualificare; non attribuire supporto DB2 a formati non ammessi.

## Prove aggiunte (browser reali)
1. Archivio storico sintetico DB1, vera UI Privacy, download effettivo su file, verifica del file rileggendolo; envelope v2/payload v6, tutti i dieci dataset e digest della ricevuta; migrazione mediante lo stesso file effettivamente esportato, consenso e nuova autenticazione, confronto di snapshot e impronte fisiche prima/dopo.
2. DB2 sintetico, esportazione e verifica reale, ripristino dello stesso file dalla UI, consenso e nuova autenticazione; riapertura a freddo con snapshot uguale al file (senza ricevuta locale non trasferibile), DB2 mantenuto e nuova immagine cifrata.
Non sostituire le copie scaricate con Blob costruiti in fixture. Se un confronto fallisce, registrare la difformità invece di attenuare i criteri.

## Osservazioni residue
Il timestamp del payload è prodotto dopo il checkpoint; la verifica della ricevuta è importante perché rende confrontabile meta del file con la meta locale senza ricevuta. Non si dichiara compatibilità per copie scaricate ma non verificate o dopo registrazioni successive. Non si cambia il protocollo temporale senza evidenza di un difetto. Verificare separatamente il percorso SAF reale Android: esportazione nativa, rilettura, selezione e ripristino. La matrice delle interruzioni STAB-05, le regressioni, S-R01a e la revisione indipendente rimangono aperte.

UI candidata: chiarisce i formati ammessi e la conservazione delle copie precedenti. Nessuna modifica ai formati, alla crittografia, ai guardiani del ripristino o ai workflow. Nessun collaudo eseguito, integrazione, rilascio o attivazione.