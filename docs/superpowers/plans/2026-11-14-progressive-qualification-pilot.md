# Qualificazione progressiva — pilota Registro Docente

Decisione operativa del 14 novembre 2026: evitare il ciclo di qualificazione complessiva a ogni correzione. Il candidato cumulativo #244 resta in bozza e il workflow autorevole Browser Qualification resta invariato. Nessun controllo richiesto viene sostituito da un esito diagnostico.

## Sviluppo
- Ramo diagnostico separato, derivato dall'esatto candidato, PR verso il suo ramo (non main).
- Correzione mirata; verifiche della funzionalità, regressioni correlate e prove non raggiunte nella precedente esecuzione.
- Gruppi indipendenti su runner isolati; fail-fast disattivato fra gruppi. Un gruppo non annulla gli altri. Un worker Playwright per gruppo per preservare isolamento ed evitare competizione per le risorse.
- Ricevute e prove separate per gruppo e SHA, esplicitamente non valide per il rilascio. Non trasferire PASS tra SHA diversi.
- Per una failure infrastrutturale sullo stesso SHA usare, se disponibile, la ripetizione del solo job fallito. Per correzioni di codice o test produrre nuovo SHA, non rieseguire un commit vecchio pretendendo che contenga la correzione.

## Candidato consolidato
Solo dopo esiti diagnostici positivi, riconciliare il candidato senza integrare main e sottoporlo a qualificazione completa, revisione indipendente e collaudo Android fisico. Nessuna modifica a branch protection, autorità dei dati, deploy o firma APK.

## Evoluzione della qualificazione autorevole (attività separata)
Progettare e qualificare la suddivisione del workflow Browser Qualification in gruppi paralleli: inventario completo delle prove esistenti, runner indipendenti, ricevute dello stesso SHA, aggregazione fail-closed, nome/stato del controllo richiesto invariato oppure migrazione esplicitamente approvata. Conservare le analisi delle evidenze UX; nessun gruppo saltato o fallito può risultare PASS. Misurare tempo totale e minuti runner prima di adozione generale. Non modificare il gate autorevole durante la risoluzione della #244.

## Pilota
Il workflow Browser Diagnostic (non-release) è limitato a PR diagnostiche verso fix/copilot-contextual-presence. Include prove mobile-actions, FLOW-03, AIC-07 e tutte le 31 specifiche storiche non raggiunte dopo il precedente arresto. Le prove precedentemente superate non vengono considerate qualificate sul nuovo SHA. Utilizzo esclusivo di dati sintetici, senza provider a pagamento. Il parallelismo effettivo dipende dalla capacità dei runner disponibili.
