# STAB-06/S-R03a — Interoperabilità della copia realmente esportata
Base #315 629e13febc942c305873260dc5324c6542279e8b: 5/5 job, 1474/1474 sicurezza e 210/210 browser PASS. Candidato separato.

## Difetti individuati e intervento
PrivacyView generava exportedAt con un secondo orologio, mentre il checkpoint includeva meta.lastBackup; la verifica DB1 richiede la proiezione esatta. Usare checkpointAt come timestamp del payload per web e Android. Inoltre App inizializza impostazioni, test, ordinamento e navigazione con proiezioni UI che possono differire dai record durevoli. Per il candidato protetto completo, leggere tutti e dieci i record effettivi nel coordinatore delle mutazioni, non i default UI; verificare struttura v6. Per un DB1 storico sparso conservare l'export ordinario (non qualificabile come copia per upgrade protetto). Non cambiare le regole di importazione, la cifratura, la barriera DB2, i grant o la normale selezione delle copie.
I controlli di equivalenza esatti pre-migrazione restano invariati. Le copie v7, legacy e v6 parziali restano rifiutate nel percorso protetto. Il codec v7 non è un writer di produzione. Non estendere la compatibilità senza revisione esplicita.

## Gate
Due prove UI reali per predecessore: export via Privacy, lettura dei byte del download effettivo, decifratura v2/v6, confronto dei dieci dataset e timestamp, migrazione con copia non ancora riletta e con copia riletta/attestata; consenso, nuova autenticazione, conservazione dei dati e ricevuta appropriata. Modificare la destinazione con una sostituzione sintetica autorizzata, quindi ripristinare il medesimo file scaricato via UI DB2 e confrontare tutti i dataset dopo riavvio; nessuna ricevuta locale trasferita. Regressioni contratti/security e compatibilità. Solo dati sintetici. Nessun PASS anticipato.

## Limiti
Lettura serializzata rispetto alle scritture della sessione, non transazione fra schede; la verifica esatta del servizio resta il gate. Prove Android SAF di esportazione/rilettura e ripristino reali, compatibilità con formati ulteriori, casi non canonici o sparsi e recupero su dispositivo senza archivio da qualificare separatamente. Prima di attivazione: S-R04, S-R01 storico, revoca setup, revisione indipendente e qualifica cumulativa finale. Nessun merge, distribuzione, accesso ai dati reali o aggiornamento del dispositivo.
