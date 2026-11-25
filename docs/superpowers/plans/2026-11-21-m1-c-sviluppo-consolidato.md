# Registro Docente — M1-C: sviluppo consolidato delle invarianti residue

**Data della decisione:** 21 novembre 2026.
**Fonte della decisione:** indicazione esplicita del committente, nella conversazione Registro Docente del 21 novembre: completare un solo ciclo tecnico di riconciliazione, senza porre R1, R2 e R3 come condizioni preliminari allo sviluppo.
**Candidato tecnico:** [PR #385](https://github.com/antoniocorsano-boop/registro-docente/pull/385), ramo `feat/m1-security-reconciliation`.
**Baseline verificata:** M1-C/3 `76fdb2b92e55ac9345cb709f550fc11c951523e3` — 8/8 procedure GitHub Actions PASS.
**Fonte storica congelata:** PR #325, `6063fc0ff2809584c266b3161dafea9ffba92a8d`.
**Tracciato analitico:** [matrice M1-C](../audits/2026-11-21-m1-c-convergenza-invarianti.md).

## 1. Nuova separazione delle responsabilità

### Fase SVILUPPO (ATTIVA, senza dipendenza da R1/R2/R3)
Sono consentite, senza attendere autorizzazioni di distribuzione:
- implementazioni, correzioni, rifattorizzazioni e integrazione progressiva delle funzioni Web e Android;
- prove sintetiche, test unitari, prove browser, emulatori e qualificazione regressiva dei commit;
- modifiche ai rami di sviluppo, revisione del codice e preparazione dei candidati;
- decisioni di equivalenza motivate e ricostruzione delle invarianti tecnicamente dimostrabili;
- progettazione delle interfacce e collaudo in ambienti di sviluppo isolati.

Le **barriere di sicurezza intrinseche** non sono derogabili: nessuna sovrascrittura non autorizzata, nessuna cancellazione automatica, revoca e autenticazione effettive, conservazione del cifrato, prove causali per cambiamenti rischiosi, assenza di dati reali nelle fixture. Le funzioni V8/V9 di DOC-01 già disponibili non vanno retrocesse. Un esito di laboratorio non equivale a funzionalità completa del prodotto.

### Fase ACCETTAZIONE / DISTRIBUZIONE (SUCCESSIVA, non bloccante per lo sviluppo)
- **R1:** revisione indipendente su candidato destinato all'accettazione.
- **R2:** prova nativa di prodotto e gestione ufficiale della procedura S-R04b sospesa; non modificarla o eluderla per dichiarare il caso superato.
- **R3:** identificazione e firma del pacchetto, aggiornamento in posizione, eventuale distribuzione/pubblicazione e decisione esplicita del committente.

R1/R2/R3 **non costituiscono autorizzazioni da ottenere a ogni commit o per proseguire a sviluppare**. Diventano requisiti quando si pretende una promozione ad ambiente di utilizzo reale o una distribuzione pubblica; restano distinti dall'integrazione tecnica in un ambiente di sviluppo. Non si afferma che siano già stati soddisfatti.

## 2. Un solo ciclo M1-C, non uno per invariante

1. Congelare solo come riferimento la baseline M1-C/3 già verificata; lavorare sulla PR #385 senza aprire ulteriori filoni paralleli.
2. Verificare tutte le nove invarianti residue; classificare equivalenza, necessità di test o differenza storica non dimostrabile.
3. Applicare nello stesso incremento le prove e le modifiche effettivamente giustificate. Non creare righe di registro per raggiungere un numero.
4. Usare verifiche mirate mentre si modifica. I controlli automatici eventualmente avviati dai singoli push non costituiscono nove cerimonie distinte: **la qualificazione finale deve riferirsi al solo SHA di chiusura**.
5. Consolidare la matrice, documentare tutte le decisioni e riprendere lo sviluppo funzionale su un codice stabile, senza attendere R1/R2/R3.
6. Quando sarà decisa l'accettazione del prodotto, avviare separatamente la filiera R1/R2/R3 con il suo pacchetto esatto.

## 3. Matrice di lavoro delle nove invarianti residue alla baseline M1-C/3

| ID storico | Stato di sviluppo al checkpoint consolidato | Evidenza e confine |
|---|---|---|
| `VAL-01-STAB06-I04` | **Reintegrata nel candidato, qualifica CI da verificare** | Ispezione DB1 read-only, sessione existing-only v1/v2 e nuova prova browser di assenza/versione, password errata e preservazione dei 10 record. Non conferisce consenso di migrazione. |
| `VAL-01-D1B3B-I01` | **Reintegrata nel candidato, qualifica CI da verificare** | Motore DB1→DB2 con controllo dei 10 record, copia V6 e consenso monouso, tre nuove prove browser di copia non valida, revoca e modifica di ciphertext. Rimane *isolato* senza chiamante del prodotto. |
| `VAL-01-STAB06-I06` | **Da completare, non attestata** | CAS DB2 e versioni V8/V9 dimostrate in laboratorio; dimostrare che il servizio utilizzato dal proprietario richieda sempre autorizzazione corrente, senza sostituire la logica moderna. |
| `VAL-01-D1B-I05` | **Parziale, non attestata** | Barriera v1→v2 e rifiuto legacy provati con lettore attuale; mancano il lettore storico esatto e tutti i casi di richiesta bloccata/tardiva. |
| `VAL-01-D1B-I03` | **Parziale, non attestata** | Compatibilità Beta2 RC2/V6/V7 verificata in parti isolate; mancano la catena browser delle tre versioni storiche esatte e il confronto fisico di ripristino. |
| `VAL-01-D1B3C-I01` | **Laboratorio Android parziale, non attestata** | API 32/36 V9 e legacy verdi sul laboratorio attuale, non è l'intero percorso di migrazione con downgrade/reupgrade e file fisico storico originale. |
| `VAL-01-D1B3C-I02` | **Provenienza non acquisita** | Manca la catena verificata degli APK originali, inclusa RC2 sparsa e firma/manifest; non sostituire con APK costruiti oggi. Questo non blocca lo sviluppo indipendente. |
| `VAL-01-STAB06-I03` | **Qualificazione nativa di prodotto non eseguita** | Il laboratorio non attesta l'identità e la provenienza di un pacchetto realmente distribuibile. Da verificare nell'accettazione; sviluppo libero. |
| `VAL-01-STAB06-I07` | **Evidenza di driver isolata** | Prove di processo/driver non attestano originalità APK né accettazione fisica del prodotto; conservare identità esatta e distinguere laboratori da rilascio. |

**Conteggi di registrazione del candidato:** 152 invarianti verificate sullo SHA M1-C/3; 2 nuove iscrizioni candidate portano il registro a **154**, senza modificare le precedenti 152. Le sette voci non reintegrate restano visibili in questa matrice: non sono automaticamente difetti bloccanti per ogni altra funzione in sviluppo.

## 4. Prove e criteri tecnici del blocco DB1 (S01–S08)

Le tre nuove prove Chromium nell'origine sintetica di `tests/browser/val01-s6d-db2-persistence.spec.cjs` richiamano `m1CConsolidatedDb1Guards`:
- osservazione preliminare su database inesistente: nessuna creazione;
- classificazione dell'archivio DB1 completo con password corretta, rifiuto password errata e rifiuto di un lettore existing-only sulla versione incompatibile;
- con **copia V6 non valida**, nessuna preparazione autorizzata e record intatti;
- con **autorizzazione revocata**, grant inutilizzabile e record intatti;
- con **cifrato modificato dopo la preparazione**, confronto fisico negativo e nessuna promozione DB1→DB2, conservando il valore effettivamente scritto dal client sintetico concorrente.

Tutti i casi richiedono 10 record cifrati presenti e permanenza alla versione DB1 in caso di rifiuto. La prova positiva completa con consenso e nuova sessione è già coperta da `M1-B3.4` nello stesso file. I nuovi test devono essere osservati **PASS sul candidato finale**, non dedotti dal codice.

## 5. Regole della successiva lavorazione

- Se la qualificazione del candidato fallisce, correggere il difetto nel *medesimo ciclo* e conservare la prova negativa. Non cambiare l'enunciato storico per ottenere un verde.
- Se un'invariante dipende da un APK storico o da una procedura sospesa, documentare la dipendenza ma continuare le funzioni indipendenti.
- Nessuna prova sintetica usa archivi personali degli studenti o del docente.
- Nessuna pubblicazione, firma, installazione su telefono o aggiornamento pubblico discende automaticamente dal risultato delle prove.
- Registrare su GitHub e Drive: file, prove, commit, SHA finale, classi d'evidenza, limiti e collegamento alla chat quando disponibile.

**Decisione di governo:** **SVILUPPO AUTORIZZATO A PROSEGUIRE** senza R1/R2/R3; **ACCETTAZIONE/DISTRIBUZIONE NON ANCORA AUTORIZZATE**. Questo documento aggiorna la sequenza pratica dei lavori M1, senza riscrivere retroattivamente gli esiti storici della PR #384.
