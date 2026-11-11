# MOBILE-01/S0 — Prova di confezionamento Android, senza distribuzione

**Data:** 11 novembre 2026
**Stato:** design approvato per prova isolata, non APK di rilascio
**Baseline originale S0:** `main@88325d023886fda4efcf16976b2ab4ff0f929b04`  
**Baseline combinata S0+M1:** `main@94595ae7fd531c1eb4d01c0405449a52ae76ad6f` (M1 integrata, PR #213).
**Autorità:** [roadmap #104](https://github.com/antoniocorsano-boop/registro-docente/issues/104), [Beta 1 #204](https://github.com/antoniocorsano-boop/registro-docente/issues/204), [MOBILE-01 #207](https://github.com/antoniocorsano-boop/registro-docente/issues/207)

## Domanda da risolvere

L'app React/Vite è tecnicamente confezionabile in un contenitore Android senza utilizzare Termux, Node/Express in esecuzione sul telefono o la distribuzione Vercel?

Questa prova produce **solo un APK debug di laboratorio**, senza dati scolastici, icona definitiva, firma di pubblicazione, integrazione in main o autorizzazione di installazione ordinaria.

## Architettura di prova

- **Capacitor 8.6.0** isolato in `mobile/android-probe/` (non aggiunge dipendenze a `package.json` o a `bun.lock` canonici).
- `webDir: ../../dist` come unico contenuto web; la compilazione `bun run build` genera `dist` dal Registro attuale.
- `npx cap add android` e `npx cap sync android` solo nell'esecutore GitHub, generando una cartella Android temporanea; nessun `server.url` remoto.
- Identità deliberatamente distinta e sperimentale: `it.trama.registrodocente.prova`, titolo «Registro Docente - Prova». Nessun percorso di aggiornamento implicito verso app finale.
- Android SDK 36, Java 21, Node 22+, runner GitHub gratuito secondo disponibilità. Artefatto ZIP temporaneo contenente APK debug, SHA-256, SHA del commit sorgente e inventario limiti.
- `on: pull_request` solo sulla relativa PR, con permessi `contents:read`. Nessun `push: main`, nessun rilascio GitHub, nessuna chiave di distribuzione, nessun provider remoto.

## Confini di sicurezza

- **No credenziali reali**: `GEMINI_API_KEY` appartiene a `server.ts`, che NON viene incluso né eseguito nel contenitore. API `/api/...` da considerare indisponibili e da separare/gestire in modo fail-safe nei successivi incrementi.
- **Risorse PDF M1 ora locali**: dopo PR #213, `html2pdf.js@0.10.1`, relativi avvisi di licenza e font di sistema sono disponibili senza CDN. Il nuovo workflow deve verificarne la presenza **negli asset dell'APK** e l'identità dei byte rispetto a `dist`. Un file incluso non dimostra però il suo salvataggio o la condivisione nel WebView Android.
- **No false attestazioni di archivio**: Secure Local Vault usa IndexedDB e Web Crypto; l'involucro potrebbe disporne ma deve essere provato in un vero WebView Android. La memoria del browser non transita automaticamente a quella dell'APK.
- **No falsi aggiornamenti:** firma debug dell'esecutore temporanea, non la futura chiave stabile; non usare l'APK con dati reali.
- **No equivalenza con HPR:** un APK compilato non prova usabilità, stabilità dati o conformità privacy.
- Vietati servizi esterni a pagamento, test con dati personali, publishing e merge automatico.

## Risultato e stato ammissibile

- **S0 PASS (packaging soltanto)** se il workflow genera un file APK debug verificato con SHA-256 sul commit esatto, con origine locale e progetto Android generato.
- **S0 REWORK** se fallisce una dipendenza/compilazione, con log e diagnosi puntuale.
- **MOBILE-01 ancora APERTA** anche con PASS S0: mancano asset completamente locali, PDF/file export/import, verifica Vault WebView, schermate, aggiornamento, firma release stabile e UX-QA-03.

## Successivi incrementi

M1 offline/bundle assets → M2 file e backup Android → M3 navigazione/storage WebView → M4 APK di release firmato e versione stabile → UX-QA-03. Nessuna attività successiva diventa qualificata dalla sola prova S0.

**Riferimenti consultati:** https://capacitorjs.com/docs/android, https://capacitorjs.com/docs/updating/8-0, https://developer.android.com/develop/ui/views/layout/webapps/load-local-content.
