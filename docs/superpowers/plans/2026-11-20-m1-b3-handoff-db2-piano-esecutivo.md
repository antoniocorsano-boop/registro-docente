# Registro Docente — M1-B3: passaggio cifrato e proprietario DB2 (piano esecutivo)

**Fissazione:** 20 novembre 2026. **Fonte autoritativa dell'avanzamento:** PR #385, ramo `feat/m1-security-reconciliation`. **Contenitore documentale:** PR #384. **Stato di partenza:** B3-0 approvato come sequenza tecnica, B3-1 non ancora qualificato; nessun rilascio. **B3 non equivale ad autorizzazione alla migrazione installata.**

## 1. Punto di ingresso qualificato e provenienza

- **B1:** exact `6fbac1caad903987047a5db05303b503f7fa4239`, 8 qualificazioni PASS, incluso Browser 71/71 e Native DB2 5/5 dopo riesecuzione mirata.
- **B2:** exact `e080dca4806155c43485e7b307e0aac648c5b2d7`, **8/8 qualificazioni automatiche PASS**, [Browser #44784661473](https://github.com/antoniocorsano-boop/registro-docente/actions/runs/44784661473) (71 prove PASS), [Native DB2 #44784661584](https://github.com/antoniocorsano-boop/registro-docente/actions/runs/44784661584) (5/5 lavori PASS); 13/13 nella fase SEC-SESSION-01, comprese 3 prove M1-B2 di revoca nel Root su transazioni IDB reali; [prova RED originaria B2 #44774087781](https://github.com/antoniocorsano-boop/registro-docente/actions/runs/44774087781) sei fallimenti causali. **149 invarianti conservate** al checkpoint B2.
- **Main originale M1:** `8d3baab8e513100887c8b81d1dbf7408bebeec6f`. **STAB-06 #325 congelato:** `6063fc0ff2809584c266b3161dafea9ffba92a8d`. Non integrare il ramo vecchio né sostituire i recenti file DB2.
- R1 #323 (revisore specialista indipendente), R2 #307 (S-R04b sospesa) e R3 #326 (firma/aggiornamento in-place) restano **NO-GO**.

## 2. Architettura del passaggio (limiti non negoziabili)

`selezione locale di copia cifrata` → `rilettura/autenticazione con l'autorità file esistente` → `ticket monouso in memoria, legato a epoch/revision` → `sigillo definitivo della coda delle mutazioni` → `riconoscimento archivio fisico, nessuna riparazione implicita` → `controllo origine e verifica copia v6` → `consenso univoco` → `ritiro delle vecchie connessioni DB1` → `confronto fisico CAS di DB2` → `commit atomico` → `nuova autenticazione senza riprendere la precedente sessione`.

**Distinzioni:** v6 legacy e v7 storico non sono sinonimi del recupero documentale V8 né dell'istituzionale V9; questi ultimi sono presenti in main, devono essere preservati e qualificati separatamente. Una copia selezionata non è conferma, l'aver invocato il commit non è prova di rollback, e un successo di test nel laboratorio non abilita automaticamente il prodotto personale.

## 3. Confronto sorgente B3 già rilevato

| Oggetto | Su PR #385 dopo B2 | STAB-06 #325 | Decisione |
|---|---|---|---|
| `migrationRecoveryHandoff.ts` | Assente al punto di fissazione | Modulo isolato, in memoria, senza grant, con `selectAndroid/selectWeb/consume` e verifica epoch/revision | Ricollocare isolato, **testare prima dell'integrazione**; mai leggere dati reali |
| `val01MigrationRecoveryHandoff.test.ts` | Assente | 6 test per file locale, picker, digest, revoca, reentrancy, monouso e owner | Trasferire le prove originarie e registrarne la copertura |
| `migrationSessionBoundary.ts` / `val01MigrationSessionBoundary.test.ts` | Assenti | Sigillo coda, revalidazione in ogni `await`, consenso, ritiro DB1, esito incerto; 7 test | Ricostruire adapter rispettando API e versione attuali, non aprire DB2 senza autorizzazione |
| `db2Lifecycle.ts` / `db2PhysicalLifecycle.ts` | Presenti con V8/V9 e autorizzazione CAS | Vecchia implementazione più limitata | **Non copiare** dal ramo vecchio: test di regressione sul modulo attuale |
| `authorizedVaultMigration.ts`, `versionFencedVaultStore.ts` | Presenti identici al ramo vecchio | Identici | Riutilizzare i servizi già implementati, senza sostituzioni |

## 4. Matrice di prove B3 (archivi *solo sintetici*)

| Caso | Condizione mirata | Risultato obbligatorio |
|---|---|---|
| B3-R01 | Android picker sospende/riprende con nuova epoch autenticata | Copia accettata soltanto dalla nuova epoch; ticket singolo, niente reset involontario |
| B3-R02 | Picker annullato, risposta hash non valida, file vuoto/oltre limite | Nessun ticket, nessun sigillo, nessuna migrazione |
| B3-R03 | Due picker concorrenti o owner invalidato durante attesa | Nessun ticket stantio, nessuna doppia lettura/scrittura |
| B3-R04 | Epoch/revision cambia prima del consumo del ticket | Ticket scartato, nessun riutilizzo |
| B3-R05 | Sigillo coda con scrittura ammessa in corso | Coda drenata, nuove scritture rifiutate, terminale richiede nuova sessione |
| B3-R06 | Preflight incompleto, copia non valida, consenso negato | Nessuna migrazione né riapertura delle scritture sigillate |
| B3-R07 | Revoca prima del commit, anche durante await di ritiro DB1 | Nessuna invocazione del commit DB2 |
| B3-R08 | Revoca dopo avvio commit o risultato incerto | `inspect-reopen-required`, verifica fisica prima di nuovo accesso, non rollback supposto |
| B3-R09 | DB2 modifica fisica concorrente o proprietario diverso | CAS rifiuta il commit, nessun contenuto sovrascritto |
| B3-R10 | Inventario DB2 malformato, sparse, versione incompatibile | Rifiuto esplicito senza inizializzazione/reinizializzazione |
| B3-R11 | Ripristino v6/v7 distinto da V8 e V9 | Rispetto dei codec/versioni/catena documentale; nessuna retrocessione del modello DOC-01 |
| B3-R12 | Collegamento al vero Root, browser Chromium e driver Android sintetico | Nessun successo prematuro; la selezione non attiva DB2 in produzione; schermata protetta in errore, richiesta nuova autenticazione |

## 5. Ordine operativo con punti di arresto

**B3-0 — Fissazione:** convalidare B2 SHA e CI (acquisito), elenco contratti e criteri di esclusione. Questa scheda costituisce il passaggio di consegne.

**B3-1 — Copia cifrata in memoria:** riusare soltanto l'isolato `migrationRecoveryHandoff.ts` e le sei prove originali di #325, verificando compatibilità con `androidBackupExport.ts` corrente; registrare test e file nel registro invarianti. **Non collegare alla UI né al recupero V8/V9.**

**B3-2 — Proprietario monouso della sessione:** recuperare/adattare `migrationSessionBoundary.ts`, `val01MigrationSessionBoundary.test.ts` e dipendenze pertinenti con test causali su queue seal, ritardo, cancel, retrocessione, origine. Da prima RED di comportamento sul chiamante esistente, poi GREEN mirato, senza test falliti solo perché manca il file.

**B3-3 — Continuità DB2:** prove fisiche su `db2Lifecycle.ts` e `db2PhysicalLifecycle.ts` presenti, compresi CAS concorrenti, inventario, revoca e nuova autenticazione; salvaguardare tutti i nuovi percorsi DOC-01 V8/V9; non ripristinare l'implementazione obsoleta.

**B3-4 — Collegamento supervisionato:** introdurre ingresso solo dove i contratti sono completi e un'autorità autenticata concede esplicitamente la migrazione; nessuna attivazione automatica, nessuna modifica di entrypoint/feature flag installati per eludere R2. Le due superfici Web e Android devono conservare il proprio confine.

**B3-5 — Prova completa:** registrare SHA, regressione di sicurezza, invarianti, browser reale, laboratorio nativo; riportare numero prove, link, log, assenze/limitazioni; non avanzare a B4 se una prova B3 effettiva è aperta.

## 6. Registro decisionale

- **Permesso:** recuperare moduli isolati e prove da #325 nel **solo** ramo della PR #385, fare comparazioni e test sintetici.
- **Non permesso:** merge, deploy, pubblicazione, modifica dati reali o copia dati dal telefono, firma, modifica dei flussi R2 sospesi, accensione DB2 in produzione.
- **Sorgente canonica per il prossimo incontro:** questa scheda + [programma M1](2026-11-20-m1-programma-esecutivo-riallineamento.md) + [PR #385](https://github.com/antoniocorsano-boop/registro-docente/pull/385).
- **Primo risultato da esigere:** B3-1 con le sei prove su SHA esatto e controllo invarianti, senza promuovere l'isolato a funzionalità installata. 


## 7. Esito B3-1 — primo candidato, qualifica in corso

**Prima esecuzione effettiva nel ramo tecnico della PR #385:** `feat/m1-security-reconciliation@30bad90795ae7c8ffea8d9c90e84ded2a86552ca` (non integrato, sempre Draft). Sono stati trasferiti **identici per contenuto** gli oggetti dall'exact #325:
- `src/security/migrationRecoveryHandoff.ts`: blob originario `35e01d358da8ffd106d5ede1e7d23dc24407132a`;
- `src/security/val01MigrationRecoveryHandoff.test.ts`: blob originario `c5282349205537c620fe1870ae5d031b37c2bcd8`, sei test su selezione locale/Web, Android picker, controllo hash, revoca, cambiamento epoch e consumo monouso.

Entrambi i percorsi sono stati registrati **nell'invariante esistente** `MOBILE-01-M2B-NATIVE-RESTORE-I01`, coerente con la selezione di una copia cifrata da un'autorità Android esistente; il registro conserva **149 invarianti**. Nessuna nuova dipendenza, nessuna nuova procedura Android, nessuna importazione nell'entrypoint applicativo, nessuna modifica a `SecureRegistroRoot`, V8/V9, `db2Lifecycle` o `db2PhysicalLifecycle`.

**Qualifica in corso sul commit esatto**: Qualification Invariants [#44790181507](https://github.com/antoniocorsano-boop/registro-docente/actions/runs/44790181507), PREDEPLOY [#44790181836](https://github.com/antoniocorsano-boop/registro-docente/actions/runs/44790181836), Browser [#44790181460](https://github.com/antoniocorsano-boop/registro-docente/actions/runs/44790181460), Native DB2 [#44790181593](https://github.com/antoniocorsano-boop/registro-docente/actions/runs/44790181593) e le altre quattro qualificazioni automatiche. **Non dichiarare B3-1 PASS finché test e check finali non sono verificati.** La PR #385 rimane Draft e il progetto installato non cambia.

**Ripresa dopo il controllo:** leggere l'esito reale dei sei test originali in CI; se PASS, avviare B3-2 con test di coda/sigillo, revoca, ricontrollo della fonte e autorizzazione all'invocazione del commit; se FAIL, correggere il solo modulo sullo stesso ramo e risottoporre lo SHA aggiornato a verifica. Niente anticipo di B3-4, né assunzione che il laboratorio equivalga al ripristino Android operativo.


## 8. Primo reintegro isolato B3-2 — qualifica del candidato

**SHA corrente della PR #385 da qualificare:** `14badd2059bcc5c1a3b7985617b8471e5f6b990c` (**Draft, non integrata**). È stato completato il recupero *isolato e senza chiamante produttivo* di due sottosistemi B3, ciascuno ricondotto ai blob esatti di #325:

- **B3-1 / recovery handoff:** `migrationRecoveryHandoff.ts` (`35e01d3...`) e `val01MigrationRecoveryHandoff.test.ts` (`c528234...`), 6 prove.
- **B3-2 / classificazione e sigillo:** `archivePreflight.ts` (`39ff8f17aee34ba967c324e1458e95ac2f04d433`), `migrationSessionBoundary.ts` (`a7a4cc0890d2ca75098deafde866aca77ac58220`) e `val01MigrationSessionBoundary.test.ts` (`5bad8598916fa7fbb7135b04a44856c298ca4412`), 7 prove.

La coda usa la stessa versione originale del coordinatore presente in main e #325 (`src/persistence/durableMutationCoordinator.ts`, blob `6399a385774d65395ccc227c2f7e053b990174f4`), e il servizio di migrazione DB1 è già comune ai due rami. I due gruppi di test sono registrati **nelle invarianti già esistenti** `MOBILE-01-M2B-NATIVE-RESTORE-I01` e `VAL-01-S6D-DB2-I01`, **totale invarianti ancora 149**. Un test isolato PASS dimostra il proprio contratto, **non** l'integrazione nella Root, l'equivalenza V8/V9, la riapertura DB2 o il ripristino della app installata. Il percorso storico `VAL-01-STAB06-I05` non è ancora dichiarato ripristinato integralmente.

**Qualificazione CI avviata sul commit esatto:** [Qualification Invariants #44790582623](https://github.com/antoniocorsano-boop/registro-docente/actions/runs/44790582623), [PREDEPLOY #44790582666](https://github.com/antoniocorsano-boop/registro-docente/actions/runs/44790582666), [Browser #44790582453](https://github.com/antoniocorsano-boop/registro-docente/actions/runs/44790582453), [Native DB2 #44790582351](https://github.com/antoniocorsano-boop/registro-docente/actions/runs/44790582351); altri quattro controlli automatici paralleli. Nessun PASS finale attribuito a questo candidato prima del riscontro del run.

**Prossimo intervento B3-3 (in attesa del risultato dei test):** verificare `db2Lifecycle.ts` / `db2PhysicalLifecycle.ts` attuali con CAS, inventario e revoca e redigere matrice di non-regressione specifica dei recuperi V6, V7, V8, V9. Eventuali modifiche solo se dimostrate da test causali sullo SHA corrente. Non recuperare le implementazioni DB2 più vecchie da #325.


## 9. Evidenza qualificazione B3 sul commit 14badd

Il registro reale della [Qualification Invariants #44790582623](https://github.com/antoniocorsano-boop/registro-docente/actions/runs/44790582623) sul candidato `14badd2059bcc5c1a3b7985617b8471e5f6b990c` conferma:
- **1010 test PASS, 0 fail** nell'esecuzione generale;
- **6/6 PASS** nel gruppo `VAL-01 D1b.4b.2b recovery copy handoff`;
- **7/7 PASS** nel gruppo `VAL-01 D1b.4b isolated migration session boundary`;
- PREDEPLOY Security #44790582666, HEADER #44790582374, compatibilità Beta #44790582530 e FLOW-03 #44790582370: **PASS**.

Al medesimo checkpoint **Browser #44790582453** e **BETA2 Reference #44790582511** sono ancora in esecuzione; **Native DB2 #44790582351** in coda. **5/8 controlli terminali PASS; nessun FAIL rilevato.** Mantenere lo stato B3-1/2 **parzialmente qualificato, non prodotto** finché le verifiche restanti non sono terminali.

**Approfondimento B3-3 sul DB2 attuale già acquisito a livello sorgente:** `db2PhysicalLifecycle.ts` main (blob `ed92ad0a46c16da69983f4347484bf7753d977db`) controlla l'inventario all'interno della transazione, richiede due object store canonici, rifiuta upgrade e commit non autorizzati, confronta per CAS tutti i byte e supporta un callback `isAuthorized`. La versione #325 (blob `88eb8b52fabca24f065dd0a3f4fab31aa2f582bb`) **non aveva il callback opzionale di autorizzazione**: ricopiarla costituirebbe regressione. `db2Lifecycle.ts` main (blob `f7d1beaeb19946e79ffd83fb9e94dab41d690445`) include i percorsi di recupero documentale V8 e istituzionale V9, assenti nella versione #325 (blob `b511e8e31ea8a8b75c829738123dfffd0faa521a`). **Decisione di conservazione:** nessun trapianto dei due moduli DB2, nessuna attivazione in Root. Il passo successivo deve produrre **prove dinamiche di CAS e autorizzazione sul DB2 attuale**, non semplicemente un confronto testuale.


## 10. B3-3 — Prova CAS fisica in Chromium aggiunta

**Nuovo test esclusivamente di laboratorio** sullo stesso ramo PR #385, candidate `e9fe9736bede1b0c6128fdecf28e9d371825d2d0`:
- `tests/browser/fixtures/val01-s6d-db2.fixture.ts`: esposto `m1B3PhysicalGuards()` solo nel fixture sintetico. Genera archivio DB2 di dieci record cifrati, costruisce un possibile prossimo inventario `ERASED_DB2` senza applicarlo, poi inietta **(a)** revoca dell'autorizzazione esattamente al momento di lettura nella transazione `replaceDb2` (prima del commit) e **(b)** alterazione di un byte cifrato *solo nella copia attesa in memoria* per invalidare il CAS. Rilegge l'immagine fisica dopo ogni caso; nel vero DB2 non modifica un byte atteso.
- `tests/browser/val01-s6d-db2-persistence.spec.cjs`: nuova prova Playwright `M1-B3 real Chromium physical DB2 compare-and-swap...` che richiede entrambi i rifiuti, versione 2 invariata, immagine fisica immutata e digest di tutti i record invariati. Il test è aggiunto alla suite DB2 già qualificata, senza introdurre nuovi flussi o file di sorgente.
- Il fixture e la suite sono **già registrati** sotto `VAL-01-S6D-DB2-I01` e `VAL-01-S6D-RESTORE-V7-I01`, per cui il registro rimane a 149 invarianti. `db2PhysicalLifecycle.ts` e `db2Lifecycle.ts` restano invariati (gli aggiornamenti V8/V9 si conservano).

**Stato alla scrittura:** i workflow si stanno avviando sul commit `e9fe973...`; **test B3-3 non ancora dichiarato PASS**. Il test riguarda un archivio artificiale su Chromium, non l'abilitazione della funzione di recupero sul telefono. Prossima azione: leggere log dell'esatta Browser Qualification, verificare la nuova asserzione e i regressi V8/V9, classificare eventuali errori e correggere nello stesso ramo. Vietati merge/deploy/firma o riattivazione del percorso S-R04b.
