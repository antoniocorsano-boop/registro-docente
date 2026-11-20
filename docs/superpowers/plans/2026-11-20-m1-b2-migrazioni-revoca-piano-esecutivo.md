# M1-B2 — Piano esecutivo: autorizzazione revocabile e migrazione legacy sicura

**Fissazione:** 20 novembre 2026  
**Stato:** NEXT STEP SALVATO — **NON ANCORA AVVIATO COME IMPLEMENTAZIONE**; dipende da B1.  
**Governance:** issue #104 / #326; PR #384 (documentazione), PR #385 (unico ramo tecnico M1, bozza, non integrare).  
**Basi esatte:** `main@8d3baab8e513100887c8b81d1dbf7408bebeec6f`; riferimento STAB-06 #325 `6063fc0ff2809584c266b3161dafea9ffba92a8d`.  
**Baseline del GREEN B1 in qualifica:** PR #385 `6fbac1caad903987047a5db05303b503f7fa4239`.  
**Contesto:** [Programma M1](2026-11-20-m1-programma-esecutivo-riallineamento.md), [classificazione B0](../audits/2026-11-20-m1-b0-classificazione-12-invarianti.md).

## 1. Scopo e risultato professionale

Le operazioni di creazione del nuovo archivio cifrato e di migrazione dai dati locali precedenti devono restare **revocabili fino al punto di commit**, proteggere i dati sorgente e dichiarare l'esito soltanto dopo verifica effettiva. Il cambio di sessione Android/Web, blocco, sospensione, navigazione, perdita di primo piano, sostituzione della fonte e annullamento rendono non valida un'autorizzazione precedentemente concessa.

Nessun dato personale, firma, copia di sicurezza reale, cancellazione dell'archivio installato, attivazione recuperi V8/V9, pubblicazione o nuova infrastruttura. Le prove impiegano solo archivi sintetici.

## 2. Condizione di ingresso — B1 prima di B2

**Non iniziare interventi applicativi B2** finché:
1. [PR #385](https://github.com/antoniocorsano-boop/registro-docente/pull/385) è verificata sul proprio SHA esatto;
2. la [qualificazione Browser #44766401458](https://github.com/antoniocorsano-boop/registro-docente/actions/runs/44766401458) è **PASS (71/71)** e le due prove Chromium B1 sono PASS, incluse assenza di creazione dopo sola osservazione e preservazione dei dieci record dopo perdita dei metadati;
3. la [matrice nativa DB2 #44766402430](https://github.com/antoniocorsano-boop/registro-docente/actions/runs/44766402430) è triagiata: **un lavoro API su emulatore ha già restituito** `UiTestAutomationBridge: null root node` e un file `/sdcard/val01-ui.xml` non disponibile; questa è una **anomalia di qualificazione non attribuita** alla correzione B1, non un PASS né una perdita di dati dimostrata;
4. non ci sono regressioni accertate che vadano corrette in B1.

**Aggiornamento successivo:** PREDEPLOY #44766401700 PASS, Invariants #44766401502 PASS, HEADER #44766401679 PASS, compatibilità archivio Beta2 #44766401989 PASS, FLOW-03 #44766401932 PASS, BETA2 Reference #44766401757 PASS. **Browser Qualification #44766401458 PASS, 71/71 prove**, incluse entrambe le prove fisiche M1-B1; verificato sui log del lavoro browser. La matrice nativa ha 4/5 lavori PASS: API 32 legacy e V9, API 36 V9 e preflight; il solo API 36 legacy è fallito dopo i PASS di persistenza per errore di acquisizione interfaccia Android, non ancora attribuito. **Riesecuzione mirata del solo job fallito #136392228468 richiesta e accettata da GitHub** sul run #44766402430, senza cambiare sorgenti/workflow. **B1 = browser qualificato, nativo da chiarire; B2 = PIANIFICATO.**

## 3. Differenze sorgenti verificate e interventi candidati (non automaticamente richiesti)

| Confine | `main` | STAB-06 #325 | Azione pianificata |
|---|---|---|---|
| Nuovo archivio | `initializeNewArchive(vault,password,setup)` usa `createStaging`, `restoreSnapshotVerified`, `activate`, e su errore tenta `discardStaging` | Variante autorizzata `initializeNewArchive(...,assertAuthorized?)` con controlli ripetuti; `writeInitialSnapshotVerified`; distingue attivazione già invocata da scrittura ancora abortibile | Riprodurre RED su revoca dopo staging/backup e intorno a `ACTIVE`; portare solo il ramo sicuro, senza rompere l'API legacy |
| Migrazione locale | `migrateLegacyToVault(storage,vault,password)` legge la fonte, scrive cifrato, verifica e attiva; controlli di sessione e fonte tra `await` assenti | Variante `migrateLegacyToVault(...,assertAuthorized?)`; confronto byte grezzi prima dell'attivazione e della cancellazione, nessuna rimozione della fonte se l'esito ACTIVE è incerto | Introdurre RED su revoca e modifica fonte; collegare callback al proprietario Root; correggere con perimetro minimo |
| Pulizia fonte dopo `ACTIVE` | `cleanupVerifiedLegacyAfterActivation` verifica i valori trasformati ma non controlla byte grezzi/autorizzazione a ogni attesa | Variante con `assertAuthorized` e `captureLegacyBytes` prima di cancellare | Testare prova di origine e autenticazione fresca, rifiuto se fonte cambia |
| Controllo persistente di archivio | `SecureVault.createStaging/activate/putMany` hanno già primitive opzionali `assertAuthorized`, `onCommitInvoked` | Primitive di base **identiche** | RIUSARE; non riscrivere crittografia né il formato |
| Copia DB1→DB2 | `authorizedVaultMigration.ts` e `versionFencedVaultStore.ts` sono **identici** | Uguali, con ulteriori orchestratori separati `migrationSessionBoundary.ts`, `migrationRecoveryHandoff.ts` | B2 non deve anticipare il recupero B3; solo verificare consenso monouso e collegamento se già pertinente |
| Proprietario sessione | Root B1 ora usa contatore/generazione di ispezione e protezioni di avvio | Root STAB-06 ha cancellazione e fencing estesi per migrazione | Associare autorizzazione a generazione/sospensione/blocco/annullamento, non al solo `isUnlocked` |

**Attenzione:** le 12 invarianti mancanti dal registro di main non corrispondono a 12 modifiche indipendenti; B2 investe in particolare `VAL-01-STAB06-I02` e `VAL-01-D1B3B-I01`, lasciando `I05/I06` per B3.

## 4. Matrice di prove B2 — prima RED causale poi GREEN

| ID | Stimolo sintetico | Attesa da dimostrare | Perimetro |
|---|---|---|---|
| B2-R01 | Interruzione dopo `createStaging` e prima di scrittura cifrata | Fonte intatta; solo staging realmente posseduto può essere eliminato | setup |
| B2-R02 | Revoca dopo una scrittura e prima della verifica completa | Non esiste `ACTIVE` non autorizzato; fonte invariata; nessun falso successo | setup/migrazione |
| B2-R03 | Revoca durante la lettura asincrona dei metadati prima del commit | Callback rivalidata nel punto finale di ammissione; nessuna invocazione ACTIVE | setup/migrazione |
| B2-R04 | Cambiamento dei byte sorgente fra snapshot e commit | Rifiuto prima di ACTIVE, nessuna cancellazione della fonte mutata | legacy |
| B2-R05 | Commit ACTIVE invocato, poi sospensione o errore di rilettura | Esito **incerto**, non `rollback` presunto; blocco sessione e re-ispezione protetta | entrambi |
| B2-R06 | ACTIVE fisico già completato ma fonte locale non ancora rimossa | Riapertura autenticata, confronto completo, cancellazione soltanto dopo verifica | legacy cleanup |
| B2-R07 | Revoca durante pulizia dopo ACTIVE | Sorgente ancora presente, nessuna cancellazione dopo revoca | cleanup |
| B2-R08 | Fonte legacy modificata dopo lettura cifrata, prima della cancellazione | Protezione sui byte grezzi, non soltanto sull'oggetto normalizzato | cleanup |
| B2-R09 | Cambio di generazione Android/Web, ritorno dalla selezione file, annullamento esplicito | Ogni `await` invalida la vecchia autorizzazione; nessun riutilizzo del consenso | Root |
| B2-R10 | Reinvio concorrente di migrazione/setup | Una sola operazione autorizzata; nessun doppio `ACTIVE`; esito riferito al suo tentativo | Root |
| B2-R11 | Percorso normale su dati completamente sintetici | Inventario completo e corrispondenza degli invarianti prima di rimozione legacy | unità+browser |
| B2-R12 | Errore di rete/chiusura vista/operazione pending | Nessun messaggio di successo prematuro; errore leggibile, fonte preservata | browser |

**Regola RED:** test originario su implementazione pre-correzione che fallisce **per il comportamento specifico**, mai per un import/file mancante. **Regola GREEN:** stesso test senza cambiarne l'aspettativa, regressione sullo SHA esatto, browser reale e integrità dei record fisici. Nessun test si può omettere solo per far passare la pipeline.

## 5. Sequenza eseguibile con commit tracciabili — nessuna nuova PR

**B2-0 | Congelare prerequisiti.** Rileggere PR #385, ultime verifiche Browser/Native, base del ramo. Se B1 è ancora in errore, fermarsi e correggere prima B1.

**B2-1 | Test RED di dominio.** Estendere le suite pertinenti `src/security/initialArchiveSetup.test.ts` o `secureAppStorage.test.ts` e `legacyMigration.test.ts`, senza sostituire quelli storici, per B2-R01…R08. Associare ogni nuovo file al registro invarianti secondo `qualification/invariants.v1.json` **prima** di chiedere qualifiche, evitando percorsi non registrati.

**B2-2 | Contratto di sessione.** Un'autorità monouso legata a `epoch/revision` e ciclo di vita, revocabile al cambio schermo/lock/sospensione, con confronto della fonte per la migrazione. Preparare RED per B2-R09/R10 che invoca il **vero** proprietario Root.

**B2-3 | GREEN minimo.** Riutilizzare callback di `SecureVault` e criteri STAB-06 senza trascinare il vecchio `SecureRegistroRoot` integrale, né sostituire i nuovi recuperi DB2 V8/V9. Nuovo commit, stessi RED ora PASS.

**B2-4 | Qualifica progressiva.** Verificare invariant registry, TypeScript, sicurezza, PREDEPLOY, browser degli scenari necessari e regressione della PR #385. Confrontare la provenienza dei risultati su SHA esatto; annotare ogni blocco.

**B2-5 | Report.** Aggiornare questo documento e la PR #385 con matrice casi PASS/FAIL, log, commit e rischio residuo. Solo con B2 qualificata avviare B3 recupero cifrato.

## 6. Criteri non negoziabili

- La fonte legacy viene cancellata solo **dopo** conferma fisica e autenticata di ACTIVE, confronto invarianti, consenso valido e sorgente invariata.
- Prima del commit il proprietario può annullare; **dopo invocazione del commit** non si promette un rollback senza ispezione reale.
- Nessun codice applicativo può scambiare `STAGING` con una prima configurazione, ricreare dati mancanti o aggirare la marcatura di archivio stabilito.
- Non modificare `authorizedVaultMigration.ts`, `versionFencedVaultStore.ts`, il modello V8/V9 o i flussi Android solo per semplificare il lavoro.
- L'assenza di errori nei test unitari non dimostra equivalenza Web/Android; S-R04b resta bloccato per canali ufficiali (#307).
- A fine B2 la PR #385 **resta Draft e NO-GO** senza R1 specialista, R2 recupero nativo autorizzato, R3 firma/versione/approvazione.

## 7. Registro operativo

| Fase | Stato alla fissazione | Prossimo artefatto |
|---|---|---|
| B1 browser e prova fisica | **PASS — 71/71** | Risultato terminale della Browser Qualification #44766401458 acquisito |
| B1 anomalia emulatore | DA ATTRIBUIRE — riesecuzione mirata API 36 legacy richiesta | Esito del secondo tentativo nel Native DB2 #44766402430; verificare eventuale riproducibilità |
| B2 prerequisiti | PREPARATI | SHA PR #385 validato |
| B2 test RED | NON AVVIATI | B2-R01…R12 con prove sui moduli reali |
| B2 GREEN | NON AVVIATO | Commit minimo e regressioni |
| B2 browser e nativo | NON AVVIATI | Verifica per SHA, senza real data |
| B3 recupero | SOSPESO FINO A B2 | Proseguire nel medesimo ramo/PR |

**Prossima azione non ambigua:** verificare i due controlli B1 aperti, classificare l'anomalia nativa e, solo con B1 convalidato, realizzare **B2-R01** sul ramo già esistente della PR #385.

## 8. Avanzamento esecutivo B2 — verificato il 20 novembre 2026

**B1 concluso con successo per il perimetro di laboratorio in #385**, sul SHA `6fbac1caad903987047a5db05303b503f7fa4239`: tutte le 8 qualificazioni concluse PASS, incluse la Browser Qualification [#44766401458](https://github.com/antoniocorsano-boop/registro-docente/actions/runs/44766401458) (71/71), e la [Native DB2 #44766402430](https://github.com/antoniocorsano-boop/registro-docente/actions/runs/44766402430) dopo riesecuzione del solo job API 36 legacy (esito 5/5 PASS). Si conserva il log del precedente tentativo fallito nell'interfaccia, senza attribuirgli una regressione non dimostrata. **R1/R2/R3 continuano a non essere soddisfatti.**

**B2 test RED causali acquisiti:**
- PR #385 `43c13f3c453c310a73c94b457d00236197185610`: recuperate dall'esatto #325 sei prove `S-R02/S-R05` in `src/security/legacyMigration.test.ts`. 
- `d9101d62acf66d5c054976904991467c6dc1c4fb`: registrazione nelle invarianti corretta, [Qualification Invariants run #44774087781](https://github.com/antoniocorsano-boop/registro-docente/actions/runs/44774087781): **6/6 fallimenti causali**. Gli esiti reali erano promesse risolte anziché rifiuti di autorizzazioni revocate o origine modificata; non errori di importazione. I normali test preesistenti sono rimasti eseguibili.
- I sei test includono revoca dopo una scrittura, durante lettura prima di ACTIVE, dati d'origine alterati, revoca dopo ACTIVE, revoca nella pulizia e modifica dei byte sorgente.

**B2 prima correzione GREEN applicata (ancora in qualifica):**
- `872e2ec216b1bde0eb36f9e85f001397ebc68b46`: ripristinato `legacyMigration.ts` del candidato #325, con callback ai confini asincroni, confronto byte d'origine, distinzione commit invocato e conservazione fonte dopo revoca.
- `83c3741291396e362939494d6b40268e0ef0c1b0`: `initialArchiveSetup.ts` revocabile, senza cambiare il modello archivio né il formato cifrato.
- `8f0ffa2bc1ea0e93326c359b0857c2b374cd262b`: registrati tutti i file di implementazione/test nel sistema esistente di invarianti, **149 invarianti conservate**.
- **SHA di controllo corrente:** `cf10a7e896a1c968cf4fb3e09aa4ddeaa8439ce2`, su [PR #385](https://github.com/antoniocorsano-boop/registro-docente/pull/385): integrazione nell'effettivo `SecureRegistroRoot` di un'autorità di sessione revocabile per nuova configurazione, sblocco/pulizia legacy e migrazione, con esclusività delle operazioni, invalidazione per perdita primo piano, lock, reset e revisione Android; controllo prima dell'ammissione e della pubblicazione dello stato READY.

**Controlli sul commit `cf10a7e...` al momento del checkpoint:** [Qualification Invariants #44774831833](https://github.com/antoniocorsano-boop/registro-docente/actions/runs/44774831833) PASS, [PREDEPLOY #44774831954](https://github.com/antoniocorsano-boop/registro-docente/actions/runs/44774831954) PASS, [FLOW-03 #44774831957](https://github.com/antoniocorsano-boop/registro-docente/actions/runs/44774831957) PASS, [compatibilità Beta2 #44774833060](https://github.com/antoniocorsano-boop/registro-docente/actions/runs/44774833060) PASS. [Browser Qualification #44774831797](https://github.com/antoniocorsano-boop/registro-docente/actions/runs/44774831797), [BETA2 Reference #44774831634](https://github.com/antoniocorsano-boop/registro-docente/actions/runs/44774831634), [HEADER #44774832017](https://github.com/antoniocorsano-boop/registro-docente/actions/runs/44774832017) e [Native DB2 #44774831847](https://github.com/antoniocorsano-boop/registro-docente/actions/runs/44774831847) erano ancora in corso/in coda. **B2 NON ANCORA qualificato.**

### Unica istruzione per la prossima ripresa

1. Verificare **esclusivamente** lo SHA HEAD della PR #385 e l'esito terminale degli otto controlli associati a `cf10a7e...`. Non trasferire risultati del precedente commit B1.
2. Se compare un fallimento, localizzare il caso nei log e correggere sullo **stesso ramo**; ripetere la qualifica per il nuovo exact SHA. Se la regressione è nativa, distinguere un problema del codice da quello dell'emulatore; non modificare i workflow sospesi S-R04b.
3. Verificare che i sei RED siano ora GREEN sullo stesso SHA, che il Root chiami effettivamente le funzioni con callback di revoca e che la ripartenza dopo ACTIVE incerto non cancelli mai la fonte. Se necessario, aggiungere **prove di livello Root e Chromium** per revoca durante sessione/reload senza assumere sufficiente il test statico.
4. **Solo con B2 integralmente PASS**, procedere al pacchetto B3 (handoff cifrato, DB2 e versioni V6–V9), sempre nella medesima PR #385 e senza merge.
