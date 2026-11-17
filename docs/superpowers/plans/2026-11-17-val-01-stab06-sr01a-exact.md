# STAB-06/S-R01a — Configurazione iniziale esclusiva DB1

## Evidenze e base
STAB-05 #313: 5/5 workflow, 15/15 job, 7/7 nuovi scenari nativi, 1468/1468 sicurezza/memoria, 198/198 browser compatibilità, 30/30 bootstrap deterministiche. Candidato qualificato cacd34eae92cfc46f4d4bdb7462d1eb5e4fa8e44. Base di orchestrazione c3bf57935cd62212dbda17186c4e137ee36be950. La correzione #308 è stata trasferita dopo verifica di identità dei blob dei cinque file pre-modifica; nessun cambio alla diagnostica stabilizzata o al percorso distribuito.

## Requisito
Due inizializzazioni concorrenti del candidato DB1 non devono sostituire la riserva reciproca. Transazione unica sui due store, conteggi zero, inserimento add, chiave pubblicata soltanto dopo commit. Rifiuto senza scritture successive o pulizia della riserva altrui. DB2 e percorso ordinario invariati.

## Gate progressivo
Due nuove prove deterministiche, due browser reali (concorrenza su due connessioni e conservazione record residui), regressioni di sicurezza, contratti e compatibilità per tre predecessori. Verifica sul nuovo SHA, non sul candidato precedente. I workflow beta2-reference e database-fence vengono riattivati sul nuovo head. Le prove native sul candidato precedente restano evidenze storiche e non qualificano la modifica; nuova qualificazione cumulativa e revisione indipendente necessarie prima dell'attivazione.

## Limiti
S-R01a riguarda i client cooperanti; non chiude automaticamente il rischio di client storici non cooperanti, reset esterno o S-R02 (revoca dopo ammissione migrazione legacy). S-R03 backup reale, S-R04 rimozione storage, S-R05 revisione e riqualificazione restano aperti. Nessun merge, attivazione, rilascio o aggiornamento del dispositivo. Nessun esito anticipato.
