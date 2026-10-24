# LIB-01B — Contextual Core integration implementation plan

> **For agentic workers:** use the repository memory protocol, TDD, exact-SHA qualification and branch-before-write rules for every implementation step.

**Goal:** collegare la Biblioteca privata al TRAMA Contextual Copilot Core senza introdurre un resolver specifico di Registro Docente, mantenendo progressive disclosure, privacy-first e authority verticale sulle mutazioni.

**Baseline Registro:** `main@81513d7e74f11346f770d6f1fc4f5870142425b9`  
**Core canonical source:** `antoniocorsano-boop/trama-ecosistema@4de1de1daf2a68ebee4d52b0140420b45ae1ef3e`  
**Distribution contract integrated:** `antoniocorsano-boop/trama-ecosistema@85a01142d90c30da9b4fbbc339a92d1457bb04b3`  
**Package:** `@trama/contextual-copilot-core@0.1.0`

## Architecture

Il consumer mantiene uno snapshot vendorizzato verificabile del package in `vendor/contextual-copilot-core/`, identico ai quattro file dichiarati dal manifesto TRAMA. Il root package lo consuma tramite dipendenza locale `file:`. Un file di provenienza separato lega il vendor snapshot a package/version, source commit, distribution commit e SHA-256.

L'integrazione applicativa è un adapter sottile:

`LibrarySource -> ContextSnapshot -> shared Core -> resolved action -> vertical executor`

Il Core non riceve il payload testuale/immagine della fonte per la semplice risoluzione delle azioni. Riceve soltanto identificatore e metadati minimi necessari. Il primo incremento usa `generativeMode = none`: nessun provider esterno, nessun invio di contenuti e nessuna trasformazione generativa.

## ContextSnapshot LIB-01B

- `appId = registro-docente`;
- `surface = LIBRARY_SOURCE`;
- entity principale: `type = library-source`, `id = source.id`, con soli `kind`, `status`, `privacy`, `linkCount`;
- capability dichiarate: `REVIEW`, `LINK`, `PREPARE`, `SUMMARIZE`;
- permissions limitate a lettura/proposta/collegamento biblioteca;
- `remoteProviderAllowed = false`;
- `teacher-professional -> TEACHER_PROFESSIONAL`;
- `student-personal -> STUDENT_PERSONAL`;
- `unknown -> STUDENT_PERSONAL` fail-closed finché il docente non classifica la fonte.

## Action registry v1

- `review-source` → `REVIEW`, `PROPOSE`, non generativa;
- `link-source-to-uda` → `LINK`, `WRITE_REVERSIBLE`, non generativa;
- `prepare-from-source` → `PREPARE`, `PROPOSE`, generativa;
- `summarize-source` → `SUMMARIZE`, `PROPOSE`, generativa.

Con `generativeMode = none`, il Core deve restituire soltanto le azioni non generative. `PREPARE` e `SUMMARIZE` restano nel registry come estensione futura ma non vengono presentate come funzioni disponibili.

## UX / progressive disclosure

Prima di `Usa` non appare alcun pannello avanzato. Dopo `Usa`, la card selezionata mostra il prompt `Che cosa vuoi farne?` e soltanto le azioni risolte dal Core.

`Rivedi nel contesto` apre localmente una sintesi minima della fonte e dei collegamenti correnti. `Collega a una UDA` rivela il selettore UDA; la mutazione deve attraversare `core.dispatch`. Il primo dispatch senza conferma deve restituire `HUMAN_CONFIRMATION_REQUIRED`; solo dopo conferma esplicita del docente il secondo dispatch può invocare `onLinkSource`.

La fonte originaria non viene modificata dalla semplice selezione o dalla review contestuale.

## Task 1 — RED: vendor + adapter contract

**Create:** `src/security/lib01bContextualCoreContract.test.ts`

Il RED deve richiedere:
- vendor provenance e quattro file Core esatti;
- dipendenza root `@trama/contextual-copilot-core` via `file:`;
- adapter `src/library/contextualCoreAdapter.ts`;
- ContextSnapshot minimizzato/privacy fail-closed;
- stesso package condiviso, nessun resolver locale sostitutivo;
- azioni generative non risolte in modalità `none`;
- `LINK` non eseguito senza conferma umana.

Validare il RED in Product CI sul test-only exact SHA.

## Task 2 — GREEN: vendor snapshot e dependency lock

**Create:**
- `vendor/contextual-copilot-core/README.md`
- `vendor/contextual-copilot-core/index.d.ts`
- `vendor/contextual-copilot-core/package.json`
- `vendor/contextual-copilot-core/src/index.js`
- `vendor/contextual-copilot-core.provenance.json`

**Modify:** `package.json`, `bun.lock`.

Il vendor snapshot deve coincidere byte-per-byte con il manifesto TRAMA. `bun install --frozen-lockfile` deve passare senza aggiornare il lock.

## Task 3 — GREEN: thin Library adapter

**Create:** `src/library/contextualCoreAdapter.ts`.

Implementare solo costruzione contesto, registry e Core instance. Vietati branching su `appId`, duplicazione di policy/capability engine e accesso a provider.

## Task 4 — UI progressive disclosure

**Modify:** `src/components/LibrarySourceCard.tsx` e, solo se necessario, `src/components/LibraryView.tsx`.

Mostrare le azioni risolte solo dopo `Usa`. La review è locale/non mutativa. Il collegamento a UDA passa dal dispatch governato e dalla conferma umana. Le funzioni generative non disponibili non vanno mostrate come attive.

## Task 5 — qualification

Sul candidato esatto:
- `bun install --frozen-lockfile`;
- Product CI completo;
- typecheck/build/startup smoke;
- Browser Qualification con dati esclusivamente sintetici;
- verifica mobile + desktop della progressive disclosure e del gate umano;
- review finale del diff;
- nessun merge/deploy implicito.

## Exit criteria

LIB-01B è ENGINEERING QUALIFIED quando vendor/provenienza, Core adapter, Product CI e Browser Qualification sono tutti PASS sullo stesso exact SHA e non esiste alcun resolver sostitutivo locale. L'integrazione in `main` resta una decisione separata dopo la qualifica.
