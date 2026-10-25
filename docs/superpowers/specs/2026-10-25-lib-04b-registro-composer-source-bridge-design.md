# LIB-04B — Registro Composer & Source Bridge

**Data:** 2026-10-25  
**Repository:** `antoniocorsano-boop/registro-docente`  
**Baseline:** `main@e83882380e5aeae51d7d4024b2fd5dca25e36b69`  
**Upstream:** `antoniocorsano-boop/trama-ecosistema@8c47c34048acc943a1f4a2067b29629eb880e7ef`  
**Pacchetto:** `@trama/contextual-copilot-core@0.2.0`  
**Stato:** IMPLEMENTATION AUTHORIZED

## Intento

Portare nel Registro il nuovo contratto condiviso `CopilotRequest + IntentPort` senza costruire un resolver locale duplicato. Il docente deve poter aprire un composer contestuale da qualunque superficie docente, scegliere o aggiungere una fonte della Biblioteca, scrivere un messaggio libero e ottenere soltanto le azioni già autorizzate dal Core.

LIB-04B costruisce il consumer e il ponte fonte/contesto. Non implementa ancora il vertical slice operativo LIB-04C.

## Decisione architetturale

`registro-docente` resta un consumer sottile:

`UI composer -> adapter Registro -> Contextual Copilot Core 0.2.0 -> azioni autorizzate`

Il messaggio libero è dato, non authority. Nessun parser di intenti specifico del Registro è ammesso. In assenza di `IntentPort`, `resolveRequest()` deve degradare al fallback deterministico del Core e mostrare soltanto azioni già consentite.

## In scope

- vendorizzare esattamente `@trama/contextual-copilot-core@0.2.0` dalla receipt upstream qualificata;
- aggiornare provenance e test immutabili del consumer;
- aggiungere un request bridge che costruisca `CopilotRequest` da fonte + Teaching/Planning Context minimizzato;
- mantenere il testo libero fuori dal `ContextSnapshot`;
- limitare `allowedCapabilities` a `PREPARE`, `SUMMARIZE`, `LINK`, `REVIEW`;
- aggiungere un source bridge che riusi l'intake LIB-02 e produca normali `LibrarySource` persistite nel Secure Local Vault;
- aggiungere un composer globale, compatto e progressivo con contesto corrente, fonte, messaggio e massimo quattro azioni autorizzate;
- consentire selezione di fonte esistente e acquisizione di nuova fonte senza navigare nella Biblioteca.

## Fuori scope

- parser/intent resolver locale;
- provider o modello aggiuntivo;
- dispatch automatico da testo libero;
- esecuzione PREPARE/SUMMARIZE/LINK/REVIEW dal composer;
- multi-turn chat o memoria conversazionale;
- multi-source;
- semantic search;
- target `activity`;
- merge, deploy o publish automatici.

## Privacy e authority

- Il `ContextSnapshot` resta minimizzato secondo LIB-01B.
- Il contenuto della fonte e il messaggio non entrano nel context snapshot.
- La privacy della fonte continua a prevalere sull'intento.
- Nessuna azione può apparire se il Core non la autorizza.
- Il composer non esegue mutazioni: LIB-04C riuserà dispatch, confirmation e provider disclosure già qualificati.

## Source bridge

Il bridge accetta file, URL con eventuale estratto e testo/appunto/idea, delegando alle funzioni di intake LIB-02. La fonte risultante viene passata all'handler `onAddSource` già durevole di App; non esiste storage chat-only.

## Composer

Stato iniziale: pulsante `Copilota`, contesto corrente e campo messaggio. L'apertura mostra selezione/agggiunta fonte. Dopo una fonte e un messaggio validi, il composer invoca il request bridge. Mostra fino a quattro azioni in ordine Core e, se necessario, `Altre possibilità` solo per ulteriori azioni già autorizzate.

Il composer è disponibile nelle superfici docente ma non nel portale studente.

## Criteri di accettazione

1. Il consumer usa esattamente Core 0.2.0 con receipt/provenance verificabili.
2. `resolveLibraryCopilotRequest()` chiama `resolveRequest()` e non contiene parser locale.
3. Messaggio e contenuto fonte non contaminano `ContextSnapshot`.
4. Fonte nuova dal composer diventa una normale `LibrarySource` persistita via handler esistente.
5. In assenza di `IntentPort`, il composer espone fallback Core senza auto-esecuzione.
6. Fonte `student-personal` non amplia authority e nessun flusso remoto viene introdotto.
7. UI mobile 390×844: controlli primari >=44px, nessun overflow permanente, pannello chiudibile.
8. Nessun deploy, publish o merge automatico.
