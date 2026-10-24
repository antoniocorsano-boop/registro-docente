# UX-QA-01 — Causal browser RED

## Exact candidate

`2261932a8381efbf28e8329011bd4edeece218f8`

## PREDEPLOY

PREDEPLOY #480 / run `40122692575`: SUCCESS.

- exact checkout PASS;
- frozen install PASS;
- typecheck PASS;
- security tests PASS;
- production build PASS;
- production startup smoke PASS.

## Browser Qualification

Browser #224 / run `40122692569`: FAILURE causale nel deterministic analyzer.

- exact checkout PASS;
- frozen install + production build PASS;
- production server readiness PASS;
- **23/23 Playwright PASS**;
- UX explorer ha scritto tutte le nove osservazioni;
- deterministic analyzer: FAIL sui soli finding UX bloccanti sotto.

### Finding P0

- `UXNAV-001` — Home riattiva un `currentClassId` persistito invece di partire senza classe attiva.
- `UXNAV-004` — da Valutazioni il primo Browser Back salta direttamente verso Home invece di ripristinare prima il Riepilogo della stessa classe.

### Finding P1

- `UXNAV-005` — mancano le viste esplicite `Classi / Sintesi / Confronto` con `Classi` default.
- `UXNAV-006` — KPI globali e confronto sono entrambi visibili nella Home invece di essere progressivamente dischiusi.
- `UXNAV-007` — nessuna class card espone ancora il contratto compatto/categoriale del nuovo Home.
- `UXNAV-008` — nessun overflow orizzontale, ma il controllo primario `Nuova Classe` misura circa 130×34 CSS px, sotto il minimo touch 44px.

### Invarianti già PASS e da preservare

- `UXNAV-002` — la navigazione specifica di classe non è presente su Home neutralizzata esplicitamente.
- `UXNAV-003` — Back da dashboard classe a Home è già corretto.
- `UXNAV-009` — zero `pageerror` fino all'ultima evidence capture.

## Artifact

- ID `12572185693`
- digest `sha256:8eb9c7450f6f7ed80897aefac70dff2cdb2d8a9294140f0d08179f7152de47bb`

Questo RED autorizza Task 3 esclusivamente entro i confini dei sei finding osservati. I tre invarianti già PASS non devono essere indeboliti.
