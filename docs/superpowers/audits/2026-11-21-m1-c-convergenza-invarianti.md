# Registro Docente — M1-C: convergenza delle invarianti di sicurezza Web/Android

**Data:** 21 novembre 2026. **Stato:** M1-C/1 avviata; riconciliazione parziale con revisione dei controlli sul nuovo SHA ancora obbligatoria.
**Unico ramo tecnico:** [PR #385](https://github.com/antoniocorsano-boop/registro-docente/pull/385), `feat/m1-security-reconciliation`, in bozza e non integrata.
**Base esatta già qualificata:** `a2d8fa8107ba8a53ab8b0eb84dbe0ec9f71df1d5` — 8/8 procedure concluse PASS.
**Riferimento storico congelato:** PR #325, `6063fc0ff2809584c266b3161dafea9ffba92a8d`.
**Fonti:** [dossier M1-B4/3](2026-11-21-m1-b4-rc2-e-m1-c-raccordo.md); [programma M1 in PR #384](https://github.com/antoniocorsano-boop/registro-docente/pull/384); [governo #104](https://github.com/antoniocorsano-boop/registro-docente/issues/104).

## 1. Risultato di questo incremento
Il codice applicativo già integrato nel ramo dispone del coordinatore `createProtectedBootstrap`, dell'osservazione IndexedDB existing-only e del chiamante effettivo `SecureRegistroRoot.inspectBootstrap`. La prova causale `src/security/m1BootstrapAdmission.test.ts`, `src/security/protectedBootstrap.test.ts` e gli scenari **M1-B1** nel browser `tests/browser/qualification-invariant-smoke.spec.cjs` verificano il rifiuto di avvio distruttivo, l'assenza di creazione nella sola ispezione e la conservazione di dieci record cifrati dopo perdita sintetica dei metadati. Sono prove già qualificate sul candidato base, non dichiarazioni di rilascio.

**Decisione M1-C/1:** riprendere l'ID storico `VAL-01-STAB06-I01` con il suo enunciato originario e con percorsi di prova *esistenti sul candidato moderno*. L'ID non viene reinterpretato come permesso di distribuire o usare archivi reali. Il registro passa da 149 a **150 voci proposte**, da qualificare tutte sul commit risultante. Nessuna delle altre undici voci storiche viene inserita a scopo numerico.

## 2. Matrice puntuale delle dodici invarianti
| Invariante originaria | Stato M1-C | Evidenza o lacuna decisiva | Prossimo requisito |
|---|---|---|---|
| `VAL-01-STAB06-I01` | **REINTEGRATA NEL REGISTRO / CI DEL NUOVO SHA DA VERIFICARE** | Coordinatore, Root, unità e due prove browser M1-B1 con dati sintetici | Controllare build e invarianti sul nuovo commit |
| `VAL-01-STAB06-I04` | PARZIALE | Preflight existing-only isolato; versione fisica e consenso distinti; originale `inspectArchiveVersion.ts` assente | Qualificare intera superficie di ammissione, senza creare archivi |
| `VAL-01-STAB06-I02` | PARZIALE | `legacyMigration` / `initialArchiveSetup` e autorizzazione revocabile nel Root; test interruzione B2 | Confrontare il contratto originario al chiamante e al commit irreversibile |
| `VAL-01-D1B3B-I01` | LABORATORIO POSITIVO | Migrazione DB1, copia V6, CAS e scenari Chromium B3.4 | Dimostrare collegamento al proprietario reale prima dell'attivazione |
| `VAL-01-STAB06-I05` | LABORATORIO POSITIVO | Handoff monouso, sigillo coda e revoca; `m1SupervisedMigrationHandoff` senza chiamante di prodotto | Superficie reale, autorità e ripartenza dopo interruzione |
| `VAL-01-STAB06-I06` | LABORATORIO POSITIVO / V8-V9 DA PRESERVARE | DB2 moderno differente da #325, prove CAS e riapertura isolate | Qualificare proprietario prodotto senza retrocedere V8/V9 |
| `VAL-01-D1B-I05` | PARZIALE | Browser candidato e Beta1 RC2/RC3 qualificati; suite storica cumulativa assente | Fence completo, inclusi richieste bloccate/abbandonate e vecchi client |
| `VAL-01-D1B-I03` | PARZIALE | Decoder originale Beta2 RC2 testato dinamicamente contro V6 e V7 canonico in Bun; non è un APK né prova IndexedDB di ripristino | Reintegrare perimetro compatibilità fisica originale solo con sorgenti esatti |
| `VAL-01-D1B3C-I01` | LABORATORIO ANDROID POSITIVO | API 32/36 legacy e V9; mancano equivalenza APK e processo di migrazione originale | Prove native mirate e provenienza binari |
| `VAL-01-D1B3C-I02` | NON QUALIFICATA SUL PRODOTTO | Nessuna attestazione completa degli APK originali e del caso archivio RC2 sparso | M1-B5, fonte esatta e rifiuto con inventario conservato |
| `VAL-01-STAB06-I03` | NON QUALIFICATA SUL PRODOTTO | Pacchetto nativo sperimentale non equivale a pacchetto firmabile/distribuibile | Qualificazione fonte e pacchetto reale, distinta dalla CI |
| `VAL-01-STAB06-I07` | LABORATORIO POSITIVO | Driver e process probe storici presenti, non prova di rilascio | Attribuire esattamente APK, driver e API alla prova |

## 3. Criteri di ammissione ai passi successivi
1. Dopo il commit della prima invariante, interrogare **sullo SHA nuovo** qualificazione invarianti, controlli sicurezza, browser, Android API32/36, compatibilità storica, PREDEPLOY, FLOW e HEADER; nessun PASS per trascinamento.
2. Per le altre undici invarianti servono equivalenza dimostrata o test causale specifico, con l'originario enunciato e con espliciti limiti di laboratorio. Non aumentare il registro se mancano.
3. Il ramo #385 è già il **candidato unico di riconciliazione**. Non sostituire `db2Lifecycle` moderno con il modulo storico e non collegare automaticamente `m1SupervisedMigrationHandoff` al Root di produzione.
4. M1-B5 — provenienza APK e prove native originali — resta una dipendenza distinta: non reinterpretare gli attuali PASS API 32/36 come suo completamento.
5. R1-TEC interna non è R1-EXT indipendente. R2 [#307](https://github.com/antoniocorsano-boop/registro-docente/issues/307) rimane sospeso; R3 [#326](https://github.com/antoniocorsano-boop/registro-docente/issues/326) richiede decisione finale umana. Nessuna modifica al flusso sospeso per aggirare un blocco.

**Perimetro della presente operazione:** solo documentazione del raccordo e registro di qualificazione; nessuna modifica a codice di produzione, cifratura, workflow, backup, dati professionali, APK, firma, dispositivo o pubblicazione. Prove esclusivamente sintetiche. Stato complessivo: **M1-C APERTA / INTEGRAZIONE E RILASCIO NO-GO**.
