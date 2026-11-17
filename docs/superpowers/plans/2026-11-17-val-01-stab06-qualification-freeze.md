# STAB-06 — Consolidamento e qualificazione finale
17 novembre 2026. Stato: FREEZE DOCUMENTALE / QUALIFICAZIONE BLOCCATA.
Candidato immutabile: b5125db35762aa5aa9b288cd4c96a0cc82ca8178 (PR #310).
Questa registrazione non è una nuova versione applicativa e non attesta un PASS di rilascio.

## 1. Perimetro congelato
| PR | SHA esatto | Stato al controllo |
| --- | --- | --- |
| #306 | e444abf5d69af1c217d0d06f35a8521bebf04c7f | Collaudo mirato PASS, non integrata |
| #308 | 6d44fa959244b7a44b0031eba269fc876e71e577 | Bozza, prove incomplete |
| #309 | 4e44fb46e8c996caa488f8548b06412961903bc9 | Bozza, prove non eseguite |
| #310 | b5125db35762aa5aa9b288cd4c96a0cc82ca8178 | Bozza, prove non eseguite |

Tutte aperte, integrabili senza conflitti al controllo, nessuna integrata. Da #306 a #310: 15 commit, 14 file, nessuna modifica ai workflow o a main.tsx. Confronto GitHub verificato. Il codice applicativo non è più identico a #306: non trasferire automaticamente il PASS nativo al nuovo SHA. Nessuna ulteriore funzione o nuova PR applicativa durante il freeze; correzioni solo a seguito di rilievi confermati, con nuova identificazione del candidato e analisi di impatto.

## 2. Evidenze acquisite e loro limiti
- STAB-05/E: run 44106220257 (30 deterministiche e 8 browser mirate, #303), 44124347463 (driver e due smoke su APK storico, #305), 44126527776 (21/21 driver, 10/10 fasi API36 precommit, #306). Queste evidenze restano storiche rispetto al tip #310.
- #302: 174/174 compatibilità browser e 1451/1451 sicurezza/memoria su predecessore; esiti nativi contrastanti conservati nel dossier. Non dichiarare regressione attuale conclusa.
- #308 commento 6956117962: precedente verifica locale riportata su quattro file con impronte Git corrispondenti, compilazione circoscritta e 2/2 prove equivalenti in memoria con Web Crypto. Non è esecuzione della suite Bun originale, né prova della transazione IndexedDB reale.
- Controllo attuale GitHub: nessun run pull_request né stato combinato per #310; nessuna nuova qualificazione attestata. #307 aperta.

## 3. Sequenza obbligatoria di qualificazione
| Gate | Criteri minimi | Stato |
| --- | --- | --- |
| G0 — Autorità di esecuzione | Ripristino autorizzato dell'ambiente; conferma delle configurazioni e disponibilità delle risorse | BLOCCATO |
| G1 — Deterministiche | 2 casi originali S-R01a + 7 S-R03b; suite originale, typecheck completo, contratti di sicurezza | 2 riscontri locali equivalenti, 9 casi originali aperti |
| G2 — Browser | 2 casi concorrenza/residui S-R01a + 2 file realmente esportati S-R03a; regressione completa sui tre predecessori | 4 nuovi casi aperti, regressioni aperte |
| G3 — Android | 4 scenari prima/dopo commit API32/36 sul candidato esatto, con reale arresto e riapertura; ciclo nativo copia locale e recupero | 4 scenari attuali aperti; 1 PASS storico #306 |
| G4 — Sicurezza | Riesame specifico, revisione indipendente, verifica dei confini autorizzativi, conservazione e rischi residui | APERTO |
| G5 — Decisione | Evidenze legate al candidato, tutti i gate soddisfatti, nessuna regressione non risolta; autorizzazione esplicita all'integrazione/rilascio | NON AMMESSO |

Le 13 nuove prove originali sono 9 deterministiche + 4 browser. I collaudi nativi e le regressioni si aggiungono, non sono inclusi nelle 13. Usare esclusivamente dati sintetici. Registrare versione ambiente, SHA, identificativo prova, risultato, evidenza, eventuale causa accertata. Un nuovo candidato richiede rivalutazione delle evidenze interessate.

## 4. Rilievi pre-attivazione
S-R01: riserva esclusiva implementata nel candidato, ma concorrenza e dati residui non provati con IndexedDB reale; limiti rispetto a client storici e reset esterni.
S-R02: revoca durante migrazione legacy già ammessa, ancora da qualificare.
S-R03: copia v6 reale da verificare, anteprima v2–v5 isolata e non attiva; ripristino dei formati storici non implementato. Legacy senza versione e v7 esclusi. Definire e approvare il perimetro effettivo del recupero prima dell'attivazione; nessuna perdita silenziosa di compatibilità.
S-R04: perdita completa dello storage non garantita dal marker locale; requisito di recupero e backup verificato.
S-R05: regressioni e revisione indipendente assenti.

## 5. Blocco operativo e ripresa
Il rifiuto originario di aggiornare configurazioni CI proviene dai controlli del servizio OpenAI; ragione specifica non comunicata. Non è accertato un problema di permessi o quote GitHub. Il tentativo locale Chromium ha inoltre riportato ERR_BLOCKED_BY_ADMINISTRATOR. Non ripetere né trasferire le operazioni rifiutate per aggirare i controlli. La ripresa richiede verifica tramite canali autorizzati del servizio. TRAMA Compute Factory è un'iniziativa architetturale distinta, non un ambiente già qualificato né un rimedio autorizzato al rifiuto.

Issue #307 rimane il riferimento unico. Nessuna esecuzione nuova, modifica CI, integrazione, pubblicazione o aggiornamento APK in questa fase. Il dispositivo installato rimane invariato.