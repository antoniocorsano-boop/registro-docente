# LSM-01D Registro Zero-Token Activation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** sostituire il campo token della Memoria semantica locale con un singolo gesto `Attiva memoria locale`, ottenendo una capacità effimera dal runtime Termux senza persistere segreti nel Registro.

**Architecture:** il consumer aggiunge un bootstrap HTTP separato dal `LocalSemanticMemoryPort`. Il bootstrap `POST /v1/session` avviene solo dopo gesto esplicito, valida capability + health, poi costruisce il client LSM esistente con la capability in memoria. UI e stato sessione non serializzano il token; sync e search restano espliciti e governati.

**Tech Stack:** React 19, TypeScript, Bun test runner, Vite, existing Secure Local Vault, Playwright/Chromium qualification.

**Spec:** `docs/superpowers/specs/2026-11-01-lsm-01d-registro-zero-token-design.md`

## Global Constraints

- Base esatta: `33d486db1e2258a82ccd016274ab8db0d3e1b691`; nessuna modifica alla PR #97.
- Nessun token nel DOM, `AppSettings`, Secure Vault, localStorage, sessionStorage o backup.
- Nessun probe a `:8765` al semplice caricamento della pagina.
- `Attiva memoria locale` è il solo trigger di bootstrap iniziale.
- `Attiva` non esegue `Sincronizza`.
- Dopo reload lo stato torna `Non attiva` e serve un nuovo tap, senza digitazione.
- Endpoint solo HTTP loopback e stesse restrizioni del client LSM-01C.
- Nessun auto-retry di write/sync dopo 401/session expiry.
- Classi dati, CAS e projection rules LSM-01C restano invariati.

## Review Focus

1. **Doppio tap su Attiva:** una sola bootstrap request deve essere in flight; la CTA resta disabilitata durante `connecting`.
2. **Bootstrap malformed/expired-at-issue:** fallisce closed e non costruisce il port LSM.
3. **401 durante sync/search:** la sessione deve essere invalidata senza retry di side effect o modifica canonica.
4. **Reload dopo sessione pronta:** nessun network probe automatico e nessun segreto recuperato da storage.
5. **Runtime assente:** Biblioteca e ricerca testuale ordinaria restano usabili; l’errore LSM non deve bloccare il resto dell’app.

---

### Task 1: Bootstrap HTTP di sessione

**Files:**
- Create: `src/semanticMemory/sessionBootstrap.ts`
- Create: `src/security/lsm01dSessionBootstrapContract.test.ts`

**Interfaces:**
- Consumes: `SemanticMemoryHealthV1`, validatore health esistente, regole endpoint loopback equivalenti a `httpClient.ts`.
- Produces:

```ts
export interface SemanticMemorySessionBootstrapResult {
  token: string;
  expiresAt: string;
  health: SemanticMemoryHealthV1;
}

export async function activateSemanticMemorySession(input: {
  endpointUrl: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<SemanticMemorySessionBootstrapResult>;
```

- [ ] **Step 1: Write failing contract tests**

Testare:

- endpoint non-loopback/https rifiutato prima di fetch;
- zero fetch alla costruzione/import;
- chiamata esplicita usa `POST /v1/session`;
- `redirect:'error'`, `cache:'no-store'`, `credentials:'omit'`, `targetAddressSpace:'loopback'`;
- risposta valida richiede schema `trama.semantic-memory-session/v1`, token non blank, expiry ISO futura e health valido;
- response malformed/HTTP non-2xx/timeout → errore tipizzato e nessun valore parziale.

- [ ] **Step 2: Run RED**

```bash
bun test src/security/lsm01dSessionBootstrapContract.test.ts
```

Expected: FAIL perché il modulo non esiste.

- [ ] **Step 3: Implement bootstrap**

Riutilizzare/estrarre la normalizzazione endpoint per evitare due implementazioni divergenti. Non salvare token in variabili globali o storage.

- [ ] **Step 4: Run GREEN**

Stesso comando. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/semanticMemory/sessionBootstrap.ts src/semanticMemory/httpClient.ts src/security/lsm01dSessionBootstrapContract.test.ts
git commit -m "feat(lsm-01d): bootstrap local semantic memory sessions"
```

---

### Task 2: UI zero-token e stato session-only

**Files:**
- Modify: `src/components/SemanticMemorySettings.tsx`
- Modify: `src/App.tsx`
- Create: `src/security/lsm01dZeroTokenSettingsContract.test.ts`

**Interfaces:**
- Consumes: `activateSemanticMemorySession()` e `createSemanticMemoryHttpClient({ endpointUrl, token })`.
- Produces: `SemanticMemoryConnectInput { endpoint: string }`; `SemanticMemorySessionView.expiresAt: string | null`.

- [ ] **Step 1: Write failing UI/security contract**

Assert sul sorgente/render:

- nessun label/input `Token di sessione`;
- CTA esatta `Attiva memoria locale`;
- stato iniziale `Non attiva`/copy coerente;
- `onConnect` riceve solo endpoint;
- nessun `localStorage`, `sessionStorage`, settings/vault write del token;
- `Sincronizza` resta disabilitato finché la sessione non è `ready|degraded`.

- [ ] **Step 2: Run RED**

```bash
bun test src/security/lsm01dZeroTokenSettingsContract.test.ts
```

Expected: FAIL sul campo token attuale.

- [ ] **Step 3: Implement UI**

In `SemanticMemorySettings.tsx`:

- rimuovere state/input token;
- rinominare connect in `Attiva memoria locale`;
- usare `endpoint` come unico input tecnico, preferibilmente sotto copy secondaria senza introdurre nuova persistenza.

In `App.tsx`:

- al tap chiamare bootstrap;
- creare il client LSM con token effimero;
- conservare solo il client nel `semanticMemoryPortRef`;
- salvare in `SemanticMemorySessionView` solo endpoint, health, expiry e sync state.

- [ ] **Step 4: Run GREEN**

Stesso comando. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/SemanticMemorySettings.tsx src/App.tsx src/security/lsm01dZeroTokenSettingsContract.test.ts
git commit -m "feat(lsm-01d): replace token entry with one-tap local activation"
```

---

### Task 3: Session expiry fail-closed su sync e search

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/semanticMemory/libraryRetrieval.ts` only if needed for error propagation contract
- Modify/Create: `src/security/lsm01dSessionExpiryContract.test.ts`

**Interfaces:**
- Consumes: `SemanticMemoryHttpError.code === 'HTTP_401'`.
- Produces: helper app-level `invalidateSemanticMemorySession(reason?: string)` oppure equivalente unico percorso di reset.

- [ ] **Step 1: Write failing expiry tests**

Fissare:

- 401 durante sync → nessun retry, sessione `disconnected`/errore `SESSION_EXPIRED`, port ref nullo;
- 401 durante search → retrieval non viene trasformato in “nessun match” silenzioso; UI torna a memoria non attiva con messaggio riattivazione;
- nessuna write canonica viene eseguita come conseguenza dell’errore.

- [ ] **Step 2: Run RED**

```bash
bun test src/security/lsm01dSessionExpiryContract.test.ts
```

Expected: FAIL perché il reset centralizzato non esiste.

- [ ] **Step 3: Implement single invalidation path**

Centralizzare azzeramento `semanticMemoryPortRef`, session view e syncing flag. Non auto-bootstrap e non auto-retry.

- [ ] **Step 4: Run GREEN**

Stesso comando. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/semanticMemory/libraryRetrieval.ts src/security/lsm01dSessionExpiryContract.test.ts
git commit -m "fix(lsm-01d): fail closed when local session expires"
```

---

### Task 4: Browser journey zero-token

**Files:**
- Modify: `tests/browser/lsm-01c-consumer.spec.cjs` or create `tests/browser/lsm-01d-zero-token.spec.cjs`
- Modify: `.github/workflows/browser-qualification.yml` only if the new dedicated spec is not already selected by existing glob/commands.

**Interfaces:**
- Consumes: runtime fixture/mock con `/v1/session` + endpoint LSM storici.
- Produces: browser evidence per zero-probe, activate, sync, reload, re-activate.

- [ ] **Step 1: Write RED browser journey**

Journey 390×844:

1. apri Impostazioni;
2. assert nessun input token;
3. assert zero request `/v1/session` prima del tap;
4. tap `Attiva memoria locale`;
5. assert una session request e stato `Pronta`;
6. assert nessun upsert/search automatico;
7. tap `Sincronizza`, assert operazioni governate;
8. reload;
9. assert `Non attiva` e zero auto-probe;
10. nuovo tap → `Pronta` senza digitazione.

- [ ] **Step 2: Run RED**

Usare il comando Browser Qualification locale già adottato dal repository per il singolo spec. Expected: FAIL sul campo token/assenza bootstrap.

- [ ] **Step 3: Align fixture and product only as causally required**

Non reintrodurre fallback al master token nel browser. La fixture deve simulare capability effimera separata.

- [ ] **Step 4: Run GREEN desktop + mobile 390×844**

Expected: PASS, nessuna sovrapposizione FAB/CTA.

- [ ] **Step 5: Commit**

```bash
git add tests/browser/lsm-01d-zero-token.spec.cjs .github/workflows/browser-qualification.yml
git commit -m "test(lsm-01d): qualify zero-token local activation journey"
```

---

### Task 5: Regressione e Android/Termux smoke reale

**Files:**
- No product changes unless causal regressions are found.

**Interfaces:**
- Consumes: runtime LSM-01D exact-qualified candidate + Tasks 1–4.
- Produces: exact-SHA consumer candidate qualificabile.

- [ ] **Step 1: Product tests**

```bash
bun test
bun run typecheck
bun run build
```

Expected: PASS.

- [ ] **Step 2: Browser qualification**

Eseguire LSM-01D dedicated journey, LSM-01C consumer regression e historical Chromium gates applicabili. Expected: PASS.

- [ ] **Step 3: Android real smoke**

Su Termux/runtime exact SHA:

```text
Registro reload
→ Impostazioni
→ nessun token visibile
→ Attiva memoria locale
→ Pronta
→ Sincronizza
→ Biblioteca / Ricerca per significato
→ risultato professionale pertinente
→ reload
→ Non attiva
→ Attiva memoria locale
→ Pronta senza token
```

- [ ] **Step 4: Security inspection**

Verificare che token/capability non compaiano in backup, storage canonico, DOM, URL, log browser o screenshot di evidenza.

- [ ] **Step 5: Freeze exact SHA**

Registrare SHA e gate. Nessun merge/deploy senza decisione separata.
