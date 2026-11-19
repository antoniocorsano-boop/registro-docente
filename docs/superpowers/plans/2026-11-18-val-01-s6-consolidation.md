# VAL-01 — Dossier di consolidamento S5–S6 e verifica del perimetro residuo
18 novembre 2026 · riesame interno, non revisione indipendente né autorizzazione al rilascio.

## 1. Decisione e basi
Chiudere il ciclo tecnico S5–S6 **in laboratorio** sul candidato esatto #344 `9893e440c3ab1a46892eaffcbd184e5caed2373f`. Non dichiarare conclusi S7/S8: il riesame della roadmap originaria #231 e PED-07 (commento 6979851011) li distingue dalla rilevazione e dalla consultazione individuale S6. Non confondere la restituzione consultabile delle singole evidenze con il bilancio formativo del periodo approvato o con la certificazione ufficiale. La linea A #325 `6063fc0ff2809584c266b3161dafea9ffba92a8d` rimane congelata, non distribuibile; #104 e #326 restano autoritativi. Le modifiche sperimentali di storage/restore della linea B non attivano Vault o recupero S-R04b sul candidato A. Nessun dato reale, merge, deploy, firma, installazione, costo o deroga.
Questo dossier è conservato su un ramo documentale derivato dal candidato #344, non cambia il suo SHA qualificato e non attribuisce la qualifica a un nuovo commit. Nessuna nuova esecuzione di CI richiesta per il solo documento.

## 2. Evidenze esatte di qualificazione finale
| Controllo | Esito sullo SHA #344 | Evidenza |
|---|---|---|
| Flussi complessivi | 10/10 success | elenco Actions sul commit esatto |
| Registro invarianti | 112, 13 radici sorvegliate | run 44375988786; BETA2 Reference job 135055180437 |
| Conservazione rispetto a main `5ed2eb11d1b740dc79acbee1ffe18da3f3d2a7e8` | 93/93 oggetti invarianti identici | confronto JSON per ID e contenuto |
| Conservazione rispetto a #334 `86d0555788e928bf4ccb05c3e6ababa1cf804e78` | 100/100 oggetti invarianti identici | confronto JSON per ID e contenuto |
| Contratti di riferimento | 27/27 | job 135055180437 |
| Sicurezza e memoria | 1531/1531, zero fail | job 135055180437 |
| Regressioni Chromium | 126/126 | job 135055179479 |
| Nuova UI operativa | 7/7 casi inclusi nei 126 | job 135055179479 |
| Persistenza e ripristino nativi | 12/12 stadi API32, 12/12 API36 | run 44375988941, job 135055300566 e 135055300593 |
| Packaging Android | success | run 44375989117 |
| Compatibilità archivio Beta1 | success | run 44375989398 |
| Regressione generale | success | run 44375988949 |

Accessi alle evidenze:
- https://github.com/antoniocorsano-boop/registro-docente/actions/runs/44375989051 (contratti, sicurezza e Chromium)
- https://github.com/antoniocorsano-boop/registro-docente/actions/runs/44375988941 (native DB2/SAF)
- https://github.com/antoniocorsano-boop/registro-docente/actions/runs/44375988949 (browser generale)
- https://github.com/antoniocorsano-boop/registro-docente/pull/344/checks

I conteggi non sono sommati tra commit; i sette nuovi casi UI sono inclusi nei 126. I 24 stadi nativi usano emulatori e pacchetto debug sintetico, non la UI finale e non il dispositivo personale. La qualifica comprende salvataggio atomico, abort, cold restart, selezione file reale SAF, restore V7 e conservazione storico. Non sostituisce HPR, revisione specialistica, verifica normativa o istituzionale.

## 3. Catena delle decisioni e degli incrementi
| Fase | PR / head esatto | Decisione e risultato |
|---|---|---|
| S5a | #328 `5695c276b5effa221506152950e88b11d0bb92c5` | Catalogo locale di criteri e rubriche attivi; nessuna selezione automatica. |
| S5b | #329 `6ffc47749242ad1711ee87805ba81124669a0677` | Preparazione e conferma esplicita della prova pianificata. |
| S5c | #330 `8da64263b49a840cb409762ff37c758824a0987e` | UI sintetica per attività e simulazioni di esame, non esiti ufficiali. |
| S6a | #331 `a91ab896d465646f4c021e44b891f57ee343b6f6` | Conferma distinta dello svolgimento effettivo. |
| S6b.1 | #332 `40a6d324014055a21403be63c85555d6de804f6d` | Fatto individuale, interpretazione separata, scelta esplicita. |
| S6b.2 | #333 `1ef60e967c3b7fc70cda07857f7f0e4ad85bb9ad` | Correzione e ritiro motivato append-only. |
| S6-C | #334 `86d0555788e928bf4ccb05c3e6ababa1cf804e78` | Convergenza controllata e collaudo cumulativo; 100 invarianti. |
| S6c | #335 `2396cf7327fcd204b286809e13337664948eec1f` | Primo Tabellone sintetico; collaudo browser non qualificato in questa revisione. |
| S6c.2 | #336 `2233dbccc3902cc69aedd6301383393e46f94aac` | Raccordo rubrica storica, accessibilità e riqualificazione. |
| S6d.1 | #337 `90f72bdf0dec285ad59881b0a006488662a8cd35` | Tabellone Oggi/Storico/Evidenze e scheda individuale sintetica; ritorno e guardia bozza. |
| S6d.2a | #338 `8b6b37577a816c8b052a65b709d39a9e04f20880` | Derivazione esplicita e commit cifrato canonico su deposito sintetico. |
| S6d.2b | #339 `52e241fd6ee51f6c780a8b335a226b7f670713b3` | Codec V7 esatto della linea A, roundtrip e rifiuto V6 incompatibile. |
| S6d.2c.1 | #340 `f538d54f6a073280d41cf8bfbccdcfe22f8bb562` | DB2 reale IndexedDB, abort, riapertura, copie verificate. |
| S6d.2c.2 | #341 `6ef2ba95650777b92b70901f9d086e30f5acc1bc` | Android 12/16, process stop verificato, riapertura, storico. |
| S6d.2c.3 | #342 `215f1534ed3abc48e5f1b729af4b9ed375592fbc` | Restore V7 con copia corrente esatta, consenso monouso, rifiuto perdita storico. |
| S6d.2c.4 | #343 `34c6edc655c885eb669ba8c719777c2e44173111` | Selettore Android reale, due copie verificate, annullamento, ripristino e cold restart. |
| S6d.3 | #344 `9893e440c3ab1a46892eaffcbd184e5caed2373f` | Ricevuta dopo commit, errore conserva bozza in sessione, consultazione individuale, qualifica cumulativa. |

Le PR della linea B sono in bozza; il PASS conclusivo non si trasferisce al candidato A. Il piano di dettaglio 2026-11-18-val-01-s6d2-durable-evidence.md conserva i passaggi tecnici. Le decisioni PED-01–07 sono conservate nella issue #231, in particolare PED-07.

## 4. Matrice di continuità pedagogica
- Voto rapido indipendente; nessun criterio/rubrica obbligatorio per ogni voto. Evidenze volontarie, anche senza voto. Rilevazione sintetica e prova completata con riferimenti congelati.
- Ogni evidenza distingue fatto osservato, metodo, interpretazione esplicita, non osservato, non pertinente, non registrato e ritiro. Non attribuire insufficienza, livello o competenza per assenza di dati; nessuna media di livelli.
- Correzioni e ritiri append-only; revisione delle fonti non riscrive il fatto. Riferimenti, livelli e criteri mantengono la propria versione storica.
- Progresso è dimostrabile soltanto da osservazioni comparabili effettive. Una nuova evidenza dopo una mancata rilevazione non dimostra un progresso; nessun automatismo di giudizio.
- Il Tabellone resta ingresso operativo, scheda studente e Consigli sono ambienti esistenti. La UI di laboratorio consulta il singolo studente, maschera nominativi, non invia né certifica; la persistenza delle evidenze è atomica appData+meta.
- Nessuna IA individuale nemmeno con conferma successiva; testi professionali del docente e composizione deterministica da fonti selezionate. Nessuna esportazione nominativa automatica o trasferimento esterno.
- Esami: simulazione didattica distinta da esito ufficiale, proposta del docente distinta da decisione collegiale. Nessuna equivalenza inventata, certificazione o ammissione automatica.
- Fonte curricolare Arena, progettazione Docente OS, Atlas consultazione, Registro rilevazione locale. I riferimenti sintetici non costituiscono repertorio d'istituto verificato o integrazione curricolare qualificata.

## 5. Riesame dei residui: non confondere il nucleo S6 con VAL-01 completo
| Residuo | Evidenza o riscontro | Decisione |
|---|---|---|
| S7 bilancio formativo | #231 roadmap e PED-07; S6d.3 proietta fatti attivi, non bilancio di periodo confermato | Incremento mancante. Riusare Dossier/Restituzione esistenti, selezione di periodo e fonti, confronto solo comparabile, testo scritto dal docente, invalidazione alla modifica di fonti/destinatario, anteprima singola. |
| S8 scrutinio/certificazione | #231, #170; CouncilView esistente (blob `3685b821e331bfd10fd1e1b8c45c1d57e6dc178c`) non dimostra nuovo raccordo S6 | Incremento mancante. Contributo documentale disciplinare e proposta distinta, senza deliberazione o certificazione ufficiale. Repertori/criteri e norme vigenti da verificare prima di equivalenze ufficiali. |
| Indicatori legacy | StudentReportView blob `f7ccfc3536403bbeff5981bf28caa0af7615a2ce`: calcStudentCompetencyProfile, radar e aggregati numerici storici | Non riusare automaticamente come livello documentato nel bilancio o nella certificazione. Riconciliare le etichette nella futura UI; nessuna riscrittura retroattiva. |
| Preparazione e completamento | S5/S6a restano comandi/fixture, il deposito #340 predispone un documento sintetico dopo la migrazione | Non attestare flusso operativo completo di preparazione persistita in App. |
| Ricevuta copia V7 | SecureMeta e backupCheckpoint storici ancora payloadVersion 6; autorità V7 isolata qualificata | Non attestare checkpoint V7 produttivo persistente. |
| Conservazione roster | adapter rifiuta scope/roster stantio; non dimostra flusso operativo completo di rimozione classe/alunno | Policy e prove specifiche prima della futura attivazione. |
| Android UI e HPR | #344 browser UI qualificata; nativo qualifica deposito e restore, non la UI operativa | Collaudo operativo su Android e dispositivo di prova prima del rilascio. |
| R1/R2/R3 della linea A | #326 ancora vigente | Revisore specialistico indipendente, S-R04b e pacchetto definitivo restano in HOLD; nessuna sostituzione mediante i PASS di laboratorio. |

## 6. Sequenza proposta per completare senza deriva di perimetro
1. **S7a:** contratto puro del bilancio individuale del periodo, riusando il grafo delle evidenze validato e senza inferire competenze. Fonti selezionate, revisioni e limite di comparabilità; casi sintetici, nessuna rete o IA.
2. **S7b:** innesto dimostrativo nella scheda Dossier/Restituzione, contributo testuale esplicito, anteprima con singolo destinatario, conferma revocabile al mutare delle fonti. Non duplicare il generatore PDF; qualifica HPR del PDF #230 resta distinta.
3. **S8:** raccordo documentale minimo a Consigli, separazione proposta docente/decisione collegiale. Le funzioni ufficiali rimangono condizionate a repertori, norme e autorità; nessun automatismo. Riesame circoscritto, senza costruire un secondo sistema di scrutinio.
4. **Chiusura funzionale della linea B:** consolidare S7/S8 o registrare una decisione esplicita di differimento delle parti condizionate, distinguendo qualificato, progettato, non attivato. DOC-01 (#171) segue questo checkpoint: non anticipare nuova implementazione parallela. D0 acquisirà e verificherà i quattro modelli originari, l'intestazione d'istituto e le fonti TRAMA; utilizzare solo documenti privi di dati personali.
Le fasi di rilascio della linea A restano separate; questi residui non costituiscono nuovi gate di #325. Nessun nuovo ciclo di ideazione generale: gli incrementi S7/S8 derivano dalla roadmap approvata, non sono ampliamenti.
