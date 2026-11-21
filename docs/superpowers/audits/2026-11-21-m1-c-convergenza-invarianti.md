# Registro Docente — M1-C: convergenza delle invarianti di sicurezza Web/Android

**Data:** 21 novembre 2026. **Stato:** M1-C/1 qualificata (8/8 sul commit `25a2fbf4593c28c0caac88defdb9a6b15a94e32c`); M1-C/2 qualificata (8/8 sul commit `ab410ffa717fc820b0fcb49a6aed71c98041e771`); M1-C/3 qualificata (8/8 su `76fdb2b92e55ac9345cb709f550fc11c951523e3`); M1-C consolidato in sviluppo, nuovo commit da qualificare.
**Unico ramo tecnico:** [PR #385](https://github.com/antoniocorsano-boop/registro-docente/pull/385), `feat/m1-security-reconciliation`, in bozza e non integrata.
**Base esatta già qualificata:** `a2d8fa8107ba8a53ab8b0eb84dbe0ec9f71df1d5` — 8/8 procedure concluse PASS.
**Riferimento storico congelato:** PR #325, `6063fc0ff2809584c266b3161dafea9ffba92a8d`.
**Fonti:** [dossier M1-B4/3](2026-11-21-m1-b4-rc2-e-m1-c-raccordo.md); [programma M1 in PR #384](https://github.com/antoniocorsano-boop/registro-docente/pull/384); [governo #104](https://github.com/antoniocorsano-boop/registro-docente/issues/104).

## 1. Risultato di questo incremento
Il codice applicativo già integrato nel ramo dispone del coordinatore `createProtectedBootstrap`, dell'osservazione IndexedDB existing-only e del chiamante effettivo `SecureRegistroRoot.inspectBootstrap`. La prova causale `src/security/m1BootstrapAdmission.test.ts`, `src/security/protectedBootstrap.test.ts` e gli scenari **M1-B1** nel browser `tests/browser/qualification-invariant-smoke.spec.cjs` verificano il rifiuto di avvio distruttivo, l'assenza di creazione nella sola ispezione e la conservazione di dieci record cifrati dopo perdita sintetica dei metadati. Sono prove già qualificate sul candidato base, non dichiarazioni di rilascio.

**Decisione M1-C/1:** riprendere l'ID storico `VAL-01-STAB06-I01` con il suo enunciato originario e con percorsi di prova *esistenti sul candidato moderno*. L'ID non viene reinterpretato come permesso di distribuire o usare archivi reali. Il registro passa da 149 a **150 voci proposte**, da qualificare tutte sul commit risultante. Nessuna delle altre undici voci storiche viene inserita a scopo numerico.

## 1-b. Intervento M1-C/2 — migrazione legacy revocabile e scrittura ACTIVE incerta

**Origine della prova:** ramo di prodotto #385, `src/components/SecureRegistroRoot.tsx` (`beginArchiveOperation`, `handleMigrate`, `handleUnlock`), `src/security/legacyMigration.ts`, `src/security/secureVault.ts`, `src/security/legacyMigration.test.ts`. Il chiamante reale trasferisce alla migrazione l'autorizzazione revocabile di sessione; all'errore dopo tentativo di attivazione blocca il vault e richiama l'ispezione protetta senza considerare annullata una scrittura potenzialmente definitiva.

**Intervento 1 — commit `72026784abca3da151e03576862124d5b1330629`:** due prove causali aggiuntive nella suite `legacyMigration.test.ts` simulano (a) metadati già salvati come ACTIVE ma conferma fallita e (b) rifiuto della scrittura ACTIVE con STAGING ancora presente. In entrambi i casi si richiedono conservazione dei sei dati legacy, conservazione dei sei record cifrati e sessione bloccata; solo nel caso ACTIVE confermabile dopo nuova autenticazione è consentita la pulizia verificata. Sono prove sintetiche; non sono migrazioni Android di prodotto.

**Intervento 2 — commit `f1e3765302d63ce12b5bc5c43850af861b3fd58e`:** l'ID storico `VAL-01-STAB06-I02` viene ripristinato con enunciato originale e superfici effettivamente presenti. Il registro contiene 151 invarianti: le 150 preesistenti rimangono invariate. Non viene ereditata come prova `tests/browser/val01-database-fence.spec.cjs`, non presente nel candidato e relativa al vecchio perimetro; resta distinta la copertura del fence fisico e dei client storici.

**Decisione:** M1-C/2 candidato ammissibile alla nuova qualificazione, **non ancora PASS** finché tutti i controlli sul commit conclusivo non terminano con successo. Restano dieci invarianti storiche da riconciliare. La prova non implica isolamento da client storici non cooperanti, né una distribuzione Android qualificata.

## 1-c. Intervento M1-C/3 — copia cifrata monouso e autorizzazione di migrazione

**Condizione di ingresso:** M1-C/2 8/8 PASS su `ab410ffa717fc820b0fcb49a6aed71c98041e771`; nessuna promozione automatica della CI sul nuovo commit. Prima dell'intervento 151 invarianti registrate e dieci storiche residue.

**Codice candidato verificato:** `src/security/migrationRecoveryHandoff.ts` consegna il solo testo cifrato, vincolato all'epoch e alla revisione della sessione autenticata, con consumo una tantum; `src/security/migrationSessionBoundary.ts` impone `sealAndDrain()` della coda effettiva prima della prima attesa, verifica lo stato della sessione dopo ogni passaggio, distingue preflight, lettura, consenso esplicito, ritiro DB1 e migrazione autorizzata, e richiede nuova sessione protetta a esito terminale; `src/security/m1SupervisedMigrationHandoff.ts` orchestra entrambi ma dichiara esplicitamente **assenza di chiamante in produzione**. Le prove già presenti includono `val01MigrationRecoveryHandoff.test.ts`, `val01MigrationSessionBoundary.test.ts` e `m1SupervisedMigrationHandoff.test.ts`.

**Prove aggiunte — commit `edda83dc5e4ec8dbf053e13141ffb045ec38718a`:** 1) blocco prima del consumo se la copia selezionata perde il proprietario o l'autenticazione, senza sigillare la coda; la nuova autorizzazione non rianima il biglietto consumato; 2) rifiuto del consenso dopo la selezione, senza migrazione o rigioco della copia, con coda definitivamente sigillata. Solo dati sintetici e moduli isolati.

**Registro — commit `1ef4eaae3734bbd0246fd77c015c8dd7d878aed5`:** ripristinato `VAL-01-STAB06-I05` con **enunciato storico letterale**, vincolato ai tre gruppi di prove attuali. Il registro sale da 151 a 152 invarianti, senza modificare le 151 preesistenti. Le nove invarianti storiche ancora assenti non sono state inserite a scopo numerico.

**Limite della decisione:** l'esistenza e la qualificazione del componente isolato non attestano un comando UI di prodotto, un flusso di migrazione Android attivato, la provenienza degli APK storici né il rilascio. Non introdurre `ArchiveMigrationPanel.tsx` storico in produzione e non collegare automaticamente l'orchestratore a `SecureRegistroRoot`. M1-B5 e R1/R2/R3 restano autonomi. **M1-C/3 IN VERIFICA**, fino agli esiti completi sul commit finale.

## 1-d. Decisione di governo e blocco tecnico consolidato — 21 novembre 2026

L'indicazione espressa dal committente separa lo **sviluppo** dall'**accettazione e distribuzione**: le revisioni R1 e le qualificazioni R2/R3 non sono più gate d'ingresso alle successive funzioni, all'integrazione interna e ai test sintetici. Rimangono condizioni soltanto prima del reale rilascio. Le protezioni intrinseche dell'archivio restano operative e non derogabili; una migrazione sperimentale non viene attivata nella Root senza le proprie prove.

**Baseline:** M1-C/3 `76fdb2b92e55ac9345cb709f550fc11c951523e3`, 8/8 workflow GitHub Actions SUCCESS, compresi Chromium, compatibilità e laboratorio Android API32/36.

**Unico blocco applicativo e di prove dopo M1-C/3:**
- `tests/browser/fixtures/val01-s6d-db2.fixture.ts`: nuovo metodo `m1CConsolidatedDb1Guards` per un'origine IndexedDB sintetica fresca, preflight non creatore, lettore DB1 autenticato, rifiuto della versione errata, prova positiva e negativa della password, copia V6 non valida, revoca o mutazione fisica successiva alla preparazione. Un rifiuto deve conservare dieci record e versione 1.
- `tests/browser/val01-s6d-db2-persistence.spec.cjs`: tre prove browser corrispondenti `bad-copy`, `revoked`, `changed`; prova positiva distinta `M1-B3.4` già presente. Nessun file dei dati reali.
- `qualification/invariants.v1.json`: ripristino con testo storico letterale di `VAL-01-STAB06-I04` e `VAL-01-D1B3B-I01`, 152→154 invarianti; le 152 precedenti restano identiche. Il registro non viene riempito automaticamente con le sette voci prive di piena evidenza.

**Nuova matrice operativa:** [M1-C sviluppo consolidato](../plans/2026-11-21-m1-c-sviluppo-consolidato.md). Le sette voci ancora aperte distinguono CAS DB2, fence del vecchio client, storicità V6/V7, percorso Android originale, provenienza binari e accettazione nativa. I casi di rilascio non fermano lo sviluppo Web–Android in ambiente isolato.

**Decisione di verifica:** un solo esito conclusivo degli otto workflow sullo SHA finale consolidato; eventuali cicli intermedi GitHub sono diagnostici, non nuove condizioni R1/R2/R3. Al presente aggiornamento il blocco consolidato non è ancora qualificato: eseguire o acquisire le prove, correggere gli eventuali fallimenti nello stesso blocco.

## 2. Matrice puntuale delle dodici invarianti
| Invariante originaria | Stato M1-C | Evidenza o lacuna decisiva | Prossimo requisito |
|---|---|---|---|
| `VAL-01-STAB06-I01` | **REINTEGRATA E QUALIFICATA SULLO SHA M1-C/1 (8/8)** | Coordinatore, Root, unità e due prove browser M1-B1 con dati sintetici | Controllare build e invarianti sul nuovo commit |
| `VAL-01-STAB06-I04` | **REINTEGRATA NEL BLOCCO CONSOLIDATO / VERIFICA NUOVO SHA** | Preflight esistente, lettore existing-only v1/v2, prova Chromium sintetica su database assente/completo, password e versione errate | Nessuna attivazione produttiva; verificare i tre casi Chromium sul commit finale |
| `VAL-01-STAB06-I02` | **REINTEGRATA E QUALIFICATA M1-C/2 (8/8)** | `legacyMigration` collegata al Root; revoca e fonte rilette; nuove prove di mancato riscontro del commit e di fallimento ACTIVE, senza cancellazione della sorgente | Qualificazione automatica sul commit finale; mantenere separata la protezione da client storici non cooperanti |
| `VAL-01-D1B3B-I01` | **REINTEGRATA NEL BLOCCO CONSOLIDATO / VERIFICA NUOVO SHA** | Preparazione V6, confronto 10 record, consenso e revoca, tre nuovi rifiuti browser copia/owner/cifrato alterato; servizio isolato | Nessun chiamante reale; non equivale a migrazione Android installata |
| `VAL-01-STAB06-I05` | **REINTEGRATA E QUALIFICATA M1-C/3 (8/8)** | Passaggio monouso della copia cifrata, sigillo e svuotamento coda, revoca e consenso; due nuove prove su perdita proprietario e rifiuto consenso; componente isolato senza chiamante di prodotto | UI reale e accettazione Android ancora da dimostrare, nessuna attivazione automatica |
| `VAL-01-STAB06-I06` | LABORATORIO POSITIVO / V8-V9 DA PRESERVARE | DB2 moderno differente da #325, prove CAS e riapertura isolate | Qualificare proprietario prodotto senza retrocedere V8/V9 |
| `VAL-01-D1B-I05` | PARZIALE | Browser candidato e Beta1 RC2/RC3 qualificati; suite storica cumulativa assente | Fence completo, inclusi richieste bloccate/abbandonate e vecchi client |
| `VAL-01-D1B-I03` | PARZIALE | Decoder originale Beta2 RC2 testato dinamicamente contro V6 e V7 canonico in Bun; non è un APK né prova IndexedDB di ripristino | Reintegrare perimetro compatibilità fisica originale solo con sorgenti esatti |
| `VAL-01-D1B3C-I01` | LABORATORIO ANDROID POSITIVO | API 32/36 legacy e V9; mancano equivalenza APK e processo di migrazione originale | Prove native mirate e provenienza binari |
| `VAL-01-D1B3C-I02` | NON QUALIFICATA SUL PRODOTTO | Nessuna attestazione completa degli APK originali e del caso archivio RC2 sparso | M1-B5, fonte esatta e rifiuto con inventario conservato |
| `VAL-01-STAB06-I03` | NON QUALIFICATA SUL PRODOTTO | Pacchetto nativo sperimentale non equivale a pacchetto firmabile/distribuibile | Qualificazione fonte e pacchetto reale, distinta dalla CI |
| `VAL-01-STAB06-I07` | LABORATORIO POSITIVO | Driver e process probe storici presenti, non prova di rilascio | Attribuire esattamente APK, driver e API alla prova |

## 3. Criteri di ammissione ai passi successivi
1. Dopo il commit della prima invariante, interrogare **sullo SHA nuovo** qualificazione invarianti, controlli sicurezza, browser, Android API32/36, compatibilità storica, PREDEPLOY, FLOW e HEADER; nessun PASS per trascinamento.
2. Per le invarianti storiche residue (sette dopo il blocco M1-C consolidato proposto) servono equivalenza dimostrata o test causale specifico, con l'originario enunciato e con espliciti limiti di laboratorio. Non aumentare il registro se mancano.
3. Il ramo #385 è già il **candidato unico di riconciliazione**. Non sostituire `db2Lifecycle` moderno con il modulo storico e non collegare automaticamente `m1SupervisedMigrationHandoff` al Root di produzione.
4. M1-B5 — provenienza APK e prove native originali — resta una dipendenza distinta: non reinterpretare gli attuali PASS API 32/36 come suo completamento.
5. **Decisione successiva del committente:** R1, R2 e R3 vengono differiti alla fase di accettazione/distribuzione, **non** richiesti per continuare lo sviluppo. R2 [#307](https://github.com/antoniocorsano-boop/registro-docente/issues/307) resta sospeso nel suo caso specifico; non aggirarlo. Il documento [M1-C sviluppo consolidato](../plans/2026-11-21-m1-c-sviluppo-consolidato.md) governa il nuovo ciclo.

**Perimetro della presente operazione:** dossier, registro e test sintetici isolati; nessuna modifica a codice di produzione, cifratura, workflow, backup, dati professionali, APK, firma, dispositivo o pubblicazione. Prove esclusivamente sintetiche. Stato complessivo: **M1-C SVILUPPO ATTIVO / QUALIFICAZIONE DEL BLOCCO CONSOLIDATO IN CORSO / DISTRIBUZIONE NON AUTORIZZATA**.
