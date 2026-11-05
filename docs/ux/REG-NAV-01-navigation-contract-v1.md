# REG-NAV-01 — Contratto di navigazione professionale v1

**Stato:** specifica di implementazione candidata, non integrata.  
**Ambito:** Registro Docente; governa i percorsi di ogni superficie senza sostituirne l'autorità sui dati.  
**Origine:** UX-GOV-01 v1, tracker #104; riscontri Android INT-01 #115/#116 (HPR REWORK).  
**Baseline tecnica:** `main@0488cd50287ef26883f395e2b79ab1fcba11ccdc`. Nessuna modifica a dati, archivio cifrato o servizio ordinario.

## 1. Regola per il docente

> Indietro ritorna alla schermata precedente. Torna alla classe apre il contesto professionale corrente. Continua raggiunge la successiva attività esplicitamente proposta. Oggi apre il punto di lavoro generale, non simula Indietro.

Le destinazioni principali e i sotto-percorsi devono avere lo stesso comportamento in Chrome desktop, Chrome Android e in una futura PWA installata. Le scorciatoie contestuali sono additive: non alterano la cronologia.

## 2. Modello e fonte autorevole

Ogni transizione registra una `NavigationEntryV1` composta da:
- `surface`: destinazione tipizzata (`ActiveTab`);
- `classId`: riferimento alla classe autorizzata nella sessione, oppure `null`;
- `origin`: riferimento verificabile all'ingresso interno precedente, se presente;
- `entryId`, `epoch`, `position`: identità e progressione coerente della cronologia dell'app;
- `returnState`: eventuali filtri, selezioni e scroll **solo in memoria della sessione sbloccata**;
- `purpose`: esplorazione, modifica, registrazione, revisione, accesso contestuale.

**Autorità unica:** la vista React, la cronologia del navigatore e l'indirizzo rappresentano la stessa transizione. Nessuna funzione di apertura di una superficie deve chiamare direttamente `setActiveTab` senza passare dal gestore semantico. Sono ammesse modifiche dello stato interno di un pannello che non costituiscano una nuova schermata.

La guardia del vault prevale: dopo blocco/riapertura si entra nella Home neutra, senza ripristino automatico di una classe o di dati personali. Le informazioni di studenti, voti, credenziali, bozze e contenuti UDA non sono mai parte dell'indirizzo o della diagnostica.

## 3. Operazioni di navigazione

| Comando | Esempio | Contratto |
|---|---|---|
| `PUSH` | Classe → Analisi; Analisi → Scheda alunno | Aggiunge esattamente un passo significativo; Indietro torna all'origine e alla stessa classe |
| `POP` | Indietro/Avanti browser o gesto Android | Consuma una voce interna verificata; non inventa destinazioni quando la cronologia non è identificabile |
| `REPLACE` | Conclusione di editor che non deve riaprirsi al Back | Sostituisce la voce corrente con esito esplicito, senza duplicare il salvataggio |
| `GO_TO_CONTEXT` | Torna alla classe 3ª A | Scorciatoia esplicita al contesto; non finge di essere Back |
| `GO_TO_HOME` | Oggi | Accesso esplicito alla radice neutra e azzeramento del contesto classe |
| `DISMISS` | Chiudi pannello/dialogo | Chiude il livello temporaneo prima di attraversare la cronologia; ripristina il focus |

Per un ingresso diretto senza predecessore interno verificato, mostrare «Torna alla classe» o «Oggi»: mai un `history.go(-1)` cieco. Se una destinazione non è più autorizzata, fallire in sicurezza verso una schermata neutra, con feedback.

## 4. Modifiche non salvate: transazione immutabile

Il gestore riceve una sola richiesta `{ origin, target, action, revision }`. Se è presente una bozza:
1. sospende la transizione senza modificare URL, vista, classe o bozza;
2. espone **origine e destinazione effettiva** nel dialogo; i pulsanti nominano la destinazione;
3. «Rimani» annulla senza mutazioni, «Salva e apri...» procede dopo persistenza confermata, «Esci senza salvare e apri...» scarta solo le modifiche volatili e apre la destinazione esatta;
4. una richiesta concorrente del navigatore invalida la conferma precedentemente proposta: **non sostituisce in silenzio il callback**. Serve un nuovo consenso aggiornato;
5. un doppio tocco non produce più di una transizione né due scritture.

Usare un blocco di navigazione in-app che non dipenda esclusivamente da `beforeunload`, non affidabile su mobile. I modali rispettano focus e accessibilità; le schermate rimangono consultabili al termine della scelta.

## 5. Continuità professionale

- Il ritorno preserva la classe e, dove autorizzato, UDA/lezione selezionata, filtri di ricerca, vista, scroll e focus. Solo dati di interfaccia temporanei; nessun contenuto sensibile persistito nella cronologia.
- Dopo Salva, Registra e Rivedi, l'azione primaria può proporre «Continua», ma non forza un passaggio né esegue una nuova scrittura quando il docente preme Indietro.
- La distinzione `Indietro` / `Oggi` / `Torna alla classe` deve essere comunicata anche nelle icone e nei testi della navigazione mobile.
- Gli strumenti flottanti non devono sovrapporsi ai comandi di ritorno, ai campi o alla navigazione inferiore.

## 6. Qualificazione e criteri di uscita

La linea si divide in incrementi qualificati:
- **NAV-S1:** Storico → Nuova/Modifica valutazione → Indietro; Analisi/Tabellone → Scheda alunno → Indietro. URL, `history.state`, vista e classe devono concordare.
- **NAV-S2:** registrazione/completamento di un'attività; ritorno contestuale e riscrittura coerente della cronologia dopo salvataggio.
- **NAV-S3:** Programmazione dirty → UDA → Lezione; Back/Forward concorrente; test di destinazione confermata, collegati a INT-01.
- **NAV-S4:** overlay, navigazione mobile, filtri/scroll, gesti ripetuti, PWA, caricamento dopo aggiornamento, accesso diretto e sicurezza.
- **NAV-S5:** collaudo della distribuzione realmente servita (HTML, JS, CSS, montaggio dell'app) prima della prova Android, evitando il falso positivo della sola build.

Per ogni incremento: prima evidenza RED riproducibile su contenuti sintetici; poi GREEN, test generale, revisione indipendente sullo stesso SHA, Human Review quando il comportamento percepibile cambia. Se la qualifica è positiva ma Android fallisce, il risultato umano rimane REWORK. Nessun merge con HPR REWORK.

## 7. Fonti di riferimento

- Android Developers, *Principles of navigation*: https://developer.android.com/guide/navigation/principles
- Android Developers, *Layout and navigation patterns*: https://developer.android.com/design/ui/mobile/guides/layout-and-content/layout-and-nav-patterns
- MDN, *Working with the History API*: https://developer.mozilla.org/en-US/docs/Web/API/History_API/Working_with_the_History_API
- React Router, *useBlocker*: https://reactrouter.com/api/hooks/useBlocker
- W3C, *Modal Dialog Pattern*: https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
- UX-GOV-01 v1: [baseline vigente](./UX-GOV-01-registro-docente-user-flow-baseline-v1.md)
- Tracker unico: https://github.com/antoniocorsano-boop/registro-docente/issues/104

**Non obiettivo:** riscrivere le viste specialistiche, introdurre routing server o rilassare il vault. La migrazione è incrementale e ripristinabile.
