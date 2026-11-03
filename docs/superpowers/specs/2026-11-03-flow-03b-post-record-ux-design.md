# FLOW-03B — Post-Record UX Design

## Intent

FLOW-03B rifinisce il comportamento percepito del **Registro Docente** dopo l’integrazione di FLOW-03, senza cambiare l’architettura di `Registra`, le superfici autorevoli o l’autorità di persistenza.

Baseline canonica: `main@c56ae67693b773b093e51f131053ce1c205a9508` (merge PR #110).

Principio UX:

> Durante un’azione professionale iniziata, l’interfaccia riduce il rumore delle possibilità concorrenti e mantiene visibile la missione corrente; le superfici autorevoli restano uniche e non vengono duplicate.

## Goals

1. Separare la conferma dell’azione professionale dalla manutenzione del backup locale.
2. Ridurre la prominenza della Panoramica Sezione mentre `Registra` è in stato attivo, soprattutto su mobile.
3. Evitare che il trigger flottante del Copilota copra campi o comandi durante una registrazione focalizzata, mantenendo comunque accesso al Copilota.
4. Rendere `Rivedi` contestuale al tipo di evidenza appena registrata, senza automatizzare decisioni professionali.

## Non-goals

- nessun nuovo modulo di valutazione, comportamento, UDA o verifiche online;
- nessuna nuova entità persistente per FLOW-03B;
- nessuna scrittura automatica;
- nessun cambiamento all’autorità PERSIST-01H;
- nessuna riapertura del contratto FLOW-03 già integrato;
- nessuna modifica a Docente OS;
- nessuna anticipazione di FLOW-04 oltre alla sola gerarchia contestuale del post-registrazione.

## Approaches considered

### A — Rifinitura contestuale sulle superfici esistenti — scelta

Usare piccoli resolver puri e prop contestuali sulle superfici già esistenti: policy backup, stato compatto della panoramica, accesso Copilota inline durante `Registra`, ordinamento contestuale di `Rivedi`.

**Vantaggi:** delta piccolo, testabile, nessuna duplicazione di persistenza o moduli, coerente con UX-GOV-01.

### B — Nuova shell dedicata post-Registra — scartata

Creare un contenitore autonomo per conferme, panoramica, Copilota e review.

**Motivo dello scarto:** duplichererebbe responsabilità già distribuite tra Dashboard, RecordLessonPanel, RecordMissionBanner e superfici specialistiche.

### C — Solo CSS / responsive tuning — scartata

Intervenire esclusivamente su layout e z-index.

**Motivo dello scarto:** non risolve M1 (policy backup) né M3 (routing contestuale di `Rivedi`).

## M1 — Conferma professionale vs backup locale

### Current state

`commitAppDataMutation()` apre il `BackupReminderModal` per default a ogni mutazione che non passa esplicitamente `showBackupModal: false`. Il modal comunica insieme successo professionale e manutenzione del deposito locale.

### Design

- La conferma professionale resta affidata al feedback del flusso (`Registrazione completata`) e ai toast già previsti dalle superfici.
- `showBackupModal: true` continua a forzare il modal quando un caller lo richiede esplicitamente.
- `showBackupModal: false` continua a disabilitarlo.
- Se `showBackupModal` è `undefined`, il modal segue una **policy di attenzione** invece di comparire sempre.
- La policy usa il contatore durevole già esistente `SecureMeta.changes`: propone il backup solo quando la mutazione attraversa un nuovo checkpoint di **10 modifiche durevoli** dall’ultimo backup (`10, 20, 30, ...`). Il backup azzera `changes`, quindi il ciclo ricomincia naturalmente.
- La policy è pura e non modifica `lastBackup`, receipt o semantica di `prepareBackupCheckpoint/applyBackupReceipt`.

Razionale: il checkpoint ogni 10 modifiche è semplice, deterministico, non temporale e impedisce l’interruzione a ogni salvataggio mantenendo un richiamo periodico concreto.

## M2 — Focus dell’azione attiva e Copilota

### Panoramica Sezione

Quando `todayAction === 'record'` e `recordSession.status === 'editing'`:

- `RecordLessonPanel` resta il contenuto prioritario;
- la Panoramica Sezione viene resa come disclosure **chiusa di default** con un summary compatto;
- il docente può espanderla volontariamente senza perdere il contesto;
- quando la sessione diventa `saved` o `Registra` non è attivo, la Panoramica torna pienamente visibile.

Non vengono duplicati KPI o scorciatoie: cambia soltanto la prominenza.

### Copilota

Il pattern di FLOW-02 viene esteso a FLOW-03:

- mentre `todayAction === 'record'`, il trigger flottante globale del Copilota non viene mostrato;
- `RecordLessonPanel` espone un comando inline `Copilota`;
- durante l’handoff su una superficie specialistica, `RecordMissionBanner` espone lo stesso comando inline accanto a `Torna a Registra`;
- il comando usa il Copilota contestuale esistente e non crea un secondo composer.

Questo elimina la sovrapposizione mobile senza togliere disponibilità al Copilota.

## M3 — Rivedi contestuale

### State boundary

Quando una registrazione passa a `saved`, il tipo di evidenza appena registrata viene conservato solo come **stato di navigazione session-only** per il passaggio a `Rivedi`. Non viene persistito e non diventa autorità professionale.

### Ordering

Il resolver di review ordina le destinazioni esistenti come segue:

- `evaluation` → **Tabellone**, Analisi, Storico, Scheda alunno;
- `online-outcomes` → **Tabellone**, Storico, Analisi, Scheda alunno;
- `behaviour` → **Scheda alunno**, Comportamento, Analisi, Tabellone;
- `lesson-log` → **UDA e diario**, Tabellone, Analisi, Storico;
- nessun evidence kind → ordine generico preesistente.

La prima voce è soltanto **raccomandata/ordinata per prima**: non viene aperta automaticamente.

### Copy

Il pannello `Rivedi` espone una breve motivazione contestuale, per esempio `Prima destinazione consigliata dopo una valutazione: Tabellone`, senza formulazioni prescrittive.

## Accessibility and mobile

- touch target minimo 44 px;
- nessun controllo fisso deve coprire textarea, pulsanti o disclosure nel viewport 390×844;
- le disclosure usano elementi semantici accessibili (`details/summary`) o equivalenti con `aria-expanded`;
- il comando Copilota inline deve essere raggiungibile da tastiera e distinguibile da `Torna a Registra`;
- nessuna regressione del Privacy Shield o dei journey FLOW-03.

## Contract boundaries

- FLOW-03 resta l’unico orchestratore di registrazione;
- le mutazioni durevoli restano nelle superfici autorevoli esistenti;
- la policy backup osserva metadata già esistenti e non modifica la transazione professionale;
- il tipo di evidenza usato da `Rivedi` è session-only;
- la navigazione ordinaria continua a invalidare una missione `Registra` quando previsto dal contratto integrato;
- nessuna nuova persistenza per UI state o Copilota.

## Qualification

FLOW-03B richiede:

1. RED → GREEN per M1, M2 e M3;
2. regressione completa dei contratti FLOW-03;
3. Qualification Invariants PASS;
4. PREDEPLOY PASS;
5. Browser Qualification desktop + mobile 390×844, con prova di non sovrapposizione del Copilota;
6. Final Independent Review sull’exact SHA;
7. Human Product/UX Review comparativa;
8. nessun merge o deploy senza autorizzazione esplicita separata.
