# VAL-01/PRODUCT-05 — Fonte del bilancio formativo nella Scheda alunno

Data: 21 novembre 2026. Origine: ripresa del piano Registro Docente dopo il rinvio di GOV-MAIN-01, conversazione «Ok procedi» (URL della chat da acquisire).
Issue autorevoli: #104, #210, #231. Base esatta: PR #389 / PRODUCT-04, SHA `167300de3be430d73ae3bca6a2646049662e7faf`, 10/10 workflow applicabili conclusi SUCCESS.
Ramo isolato: `feat/val01-product05-s7-sources`. Destinazione PR: `feat/val01-product04-planned-assessment-lifecycle`, non main.

## Ricognizione e scelta di riuso

S7a (`formativeBalance.ts`) è già un motore deterministico qualificato per verifica del contesto, selezione esplicita e confronto di revisioni; S7b (`formativeRestitutionProjection.ts` e prova Chromium sintetica) realizza un'anteprima minimizzata e conferma in memoria, senza attivazione nella Root di prodotto. S8 e documentazione DOC-01 hanno già contratti isolati. Non clonare il motore né promuovere la conferma in-sessione a salvataggio durevole.

Il vero incremento mancante è un passaggio prudente dal grafo confermato delle evidenze a un punto di consultazione del docente nella **Scheda alunno reale**. Come PRODUCT-05/1 si aggiunge solo ricognizione consultiva delle fonti già confermate.

## PRODUCT-05/1 — Perimetro

- La vista Dossier presenta una sola disclosure compatta «Fonti per il bilancio formativo». Il docente indica periodo Q1/Q2 e **date effettive**; non si deducono date istituzionali da Q1/Q2.
- Nuovo modello di lettura `studentFormativeSourceReadModel.ts`: approvazione indipendente di classe, anno e disciplina configurati; verifica dell'archivio V1 già presente; proiezione delle teste individuali attive e confermate; filtro per periodo della prova e data dell'osservazione.
- In interfaccia soltanto data, prova, criterio e stato osservato/non osservato/non pertinente, con conteggi e copertura indeterminata. Niente fatti grezzi, descrizioni di prodotti, rubriche, identità interne o altri alunni.
- Nessuna fonte è selezionata automaticamente per un bilancio; zero generazione di testo, livelli/giudizi, modifiche di voto o comportamento. La protezione dei nominativi è prerequisito della lettura.
- Nessun Vault nuovo, migrazione, chiave, salvataggio, backup, AI, rete, PDF, stampa, firma, distribuzione o pubblicazione. Il Dossier esistente conserva la sua navigazione.

## Qualificazione e fasi successive

- Contratti mirati: destinatario, contesto, periodi/date, archivio assente, stati distinti, revisione ritirata, dati corrotti, assenza di leak con protezione inattiva e nessuna inferenza da voti.
- CI-FAST-01 per la PR accatastata non diretta a main, con rapporto esplicito NOT_FULL_QUALIFICATION; accettazione completa solo su candidato finale secondo i rischi, senza trasferire PASS a SHA diversi.
- PRODUCT-05/2: collegamento alla selezione **esplicita** delle fonti e al motore S7a, anteprima protetta S7b e conferma distinta; progettare un contratto **durevole** che conservi revisioni e invalidazioni nel Vault prima di parlare di bilancio salvato.
- PRODUCT-05/3: solo dopo approvazione docente, raccordo con restituzione, Consigli e DOC-01; documenti ufficiali e HPR separati.

Vincoli: nessuna modifica a main e GOV-MAIN-01; PR #393 in bozza. Nessuna distribuzione, firma o uso di dati reali. R1/R2/R3 restano distinti dallo sviluppo. L'esito della qualifica va registrato sul commit esatto, non presunto.
