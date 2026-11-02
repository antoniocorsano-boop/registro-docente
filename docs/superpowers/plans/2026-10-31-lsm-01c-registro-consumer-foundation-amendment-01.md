# LSM-01C-A — Amendment 01: vendored contract import

**Data:** 2026-10-31  
**Applies to:** `2026-10-31-lsm-01c-registro-consumer-foundation-design.md` and implementation plan  
**Reason:** Task 1 RED/GREEN qualification discovered that hand-editing the Bun lockfile introduced accidental mutations to pre-existing integrity digests. The frozen install gate correctly rejected the candidate.

## Decision

The exact `@trama/contextual-copilot-semantic-memory@0.1.0` distribution remains vendored byte-for-byte under `vendor/contextual-copilot-semantic-memory/` with its provenance receipt, but LSM-01C-A does **not** add it to root `package.json` or `bun.lock`.

Consumer code imports the vendored contract through a Registro-local wrapper/direct local module path. This preserves the exact shared contract while keeping the root dependency graph and lockfile unchanged.

## Invariants

- vendored files must match the four LSM-01A SHA-256 digests;
- no external registry or build-time network is introduced;
- `package.json` and `bun.lock` remain byte-identical to the LSM-01C baseline for Task 1;
- future consumer modules may depend only on the vendored local contract and may not copy/redefine LSM envelope schemas;
- this amendment does not change authority, privacy, CAS, explicit-connect or no-auto-probe requirements.

## Qualification

Task 1 GREEN requires `bun install --frozen-lockfile` on the unmodified baseline lockfile plus the vendor-contract test that recomputes all four source SHA-256 digests and loads the vendored runtime validators directly.
