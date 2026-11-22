# VAL-01/PRODUCT-05/S7d.2b — Codec di copia cifrata V10, laboratorio isolato

Data 22 novembre 2026. Base PR #399 `f10931a17bdc487247efe233379161b8f1ad2f8f`, già allineata con PR #398.

## Perimetro
Questa fase aggiunge un codec LOGICO V10 per il nuovo storico formativo S7d.1b. Nessuna selezione V10 nell'app, nessun collegamento a IndexedDB/Android SAF, nessuna modifica agli archivi professionali. Si mantiene la barriera che impedisce a SecureAppStorage ordinario e agli esportatori V6–V9 di accettare lo storico non ancora promosso.

## Contratto
1. La V10 è esplicitamente distinta dalle V6–V9. Richiede modalità archivio professionale, storia documentale istituzionale V2 e il resto del contenuto già verificato da V9/V7, più lo storico formativo facoltativo al livello esatto di ogni classe.
2. L'identità del contesto formativo (classe, anno, disciplina, elenco studenti) proviene esclusivamente da ambiti approvati al di fuori del file. Il codec verifica la catena SHA-256 di ogni revisione S7d.1b con il validatore canonico, senza rifare le valutazioni del docente.
3. Copie con posizionamenti errati del campo, ambiti non autorizzati, revisioni tagliate, hash modificati, dati inconsueti o dati istituzionali V2 non validi sono rifiutate. Il filtro è a chiavi esatte, senza sanificazioni distruttive o inserimenti impliciti.
4. Cifratura: riutilizzo della busta AES-GCM V2 già in uso. Una prova di cifratura e lettura verifica il ritorno esatto della storia e l'esclusione del testo in chiaro.
5. Ripristino V10: richiede copia di recupero V10 esatta del corrente e tutela sia il modello V9 (classi, prove, documenti), sia la sequenza di revisione formativa con prefisso storico invariato. Non rilascia autorità di scrittura o ripristino fisico.
6. Un archivio V9 senza storia formativa può essere candidato alla V10 solo con selezione esplicita e documenti V2 verificabili. Non si inventano V2 né si promuovono automaticamente archivi V6–V8.

## Promozione vietata fino a
- Integrare i controlli V10 nei percorsi autenticati di salvataggio e ripristino tramite gestione delle modifiche e rilettura durevole, senza allentare il blocco attuale.
- Collaudare Web/Android, versioni precedenti, cifratura e failure-injection, nuova fonte di autorizzazione della copia fisica.
- Qualificazione finale di tutte le PR su main corrente, revisione indipendente e decisione docente. Nessuna pubblicazione.
