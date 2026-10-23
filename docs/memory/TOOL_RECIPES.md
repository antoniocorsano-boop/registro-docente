# Tool Recipes

Procedure operative riutilizzabili. Ogni recipe deve indicare quando è valida e quali evidenze produce.

## TR-001 — Exact-SHA GitHub Actions qualification
- Stato: ACTIVE
- Quando usarla: gate tecnici eseguiti su pull request o invocazione manuale.
- Candidate: `github.event.pull_request.head.sha` per `pull_request`; `github.sha` negli altri casi.
- Passi:
  1. Esportare il candidate SHA in una variabile esplicita.
  2. Passare il candidate come `ref` ad `actions/checkout`.
  3. Verificare `git rev-parse HEAD` contro il candidate prima di installare/buildare/testare.
  4. Trattare un mismatch come FAIL immediato.
- Evidenza minima: candidate dichiarato, SHA effettivamente checkoutato, esito del gate.
- Regole collegate: OR-001, OR-003.

## TR-002 — Frozen application dependencies
- Stato: ACTIVE
- Quando usarla: qualificazione dell'applicazione in CI.
- Passi:
  1. Configurare Bun con il workflow del repository.
  2. Eseguire `bun install --frozen-lockfile`.
  3. Non rigenerare né modificare `bun.lock` durante la qualificazione.
  4. Eseguire build/test soltanto dopo installazione riuscita.
- Evidenza minima: step installazione PASS e lockfile invariato.
- Regole collegate: OR-003, OR-007.

## TR-003 — Stable browser qualification
- Stato: ACTIVE
- Quando usarla: certificazione browser canonica del candidate.
- Ambiente: runner GitHub effimero `ubuntu-22.04`.
- Toolchain browser: `@playwright/test@1.64.1` installato in directory temporanea separata dalle dipendenze applicative.
- Passi:
  1. Applicare TR-001.
  2. Applicare TR-002.
  3. Eseguire `bun run build`.
  4. Avviare `NODE_ENV=production PORT=4173 bun run start`.
  5. Attendere readiness HTTP con timeout finito.
  6. Installare Chromium tramite il Playwright pinning previsto dal workflow.
  7. Eseguire il browser smoke sul server di produzione reale.
  8. Conservare screenshot, JSON di evidenza, log server e risultati Playwright con `if: always()`.
- Smoke minimo: HTTP 200, titolo Registro Docente, `#root` visibile e non vuoto, nessun `pageerror` non gestito.
- Dati: solo sintetici; nessun secret richiesto.
- Evidenza minima: exact SHA + build + readiness + Playwright PASS + artifact upload tentato.
- Regole collegate: OR-001, OR-003, OR-004, OR-005.

## TR-004 — Browser manuale diagnostico
- Stato: ACTIVE
- Quando usarla: riproduzione locale, esplorazione visiva, diagnosi interattiva.
- Vincolo: non sostituisce TR-003 quando serve una certificazione canonica.
- Evidenza: screenshot/log/annotazioni utili alla diagnosi, chiaramente marcati come non canonici se l'ambiente non è riproducibile.
- Regole collegate: OR-004.
