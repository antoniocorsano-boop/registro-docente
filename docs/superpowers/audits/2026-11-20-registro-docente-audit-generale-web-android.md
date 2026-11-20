# Registro Docente — Audit generale dell'applicazione Web e Android

**Data audit:** 20 novembre 2026  
**Fonte primaria:** [issue di governo #104, riscontro immutato dell'audit](https://github.com/antoniocorsano-boop/registro-docente/issues/104#issuecomment-7042502370)  
**Exact main osservato:** `8d3baab8e513100887c8b81d1dbf7408bebeec6f`  
**Stato:** audit documentale conservato, NON verifica nativa finale / non autorizzazione al rilascio.

> Questo documento conserva l'audit già acquisito senza modificarne retroattivamente osservazioni e limiti. La pianificazione operativa derivata è in [roadmap Web–Android](../plans/2026-11-20-registro-docente-roadmap-web-android.md). La validità degli esiti è riferita ai candidati e alle prove indicate; tutti i riscontri successivi richiedono verifica sul nuovo commit.

---

## AUDIT-APP-2026-11-20 — Audit generale e percorso verso la stabilità (riferimento su main)
**Data:** 20 novembre 2026 · **Ramo osservato:** `main@8d3baab8e513100887c8b81d1dbf7408bebeec6f` · **Perimetro:** inventario dei sorgenti, dei percorsi operativi, issue/PR e CI GitHub. **Non è** una prova fisica sul telefono dell'APK definitivo né una revisione specialistica di sicurezza. Nessuna modifica a codice, dati personali, firma o distribuzione è autorizzata con questo rapporto.

### Evidenze verificate
- DOC-01 #379–#383: **55/55 workflow PASS** sugli exact SHA delle rispettive PR; #383 integrata in un unico squash, #379–#382 chiuse come sostituite. Su nuovo main il workflow **PREDEPLOY Security Qualification PASS** (run 44754156932); i gate delle PR non sostituiscono la qualifica nativa su un APK finale firmato.
- Inventario: **27 issue aperte** e **120 PR aperte** (molte PR storiche di laboratorio o cumulate, NON 120 bug).
- GitHub Releases: nessuna release pubblicata; `vercel.json` mantiene `git.deploymentEnabled=false`. La Beta personale Android RC2 precedentemente installata non viene aggiornata da un merge su main.
- Candidato di rilascio storico #325 `6063fc0ff2809584c266b3161dafea9ffba92a8d` **divergente da main** (origine comune `5ed2eb11...`, diverso per 84 file tra proprie aggiunte/modifiche; contiene componenti di migrazione/recupero e workflow non identici al nuovo main). Vietato assumere che la protezione del candidato #325 sia già ereditata dal nuovo main o fondere indiscriminatamente i due rami.
- `src/main.tsx` monta `SecureRegistroRoot`; `src/security/initialArchiveSetup.ts` distingue archivio professionale vuoto da ambiente dimostrativo; `src/components/SecureRegistroRoot.tsx` e `mobile/android-probe/native/MainActivity.java` contengono protezione di sessione, schermo protetto e gestione Back. Le vecchie issue #217/#242/#262 richiedono quindi **riconciliazione con il codice corrente e HPR fisica**, non implementazione presunta mancante.
- Tabellone giornaliero/storico, Consigli, scheda Essenziale/Dossier/Restituzione, programmazione, UDA, Biblioteca, Privacy e backup sono collegati in `src/App.tsx`. Il motore `src/assessment` S5–S8 e lo storico/documenti `src/documents` con recupero V8/V9 sono in gran parte componenti di dominio/laboratorio: non risultano collegati come percorso completo di valutazione/documentazione professionale in `App`. `PrivacyView` ammette un driver di recupero documentale opzionale non passato dall'App ordinaria. V9 resta non attivato.
- Android incorpora risorse WebView, non il server Node/Express; servizi IA remoti in `server.ts` sono condizionati da disponibilità/configurazione e controlli di classificazione/consenso. Da verificare sempre l'effettivo comportamento privo di rete e non promettere IA locale nativa non attestata.

### Priorità — non riprendere sviluppi duplicati
**P0 / Stabilità e rilascio (prima di qualunque dato reale):**
1. Nominare un *nuovo candidato esatto* partendo dall'attuale main e **riconciliare**, file per file, i controlli di migrazione, bootstrap, recupero e compatibilità rispetto a #325; nessuna fusione cieca né perdita di controlli storici.
2. **R1**: revisione specialistica indipendente #323 con perimetro aggiornato al nuovo candidato, distinta da Codex/CI. **R2**: recupero/migrazione Android S-R04b #307 con risoluzione autorizzata, archivio sintetico, nuova installazione, interruzione, annullamento, revoca, password errata, downgrade rifiutato e confronto inventario. **R3**: pacchetto definitivo con stessa identità e certificato del telefono, versionCode crescente (>10004), file originale, SHA e prova aggiornamento; nessuna chiave in CI.
3. **HPR del docente** sullo stesso candidato Android: avvio/archivio professionale vs demo, navigazione Indietro e bozze, blocco-ripresa e recenti, voto/comportamento offline, copia cifrata effettiva e ripristino, PDF mascherato, riapertura dopo arresto, semplicità 320/390px e caratteri ingranditi. Registrare PASS/REWORK separatamente dalle prove automatiche.
4. Nessun rilascio pubblico, firma/distribuzione automatica o uso di dati reali prima dell'approvazione esplicita e dei tre gate. Conservare la versione precedente e la copia cifrata effettivamente verificata.

**P1 / Prodotto quotidiano e manutenzione:**
5. Consolidare il percorso **Prepara → Conduci → Registra → Rivedi → Riusa**, testandolo con 2–3 lezioni sintetiche; unico contesto, meno schermate, Tabellone a righe, stato del salvataggio comprensibile e ritorno contestuale. Riferimenti #104/#125/#235/#242.
6. Riconciliare #217, #262, #234, #227, #94/#95 e le issue HPR con l'effettivo nuovo main; chiudere come soddisfatte solo dopo evidenza pertinente. Razionalizzare le 120 PR storiche **per filone e albero di dipendenze**, senza mass-merge e senza perdere tracciabilità.

**P2 / Valutazione e documentazione professionale:**
7. Integrare in modo limitato `src/assessment` con il Tabellone e le schede: prova svolta/criterio, evidenza osservata, rubrica, livelli e bilancio derivato; approvazione esplicita, nessuna deduzione automatica sfavorevole, nessuna IA valutativa. #231/#227.
8. Completare il ciclo Consigli annuale #170 (sedute, monitoraggi, proposte del docente separate dagli atti collegiali). Rendere operativi i documenti #171 (fonti e provenienza, programmazione, programma svolto, relazione finale, revisioni, anteprima, esportazione locale DOCX/PDF) con conferma umana. **V9 professionale solo dopo gate di sicurezza, dati e HPR specifici**.
9. Raccordi TRAMA: Arena curricolo approvato → Docente OS progettazione → Registro evidenze locali → Atlas contenuti educativi, tramite soli contratti e dati ammessi, senza sincronizzazione di dati degli alunni.

**P3 / Evoluzioni successive e qualità permanente:**
10. Copilota realmente contestuale e discreto, memoria semantica locale opzionale, uso offline autonomo e verificato, senza costi impliciti. Pilotare Biome/Knip e modularizzazione progressiva di `App.tsx` dopo il candidato stabile; strumenti SQ-01/SQ-02 #327 **non** sostituiscono R1.

### Tabella di marcia e condizioni di avanzamento
- **Fase A — Riconciliazione del rilascio:** una matrice esatta `main ↔ #325 ↔ APK installato`, elenco rischi non coperti e una sola PR candidata.
- **Fase B — Accettazione stabilità:** R1/R2/R3 documentati e HPR Android completa sul candidato esatto. **Uscita:** versione utilizzabile con prova vera di continuità senza perdita, approvazione separata della firma/distribuzione.
- **Fase C — Usabilità docente:** giornata tipo su 320/390px e su telefono, zero perdita bozze, stato certo dei salvataggi, nessun passo superfluo dimostrato.
- **Fase D — Valutazione integrata:** una prova reale **sintetica** attraversa obiettivo→criterio→registrazione→bilancio→restituzione approvata.
- **Fase E — Consigli e documentazione:** una seduta e un documento annuale completi con fonti verificabili, versione e PDF/DOCX locale, senza decisioni ufficiali automatiche.
- **Fase F — Integrazioni e maturità 1.0:** flussi interoperabili senza dati personali sul cloud, aggiornamenti ripetibili, assistenza/qualità e manutenzione sostenibili.

**Decisione dell'audit:** il problema prioritario è oggi **la promozione controllata e l'accettazione professionale**, non l'avvio di un'ulteriore grande architettura. Il codice qualificato non equivale alla disponibilità in APK né alla validazione istituzionale. Conservare questo audit come nuovo checkpoint per #104/#326/#210; i riferimenti storici restano consultabili, ma nessuna descrizione basata solo sul vecchio `main@5ed2eb11` deve essere presentata come stato corrente.

---

## Regole di lettura e di aggiornamento

- **Implementato** non significa **attivato nell'interfaccia**, **presente nel sito pubblico** o **installato sul telefono**.
- **Qualificato in laboratorio** non significa **approvato per dati reali**.
- La situazione numerica di issue/PR e le verifiche CI sono una fotografia del 20 novembre, non un contatore automaticamente aggiornato.
- Questo audit non si sovrascrive per far sparire rilievi storici: i successivi riscontri riportano data, esatto commit, prove e decisioni nella roadmap o nella questione #104.
- Il prodotto di riferimento è l'unica applicazione Registro Docente, con due forme di accesso: browser Web e pacchetto Android. Le due distribuzioni devono usare un candidato tracciabile e prove distinte.
