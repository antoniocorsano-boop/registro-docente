# UX-QA-01 — Browser harness diagnostic 2

- Exact SHA osservato: `1eb0ec8ddb80c19460d06d48b73733b08df560ae`.
- PREDEPLOY #474 / run `40122161532`: SUCCESS.
- Browser #218 / run `40122161549`: 22 PASS / 1 FAIL prima dell'analyzer.
- Causa: sulla dashboard erano presenti due controlli accessibili con nome `Valutazioni`: la navigazione workflow e la scorciatoia nel contenuto principale. Il crawler usava un locator globale ambiguo.
- Classificazione: test-harness ambiguity, non finding prodotto.
- Correzione test-only: il crawler usa ora `main → Valutazioni`, cioè la scorciatoia utente nel contenuto della dashboard. Nessun file prodotto modificato.
- Artifact diagnostico: `12570719858`.
- Digest: `sha256:e977359226bb3e6c77f1c8a243c144d69ae0dcd9969fcd290451e9346770f725`.

Il successivo RED Browser è valido soltanto se il Playwright explorer termina la raccolta di tutte e nove le osservazioni e il fallimento viene dal deterministic analyzer.
