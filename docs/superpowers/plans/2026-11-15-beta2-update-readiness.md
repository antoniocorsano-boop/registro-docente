# BETA2-UPDATE-01 — Preparazione dell'aggiornamento, confini di rilascio

## Baseline e decisione

Laboratorio `36911b432c1bdd066d77d59407279b5bb86a14fb`: #274 e #275 consolidate. #275 qualificata 12/12, Codex senza rilievi, codice identico al merge. Il controllo canonico post-merge è 43735353002; non attribuire al nuovo APK prove fisiche di una compilazione precedente.

Confronto main → laboratorio: 146 commit avanti, 0 indietro, al momento della ricognizione. Non fondere direttamente #250: il ramo include strumenti e identità di collaudo. Distinguere sorgenti prodotto e prove permanenti da procedure/artifact temporanei (diagnostiche a SHA fissa, rami di prova e APK debug). Preparare una PR di promozione su main con inventario file, parità sorgenti e invarianti; mantenere il workflow canonico su APK di laboratorio. Verificare nuovamente la base main prima della promozione.

## Identità e aggiornamento

- Identità professionale esistente: `it.trama.registrodocente`; riferimento Beta1 RC2 `versionCode=10002`, `versionName=0.1.0-beta.1-rc.2`. APK di laboratorio separato `it.trama.registrodocente.lab.b43` non aggiornabile in luogo come app professionale.
- Proposta, da verificare sul pacchetto professionale effettivamente installato: `0.1.0-beta.2-rc.1`, versionCode maggiore del massimo professionale già distribuito; non assegnare ora il numero definitivo senza controllo. Firma con certificato proprietario esistente; nessuna chiave nel repo/chat/artifact.
- Non cambiare schema o migrare implicitamente gli archivi del laboratorio. Backup cifrato verificato, copia di prova sintetica, nessuna disinstallazione o reset. Verificare aggiornamento in-place e compatibilità prima dell'uso di archivi effettivi.
- BUILD-ID-01 mostra prefisso della SHA sorgente; non è l'impronta binaria o la prova della firma. Manifest deve registrare entrambe, oltre a appId/versionCode/versionName/certificato.

## Gate residui prima di firma e HPR

1. SEC-SESSION-01: test deterministico di due mutazioni ammesse, prima in corso, seconda accodata, sospensione e revoca chiave alla scadenza. La prima può completarsi; la seconda non può iniziare una scrittura senza chiave. Verificare esito esplicito, nessun falso successo, nessuna perdita silenziosa, nessun dialogo bloccante sulla superficie protetta, recupero/ripetizione dopo autenticazione. Il test osservativo del comportamento attuale non è qualifica del recupero UI. Se confermato, correzione circoscritta con prova di regressione. Non indebolire la revoca della chiave.
2. Ripristino nativo e coerenza della cronologia dopo restore: già qualificata integrità del round-trip; specifica copertura native post-restore history ancora da attestare.
3. Offline: percorso docente fondamentale, Biblioteca/preparazione locale senza provider remoto, PDF locale (creazione e apertura), blocco/inattività e ripresa. Recuperare evidenze Beta1 e HPR precedenti, verificare soltanto residui e candidato finale.
4. Candidato aggiornamento professionale: confronto schema/backup e vecchia versione→nuova su dati sintetici; controllo stesso certificato, package, versionCode crescente e archivio invariato. Non produrre una nuova chiave, non pubblicare.
5. Qualificazione exact-SHA, revisione indipendente, ricevuta con digest del binario. Un solo collaudo umano mirato sull'APK finale identificabile; nessun rilascio implicito.

## Stato

PR di diagnosi/preparazione, nessuna modifica applicativa, nessun dato reale, nessun merge su main, nessuna firma/tag/distribuzione. Riferimenti #104, #204, #207, #209, #210, #262, #274, #275.
