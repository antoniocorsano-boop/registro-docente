# DOC-01/D1d1 — Raccordo verificabile con la pianificazione
19 novembre 2026 · Base esatta #349 `9aed4aa11924c9e032ce8d4c8b1c152a775c9265` (7/7). Linea isolata; #325 e #347 non dipendono da questa proposta.

## Riesame D1c
Artefatto 14497623922 del run 44457620323 scaricato e ispezionato: cinque JSON PASS sullo SHA esatto, nessun errore o crash; screenshot a 320/390 e testo 200%. Revisione delle immagini di review e 200%: gerarchia chiara, provenienza progressiva e distinzione tra informazioni mancanti e zero; nessuna sovrapposizione rilevata. Miglioramenti prima dell'attivazione: ridurre la densità verticale e gli avvisi duplicati; facilitare la consultazione dei campi mancanti. Non equivale a HPR o revisione indipendente.

## Decisione D1d1
Il contratto reale DOCENTE_OS_REGISTRO_TEACHING_PROJECTION_V1 fornisce UDA, anno, disciplina, sezione, stato della sezione, generazione e ore programmate. Non contiene istituto/coorte né modalità di verifica strutturate o attività effettivamente svolte. Non trasformare titolo/focus in obiettivo, UDA in attività svolta, o ore previste in ore registrate.

`reviewPlanningDocumentSource` riusa il validatore planning V2 e il controllo del fingerprint Docente OS, la normalizzazione anno/disciplina e il risolutore canonico delle classi. Riceve il solo elenco delle identità delle classi (id/nome, non roster) e delle proiezioni già accettate, un contesto indipendente e una selezione esplicita. Verifica anno, disciplina, classe attuale, grado, sezione confermata, riconciliazione esistente risolta, impronta e data di accettazione, UDA esattamente selezionate. Rifiuta fonti alterate, sostituite, ambigue, non confermate o estranee.

Istituto/coorte devono essere confermati esplicitamente rispetto al contesto indipendente; questa conferma è un requisito della futura interazione, non prova di autorità della fonte e non è ancora collegata a una UI. La proiezione restituisce solo riferimenti alle UDA selezionate e ore programmate, con provenienza interna; nessuna copia di titolo, focus, risorse, contenuti personali o attività consuntive. Non è una precompilazione del documento ufficiale. I riferimenti devono restare interni, non presentati come contenuti documentali. Non introduce persistenza o lettura autonoma degli archivi.

## Prove
Otto test sintetici predisposti prima dell'implementazione; prima revisione stub RED `28560119cf6f4672edb0764705c6b652554fb79e`, implementazione `a4f8c303afeac20233a9cba2ae744ad972511544`. Non è stata eseguita una suite Bun sullo stub; nessuna attestazione RED causale canonica. Nuova invariante DOC-01-D1D1-I01. Qualificare sul candidato esatto prima di ogni incremento successivo, conservando D1b/c e tutte le invarianti preesistenti.

## Prossimo incremento
D1d2: raccordo Arena distinguendo annualità disciplinare non strutturata, riferimenti espliciti e veri obiettivi; mai inferire campi dai testi. Successivamente mappare consuntivi Registro e modelli istituzionali, poi collegare la vista Consigli soltanto dopo decisione e collaudi separati. Nessun merge, deploy, export, IA, dati reali, firma o costo.
