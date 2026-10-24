# UX-QA-01 RED ledger

## Analyzer surface RED

- Exact SHA: `b10b76bc57fd4a43eb316a27f8632f86e14a16ad`
- PREDEPLOY #463 / run `40121246841`: FAIL causale.
- Security: 304 PASS / 1 FAIL.
- Unico failure: superfici UX-QA ancora assenti.
- Typecheck, build e production startup smoke: PASS.

## Analyzer behavior RED

- Exact SHA: `677c0a7806d2a3e5cafb7470134a42de3f32c148`
- PREDEPLOY #467 / run `40121508585`: FAIL causale.
- Security: 306 PASS / 1 FAIL, 1824 expect(), 307 test, 62 file.
- Unico failure: P0/P1 non bloccavano perché l'analyzer minimale restituiva sempre PASS.
- Typecheck, build e production startup smoke: PASS.

## Browser harness diagnostic

- Exact SHA: `607dc4f5690a5f27df528d8f40bebdc6c01e077f`
- Browser #215 / run `40121922553`: 22 PASS / 1 FAIL prima dell'analyzer.
- Causa: il helper del crawler cercava `Classi` senza limitarlo al drawer; dopo l'apertura del menu esistevano due controlli omonimi (back contestuale + voce drawer).
- Classificazione: test-harness ambiguity, non finding prodotto.
- Correzione: locator ristretto semanticamente a `aside` nel solo browser test; nessun file prodotto modificato.
- Artifact diagnostico: `12570824340`, digest `sha256:e9aa073f2410c730ecfeef3b676f0d122f8c125145dadcb7626a2ff048264a2b`.

Il successivo RED browser è valido soltanto se Playwright completa la raccolta evidence e il fallimento avviene nel deterministic analyzer sugli invariant UX.
