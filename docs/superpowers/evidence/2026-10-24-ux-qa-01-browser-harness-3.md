# UX-QA-01 — Browser harness diagnostic 3

- Exact SHA osservato: `cc2f24ca9748627c846f7061dd91c5a49365bf37`.
- PREDEPLOY #477: SUCCESS.
- Browser #221 / run `40122449002`: 22 PASS / 1 FAIL prima dell'analyzer.
- Causa: il crawler cercava nel drawer il label abbreviato `Programmazione`, mentre il vocabolario accessibile canonico del prodotto è `Programmazione didattica`.
- Classificazione: test-harness vocabulary drift, non finding prodotto.
- Correzione test-only: usare il label accessibile reale `Programmazione didattica`; nessun file prodotto modificato.
- Artifact diagnostico: `12572470101`.
- Digest: `sha256:9b672bfce9c2c607f28b0164f89a339881cbf72d860088df035f12173fe4dc35`.

Le lesson learned del crawler restano: usare locator semanticamente scoped e vocabolario accessibile reale. Il RED UX valido richiede 23/23 Playwright PASS e failure nel deterministic analyzer.
