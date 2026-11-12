# BETA-1 — Archivio iniziale professionale (slice 1)
Riferimenti: #204, #216, #104. Base: e4d6b51ed2b11223f6f33d2904f69fa9032e9e57.

## Decisione di prodotto
- Solo una nuova installazione senza archivio e senza dati legacy, oppure un reset già esplicitamente confermato, può mostrare la scelta iniziale.
- Percorso principale: "Crea archivio professionale" → istituto, anno scolastico, docente, disciplina → password locale → "Apri Registro". Nessun dato dimostrativo, nessun valore identificativo precompilato.
- Percorso alternativo esplicito: "Prova con dati dimostrativi". Non inferire mai il tipo di un archivio esistente dal nome, dalle classi o dal numero di record.
- Un archivio esistente, anche vuoto, viene aperto senza sostituzioni; aggiornamenti, restore e migrazioni non effettuano reset né trasformazioni implicite.
- Per passare da un archivio dimostrativo già installato a uno professionale: eventuale backup verificato, decisione esplicita del titolare e percorso di reset protetto già esistente. Non eseguire ora sul dispositivo.

## Slice 1 — dominio e transazione (questa PR)
Preparazione del candidato completo, profilo validato, scelta nel record settings già cifrato (campo opzionale, nessun nuovo record/schema Vault), scrittura verificata in STAGING e attivazione solo dopo readback. Prove sintetiche aggiunte: professional empty, demo esplicita, profilo mancante, riapertura, ripristino, rifiuto su ACTIVE, errore batch. Nessun dato reale aggiunto.

## Slice 2 — integrazione obbligatoria prima di qualsiasi merge/release
- Collegare VaultGate e SecureRegistroRoot al nuovo inizializzatore esclusivamente in SETUP_REQUIRED. Presentare scelta esplicita e profilo, mantenendo migrazione/sblocco invariati.
- App.tsx deve distinguere la scelta professionale nel record settings: nessun reinserimento di INITIAL_TESTS (attualmente merge incondizionato), INITIAL_CLASSES e INITIAL_UDAS. Conservare il comportamento legacy per archivi non classificati, senza riscrivere record; verificare anche le schermate dopo restore e gli eventuali default settings.
- Controllare che backup cifrato, import/restore e mutazione impostazioni preservino il discriminante, senza consentire cambio modo implicito; nessuna modifica al formato Vault.
- Aggiornare le fixture browser affinché la scelta dimostrativa sia esplicita, aggiungere scenari professional first-run, errore/interruzione, riapertura, backup/restore, factory reset, archivi legacy parziali/vuoti, UI mobile e offline. Non indebolire le prove storiche.
- 6 controlli CI, revisione indipendente exact-SHA e prova Android mirata prima dell'integrazione, secondo governance. Nessun dato reale, pubblicazione, firma o modifica a main.
- La slice 1 isolata NON modifica il comportamento dell'APK e NON chiude G3/G4.

## Slice 2 — implementazione in corso
- Scelta esplicita in VaultGate e inizializzazione via SecureRegistroRoot; profilo obbligatorio per il percorso professionale; nessuna scelta predefinita. I record espliciti sono autoritativi, anche se vuoti; il comportamento degli archivi storici non classificati rimane invariato.
- Le impostazioni ordinarie non possono modificare la modalità. I backup completi trasportano il record settings; resta da verificare in modo dedicato il ripristino dei formati storici e il reset end-to-end.
- 50 scenari browser esistenti aggiornati esclusivamente nella configurazione dimostrativa; aggiunta prova mirata professional/offline/reopen allo smoke canonico. Nessun test storico rimosso. Il blocco della rete esterna e il lavoro offline in Chromium non qualificano la riapertura offline Android.
- La slice 1 ha dato PASS sui sei test funzionali; la qualifica iniziale era FAIL per percorso non registrato tra gli invarianti. Aggiunto BETA-1-ARCHIVE-I01; esiti del candidato complessivo ancora da verificare.
