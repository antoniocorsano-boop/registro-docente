# UX-TRUST-01 Option B — Qualification Receipt

Date: 2026-10-24
Repository: `antoniocorsano-boop/registro-docente`
PR: `#30` — `UX-TRUST-01 — Option B implementation`
Candidate branch: `feat/ux-trust-01-option-b`
Qualified exact SHA: `1f98efb6638a5ef43d3da94f671fae2ca5a6b614`
Base: `docs/ux-trust-01-audit-baseline@58ad8ea3e9195b830c6fc1d87d49f6099214c0cc`
Product baseline: `main@ad4dfcc2fabacbb05ce7d9a080ad06be73de0fed`

## Qualification status

UXT-A through UXT-F are technically qualified on the exact candidate above.

- Engineering qualification: PASS
- Real-browser qualification: PASS
- Independent Codex review: PASS
- Unresolved Important/Critical findings: 0
- Human integration decision: APPROVED / EXECUTED
- Audit baseline PR #29: MERGED
- Application PR #30: MERGED
- Deploy/publication: NOT AUTHORIZED / NOT PERFORMED

This receipt was authored on the separate documentation branch `docs/ux-trust-01-qualification-receipt`, created directly from the qualified candidate SHA. The receipt commit is documentation-only and is not a replacement candidate. The qualified application candidate remains exactly `1f98efb6638a5ef43d3da94f671fae2ca5a6b614`; no qualification evidence is transferred to the receipt commit or to a later integration SHA.

## UXT-F scope

UXT-F adds only qualification harness/workflow coverage. It introduces no product-component change.

Files added/changed for UXT-F qualification:

- `tests/browser/ux-trust-01-full-regression.spec.cjs`
- `.github/workflows/browser-qualification.yml`

The full inventory exercises, at both 390×844 and 1280×900:

- Home
- Riepilogo
- Valutazioni
- Comportamento
- Tabellone
- Analisi
- Storico
- Scheda alunno
- Gestione alunni
- Verifiche online
- UDA
- Impostazioni
- Privacy
- Privacy Shield
- Student Portal

The UXT-F harness fails closed on uncaught page errors and unexpected console errors, checks document-level horizontal overflow at the inventory checkpoints, and verifies Student Portal viewport isolation.

## UXT-F harness correction history

Initial test/workflow candidate: `6df40027360fe90bfcd6f8f6bff0556e4e5f35dd`.

PREDEPLOY #318 / run `40074809473` passed on that SHA, but Browser Qualification #71 / run `40074809498` produced 13 PASS / 2 FAIL. Both failures were fixture-only: the synthetic class had zero students, so `StudentReportView` correctly rendered `Nessun alunno presente nella classe.` before the full student-report heading. This run is excluded as product-causal evidence.

Excluded Browser #71 artifact:

- artifact ID: `12552687864`
- SHA256: `066ef12ef475d6a4cc71541513958cc59db5620c6739ad15d19a2fcf9168a328`

Minimal test-only correction: `1f98efb6638a5ef43d3da94f671fae2ca5a6b614` (`test(browser): seed UXT-F student report fixture`). The fixture now adds one synthetic student before exercising `Scheda alunno`; the full route marker remains required rather than weakening the assertion.

## Exact-head engineering qualification

PREDEPLOY Security Qualification #319

- run ID: `40075017659`
- exact SHA: `1f98efb6638a5ef43d3da94f671fae2ca5a6b614`
- conclusion: PASS
- locked install: PASS (`bun install --frozen-lockfile`)
- lint/typecheck: PASS
- security tests: 235 PASS / 0 FAIL
- assertions: 1457 `expect()` calls
- security test files: 46
- production build: PASS
- Vite: 8.3.4, 2521 modules transformed
- production startup smoke: PASS

## Exact-head browser qualification

Browser Qualification #72

- run ID: `40075017775`
- exact SHA: `1f98efb6638a5ef43d3da94f671fae2ca5a6b614`
- conclusion: PASS
- Playwright: 1.64.1 / Chromium
- total browser tests: 15 PASS / 0 FAIL
- duration: 28.2 s
- UXT-F inventory mobile 390×844: PASS
- UXT-F inventory desktop 1280×900: PASS
- existing UXT-A…E, ONLINE-01 and RELEASE-01 browser qualification cases: PASS

Browser evidence artifact:

- artifact ID: `12552188548`
- artifact SHA256: `41d686cdded4240f138c65afcb1b967bab26020a2e3770e6facbb4781ba6898c`
- final artifact size: 1,407,209 bytes
- files uploaded: 20

## Independent final review

Codex review request comment: `6381572052`.

Review was explicitly scoped only to exact SHA `1f98efb6638a5ef43d3da94f671fae2ca5a6b614`, with no transfer of approval or findings from earlier SHAs.

Final Codex state:

- status: COMPLETED
- reviewed commit: `1f98efb6638a5ef43d3da94f671fae2ca5a6b614`
- findings: 0
- unresolved findings: 0
- new UXT-F review threads: 0
- earlier UXT-A P1 thread: resolved

## Human integration decision and execution

The separate human integration decision was approved on 2026-10-24 after the exact-candidate qualification above.

Integration sequence:

1. Audit baseline PR #29 was moved from Draft to Ready and merged into `main` from exact head `58ad8ea3e9195b830c6fc1d87d49f6099214c0cc`.
   - merge commit: `c1fce98f977c27e6fdf711c53202435128e33c9d`
2. PR #30 was retargeted from `docs/ux-trust-01-audit-baseline` to `main` without changing its head.
   - retained exact head: `1f98efb6638a5ef43d3da94f671fae2ca5a6b614`
   - mergeability after retarget: clean
3. PR #30 was moved from Draft to Ready and merged with `expected_head_sha` pinned to the qualified exact candidate.
   - application merge commit: `7491ed86941ca677b49ce15bb413affe45971cdd`

Tree identity was verified after merge:

- qualified candidate tree: `cce9c8ae9f9b8c161aa65b79cb77420911ca195c`
- application merge tree: `cce9c8ae9f9b8c161aa65b79cb77420911ca195c`

The merge therefore introduced no byte-level change relative to the qualified application candidate. This identity check does not relabel the merge commit as the exact candidate and does not transfer the Browser #72 receipt to a new SHA.

## Post-integration verification

PREDEPLOY Security Qualification #321 started automatically on the application merge through the `push` event.

- run ID: `40075547236`
- integration SHA: `7491ed86941ca677b49ce15bb413affe45971cdd`
- integration tree: `cce9c8ae9f9b8c161aa65b79cb77420911ca195c`
- conclusion: PASS

No separate post-merge Browser Qualification is claimed here. Canonical browser evidence remains Browser #72 on exact candidate `1f98efb6638a5ef43d3da94f671fae2ca5a6b614`; the application merge is additionally protected by verified tree identity.

## Final boundary

Canonical technical state:

`UX-TRUST-01 Option B / UXT-A→F = ENGINEERING QUALIFIED / REAL-BROWSER QUALIFIED / INDEPENDENT REVIEW PASS / INTEGRATED`

Exact qualified application checkpoint:

`1f98efb6638a5ef43d3da94f671fae2ca5a6b614`

Integrated application commit:

`7491ed86941ca677b49ce15bb413affe45971cdd`

Receipt integration path: PR #33, documentation-only. The receipt does not create a new application candidate and does not inherit or transfer application qualification.

No deploy, publication, production-data mutation, persistence/security redesign, grading change, or Student Portal change is authorized by this receipt.