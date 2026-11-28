# BETA-CLOSE-01 — Registro di consolidamento

PR #416, ramo `candidate/cand-prod-01`, predecessore `2e53609d1e627d008e745f043b4e8909b8ed02c3`.
Il candidato è il commit che introduce questo registro. Il gate produttivo R2 resta HOLD.

Il fascicolo BETA-CLOSE-01-R1-CONSOLIDAMENTO ha SHA-256
`aea76e8bdabaa11b2b0275626f470d5cb7e8895404b49bcc9f14d2cdc3fc642a`.
Il manifesto verifica 12 file e il generatore verifica 30 sorgenti del predecessore.

| Rilievo | Controllo permanente |
| --- | --- |
| CR06 | Chromium con IndexedDB e WebCrypto reali. Creazione e migrazione sintetiche, abort confermato, ack perso, esito incerto, concorrenza, revoca, riapertura e retry. |
| CR08 | Jq effettivo in F2 e controlli contrattuali. I contatori sono interi rappresentabili entro i limiti previsti. |
| M08 | Verifica del socket CDP trattenuto dopo l'ultima lettura concorrente. Se perde focus con più WebView attive, il socket viene chiuso e la selezione va ripetuta. Variazioni successive del focus restano possibili. |
| M16–18 | Contratti Bun sul confine backup legacy e sull'ordine e presenza delle chiamate V7. |
| N01 | Conservato come rilievo informativo, come indicato nel triage del fascicolo. |

Le prove Chromium sul flusso reale passano da 9/16 sul predecessore a 16/16.
Il collaudo browser locale del nuovo contratto e delle viste 320/390 ha esito 10/10.
Sono passati typecheck, build, 1.983 prove di sicurezza e memoria e i contratti
nativi locali. La prova di selezione del socket e i contratti sui contatori
falliscono sul predecessore per le condizioni attese.

La prima revisione indipendente ha riprodotto un conflitto tra attività Android
riprese e un input Appium JSON malformato. Le regressioni aggiunte verificano
la precedenza di `topResumedActivity`, l'arresto su evidenze ambigue e il rifiuto
di eventi invalidi prima di qualsiasi esito positivo.

La PR deve mostrare l'esito cumulativo sull'intero SHA e la revisione indipendente.
GOV-ADMISSION richiede attestazione esterna di SHA, genitore, albero, blob e modalità. L'ammissione di laboratorio preserva la genealogia congelata e il delta autorizzato. L'attestazione precedente resta riferita al proprio SHA. La decisione umana di rilascio resta sospesa.

Fonti operative [PR #416](https://github.com/antoniocorsano-boop/registro-docente/pull/416) e [registro #323](https://github.com/antoniocorsano-boop/registro-docente/issues/323).
