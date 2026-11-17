# STAB-05/E — Dossier cumulativo delle evidenze (17 novembre 2026)

Candidato applicativo: e444abf5d69af1c217d0d06f35a8521bebf04c7f (#306). Stato: qualificazione documentale parziale, NON qualificazione cumulativa conclusa. Il dossier non modifica i workflow e non sostituisce i collaudi obbligatori.

## Catena verificata
- #301 bec003bdf6ff0a6063033ece3f29f276f979e3b2: quattro workflow PASS; run 44089688852 (4/4 nativi, Beta1 RC2 solo negativo), 44089688772 (browser generale), 44089688797 (compatibilità), 44089688751 (contratti e mobile).
- #302 9252c9c161790b2eab160e934a7b061fe4e83cae: run 44100314724, 58/58 browser per ciascuno dei tre predecessori (174/174); 44100314569, 1451/1451 security/memory e 27/27 contratti mirati, mobile PASS; 44100314531 browser generale PASS. Native run 44100314823: un PASS, tre FAIL. Un run precedente 44094245287 aveva tre PASS e FAIL API36 precommit: NON confondere esecuzioni diverse né cancellare i fallimenti.
- #303 8b9acef02352e6de2d771899a6d321eb42971b05: run 44106220257, 30/30 deterministiche, 8/8 Root/browser mirate. Cambia il bootstrap applicativo candidato e l'ammissione a setup/migrazione legacy.
- #304 c480ba75da86ee64310fb8e9540629b8cc4a3f1e: run 44108713298 PASS driver.
- #305 4b75b6f5e5ecd39d61fa626b00a29eaba3739221: run 44124347463 PASS driver e due smoke Android dell'APK originale; non sono collaudi di migrazione candidato.
- #306 e444abf5d69af1c217d0d06f35a8521bebf04c7f: run 44126527776, 21/21 driver, 10/10 fasi API36 precommit, verifica strutturata PASS. Artifact 14349870370.

## Applicabilità al candidato
Confronto GitHub #301→#306: 45 commit, 24 file modificati; src/ comprende SecureRegistroRoot.tsx, VaultGate.tsx, protectedBootstrap.ts e relative prove. Non estendere automaticamente il PASS di #301/#302 ai percorsi modificati.
Confronto #303→#306: 21 commit, 11 file, esclusivamente workflow, diagnostica, documenti; nessuna modifica src/, fixture browser, dipendenze o configurazioni applicative. Il risultato mirato #303 resta evidenza pertinente per lo stesso codice applicativo, non nuova esecuzione sullo SHA #306. Il ramo STAB-05 prima del dossier differisce da #306 per il solo piano documentale.

## Matrice di accettazione
| Scenario | Storico pre-STAB | Evidenza sul candidato stabilizzato |
| --- | --- | --- |
| API32 precommit | PASS run 44094245287; FAIL 44100314823 | Mancante |
| API32 postcommit | PASS run 44094245287; FAIL 44100314823 | Mancante |
| API36 precommit | FAIL in entrambi i run | PASS run 44126527776 |
| API36 postcommit | PASS in entrambi i run | Mancante |
| Avvio protetto | -- | 30+8 prove PASS #303, codice invariato |
| Driver e arresto | -- | 21/21 #306 |
| Compatibilità browser generale | 174/174 #302 | Solo 8 prove mirate post-modifica; regressione completa mancante |
| Sicurezza/memoria | 1451/1451 #302 | Regressione completa mancante |

## Riesame documentale dei confini
Le modifiche #303 introducono osservazione readonly, classificazione e retry limitati; controllo della generazione foreground prima dell'ammissione, separazione della configurazione esplicita e blocco degli stati non verificati; trace senza dati archivio. Il percorso di produzione resta non candidato (src/main.tsx invariato). Queste sono constatazioni di codice e risultati mirati, non attestazione indipendente.
Rischi da mantenere espliciti: flag locale non costituisce prova di assenza storica se tutto lo storage è stato rimosso; nessuna attestazione di atomicità concorrente del setup tra istanze; revoca dopo avvio della migrazione legacy non equivalente a revoca prima dell'ammissione; guasti hardware non simulati; causa originaria non dimostrata. Revisione indipendente e specifica sicurezza ancora obbligatorie.

## Decisione
Conservare le evidenze per ridurre ripetizioni non necessarie, senza abbassare i criteri del piano STAB-05. Nessuna nuova esecuzione, nessuna modifica delle configurazioni rifiutate dal servizio, nessuna approvazione definitiva, integrazione o attivazione. Issue #307 resta aperta per il blocco operativo. Non dichiarare 4/4 Android cumulativi: 1/4 sul candidato, tre mancanti.
