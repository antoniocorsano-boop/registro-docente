# VAL-01/STAB-06/S-R05 — Riesame interno e condizioni per il rilascio
18 novembre 2026. Candidato esaminato: #320, 0ca78b3bcbbc5b1a5aed0857865399f829a513b9. Esito: HOLD pre-attivazione. Questo è un riesame interno delle sorgenti e delle evidenze, non una revisione indipendente né una qualificazione nativa del nuovo SHA.

## Evidenze progressive (non additive come certificazione finale)
| Revisione | Commit o evidenza | Esito verificato |
| --- | --- | --- |
| #313 STAB-05 | candidato cacd34eae92cfc46f4d4bdb7462d1eb5e4fa8e44 | 5/5 workflow, 15/15 job storici |
| #314 S-R01a | 98e897bcefe13008e7e2ca33862e8ee2aa6607ee; run 44238686978, 44238686981 | 5/5 job |
| #315 S-R02 | 629e13febc942c305873260dc5324c6542279e8b; run 44240170182, 44240170127 | 1474 sicurezza, 210 browser |
| #316 S-R03a | 98c11753ca1736310348d9ad9659d446f58682be; run 44241567459, 44241567484, 44241567438 | 6/6 job, 216 browser |
| #317 S-R03b | 758f07afdbfc9676111fed8d759f30de30f55619; run 44242505554 | 18/18 fasi Android 12/16, 42/42 preflight |
| #318 S-R04a | 0e13d7cb377508ccc742b2049a3ee9339748a8a8; run 44245871747 | 219/219 browser |
| #319 S-R01b | 80ac84f504cdacdb18ff7f61a21c163e80c4502f; run 44247292784, 44247292841 | 1478 sicurezza, 228 browser |
| #320 S-R04c | 0ca78b3bcbbc5b1a5aed0857865399f829a513b9; run 44249608647, 44249608620 | 1479/1479 sicurezza, 27/27 contratti, 234/234 browser, 72/72 preflight, 5/5 job |
Non attribuire quei risultati al candidato #320. Il confronto #320 rispetto al candidato storico è ahead 61, behind 0; include modifiche applicative e di verifica.

## Concorrenza storica: rischio residuo confermato da sorgente
Verificate le tre revisioni originali 37c61d4c64993c986a3edcd2b421310adf20de92, b726f4a6dc0eb90a066113bee7cceabf29c629a5, ddbf60781514b866b09e1fa1e014e6a6fc3989d3. Tutte usano DB1, lettura di ammissione separata da putMetadata, senza claimInitialMetadata. Il candidato usa claim atomico con add, ma questo protegge soltanto i partecipanti cooperanti. Una versione storica non cooperante non rispetta la nuova riserva; il candidato non può garantire esclusività globale pre-fence. Anche la pulizia dello staging e l'attivazione DB1 non costituiscono compare-and-swap dell'identità del proprietario nella stessa transazione: non dichiarare protezione contro sostituzione concorrente. Nessun incidente reale accertato.
Dopo fence DB2, le aperture storiche a versione 1 sono rifiutate; i test già disponibili verificano sei operazioni storiche, blocco da connessione concorrente e invalidazione del consenso dopo mutazione. La guardia in authorizedVaultMigration confronta l'inventario fisico nella transazione di upgrade. Questi fatti non provano che il rischio pre-fence sia eliminato.
Decisione di perimetro proposta: primo rilascio solo aggiornamento Android in-place con identità/firma stabile, unica installazione e nessuna esecuzione storica concorrente sullo stesso archivio. Verificare sul pacchetto finale l'assenza di istanze storiche attive dopo aggiornamento e il rifiuto downgrade post-fence. Nessuna attivazione web condivisa con client storici: non dichiarare supporto multischeda/multiversione DB1 finché non qualificato. Se l'esclusività operativa non è dimostrabile, HOLD; considerare una correzione circoscritta di proprietà dello staging e scritture DB1, non una promessa di isolamento da vecchio codice. Nessuna decisione di rilascio adottata senza revisione indipendente e approvazione.

## Altri confini
- S-R02/S-R01b: revoca non annulla necessariamente operazioni già invocate; esito ACTIVE conservato e riapertura protetta. Arresto con residui STAGING resta bloccato.
- S-R03: envelope v2, payload completo v6; v7 e formati parziali/precedenti non sono ammessi nel percorso protetto di migrazione/restore DB2. Nessuna conversione implicita. La compatibilità ordinaria DB1 non equivale a qualifica DB2.
- S-R04: complete_v1 e established_v1 sono evidenze positive locali; non provano storia in caso di perdita congiunta. La perdita prima della prima osservazione completa resta ambigua. Non riparare o sovrascrivere automaticamente, preservare file esterni e residui.
- S-R04b: ramo test/val-01-stab06-sr04b-native-fresh-recovery, head 087e80f78f86477fb84feb49e1b5ca996fb148ac; 2 commit, 2 file di collaudo, zero esecuzioni riscontrate. Il blocco del servizio sull'aggiornamento CI rimane. Issue #307 aperta; non aggirare il blocco, richiedere risoluzione nei canali autorizzati. Recupero Android da installazione pulita obbligatorio.
- src/main.tsx non abilita il candidato. Le prove native sono APK di laboratorio con firma effimera. Non equivalgono al pacchetto distribuito.

## Gate di uscita (tutti obbligatori)
1. Risoluzione autorizzata del blocco S-R04b e riconciliazione del ramo sul candidato conclusivo; non importare risultati di un SHA diverso.
2. Revisione indipendente e specifica sicurezza, con esito riferito al diff cumulativo e SHA esatto; nessuna review registrata nelle PR #314–#320 al momento della consultazione. Il presente documento non soddisfa il requisito.
3. Decisione documentata sulla concorrenza storica, con prova di esclusività Android e regressione delle condizioni di rifiuto; niente web multiversione.
4. Qualificazione cumulativa del candidato esatto: contratti, lint/typecheck/build, sicurezza, bootstrap, matrice browser 3 predecessori, mobile 320/390, Android 12/16 con migrazione e riaperture, interruzioni prima/dopo commit, revoca iniziale/legacy, esportazione reale e ripristino, perdita parziale, recupero nuovo dispositivo. Beta1 RC2 sparso: rifiuto migrazione e integrità, non migrazione positiva. Nessun risultato storico sostituisce una prova necessaria sul candidato.
5. Separata qualificazione del pacchetto destinato alla distribuzione: entrypoint effettivo, build, identità applicazione, firma, aggiornamento in-place senza perdita, assenza di strumenti di laboratorio e di pubblicazione involontaria. Copia verificata prima di aggiornare il dispositivo; nessun dato reale in CI.
6. Esito integrale PASS, rilievi bloccanti chiusi, evidenze conservate, autorizzazione esplicita prima di integrare e distribuire.
