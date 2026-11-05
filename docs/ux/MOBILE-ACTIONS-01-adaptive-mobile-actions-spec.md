# MOBILE-ACTIONS-01 — Accesso contestuale leggero su Android

**Stato:** candidato progettuale, non approvazione d'integrazione
**Base:** `main@0488cd50287ef26883f395e2b79ab1fcba11ccdc`
**Autorità:** UX-GOV-01 (#104), HPR NAV-S1 (#117), vincoli di sicurezza Vault.
**Riferimento d'interazione:** Google Drive Android (un punto d'ingresso alle azioni, espansione a richiesta, riduzione durante lo scorrimento). Non riprodurre asset proprietari né replicare il prodotto.

## Evidenza
Le HPR Android di NAV-S1 documentano tre controlli sempre sovrapposti ai contenuti: pill «Copilota» (`CopilotDeck.tsx`) nella zona destra, pulsante di blocco e pulsante di impostazione blocco (`VaultControls.tsx`). Nel Tabellone, nelle Schede alunno e nel modulo Valutazioni alcune informazioni e comandi sono occlusi. Il vecchio `pb-36 md:pb-20` consente lo scorrimento finale ma non elimina la copertura durante il lavoro.

## Obiettivo e confini
Ridurre gli ingombri dell'accesso al Copilota senza cambiare la sua autorità, il contenuto, la privacy, il salvataggio, la navigazione o il ciclo della sessione.

### Incremento A — trigger Copilota adattivo (questo ramo)
- Un solo punto d'ingresso Copilota nello stato chiuso; il pannello esistente è l'espansione contestuale. Non duplicare FAB e scorciatoie.
- Su smartphone il trigger è circolare e compatto, almeno 48×48 CSS px, **sul lato sinistro** della vista, sopra la barra di navigazione; il gruppo di sicurezza resta distinto sul lato destro.
- Al primo accesso il comando è visibile; durante lo scorrimento verso il basso oltre una soglia scompare, riappare risalendo o tornando in cima. Funziona per scorrimento di pagina e contenitori interni; nessun polling o temporizzatore.
- Con il fuoco in un campo di modifica (input, textarea, select, contenteditable) il trigger mobile non copre il dato in compilazione. Ritorna dopo l'uscita dal campo, se lo stato di scorrimento lo consente.
- Il trigger desktop continua a mostrare l'etichetta «Copilota» e la stessa destinazione; accessibilità: nome, fuoco, bersaglio 48px, assenza di duplicazioni, `prefers-reduced-motion` rispettato non introducendo animazioni di percorso.
- L'apertura esistente passa al `CopilotDeck`, e poi alla conversazione controllata. Nessun avvio automatico di missione.

### Incremento B — coordinamento strutturale dopo HPR REWORK (ora candidato nella PR #118)
L'evidenza del docente del 5 novembre (PR #118, commento #6660110129) mostra Copilota e Vault sovrapposti a «Salva Valutazioni di Classe». L'incremento A da solo non soddisfa quindi il criterio di non-occlusione.
- Le due azioni mobile Vault hanno **un alloggiamento reale nell'intestazione stabile** di Navbar. `SecureRegistroRoot` mantiene l'autorità su cifratura, password, blocco manuale e timer; `VaultControls` ne trasferisce soltanto la presentazione nel contenitore mediante portale React. Nessuna toolbar mobile `fixed bottom` sopra voti e salvataggi.
- **Blocca Registro** resta un controllo direttamente raggiungibile in un tocco. **Imposta blocco automatico** conserva le scelte Mai/15/30/60 minuti e il popup accessibile; la versione desktop rimane invariata.
- Il Copilota non mostra il pulsante flottante su smartphone nelle superfici di compilazione e configurazione (`voti`, `comportamenti`, `dati`, `verifiche-online`, `uda-gantt`, `programmazione`, `biblioteca`, `impostazioni`, `privacy`). Rimane disponibile nelle superfici di consultazione e nella versione desktop.
- Accettazione obbligatoria: geometria della CTA «Salva Valutazioni di Classe» libera da sovrapposizioni su 320×700 e 390×844; intestazione senza overflow orizzontale; pulsante Blocca sempre raggiungibile; test di apertura impostazioni e focus in modulo. Le prove umane precedenti restano **REWORK** fino a nuova verifica Android sulla versione corretta.
- Il portale cambia soltanto la collocazione dell'interfaccia, non i gestori né la durata del blocco. Non introdurre nuove autorizzazioni o eseguire scritture professionali.

## Invarianti
1. Nessuna variazione di dati personali, cifratura, timeout, esportazioni o operazioni di persistenza.
2. Nessuna variazione a `history`, ai percorsi REG-NAV-01 o ai salvataggi PERSIST-01H.
3. Nessun nuovo fornitore, servizio, permesso, tracciamento o dipendenza.
4. L'input del docente è prioritario; la barra di navigazione a cinque destinazioni resta invariata.
5. Sicurezza sempre direttamente accessibile durante l'uso del Copilota secondo il contratto attuale.
6. PR separata da #116/#117; nessun merge o deployment ordinario.

## Qualificazione
- **RED:** test di contratto che richiede trigger mobile 48px sul lato opposto al Vault, scomparsa su scroll verso il basso / focus su input, riapparizione risalendo e desktop invariato.
- **GREEN:** test Bun e Chromium 390×844, 320×700, 1280×900; verificare distanza geometrica dal gruppo Vault e dalla barra inferiore e aprire il Copilota senza nuova azione professionale.
- Proteggere le funzioni inusuali: schermata vuota, blocco Vault, dialogo Copilota aperto, cambio classe, ritorno cronologico.
- Quattro gate CI sullo stesso SHA, revisione indipendente, Human Review sul telefono con dati fittizi.
- Il solo incremento A non era sufficiente: l'incremento B è candidato, ma nessun PASS UX complessivo viene concesso senza HPR Android successiva e revisione indipendente.

## Decisioni di progettazione
Il posizionamento del Copilota a sinistra è intenzionale: la sicurezza resta sul lato destro e non viene messa in competizione con il comando contestuale. La scomparsa durante lo scorrimento è una riduzione dell'ingombro del solo Copilota; non modifica lo stato delle missioni né le selezioni professionali.
