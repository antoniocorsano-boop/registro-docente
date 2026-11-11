# Registro Docente — Politica di rilascio, manutenzione ed evoluzione v1

**Data:** 11 novembre 2026  
**Stato:** proposta di governance da qualificare e integrare; non equivale al rilascio della Beta 1.  
**Decisioni:** [REL-GOV-01 #209](https://github.com/antoniocorsano-boop/registro-docente/issues/209), [NEXT-01 #210](https://github.com/antoniocorsano-boop/registro-docente/issues/210), [Beta 1 #204](https://github.com/antoniocorsano-boop/registro-docente/issues/204), [MOBILE-01 #207](https://github.com/antoniocorsano-boop/registro-docente/issues/207), [roadmap #104](https://github.com/antoniocorsano-boop/registro-docente/issues/104).

## 1. Scopo

**Consolidare una versione utilizzabile per aprire il ciclo successivo di sviluppo, non per fermare il prodotto.** Ogni versione è un punto di ripristino tracciato; il codice e le funzionalità continuano a progredire.

## 2. Due percorsi, un prodotto

| Percorso | Riferimento | Cambiamenti ammessi | Decisione di uscita |
| --- | --- | --- | --- |
| **Stabile/manutenzione** | Tag immutabile dell'ultima Beta qualificata; successiva linea di supporto derivata *dal tag* | Difetti di sicurezza, dati, backup, avvio e correzioni circoscritte; versioni correttive | Verifiche mirate, prova conservazione dati e approvazione distinta del nuovo pacchetto |
| **Sviluppo/evoluzione** | `main` + rami di intervento e PR | Nuove funzioni, UX, Consigli di classe, documenti, raccordi e Copilota | Contratto per funzionalità, test, revisione indipendente; successivo gate di rilascio |

`main` non viene congelato né clonato permanentemente. Il tag stabile è una fotografia identificata del prodotto; **la linea `support/beta-1` viene creata soltanto dopo un vero rilascio**, dal relativo tag e se vi è effettiva necessità di mantenere Beta 1 durante Beta 2. Nessun ramo supporto generato dall'APK sperimentale.

## 3. Chiusura Beta 1: ordine canonico

1. **MOBILE-01:** involucro Android autonomo, nessuna dipendenza di rete per le funzioni essenziali, documenti PDF e file locali, ripristino/backup cifrato, WebView con archivio protetto, Indietro/gesti, avvio da icona, aggiornamento senza perdita.
2. **UX-QA-03:** percorsi principali del docente su dispositivo, privacy/sicurezza, test pertinenti, revisione umana e confronto con roadmap.
3. **Release decision:** identità/appId finale, chiave firma Android stabile custodita fuori da codice e chat, `versionCode` monotono e `versionName`, checksum SHA-256, prove di installazione/aggiornamento, commit esatto, manifesto e istruzioni. **Soltanto dopo autorizzazione esplicita** pubblicare l'artefatto; non attivare Vercel in automatico.
4. **Riferimento immutabile:** applicare *dopo l'effettiva approvazione* il tag `v0.1.0-beta.1` (etichetta proposta e non riservata), registrando APK/hash/signing fingerprint e schema della base dati. Non affermare mai che un tag o una release esistono prima che GitHub lo confermi.

**Oggi:** PR Android #208 produce un APK **debug di laboratorio** con 6/6 controlli PASS e revisione indipendente senza rilievi, ma non qualifica offline, backup, WebView, firma finale o utilizzo professionale. Identità `it.trama.registrodocente.prova` non è quella definitiva.

## 4. Contratto degli aggiornamenti Android

- Stesso applicationId e identità di firma per consentire l'installazione come aggiornamento; aumentare `versionCode`. Un cambio non pianificato dell'identità può richiedere una nuova installazione: **non promettere continuità automatica**.
- IndexedDB/Web Crypto dipendono anche dall'origine e dall'ambiente WebView: verificare che aggiornamento e migrazione conservino il contenuto cifrato prima di utilizzare dati veri.
- Salvaguardare i backup cifrati esterni: esportazione, disponibilità del file, riapertura e ripristino riuscito con dati sintetici; controllare backup di versione precedente con quella successiva. Non conservare segreti di firma nel repository o in artefatti.
- Non trasferire silenziosamente archivi tra Chrome/PWA e WebView: procedure di esportazione e importazione **esplicite**, con password e conferme. Nessun trasferimento di dati alunni a un fornitore esterno.
- Se la nuova versione non supera conservazione dati o ripristino, **bloccare il rilascio**; non usare il downgrade dell'APK come garanzia di recupero dell'archivio. Conservare la versione precedente e i backup protetti.

## 5. Controlli proporzionati allo sviluppo

Per ogni incremento successivo:
1. Problema del docente e risultato atteso espressi in linguaggio professionale, senza sigle nelle viste d'uso.
2. Perimetro minimo, autorità dei dati e compatibilità con archivi/backup.
3. Prove automatiche del percorso coinvolto, invarianti di privacy e sicurezza, revisione indipendente sul commit esatto.
4. Valutazione visiva/Android solo se la superficie cambia; collaudo integrale **al passaggio di versione** o se cambiano invarianti trasversali.
5. PR integrata su `main` solo quando qualificata e approvata; **fusione del codice ≠ distribuzione**. Tag/app aggiornati soltanto dopo nuovo gate di release.

Nessuna funzione di IA o memoria avanzata diventa «reale, locale e autonoma» per il solo fatto di avere un involucro Android. Provider simulato, manuale e reale rimangono distinguibili.

## 6. Priorità del ciclo successivo

Il catalogo vivo è [NEXT-01 #210](https://github.com/antoniocorsano-boop/registro-docente/issues/210). Ordine iniziale orientato alla giornata del docente: [mobile #125](https://github.com/antoniocorsano-boop/registro-docente/issues/125) → [Consigli di classe #170](https://github.com/antoniocorsano-boop/registro-docente/issues/170) → [modelli didattici #171](https://github.com/antoniocorsano-boop/registro-docente/issues/171) → integrazioni TRAMA/Docente OS → IA/memoria opzionali. Rivalutare in base all'esperienza d'uso reale, non creare duplicati delle issue esistenti.

I difetti che rendono insicura o inutilizzabile **Beta 1** restano invece bloccanti in [#204](https://github.com/antoniocorsano-boop/registro-docente/issues/204) e [#207](https://github.com/antoniocorsano-boop/registro-docente/issues/207), anche se osservati durante la pianificazione Beta 2.

## 7. Registro delle decisioni

| Evento | Evidenza richiesta | Azione vietata prima del gate |
| --- | --- | --- |
| PR approvata | SHA, prove e revisione, decisione eventuale di merge | Distribuirla come release |
| Beta 1 candidata | APK firmato per continuità, hash, prova backup/upgrade, UX-QA-03 | Dichiararla stabile prima di HPR |
| Beta 1 rilasciata | Tag esistente, versione pubblicata, manuale recupero e firma verificata | Creare supporto da commit arbitrari |
| Miglioria Beta 2 | Percorso utente, migrazioni, prove mirate, revisione | Cambiare schema dati senza piano di recupero |
| Aggiornamento Beta 2 | Firma/appId/versionCode compatibili, prova senza perdita, nuova decisione | Sostituire APK indiscriminatamente |

Questa politica governa gli aggiornamenti ma **non sblocca da sola la pubblicazione**. Le scelte di rilascio restano in mano al docente.
