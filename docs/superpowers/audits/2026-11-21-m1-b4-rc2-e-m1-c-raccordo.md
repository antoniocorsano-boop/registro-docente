# Registro Docente — M1-B4/3 e passaggio a M1-C: Beta 2 RC2 storica, confini della prova e invarianti

**Data:** 21 novembre 2026. **Perimetro:** audit di sorgenti e prove esistenti, senza modifiche al programma.  
**Candidato letto:** [PR #385](https://github.com/antoniocorsano-boop/registro-docente/pull/385) su `4b296918cff8449c2f52ecae147419bf5f5af4b1`; ramo `feat/m1-security-reconciliation`, Draft.  
**Predecessore esatto:** Beta 2 RC2 `ddbf60781514b866b09e1fa1e014e6a6fc3989d3`.  
**Ulteriore predecessore:** Beta 1 RC3 `b726f4a6dc0eb90a066113bee7cceabf29c629a5`.  
**Candidato storico congelato:** PR #325 `6063fc0ff2809584c266b3161dafea9ffba92a8d`.  
**Fonte di governo:** [#104](https://github.com/antoniocorsano-boop/registro-docente/issues/104). B0: [PR #384](https://github.com/antoniocorsano-boop/registro-docente/pull/384), `docs/superpowers/audits/2026-11-20-m1-b0-classificazione-12-invarianti.md`.

## 1. Cosa è stato accertato sul commit storico esatto

La qualifica originale di **Beta 2 RC2** è stata interrogata al commit `ddbf60781514b866b09e1fa1e014e6a6fc3989d3`: **8/8 procedure GitHub Actions SUCCESS**. Tra esse [BETA2-UPDATE-02 #43811185518](https://github.com/antoniocorsano-boop/registro-docente/actions/runs/43811185518) ha due job completati SUCCESS su Beta 1 RC2 `37c61d4c64993c986a3edcd2b421310adf20de92` e Beta 1 RC3 `b726f4a6dc0eb90a066113bee7cceabf29c629a5`. **Si tratta della compatibilità di Beta 2 RC2 con le due Beta 1, non della compatibilità di Beta 2 RC2 con il candidato attuale.**

La PR #385 al commit `4b296918cff8449c2f52ecae147419bf5f5af4b1` ha anch'essa **8/8 procedure SUCCESS**: [Chromium di riferimento #44855341783](https://github.com/antoniocorsano-boop/registro-docente/actions/runs/44855341783) **192/192**, [BETA2-UPDATE-02 #44855341669](https://github.com/antoniocorsano-boop/registro-docente/actions/runs/44855341669) **4/4 RC2 e 4/4 RC3 Beta 1**, [laboratorio Android #44855341637](https://github.com/antoniocorsano-boop/registro-docente/actions/runs/44855341637) preflight e quattro combinazioni API32/API36 legacy/V9 **5/5 job PASS**. Non sommare prove distinte come se fossero un'unica certificazione.

## 2. Identità degli oggetti Git e confini dell'equivalenza

Oggetti letti direttamente negli alberi Git dei tre commit:

| File | Beta 1 RC3 | Beta 2 RC2 | PR #385 | Decisione |
|---|---|---|---|---|
| `src/security/vaultStore.ts` | `cfacd79c6d71645ee39522643de3e8b810f789fc` | **identico** | `509fc0fe29d6afa22f8ac06d640d3e7d97336cf7` | **IDENTICO tra i due predecessori**; differente nel nuovo candidato |
| `src/security/secureVault.ts` | `5c33702975c01fd3d6ac7f0b8b7e53e8410a2d60` | **identico** | `9e588d9e02a62ce5ed7e36a2dc2976dbd9121b26` | **IDENTICO tra i due predecessori** |
| `src/security/vaultTypes.ts` | `7c87bab8152c1661ffc7e443197e0c9946f54196` | **identico** | **identico** | formato di record V1 invariato a livello del file |
| `src/security/cryptoPrimitives.ts` | `2f07db5f1850114c6cd507888071a9e3e3159c59` | **identico** | **identico** | primitive originali identiche a livello del file |
| `src/cryptoUtils.ts` | `1adbb66a08b884580306319363ebc320d4433e57` | **identico** | **identico** | involucro cifrato originale identico a livello del file |
| `src/security/secureAppStorage.ts` | `6c898373771b3155bf8e7755e776fee06f00b65c` | `7e8deaf973cabc5b8fcc22f0890ab3b1dac53b42` | `e3ba4b0c8da679634bb2ed4470ba5fa58f98b0b3` | **DIVERGENTE**: impossibile inferire equivalenza del ripristino |
| `src/security/backupPayload.ts` | `8b2bb33c44ff4336fe395d364f14a2ca50af266a` | `b037fba6569254932812fdc260bccbf721f3d23a` | `b6331476cb167846cc19e44926fe01461f7221a0` | **DIVERGENTE**: prove distinte richieste |

Il `vaultStore.ts` Beta 2 RC2 apre `registro-docente-secure-vault` a `DB_VERSION = 1` (`openDatabase`, linea 72); non ha il codice di migrazione DB2. I test eseguiti con il file **letteralmente identico** di Beta 1 RC3 confermano che quel lettore storico rifiuta l'accesso a DB2. È una **equivalenza del nucleo lettore V1 sul medesimo sorgente**, non la qualifica integrale del prodotto Beta 2 RC2 come eseguibile né di tutte le sue dipendenze e chiamanti.

Il `backupPayload.ts` della Beta 2 RC2 crea una copia `backupDataVersion: 6` (linee 401–415), riconosce esplicitamente solo versioni **V2–V6** (linee 432–492) e rifiuta le altre al ramo `Versione dati backup non supportata` (linea 493). È una **proprietà verificata per ispezione del sorgente esatto**, non una prova browser effettuata contro il bundle completo RC2 per V7. Il controllo precedente con etichetta V7 cifrata su Beta 1 RC2/RC3 non copre automaticamente queste modifiche.

## 3. Copertura reale della matrice M1-B4

| Obiettivo | Evidenza | Stato specifico |
|---|---|---|
| Lettore storico V1 su database DB2 | Chromium con sorgente Beta 1 RC2/RC3, due nuove prove ciascuno; identità Git del nucleo lettore di Beta 2 RC2 con RC3 | **CONFERMATO limitatamente al nucleo lettore V1** |
| Lettore candidato V1 e archivio DB2 | Chromium 192/192, scenari B4/1 164 e 165 | **PASS laboratorio candidato** |
| Assenza database e non-creazione con lettori existing-only | Chromium B4/1 scenario 165/192 | **PASS laboratorio candidato** |
| Backup cifrato con marcatore V7 su Beta 1 RC2/RC3 | Due matrici storiche da 4/4 test ciascuna | **PASS laboratorio predecessori Beta 1**, canary e non V7 canonico |
| Backup V7 canonico nel DB2 nuovo | Matrice V6–V9 e Chromium candidato, compreso ripristino, rifiuto retrocessione, CAS, revoca | **PASS laboratorio candidato nel proprio perimetro** |
| Backup V7 canonico contro **Beta 2 RC2 esatta** | Nel codice RC2 è visibile il rifiuto statico di versioni oltre V6; manca la prova browser con bundle RC2 e payload V7 canonico completo | **NON QUALIFICATO DINAMICAMENTE** |
| Prova cumulativa di downgrade, vecchi APK originali, RC2 sparso | Suite storiche `val01-database-fence.spec.cjs` e `val01-historical-v7-compatibility.spec.cjs` e verifiche native integrali non recuperate integralmente | **PARZIALE / B5 APERTO** |

**Non modificare o ricostruire la procedura di collaudo bloccata R2 #307.** Le nuove prove della PR #385 sono in `tests/browser/val01-s6d-db2-persistence.spec.cjs` e nella suite di compatibilità Beta 1 già presente; nessun flusso di lavoro GitHub Actions è stato alterato per ottenere i risultati.

## 4. Prontezza M1-C: le 12 invarianti STAB-06 non sono state registrate artificialmente

Il registro nel candidato `qualification/invariants.v1.json` contiene ancora **149 invarianti** e **nessuno** dei 12 ID STAB-06 elencati dal dossier M1-B0. Le qualificazioni verdi non autorizzano da sole ad aumentare il numero del registro. Confronto degli alberi Git di #325 e della PR #385:

| ID del dossier B0 | Situazione nel candidato attuale | Decisione M1-C |
|---|---|---|
| `VAL-01-STAB06-I01` | `protectedBootstrap.ts` identico a #325; avvio protetto B1 e prova negativa acquisiti | **COPERTURA PARZIALE DIMOSTRATA**; tracciare esatto test prima del registro |
| `VAL-01-STAB06-I04` | `archivePreflight.ts` identico a #325; `inspectArchiveVersion.ts` storico assente | **PARZIALE**: ricostruire equivalenza funzionale, non copiare il file in automatico |
| `VAL-01-STAB06-I02` | `legacyMigration.ts` e `initialArchiveSetup.ts` identici a #325 | **PARZIALE**: contratto revoca/commit e reale chiamante richiesti |
| `VAL-01-D1B3B-I01` | `authorizedVaultMigration.ts` e `versionFencedVaultStore.ts` identici; Chromium di migrazione B3.4 positivo | **COPERTURA LABORATORIO**; provare superficie chiamante prima dell'uso reale |
| `VAL-01-STAB06-I05` | `migrationRecoveryHandoff.ts` e `migrationSessionBoundary.ts` identici a #325; prove di revoca/CAS positive | **COPERTURA LABORATORIO**; sistema produttivo distinto |
| `VAL-01-STAB06-I06` | `db2Lifecycle.ts` e `db2PhysicalLifecycle.ts` diversi da #325 per V8/V9; prove per V7/V8/V9 positive | **DA CONVERGERE SENZA RETROCEDERE V8/V9** |
| `VAL-01-D1B-I05` | Prove mirate B4/1 e B4/2 positive; `val01-database-fence.spec.cjs` storico assente | **PARZIALE**, intero contratto storico non riqualificato |
| `VAL-01-D1B-I03` | Beta 1 RC2/RC3 positive; Beta 2 RC2 sola equivalenza del lettore V1; test storico V7 integrale assente | **PARZIALE**, V7 canonico su RC2 da eseguire |
| `VAL-01-D1B3C-I01` | Android DB2 API32/36 legacy e V9: 5/5 job PASS, ma non la prova originaria di migrazione APK | **LABORATORIO POSITIVO / PRODOTTO NON QUALIFICATO** |
| `VAL-01-D1B3C-I02` | Workflow integrale APK storici assente; provenienza originale e caso sparso non verificati qui | **NON QUALIFICATO** |
| `VAL-01-STAB06-I03` | Workflow nativo di prodotto storico assente; il pacchetto test `.lab.val01` non è quello installabile | **NON QUALIFICATO SUL PRODOTTO** |
| `VAL-01-STAB06-I07` | Driver `native-process-probe.mjs` e `native-ui-driver.mjs` identici a #325; matrice laboratorio con SHA/API e artefatti | **COPERTURA LABORATORIO**, non estendere ad APK definitivo |

**M1-C:** non sostituire i moduli moderni V8/V9 con versioni precedenti, non integrare automaticamente #325, non introdurre invarianti nominali senza un test causale associato. Recuperare solo prove mancanti e relative decisioni documentate; mantenere **149 invarianti effettivamente registrate** fino a evidenza di equivalenza e criterio di aggiunta. Una futura revisione del registro richiederà una qualificazione esatta del nuovo SHA.

## 5. Decisione tecnica e attività residue

1. **Consolidata la catena di fonte esatta** Beta 2 RC2 → nucleo V1 identico a Beta 1 RC3 → prove di rifiuto DB2; **non qualificata** l'intera compatibilità V7 canonica contro Beta 2 RC2. Non presentare la transizione tra suite come prova eseguibile unica.
2. **B4 da completare:** eseguire l'originale RC2 in un laboratorio autorizzato e isolato con payload V7 canonico e controllo positivo V6, senza cambiare il flusso sospeso R2 e senza passaggi manuali pericolosi.
3. **B5 da completare:** provenienza APK originali, caso RC2 parziale, downgrade e matrice per fonte; preservare le prove API32/API36 già positive. Niente firma e installazione personale.
4. **M1-C avviabile come riconciliazione documentale/contrattuale**, non ancora integrabile in `main`. R1-TEC interna tracciabile e R1-EXT indipendente distinta; R2 ancora sospesa dal servizio, R3 richiesta di decisione del titolare.

**Decisione:** **GO** alla continuità dello sviluppo tecnico e alla tracciabilità; **NO-GO** a promozione, dati reali, rilascio, firma o aggiornamento del dispositivo. Questo documento contiene conclusioni di *confronto sorgente*, non una revisione specialistica indipendente.
