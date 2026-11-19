# DOC-01/D4a — Identità e versionamento documentale

19 novembre 2026. LAB / SYNTHETIC_ONLY / NO_RUNTIME. Base congiunta #361 `38fc8e43e78f5946e841bfe0e75e46df5680569a`: 11/11 PASS, 129 invarianti. Riesame indipendente ancora aperto. Questo incremento non autorizza l'integrazione definitiva.

## Decisioni progettuali
- Un'identità documentale di classe distingue programmazione disciplinare, programma svolto, relazione finale e contributo disciplinare generale al Consiglio. Riuso del riferimento istituzionale D2a con classe/coorte/istituzione/sede/anno/regime/disciplina/finalità e periodo esplicito. Il modello di riferimento non è adozione istituzionale; per programma svolto e relazione finale è soltanto cornice di contesto, non schema finale.
- Identificatore documento distinto da identificatore revisione; identificatori dimostrativi, sequenza contigua da 1, predecessore esatto, motivazione esplicita codificata, sola bozza. Il documento mantiene la stessa identità e le revisioni precedenti non sono riscritte. Cambio di tipo, periodo, contesto o versione di mappatura rifiutato in questa fase.
- Controllo della testa attesa sulla storia fornita; rifiuto di duplicati, sequenze malformate e richieste discordanti. È una proposta pura in memoria, non un registro autorevole, non un compare-and-swap atomico: una storia vuota o obsoleta fornita dal chiamante non prova unicità globale né impedisce scritture concorrenti. Identificazione univoca nel deposito, associazione al contenuto e concorrenza saranno vincoli delle fasi successive.
- D3b individuale (restituzione e contributo al Consiglio riferito allo studente) escluso dal contratto generale. Richiede identità e destinatario protetti, controllo accessi, selezione e minimizzazione; nessun riuso implicito della linea pubblica.
- Nessun contenuto o digest, nessuna firma, data di conferma, attestazione, salvataggio, stampa o esportazione. Nessuna UI e nessun adattatore dati reali. Il marcatore sintetico non certifica privacy.

## Qualificazione
Otto prove sintetiche scritte prima del modulo (`ddbcfeedde96e2622d063e77aeeeaf15f6fa540a`); RED canonico non eseguito. Invariante DOC-01-D4A-I01, 130 attese. CI exact SHA, riesame cumulativo e indipendente necessari; nessuna nuova UI da qualificare visivamente.

## Sequenza
D4b associazione esplicita a un contenuto riesaminabile e conferma distinta della revisione, gestione revoche/superamento; progettazione protetta D3b prima di ogni eventuale inclusione individuale. D4c deposito locale cifrato con unicità, concorrenza e verifica rilettura; D4d esportazione controllata e approvazione del docente. Nessun rilascio prima dei gate operativi.
