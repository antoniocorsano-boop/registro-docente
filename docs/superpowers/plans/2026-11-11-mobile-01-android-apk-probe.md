# MOBILE-01/S0 — Piano di realizzazione della prova Android

**Data:** 11 novembre 2026  
**Stato:** PR isolata, nessuna pubblicazione.
**Specifica:** `docs/superpowers/specs/2026-11-11-mobile-01-android-apk-probe-design.md`

1. **Contratti**: provare che configurazione ed esecutore sono isolati, che non viene aggiunto un server HTTP Android o un URL remoto, che workflow e package non richiedono segreti e che non esiste evento di distribuzione `push: main`.
2. **Scaffolding di prova**: creare `mobile/android-probe/package.json` con tre dipendenze Capacitor 8.6.0 bloccate e `capacitor.config.json` con `webDir: ../../dist`, appId di sola prova.
3. **Esecutore GitHub**: checkout dello SHA esatto della PR; Bun con lock congelato per compilare il frontend; Node 22 + Java 21 + SDK 36; installazione isolata del progetto Capacitor; `cap add android`, `cap sync android`, `gradlew assembleDebug`; verifica firma debug e hash; caricamento artefatto GitHub di breve durata.
4. **Diagnosi**: distinguere dipendenza Gradle/npm/rete da errore applicativo. Non cambiare main e non moltiplicare workflow; riparare solo lo step effettivamente fallito. Registrare esito con SHA esatto.
5. **Revisione**: esaminare il codice/workflow prima di ogni nuova prova, chiedere revisione indipendente exact-SHA; non integrare in main né pubblicare APK.
6. **Decisione**: se S0 PASS, passare all'inventario di interventi offline/PDF/Vault/backup necessari; il primo APK resta una prova non utilizzabile con dati veri.

**Stop condition:** nessun artefatto o manifest dopo fallimento dei prerequisiti; nessuna dichiarazione di rilascio senza UX-QA-03.


## BACKUP-02/B4 — Collaudo Android isolato (14 novembre 2026)

**Baseline applicativa immutata:** PR #239, `8f3a36d72bb2b487c6bde360df2b657f897481b1` (sei workflow PASS, revisione indipendente PASS).
**Scopo:** ottenere il pacchetto debug di laboratorio per B4 senza modificare il codice, la firma stabile, main, o l'archivio della Beta 1. PR di collaudo separata e non da integrare. Il commit del pacchetto differisce dalla baseline esclusivamente per questo piano; verificare il diff e il manifest source_sha prima di utilizzare l'artefatto. Nessuna autorizzazione a usare dati reali.

### Prerequisiti
- Usare esclusivamente l'artefatto debug verificato della presente esecuzione, ID `it.trama.registrodocente.prova` (Registro Docente - Prova), distinto da `it.trama.registrodocente`.
- Se il pacchetto di prova esiste già o Android segnala conflitto di firma, fermarsi: non disinstallare, cancellare dati, sostituire l'app in uso o aggirare le protezioni del dispositivo. Usare un ambiente isolato nuovo. Nessuna chiave privata o password reale nelle evidenze.
- Il workflow produce anche un candidato **unsigned** Beta con identità/versione preesistenti; NON installarlo, firmarlo o considerarlo Beta 2. La qualificazione della firma e dell'aggiornamento è distinta.
- Archivio esclusivamente sintetico: classe «Classe Prova», due persone fittizie, una valutazione di disegno e una osservazione. Nessun nominativo reale, copia di produzione, account esterno o trasferimento di dati scolastici.

### Sequenza di prove e criteri
| ID | Azione | Esito richiesto |
|---|---|---|
| B4-01 | Aprire l'app separata; creare archivio sintetico e registrare voto/osservazione. | Stato locale immediatamente confermato; nessuna finestra di backup. |
| B4-02 | Bloccare, riaprire; chiudere e riavviare; ripetere senza rete. | Dati fittizi invariati, accesso protetto, niente dipendenza remota per registrazione e consultazione. |
| B4-03 | In Privacy avviare esportazione e annullare il selettore nativo. | Nessuna nuova attestazione né riduzione delle modifiche. |
| B4-04 | Esportare con password di prova in cartella locale autorizzata per il test; controllare conferma e file. | Scrittura chiusa, rilettura, hash/byte verificati; indicatore coerente dopo ritorno a Oggi e riapertura. |
| B4-05 | Aggiungere una seconda registrazione dopo la copia. | La nuova registrazione rimane salvata; copia da aggiornare con conteggio coerente. |
| B4-06 | Tentare apertura di file sintetico errato o password di prova errata, annullando qualsiasi conferma di ripristino. | Nessuna sostituzione dell'archivio; errori espliciti. |
| B4-07 | Solo nell'archivio di laboratorio e previa conferma esplicita, ripristinare la copia sintetica precedente; riaprire. | Contenuto recuperato corrispondente al checkpoint; la registrazione successiva non faceva parte della copia; nessuna falsa attestazione locale ereditata. |
| B4-08 | Riesportare e verificare; valutare leggibilità del percorso e gestione file a schermo piccolo. | Esito verificato, nessuna interruzione operativa; HPR separata dal rilascio. |

Registrare per ogni prova PASS/FAIL/NOT RUN e, se necessario, schermata con soli dati fittizi; annotare versione Android, identità APK, SHA del sorgente e SHA-256 del pacchetto. B4-07 è vietato nell'app ordinaria. B4 non dimostra la sopravvivenza alla perdita del dispositivo: prova su supporto separato autorizzato e aggiornamento firmato devono essere valutati distintamente. Nessun PASS fisico dedotto da una compilazione, da Chromium o dal bridge simulato. Nessun merge, deploy o pubblicazione.
