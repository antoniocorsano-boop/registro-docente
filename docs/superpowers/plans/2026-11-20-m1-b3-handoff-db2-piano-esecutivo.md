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
