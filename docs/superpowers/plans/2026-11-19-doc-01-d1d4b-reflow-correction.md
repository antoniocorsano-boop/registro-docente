# DOC-01/D1d4b-R1 — Correzione reflow e densità

## Origine e decisione
Riesame effettivo della revisione 6c16c5c4ca8933bf990d81fbcdb1dfd5c6607bfe, artifact 14502219281, PR #354 commento 7001184591. I sette workflow erano positivi, ma la schermata 320px/200% era 355×3791 px: overflow e frammentazione delle parole. Il confronto scrollWidth<=innerWidth poteva risultare vero se entrambi i valori crescevano. La precedente qualifica UX resta HOLD; nessuna promozione per il solo esito tecnico.

## Intervento
- Layout locale a larghezza effettiva 100%, limite 576px, min-width 0 nei contenitori e nei figli flex. Spaziature in pixel indipendenti dalla scala del testo; testo in rem, nessun ridimensionamento forzato, clipping o overflow-x:hidden.
- Fonte e stato sulla stessa riga quando possibile; ritorno a capo naturale. Quantità e ore conservate e distinte. Provenienza raggruppata in un'unica sezione espandibile; elenco dei campi incompleti separato, contenuti e decisione invariati.
- Summary nativo con indicatore integrato; target minimi 44px, stato di focus visibile e apertura da tastiera. Nessun codice di navigazione, persistenza, esportazione o accesso a dati reali.
- I comandi della fixture restano disponibili nei casi funzionali; le prove geometriche acquisiscono la vista di prodotto senza tali comandi.

## Evidenze richieste
Tre prove a 320/100, 390/100 e 320/200: confronto con viewport nominale, larghezza reale PNG prima e dopo conferma, dimensioni del testo, limiti dei contenitori e del testo reso, apertura di entrambe le sezioni e conferma. Soglia diagnostica di densità prima della conferma: 850px al 100%, 2400px al 200% (scelta di laboratorio, non prescrizione normativa). Nessuna affermazione di miglioramento misurato prima dell'acquisizione. I sette casi originari restano richiesti; la verifica delle evidenze controlla anche le nuove misure e le tre nuove immagini. Invariante DOC-01-D1D4B-I02, 101 attese. I 100 invarianti precedenti restano invariati. Nessuna modifica al contratto documentale o ai rami operativi.

## Criterio di chiusura
Qualificare l'esatto candidato e acquisire i PNG effettivi, confrontare geometria e leggibilità a 320/390/200%, verificare il ritorno a capo, le disclosure, i contenuti e l'ingombro. Solo in assenza di rilievi chiudere HOLD UX e riprendere la mappatura istituzionale. Nessuna integrazione o pubblicazione in questa fase.
