# HEADER-01 — Intestazione contestuale professionale

**Stato:** progettazione tecnica; nessuna modifica applicativa.
**Approvazione prodotto:** docente, 5 novembre 2026: soluzione professionale evoluta, visivamente essenziale.
**Base di analisi e ramo documentale:** PR #118, exact SHA `89064d8b083605f952da13c6d7c1c93174d25540`.
**Autorità:** UX-GOV-01 issue #104, HEADER-01 issue #119, MOBILE-ACTIONS-01 PR #118.
**Dipendenza bloccante per l'implementazione:** HPR Android PASS di #118 e conferma sequenza canonica della roadmap. Vietati merge e deploy in questa fase.

## 1. Problema osservato nel prodotto

Nell'attuale `Navbar.tsx` il menu, il logo, il toggle LIM, lo slot dei comandi Vault, un eventuale cambio classe e l'indicatore verde animato condividono la stessa fascia senza gerarchia professionale.
La fascia mobile aggiuntiva mostra classe e ritorno a Oggi. In `VaultControls.tsx` #118 porta i controlli Vault nell'intestazione tramite portale; `SecureRegistroRoot` ne conserva autorità e stato.
In `App.tsx` `saveIndicatorText` inizializza «Sincronizzato», viene usato anche dai messaggi `toast` e dopo 2800 ms torna al valore iniziale indipendentemente dall'origine della notifica. Non è una fonte attendibile di persistenza.
Il logo è una `div` cliccabile che richiama `handleNavigateHome`; questa funzione cancella sessioni applicative correnti e selezione della classe, quindi non deve essere l'uscita implicita da un editor.

## 2. Principi e criteri

1. **Contesto prima del marchio:** titolo della vista, classe verificata e attività in corso se nota; non inventare UDA o stati.
2. **Sicurezza senza caccia al menu:** Blocca Registro rimane un comando esplicito a un tocco, in qualunque superficie autenticata, anche durante l'uso del Copilota.
3. **Privacy LIM a vista:** pulsante persistente con stato leggibile e annunciato, indipendente dalla navigazione; impostazione iniziale invariata.
4. **Progressività:** configurazione blocco automatico, scelta classe e dettagli secondari compaiono solo per richiesta esplicita. Non affollare la barra né duplicare la navigazione inferiore o Copilota.
5. **Feedback dimostrabile:** ogni stato di salvataggio deriva da eventi della persistenza durevole, mai dal testo di un toast o da un timeout. Non definire «sincronizzato» un salvataggio locale.
6. **Nessuna perdita silenziosa:** uscite dall'editor, passaggi di classe e ritorno a Oggi rispettano le protezioni di navigazione esistenti.

## 3. Contratto della barra mobile

### 3.1 Riga principale

- Sinistra: pulsante Menu 44×44 CSS px minimo, con `aria-label`, `aria-expanded`, `aria-controls` e ritorno focus alla chiusura.
- Centro flessibile `min-width:0`: titolo della superficie (es. «Oggi», «Valutazioni», «Tabellone», «Programmazione», «Biblioteca privata»), con sottotitolo abbreviabile della classe solo se coerente col contesto professionale attivo.
- Destra: comando Privacy LIM e comando Blocca Registro, ciascuno almeno 44×44 px con identità visiva distinta; concentrare sull'header due azioni, non tre.
- Larghezza 320px: 2 margini da 12px, 3 target da 44px, distanze da 8px e spazio centrale restante minimo ~140px; titolo con troncamento semantico, senza rimpicciolire i target. A 390px il titolo può estendersi.
- L'icona/logo del Registro è visibile su Oggi, nel menu e sulle viste larghe; nelle schermate operative lo spazio è riservato a titolo e contesto. Niente `div` cliccabili.
- Nessuna animazione pulsante o lampeggiante per esiti positivi. Rispetto di `prefers-reduced-motion`.

### 3.2 Riga contestuale leggera (solo quando utile)

- Quando è aperta una classe: presenza compatta della classe e percorso sicuro di ritorno a Oggi, senza duplicare l'attuale banner per definizione.
- Il comando diretto verso Oggi resta reperibile senza percorsi più lunghi dell'attuale, e passa dal medesimo controllo di navigazione protetta.
- Eventuali scorciatoie per cambio classe sono offerte solo fuori dalle modifiche non salvate e senza introdurre un secondo stato «classe corrente».
- Durante l'editing, sottotitolo «Modifica in corso» esclusivamente se proveniente da stato autorevole; non derivare da `activeTab` da solo.

### 3.3 Azioni secondarie

- **Sicurezza** nel menu/pannello: impostazione del blocco automatico con gli stessi valori Mai/15/30/60 min; mantenere callback, proprietario `SecureRegistroRoot`, configurazione corrente, accessibilità e gestione Copilota.
- **Contesto classe**: accesso alla selezione esistente, non un nuovo selettore in competizione. Il docente non deve cambiare classe involontariamente.
- **Salvataggio**: superficie informativa non cliccabile per finta; aprire dettagli solo quando sia presente un'informazione utile e verificata (esito o errore).

## 4. Contratto semantico del salvataggio

Un `SaveStatus` tipizzato è distinto dai messaggi transitori. Si considerano:
- `unknown/idle`: nessuna attestazione di salvataggio; nessun punto verde perpetuo;
- `editing/unsaved`: solo se esiste una segnalazione verificabile di contenuto modificato;
- `saving`: quando un'operazione durevole è in corso, derivata dal coordinatore o dall'operazione interessata;
- `saved-local`: solo alla conferma di completamento positivo della persistenza del dominio interessato; il messaggio esplicita «Archivio locale» e non «Sincronizzato»;
- `error`: derivato da esito negativo e **persistente** fino a nuova condizione verificabile di risoluzione, senza ritorno automatico al verde per timeout.

Controllare le operazioni `commitAppDataMutation`, `commitSettingsMutation`, planning/library/test/submissions e gli altri percorsi durevoli realmente interessati. Non assumere che un singolo commit copra tutti i domini. Evitare una modifica globale non governata: definire prima una politica di aggregazione e un contratto di test che dimostri che nessun errore recente viene nascosto da successivi toast generici. Il testo `toast` resta indipendente da `SaveStatus`.

## 5. Stati e transizioni

| Vista | Titolo | Contesto eventuale | Azioni sempre visibili |
| --- | --- | --- | --- |
| Oggi | Registro Docente / Oggi | nessuna classe inventata | Menu, Privacy, Blocca |
| Riepilogo / Tabellone | Sezione corrente | Classe 2C (esempio) | Menu, Privacy, Blocca |
| Valutazioni / Comportamenti | Sezione corrente | Classe e editing se verificato | Menu, Privacy, Blocca |
| Biblioteca / Programmazione | Sezione corrente | classe/UDA solo se risolta e autorevole | Menu, Privacy, Blocca |
| Salvataggio fallito | Titolo attuale | avviso persistente e leggibile | Menu, Privacy, Blocca |

### 5.1 Navigazione protetta

Qualunque nuova azione «Oggi», logo, breadcrumb o cambio classe deve riutilizzare il medesimo contratto di navigazione sicura per valutazioni, UDA e missioni. Non chiamare direttamente `handleNavigateHome` su schermate con editing senza prima verificarne il comportamento in presenza di dati non salvati. Lo stesso vale per apertura/chiusura dei pannelli contestuali.

### 5.2 Privacy e sicurezza

- LIM `true` all'avvio: stato attivo protetto. Visibilità del nome e significato dell'icona non devono invertirsi.
- Anunciare allo screen reader «Nomi protetti» / «Nomi visibili» e stato `aria-pressed` coerente.
- Blocca Registro resta azionabile quando Copilota è aperto. Il popup delle impostazioni può chiudersi in modo controllato, non il blocco diretto.
- Non toccare cifratura, password, timeout reali, persistente locale, backup e proprietario dell'archivio.

## 6. Desktop e coerenza tra dispositivi

Desktop usa più spazio per titolo, classe e stato leggibile. Lo spostamento dei controlli Vault oggi in basso su desktop è una possibile fase separata, da qualificare in modo esplicito. Il perimetro di HEADER-01 iniziale evita di cambiare più contratti di sicurezza insieme. Nessuna riduzione di accessibilità su schermi stretti, zoom 200% e titoli lunghi.

## 7. Requisiti di verifica

- RED→GREEN: test unitari/stati, geometria, overflow, regressioni di navigazione protetta, fallimento controllato della persistenza, blocco e privacy.
- Chromium: 320×700, 390×844, 1280×900, mobile con tastiera simulata; controlli di focus, scrolling, menu, popover, salvataggio, non sovrapposizione a «Salva Valutazioni di Classe», barre inferiore e Copilota. Vista a 200% zoom/font ingrandito.
- Sicurezza: Invarianti, PREDEPLOY, FLOW-03, UX-TRUST/P2-CORE, suite completa browser, revisione indipendente stesso SHA senza Critical/Important.
- HPR Android essenziale con dati sintetici: titolo leggibile, privacy e blocco raggiungibili, tastiera reale, assenza di occlusione e correttezza percettiva del salvataggio. I PASS Chromium non sono un PASS umano.
- Nessuna distribuzione ordinaria o integrazione prima dell'esito formale HPR e delle dipendenze #104.

## 8. Fuori perimetro e decisioni ancora da qualificare

- Nessuna nuova IA, salvataggio cloud, dato personale o rilevamento automatico della lezione.
- Nessuna sostituzione del Copilota, della navigazione a 5 azioni o del modello CTX-01.
- L'eventuale nuova superficie delle notifiche e la sistemazione desktop Vault non sono implicite nell'incremento iniziale.
- UI concordata a livello di contratto; dettagli visuali finali e implementazione attendono la verifica sul dispositivo di #118.
