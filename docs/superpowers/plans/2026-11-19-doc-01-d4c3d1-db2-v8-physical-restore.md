# DOC-01/D4c3d1 — DB2 physical V8 restoration, laboratory only

Date: 2026-11-19. Parent exact SHA: `c81d8dd2436c6e3e999732d304f4738d70f796c9` (DOC-01/D4c3c2; 11/11 qualified).

## Situation for the teacher
The teacher must be able to recover the same encrypted local working archive, including all historical confirmations, corrections and withdrawals, without wiping assessments or other professional data. No data are sent to a server. A future recovery interface must show the effect of replacement and require explicit teacher confirmation. This phase adds no visible controls; professional UX acceptance is not claimed.

## Existing architecture reused
- Exact ten-record IndexedDB V2 physical inventory, AES-GCM encryption and wrapped data-encryption key.
- Authenticated owner `VaultMetadataV1`, physical compare-and-swap `replaceDb2`, readback `captureDb2`, one-use `commit` and revocation via `invalidate`.
- V8 isolated codec with independent DOC-01 scope and V7 assessment scope checks, append-only preservation and logical current recovery checkpoint.
- Existing encrypted envelope V2, bounded immutable Blob input and strict version.

## RED → GREEN execution
1. Branch-before-write, freeze tests and qualify a causal RED: the new `prepareDocumentRestore` entrypoint initially throws `DOC01_D4C3D1_NOT_IMPLEMENTED`.
2. Add synthetic Chromium DB2 tests to existing exact-SHA BETA2 browser gate. Tests exercise encrypted full-inventory replacement, key rotation, original event preservation with revocation append, full archive readback, cold reauthentication, and conservation of assessments/grades.
3. Prove denial without write for loss of document history, unverified recovery copy, unauthorized document scope, bad password, explicit refusal, one-use grant replay, invalidated consent, physical transaction abort and stale generation.
4. GREEN only in existing `src/security/db2Lifecycle.ts`: prepare V8 with two independently encrypted V2 copies; verify current owner and readback before consent; delegate to qualified V8 preservation policy; construct new encrypted owner; use existing atomic commit.
5. Verify 141 invariants and all inherited Bun tests; require observed exact-SHA browser qualification and native gate status before claiming completeness.

## Exclusions
No real data or production entrypoint, Android SAF V8 picker/write/readback or process restart under Android V8, no release, no merge, no automatic consent, no signature and no anti-rollback hardware. No emergency downgrade bypass. The later Android qualification is a separate gate.
