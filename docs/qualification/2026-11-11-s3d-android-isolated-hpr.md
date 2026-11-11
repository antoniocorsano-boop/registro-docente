# S3d-02 — Ambiente isolato per una sola revisione Android

**Data:** 11 novembre 2026  
**Autorità:** [INT-02 #140](https://github.com/antoniocorsano-boop/registro-docente/issues/140) · [S3d #192](https://github.com/antoniocorsano-boop/registro-docente/issues/192) · [roadmap #104](https://github.com/antoniocorsano-boop/registro-docente/issues/104).  
**Baseline di origine:** main fa7e5ea6f152f40c8cf40df054066c24f9ffae5c, dopo PR #199.  
**Perimetro:** soltanto predisposizione di un eseguibile di prova separato e relativo contratto di sicurezza. Non è una distribuzione del Registro Docente ordinario.

## Decisione architetturale

Non riattivare i progetti Vercel né modificare il servizio normale in server.ts. Il file scripts/hpr/androidReviewServer.ts avvia una seconda applicazione Express, volutamente separata dal normale backend. Serve i file della medesima interfaccia compilata ma espone **solo** gli endpoint di prova necessari al Copilota; tutti gli altri endpoint sono negati. Non importa provider Gemini né legge API key.

L'ambiente funziona soltanto quando:

1. Si imposta esplicitamente HPR_ANDROID_MODE=synthetic-only.
2. È presente un segreto di accesso di almeno 32 caratteri, configurato **solo nell'infrastruttura**, mai in GitHub, nella chat o in artefatti.
3. Il commit realmente distribuito (RENDER_GIT_COMMIT) corrisponde esattamente al commit qualificato indicato in HPR_EXPECTED_SHA.
4. HPR_EXPIRES_AT è una scadenza futura, non oltre sette giorni dall'avvio. Dopo la scadenza l'ambiente risponde con stato 410.
5. L'accesso dal browser è protetto con autenticazione HTTP; nome utente: docente-prova. Non pubblicare password né URL contenenti credenziali.

Sono bloccate API diverse da POST /api/copilot/assessment-draft e GET /api/copilot/assessment-draft/provider; il servizio non salva in rete verifiche, UDA o voti. Le fonti di caratteri e script esterni presenti nell'HTML ordinario vengono escluse dalla vista di prova, con politica dei contenuti limitata allo stesso dominio. Anche il service worker è disabilitato per evitare copie persistenti dell'ambiente di collaudo.

Il servizio simulato accetta **soltanto** la combinazione:
- Classi ammesse, entrambe fittizie e confermate: **3C Dimostrativa** oppure **3ª A - Secondaria I Grado**.
- Materiale della Biblioteca, di tipo «Testo o idea» e categoria «Concetto»: **Le trasformazioni dell’energia**
- Testo: **Una centrale elettrica trasforma energia primaria in energia elettrica.**
- Obiettivo: **Riconoscere le trasformazioni energetiche.**

La risposta è fissa e totalmente fittizia: due domande sull'energia da aprire nell'editor, modificare e abbandonare senza salvare. Nessun invio a un fornitore esterno.

## Condizioni per un eventuale servizio temporaneo

Prima di qualsiasi attivazione consultare l'elenco dei servizi dell'area di lavoro Render **scelta esplicitamente dall'utente**, evitando duplicazioni. Valutare disponibilità del piano gratuito e limitazioni correnti prima della creazione. Non toccare servizi esistenti senza una decisione distinta.

Configurazione proposta per un **nuovo** servizio isolato, se confermato:
- Runtime Node, regione Francoforte, piano gratuito solo se disponibile.
- Ramo di prova **congelato su exact-SHA qualificato**, mai main, con distribuzione automatica DISABILITATA.
- Compilazione: npm install --global --no-audit --no-fund bun@1.4.4 && bun install --frozen-lockfile && bun run build.
- Avvio: ./node_modules/.bin/tsx scripts/hpr/androidReviewServer.ts.
- Variabili obbligatorie: HPR_ANDROID_MODE, HPR_ANDROID_ACCESS_SECRET, HPR_EXPECTED_SHA, HPR_EXPIRES_AT. PORT e RENDER_GIT_COMMIT sono forniti dall'infrastruttura.
- Nessuna GEMINI_API_KEY, nessun collegamento a servizi di posta, registri, telemetria scolastica o banche dati.
- Nessun collegamento a un dominio ordinario e nessuna pubblicazione come versione di riferimento.

Lo stato di «ambiente accessibile da Android» è confermabile **solo dopo** accesso reale all'URL su dispositivo e verifica della rotta riservata /__hpr/status (commit, modalità simulata, scadenza); la mera esistenza del servizio non costituisce HPR PASS.

## Revisione professionale Android — un solo percorso, niente ripetizioni inutili

Con browser dedicato e senza usare dati del proprio Registro:

1. Configurare un archivio protetto **nuovo e fittizio**, utilizzare una delle classi fittizie ammesse («3C Dimostrativa» oppure «3ª A - Secondaria I Grado») e un materiale con i valori esatti riportati sopra; classificare la fonte come professionale.
2. Dal Copilota scegliere «Creare una verifica» e la fonte; controllare classe e contesto.
3. Inserire l'obiettivo fittizio; verificare consenso per il singolo tentativo, disponibilità «Servizio simulato (nessun invio esterno)», proposta e leggibilità delle domande.
4. Usare «Apri e modifica», verificare UDA non preselezionata, modificare il titolo **senza salvare**.
5. Usare il gesto Indietro di Android; verificare la protezione delle modifiche, scegliere prima di restare nella bozza e poi uscire senza salvare. Controllare che non sia stata creata alcuna verifica.

Annotare data, modello Android, browser, orientamento, URL e commit (solo nel registro tecnico), metodo simulato, dati fittizi e giudizio PASS/REWORK/BLOCKED con eventuale rilievo riproducibile. Non inserire identificativi di alunni, documenti scolastici o contenuti reali neppure per «provare rapidamente».

A prova conclusa, interrompere/eliminare il servizio temporaneo e cancellare i dati del sito di prova dal browser; quest'ultimo passaggio non deve riguardare il sito ordinario.

## Confini di qualificazione

- **Codice e prove automatiche del servizio isolato:** qualificabili su PR isolata; non certificano accessibilità Android.
- **S3d-02:** mantenere BLOCKED fino alla reale disponibilità dell'ambiente; poi una sola HPR con ricevuta.
- **S3d-03:** il fornitore reale resta NOT VERIFIED; non introdurre credenziali, chiamate a Gemini o simulazioni falsamente presentate come vere.
- **INT-02:** non chiudere formalmente per la sola creazione di questa specifica o della PR.
- **Vercel / main / versione ordinaria:** invariati in assenza di ulteriore autorizzazione espressa.
