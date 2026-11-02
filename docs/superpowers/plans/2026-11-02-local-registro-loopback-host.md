# LOCAL-REG-01 Configurable Loopback Bind Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Registro Docente bind to `127.0.0.1` when explicitly configured by the Android/Termux supervisor while preserving the hosted default `0.0.0.0`.

**Architecture:** Add one pure environment resolver under `src/server/`, wire it into `server.ts`, and publish one qualification invariant. No browser or persistence surface changes.

**Tech Stack:** TypeScript, Express, Bun tests, existing Qualification Invariants/PREDEPLOY workflows.

**Spec:** `docs/superpowers/specs/2026-11-02-local-registro-loopback-host-design.md`

## Global Constraints

- Environment variable: `TRAMA_BIND_HOST`.
- Unset/empty/whitespace default: exactly `0.0.0.0`.
- Local supervisor value: exactly `127.0.0.1`.
- Existing `PORT` semantics unchanged.
- No browser persistence/UI/backup change.
- No auto-build/update/Termux installation in this repo.

## Review Focus

- Whitespace-only `TRAMA_BIND_HOST` must not produce an invalid host.
- Hosted default must remain externally bindable (`0.0.0.0`).
- `server.ts` must not retain a literal `0.0.0.0` in `app.listen`.
- Browser/user input must not influence the bind host.
- Qualification invariant must cover every changed guarded product path.

---

### Task 1: Pure bind-host contract

**Files:**
- Create: `src/server/runtimeHost.ts`
- Create: `src/security/localRuntimeHostContract.test.ts`

**Interfaces:**
- Produces: `resolveServerBindHost(env: Record<string, string | undefined>): string`.

- [ ] **Step 1: Write the failing test**

Add tests asserting:
- `{}` → `0.0.0.0`;
- `{TRAMA_BIND_HOST: ''}` → `0.0.0.0`;
- whitespace → `0.0.0.0`;
- `127.0.0.1` → `127.0.0.1`;
- surrounding whitespace is trimmed.

- [ ] **Step 2: Run RED**

Run the focused Bun security test.
Expected: FAIL because `src/server/runtimeHost.ts` does not exist.

- [ ] **Step 3: Implement minimal resolver**

Create `resolveServerBindHost` with only the spec rules.

- [ ] **Step 4: Run GREEN**

Run the focused test.
Expected: PASS.

- [ ] **Step 5: Commit**

Commit resolver + focused tests.

### Task 2: Wire production server and governance invariant

**Files:**
- Modify: `server.ts`
- Modify: `src/security/localRuntimeHostContract.test.ts`
- Modify: `qualification/invariants.v1.json`

**Interfaces:**
- Consumes: `resolveServerBindHost` from Task 1.
- Produces: production server configured by `TRAMA_BIND_HOST`.

- [ ] **Step 1: Extend the failing contract test**

Assert `server.ts` imports `resolveServerBindHost`, computes `BIND_HOST`, and passes it to `app.listen(PORT, BIND_HOST, ...)`.
Expected on current server: FAIL because it still binds a literal `0.0.0.0`.

- [ ] **Step 2: Run RED**

Run the focused test and read the causal failure.

- [ ] **Step 3: Wire the resolver**

Modify `server.ts` to resolve the bind host once at startup and use it in `app.listen`; include the host in the startup log.

- [ ] **Step 4: Publish invariant**

Append a stable invariant `LOCAL-REG-01-I01` covering `server.ts`, `src/server/runtimeHost.ts`, and the focused test, stating that local bind configuration is server-side and hosted default remains `0.0.0.0`.

- [ ] **Step 5: Run GREEN + full qualification**

Expected:
- focused security test PASS;
- Qualification Invariants PASS;
- PREDEPLOY typecheck/security/Library/build/startup smoke PASS.

- [ ] **Step 6: Commit**

Commit server wiring + invariant.

### Task 3: Exact-SHA review and integration readiness

**Files:** none unless review finds an Important/Critical issue.

- [ ] **Step 1: Freeze exact candidate and inspect diff**

Expected delta: resolver, focused security test, `server.ts`, invariant registry, and docs only.

- [ ] **Step 2: Fresh whole-slice review**

Review focus: hosted default, environment-only authority, no browser exposure, no startup regression.
Expected: 0 Critical / 0 Important.

- [ ] **Step 3: Mark integration-ready only after parent #99 is integrated**

The branch is stacked on `4fde93a0…`; do not merge ahead of #99.