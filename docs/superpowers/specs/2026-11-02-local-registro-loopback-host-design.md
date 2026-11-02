# LOCAL-REG-01 — Configurable local bind for Registro Docente

**Status:** APPROVED FOR IMPLEMENTATION

## Intent

Enable the production Registro Docente server to run safely as an Android/Termux local service without changing hosted behavior.

The local service must be reachable only through loopback when explicitly configured by the device supervisor. Hosted environments must keep the current default bind behavior.

## Goals

- Add one server-side environment variable: `TRAMA_BIND_HOST`.
- Default bind remains exactly `0.0.0.0` when `TRAMA_BIND_HOST` is unset, empty, or whitespace.
- `TRAMA_BIND_HOST=127.0.0.1` makes the production server listen only on IPv4 loopback.
- Preserve existing `PORT` behavior and all application/API behavior.
- Keep the setting server-side only; it must not enter browser persistence, UI, backup, or professional data.

## Non-goals

- No PWA/service-worker work.
- No automatic build, update, dependency installation, or Git operation.
- No Termux service installation in this repository.
- No change to remote-provider consent, Local Semantic Memory authority, or persistence semantics.

## Selected approach

Introduce a small pure resolver `resolveServerBindHost(env)` in `src/server/runtimeHost.ts` and use it from `server.ts`.

Why this approach:

- avoids hard-coding Android logic in the main server;
- keeps hosted behavior backward compatible;
- gives the Termux supervisor a narrow, testable configuration surface;
- makes whitespace/unset behavior deterministic.

Rejected alternatives:

1. Change the default server bind to `127.0.0.1`: rejected because hosted deployments require external reachability.
2. Wrap the server with a local reverse proxy: rejected as unnecessary process/dependency surface.
3. Patch `server.ts` only with inline environment parsing: workable, but a pure resolver is easier to test and govern.

## Contract

`resolveServerBindHost(env: Record<string, string | undefined>): string`

Rules:

- `TRAMA_BIND_HOST` trimmed non-empty value → return that exact trimmed value.
- unset/empty/whitespace → return `0.0.0.0`.

`server.ts` must call:

- `const BIND_HOST = resolveServerBindHost(process.env);`
- `app.listen(PORT, BIND_HOST, ...)`.

## Security and compatibility

- The local supervisor is responsible for supplying `127.0.0.1`.
- The application does not accept a bind host from browser requests or user content.
- Existing production startup smoke remains authoritative for the default hosted path.
- Add a qualification invariant covering `server.ts`, `src/server/runtimeHost.ts`, and its regression test.

## Acceptance

1. Pure tests pass for unset, empty, whitespace, `127.0.0.1`, and `0.0.0.0`.
2. Static contract proves `server.ts` uses the resolver rather than a literal host.
3. PREDEPLOY typecheck, security, Library, build, and production startup smoke PASS on the exact candidate.
4. No browser-facing behavior changes.